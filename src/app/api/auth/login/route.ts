import { ensureAgent } from "@/lib/chat";
import { FdbError, fdbAuth } from "@/lib/fdb";
import { fail, handle, json, readJson } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return fail("Escribe tu email y contraseña");

  let session;
  try {
    session = await fdbAuth.login(email, password);
  } catch (e) {
    if (e instanceof FdbError && e.status < 500) return fail("Email o contraseña incorrectos", 401);
    throw e;
  }
  const agent = await ensureAgent(session.user);
  if (!agent) return fail("Esta cuenta no puede entrar al panel", 403);

  // La app móvil guarda el token y lo envía como Bearer; la web usa la cookie httpOnly.
  if (body.client === "mobile") return json({ agent, token: session.token, expires_in: session.expires_in });

  const res = json({ agent });
  res.headers.append(
    "Set-Cookie",
    [
      `${SESSION_COOKIE}=${session.token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${session.expires_in}`,
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
  return res;
});
