import { getConversation, patchConversation, postMessage } from "@/lib/chat";
import { cleanAttachment, fail, handle, idParam, json, readJson, requireAgent } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// Respuesta del agente. La primera vez avisa al visitante de que se unió.
export const POST = handle(async (req, { params }: Ctx) => {
  const agent = await requireAgent(req);
  const conversation = await getConversation(idParam((await params).id));
  if (!conversation) return fail("Chat no encontrado", 404);
  if (conversation.status === "closed") return fail("Este chat ya finalizó", 409);
  const body = await readJson(req);
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
  const attachment = cleanAttachment(body.attachment);
  if (!text && !attachment) return fail("Escribe un mensaje");

  // Cuando responde una persona, la IA se retira de este chat.
  if (conversation.ai_agent_id && !conversation.ai_paused) patchConversation(conversation, { ai_paused: true });
  if (!conversation.agent_id) {
    postMessage(conversation, { sender: "system", body: `${agent.name || agent.email} se unió al chat` });
  }
  const message = postMessage(conversation, {
    sender: "agent",
    body: text,
    attachment,
    agent,
    clientId: typeof body.client_id === "string" ? body.client_id : undefined,
  });
  return json({ message });
});
