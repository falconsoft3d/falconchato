// Utilidades de presentación compartidas por el panel y el widget.

import { localeOf, tr } from "./i18n";

export function visitorName(v: { id: number; name?: string | null } | null | undefined) {
  if (!v) return tr("Visitante");
  return v.name?.trim() || tr("Visitante #{id}", { id: v.id });
}

export function conversationName(c: { visitor_id: number; visitor_name: string | null }) {
  return c.visitor_name?.trim() || tr("Visitante #{id}", { id: c.visitor_id });
}

export function initials(name: string) {
  const parts = name.replace(/#\d+/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "V";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString(localeOf(), { hour: "2-digit", minute: "2-digit" });
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(localeOf(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function duration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function shortUrl(url: string | null | undefined) {
  if (!url) return "—";
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

export function browserInfo(ua: string | null | undefined) {
  if (!ua) return { browser: "—", os: "—", mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : tr("Otro");
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "—";
  return { browser, os, mobile: /Mobile|Android|iPhone/.test(ua) };
}

export function flag(country: string | null | undefined) {
  if (!country || !/^[A-Z]{2}$/i.test(country)) return "🌐";
  const cc = country.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
