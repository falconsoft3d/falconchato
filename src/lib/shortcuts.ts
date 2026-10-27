// Respuestas rápidas: el agente escribe "/" en el chat y elige una.

import { fail } from "./http";

export type Shortcut = { id: number; shortcut: string; body: string; created_by: number | null };

export function cleanShortcut(body: Record<string, unknown>) {
  const shortcut = typeof body.shortcut === "string" ? body.shortcut.trim().replace(/^\//, "").toLowerCase() : "";
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
  if (!/^[\p{L}\p{N}_-]{1,40}$/u.test(shortcut)) throw fail("El atajo solo admite letras, números, - y _ (sin espacios)");
  if (!text) throw fail("Escribe el texto de la respuesta");
  return { shortcut, body: text };
}
