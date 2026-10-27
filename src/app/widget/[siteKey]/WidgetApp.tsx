"use client";

// Widget del visitante. Vive dentro de un iframe que inserta /widget.js en el
// sitio del cliente; recibe los mensajes por SSE y le pide al anfitrión que
// redimensione el iframe según esté abierto o cerrado.

import { tr, trSystem } from "@/lib/i18n";
import { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Face as Mood, IconChat, IconClip, IconClose, IconDots, IconMail, IconMinus, IconSend, IconWhatsApp } from "@/components/icons";
import { clock } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { copyText, transcript } from "@/lib/transcript";
import { MatrixRain } from "./MatrixRain";
import { useClient } from "@/lib/useClient";
import { ding } from "@/lib/sound";
import type { ConversationStatus, Message, Rating, WidgetConfig } from "@/lib/types";

type Msg = Message & { pending?: boolean; failed?: boolean };
type Conv = {
  id: number;
  status: ConversationStatus;
  rating: Rating | null;
  agent_id?: number | null;
  ai_agent_id?: number | null;
  ai_paused?: boolean;
};
type AiInfo = { id: number; name: string; avatar: string | null };
// Quien atiende (humano o IA): su foto y nombre se ven en el botón, la cabecera y "escribiendo".
type Face = { name: string; avatar: string | null; contact_email?: string | null; whatsapp?: string | null };
type Me = { id: number; name: string | null; email: string | null };
type Page = { url?: string; title?: string; referrer?: string };

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

// Clave del visitante: la pasa /widget.js en ?v=; si se abre la URL directa, generamos una.
let visitorKey: string | null = null;
function readVisitorKey() {
  if (visitorKey) return visitorKey;
  let key = new URLSearchParams(location.search).get("v");
  if (!key) {
    try {
      key = localStorage.getItem("falconchato_v") ?? uid();
      localStorage.setItem("falconchato_v", key);
    } catch {
      key = uid();
    }
  }
  return (visitorKey = key);
}

function readSound() {
  try {
    return localStorage.getItem("falconchato_sound") !== "0";
  } catch {
    return true;
  }
}

function toParent(type: string, data?: unknown) {
  if (window.parent !== window) window.parent.postMessage({ source: "falconchato", type, data }, "*");
}

export default function WidgetApp({ params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = use(params);
  const vkey = useClient(readVisitorKey, "");
  const [cfg, setCfg] = useState<WidgetConfig | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [onlineAgents, setOnlineAgents] = useState<number[]>([]);
  const [conv, setConv] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [unread, setUnread] = useState(0);
  // Mensaje automático: burbuja sobre el botón (teaser) y primer mensaje del chat.
  const [teaser, setTeaser] = useState<string | null>(null);
  const [autoShown, setAutoShown] = useState(false);
  const [agentTyping, setAgentTyping] = useState<{ name: string; agentId?: number; aiId?: number } | null>(null);
  const [sound, setSound] = useState(() => typeof window !== "undefined" && readSound());
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  // Pestañas del widget abierto: chat o preguntas frecuentes.
  const [view, setView] = useState<"chat" | "faq">("chat");
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openRef = useRef(open);
  const dismissed = useRef(false);
  const soundRef = useRef(sound);
  const convIdRef = useRef<number | null>(null);
  const launcherRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  useEffect(() => {
    convIdRef.current = conv?.id ?? null;
  }, [conv]);

  const api = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/widget/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: siteKey, v: vkey, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(tr(data.error ?? "No se pudo conectar"));
      return data;
    },
    [siteKey, vkey],
  );

  const load = useCallback(
    async (page: Page) => {
      const data = await api("init", { page });
      setCfg(data.site);
      setMe(data.visitor);
      setOnlineAgents(data.online_agents);
      setConv(data.conversation);
      setMsgs(data.messages);
    },
    [api],
  );

  const onIncoming = useCallback((m: Message) => {
    setMsgs((prev) => {
      const i = prev.findIndex((p) => p.client_id === m.client_id);
      if (i >= 0) return prev.map((p, j) => (j === i ? m : p));
      // Mensaje de un chat nuevo (p. ej. el agente inicia la conversación).
      if (convIdRef.current !== null && m.conversation_id > convIdRef.current) {
        return [...prev.filter((p) => p.pending), m];
      }
      return [...prev, m];
    });
    if (m.sender === "agent" || m.sender === "bot") {
      setAgentTyping(null);
      setConv((c) => (c && c.id >= m.conversation_id ? c : { id: m.conversation_id, status: "open", rating: null }));
      if (soundRef.current) ding();
      // Aviso en el título de la pestaña del sitio si el chat no está a la vista.
      if (!openRef.current || document.hidden) {
        toParent("notify", { text: `${m.author_name ?? tr("Nuevo mensaje")}: ${m.body}` });
      }
      // Se abre solo si el visitante no lo ha minimizado; si no, globo con el contador.
      if (!openRef.current) {
        if (dismissed.current) setUnread((u) => u + 1);
        else setOpen(true);
      }
    }
  }, []);

  // Arranque: esperar la info de la página del anfitrión, cargar y abrir el SSE.
  useEffect(() => {
    if (!vkey) return;
    let started = false;
    let es: EventSource | null = null;
    let lost = false;
    let typingClear: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      es = new EventSource(`/api/widget/stream?site=${encodeURIComponent(siteKey)}&v=${encodeURIComponent(vkey)}`);
      es.addEventListener("message", (e) => onIncoming(JSON.parse(e.data)));
      es.addEventListener("presence", (e) => setOnlineAgents(JSON.parse(e.data).online));
      // Cambios guardados en el panel (color, textos, IA…): se aplican sin recargar.
      es.addEventListener("site", (e) => {
        const d = JSON.parse(e.data) as { site_key: string; config: WidgetConfig };
        if (d.site_key === siteKey) setCfg(d.config);
      });
      es.addEventListener("conversation", (e) => {
        const c = JSON.parse(e.data) as Conv;
        setConv((prev) => (!prev || prev.id <= c.id ? c : prev));
      });
      es.addEventListener("typing", (e) => {
        const t = JSON.parse(e.data) as { typing: boolean; name: string; agent_id?: number; ai_agent_id?: number };
        setAgentTyping(t.typing ? { name: t.name, agentId: t.agent_id, aiId: t.ai_agent_id } : null);
        clearTimeout(typingClear);
        if (t.typing) typingClear = setTimeout(() => setAgentTyping(null), 8000);
      });
      es.onopen = () => {
        setConnected(true);
        // Tras una reconexión, recargar por si se perdió algo.
        if (lost) load({}).catch(() => {});
        lost = false;
      };
      es.onerror = () => {
        lost = true;
        setConnected(false);
      };
    };

    const start = (page: Page) => {
      if (started) return;
      started = true;
      load(page)
        .then(connect)
        .catch((e) => {
          setError(e.message);
          console.warn("[falconchato]", e.message);
        });
    };

    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const m = e.data as { source?: string; type?: string; data?: Page & { full?: boolean } };
      if (m?.source !== "falconchato-host") return;
      if (m.type === "page") {
        if (!started) start(m.data ?? {});
        else api("page", { page: m.data }).catch(() => {});
      }
      if (m.type === "open") show();
      if (m.type === "close") setOpen(false);
      if (m.type === "layout") setFull(!!m.data?.full);
    };
    window.addEventListener("message", onMessage);

    let fallback: ReturnType<typeof setTimeout> | undefined;
    if (window.parent !== window) {
      toParent("ready");
      fallback = setTimeout(() => start({ url: document.referrer }), 1500);
    } else {
      start({ url: location.href, title: document.title });
    }

    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(fallback);
      clearTimeout(typingClear);
      es?.close();
    };
  }, [vkey, siteKey, api, load, onIncoming]);

  // Tamaño del iframe en la página anfitriona.
  useLayoutEffect(() => {
    if (!cfg || error) return;
    if (open) {
      toParent("resize", { mode: "open", width: 416, height: 680, position: cfg.position });
      return;
    }
    const send = () => {
      const r = launcherRef.current?.getBoundingClientRect();
      if (r) toParent("resize", { mode: "closed", width: Math.ceil(r.width + 48), height: Math.ceil(r.height + 48), position: cfg.position });
    };
    send();
    const ro = new ResizeObserver(send);
    if (launcherRef.current) ro.observe(launcherRef.current);
    return () => ro.disconnect();
  }, [open, cfg, error, onlineAgents, unread, teaser]);

  const active = conv && conv.status !== "closed" ? conv : null;
  // Disponible si hay un humano asignado al sitio en línea, o la IA atiende.
  const assigned = cfg?.agent_ids ?? [];
  const humans = assigned.length ? onlineAgents.some((id) => assigned.includes(id)) : onlineAgents.length > 0;
  const aiOn = !!cfg?.ai && (cfg.ai.mode === "always" || !humans);
  const online = humans || aiOn;
  const aiAgents = cfg?.ai?.agents ?? [];
  const team = cfg?.team ?? [];
  const bot: AiInfo | null =
    active?.ai_agent_id && !active.ai_paused ? (aiAgents.find((a) => a.id === active.ai_agent_id) ?? null) : null;
  // Prioridad: quien lleva el chat; si no hay chat, el primer humano en línea o el agente IA.
  const human = active?.agent_id && !bot ? team.find((a) => a.id === active.agent_id) : undefined;
  const face: Face | null =
    bot ?? human ?? (humans ? team.find((a) => onlineAgents.includes(a.id)) : undefined) ?? (aiOn ? aiAgents[0] : undefined) ?? null;
  const typingFace: Face | null = agentTyping
    ? {
        name: agentTyping.name,
        avatar:
          (agentTyping.aiId ? aiAgents.find((a) => a.id === agentTyping.aiId)?.avatar : team.find((a) => a.id === agentTyping.agentId)?.avatar) ??
          null,
      }
    : null;

  function show() {
    setUnread(0);
    setTeaser(null);
    setOpen(true);
  }

  // Mensaje automático: a los N segundos, si no está chateando y no lo vio en las últimas 24 h.
  const autoMessage = cfg?.auto_message?.trim() || null;
  const autoDelay = cfg?.auto_message_delay ?? 5;
  const idle = !conv && msgs.length === 0;
  useEffect(() => {
    if (!autoMessage || !idle || open || autoShown) return;
    const key = `falconchato_auto_${siteKey}`;
    try {
      if (Date.now() - Number(localStorage.getItem(key) ?? 0) < 24 * 3600_000) return;
    } catch {}
    const t = setTimeout(() => {
      setAutoShown(true);
      setTeaser(autoMessage);
      setUnread((u) => u + 1);
      if (soundRef.current) ding();
      toParent("notify", { text: tr("(1) Tienes un mensaje nuevo") });
      try {
        localStorage.setItem(key, String(Date.now()));
      } catch {}
    }, autoDelay * 1000);
    return () => clearTimeout(t);
  }, [autoMessage, autoDelay, idle, open, autoShown, siteKey]);

  async function send(text: string, extra?: { name?: string; email?: string }, attachment?: string) {
    const body = text.trim();
    if (!body && !attachment) return;
    const client_id = uid();
    setMsgs((p) => [
      ...p,
      {
        client_id,
        created_at: new Date().toISOString(),
        conversation_id: active?.id ?? 0,
        sender: "visitor",
        agent_id: null,
        author_name: extra?.name ?? me?.name ?? null,
        body,
        attachment: attachment ?? null,
        pending: true,
      },
    ]);
    try {
      const data = await api("messages", { body, client_id, ...extra, ...(attachment ? { attachment } : {}) });
      setConv((c) => (c?.id === data.conversation.id ? c : { ...data.conversation, rating: null }));
      setMsgs((p) => p.map((m) => (m.client_id === client_id ? { ...m, ...data.message, pending: false } : m)));
      if (extra?.name || extra?.email) setMe((m) => m && { ...m, name: extra.name ?? m.name, email: extra.email ?? m.email });
    } catch (e) {
      setMsgs((p) => p.map((m) => (m.client_id === client_id ? { ...m, pending: false, failed: true } : m)));
      throw e;
    }
  }

  // "Escribiendo…" con vista previa: como mucho cada 400 ms, y vacío al enviar.
  const lastTyping = useRef(0);
  function typing(text: string) {
    if (!active) return;
    clearTimeout(typingTimer.current);
    const fire = () => {
      lastTyping.current = Date.now();
      api("typing", { text }).catch(() => {});
    };
    if (!text || Date.now() - lastTyping.current > 400) fire();
    else typingTimer.current = setTimeout(fire, 400);
  }

  if (!cfg || error) return null;

  const side = cfg.position === "left" ? "left-6" : "right-6";
  const status = online ? tr("En línea") : tr("Déjanos un mensaje");

  if (!open) {
    return (
      <div ref={launcherRef} className={`fixed bottom-6 ${side} flex w-max max-w-[300px] flex-col gap-3 ${cfg.position === "left" ? "items-start" : "items-end"}`}>
        {teaser && (
          <div className="fc-pop relative rounded-2xl bg-white p-4 pr-8 text-sm leading-relaxed text-zinc-800 shadow-[0_4px_14px_rgba(0,0,0,.18)]">
            <button
              onClick={() => {
                setTeaser(null);
                setUnread(0);
              }}
              className="absolute right-2 top-2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label={tr("Cerrar")}
            >
              <IconClose width={14} height={14} />
            </button>
            <div className="cursor-pointer whitespace-pre-wrap break-words" onClick={show}>
              <Linkify text={teaser} />
            </div>
          </div>
        )}
      <button
        onClick={show}
        className={`fc-pop relative flex w-max items-center gap-3 rounded-full py-3 pl-4 pr-5 text-white shadow-[0_4px_14px_rgba(0,0,0,.2)] transition hover:brightness-110`}
        style={{ background: cfg.color }}
      >
        <span className="relative">
          {face ? <FaceAvatar face={face} size={34} /> : <IconChat width={22} height={22} />}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${online ? "bg-green-500" : "bg-zinc-400"}`}
            style={{ borderColor: cfg.color }}
          />
        </span>
        <span className="text-left leading-tight">
          <span className="block text-[15px] font-semibold">{face ? face.name : cfg.title}</span>
          <span className="block text-xs opacity-85">{status}</span>
        </span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-red-600 px-1.5 text-xs font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      </div>
    );
  }

  return (
    <div
      className={`fc-pop fixed flex flex-col overflow-hidden bg-white text-zinc-800 ${
        full ? "inset-0" : "inset-6 rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,.18)]"
      }`}
    >
      <header className="relative flex items-center gap-3 px-4 py-3 text-white" style={{ background: cfg.color }}>
        {face ? (
          <FaceAvatar face={face} size={40} ring />
        ) : (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20">
            <IconChat width={20} height={20} />
          </div>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15px] font-semibold">{face ? face.name : cfg.title}</div>
          <div className="flex items-center gap-1.5 text-xs opacity-90">
            <span className={`h-2 w-2 rounded-full ${online ? "bg-green-400 ring-2 ring-green-400/30" : "bg-white/40"}`} />
            {connected ? status : tr("Reconectando…")}
          </div>
        </div>
        {face?.contact_email && (
          <a href={`mailto:${face.contact_email}`} className="rounded-md p-1.5 hover:bg-white/15" title={face.contact_email} aria-label={tr("Escribir un email")}>
            <IconMail />
          </a>
        )}
        {face?.whatsapp && (
          <a
            href={`https://wa.me/${face.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-1.5 hover:bg-white/15"
            title={`WhatsApp ${face.whatsapp}`}
            aria-label="WhatsApp"
          >
            <IconWhatsApp />
          </a>
        )}
        <button onClick={() => setMenu((m) => !m)} className="rounded-md p-1.5 hover:bg-white/15" aria-label={tr("Opciones")}>
          <IconDots />
        </button>
        <button
          onClick={() => {
            dismissed.current = true;
            setOpen(false);
          }}
          className="rounded-md p-1.5 hover:bg-white/15"
          aria-label={tr("Minimizar")}
        >
          <IconMinus />
        </button>
        {menu && (
          <div className="absolute right-3 top-14 z-10 w-52 overflow-hidden rounded-lg bg-white py-1 text-sm text-zinc-700 shadow-xl ring-1 ring-black/5">
            <button
              className="flex w-full justify-between px-4 py-2 hover:bg-zinc-50"
              onClick={() => {
                setSound(!sound);
                try {
                  localStorage.setItem("falconchato_sound", sound ? "0" : "1");
                } catch {}
              }}
            >
              {tr("Sonido")} <span className="text-zinc-400">{tr(sound ? "Activado" : "Desactivado")}</span>
            </button>
            {msgs.length > 0 && (
              <button
                className="flex w-full justify-between px-4 py-2 hover:bg-zinc-50"
                onClick={async () => {
                  const ok = await copyText(transcript(msgs, me?.name || tr("Yo")));
                  setCopied(ok);
                  setTimeout(() => {
                    setCopied(false);
                    setMenu(false);
                  }, 1200);
                }}
              >
                {tr("Copiar conversación")}
                {copied && <span className="text-zinc-400">{tr("Copiado")}</span>}
              </button>
            )}
            {active && (
              <button
                className="block w-full px-4 py-2 text-left font-medium text-red-600 hover:bg-red-50"
                onClick={() => {
                  setMenu(false);
                  if (confirm(tr("¿Finalizar este chat?"))) api("end", {}).catch(() => {});
                }}
              >
                {tr("Finalizar chat")}
              </button>
            )}
          </div>
        )}
      </header>

      {cfg.faqs?.length > 0 && (
        <div className="flex border-b border-zinc-100 bg-white text-sm" role="tablist">
          {(["chat", "faq"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={view === t}
              onClick={() => setView(t)}
              className={`flex-1 border-b-2 py-2 font-medium ${view === t ? "text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
              style={view === t ? { borderColor: cfg.color } : undefined}
            >
              {t === "chat" ? tr("Chat") : tr("Preguntas frecuentes")}
            </button>
          ))}
        </div>
      )}

      {view === "faq" && cfg.faqs?.length > 0 ? (
        <FaqView faqs={cfg.faqs} color={cfg.color} onAsk={() => setView("chat")} />
      ) : !active && !online && (!conv || conv.status === "closed") ? (
        <OfflineForm cfg={cfg} me={me} onSend={send} autoMessage={autoShown ? autoMessage : null} />
      ) : (
        <ChatBody
          cfg={cfg}
          msgs={msgs}
          aiAgents={aiAgents}
          autoMessage={autoShown ? autoMessage : null}
          conv={conv}
          agentTyping={typingFace}
          team={team}
          me={me}
          onSend={(t, attachment) => send(t, undefined, attachment).catch(() => {})}
          onTyping={typing}
          onRate={(rating, comment) => {
            if (!conv) return;
            setConv({ ...conv, rating });
            api("rate", { conversation_id: conv.id, rating, ...(comment !== undefined ? { comment } : {}) }).catch(() => {});
          }}
          onNew={() => {
            setConv(null);
            setMsgs([]);
          }}
        />
      )}

      <footer className="border-t border-zinc-100 py-1.5 text-center text-[11px] text-zinc-400">
        {tr("Chat con")} <span className="font-semibold text-zinc-500">{tr("falconchato")}</span>
      </footer>
    </div>
  );
}

function ChatBody(props: {
  cfg: WidgetConfig;
  msgs: Msg[];
  aiAgents: AiInfo[];
  autoMessage: string | null;
  conv: Conv | null;
  agentTyping: Face | null;
  team: (Face & { id: number })[];
  me: Me | null;
  onSend: (text: string, attachment?: string) => void;
  onTyping: (text: string) => void;
  onRate: (r: Rating, comment?: string) => void;
  onNew: () => void;
}) {
  const { cfg, msgs, conv, agentTyping, me } = props;
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const closed = conv?.status === "closed";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, agentTyping, closed]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  // Foto: se comprime en el navegador y se envía con el texto escrito (si lo hay).
  const attach = async (file: File) => {
    try {
      const data = await compressImage(file);
      props.onSend(text, data);
      props.onTyping("");
      setText("");
    } catch {
      alert(tr("Solo se pueden adjuntar imágenes"));
    }
  };

  const submit = () => {
    if (!text.trim()) return;
    props.onSend(text);
    props.onTyping("");
    setText("");
  };

  return (
    <>
      <div className="relative min-h-0 flex-1 bg-zinc-50">
        {cfg.matrix_effect !== false && <MatrixRain color={cfg.color} />}
        <div ref={listRef} className="absolute inset-0 space-y-2.5 overflow-y-auto px-4 py-4">
        <Bubble side="left" color={cfg.color} author={cfg.name}>
          {cfg.welcome_message}
        </Bubble>
        {props.autoMessage && (
          <Bubble side="left" color={cfg.color}>
            {props.autoMessage}
          </Bubble>
        )}
        {msgs.map((m) =>
          m.sender === "system" ? (
            <div key={m.client_id} className="py-1 text-center text-xs text-zinc-400">
              {trSystem(m.body)}
            </div>
          ) : (
            <Bubble
              key={m.client_id}
              side={m.sender === "visitor" ? "right" : "left"}
              color={cfg.color}
              author={m.sender === "visitor" ? null : m.author_name}
              avatar={
                m.sender === "bot"
                  ? props.aiAgents.find((a) => a.id === m.agent_id)?.avatar
                  : m.sender === "agent"
                    ? props.team.find((a) => a.id === m.agent_id)?.avatar
                    : null
              }
              time={m.created_at}
              pending={m.pending}
              failed={m.failed}
              bot={m.sender === "bot"}
              attachment={m.attachment}
              onImage={setZoom}
            >
              {m.body}
            </Bubble>
          ),
        )}
        {conv?.status === "offline" && (
          <div className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
            {tr("Recibimos tu mensaje.")} {me?.email ? tr("Te responderemos a {email}.", { email: me.email }) : tr("Te responderemos lo antes posible.")}
          </div>
        )}
        {agentTyping && (
          <div className="fc-pop flex flex-col items-start" aria-live="polite">
            <span className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-medium text-zinc-500">
              <FaceAvatar face={agentTyping} size={20} />
              {agentTyping.name}
            </span>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm" title={`${agentTyping.name} ${tr("está escribiendo…")}`}>
              <i className="fc-dot h-2 w-2 rounded-full bg-zinc-400" />
              <i className="fc-dot h-2 w-2 rounded-full bg-zinc-400" />
              <i className="fc-dot h-2 w-2 rounded-full bg-zinc-400" />
            </div>
          </div>
        )}
        {closed && (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 text-center">
            <div className="text-sm font-medium">{tr("El chat ha finalizado")}</div>
            <RatingBox
              rating={conv.rating}
              color={cfg.color}
              onRate={props.onRate}
            />
            <button onClick={props.onNew} className="mt-3 text-xs font-medium underline" style={{ color: cfg.color }}>
              {tr("Iniciar un chat nuevo")}
            </button>
          </div>
        )}
        </div>
      </div>
      <div className="flex items-end gap-2 border-t border-zinc-100 bg-white p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) attach(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="grid h-10 w-9 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          aria-label={tr("Adjuntar foto")}
          title={tr("Adjuntar foto")}
        >
          <IconClip />
        </button>
        <textarea
          value={text}
          rows={1}
          onPaste={(e) => {
            const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
            if (f) {
              e.preventDefault();
              attach(f);
            }
          }}
          onChange={(e) => {
            setText(e.target.value);
            props.onTyping(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={tr("Escribe tu mensaje aquí")}
          className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white transition disabled:opacity-40"
          style={{ background: cfg.color }}
          aria-label={tr("Enviar")}
        >
          <IconSend />
        </button>
      </div>
      {zoom && (
        <button type="button" onClick={() => setZoom(null)} className="fixed inset-0 z-20 grid place-items-center bg-black/80 p-4" aria-label={tr("Cerrar")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt={tr("Foto adjunta")} className="max-h-full max-w-full rounded-lg" />
        </button>
      )}
    </>
  );
}

function Bubble(props: {
  side: "left" | "right";
  color: string;
  author?: string | null;
  avatar?: string | null;
  time?: string;
  pending?: boolean;
  failed?: boolean;
  bot?: boolean;
  attachment?: string | null;
  onImage?: (src: string) => void;
  children: React.ReactNode;
}) {
  const right = props.side === "right";
  const hasText = typeof props.children === "string" ? props.children.trim().length > 0 : !!props.children;
  return (
    <div className={`flex flex-col ${right ? "items-end" : "items-start"}`}>
      {props.author && (
        <span className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-medium text-zinc-500">
          {props.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
          )}
          {props.author}
        </span>
      )}
      {props.attachment && (
        <button type="button" onClick={() => props.onImage?.(props.attachment!)} className={`mb-1 block max-w-[70%] ${props.pending ? "opacity-70" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.attachment} alt={tr("Foto adjunta")} className="max-h-60 rounded-2xl object-cover shadow-sm" />
        </button>
      )}
      {hasText && (
        <div
          className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            right
              ? "rounded-br-md text-white"
              : props.bot
                ? "rounded-bl-md border border-green-100 bg-green-50 text-zinc-800"
                : "rounded-bl-md bg-white text-zinc-800 shadow-sm"
          } ${props.pending ? "opacity-70" : ""}`}
          style={right ? { background: props.color } : undefined}
        >
          {typeof props.children === "string" ? <Linkify text={props.children} light={right} /> : props.children}
        </div>
      )}
      {(props.time || props.failed) && (
        <span className={`mt-0.5 px-1 text-[10px] ${props.failed ? "text-red-500" : "text-zinc-400"}`}>
          {props.failed ? tr("No se pudo enviar") : clock(props.time!)}
        </span>
      )}
    </div>
  );
}

function OfflineForm({
  cfg,
  me,
  onSend,
  autoMessage,
}: {
  cfg: WidgetConfig;
  me: Me | null;
  autoMessage: string | null;
  onSend: (text: string, extra: { name?: string; email?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(me?.name ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await onSend(text, { name: name.trim() || undefined, email: email.trim() || undefined });
        } catch (e) {
          setErr(e instanceof Error ? e.message : tr("No se pudo enviar"));
        } finally {
          setBusy(false);
        }
      }}
    >
      {autoMessage && (
        <p className="whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-relaxed text-zinc-800 shadow-sm">
          <Linkify text={autoMessage} />
        </p>
      )}
      <p className="rounded-xl bg-white p-3 text-sm leading-relaxed text-zinc-600 shadow-sm">{cfg.offline_message}</p>
      <label className="block text-xs font-medium text-zinc-600">
        {tr("Nombre")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600">
        {tr("Email *")}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600">
        {tr("Mensaje *")}
        <textarea
          required
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-1 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        disabled={busy}
        className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: cfg.color }}
      >
        {busy ? tr("Enviando…") : tr("Enviar mensaje")}
      </button>
    </form>
  );
}

// Texto con los enlaces (http/https) clicables.
function Linkify({ text, light }: { text: string; light?: boolean }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g).map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline [overflow-wrap:anywhere] ${light ? "text-white" : "text-zinc-900"}`}
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

// Foto del agente o, si no tiene, sus iniciales.
function FaceAvatar({ face, size, ring }: { face: Face; size: number; ring?: boolean }) {
  const cls = `shrink-0 rounded-full ${ring ? "ring-2 ring-white/30" : ""}`;
  if (face.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={face.avatar} alt="" className={`${cls} object-cover`} style={{ width: size, height: size }} />;
  }
  const initials = face.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <span className={`${cls} grid place-items-center bg-zinc-500 font-semibold text-white`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials || "·"}
    </span>
  );
}

// Valoración con tres caras y comentario opcional.
function RatingBox({ rating, color, onRate }: { rating: Rating | null; color: string; onRate: (r: Rating, comment?: string) => void }) {
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const moods: [Rating, string][] = [
    ["good", tr("Contento")],
    ["neutral", tr("Normal")],
    ["bad", tr("Descontento")],
  ];
  return (
    <>
      <div className="mt-1 text-xs text-zinc-500">{sent ? tr("¡Gracias por tu valoración!") : tr("¿Cómo te atendimos?")}</div>
      <div className="mt-3 flex justify-center gap-3">
        {moods.map(([r, label]) => (
          <button
            key={r}
            onClick={() => onRate(r)}
            className={`grid h-11 w-11 place-items-center rounded-full border-2 transition ${
              rating === r ? "text-white" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            }`}
            style={rating === r ? { background: color, borderColor: color } : undefined}
            aria-label={label}
            aria-pressed={rating === r}
            title={label}
          >
            <Mood mood={r} width={24} height={24} />
          </button>
        ))}
      </div>
      {rating && !sent && (
        <form
          className="mt-3 space-y-2 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            onRate(rating, comment);
            setSent(true);
          }}
        >
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={tr("Déjanos un comentario (opcional)")}
            className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
          <button className="w-full rounded-lg py-2 text-sm font-semibold text-white" style={{ background: color }}>
            {tr("Enviar valoración")}
          </button>
        </form>
      )}
    </>
  );
}

// Preguntas frecuentes: buscador y respuestas desplegables.
function FaqView({ faqs, color, onAsk }: { faqs: WidgetConfig["faqs"]; color: string; onAsk: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const shown = faqs.filter((f) => !q || norm(f.question + " " + f.answer).includes(norm(q)));
  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 p-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tr("Buscar en las preguntas frecuentes")}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
      />
      <ul className="mt-3 space-y-2">
        {shown.map((f) => (
          <li key={f.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
            <button
              onClick={() => setOpen(open === f.id ? null : f.id)}
              aria-expanded={open === f.id}
              className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm font-medium text-zinc-800"
            >
              <span className="flex-1">{f.question}</span>
              <span className={`text-zinc-400 transition ${open === f.id ? "rotate-180" : ""}`}>▾</span>
            </button>
            {open === f.id && (
              <div className="whitespace-pre-wrap break-words border-t border-zinc-100 px-3.5 py-3 text-sm leading-relaxed text-zinc-600">
                <Linkify text={f.answer} />
              </div>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="py-4 text-center text-sm text-zinc-500">{tr("Ninguna coincide.")}</li>}
      </ul>
      <div className="mt-4 text-center">
        <p className="text-xs text-zinc-500">{tr("¿No encuentras la respuesta?")}</p>
        <button onClick={onAsk} className="mt-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: color }}>
          {tr("Escríbenos")}
        </button>
      </div>
    </div>
  );
}
