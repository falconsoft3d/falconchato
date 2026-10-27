// Piezas visuales reutilizadas por las páginas del panel.

import { initials } from "@/lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 bg-surface px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-zinc-200 bg-surface ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-surface px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1.5 text-3xl font-semibold tabular-nums text-zinc-900">{value}</div>
      {hint && (
        <div className={`mt-1 text-xs ${tone === "warn" ? "font-medium text-zinc-900" : "text-zinc-500"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="text-sm font-medium text-zinc-700">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">{children}</div>}
    </div>
  );
}

const AVATAR_COLORS = ["bg-zinc-800", "bg-zinc-600", "bg-zinc-500", "bg-zinc-700", "bg-zinc-900", "bg-zinc-400"];

export function Avatar({ name, id, size = 36, src }: { name: string; id: number; size?: number; src?: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-zinc-50 ${AVATAR_COLORS[id % AVATAR_COLORS.length]}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "amber" | "red" | "teal" }) {
  const tones = {
    // Solo grises: el tono distingue por contraste, no por color.
    gray: "bg-zinc-100 text-zinc-700",
    green: "bg-zinc-900 text-zinc-50",
    amber: "bg-zinc-200 text-zinc-800",
    red: "bg-surface text-zinc-900 ring-zinc-400",
    teal: "bg-zinc-700 text-zinc-50",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/5 ${tones[tone]}`}>{children}</span>;
}

export const btn = {
  primary: "inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50",
  secondary: "inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-surface px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50",
  danger: "inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-surface px-3.5 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50",
};

export const input = "w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-brand/15";
