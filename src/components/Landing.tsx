"use client";

import { LangSwitch } from "@/components/I18nProvider";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { tr } from "@/lib/i18n";
import Link from "next/link";
import { Logo } from "@/components/icons";
import { HeroMap } from "@/components/HeroMap";
import { OpenChatButton } from "@/components/OpenChatButton";

const FEATURES = [
  ["Tiempo real de verdad", "Los mensajes viajan por Server-Sent Events: llegan en milisegundos, con indicador de «escribiendo» y vista previa de lo que teclea el visitante."],
  ["Visitantes en vivo", "Mira quién está en tu web, qué página ve y de dónde viene. Inicia tú el chat cuando quieras."],
  ["Un widget por sitio", "Colores, textos y posición para cada web. Se instala con una sola línea de código."],
  ["Mensajes offline", "Si no hay nadie conectado, el widget recoge nombre, email y mensaje."],
  ["Historial y analítica", "Busca cualquier conversación y mide chats atendidos, perdidos, espera y satisfacción."],
  ["Listo para móvil", "La misma API sirve al panel web y a tu futura app móvil (token Bearer + SSE)."],
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="relative overflow-hidden bg-ink text-white">
        <HeroMap />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-semibold tracking-tight">{tr("falconchato")}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitch dark />
          <span className="hidden sm:inline-flex">
            <ThemeSwitch dark />
          </span>
          <Link href="/login" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20">
            {tr("Entrar")}
          </Link>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-14">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {tr("Chat en vivo para tus sitios web,")} <span className="text-zinc-400">{tr("al instante.")}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">
            {tr("Habla con tus visitantes mientras navegan. Un widget ligero en tus webs y un panel para tu equipo, sobre falcondatabase.")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-ink hover:bg-zinc-200">
              {tr("Ir al panel")}
            </Link>
            <Link href="/demo" className="rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold hover:bg-white/10">
              {tr("Ver la demo del widget")}
            </Link>
            <OpenChatButton className="rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold hover:bg-white/10">
              {tr("Hablar con soporte")}
            </OpenChatButton>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([title, text]) => (
          <div key={title} className="rounded-xl border border-zinc-200 p-6">
            <h2 className="font-semibold text-zinc-900">{tr(title)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{tr(text)}</p>
          </div>
        ))}
      </main>
    </div>
  );
}
