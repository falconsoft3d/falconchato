import { db } from "@/lib/fdb";
import { cleanFaq, invalidateFaqs, type Faq } from "@/lib/faqs";
import { handle, idParam, json, readJson, requireAgent } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, { params }: Ctx) => {
  await requireAgent(req, ["owner", "admin"]);
  const faq = await db.update<Faq>("faqs", idParam((await params).id), cleanFaq(await readJson(req), true));
  invalidateFaqs();
  return json({ faq });
});

export const DELETE = handle(async (req, { params }: Ctx) => {
  await requireAgent(req, ["owner", "admin"]);
  await db.remove("faqs", idParam((await params).id));
  invalidateFaqs();
  return json({ ok: true });
});
