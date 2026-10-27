import { getConversation, patchConversation } from "@/lib/chat";
import { fail, handle, json, readJson } from "@/lib/http";
import { resolveVisitor } from "@/lib/widget";

// Valoración del chat (contento / neutral / triste) y comentario opcional.
export const POST = handle(async (req) => {
  const body = await readJson(req);
  const { visitor } = await resolveVisitor(body.site, body.v);
  const rating = body.rating === "good" || body.rating === "neutral" || body.rating === "bad" ? body.rating : null;
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) || null : undefined;
  const conversation = await getConversation(Number(body.conversation_id));
  if (!conversation || conversation.visitor_id !== visitor.id) return fail("Chat no encontrado", 404);
  patchConversation(conversation, { rating, ...(comment !== undefined ? { rating_comment: comment } : {}) });
  return json({ ok: true });
});
