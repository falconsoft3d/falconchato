import { getOpenConversation } from "@/lib/chat";
import { handle, json, readJson } from "@/lib/http";
import { AGENTS, publish } from "@/lib/realtime";
import { resolveVisitor } from "@/lib/widget";

// "Escribiendo…" del visitante, con vista previa del texto para el agente.
export const POST = handle(async (req) => {
  const body = await readJson(req);
  const { visitor } = await resolveVisitor(body.site, body.v);
  const conversation = await getOpenConversation(visitor.id);
  if (conversation) {
    const text = typeof body.text === "string" ? body.text.slice(0, 300) : "";
    publish(AGENTS, "typing", { conversation_id: conversation.id, sender: "visitor", typing: text.length > 0, text });
  }
  return json({ ok: true });
});
