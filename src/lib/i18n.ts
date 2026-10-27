// Traducciones ES/EN. El texto en español del código es la clave; `en.ts` da
// la versión en inglés. Si falta una traducción se muestra el español.

import { en } from "./i18n-en";

export type Lang = "es" | "en";
export const LANGS: Lang[] = ["es", "en"];

let current: Lang = "es";

export function setCurrentLang(lang: Lang) {
  current = lang;
}

export function currentLang(): Lang {
  return current;
}

export const localeOf = (lang: Lang = current) => (lang === "en" ? "en" : "es");

// Traduce un texto. Admite variables: tr("Hola, {name}", { name }).
export function tr(text: string, vars?: Record<string, string | number>): string {
  let out = current === "en" ? (en[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

// Mensajes de sistema guardados en español dentro del chat.
const SYSTEM: [RegExp, string][] = [
  [/^(.+) se unió al chat$/, "{1} joined the chat"],
  [/^(.+) finalizó el chat$/, "{1} ended the chat"],
  [/^(.+) ha pasado el chat a una persona del equipo$/, "{1} transferred the chat to a team member"],
];

export function trSystem(body: string): string {
  if (current !== "en") return body;
  for (const [re, out] of SYSTEM) {
    const m = re.exec(body);
    if (m) return out.replace("{1}", m[1]);
  }
  return body;
}

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem("fc_lang");
    if (saved === "es" || saved === "en") return saved;
  } catch {}
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}
