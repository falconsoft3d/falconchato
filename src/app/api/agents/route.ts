import { ensureAgent, listAgents } from "@/lib/chat";
import { FdbError, fdbAuth } from "@/lib/fdb";
import { fail, handle, json, readJson, requireAgent } from "@/lib/http";
import { agentPresence } from "@/lib/realtime";
import type { Agent } from "@/lib/types";

const ROLES: Agent["role"][] = ["owner", "admin", "agent"];

export const GET = handle(async (req) => {
  await requireAgent(req);
  const presence = new Map(agentPresence().map((p) => [p.id, p]));
  const agents = (await listAgents()).map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    disabled: a.disabled,
    avatar: a.avatar ?? null,
    contact_email: a.contact_email ?? null,
    whatsapp: a.whatsapp ?? null,
    status: presence.get(a.id)?.status ?? "offline",
    connected: presence.get(a.id)?.connected ?? false,
    last_seen_at: a.last_seen_at,
  }));
  return json({ agents });
});

// Alta de un agente humano: crea el usuario del login y su perfil.
export const POST = handle(async (req) => {
  const me = await requireAgent(req, ["owner", "admin"]);
  const body = await readJson(req);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = ROLES.includes(body.role as Agent["role"]) ? (body.role as Agent["role"]) : "agent";
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Escribe nombre y un email válido");
  if (password.length < 8) return fail("La contraseña debe tener al menos 8 caracteres");
  if (role === "owner" && me.role !== "owner") return fail("Solo el propietario puede crear otro propietario", 403);

  try {
    const { user } = await fdbAuth.signup(email, password, { name, role });
    return json({ agent: await ensureAgent(user) }, 201);
  } catch (e) {
    if (e instanceof FdbError && e.status < 500) return fail(e.message.includes("exist") ? "Ya existe un usuario con ese email" : e.message);
    throw e;
  }
});
