"use client";

// Idioma de la interfaz (ES/EN): guardado en el navegador o el del sistema.
// Al cambiarlo se vuelve a montar la app para que todo se repinte traducido.

import { Fragment, createContext, use, useEffect, useSyncExternalStore } from "react";
import { type Lang, detectLang, setCurrentLang } from "@/lib/i18n";

const listeners = new Set<() => void>();
let lang: Lang | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapshot(): Lang {
  return (lang ??= detectLang());
}

export function setLang(next: Lang) {
  lang = next;
  try {
    localStorage.setItem("fc_lang", next);
  } catch {}
  listeners.forEach((l) => l());
}

const LangContext = createContext<Lang>("es");

export function useLang() {
  return use(LangContext);
}

export function I18nProvider({ children, fixed }: { children: React.ReactNode; fixed?: Lang }) {
  const detected = useSyncExternalStore(subscribe, snapshot, () => "es" as Lang);
  const value = fixed ?? detected;
  // Se fija antes de pintar a los hijos: tr() lee este valor.
  setCurrentLang(value);
  useEffect(() => {
    document.documentElement.lang = value;
  }, [value]);
  return (
    <LangContext value={value}>
      <Fragment key={value}>{children}</Fragment>
    </LangContext>
  );
}

export function LangSwitch({ className = "", dark }: { className?: string; dark?: boolean }) {
  const current = useLang();
  return (
    <div className={`inline-flex rounded-full p-0.5 text-xs font-medium ${dark ? "bg-white/10" : "bg-zinc-100"} ${className}`}>
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-full px-2.5 py-1 uppercase transition ${
            current === l ? (dark ? "bg-white text-ink" : "bg-zinc-900 text-zinc-50") : dark ? "text-white/70 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
          }`}
          aria-pressed={current === l}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
