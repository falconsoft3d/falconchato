// Lógica de negocio del chat sobre falcondatabase.
//
// Para que los mensajes vuelen, el camino crítico no espera a la base de datos:
// cada mensaje se publica por SSE al instante y se guarda después en una cola
// por conversación (así el orden en la BD es el mismo que vieron los usuarios).
// Las filas calientes (sitios, visitantes, conversaciones) se cachean en memoria;
// como todas las escrituras pasan por aquí, la caché no se desincroniza.

import { randomBytes, randomUUID } from "node:crypto";
import { db, type FdbUser } from "./fdb";
import { AGENTS, publish, visitorChannel } from "./realtime";
import type { Agent, AiAgent, Conversation, Message, PublicFace, Sender, Site, Visitor } from "./types";

type Cache = {
  sitesByKey: Map<string, { site: Site; at: number }>;
  visitors: Map<number, Visitor>;
  visitorIdByKey: Map<string, number>;
  conversations: Map<number, Conversation>;
  openByVisitor: Map<number, number | null>;
  agents: Map<number, Agent>;
  queues: Map<number, Promise<unknown>>;
  publicAgents?: { list: PublicFace[]; at: number };
};

const g = globalThis as unknown as { __fcChat?: Cache };
const cache: Cache = (g.__fcChat ??= {
  sitesByKey: new Map(),
  visitors: new Map(),
  visitorIdByKey: new Map(),
  conversations: new Map(),
  openByVisitor: new Map(),
  agents: new Map(),
  queues: new Map(),
});

const SITE_TTL = 30_000;
const now = () => new Date().toISOString();

// Encola una escritura de una conversación detrás de las anteriores.
function persist(conversationId: number, task: () => Promise<unknown>) {
  const prev = cache.queues.get(conversationId) ?? Promise.resolve();
  const next = prev.then(task).catch((e) => console.error(`[chat] persist #${conversationId}`, e));
  cache.queues.set(conversationId, next);
  next.finally(() => {
    if (cache.queues.get(conversationId) === next) cache.queues.delete(conversationId);
  });
  return next;
}

async function flushed(conversationId: number) {
  await cache.queues.get(conversationId);
}

// ---- Sitios -----------------------------------------------------------------

export async function getSiteByKey(key: string): Promise<Site | null> {
  const hit = cache.sitesByKey.get(key);
  if (hit && Date.now() - hit.at < SITE_TTL) return hit.site;
  const site = await db.first<Site>("sites", { site_key: `eq.${key}` });
  if (site) cache.sitesByKey.set(key, { site, at: Date.now() });
  return site;
}

export function cachedSite(id: number): Site | null {
  for (const { site } of cache.sitesByKey.values()) if (site.id === id) return site;
  return null;
}

export async function listSites(): Promise<Site[]> {
  const { data } = await db.list<Site>("sites", { order: "id.asc", limit: 500 });
  for (const site of data) cache.sitesByKey.set(site.site_key, { site, at: Date.now() });
  return data;
}

export type SiteInput = Partial<
  Pick<
    Site,
    | "name"
    | "domain"
    | "color"
    | "title"
    | "welcome_message"
    | "offline_message"
    | "position"
    | "is_active"
    | "agent_ids"
    | "ai_agent_ids"
    | "ai_mode"
    | "goals"
    | "auto_message"
    | "auto_message_delay"
    | "matrix_effect"
  >
>;

const ids = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 50) : undefined;

export function cleanSiteInput(body: Record<string, unknown>): SiteInput {
  const out: SiteInput = {};
  const str = (k: keyof SiteInput, max: number) => {
    if (typeof body[k] === "string") (out as Record<string, unknown>)[k] = (body[k] as string).trim().slice(0, max);
  };
  str("name", 80);
  str("domain", 200);
  str("title", 80);
  str("welcome_message", 500);
  str("offline_message", 500);
  if (typeof body.auto_message === "string") out.auto_message = body.auto_message.trim().slice(0, 500) || null;
  if (body.auto_message_delay !== undefined) {
    const d = Number(body.auto_message_delay);
    if (Number.isFinite(d)) out.auto_message_delay = Math.min(600, Math.max(0, Math.round(d)));
  }
  if (typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color)) out.color = body.color;
  if (body.position === "left" || body.position === "right") out.position = body.position;
  if (typeof body.is_active === "boolean") out.is_active = body.is_active;
  if (typeof body.matrix_effect === "boolean") out.matrix_effect = body.matrix_effect;
  if (ids(body.agent_ids)) out.agent_ids = ids(body.agent_ids)!;
  if (ids(body.ai_agent_ids)) out.ai_agent_ids = ids(body.ai_agent_ids)!;
  if (body.ai_mode === "off" || body.ai_mode === "offline" || body.ai_mode === "always") out.ai_mode = body.ai_mode;
  if (Array.isArray(body.goals)) {
    out.goals = body.goals
      .filter((g): g is string => typeof g === "string")
      .map((g) => g.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 10);
  }
  return out;
}

export async function createSite(input: SiteInput): Promise<Site> {
  const site_key = randomBytes(8).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  const site = await db.insert<Site>("sites", { ...input, site_key });
  cache.sitesByKey.set(site.site_key, { site, at: Date.now() });
  return site;
}

export async function updateSite(id: number, input: SiteInput): Promise<Site> {
  const site = await db.update<Site>("sites", id, input);
  cache.sitesByKey.set(site.site_key, { site, at: Date.now() });
  return site;
}

export async function deleteSite(id: number) {
  await db.remove("sites", id);
  for (const [key, hit] of cache.sitesByKey) if (hit.site.id === id) cache.sitesByKey.delete(key);
}

// ---- Visitantes -------------------------------------------------------------

export type PageInfo = {
  url?: string | null;
  title?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  country?: string | null;
  ip?: string | null;
};

// Busca en el mismo sitio un visitante con nombre que haya usado esta IP.
async function knownByIp(siteId: number, ip: string | null | undefined, exceptId?: number) {
  if (!ip) return null;
  const { data } = await db.list<Visitor>("visitors", {
    site_id: `eq.${siteId}`,
    ip: `eq.${ip}`,
    name: "neq.",
    order: "last_seen_at.desc",
    limit: 5,
  });
  return data.find((v) => v.id !== exceptId) ?? null;
}

// La clave del visitante la genera el script del sitio; la prefijamos con el
// sitio para que la misma clave en dos sitios no colisione.
const storedKey = (site: Site, key: string) => `${site.id}_${key}`;

export async function findVisitor(site: Site, key: string): Promise<Visitor | null> {
  const k = storedKey(site, key);
  const id = cache.visitorIdByKey.get(k);
  if (id && cache.visitors.has(id)) return cache.visitors.get(id)!;
  const visitor = await db.first<Visitor>("visitors", { visitor_key: `eq.${k}` });
  if (visitor) remember(visitor);
  return visitor;
}

function remember(v: Visitor) {
  cache.visitors.set(v.id, v);
  cache.visitorIdByKey.set(v.visitor_key, v.id);
}

export async function getVisitor(id: number): Promise<Visitor | null> {
  if (cache.visitors.has(id)) return cache.visitors.get(id)!;
  const v = await db.get<Visitor>("visitors", id);
  if (v) remember(v);
  return v;
}

export async function getVisitors(ids: number[]): Promise<Map<number, Visitor>> {
  const out = new Map<number, Visitor>();
  const missing: number[] = [];
  for (const id of new Set(ids)) {
    const v = cache.visitors.get(id);
    if (v) out.set(id, v);
    else missing.push(id);
  }
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    const { data } = await db.list<Visitor>("visitors", { id: `in.(${chunk.join(",")})`, limit: 100 });
    for (const v of data) {
      remember(v);
      out.set(v.id, v);
    }
  }
  return out;
}

const VISIT_GAP = 30 * 60_000;

// Registra la visita (nuevo visitante o página nueva). Solo espera a la BD la
// primera vez, para obtener el id. Tras 30 min sin actividad cuenta como visita nueva.
export async function touchVisitor(site: Site, key: string, page: PageInfo): Promise<Visitor> {
  const existing = await findVisitor(site, key);
  const values = {
    current_url: page.url?.slice(0, 1000) ?? null,
    page_title: page.title?.slice(0, 300) ?? null,
    last_seen_at: now(),
    ...(page.userAgent ? { user_agent: page.userAgent.slice(0, 500) } : {}),
    ...(page.country ? { country: page.country } : {}),
    ...(page.ip ? { ip: page.ip } : {}),
  };
  if (!existing) {
    const known = await knownByIp(site.id, page.ip);
    const v = await db.insert<Visitor>("visitors", {
      site_id: site.id,
      visitor_key: storedKey(site, key),
      referrer: page.referrer?.slice(0, 1000) || null,
      ...values,
      ...(known ? { name: known.name, email: known.email, known_by_ip: true } : {}),
    });
    remember(v);
    return v;
  }
  if (!existing.name && page.ip) {
    const known = await knownByIp(site.id, page.ip, existing.id);
    if (known) Object.assign(values, { name: known.name, email: existing.email ?? known.email, known_by_ip: true });
  }
  const lastSeen = existing.last_seen_at ? new Date(existing.last_seen_at).getTime() : 0;
  const newVisit = Date.now() - lastSeen > VISIT_GAP;
  const patch = newVisit ? { ...values, visits: (existing.visits ?? 1) + 1 } : values;
  const updated = { ...existing, ...patch };
  remember(updated);
  db.update("visitors", existing.id, patch).catch((e) => console.error("[chat] visitor", e));
  return updated;
}

export function updateVisitorProfile(v: Visitor, name?: string, email?: string): Visitor {
  const patch: Partial<Visitor> = {};
  if (name && name !== v.name) patch.name = name.slice(0, 80);
  if (email && email !== v.email) patch.email = email.slice(0, 200);
  // Dato confirmado por el propio cliente o un agente: ya no es una suposición por IP.
  if (Object.keys(patch).length && v.known_by_ip) patch.known_by_ip = false;
  if (Object.keys(patch).length === 0) return v;
  const updated = { ...v, ...patch };
  remember(updated);
  db.update("visitors", v.id, patch).catch((e) => console.error("[chat] visitor profile", e));
  return updated;
}

// ---- Conversaciones ---------------------------------------------------------

function rememberConversation(c: Conversation) {
  cache.conversations.set(c.id, c);
  if (c.status === "closed") {
    if (cache.openByVisitor.get(c.visitor_id) === c.id) cache.openByVisitor.set(c.visitor_id, null);
  } else {
    cache.openByVisitor.set(c.visitor_id, c.id);
  }
}

export async function getConversation(id: number): Promise<Conversation | null> {
  if (cache.conversations.has(id)) return cache.conversations.get(id)!;
  const c = await db.get<Conversation>("conversations", id);
  if (c) cache.conversations.set(c.id, c);
  return c;
}

export async function getOpenConversation(visitorId: number): Promise<Conversation | null> {
  if (cache.openByVisitor.has(visitorId)) {
    const id = cache.openByVisitor.get(visitorId);
    return id ? (cache.conversations.get(id) ?? null) : null;
  }
  const c = await db.first<Conversation>("conversations", {
    visitor_id: `eq.${visitorId}`,
    status: "in.(open,offline)",
    order: "id.desc",
  });
  if (c) rememberConversation(c);
  else cache.openByVisitor.set(visitorId, null);
  return c;
}

export async function listActiveConversations(): Promise<Conversation[]> {
  const { data } = await db.list<Conversation>("conversations", {
    status: "in.(open,offline)",
    order: "last_message_at.desc",
    limit: 200,
  });
  // La caché tiene la versión más reciente (puede haber escrituras en cola).
  return data.map((c) => {
    const cached = cache.conversations.get(c.id);
    if (cached) return cached;
    rememberConversation(c);
    return c;
  }).filter((c) => c.status !== "closed");
}

export async function startConversation(
  site: Site,
  visitor: Visitor,
  status: "open" | "offline",
): Promise<Conversation> {
  const c = await db.insert<Conversation>("conversations", {
    site_id: site.id,
    visitor_id: visitor.id,
    status,
    visitor_name: visitor.name,
    visitor_email: visitor.email,
    page_url: visitor.current_url,
    last_message_at: now(),
  });
  rememberConversation(c);
  publish(AGENTS, "conversation", c);
  return c;
}

export function patchConversation(c: Conversation, patch: Partial<Conversation>): Conversation {
  const current = cache.conversations.get(c.id) ?? c;
  const updated = { ...current, ...patch };
  rememberConversation(updated);
  publish(AGENTS, "conversation", updated);
  publish(visitorChannel(updated.visitor_id), "conversation", {
    id: updated.id,
    status: updated.status,
    rating: updated.rating,
    agent_id: updated.agent_id,
    ai_agent_id: updated.ai_agent_id,
    ai_paused: updated.ai_paused,
  });
  persist(c.id, () => db.update("conversations", c.id, patch));
  return updated;
}

export async function getMessages(conversationId: number): Promise<Message[]> {
  await flushed(conversationId);
  return db.listAll<Message>("messages", { conversation_id: `eq.${conversationId}`, order: "id.asc" }, 2000);
}

type PostInput = {
  sender: Sender;
  body: string;
  agent?: Pick<Agent, "id" | "name" | "email"> | null;
  aiAgent?: Pick<AiAgent, "id" | "name"> | null;
  authorName?: string | null;
  clientId?: string;
  attachment?: string | null;
};

// Publica el mensaje al instante y lo guarda en segundo plano.
export function postMessage(conversation: Conversation, input: PostInput): Message {
  const c = cache.conversations.get(conversation.id) ?? conversation;
  const message: Message = {
    client_id: input.clientId && /^[\w-]{8,64}$/.test(input.clientId) ? input.clientId : randomUUID(),
    created_at: now(),
    conversation_id: c.id,
    sender: input.sender,
    // En mensajes de la IA (sender "bot"), agent_id es el id del agente IA.
    agent_id: input.agent?.id ?? input.aiAgent?.id ?? null,
    author_name: input.agent
      ? input.agent.name || input.agent.email
      : input.aiAgent
        ? input.aiAgent.name
        : (input.authorName ?? null),
    body: input.body,
    ...(input.attachment ? { attachment: input.attachment } : {}),
  };

  publish(visitorChannel(c.visitor_id), "message", message);
  publish(AGENTS, "message", message);
  persist(c.id, () => db.insert("messages", message));

  if (input.sender === "system") return message;

  const patch: Partial<Conversation> = {
    last_message: (input.body || (input.attachment ? "📷 Foto" : "")).slice(0, 200),
    last_message_at: message.created_at,
  };
  if (input.sender === "visitor") {
    patch.unread = (c.unread ?? 0) + 1;
  } else if (input.sender === "bot") {
    if (!c.first_response_at) patch.first_response_at = message.created_at;
    if (c.status === "offline") patch.status = "open";
  } else {
    patch.unread = 0;
    if (!c.agent_id && input.agent) patch.agent_id = input.agent.id;
    if (!c.first_response_at) patch.first_response_at = message.created_at;
    if (c.status === "offline") patch.status = "open";
  }
  patchConversation(c, patch);
  return message;
}

export function closeConversation(c: Conversation, byName: string) {
  const current = cache.conversations.get(c.id) ?? c;
  if (current.status === "closed") return current;
  postMessage(current, { sender: "system", body: `${byName} finalizó el chat` });
  return patchConversation(current, { status: "closed", closed_at: now(), unread: 0 });
}

// ---- Agentes ----------------------------------------------------------------

export async function ensureAgent(user: FdbUser): Promise<Agent | null> {
  const role = user.data?.role;
  if (role === "system") return null;
  let agent = await db.first<Agent>("agents", { user_id: `eq.${user.id}` });
  if (agent?.disabled) return null;
  if (!agent) {
    agent = await db.insert<Agent>("agents", {
      user_id: user.id,
      email: user.email,
      name: user.data?.name ?? user.email.split("@")[0],
      role: role === "owner" || role === "admin" ? role : "agent",
      status: "online",
    });
  }
  cache.agents.set(agent.id, agent);
  cache.publicAgents = undefined;
  return agent;
}

export async function getAgentById(id: number): Promise<Agent | null> {
  return cache.agents.get(id) ?? (await db.get<Agent>("agents", id));
}

// Nombre y foto de los agentes, lo único que ve el visitante (caché de 30 s).
export async function publicAgents() {
  if (cache.publicAgents && Date.now() - cache.publicAgents.at < 10_000) return cache.publicAgents.list;
  const list = (await listAgents())
    .filter((a) => !a.disabled)
    .map((a) => ({
      id: a.id,
      name: a.name || a.email.split("@")[0],
      avatar: a.avatar ?? null,
      contact_email: a.contact_email ?? null,
      whatsapp: a.whatsapp ?? null,
    }));
  cache.publicAgents = { list, at: Date.now() };
  return list;
}

export function updateAgent(agent: Agent, patch: Partial<Agent>): Agent {
  if (["name", "avatar", "disabled", "contact_email", "whatsapp"].some((k) => k in patch)) cache.publicAgents = undefined;
  const updated = { ...agent, ...patch };
  cache.agents.set(agent.id, updated);
  db.update("agents", agent.id, patch).catch((e) => console.error("[chat] agent", e));
  return updated;
}

export function cachedAgent(id: number) {
  return cache.agents.get(id);
}

export async function listAgents(): Promise<Agent[]> {
  const { data } = await db.list<Agent>("agents", { order: "id.asc", limit: 500 });
  return data.map((a) => cache.agents.get(a.id) ?? a);
}
