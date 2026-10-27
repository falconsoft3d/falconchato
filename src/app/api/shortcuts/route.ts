import { db } from "@/lib/fdb";
import { fail, handle, json, readJson, requireAgent } from "@/lib/http";
import { cleanShortcut, type Shortcut } from "@/lib/shortcuts";

export const GET = handle(async (req) => {
  await requireAgent(req);
  return json({ shortcuts: await db.listAll<Shortcut>("shortcuts", { order: "shortcut.asc" }, 2000) });
});

export const POST = handle(async (req) => {
  const me = await requireAgent(req);
  const input = cleanShortcut(await readJson(req));
  if (await db.first("shortcuts", { shortcut: `eq.${input.shortcut}` })) return fail("Ya existe ese atajo");
  return json({ shortcut: await db.insert<Shortcut>("shortcuts", { ...input, created_by: me.id }) }, 201);
});
