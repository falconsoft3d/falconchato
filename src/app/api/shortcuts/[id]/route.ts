import { db } from "@/lib/fdb";
import { fail, handle, idParam, json, readJson, requireAgent } from "@/lib/http";
import { cleanShortcut, type Shortcut } from "@/lib/shortcuts";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, { params }: Ctx) => {
  await requireAgent(req);
  const id = idParam((await params).id);
  const input = cleanShortcut(await readJson(req));
  const clash = await db.first<Shortcut>("shortcuts", { shortcut: `eq.${input.shortcut}` });
  if (clash && clash.id !== id) return fail("Ya existe ese atajo");
  return json({ shortcut: await db.update<Shortcut>("shortcuts", id, input) });
});

export const DELETE = handle(async (req, { params }: Ctx) => {
  await requireAgent(req);
  await db.remove("shortcuts", idParam((await params).id));
  return json({ ok: true });
});
