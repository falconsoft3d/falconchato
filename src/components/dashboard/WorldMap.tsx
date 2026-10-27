"use client";

// Mapa del mundo: países coloreados por visitantes (escala secuencial de un solo
// tono, de claro a oscuro), con tooltip, leyenda y la lista de países al lado.

import { geoEqualEarth, geoPath } from "d3-geo";
import countriesLib from "i18n-iso-countries";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { flag } from "@/lib/format";
import { currentLang, tr } from "@/lib/i18n";
import { api } from "./store";
import { Card } from "./ui";

type Period = "day" | "month" | "year";
type Row = { cc: string; visitors: number };
type Data = { total: number; unknown: number; countries: Row[] };

// Rampa azul validada (de la guía de visualización); 5 tramos de claro a oscuro.
const RAMP = ["#cde2fb", "#9ec5f4", "#5598e7", "#256abf", "#0d366b"];

const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
const shapes = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features.filter(
  (f) => f.id !== "010", // sin la Antártida
);

const regionName = (cc: string) => {
  try {
    return new Intl.DisplayNames([currentLang()], { type: "region" }).of(cc) ?? cc;
  } catch {
    return cc;
  }
};

function bucket(value: number, max: number) {
  if (!value || !max) return -1;
  return Math.min(RAMP.length - 1, Math.ceil((value / max) * RAMP.length) - 1);
}

export function WorldMap({ site }: { site?: number }) {
  const [period, setPeriod] = useState<Period>("day");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ cc: string | null; name: string; x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (!boxRef.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ period, tz: String(new Date().getTimezoneOffset()) });
    if (site) qs.set("site", String(site));
    api<Data>(`/api/geo?${qs}`)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [period, site]);

  const byNumeric = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of data?.countries ?? []) {
      const num = countriesLib.alpha2ToNumeric(r.cc);
      if (num) m.set(num, r);
    }
    return m;
  }, [data]);
  const max = data?.countries[0]?.visitors ?? 0;
  const height = Math.round(width * 0.48);

  const paths = useMemo(() => {
    if (!width) return [];
    const projection = geoEqualEarth().fitSize([width, height], { type: "FeatureCollection", features: shapes } as FeatureCollection);
    const path = geoPath(projection);
    // Algunos territorios no tienen id (Kosovo, N. Chipre…): la clave es el índice.
    return shapes.map((f: Feature<Geometry, { name: string }>, i) => ({ key: i, id: f.id ? String(f.id) : "", name: f.properties.name, d: path(f) ?? "" }));
  }, [width, height]);

  const periods: [Period, string][] = [
    ["day", tr("Hoy")],
    ["month", tr("Este mes")],
    ["year", tr("Este año")],
  ];

  return (
    <Card
      title={tr("Visitantes por país")}
      actions={
        <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
          {periods.map(([p, label]) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 ${period === p ? "bg-surface text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_260px]">
        <div ref={boxRef} className="relative min-w-0" onMouseLeave={() => setHover(null)}>
          {width > 0 && (
            <svg width={width} height={height} role="img" aria-label={tr("Mapa de visitantes por país")}>
              {paths.map((p) => {
                const row = byNumeric.get(p.id);
                const b = bucket(row?.visitors ?? 0, max);
                return (
                  <path
                    key={p.key}
                    d={p.d}
                    fill={b >= 0 ? RAMP[b] : "var(--color-zinc-200)"}
                    stroke="var(--color-surface)"
                    strokeWidth={0.6}
                    onMouseMove={(e) => {
                      const r = boxRef.current!.getBoundingClientRect();
                      setHover({ cc: row?.cc ?? null, name: row ? regionName(row.cc) : p.name, x: e.clientX - r.left, y: e.clientY - r.top });
                    }}
                    className="transition-opacity hover:opacity-80"
                  />
                );
              })}
            </svg>
          )}
          {hover && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-zinc-200 bg-surface px-3 py-2 text-xs shadow-lg"
              style={{ left: Math.min(hover.x + 12, width - 160), top: hover.y + 12 }}
            >
              <div className="font-medium text-zinc-900">
                {hover.cc ? `${flag(hover.cc)} ` : ""}
                {hover.name}
              </div>
              <div className="text-zinc-600">
                {tr("{n} visitantes", { n: (hover.cc && data?.countries.find((c) => c.cc === hover.cc)?.visitors) || 0 })}
              </div>
            </div>
          )}
          {max > 0 && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
              <span>1</span>
              <div className="flex">
                {RAMP.map((c) => (
                  <span key={c} className="h-2.5 w-8 first:rounded-l last:rounded-r" style={{ background: c }} />
                ))}
              </div>
              <span>{max}</span>
              <span className="ml-1">{tr("visitantes")}</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!data && !error && <p className="text-sm text-zinc-400">{tr("Cargando…")}</p>}
          {data && (
            <>
              <div className="text-3xl font-semibold tabular-nums text-zinc-900">{data.total}</div>
              <div className="text-xs text-zinc-500">{tr("visitantes únicos en el periodo")}</div>
              <ul className="mt-4 space-y-2.5">
                {data.countries.slice(0, 10).map((c) => (
                  <li key={c.cc} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-zinc-700">
                        {flag(c.cc)} {regionName(c.cc)}
                      </span>
                      <span className="font-medium tabular-nums text-zinc-900">{c.visitors}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-zinc-100">
                      <div className="h-1.5 rounded-full" style={{ width: `${(c.visitors / max) * 100}%`, background: RAMP[3] }} />
                    </div>
                  </li>
                ))}
              </ul>
              {data.countries.length === 0 && <p className="mt-4 text-sm text-zinc-500">{tr("Aún no hay visitas en este periodo.")}</p>}
              {data.unknown > 0 && <p className="mt-3 text-xs text-zinc-400">{tr("{n} sin país detectado", { n: data.unknown })}</p>}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
