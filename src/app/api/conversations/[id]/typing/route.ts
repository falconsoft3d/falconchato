import { getConversation } from "@/lib/chat";
import { handle, idParam, json, readJson, requireAgent } from "@/lib/http";
import { AGENTS, publish, visitorChannel } from "@/lib/realtime";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req, { params }: Ctx) => {
  const agent = await requireAgent(req);
  const conversation = await getConversation(idParam((await params).id));
  if (conversation) {
    const typing = (await readJson(req)).typing === true;
    const name = agent.name || agent.email;
    publish(visitorChannel(conversation.visitor_id), "typing", { typing, name, agent_id: agent.id });
    publish(AGENTS, "typing", { conversation_id: conversation.id, sender: "agent", agent_id: agent.id, typing, text: "" });
  }
  return json({ ok: true });
});
