import { closeConversation, getConversation, getMessages, getVisitor, patchConversation } from "@/lib/chat";
import { fail, handle, idParam, json, readJson, requireAgent } from "@/lib/http";
import { isVisitorOnline } from "@/lib/realtime";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Ctx) => {
  await requireAgent(req);
  const conversation = await getConversation(idParam((await params).id));
  if (!conversation) return fail("Chat no encontrado", 404);
  const [messages, visitor] = await Promise.all([getMessages(conversation.id), getVisitor(conversation.visitor_id)]);
  return json({ conversation, messages, visitor, visitor_online: isVisitorOnline(conversation.visitor_id) });
});

// action: "close" | "read" | "ai_pause" | "ai_resume"; o tags: "a, b".
export const PATCH = handle(async (req, { params }: Ctx) => {
  const agent = await requireAgent(req);
  const conversation = await getConversation(idParam((await params).id));
  if (!conversation) return fail("Chat no encontrado", 404);
  const body = await readJson(req);

  if (body.action === "close") return json({ conversation: closeConversation(conversation, agent.name || agent.email) });
  if (body.action === "read") return json({ conversation: patchConversation(conversation, { unread: 0 }) });
  if (body.action === "ai_pause" || body.action === "ai_resume") {
    return json({ conversation: patchConversation(conversation, { ai_paused: body.action === "ai_pause" }) });
  }
  if (typeof body.tags === "string") {
    const tags = body.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10).join(", ");
    return json({ conversation: patchConversation(conversation, { tags: tags || null }) });
  }
  return fail("Nada que actualizar");
});
