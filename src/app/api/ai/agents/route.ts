import { cleanAiAgentInput, listAiAgents, saveAiAgent } from "@/lib/ai";
import { fail, handle, json, readJson, requireAgent } from "@/lib/http";

export const GET = handle(async (req) => {
  await requireAgent(req);
  return json({ agents: await listAiAgents() });
});

export const POST = handle(async (req) => {
  await requireAgent(req, ["owner", "admin"]);
  const input = cleanAiAgentInput(await readJson(req));
  if (!input.name) return fail("Ponle un nombre al agente");
  return json({ agent: await saveAiAgent(null, input) }, 201);
});
