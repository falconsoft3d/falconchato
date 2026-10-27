"use client";

import { localeOf, tr } from "@/lib/i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, useStore } from "@/components/dashboard/store";
import { Card, PageHeader, Stat, input } from "@/components/dashboard/ui";
import { duration } from "@/lib/format";

type Day = { date: string; served: number; missed: number; total: number; wait: number | null };
type Data = {
  days: Day[];
  totals: { total: number; served: number; missed: number; wait: number | null; good: number; neutral: number; bad: number; ai: number };
  goals: { goal: string; count: number }[];
};

// Solo grises (a petición): atendidos oscuro / perdidos claro, separados por un
// hueco de 2 px, con leyenda y vista de tabla para no depender del tono.
const SERVED = "var(--color-zinc-700)";
const MISSED = "var(--color-zinc-400)";
const WAIT = "var(--color-zinc-500)";

const dayLabel = (d: string, long = false) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(localeOf(), long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });

export default function AnalyticsPage() {
  const { state } = useStore();
  const [days, setDays] = useState(7);
  const [site, setSite] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ days: String(days), tz: String(new Date().getTimezoneOffset()) });
    if (site) qs.set("site", site);
    api<Data>(`/api/analytics?${qs}`)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [days, site]);

  const t = data?.totals;
  const pct = (n: number) => (t && t.total ? `${Math.round((n / t.total) * 100)}%` : "—");
  const rated = t ? t.good + t.neutral + t.bad : 0;

  return (
    <>
      <PageHeader
        title={tr("Analítica")}
        subtitle={tr("Chats atendidos y perdidos, tiempo de espera y satisfacción")}
        actions={
          <>
            <select className={input} value={site} onChange={(e) => setSite(e.target.value)} aria-label={tr("Sitio")}>
              <option value="">{tr("Todos los sitios")}</option>
              {state.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select className={input} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={tr("Periodo")}>
              <option value={7}>{tr("Últimos 7 días")}</option>
              <option value={14}>{tr("Últimos 14 días")}</option>
              <option value={30}>{tr("Últimos 30 días")}</option>
              <option value={90}>{tr("Últimos 90 días")}</option>
            </select>
          </>
        }
      />
      <div className="space-y-6 p-6">
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label={tr("Chats")} value={t?.total ?? "—"} />
          <Stat label={tr("Atendidos")} value={t?.served ?? "—"} hint={t ? tr("{pct} del total", { pct: pct(t.served) }) : undefined} />
          <Stat label={tr("Perdidos")} value={t?.missed ?? "—"} hint={t ? tr("{pct} del total", { pct: pct(t.missed) }) : undefined} tone={t?.missed ? "warn" : undefined} />
          <Stat label={tr("Espera media")} value={t ? duration(t.wait ?? 0) : "—"} hint={tr("Hasta la primera respuesta")} />
          <Stat
            label={tr("Satisfacción")}
            value={rated ? `${Math.round((t!.good / rated) * 100)}%` : "—"}
            hint={rated ? `${tr("Contento")} ${t!.good} · ${tr("Normal")} ${t!.neutral} · ${tr("Descontento")} ${t!.bad}` : tr("Sin valoraciones aún")}
          />
        </div>

        <Card
          title={tr("Chats por día")}
          actions={
            <button onClick={() => setTable(!table)} className="text-xs font-medium text-zinc-900">
              {table ? tr("Ver gráfico") : tr("Ver tabla")}
            </button>
          }
        >
          <div className="p-5">
            {!data ? (
              <div className="h-72 animate-pulse rounded-lg bg-zinc-50" />
            ) : table ? (
              <DataTable days={data.days} />
            ) : (
              <>
                <div className="mb-3 flex gap-4 text-xs text-zinc-600">
                  <Legend color={SERVED} label={tr("Atendidos")} />
                  <Legend color={MISSED} label={tr("Perdidos")} />
                </div>
                <StackedColumns days={data.days} />
              </>
            )}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={tr("Atención con IA")}>
            <div className="p-5">
              <div className="text-3xl font-semibold tabular-nums">{t ? t.ai : "—"}</div>
              <div className="mt-1 text-sm text-zinc-500">{t ? tr("chats atendidos por agentes IA ({pct} del total)", { pct: pct(t.ai) }) : ""}</div>
            </div>
          </Card>
          <Card title={tr("Objetivos conseguidos")}>
            {!data?.goals.length ? (
              <p className="p-5 text-sm text-zinc-500">{tr("Aún ninguno. Define objetivos en «Sitios y widget» y la IA los irá marcando.")}</p>
            ) : (
              <ul className="space-y-2.5 p-5">
                {data.goals.map((g) => (
                  <li key={g.goal} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-700">{g.goal}</span>
                      <span className="font-medium tabular-nums">{g.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-zinc-100">
                      <div className="h-1.5 rounded-full bg-zinc-700" style={{ width: `${(g.count / Math.max(...data.goals.map((x) => x.count))) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {data && !table && (
          <Card title={tr("Espera media hasta la primera respuesta")}>
            <div className="p-5">
              <WaitColumns days={data.days} />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// Máximo del eje con 4 divisiones limpias (enteras para conteos).
function niceMax(v: number, integer = true) {
  const raw = Math.max(v, 1) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = integer && pow < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const step = steps.map((m) => m * pow).find((s) => s >= raw && (!integer || Number.isInteger(s))) ?? 10 * pow;
  return Math.max(integer ? Math.ceil(step) : step, integer ? 1 : 0) * 4;
}

// Rectángulo con las esquinas superiores redondeadas (base recta).
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

const M = { top: 16, right: 8, bottom: 28, left: 36 };

function Axes({ width, height, max, labels, fmt }: { width: number; height: number; max: number; labels: string[]; fmt: (v: number) => string }) {
  const innerH = height - M.top - M.bottom;
  const band = (width - M.left - M.right) / labels.length;
  const every = Math.ceil(labels.length / Math.max(1, Math.floor((width - M.left) / 64)));
  return (
    <g>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = M.top + innerH * (1 - f);
        return (
          <g key={f}>
            <line x1={M.left} x2={width - M.right} y1={y} y2={y} stroke="var(--color-zinc-200)" strokeWidth={1} />
            <text x={M.left - 8} y={y + 4} textAnchor="end" className="fill-zinc-400 text-[11px] tabular-nums">
              {fmt(max * f)}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) =>
        i % every === 0 ? (
          <text key={l} x={M.left + band * i + band / 2} y={height - 8} textAnchor="middle" className="fill-zinc-500 text-[11px]">
            {dayLabel(l)}
          </text>
        ) : null,
      )}
    </g>
  );
}

function StackedColumns({ days }: { days: Day[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 280;
  const max = niceMax(Math.max(...days.map((d) => d.served + d.missed), 0));
  const innerH = height - M.top - M.bottom;
  const band = width ? (width - M.left - M.right) / days.length : 0;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => M.top + innerH * (1 - v / max);
  const peak = days.reduce((best, d, i) => (d.served + d.missed > days[best].served + days[best].missed ? i : best), 0);

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={tr("Chats atendidos y perdidos por día")} onMouseLeave={() => setHover(null)}>
          <Axes width={width} height={height} max={max} labels={days.map((d) => d.date)} fmt={(v) => String(Math.round(v))} />
          {days.map((d, i) => {
            const x = M.left + band * i + (band - barW) / 2;
            const servedH = innerH * (d.served / max);
            const missedH = innerH * (d.missed / max);
            const gap = d.served && d.missed ? 2 : 0;
            const total = d.served + d.missed;
            return (
              <g key={d.date} opacity={hover === null || hover === i ? 1 : 0.45}>
                {d.served > 0 && (
                  <path
                    d={d.missed ? `M${x},${y(0)}h${barW}v${-servedH}h${-barW}Z` : topRounded(x, y(0) - servedH, barW, servedH, 4)}
                    fill={SERVED}
                  />
                )}
                {d.missed > 0 && <path d={topRounded(x, y(0) - servedH - gap - missedH, barW, Math.max(0, missedH), 4)} fill={MISSED} />}
                {i === peak && total > 0 && (
                  <text x={x + barW / 2} y={y(total) - 6} textAnchor="middle" className="fill-zinc-700 text-[11px] font-medium tabular-nums">
                    {total}
                  </text>
                )}
                <rect x={M.left + band * i} y={M.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tooltip x={M.left + band * hover + band / 2} width={width}>
          <div className="mb-1 font-medium text-zinc-900">{dayLabel(days[hover].date, true)}</div>
          <Row color={SERVED} label={tr("Atendidos")} value={days[hover].served} />
          <Row color={MISSED} label={tr("Perdidos")} value={days[hover].missed} />
          <div className="mt-1 border-t border-zinc-100 pt-1 text-zinc-500">{tr("Espera media:")} {duration(days[hover].wait ?? 0)}</div>
        </Tooltip>
      )}
    </div>
  );
}

function WaitColumns({ days }: { days: Day[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 180;
  const max = niceMax(Math.max(...days.map((d) => d.wait ?? 0), 0));
  const innerH = height - M.top - M.bottom;
  const band = width ? (width - M.left - M.right) / days.length : 0;
  const barW = Math.min(24, band * 0.6);

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={tr("Espera media por día")} onMouseLeave={() => setHover(null)}>
          <Axes width={width} height={height} max={max} labels={days.map((d) => d.date)} fmt={(v) => (v >= 60 ? `${Math.round(v / 60)}m` : `${Math.round(v)}s`)} />
          {days.map((d, i) => {
            const h = innerH * ((d.wait ?? 0) / max);
            const x = M.left + band * i + (band - barW) / 2;
            return (
              <g key={d.date} opacity={hover === null || hover === i ? 1 : 0.45}>
                {h > 0 && <path d={topRounded(x, M.top + innerH - h, barW, h, 4)} fill={WAIT} />}
                <rect x={M.left + band * i} y={M.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tooltip x={M.left + band * hover + band / 2} width={width}>
          <div className="font-medium text-zinc-900">{dayLabel(days[hover].date, true)}</div>
          <div className="text-zinc-600">{tr("Espera media:")} {duration(days[hover].wait ?? 0)}</div>
        </Tooltip>
      )}
    </div>
  );
}

function Tooltip({ x, width, children }: { x: number; width: number; children: React.ReactNode }) {
  const left = Math.min(Math.max(x - 80, 0), width - 170);
  return (
    <div className="pointer-events-none absolute top-0 w-[170px] rounded-lg border border-zinc-200 bg-surface px-3 py-2 text-xs shadow-lg" style={{ left }}>
      {children}
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 text-zinc-600">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      <span className="flex-1">{label}</span>
      <span className="font-medium tabular-nums text-zinc-900">{value}</span>
    </div>
  );
}

function DataTable({ days }: { days: Day[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="py-2 font-medium">{tr("Día")}</th>
            <th className="py-2 text-right font-medium">{tr("Atendidos")}</th>
            <th className="py-2 text-right font-medium">{tr("Perdidos")}</th>
            <th className="py-2 text-right font-medium">{tr("Total")}</th>
            <th className="py-2 text-right font-medium">{tr("Espera media")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 tabular-nums">
          {days.map((d) => (
            <tr key={d.date}>
              <td className="py-2">{dayLabel(d.date, true)}</td>
              <td className="py-2 text-right">{d.served}</td>
              <td className="py-2 text-right">{d.missed}</td>
              <td className="py-2 text-right">{d.total}</td>
              <td className="py-2 text-right">{duration(d.wait ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
