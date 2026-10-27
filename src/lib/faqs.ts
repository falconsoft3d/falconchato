// Preguntas frecuentes: el visitante las lee en una pestaña del widget y la IA
// las usa como información del negocio. site_id vacío = todos los sitios.

import { db } from "./fdb";
import { fail } from "./http";

export type Faq = { id: number; site_id: number | null; question: string; answer: string; position: number; is_active: boolean };

const g = globalThis as unknown as { __fcFaqs?: { list: Faq[]; at: number } };

export async function listFaqs(): Promise<Faq[]> {
  if (g.__fcFaqs && Date.now() - g.__fcFaqs.at < 30_000) return g.__fcFaqs.list;
  const list = await db.listAll<Faq>("faqs", { order: "position.asc,id.asc" }, 2000);
  g.__fcFaqs = { list, at: Date.now() };
  return list;
}

export function invalidateFaqs() {
  g.__fcFaqs = undefined;
}

// Las activas de un sitio (las suyas y las de "todos los sitios").
export async function faqsForSite(siteId: number) {
  return (await listFaqs())
    .filter((f) => f.is_active && (f.site_id === null || f.site_id === siteId))
    .map(({ id, question, answer }) => ({ id, question, answer }));
}

export function cleanFaq(body: Record<string, unknown>, partial = false) {
  const out: Partial<Omit<Faq, "id">> = {};
  if (typeof body.question === "string") out.question = body.question.trim().slice(0, 300);
  if (typeof body.answer === "string") out.answer = body.answer.trim().slice(0, 5000);
  if (body.site_id === null || body.site_id === "" || body.site_id === 0) out.site_id = null;
  else if (Number.isInteger(Number(body.site_id))) out.site_id = Number(body.site_id);
  if (Number.isFinite(Number(body.position)) && body.position !== undefined) out.position = Math.round(Number(body.position));
  if (typeof body.is_active === "boolean") out.is_active = body.is_active;
  if (!partial && (!out.question || !out.answer)) throw fail("Escribe la pregunta y la respuesta");
  return out;
}
