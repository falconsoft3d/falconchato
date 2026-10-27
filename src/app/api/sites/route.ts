import { cleanSiteInput, createSite, listSites } from "@/lib/chat";
import { fail, handle, json, readJson, requireAgent } from "@/lib/http";

export const GET = handle(async (req) => {
  await requireAgent(req);
  return json({ sites: await listSites() });
});

export const POST = handle(async (req) => {
  await requireAgent(req, ["owner", "admin"]);
  const input = cleanSiteInput(await readJson(req));
  if (!input.name) return fail("Ponle un nombre al sitio");
  return json({ site: await createSite(input) }, 201);
});
