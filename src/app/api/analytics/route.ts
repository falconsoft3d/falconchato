import type { NextRequest } from "next/server";
import { db } from "@/lib/fdb";
import { handle, json, requireAgent } from "@/lib/http";
import type { Conversation } from "@/lib/types";

type Day = { date: string; served: number; missed: number; total: number; wait: number | null };

// Chats atendidos / perdidos por día, tiempo de espera y satisfacción.
// `tz` es el desfase del navegador (getTimezoneOffset) para agrupar por día local.
export const GET = handle(async (req: NextRequest) => {
  await requireAgent(req);
  const q = req.nextUrl.searchParams;
  const days = Math.min(90, Math.max(1, Number(q.get("days")) || 7));
  const tz = Math.max(-840, Math.min(840, Number(q.get("tz")) || 0));
  const site = Number(q.get("site"));

  const localDate = (t: number) => new Date(t - tz * 60_000).toISOString().slice(0, 10);
  const today = localDate(Date.now());
  const start = new Date(`${today}T00:00:00Z`).getTime() - (days - 1) * 86_400_000 + tz * 60_000;

  const rows = await db.listAll<Conversation>(
    "conversations",
    {
      created_at: `gte.${new Date(start).toISOString()}`,
      ...(site > 0 ? { site_id: `eq.${site}` } : {}),
      select: "id,created_at,status,first_response_at,rating,site_id,ai_agent_id,goals_met",
    },
    20000,
  );

  const byDate = new Map<string, Day & { waitSum: number; waitN: number }>();
  for (let i = 0; i < days; i++) {
    const date = localDate(start + i * 86_400_000 + 12 * 3_600_000);
    byDate.set(date, { date, served: 0, missed: 0, total: 0, wait: null, waitSum: 0, waitN: 0 });
  }

  let good = 0;
  let bad = 0;
  let neutral = 0;
  let ai = 0;
  const goals = new Map<string, number>();
  let waitSum = 0;
  let waitN = 0;
  for (const c of rows) {
    const created = new Date(c.created_at).getTime();
    const d = byDate.get(localDate(created));
    if (!d) continue;
    d.total++;
    if (c.first_response_at) {
      d.served++;
      const w = (new Date(c.first_response_at).getTime() - created) / 1000;
      if (w >= 0) {
        d.waitSum += w;
        d.waitN++;
        waitSum += w;
        waitN++;
      }
    } else if (c.status !== "open") {
      d.missed++;
    }
    if (c.ai_agent_id) ai++;
    for (const g of (c.goals_met ?? "").split(",").map((s) => s.trim()).filter(Boolean)) goals.set(g, (goals.get(g) ?? 0) + 1);
    if (c.rating === "good") good++;
    if (c.rating === "bad") bad++;
    if (c.rating === "neutral") neutral++;
  }

  const series: Day[] = [...byDate.values()].map(({ waitSum: s, waitN: n, ...d }) => ({
    ...d,
    wait: n ? Math.round(s / n) : null,
  }));
  const served = series.reduce((a, d) => a + d.served, 0);
  const missed = series.reduce((a, d) => a + d.missed, 0);
  const total = series.reduce((a, d) => a + d.total, 0);
  return json({
    days: series,
    totals: { total, served, missed, wait: waitN ? Math.round(waitSum / waitN) : null, good, neutral, bad, ai },
    goals: [...goals.entries()].map(([goal, count]) => ({ goal, count })).sort((a, b) => b.count - a.count),
  });
});
