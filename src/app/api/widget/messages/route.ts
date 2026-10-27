import { getOpenConversation, patchConversation, postMessage, startConversation, updateVisitorProfile } from "@/lib/chat";
import { aiAvailable, scheduleAiReply } from "@/lib/ai";
import { upsertContactForVisitor } from "@/lib/contacts";
import { cleanAttachment, fail, handle, json, rateLimit, readJson } from "@/lib/http";
import { humansOnline } from "@/lib/realtime";
import { resolveVisitor } from "@/lib/widget";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mensaje del visitante. Si no hay chat abierto se crea; sin agentes
// (humanos o IA) disponibles queda como mensaje offline.
export const POST = handle(async (req) => {
  const body = await readJson(req);
  const { site, visitor: found } = await resolveVisitor(body.site, body.v);
  rateLimit(`msg:${found.id}`, 20, 10_000);

  const text = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
  const attachment = cleanAttachment(body.attachment);
  if (!text && !attachment) return fail("Escribe un mensaje");
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const email = typeof body.email === "string" ? body.email.trim() : undefined;
  if (email && !EMAIL_RE.test(email)) return fail("El email no es válido");

  const visitor = updateVisitorProfile(found, name, email);
  if (name || email) {
    upsertContactForVisitor(visitor, site.id, { name, email }).catch((e) => console.error("[crm]", e));
  }
  const ai = await aiAvailable(site);
  let conversation = await getOpenConversation(visitor.id);
  if (!conversation) {
    conversation = await startConversation(site, visitor, humansOnline(site.agent_ids) || ai ? "open" : "offline");
  } else if (
    (visitor.name && visitor.name !== conversation.visitor_name) ||
    (visitor.email && visitor.email !== conversation.visitor_email)
  ) {
    conversation = patchConversation(conversation, { visitor_name: visitor.name, visitor_email: visitor.email });
  }

  const message = postMessage(conversation, {
    sender: "visitor",
    body: text,
    attachment,
    authorName: visitor.name,
    clientId: typeof body.client_id === "string" ? body.client_id : undefined,
  });
  if (ai && !conversation.ai_paused) scheduleAiReply(conversation.id);
  return json({ message, conversation: { id: conversation.id, status: conversation.status } });
});
