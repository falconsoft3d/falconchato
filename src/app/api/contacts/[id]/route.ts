import { cleanContactInput, updateContact } from "@/lib/contacts";
import { db } from "@/lib/fdb";
import { fail, handle, idParam, json, readJson, requireAgent } from "@/lib/http";
import type { Contact, Conversation } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Ctx) => {
  await requireAgent(req);
  const contact = await db.get<Contact>("contacts", idParam((await params).id));
  if (!contact) return fail("Contacto no encontrado", 404);
  const conversations = contact.visitor_id
    ? (await db.list<Conversation>("conversations", { visitor_id: `eq.${contact.visitor_id}`, order: "id.desc", limit: 50 })).data
    : [];
  return json({ contact, conversations });
});

export const PATCH = handle(async (req, { params }: Ctx) => {
  await requireAgent(req);
  try {
    return json({ contact: await updateContact(idParam((await params).id), cleanContactInput(await readJson(req))) });
  } catch (e) {
    if (e instanceof Error && e.message.includes("email")) return fail(e.message);
    throw e;
  }
});

export const DELETE = handle(async (req, { params }: Ctx) => {
  await requireAgent(req, ["owner", "admin"]);
  await db.remove("contacts", idParam((await params).id));
  return json({ ok: true });
});
