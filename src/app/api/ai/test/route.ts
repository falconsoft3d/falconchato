import { AiError, testConnection } from "@/lib/ai";
import { fail, handle, json, requireAgent } from "@/lib/http";

export const POST = handle(async (req) => {
  await requireAgent(req, ["owner", "admin"]);
  try {
    return json({ ok: true, reply: await testConnection() });
  } catch (e) {
    if (e instanceof AiError || (e instanceof Error && e.name === "TimeoutError")) return fail(e.message, 400);
    throw e;
  }
});
