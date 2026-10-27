"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { activeConversations, useStore } from "@/components/dashboard/store";
import { useNow } from "@/components/dashboard/useNow";
import { Avatar, Badge, Card, Empty, PageHeader, Stat, btn } from "@/components/dashboard/ui";
import { conversationName, flag, shortUrl, timeAgo, visitorName } from "@/lib/format";

export default function HomePage() {
  const { state } = useStore();
  const now = useNow();
  const active = activeConversations(state);
  const waiting = active.filter((c) => !c.first_response_at);
  const visitors = Object.values(state.visitors);
  const agentsOnline = state.agents.filter((a) => a.status === "online").length;

  return (
    <>
      <PageHeader title={`Hola${state.me?.name ? `, ${state.me.name}` : ""}`} subtitle={tr("Lo que está pasando ahora en tus sitios")} />
      <div className="space-y-6 p-6">
        {state.ready && state.sites.length === 0 && (
          <Card className="border-zinc-300">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <h2 className="font-semibold text-zinc-900">{tr("Instala falconchato en tu primer sitio")}</h2>
                <p className="mt-0.5 text-sm text-zinc-600">{tr("Crea un sitio, copia el código y pégalo antes de </body>.")}</p>
              </div>
              <Link href="/dashboard/sites" className={btn.primary}>
                {tr("Crear sitio")}
              </Link>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label={tr("Visitantes en línea")} value={visitors.length} />
          <Stat label={tr("Chats activos")} value={active.length} />
          <Stat
            label={tr("Esperando respuesta")}
            value={waiting.length}
            tone={waiting.length ? "warn" : undefined}
            hint={waiting.length ? tr("Responde cuanto antes") : tr("Todo al día")}
          />
          <Stat label={tr("Agentes en línea")} value={agentsOnline} hint={agentsOnline ? undefined : tr("El widget muestra el formulario offline")} tone={agentsOnline ? undefined : "warn"} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={tr("Chats en curso")} actions={<Link href="/dashboard/chats" className="text-xs font-medium text-zinc-900">{tr("Ver todos")}</Link>}>
            {active.length === 0 ? (
              <Empty title={tr("No hay chats abiertos")}>{tr("Cuando un visitante escriba aparecerá aquí al instante.")}</Empty>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {active.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link href={`/dashboard/chats?c=${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                      <Avatar name={conversationName(c)} id={c.visitor_id} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{conversationName(c)}</span>
                          {c.status === "offline" && <Badge tone="amber">{tr("Offline")}</Badge>}
                          {c.unread > 0 && <Badge tone="red">{c.unread} {tr(c.unread > 1 ? "nuevos" : "nuevo")}</Badge>}
                        </div>
                        <div className="truncate text-sm text-zinc-500">{c.last_message}</div>
                      </div>
                      <span className="text-xs text-zinc-400">{timeAgo(c.last_message_at, now)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={tr("Visitantes ahora")} actions={<Link href="/dashboard/visitors" className="text-xs font-medium text-zinc-900">{tr("Ver todos")}</Link>}>
            {visitors.length === 0 ? (
              <Empty title={tr("Nadie navegando ahora mismo")} />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {visitors.slice(0, 6).map(({ visitor, site }) => (
                  <li key={visitor.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-lg">{flag(visitor.country)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{visitorName(visitor)}</div>
                      <div className="truncate text-xs text-zinc-500">
                        {site?.name} · {visitor.page_title || shortUrl(visitor.current_url)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
