// Tipos compartidos entre servidor y cliente (filas de falcondatabase y eventos en tiempo real).

export type Site = {
  id: number;
  created_at: string;
  name: string;
  domain: string | null;
  site_key: string;
  color: string;
  title: string;
  welcome_message: string;
  offline_message: string;
  position: "left" | "right";
  is_active: boolean;
  // Agentes humanos asignados (vacío = todos), agentes IA y objetivos del sitio.
  agent_ids: number[] | null;
  ai_agent_ids: number[] | null;
  ai_mode: AiMode;
  goals: string[] | null;
  // Mensaje proactivo que aparece sobre el botón a los N segundos (vacío = desactivado).
  auto_message: string | null;
  auto_message_delay: number | null;
  // Lluvia de caracteres "Matrix" en el fondo del chat abierto.
  matrix_effect: boolean | null;
};

// off: sin IA · offline: solo cuando no hay humanos conectados · always: la IA atiende primero
export type AiMode = "off" | "offline" | "always";

export type AiAgent = {
  id: number;
  created_at: string;
  name: string;
  personality: string | null;
  knowledge: string | null;
  avatar: string | null;
  is_active: boolean;
  contact_email: string | null;
  whatsapp: string | null;
};

export type ContactStatus = "lead" | "qualified" | "customer" | "lost";

export type Contact = {
  id: number;
  created_at: string;
  updated_at: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: ContactStatus;
  tags: string | null;
  notes: string | null;
  site_id: number | null;
  visitor_id: number | null;
};

export type AgentStatus = "online" | "away" | "invisible";

export type Agent = {
  id: number;
  user_id: number;
  email: string;
  name: string | null;
  role: "owner" | "admin" | "agent";
  status: AgentStatus | "offline";
  last_seen_at: string | null;
  disabled: boolean;
  avatar: string | null;
  // Datos de contacto públicos (opcionales) que ve el cliente en el widget.
  contact_email: string | null;
  whatsapp: string | null;
};

export type Visitor = {
  id: number;
  created_at: string;
  site_id: number;
  visitor_key: string;
  name: string | null;
  email: string | null;
  current_url: string | null;
  page_title: string | null;
  referrer: string | null;
  user_agent: string | null;
  country: string | null;
  visits: number;
  last_seen_at: string | null;
  ip: string | null;
  // Nombre/email recuperados de otro visitante con la misma IP (puede no ser la misma persona).
  known_by_ip: boolean;
};

// open: chat en curso · offline: mensaje dejado sin agentes conectados · closed: finalizado
export type ConversationStatus = "open" | "offline" | "closed";

export type Conversation = {
  id: number;
  created_at: string;
  site_id: number;
  visitor_id: number;
  status: ConversationStatus;
  agent_id: number | null;
  visitor_name: string | null;
  visitor_email: string | null;
  page_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread: number;
  first_response_at: string | null;
  rating: Rating | null;
  rating_comment: string | null;
  tags: string | null;
  closed_at: string | null;
  ai_agent_id: number | null;
  ai_paused: boolean;
  goals_met: string | null;
};

// Valoración del cliente: contento, neutral o triste.
export type Rating = "good" | "neutral" | "bad";

export type Sender = "visitor" | "agent" | "bot" | "system";

export type Message = {
  id?: number;
  client_id: string;
  created_at: string;
  conversation_id: number;
  sender: Sender;
  agent_id: number | null;
  author_name: string | null;
  body: string;
  // Foto adjunta (data URL comprimida en el navegador).
  attachment?: string | null;
};

// Visitante conectado ahora mismo (presencia en memoria + datos de la fila).
export type LiveVisitor = {
  visitor: Visitor;
  site: { id: number; name: string } | null;
  connected_at: string;
  conversation: Conversation | null;
};

export type AgentPresence = {
  id: number;
  name: string;
  status: Agent["status"];
  connected: boolean;
};

export type PublicAgent = Pick<Agent, "id" | "name" | "email" | "role" | "status">;

// Lo que el visitante ve de un agente (humano o IA).
export type PublicFace = { id: number; name: string; avatar: string | null; contact_email: string | null; whatsapp: string | null };

export type WidgetConfig = Pick<
  Site,
  | "name"
  | "color"
  | "title"
  | "welcome_message"
  | "offline_message"
  | "position"
  | "agent_ids"
  | "auto_message"
  | "auto_message_delay"
  | "matrix_effect"
> & {
  // Preguntas frecuentes que el visitante puede leer en el widget.
  faqs: { id: number; question: string; answer: string }[];
  // Agentes humanos del sitio (nombre y foto públicos) para mostrarlos en el widget.
  team: PublicFace[];
  // Agente IA que atiende en este sitio (si hay), visible para el cliente.
  ai: { mode: Exclude<AiMode, "off">; agents: PublicFace[] } | null;
};
