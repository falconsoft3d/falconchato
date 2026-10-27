import { handle, json, requireAgent } from "@/lib/http";
import { allLiveVisitors } from "@/lib/widget";

export const GET = handle(async (req) => {
  await requireAgent(req);
  return json({ visitors: await allLiveVisitors() });
});
