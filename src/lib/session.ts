// Sesión de agentes: el token de falcondatabase vive en una cookie httpOnly y
// se valida contra /auth/user (con caché corta para no pagar la latencia en
// cada petición).

import type { NextRequest } from "next/server";
import { cachedAgent, ensureAgent } from "./chat";
import { fdbAuth } from "./fdb";
import type { Agent } from "./types";

export const SESSION_COOKIE = "fc_token";
const TTL = 5 * 60_000;

const g = globalThis as unknown as { __fcSessions?: Map<string, { agentId: number; at: number; agent: Agent }> };
const sessions = (g.__fcSessions ??= new Map());

export async function agentFromToken(token: string | undefined): Promise<Agent | null> {
  if (!token) return null;
  const hit = sessions.get(token);
  if (hit && Date.now() - hit.at < TTL) {
    const agent = cachedAgent(hit.agentId) ?? hit.agent;
    return agent.disabled ? null : agent;
  }
  const user = await fdbAuth.user(token);
  const agent = user ? await ensureAgent(user) : null;
  if (!agent) {
    sessions.delete(token);
    return null;
  }
  sessions.set(token, { agentId: agent.id, at: Date.now(), agent });
  return agent;
}

// El panel web usa la cookie; la app móvil manda `Authorization: Bearer <token>`.
export function sessionToken(req: NextRequest) {
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  return bearer ?? req.cookies.get(SESSION_COOKIE)?.value;
}

export function getAgent(req: NextRequest) {
  return agentFromToken(sessionToken(req));
}

export function forgetSession(token: string | undefined) {
  if (token) sessions.delete(token);
}
