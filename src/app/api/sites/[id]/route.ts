import { cleanSiteInput, deleteSite, updateSite } from "@/lib/chat";
import { handle, idParam, json, readJson, requireAgent } from "@/lib/http";
import { VISITORS, publish } from "@/lib/realtime";
import { widgetConfig } from "@/lib/widget";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, { params }: Ctx) => {
  await requireAgent(req, ["owner", "admin"]);
  const site = await updateSite(idParam((await params).id), cleanSiteInput(await readJson(req)));
  // Los widgets abiertos de este sitio se actualizan al momento (color, textos…).
  publish(VISITORS, "site", { site_key: site.site_key, config: await widgetConfig(site) });
  return json({ site });
});

export const DELETE = handle(async (req, { params }: Ctx) => {
  await requireAgent(req, ["owner"]);
  await deleteSite(idParam((await params).id));
  return json({ ok: true });
});
