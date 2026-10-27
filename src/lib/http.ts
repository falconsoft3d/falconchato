// Helpers para las rutas de la API.

import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { FdbError } from "./fdb";
import { getAgent } from "./session";
import type { Agent } from "./types";

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const fail = (error: string, status = 400) => Response.json({ error }, { status });

// Envuelve un handler: convierte errores en JSON en vez de un 500 opaco.
export function handle<C>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      unstable_rethrow(e); // señales internas de Next (p. ej. render dinámico)
      if (e instanceof Response) return e;
      console.error(e);
      const status = e instanceof FdbError ? (e.status >= 500 ? 502 : e.status) : 500;
      return fail(e instanceof Error ? e.message : "Error interno", status);
    }
  };
}

export async function requireAgent(req: NextRequest, roles?: Agent["role"][]): Promise<Agent> {
  const agent = await getAgent(req);
  if (!agent) throw fail("Sesión caducada", 401);
  if (roles && !roles.includes(agent.role)) throw fail("No tienes permiso para esto", 403);
  return agent;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export function idParam(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw fail("Id no válido", 400);
  return id;
}

// País del visitante: cabeceras de CDN si existen; si no, la región del idioma.
export function countryOf(req: Request): string | null {
  const h = req.headers;
  const cc = h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? h.get("x-country-code");
  if (cc && /^[A-Z]{2}$/i.test(cc) && cc.toUpperCase() !== "XX") return cc.toUpperCase();
  const m = /^[a-z]{2,3}-([A-Z]{2})\b/.exec(h.get("accept-language") ?? "");
  return m ? m[1] : null;
}

// Email y WhatsApp públicos de un agente: vacío = null; inválido = error.
export function cleanContactFields(body: Record<string, unknown>) {
  const out: { contact_email?: string | null; whatsapp?: string | null } = {};
  if (typeof body.contact_email === "string") {
    const e = body.contact_email.trim().toLowerCase();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw fail("El email no es válido");
    out.contact_email = e || null;
  }
  if (typeof body.whatsapp === "string") {
    const w = body.whatsapp.trim();
    if (w && !/^\+?[\d\s().-]{6,20}$/.test(w)) throw fail("El WhatsApp debe ser un número con prefijo de país, p. ej. +34 600 000 000");
    out.whatsapp = w || null;
  }
  return out;
}

// Foto adjunta: data URL de imagen comprimida en el navegador (máx. ~700 KB).
export function cleanAttachment(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  if (!/^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(v)) throw fail("Solo se pueden adjuntar imágenes");
  if (v.length > 700_000) throw fail("La imagen es demasiado grande");
  return v;
}

// IP del cliente (detrás de proxy: primera de X-Forwarded-For).
export function ipOf(req: Request): string | null {
  const h = req.headers;
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip");
  return ip?.trim().slice(0, 64) || null;
}

// Límite simple por clave (p. ej. 20 mensajes cada 10 s por visitante).
const g = globalThis as unknown as { __fcRate?: Map<string, number[]> };
const hits = (g.__fcRate ??= new Map<string, number[]>());

export function rateLimit(key: string, max: number, windowMs: number) {
  const t = Date.now();
  const list = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
  if (list.length >= max) throw fail("Demasiados mensajes, espera un momento", 429);
  list.push(t);
  hits.set(key, list);
}
