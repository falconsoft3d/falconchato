import { db } from "@/lib/fdb";
import { cleanFaq, invalidateFaqs, listFaqs, type Faq } from "@/lib/faqs";
import { handle, json, readJson, requireAgent } from "@/lib/http";

export const GET = handle(async (req) => {
  await requireAgent(req);
  return json({ faqs: await listFaqs() });
});

export const POST = handle(async (req) => {
  await requireAgent(req, ["owner", "admin"]);
  const input = cleanFaq(await readJson(req));
  const last = (await listFaqs()).reduce((m, f) => Math.max(m, f.position ?? 0), 0);
  const faq = await db.insert<Faq>("faqs", { position: last + 1, ...input });
  invalidateFaqs();
  return json({ faq }, 201);
});
