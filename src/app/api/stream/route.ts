import type { NextRequest } from "next/server";
import { updateAgent } from "@/lib/chat";
import { handle, requireAgent } from "@/lib/http";
import { AGENTS, agentConnected, agentDisconnected, agentPresence, sse, subscribe } from "@/lib/realtime";

// Canal SSE del panel: chats, mensajes, visitantes y agentes en tiempo real.
export const GET = handle(async (req: NextRequest) => {
  const agent = await requireAgent(req);
  const status = agent.status === "offline" ? "online" : agent.status;

  return sse(req, (send) => {
    const off = subscribe(AGENTS, send);
    agentConnected(agent.id, agent.name || agent.email, status);
    send("hello", { agents: agentPresence() });
    updateAgent(agent, { last_seen_at: new Date().toISOString() });
    return () => {
      off();
      agentDisconnected(agent.id);
    };
  });
});
