"use client";

import { LangSwitch } from "@/components/I18nProvider";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { tr } from "@/lib/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconBell,
  IconBolt,
  IconHelp,
  IconChart,
  IconChat,
  IconClose,
  IconContacts,
  IconDoor,
  IconGlobe,
  IconHistory,
  IconHome,
  IconLogout,
  IconMenu,
  IconSparkle,
  IconTeam,
  IconUsers,
  Logo,
} from "@/components/icons";
import { shortUrl, visitorName } from "@/lib/format";
import type { AgentStatus } from "@/lib/types";
import { useClient } from "@/lib/useClient";
import { StoreProvider, activeConversations, api, useStore } from "./store";

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <Frame>{children}</Frame>
    </StoreProvider>
  );
}

const STATUS: Record<AgentStatus, { label: string; dot: string }> = {
  online: { label: "En línea", dot: "bg-green-500" },
  away: { label: "Ausente", dot: "bg-zinc-400" },
  invisible: { label: "Invisible", dot: "border border-zinc-400 bg-transparent" },
};

function Frame({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const active = activeConversations(state);
  const waiting = active.filter((c) => c.unread > 0).length;
  const live = Object.keys(state.visitors).length;

  const nav = [
    { href: "/dashboard", label: "Inicio", icon: IconHome },
    { href: "/dashboard/visitors", label: "Visitantes", icon: IconUsers, count: live, tone: "muted" },
    { href: "/dashboard/chats", label: "Chats", icon: IconChat, count: waiting || active.length, tone: waiting ? "alert" : "muted" },
    { href: "/dashboard/history", label: "Historial", icon: IconHistory },
    { href: "/dashboard/shortcuts", label: "Respuestas rápidas", icon: IconBolt },
    { href: "/dashboard/faqs", label: "Preguntas frecuentes", icon: IconHelp },
    { href: "/dashboard/contacts", label: "Contactos", icon: IconContacts },
    { href: "/dashboard/analytics", label: tr("Analítica"), icon: IconChart },
    { href: "/dashboard/sites", label: tr("Sitios y widget"), icon: IconGlobe },
    { href: "/dashboard/ai", label: tr("Agentes IA"), icon: IconSparkle },
    { href: "/dashboard/team", label: "Equipo", icon: IconTeam },
  ];

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-ink text-white/85 transition-transform md:static md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <Logo />
          <span className="text-[17px] font-semibold tracking-tight text-white">{tr("falconchato")}</span>
        </div>
        <StatusPicker />
        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2">
          {nav.map((item) => {
            const selected = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setNavOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  selected ? "bg-ink-3 font-medium text-white" : "hover:bg-ink-2 hover:text-white"
                }`}
              >
                <item.icon />
                <span className="flex-1">{tr(item.label)}</span>
                {!!item.count && (
                  <span
                    className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold ${
                      item.tone === "alert" ? "bg-white text-ink" : "bg-white/15 text-white"
                    }`}
                  >
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <NotificationsButton />
        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <LangSwitch dark />
          <ThemeSwitch dark />
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
          <Link
            href="/dashboard/profile"
            onClick={() => setNavOpen(false)}
            title={tr("Mi perfil")}
            className="-m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 hover:bg-ink-2"
          >
          {state.me?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.me.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="grid h-8 w-8 place-items-center rounded-full bg-ink-3 text-xs font-semibold text-white">
              {(state.me?.name ?? state.me?.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm text-white">{state.me?.name ?? "…"}</div>
            <div className="truncate text-xs text-white/50">{state.me?.email}</div>
          </div>
          </Link>
          <button
            title={tr("Cerrar sesión")}
            className="rounded-md p-1.5 hover:bg-white/10"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/login");
            }}
          >
            <IconLogout />
          </button>
        </div>
      </aside>
      {navOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setNavOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-zinc-200 bg-surface px-4 py-2.5 md:hidden">
          <button onClick={() => setNavOpen(true)} className="rounded-md p-1 text-zinc-600" aria-label={tr("Menú")}>
            <IconMenu />
          </button>
          <Logo size={22} />
          <span className="font-semibold">{tr("falconchato")}</span>
        </div>
        {!state.connected && state.ready && (
          <div className="bg-zinc-800 px-4 py-1.5 text-center text-xs text-zinc-50">{tr("Reconectando con el servidor…")}</div>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <KnockToast />
    </div>
  );
}

// "Toc, toc": aviso animado cuando entra un visitante nuevo.
function KnockToast() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const k = state.knock;
  const at = k?.at;
  useEffect(() => {
    if (!at) return;
    const t = setTimeout(() => dispatch({ type: "knock", visitor: null }), 6000);
    return () => clearTimeout(t);
  }, [at, dispatch]);
  if (!k) return null;
  const { visitor, site } = k.visitor;
  return (
    <div key={k.at} className="fc-knock fixed bottom-5 right-5 z-50 w-80 rounded-xl bg-ink p-4 text-white shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
          <IconDoor />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{tr("Toc, toc… nuevo visitante")}</div>
          <div className="mt-0.5 truncate text-xs text-white/70">
            {visitorName(visitor)}
            {visitor.known_by_ip ? tr(" (por IP)") : ""} · {site?.name}
          </div>
          <div className="truncate text-xs text-white/50">{visitor.page_title || shortUrl(visitor.current_url)}</div>
          <button
            onClick={() => {
              dispatch({ type: "knock", visitor: null });
              router.push("/dashboard/visitors");
            }}
            className="mt-2 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-zinc-200"
          >
            {tr("Ver visitante")}
          </button>
        </div>
        <button onClick={() => dispatch({ type: "knock", visitor: null })} className="text-white/50 hover:text-white" aria-label={tr("Cerrar")}>
          <IconClose width={16} height={16} />
        </button>
      </div>
    </div>
  );
}

function StatusPicker() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const status = (state.me?.status === "offline" ? "online" : state.me?.status) ?? "online";
  const current = STATUS[status as AgentStatus];

  return (
    <div className="relative px-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-full bg-ink-2 px-3.5 py-2 text-sm text-white hover:bg-ink-3"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${current.dot}`} />
        <span className="flex-1 text-left">{tr(current.label)}</span>
        <span className="text-white/50">▾</span>
      </button>
      {open && (
        <div className="absolute inset-x-3 top-11 z-10 overflow-hidden rounded-lg bg-surface py-1 text-sm text-zinc-700 shadow-xl">
          {(Object.keys(STATUS) as AgentStatus[]).map((s) => (
            <button
              key={s}
              className="flex w-full items-center gap-2 px-3.5 py-2 hover:bg-zinc-50"
              onClick={async () => {
                setOpen(false);
                const d = await api<{ agent: NonNullable<typeof state.me> }>("/api/me", { method: "PATCH", body: { status: s } });
                dispatch({ type: "me", me: d.agent });
              }}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS[s].dot}`} />
              {tr(STATUS[s].label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationsButton() {
  const initial = useClient(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission), "unsupported");
  const [answer, setPerm] = useState<string | null>(null);
  const perm = answer ?? initial;
  if (perm !== "default") return null;
  return (
    <button
      onClick={async () => setPerm(await Notification.requestPermission())}
      className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-ink-2"
    >
      <IconBell width={16} height={16} />
      {tr("Activar notificaciones")}
    </button>
  );
}
