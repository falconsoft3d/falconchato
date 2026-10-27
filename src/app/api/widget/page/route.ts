import { touchVisitor } from "@/lib/chat";
import { handle, json, readJson } from "@/lib/http";
import { AGENTS, isVisitorOnline, publish } from "@/lib/realtime";
import { checkVisitorKey, liveEntry, resolveSite } from "@/lib/widget";

// Cambio de página en sitios SPA (sin recargar el iframe).
export const POST = handle(async (req) => {
  const body = await readJson(req);
  const site = await resolveSite(body.site);
  const page = (body.page ?? {}) as { url?: string; title?: string };
  const visitor = await touchVisitor(site, checkVisitorKey(body.v), { url: page.url, title: page.title });
  if (isVisitorOnline(visitor.id)) {
    const entry = await liveEntry(visitor.id);
    if (entry) publish(AGENTS, "visitor", entry);
  }
  return json({ ok: true });
});
