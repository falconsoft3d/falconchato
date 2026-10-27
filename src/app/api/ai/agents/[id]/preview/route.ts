import { AiError, getAiAgent, previewReply } from "@/lib/ai";
import { listSites } from "@/lib/chat";
import { fail, handle, idParam, json, readJson, requireAgent } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };
type Turn = { role: "user" | "assistant"; content: string };

// Chat de prueba: responde como lo haría en el widget, sin guardar nada.
export const POST = handle(async (req, { params }: Ctx) => {
  await requireAgent(req, ["owner", "admin"]);
  const agent = await getAiAgent(idParam((await params).id));
  if (!agent) return fail("Agente no encontrado", 404);
  const body = await readJson(req);
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m: Turn) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m: Turn) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!history.length) return fail("Escribe un mensaje");
  const site = (await listSites()).find((s) => s.id === Number(body.site_id)) ?? null;
  try {
    return json(await previewReply(agent, site, history));
  } catch (e) {
    if (e instanceof AiError || (e instanceof Error && e.name === "TimeoutError")) return fail(e.message, 400);
    throw e;
  }
});
