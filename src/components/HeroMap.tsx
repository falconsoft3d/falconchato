// Mapa del mundo decorativo para el fondo de la home: países con colores suaves
// y puntos que laten en algunas ciudades (como chats en vivo).

import { geoEqualEarth, geoPath } from "d3-geo";
import countriesLib from "i18n-iso-countries";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";

const W = 960;
const H = 500;
const COLORS = ["#2dd4bf", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#34d399"];
const LIT = ["ES", "MX", "US", "BR", "AR", "CO", "FR", "DE", "GB", "IT", "IN", "JP", "AU", "ZA", "CA", "CL", "PE", "NG", "PT", "MA"];
const CITIES: [number, number][] = [
  [-3.7, 40.4],
  [-99.1, 19.4],
  [-74, 40.7],
  [-46.6, -23.5],
  [-58.4, -34.6],
  [-74.1, 4.7],
  [-0.1, 51.5],
  [13.4, 52.5],
  [3.4, 6.5],
  [72.9, 19.1],
  [139.7, 35.7],
  [151.2, -33.9],
];

const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
const shapes = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry>).features.filter((f) => f.id !== "010");
const projection = geoEqualEarth().fitSize([W, H], { type: "FeatureCollection", features: shapes } as FeatureCollection);
// Redondeo: servidor y navegador deben generar exactamente el mismo SVG (hidratación).
const path = geoPath(projection).digits(1);
const lit = new Map(LIT.map((cc, i) => [countriesLib.alpha2ToNumeric(cc), COLORS[i % COLORS.length]]));
// Algunos territorios del atlas no tienen id (Kosovo, N. Chipre…): la clave es el índice.
const countries = shapes.map((f, i) => ({ key: i, d: path(f) ?? "", color: f.id ? lit.get(String(f.id)) : undefined }));
const dots = CITIES.map(([lon, lat], i) => ({
  xy: projection([lon, lat])!.map((n) => Math.round(n * 10) / 10),
  color: COLORS[i % COLORS.length],
  delay: Math.round(((i * 0.37) % 2.4) * 100) / 100,
}));

export function HeroMap() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full [mask-image:linear-gradient(to_right,transparent_5%,black_55%)]"
    >
      {countries.map((c) => (
        <path key={c.key} d={c.d} fill={c.color ?? "#ffffff"} fillOpacity={c.color ? 0.35 : 0.07} stroke="#ffffff" strokeOpacity={0.08} strokeWidth={0.5} />
      ))}
      {dots.map((d, i) => (
        <g key={i} transform={`translate(${d.xy[0]} ${d.xy[1]})`}>
          <circle r={3} fill={d.color}>
            <animate attributeName="r" values="3;14" dur="2.4s" begin={`${d.delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0" dur="2.4s" begin={`${d.delay}s`} repeatCount="indefinite" />
          </circle>
          <circle r={3} fill={d.color} />
        </g>
      ))}
    </svg>
  );
}
