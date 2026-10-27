// Texto plano de una conversación, para copiarla al portapapeles.

import { clock } from "./format";
import { tr, trSystem } from "./i18n";
import type { Message } from "./types";

export function transcript(messages: Pick<Message, "sender" | "author_name" | "body" | "created_at" | "attachment">[], visitorLabel: string) {
  const day = messages[0] ? new Date(messages[0].created_at).toLocaleDateString() : "";
  const lines = messages.map((m) => {
    const body = [m.body, m.attachment ? `[${tr("Foto adjunta")}]` : ""].filter(Boolean).join(" ");
    if (m.sender === "system") return `— ${trSystem(m.body)} —`;
    const who = m.sender === "visitor" ? visitorLabel : (m.author_name ?? tr("Agente"));
    return `[${clock(m.created_at)}] ${who}: ${body}`;
  });
  return [`${tr("Conversación")} · ${day}`, "", ...lines].join("\n");
}

// Copia al portapapeles; si el navegador lo bloquea (iframes), usa el método clásico.
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
