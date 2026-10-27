import { getAgentById } from "@/lib/chat";
import { fdbAdmin } from "@/lib/fdb";
import { fail, handle, idParam, json, readJson, requireAgent } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// Restablecer la contraseña de otro agente (owner/admin).
export const POST = handle(async (req, { params }: Ctx) => {
  const me = await requireAgent(req, ["owner", "admin"]);
  const agent = await getAgentById(idParam((await params).id));
  if (!agent) return fail("Agente no encontrado", 404);
  if (agent.role === "owner" && me.role !== "owner") return fail("Solo el propietario puede gestionar propietarios", 403);
  const body = await readJson(req);
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) return fail("La contraseña debe tener al menos 8 caracteres");
  if (!fdbAdmin.enabled()) return fail("Falta FDB_ADMIN_TOKEN en el servidor para cambiar contraseñas", 501);
  await fdbAdmin.setPassword(agent.user_id, password);
  return json({ ok: true });
});
