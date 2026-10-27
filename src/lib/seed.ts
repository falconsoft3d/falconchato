// Sitio por defecto de la home de falconchato: soporte con un agente IA.
// Se crea solo la primera vez que alguien abre la home (si no existe).

import { saveAiAgent } from "./ai";
import { getSiteByKey } from "./chat";
import { db } from "./fdb";
import type { Site } from "./types";

export const HOME_SITE_KEY = process.env.HOME_SITE_KEY ?? "home";

const KNOWLEDGE = `falconchato es un chat en vivo para sitios web (al estilo de Zopim / Zendesk Chat).

Qué incluye:
- Widget para tu web: se instala pegando una línea de código antes de </body>: <script async src="https://TU_DOMINIO/widget.js" data-site="CLAVE"></script>. Colores, textos y posición configurables por sitio. Funciona en móvil.
- Tiempo real: los mensajes llegan al instante, con indicador de «escribiendo» y vista previa de lo que teclea el visitante.
- Panel para el equipo: visitantes en vivo (qué página ven, de dónde vienen, país), chats, chat proactivo (el agente escribe primero), historial con filtros, analítica (chats atendidos, perdidos, espera media, satisfacción).
- Agentes IA con ChatGPT: nombre, foto, personalidad e información del negocio. Atienden siempre o solo cuando no hay nadie, pasan el chat a una persona si hace falta y persiguen objetivos (por ejemplo conseguir el email).
- CRM integrado: contactos y leads con nombre, email, teléfono, empresa, estado, etiquetas y notas.
- Varios sitios por cuenta, cada uno con sus agentes humanos, agentes IA y objetivos.
- Mensajes offline cuando no hay nadie conectado, aviso en el título de la pestaña y sonido «toc, toc» al entrar un visitante.
- API preparada para una app móvil.

Cómo probarlo: en esta misma web hay una demo del widget (botón «Ver la demo del widget»). Para usar el panel hace falta una cuenta; el registro no es público: el equipo crea la cuenta.

Precios y planes: no tengo esa información; ofrece que alguien del equipo le escriba y pide su email.`;

let pending: Promise<Site | null> | null = null;

export function ensureHomeSite(): Promise<Site | null> {
  pending ??= create().finally(() => {
    pending = null;
  });
  return pending;
}

async function create(): Promise<Site | null> {
  const existing = await getSiteByKey(HOME_SITE_KEY);
  if (existing) return existing;
  try {
    const agent = await saveAiAgent(null, {
      name: "Falco",
      personality: "Cercano, claro y resolutivo. Tutea, responde corto y en el idioma del cliente. Usa algún emoji con moderación.",
      knowledge: KNOWLEDGE,
      is_active: true,
    });
    await db.insert<Site>("sites", {
      name: "falconchato",
      site_key: HOME_SITE_KEY,
      color: "#18181b",
      title: "Soporte falconchato",
      welcome_message: "¡Hola! Soy Falco, el asistente de falconchato 👋 ¿En qué te ayudo?",
      offline_message: "Ahora no hay nadie conectado. Déjanos tu email y te escribimos.",
      position: "right",
      is_active: true,
      ai_mode: "always",
      ai_agent_ids: [agent.id],
      goals: ["Conseguir el email del cliente", "Que el cliente pruebe la demo del widget"],
    });
  } catch (e) {
    // Otra petición pudo crearlo a la vez (site_key es único): nos quedamos con el que exista.
    console.error("[seed] home", e instanceof Error ? e.message : e);
  }
  return getSiteByKey(HOME_SITE_KEY);
}
