import { updateAgent } from "@/lib/chat";
import { fail, handle, json, readJson, requireAgent } from "@/lib/http";
import { setAgentStatus } from "@/lib/realtime";

export const GET = handle(async (req) => json({ agent: await requireAgent(req) }));

// Cambiar estado (en línea / ausente / invisible) o nombre.
export const PATCH = handle(async (req) => {
  const agent = await requireAgent(req);
  const body = await readJson(req);
  const patch: { status?: "online" | "away" | "invisible"; name?: string } = {};
  if (body.status !== undefined) {
    if (body.status !== "online" && body.status !== "away" && body.status !== "invisible") return fail("Estado no válido");
    patch.status = body.status;
  }
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  const updated = updateAgent(agent, patch);
  if (patch.status) setAgentStatus(agent.id, patch.status);
  return json({ agent: updated });
});
