// CRM integrado: un contacto por visitante (o por email si coincide).

import { db } from "./fdb";
import type { Contact, ContactStatus, Visitor } from "./types";

export const CONTACT_STATUSES: ContactStatus[] = ["lead", "qualified", "customer", "lost"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactInput = Partial<Pick<Contact, "name" | "email" | "phone" | "company" | "status" | "tags" | "notes">>;

export function cleanContactInput(body: Record<string, unknown>): ContactInput {
  const out: ContactInput = {};
  const str = (k: keyof ContactInput, max: number) => {
    const v = body[k];
    if (typeof v === "string") (out as Record<string, unknown>)[k] = v.trim().slice(0, max) || null;
  };
  str("name", 80);
  str("phone", 40);
  str("company", 120);
  str("tags", 200);
  str("notes", 4000);
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) throw new Error("El email no es válido");
    out.email = email || null;
  }
  if (CONTACT_STATUSES.includes(body.status as ContactStatus)) out.status = body.status as ContactStatus;
  return out;
}

export async function contactForVisitor(visitorId: number) {
  return db.first<Contact>("contacts", { visitor_id: `eq.${visitorId}` });
}

// Crea o actualiza el contacto de un visitante. Solo escribe los campos con valor
// (la IA o el formulario offline no deben borrar lo que ya había).
export async function upsertContactForVisitor(
  visitor: Pick<Visitor, "id" | "name" | "email">,
  siteId: number | null,
  raw: Record<string, unknown>,
) {
  let input: ContactInput;
  try {
    input = cleanContactInput(raw);
  } catch {
    input = cleanContactInput({ ...raw, email: "" });
  }
  const fields = Object.fromEntries(Object.entries(input).filter(([, v]) => v)) as ContactInput;
  if (!fields.name && visitor.name) fields.name = visitor.name;
  if (!fields.email && visitor.email) fields.email = visitor.email;

  let contact = await contactForVisitor(visitor.id);
  if (!contact && fields.email) contact = await db.first<Contact>("contacts", { email: `eq.${fields.email}` });
  if (contact) {
    if (raw.notes && contact.notes && fields.notes && !contact.notes.includes(fields.notes)) {
      fields.notes = `${contact.notes}\n${fields.notes}`;
    }
    return db.update<Contact>("contacts", contact.id, { ...fields, updated_at: new Date().toISOString() });
  }
  if (!fields.name && !fields.email && !fields.phone) return null;
  return db.insert<Contact>("contacts", { ...fields, site_id: siteId, visitor_id: visitor.id });
}

export async function updateContact(id: number, input: ContactInput) {
  return db.update<Contact>("contacts", id, { ...input, updated_at: new Date().toISOString() });
}

export async function listContacts(filters: { q?: string; status?: string; site?: number }) {
  const query: Record<string, string> = { order: "updated_at.desc" };
  if (filters.status && CONTACT_STATUSES.includes(filters.status as ContactStatus)) query.status = `eq.${filters.status}`;
  if (filters.site) query.site_id = `eq.${filters.site}`;
  const rows = await db.listAll<Contact>("contacts", query, 5000);
  const q = filters.q?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((c) => [c.name, c.email, c.phone, c.company, c.tags, c.notes].some((f) => f?.toLowerCase().includes(q)));
}
