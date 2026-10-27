import type { NextRequest } from "next/server";
import { handle } from "@/lib/http";
import {
  AGENTS,
  VISITORS,
  onlineAgentIds,
  publish,
  sse,
  subscribe,
  visitorChannel,
  visitorConnected,
  visitorDisconnected,
} from "@/lib/realtime";
import { liveEntry, resolveVisitor } from "@/lib/widget";

// Canal SSE del visitante: mensajes, "escribiendo…", estado del chat y si hay agentes.
export const GET = handle(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const { site, visitor } = await resolveVisitor(q.get("site"), q.get("v"));

  return sse(req, (send) => {
    send("presence", { online: onlineAgentIds() });
    const offMine = subscribe(visitorChannel(visitor.id), send);
    const offAll = subscribe(VISITORS, send);

    if (visitorConnected(visitor.id, site.id)) {
      liveEntry(visitor.id).then((entry) => entry && publish(AGENTS, "visitor", entry));
    }

    return () => {
      offMine();
      offAll();
      visitorDisconnected(visitor.id, () => publish(AGENTS, "visitor_left", { id: visitor.id }));
    };
  });
});
