import type { NextRequest } from "next/server";
import { db } from "@/lib/fdb";
import { handle, json, requireAgent } from "@/lib/http";
import type { Visitor } from "@/lib/types";

// Visitantes únicos activos por país en el periodo (hoy, este mes, este año).
// `tz` es el desfase del navegador (getTimezoneOffset) para cortar los días en hora local.
export const GET = handle(async (req: NextRequest) => {
  await requireAgent(req);
  const q = req.nextUrl.searchParams;
  const period = q.get("period") === "year" ? "year" : q.get("period") === "month" ? "month" : "day";
  const tz = Math.max(-840, Math.min(840, Number(q.get("tz")) || 0));
  const site = Number(q.get("site"));

  const local = new Date(Date.now() - tz * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const startLocal = period === "year" ? Date.UTC(y, 0, 1) : period === "month" ? Date.UTC(y, m, 1) : Date.UTC(y, m, local.getUTCDate());
  const start = new Date(startLocal + tz * 60_000).toISOString();

  const rows = await db.listAll<Pick<Visitor, "country">>(
    "visitors",
    { last_seen_at: `gte.${start}`, select: "country", ...(site > 0 ? { site_id: `eq.${site}` } : {}) },
    50000,
  );
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const r of rows) {
    if (r.country && /^[A-Z]{2}$/.test(r.country)) counts.set(r.country, (counts.get(r.country) ?? 0) + 1);
    else unknown++;
  }
  const countries = [...counts.entries()].map(([cc, visitors]) => ({ cc, visitors })).sort((a, b) => b.visitors - a.visitors);
  return json({ period, start, total: rows.length, unknown, countries });
});
