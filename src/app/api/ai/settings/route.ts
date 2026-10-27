import { publicAiSettings, saveAiSettings } from "@/lib/ai";
import { fail, handle, json, readJson, requireAgent } from "@/lib/http";

// La API key nunca vuelve al navegador: solo "configurada" y sus 4 últimos caracteres.
export const GET = handle(async (req) => {
  await requireAgent(req, ["owner", "admin"]);
  return json(await publicAiSettings());
});

export const PUT = handle(async (req) => {
  await requireAgent(req, ["owner", "admin"]);
  const body = await readJson(req);
  const apiKey = body.api_key === null ? null : typeof body.api_key === "string" && body.api_key.trim() ? body.api_key.trim() : undefined;
  if (apiKey && !/^sk-[\w-]{20,}$/.test(apiKey)) return fail("La API key de OpenAI empieza por «sk-»");
  const model = typeof body.model === "string" && /^[\w.:-]{2,60}$/.test(body.model.trim()) ? body.model.trim() : undefined;
  return json(await saveAiSettings({ apiKey, model }));
});
