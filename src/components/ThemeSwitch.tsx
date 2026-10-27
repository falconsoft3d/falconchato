"use client";

// Tema claro / oscuro / sistema. Se guarda en el navegador y se aplica con la
// clase `dark` en <html> (un script en el layout lo pone antes de pintar).

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { tr } from "@/lib/i18n";

export type Theme = "light" | "dark" | "system";
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const t = localStorage.getItem("fc_theme");
    if (t === "light" || t === "dark") return t;
  } catch {}
  return "system";
}

// Páginas que se quedan siempre en claro.
const lightOnly = (path: string) => path.startsWith("/widget") || path.startsWith("/demo");

export function applyTheme(theme: Theme, path = location.pathname) {
  const dark = !lightOnly(path) && (theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches));
  document.documentElement.classList.toggle("dark", dark);
}

function setTheme(theme: Theme) {
  try {
    localStorage.setItem("fc_theme", theme);
  } catch {}
  applyTheme(theme);
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useTheme() {
  return useSyncExternalStore(subscribe, read, () => "system" as Theme);
}

// Mantiene el tema al navegar y si cambia el del sistema.
export function ThemeSync() {
  const pathname = usePathname();
  const theme = useTheme();
  useEffect(() => {
    applyTheme(theme, pathname);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system", pathname);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme, pathname]);
  return null;
}

const ICONS: Record<Theme, React.ReactNode> = {
  light: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  dark: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  ),
  system: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
};
const LABEL: Record<Theme, string> = { light: "Claro", dark: "Oscuro", system: "Sistema" };

export function ThemeSwitch({ dark: onDark, className = "" }: { dark?: boolean; className?: string }) {
  const theme = useTheme();
  return (
    <div className={`inline-flex rounded-full p-0.5 ${onDark ? "bg-white/10" : "bg-zinc-100"} ${className}`} role="group" aria-label={tr("Tema")}>
      {(["light", "dark", "system"] as Theme[]).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          title={tr(LABEL[t])}
          aria-label={tr(LABEL[t])}
          aria-pressed={theme === t}
          className={`grid h-6 w-7 place-items-center rounded-full transition ${
            theme === t
              ? onDark
                ? "bg-white text-ink"
                : "bg-zinc-900 text-zinc-50"
              : onDark
                ? "text-white/70 hover:text-white"
                : "text-zinc-500 hover:text-zinc-900"
          }`}
        >
          {ICONS[t]}
        </button>
      ))}
    </div>
  );
}
