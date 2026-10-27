import type { NextRequest } from "next/server";
import {
  cachedSite,
  getOpenConversation,
  getVisitor,
  listActiveConversations,
  postMessage,
  startConversation,
} from "@/lib/chat";
import { db, type Query } from "@/lib/fdb";
import { fail, handle, json, readJson, requireAgent } from "@/lib/http";
import { isVisitorOnline } from "@/lib/realtime";
import type { Conversation } from "@/lib/types";

const PAGE = 25;

// scope=active → chats en curso; scope=history → historial con filtros.
export const GET = handle(async (req: NextRequest) => {
  await requireAgent(req);
  const q = req.nextUrl.searchParams;
  if (q.get("scope") !== "history") return json({ conversations: await listActiveConversations() });

  const query: Query = { order: "created_at.desc" };
  const status = q.get("status");
  if (status === "served") query.first_response_at = "gte.1970-01-01T00:00:00Z";
  if (status === "missed") Object.assign(query, { status: "eq.closed", first_response_at: "is.null" });
  if (status === "offline") query.status = "eq.offline";
  if (status === "open") query.status = "in.(open,offline)";
  const rating = q.get("rating");
  if (rating === "good" || rating === "neutral" || rating === "bad") query.rating = `eq.${rating}`;
  const site = Number(q.get("site"));
  if (site > 0) query.site_id = `eq.${site}`;
  const from = q.get("from");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query.created_at = `gte.${from}T00:00:00`;

  const page = Math.max(0, Number(q.get("page")) || 0);
  const to = q.get("to");
  let text = q.get("q")?.trim().toLowerCase();
  const byVisitor = /^#(\d+)$/.exec(text ?? "");
  if (byVisitor) {
    query.visitor_id = `eq.${byVisitor[1]}`;
    text = undefined;
  }

  // La API filtra una condición por columna: "hasta" y la búsqueda se aplican aquí.
  if (text || (to && /^\d{4}-\d{2}-\d{2}$/.test(to))) {
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity;
    const rows = (await db.listAll<Conversation>("conversations", query, 3000)).filter((c) => {
      if (new Date(c.created_at).getTime() > toTime) return false;
      if (!text) return true;
      return [c.visitor_name, c.visitor_email, c.last_message, c.tags, c.page_url]
        .some((f) => f?.toLowerCase().includes(text));
    });
    return json({ conversations: rows.slice(page * PAGE, page * PAGE + PAGE), count: rows.length, pageSize: PAGE });
  }

  const { data, count } = await db.list<Conversation>("conversations", { ...query, limit: PAGE, offset: page * PAGE });
  return json({ conversations: data, count, pageSize: PAGE });
});

// Chat proactivo: el agente escribe primero a un visitante conectado.
export const POST = handle(async (req) => {
  const agent = await requireAgent(req);
  const body = await readJson(req);
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
  if (!text) return fail("Escribe un mensaje");
  const visitor = await getVisitor(Number(body.visitor_id));
  if (!visitor) return fail("Visitante no encontrado", 404);
  if (!isVisitorOnline(visitor.id)) return fail("El visitante ya no está en el sitio", 409);
  const site = cachedSite(visitor.site_id);
  if (!site) return fail("Sitio no encontrado", 404);

  const conversation = (await getOpenConversation(visitor.id)) ?? (await startConversation(site, visitor, "open"));
  const message = postMessage(conversation, { sender: "agent", body: text, agent });
  return json({ conversation_id: conversation.id, message });
});
