import { getAgentById, updateAgent } from "@/lib/chat";
import { cleanContactFields, fail, handle, idParam, json, readJson, requireAgent } from "@/lib/http";
import type { Agent } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[\w+/=]+$/;

// Cambiar nombre, foto, rol o activar/desactivar (un agente desactivado no puede entrar).
// Cada agente puede cambiar su propio nombre y foto; el resto, owner/admin.
export const PATCH = handle(async (req, { params }: Ctx) => {
  const me = await requireAgent(req);
  const agent = await getAgentById(idParam((await params).id));
  if (!agent) return fail("Agente no encontrado", 404);
  const isAdmin = me.role === "owner" || me.role === "admin";
  if (!isAdmin && agent.id !== me.id) return fail("No tienes permiso para esto", 403);
  const body = await readJson(req);
  const patch: Partial<Agent> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  Object.assign(patch, cleanContactFields(body));
  if (body.avatar === null) patch.avatar = null;
  if (typeof body.avatar === "string" && AVATAR_RE.test(body.avatar) && body.avatar.length < 300_000) patch.avatar = body.avatar;
  if (isAdmin && (body.role === "owner" || body.role === "admin" || body.role === "agent")) patch.role = body.role;
  if (isAdmin && typeof body.disabled === "boolean") patch.disabled = body.disabled;

  if (agent.id === me.id && (patch.disabled || (patch.role && patch.role !== me.role))) {
    return fail("No puedes cambiar tu propio rol ni desactivarte");
  }
  if (me.role !== "owner" && (agent.role === "owner" || patch.role === "owner")) {
    return fail("Solo el propietario puede gestionar propietarios", 403);
  }
  return json({ agent: updateAgent(agent, patch) });
});
