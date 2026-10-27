"use client";

import { tr, trSystem } from "@/lib/i18n";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Face, IconClose, IconSearch } from "@/components/icons";
import { Attachment } from "@/components/dashboard/Attachment";
import { api, useStore, type Msg } from "@/components/dashboard/store";
import { Badge, Card, Empty, PageHeader, btn, input } from "@/components/dashboard/ui";
import { clock, conversationName, dateTime } from "@/lib/format";
import type { Conversation } from "@/lib/types";

type Filters = { q: string; status: string; rating: string; site: string; from: string; to: string };

export default function HistoryPage() {
  return (
    <Suspense>
      <History />
    </Suspense>
  );
}

function statusBadge(c: Conversation) {
  if (c.status === "open") return <Badge tone="green">{tr("En curso")}</Badge>;
  if (c.status === "offline") return <Badge tone="amber">{tr("Offline")}</Badge>;
  return c.first_response_at ? <Badge tone="teal">{tr("Atendido")}</Badge> : <Badge tone="red">{tr("Perdido")}</Badge>;
}

function History() {
  const { state } = useStore();
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>({ q: params.get("q") ?? "", status: "", rating: "", site: "", from: "", to: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ conversations: Conversation[]; count: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Conversation | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ scope: "history", page: String(page) });
    for (const [k, v] of Object.entries(applied)) if (v) qs.set(k, v);
    let cancelled = false;
    api<{ conversations: Conversation[]; count: number; pageSize: number }>(`/api/conversations?${qs}`)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [applied, page]);

  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters({ ...filters, [k]: e.target.value });
  const pages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title={tr("Historial")} subtitle={data ? tr("{n} chats", { n: data.count }) : tr("Todos los chats de tus sitios")} />
      <div className="space-y-4 p-6">
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setApplied(filters);
          }}
        >
          <label className="min-w-56 flex-1 text-xs text-zinc-500">
            {tr("Buscar")}
            <div className="relative mt-1">
              <IconSearch className="absolute left-2.5 top-2.5 text-zinc-400" width={16} height={16} />
              <input className={`${input} pl-8`} value={filters.q} onChange={set("q")} placeholder={tr("Nombre, email, mensaje, etiqueta o #id")} />
            </div>
          </label>
          <label className="text-xs text-zinc-500">
            {tr("Estado")}
            <select className={`${input} mt-1`} value={filters.status} onChange={set("status")}>
              <option value="">{tr("Todos")}</option>
              <option value="served">{tr("Atendidos")}</option>
              <option value="missed">{tr("Perdidos")}</option>
              <option value="offline">{tr("Offline")}</option>
              <option value="open">{tr("En curso")}</option>
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            {tr("Valoración")}
            <select className={`${input} mt-1`} value={filters.rating} onChange={set("rating")}>
              <option value="">{tr("Cualquiera")}</option>
              <option value="good">{tr("Contento")}</option>
              <option value="neutral">{tr("Normal")}</option>
              <option value="bad">{tr("Descontento")}</option>
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            {tr("Sitio")}
            <select className={`${input} mt-1`} value={filters.site} onChange={set("site")}>
              <option value="">{tr("Todos")}</option>
              {state.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            {tr("Desde")}
            <input type="date" className={`${input} mt-1`} value={filters.from} onChange={set("from")} />
          </label>
          <label className="text-xs text-zinc-500">
            {tr("Hasta")}
            <input type="date" className={`${input} mt-1`} value={filters.to} onChange={set("to")} />
          </label>
          <button className={btn.primary}>{tr("Filtrar")}</button>
          <button
            type="button"
            className={btn.secondary}
            onClick={() => {
              const empty = { q: "", status: "", rating: "", site: "", from: "", to: "" };
              setFilters(empty);
              setApplied(empty);
              setPage(0);
            }}
          >
            {tr("Limpiar")}
          </button>
        </form>

        <Card>
          {error && <div className="px-5 py-3 text-sm text-red-600">{error}</div>}
          {!data && !error && <div className="px-5 py-10 text-center text-sm text-zinc-400">{tr("Cargando…")}</div>}
          {data && data.conversations.length === 0 && <Empty title={tr("No hay chats con esos filtros")} />}
          {data && data.conversations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-5 py-2.5 font-medium">{tr("Fecha")}</th>
                    <th className="px-3 py-2.5 font-medium">{tr("Visitante")}</th>
                    <th className="px-3 py-2.5 font-medium">{tr("Sitio")}</th>
                    <th className="px-3 py-2.5 font-medium">{tr("Último mensaje")}</th>
                    <th className="px-3 py-2.5 font-medium">{tr("Estado")}</th>
                    <th className="px-3 py-2.5 font-medium">{tr("Valoración")}</th>
                    <th className="px-5 py-2.5 font-medium">{tr("Etiquetas")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.conversations.map((c) => (
                    <tr key={c.id} onClick={() => setOpen(c)} className="cursor-pointer hover:bg-zinc-50">
                      <td className="whitespace-nowrap px-5 py-2.5 text-zinc-600">{dateTime(c.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{conversationName(c)}</div>
                        {c.visitor_email && <div className="text-xs text-zinc-400">{c.visitor_email}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-600">{state.sites.find((s) => s.id === c.site_id)?.name ?? "—"}</td>
                      <td className="max-w-72 truncate px-3 py-2.5 text-zinc-500">{c.last_message ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {statusBadge(c)}
                          {c.ai_agent_id && <Badge>{tr("IA")}</Badge>}
                        </div>
                        {c.goals_met && <div className="mt-1 text-xs text-zinc-500">✓ {c.goals_met}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.rating ? (
                          <span className="flex items-center gap-1.5" title={c.rating_comment ?? undefined}>
                            <Face mood={c.rating} width={20} height={20} className="text-zinc-700" />
                            {c.rating_comment && <span className="max-w-40 truncate text-xs text-zinc-500">«{c.rating_comment}»</span>}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-zinc-500">{c.tags ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && pages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-sm">
              <span className="text-zinc-500">
                {tr("Página")} {page + 1} {tr("de")} {pages}
              </span>
              <div className="flex gap-2">
                <button className={btn.secondary} disabled={page === 0} onClick={() => setPage(page - 1)}>
                  {tr("Anterior")}
                </button>
                <button className={btn.secondary} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                  {tr("Siguiente")}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
      {open && <Transcript conv={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Transcript({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[] | null>(null);
  useEffect(() => {
    api<{ messages: Msg[] }>(`/api/conversations/${conv.id}`)
      .then((d) => setMessages(d.messages))
      .catch(() => setMessages([]));
  }, [conv.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{conversationName(conv)}</div>
            <div className="text-xs text-zinc-500">
              {dateTime(conv.created_at)} · {statusBadge(conv)}
            </div>
            {conv.rating && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600">
                <Face mood={conv.rating} width={16} height={16} />
                {conv.rating_comment ? `«${conv.rating_comment}»` : tr("Sin comentario")}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label={tr("Cerrar")}>
            <IconClose />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 px-5 py-4">
          {!messages && <div className="text-center text-sm text-zinc-400">{tr("Cargando…")}</div>}
          {messages?.map((m) =>
            m.sender === "system" ? (
              <div key={m.client_id} className="text-center text-xs text-zinc-400">
                {trSystem(m.body)}
              </div>
            ) : (
              <div key={m.client_id} className={`flex flex-col ${m.sender === "agent" ? "items-end" : "items-start"}`}>
                {m.attachment && <Attachment src={m.attachment} />}
                {m.body && (
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                      m.sender === "agent"
                        ? "rounded-br-md bg-brand text-white"
                        : m.sender === "bot"
                          ? "rounded-br-md border border-green-200 bg-green-50 text-green-950"
                          : "rounded-bl-md bg-surface shadow-sm"
                    }`}
                  >
                    {m.body}
                  </div>
                )}
                <span className="mt-0.5 text-[11px] text-zinc-400">
                  {m.sender === "agent" && m.author_name ? `${m.author_name} · ` : ""}
                  {clock(m.created_at)}
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
