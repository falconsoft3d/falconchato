// Helpers del lado del widget: identificar al visitante y armar la vista "en vivo".

import { cachedSite, findVisitor, getOpenConversation, getSiteByKey, getVisitor, publicAgents } from "./chat";
import { fail } from "./http";
import { liveVisitors } from "./realtime";
import { widgetAi } from "./ai";
import { faqsForSite } from "./faqs";
import { HOME_SITE_KEY, ensureHomeSite } from "./seed";
import type { LiveVisitor, Site, Visitor, WidgetConfig } from "./types";

const KEY_RE = /^[\w-]{8,64}$/;

export async function resolveSite(siteKey: unknown): Promise<Site> {
  if (typeof siteKey !== "string" || !/^[\w-]{1,40}$/.test(siteKey)) throw fail("Sitio no válido", 400);
  // El sitio de la home se crea solo la primera vez.
  const site = (await getSiteByKey(siteKey)) ?? (siteKey === HOME_SITE_KEY ? await ensureHomeSite() : null);
  if (!site || !site.is_active) throw fail("Sitio no encontrado", 404);
  return site;
}

export function checkVisitorKey(key: unknown): string {
  if (typeof key !== "string" || !KEY_RE.test(key)) throw fail("Visitante no válido", 400);
  return key;
}

export async function resolveVisitor(siteKey: unknown, key: unknown): Promise<{ site: Site; visitor: Visitor }> {
  const site = await resolveSite(siteKey);
  const visitor = await findVisitor(site, checkVisitorKey(key));
  if (!visitor) throw fail("Visitante no encontrado", 404);
  return { site, visitor };
}

export async function liveEntry(visitorId: number): Promise<LiveVisitor | null> {
  const presence = liveVisitors().find((p) => p.visitorId === visitorId);
  const visitor = await getVisitor(visitorId);
  if (!presence || !visitor) return null;
  const site = cachedSite(visitor.site_id);
  return {
    visitor,
    site: site ? { id: site.id, name: site.name } : null,
    connected_at: presence.connectedAt,
    conversation: await getOpenConversation(visitorId),
  };
}

export async function allLiveVisitors(): Promise<LiveVisitor[]> {
  const entries = await Promise.all(liveVisitors().map((p) => liveEntry(p.visitorId)));
  return entries.filter((e): e is LiveVisitor => e !== null);
}

export async function widgetConfig(site: Site): Promise<WidgetConfig> {
  return {
    name: site.name,
    color: site.color,
    title: site.title,
    welcome_message: site.welcome_message,
    offline_message: site.offline_message,
    position: site.position,
    agent_ids: site.agent_ids,
    team: (await publicAgents()).filter((a) => !site.agent_ids?.length || site.agent_ids.includes(a.id)),
    auto_message: site.auto_message,
    auto_message_delay: site.auto_message_delay,
    matrix_effect: site.matrix_effect,
    faqs: await faqsForSite(site.id),
    ai: await widgetAi(site),
  };
}
