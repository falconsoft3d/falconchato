import { closeConversation, getOpenConversation } from "@/lib/chat";
import { visitorName } from "@/lib/format";
import { handle, json, readJson } from "@/lib/http";
import { resolveVisitor } from "@/lib/widget";

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const { visitor } = await resolveVisitor(body.site, body.v);
  const conversation = await getOpenConversation(visitor.id);
  if (conversation) closeConversation(conversation, visitorName(visitor));
  return json({ ok: true });
});
