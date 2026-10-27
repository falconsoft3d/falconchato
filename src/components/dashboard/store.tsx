"use client";

// Estado en tiempo real del panel: una sola conexión SSE (/api/stream) que
// alimenta chats, mensajes, visitantes en línea y presencia de agentes.

import { createContext, use, useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { conversationName } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { ding, knock } from "@/lib/sound";
import type { Agent, AgentPresence, AiAgent, Conversation, LiveVisitor, Message, Site, Visitor } from "@/lib/types";

export type Msg = Message & { pending?: boolean; failed?: boolean };
type Typing = { text: string; sender: "visitor" | "agent" | "bot"; at: number };

type State = {
  ready: boolean;
  connected: boolean;
  me: Agent | null;
  agents: AgentPresence[];
  sites: Site[];
  conversations: Record<number, Conversation>;
  messages: Record<number, Msg[]>;
  typing: Record<number, Typing | undefined>;
  visitors: Record<number, LiveVisitor>;
  aiAgents: AiAgent[];
  // Último visitante nuevo ("toc, toc").
  knock: { visitor: LiveVisitor; at: number } | null;
};

type Action =
  | { type: "load"; me: Agent; sites: Site[]; conversations: Conversation[]; visitors: LiveVisitor[] }
  | { type: "connected"; value: boolean }
  | { type: "me"; me: Agent }
  | { type: "agents"; agents: AgentPresence[] }
  | { type: "sites"; sites: Site[] }
  | { type: "conversation"; c: Conversation }
  | { type: "messages"; id: number; messages: Msg[] }
  | { type: "message"; m: Msg }
  | { type: "messageFailed"; clientId: string; conversationId: number }
  | { type: "typing"; id: number; typing: Typing | undefined }
  | { type: "visitor"; v: LiveVisitor }
  | { type: "visitorLeft"; id: number }
  | { type: "aiAgents"; agents: AiAgent[] }
  | { type: "knock"; visitor: LiveVisitor | null };

const initial: State = {
  ready: false,
  connected: false,
  me: null,
  agents: [],
  sites: [],
  conversations: {},
  messages: {},
  typing: {},
  visitors: {},
  aiAgents: [],
  knock: null,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "load": {
      // Conservamos los chats cerrados que ya estaban en memoria (p. ej. el abierto en pantalla).
      const conversations: Record<number, Conversation> = {};
      for (const c of Object.values(s.conversations)) if (c.status === "closed") conversations[c.id] = c;
      for (const c of a.conversations) conversations[c.id] = c;
      return {
        ...s,
        ready: true,
        me: a.me,
        sites: a.sites,
        conversations,
        visitors: Object.fromEntries(a.visitors.map((v) => [v.visitor.id, v])),
      };
    }
    case "connected":
      return { ...s, connected: a.value };
    case "me":
      return { ...s, me: a.me };
    case "agents":
      return { ...s, agents: a.agents };
    case "sites":
      return { ...s, sites: a.sites };
    case "conversation": {
      const visitors = { ...s.visitors };
      const v = visitors[a.c.visitor_id];
      if (v) visitors[a.c.visitor_id] = { ...v, conversation: a.c.status === "closed" ? null : a.c };
      return { ...s, conversations: { ...s.conversations, [a.c.id]: a.c }, visitors };
    }
    case "messages":
      return { ...s, messages: { ...s.messages, [a.id]: a.messages } };
    case "message": {
      const list = s.messages[a.m.conversation_id];
      if (!list) return s; // aún no se ha abierto ese chat: se cargará entero al abrirlo
      const i = list.findIndex((m) => m.client_id === a.m.client_id);
      const next = i >= 0 ? list.map((m, j) => (j === i ? a.m : m)) : [...list, a.m];
      const typing = a.m.sender === "visitor" ? { ...s.typing, [a.m.conversation_id]: undefined } : s.typing;
      return { ...s, messages: { ...s.messages, [a.m.conversation_id]: next }, typing };
    }
    case "messageFailed": {
      const list = s.messages[a.conversationId] ?? [];
      return {
        ...s,
        messages: {
          ...s.messages,
          [a.conversationId]: list.map((m) => (m.client_id === a.clientId ? { ...m, pending: false, failed: true } : m)),
        },
      };
    }
    case "typing":
      return { ...s, typing: { ...s.typing, [a.id]: a.typing } };
    case "visitor":
      return { ...s, visitors: { ...s.visitors, [a.v.visitor.id]: a.v } };
    case "aiAgents":
      return { ...s, aiAgents: a.agents };
    case "knock":
      return { ...s, knock: a.visitor ? { visitor: a.visitor, at: Date.now() } : null };
    case "visitorLeft": {
      const visitors = { ...s.visitors };
      delete visitors[a.id];
      return { ...s, visitors };
    }
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T = Record<string, unknown>>(path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.replace("/login");
  }
  if (!res.ok) throw new ApiError(tr(data.error ?? "Algo salió mal"), res.status);
  return data as T;
}

type Ctx = {
  state: State;
  dispatch: React.Dispatch<Action>;
  focus: (id: number | null) => void;
  openConversation: (id: number) => Promise<{ visitor: Visitor | null; visitor_online: boolean }>;
  sendMessage: (conversationId: number, body: string, attachment?: string) => Promise<void>;
  refreshSites: () => Promise<void>;
  refreshAiAgents: () => Promise<void>;
};

const StoreContext = createContext<Ctx | null>(null);

export function useStore() {
  const ctx = use(StoreContext);
  if (!ctx) throw new Error("useStore fuera de StoreProvider");
  return ctx;
}

const uid = () => crypto.randomUUID();

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const router = useRouter();
  const focused = useRef<number | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const load = useCallback(async () => {
    const [me, sites, convs, visitors, ai] = await Promise.all([
      api<{ agent: Agent }>("/api/me"),
      api<{ sites: Site[] }>("/api/sites"),
      api<{ conversations: Conversation[] }>("/api/conversations"),
      api<{ visitors: LiveVisitor[] }>("/api/visitors"),
      api<{ agents: AiAgent[] }>("/api/ai/agents"),
    ]);
    dispatch({ type: "aiAgents", agents: ai.agents });
    dispatch({ type: "load", me: me.agent, sites: sites.sites, conversations: convs.conversations, visitors: visitors.visitors });
    // Recargar también los chats que ya estaban abiertos en memoria.
    for (const id of Object.keys(stateRef.current.messages)) {
      api<{ messages: Msg[] }>(`/api/conversations/${id}`)
        .then((d) => dispatch({ type: "messages", id: Number(id), messages: d.messages }))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let lost = false;
    const typingTimers = new Map<number, ReturnType<typeof setTimeout>>();

    load().catch(() => {});
    es = new EventSource("/api/stream");
    es.onopen = () => {
      dispatch({ type: "connected", value: true });
      if (lost) load().catch(() => {});
      lost = false;
    };
    es.onerror = () => {
      lost = true;
      dispatch({ type: "connected", value: false });
    };
    const on = <T,>(event: string, fn: (data: T) => void) =>
      es!.addEventListener(event, (e) => fn(JSON.parse((e as MessageEvent).data)));

    on<{ agents: AgentPresence[] }>("hello", (d) => dispatch({ type: "agents", agents: d.agents }));
    on<AgentPresence[]>("agents", (agents) => dispatch({ type: "agents", agents }));
    on<Conversation>("conversation", (c) => dispatch({ type: "conversation", c }));
    on<LiveVisitor>("visitor", (v) => {
      // Visitante que acaba de entrar: "toc, toc".
      const isNew = stateRef.current.ready && !stateRef.current.visitors[v.visitor.id];
      dispatch({ type: "visitor", v });
      if (isNew) {
        dispatch({ type: "knock", visitor: v });
        if (stateRef.current.me?.status !== "invisible") knock();
      }
    });
    on<{ id: number }>("visitor_left", (d) => dispatch({ type: "visitorLeft", id: d.id }));
    on<Message>("message", (m) => {
      dispatch({ type: "message", m });
      if (m.sender === "visitor") notify(m);
    });
    on<{ conversation_id: number; sender: "visitor" | "agent" | "bot"; agent_id?: number; typing: boolean; text: string }>(
      "typing",
      (t) => {
        if (t.sender === "agent" && t.agent_id === stateRef.current.me?.id) return;
        clearTimeout(typingTimers.get(t.conversation_id));
        dispatch({
          type: "typing",
          id: t.conversation_id,
          typing: t.typing ? { text: t.text, sender: t.sender, at: Date.now() } : undefined,
        });
        if (t.typing) {
          typingTimers.set(
            t.conversation_id,
            setTimeout(() => dispatch({ type: "typing", id: t.conversation_id, typing: undefined }), 8000),
          );
        }
      },
    );

    function notify(m: Message) {
      const watching = focused.current === m.conversation_id && document.visibilityState === "visible";
      if (watching) {
        api(`/api/conversations/${m.conversation_id}`, { method: "PATCH", body: { action: "read" } }).catch(() => {});
        return;
      }
      if (stateRef.current.me?.status !== "invisible") ding();
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
        const c = stateRef.current.conversations[m.conversation_id];
        const n = new Notification(c ? conversationName(c) : "Nuevo mensaje", { body: m.body, tag: `fc-${m.conversation_id}` });
        n.onclick = () => {
          window.focus();
          router.push(`/dashboard/chats?c=${m.conversation_id}`);
        };
      }
    }

    return () => {
      es?.close();
      typingTimers.forEach(clearTimeout);
    };
  }, [load, router]);

  const openConversation = useCallback(async (id: number) => {
    const d = await api<{ conversation: Conversation; messages: Msg[]; visitor: Visitor | null; visitor_online: boolean }>(
      `/api/conversations/${id}`,
    );
    dispatch({ type: "conversation", c: d.conversation });
    dispatch({ type: "messages", id, messages: d.messages });
    return { visitor: d.visitor, visitor_online: d.visitor_online };
  }, []);

  const sendMessage = useCallback(async (conversationId: number, body: string, attachment?: string) => {
    const me = stateRef.current.me;
    const client_id = uid();
    dispatch({
      type: "message",
      m: {
        client_id,
        created_at: new Date().toISOString(),
        conversation_id: conversationId,
        sender: "agent",
        agent_id: me?.id ?? null,
        author_name: me?.name ?? null,
        body,
        attachment: attachment ?? null,
        pending: true,
      },
    });
    try {
      await api(`/api/conversations/${conversationId}/messages`, { body: { body, client_id, ...(attachment ? { attachment } : {}) } });
    } catch (e) {
      dispatch({ type: "messageFailed", clientId: client_id, conversationId });
      throw e;
    }
  }, []);

  const refreshAiAgents = useCallback(async () => {
    const d = await api<{ agents: AiAgent[] }>("/api/ai/agents");
    dispatch({ type: "aiAgents", agents: d.agents });
  }, []);

  const refreshSites = useCallback(async () => {
    const d = await api<{ sites: Site[] }>("/api/sites");
    dispatch({ type: "sites", sites: d.sites });
  }, []);

  const focus = useCallback((id: number | null) => {
    focused.current = id;
  }, []);

  // Contador en el título de la pestaña.
  const unread = Object.values(state.conversations).filter((c) => c.status !== "closed" && c.unread > 0).length;
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) falconchato` : "falconchato";
  }, [unread]);

  const value = useMemo(
    () => ({ state, dispatch, focus, openConversation, sendMessage, refreshSites, refreshAiAgents }),
    [state, focus, openConversation, sendMessage, refreshSites, refreshAiAgents],
  );
  return <StoreContext value={value}>{children}</StoreContext>;
}

export function activeConversations(state: State) {
  return Object.values(state.conversations)
    .filter((c) => c.status !== "closed")
    .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
}
