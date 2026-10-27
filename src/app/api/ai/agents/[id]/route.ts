import { cleanAiAgentInput, deleteAiAgent, saveAiAgent } from "@/lib/ai";
import { handle, idParam, json, readJson, requireAgent } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, { params }: Ctx) => {
  await requireAgent(req, ["owner", "admin"]);
  return json({ agent: await saveAiAgent(idParam((await params).id), cleanAiAgentInput(await readJson(req))) });
});

export const DELETE = handle(async (req, { params }: Ctx) => {
  await requireAgent(req, ["owner", "admin"]);
  await deleteAiAgent(idParam((await params).id));
  return json({ ok: true });
});
