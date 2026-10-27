import { handle, json } from "@/lib/http";
import { SESSION_COOKIE, forgetSession, sessionToken } from "@/lib/session";

export const POST = handle(async (req) => {
  forgetSession(sessionToken(req));
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
});
