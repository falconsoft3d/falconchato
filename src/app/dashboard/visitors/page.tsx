"use client";

import { tr } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useStore } from "@/components/dashboard/store";
import { Badge, Card, Empty, PageHeader, btn, input } from "@/components/dashboard/ui";
import { WorldMap } from "@/components/dashboard/WorldMap";
import { useNow } from "@/components/dashboard/useNow";
import { browserInfo, flag, shortUrl, timeAgo, visitorName } from "@/lib/format";
import type { LiveVisitor } from "@/lib/types";

export default function VisitorsPage() {
  const { state } = useStore();
  const now = useNow();
  const router = useRouter();
  const [inviting, setInviting] = useState<LiveVisitor | null>(null);

  const all = Object.values(state.visitors).sort((a, b) => a.connected_at.localeCompare(b.connected_at));
  const groups = [
    { title: tr("Chats en curso"), rows: all.filter((v) => v.conversation?.first_response_at) },
    { title: tr("Esperando respuesta"), rows: all.filter((v) => v.conversation && !v.conversation.first_response_at) },
    { title: "Navegando", rows: all.filter((v) => !v.conversation) },
  ];

  return (
    <>
      <PageHeader title={tr("Visitantes en tu web")} subtitle={tr("{n} en línea ahora · se actualiza en tiempo real", { n: all.length })} />
      <div className="space-y-5 p-6">
        {all.length === 0 && (
          <Card>
            <Empty title={tr("No hay visitantes en línea")}>{tr("Abre un sitio con el widget instalado (o la página de demo) y lo verás aparecer aquí.")}</Empty>
          </Card>
        )}
        {groups.map(
          (g) =>
            g.rows.length > 0 && (
              <Card key={g.title} title={`${g.title} · ${g.rows.length}`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                        <th className="px-5 py-2.5 font-medium">{tr("Visitante")}</th>
                        <th className="px-3 py-2.5 font-medium">{tr("Sitio")}</th>
                        <th className="px-3 py-2.5 font-medium">{tr("En línea")}</th>
                        <th className="px-3 py-2.5 font-medium">{tr("Viendo")}</th>
                        <th className="px-3 py-2.5 font-medium">{tr("Procedencia")}</th>
                        <th className="px-3 py-2.5 text-right font-medium">{tr("Visitas")}</th>
                        <th className="px-5 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {g.rows.map((row) => {
                        const { visitor: v, site, conversation } = row;
                        const b = browserInfo(v.user_agent);
                        return (
                          <tr key={v.id} className="hover:bg-zinc-50">
                            <td className="px-5 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-base" title={v.country ?? undefined}>{flag(v.country)}</span>
                                <span className="font-medium">{visitorName(v)}</span>
                                {v.known_by_ip && <Badge tone="amber">{tr("por IP")}</Badge>}
                                {b.mobile && <Badge>{tr("Móvil")}</Badge>}
                              </div>
                              <div className="text-xs text-zinc-400">
                                {b.browser} · {b.os}
                                {v.ip ? ` · ${v.ip}` : ""}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-zinc-600">{site?.name ?? "—"}</td>
                            <td className="px-3 py-2.5 tabular-nums text-zinc-600">{timeAgo(row.connected_at, now)}</td>
                            <td className="max-w-64 px-3 py-2.5">
                              <div className="truncate text-zinc-700" title={v.current_url ?? undefined}>{v.page_title || shortUrl(v.current_url)}</div>
                              <div className="truncate text-xs text-zinc-400">{shortUrl(v.current_url)}</div>
                            </td>
                            <td className="max-w-48 truncate px-3 py-2.5 text-zinc-500">{v.referrer ? shortUrl(v.referrer) : tr("Directo")}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{v.visits}</td>
                            <td className="px-5 py-2.5 text-right">
                              {conversation ? (
                                <button className={btn.secondary} onClick={() => router.push(`/dashboard/chats?c=${conversation.id}`)}>
                                  {tr("Abrir chat")}
                                </button>
                              ) : (
                                <button className={btn.primary} onClick={() => setInviting(row)}>
                                  {tr("Iniciar chat")}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ),
        )}
        <WorldMap />
      </div>
      {inviting && (
        <InviteDialog
          visitor={inviting}
          onClose={() => setInviting(null)}
          onStarted={(id) => router.push(`/dashboard/chats?c=${id}`)}
        />
      )}
    </>
  );
}

// Chat proactivo: el agente escribe primero y el widget del visitante se abre solo.
function InviteDialog({ visitor, onClose, onStarted }: { visitor: LiveVisitor; onClose: () => void; onStarted: (id: number) => void }) {
  const [text, setText] = useState(tr("¡Hola! ¿Te puedo ayudar en algo?"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            const d = await api<{ conversation_id: number }>("/api/conversations", { body: { visitor_id: visitor.visitor.id, body: text } });
            onStarted(d.conversation_id);
          } catch (e) {
            setErr(e instanceof Error ? e.message : tr("No se pudo iniciar"));
            setBusy(false);
          }
        }}
      >
        <h2 className="font-semibold">{tr("Iniciar chat con")} {visitorName(visitor.visitor)}</h2>
        <p className="mt-1 text-sm text-zinc-500">{tr("Está viendo «")}{visitor.visitor.page_title || shortUrl(visitor.visitor.current_url)}».</p>
        <textarea className={`${input} mt-4`} rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btn.secondary} onClick={onClose}>
            {tr("Cancelar")}
          </button>
          <button className={btn.primary} disabled={busy || !text.trim()}>
            {busy ? tr("Enviando…") : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
