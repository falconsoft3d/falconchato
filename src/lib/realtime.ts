// Tiempo real: bus pub/sub en memoria + Server-Sent Events + presencia.
//
// Todas las escrituras pasan por este servidor, así que cuando llega un mensaje
// se publica en el bus y se empuja al instante por SSE a quien esté escuchando,
// sin esperar a falcondatabase ni hacer polling. El estado vive en globalThis
// para que lo compartan todas las rutas (y sobreviva al HMR en desarrollo).
//
// Requiere un único proceso Node (`next start`, Docker, VPS). Para varias
// réplicas habría que sustituir el bus por Redis pub/sub.

type Listener = (event: string, data: unknown) => void;

type VisitorPresence = {
  visitorId: number;
  siteId: number;
  connections: number;
  connectedAt: string;
  leaveTimer?: ReturnType<typeof setTimeout>;
};

type AgentConn = {
  agentId: number;
  name: string;
  status: string;
  connections: number;
  leaveTimer?: ReturnType<typeof setTimeout>;
};

type State = {
  channels: Map<string, Set<Listener>>;
  visitors: Map<number, VisitorPresence>;
  agents: Map<number, AgentConn>;
  onlineKey: string;
};

const g = globalThis as unknown as { __fcRealtime?: State };
const state: State = (g.__fcRealtime ??= {
  channels: new Map(),
  visitors: new Map(),
  agents: new Map(),
  onlineKey: "",
});

// Canales: "agents" (todos los paneles), "visitors" (todos los widgets) y
// "visitor:<id>" (las pestañas de un visitante).
export const AGENTS = "agents";
export const VISITORS = "visitors";
export const visitorChannel = (id: number) => `visitor:${id}`;

export function subscribe(channel: string, fn: Listener): () => void {
  let set = state.channels.get(channel);
  if (!set) state.channels.set(channel, (set = new Set()));
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0) state.channels.delete(channel);
  };
}

export function publish(channel: string, event: string, data: unknown) {
  const set = state.channels.get(channel);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(event, data);
    } catch (e) {
      console.error("[realtime] listener", e);
    }
  }
}

// Respuesta SSE. `setup` recibe `send` y devuelve la función de limpieza.
export function sse(req: Request, setup: (send: Listener) => () => void): Response {
  const enc = new TextEncoder();
  let done = false;
  let cleanup: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(ping);
    cleanup?.();
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        if (done) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          finish();
        }
      };
      write("retry: 1500\n\n");
      cleanup = setup((event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      // Comentario cada 15 s para que proxies y navegadores no corten la conexión.
      ping = setInterval(() => write(": ping\n\n"), 15000);
      req.signal.addEventListener("abort", () => {
        finish();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel: finish,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ---- Presencia de visitantes ------------------------------------------------
// Una conexión SSE abierta = visitante en línea. Al navegar entre páginas el
// iframe se recarga, así que esperamos unos segundos antes de darlo por ido.

const GRACE_MS = 6000;

export function visitorConnected(visitorId: number, siteId: number): boolean {
  const p = state.visitors.get(visitorId);
  if (p) {
    clearTimeout(p.leaveTimer);
    p.leaveTimer = undefined;
    p.connections++;
    return false;
  }
  state.visitors.set(visitorId, {
    visitorId,
    siteId,
    connections: 1,
    connectedAt: new Date().toISOString(),
  });
  return true;
}

export function visitorDisconnected(visitorId: number, onLeave: () => void) {
  const p = state.visitors.get(visitorId);
  if (!p) return;
  p.connections = Math.max(0, p.connections - 1);
  if (p.connections > 0) return;
  p.leaveTimer = setTimeout(() => {
    if (p.connections === 0) {
      state.visitors.delete(visitorId);
      onLeave();
    }
  }, GRACE_MS);
}

export function liveVisitors(): VisitorPresence[] {
  return [...state.visitors.values()];
}

export function isVisitorOnline(visitorId: number) {
  return state.visitors.has(visitorId);
}

// ---- Presencia de agentes ---------------------------------------------------

export function agentConnected(agentId: number, name: string, status: string) {
  const a = state.agents.get(agentId);
  if (a) {
    clearTimeout(a.leaveTimer);
    a.leaveTimer = undefined;
    a.connections++;
    a.status = status;
  } else {
    state.agents.set(agentId, { agentId, name, status, connections: 1 });
  }
  agentsChanged();
}

export function agentDisconnected(agentId: number) {
  const a = state.agents.get(agentId);
  if (!a) return;
  a.connections = Math.max(0, a.connections - 1);
  if (a.connections > 0) return;
  a.leaveTimer = setTimeout(() => {
    if (a.connections === 0) {
      state.agents.delete(agentId);
      agentsChanged();
    }
  }, GRACE_MS);
}

export function setAgentStatus(agentId: number, status: string) {
  const a = state.agents.get(agentId);
  if (a) a.status = status;
  agentsChanged();
}

export function agentPresence() {
  return [...state.agents.values()].map((a) => ({
    id: a.agentId,
    name: a.name,
    status: a.status,
    connected: a.connections > 0,
  }));
}

// Ids de los agentes humanos conectados y "en línea".
export function onlineAgentIds(): number[] {
  return [...state.agents.values()].filter((a) => a.status === "online").map((a) => a.agentId);
}

// ¿Hay algún humano disponible para un sitio? Sin agentes asignados vale cualquiera.
export function humansOnline(assigned: number[] | null | undefined) {
  const online = onlineAgentIds();
  if (!assigned?.length) return online.length > 0;
  return online.some((id) => assigned.includes(id));
}

function agentsChanged() {
  publish(AGENTS, "agents", agentPresence());
  // Los widgets calculan con esta lista si su sitio tiene a alguien disponible.
  const online = onlineAgentIds().sort((a, b) => a - b);
  const key = online.join(",");
  if (key !== state.onlineKey) {
    state.onlineKey = key;
    publish(VISITORS, "presence", { online });
  }
}
