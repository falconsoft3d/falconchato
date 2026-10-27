import type { NextRequest } from "next/server";
import { getOpenConversation, getVisitor, patchConversation, updateVisitorProfile } from "@/lib/chat";
import { cleanContactInput, contactForVisitor, listContacts, updateContact } from "@/lib/contacts";
import { db } from "@/lib/fdb";
import { fail, handle, json, readJson, requireAgent } from "@/lib/http";
import type { Contact } from "@/lib/types";

const PAGE = 50;

// ?visitor_id= → el contacto de ese visitante; si no, listado con filtros.
export const GET = handle(async (req: NextRequest) => {
  await requireAgent(req);
  const q = req.nextUrl.searchParams;
  const visitorId = Number(q.get("visitor_id"));
  if (visitorId > 0) return json({ contact: await contactForVisitor(visitorId) });
  const rows = await listContacts({ q: q.get("q") ?? undefined, status: q.get("status") ?? undefined, site: Number(q.get("site")) || undefined });
  const page = Math.max(0, Number(q.get("page")) || 0);
  return json({ contacts: rows.slice(page * PAGE, page * PAGE + PAGE), count: rows.length, pageSize: PAGE });
});

// Guardar el contacto de un visitante desde la ficha del chat (crea o actualiza).
export const POST = handle(async (req) => {
  await requireAgent(req);
  const body = await readJson(req);
  let input;
  try {
    input = cleanContactInput(body);
  } catch (e) {
    return fail((e as Error).message);
  }
  // Contacto manual (sin visitante), p. ej. desde la página Contactos.
  if (!body.visitor_id) {
    if (!input.name && !input.email && !input.phone) return fail("Escribe al menos nombre, email o teléfono");
    return json({ contact: await db.insert<Contact>("contacts", input) }, 201);
  }
  const visitor = await getVisitor(Number(body.visitor_id));
  if (!visitor) return fail("Visitante no encontrado", 404);

  const existing = await contactForVisitor(visitor.id);
  const contact = existing
    ? await updateContact(existing.id, input)
    : await db.insert<Contact>("contacts", { ...input, site_id: visitor.site_id, visitor_id: visitor.id });

  // El nombre/email del contacto pasa al visitante y al chat abierto.
  const v = updateVisitorProfile(visitor, input.name ?? undefined, input.email ?? undefined);
  const conv = await getOpenConversation(v.id);
  if (conv && (conv.visitor_name !== v.name || conv.visitor_email !== v.email)) {
    patchConversation(conv, { visitor_name: v.name, visitor_email: v.email });
  }
  return json({ contact });
});
