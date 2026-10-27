import { FdbError, fdbAdmin, fdbAuth } from "@/lib/fdb";
import { fail, handle, json, readJson, requireAgent } from "@/lib/http";

// Cambiar la propia contraseña: se comprueba la actual iniciando sesión con ella.
export const POST = handle(async (req) => {
  const me = await requireAgent(req);
  const body = await readJson(req);
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.password === "string" ? body.password : "";
  if (next.length < 8) return fail("La contraseña debe tener al menos 8 caracteres");
  if (!fdbAdmin.enabled()) return fail("Falta FDB_ADMIN_TOKEN en el servidor para cambiar contraseñas", 501);
  try {
    await fdbAuth.login(me.email, current);
  } catch (e) {
    if (e instanceof FdbError && e.status < 500) return fail("La contraseña actual no es correcta", 400);
    throw e;
  }
  await fdbAdmin.setPassword(me.user_id, next);
  return json({ ok: true });
});

export const GET = handle(async (req) => {
  await requireAgent(req);
  return json({ enabled: fdbAdmin.enabled() });
});
