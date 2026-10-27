import { getMessages, getOpenConversation, touchVisitor } from "@/lib/chat";
import { countryOf, handle, ipOf, json, readJson } from "@/lib/http";
import { onlineAgentIds } from "@/lib/realtime";
import { checkVisitorKey, resolveSite, widgetConfig } from "@/lib/widget";

// Arranque del widget: config del sitio, visitante, estado y chat abierto.
export const POST = handle(async (req) => {
  const body = await readJson(req);
  const site = await resolveSite(body.site);
  const key = checkVisitorKey(body.v);
  const page = (body.page ?? {}) as { url?: string; title?: string; referrer?: string };
  const visitor = await touchVisitor(site, key, {
    url: page.url,
    title: page.title,
    referrer: page.referrer,
    userAgent: req.headers.get("user-agent"),
    country: countryOf(req),
    ip: ipOf(req),
  });
  const conversation = await getOpenConversation(visitor.id);
  const messages = conversation ? await getMessages(conversation.id) : [];
  return json({
    site: await widgetConfig(site),
    visitor: { id: visitor.id, name: visitor.name, email: visitor.email },
    online_agents: onlineAgentIds(),
    conversation: conversation && {
      id: conversation.id,
      status: conversation.status,
      rating: conversation.rating,
      agent_id: conversation.agent_id,
      ai_agent_id: conversation.ai_agent_id,
      ai_paused: conversation.ai_paused,
    },
    messages,
  });
});
