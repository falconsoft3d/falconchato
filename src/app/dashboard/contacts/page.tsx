"use client";

import { tr } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconClose, IconPlus, IconSearch } from "@/components/icons";
import { ContactForm, STATUS_LABEL, emptyContact, type ContactFields } from "@/components/dashboard/ContactForm";
import { api, useStore } from "@/components/dashboard/store";
import { Avatar, Badge, Card, Empty, PageHeader, btn, input } from "@/components/dashboard/ui";
import { dateTime } from "@/lib/format";
import type { Contact, ContactStatus, Conversation } from "@/lib/types";

const TONE: Record<ContactStatus, "gray" | "green" | "amber" | "red"> = { lead: "amber", qualified: "gray", customer: "green", lost: "red" };

export default function ContactsPage() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [site, setSite] = useState("");
  const [applied, setApplied] = useState({ q: "", status: "", site: "" });
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ contacts: Contact[]; count: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Contact | "new" | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page) });
    for (const [k, v] of Object.entries(applied)) if (v) qs.set(k, v);
    let cancelled = false;
    api<{ contacts: Contact[]; count: number; pageSize: number }>(`/api/contacts?${qs}`)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [applied, page, reload]);

  const pages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title={tr("Contactos")}
        subtitle={data ? tr("{n} contactos en tu CRM", { n: data.count }) : tr("Tu CRM: clientes y leads de todas tus webs")}
        actions={
          <button className={btn.primary} onClick={() => setOpen("new")}>
            <IconPlus width={16} height={16} /> {tr("Nuevo contacto")}
          </button>
        }
      />
      <div className="space-y-4 p-6">
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setApplied({ q, status, site });
          }}
        >
          <label className="min-w-56 flex-1 text-xs text-zinc-500">
            {tr("Buscar")}
            <div className="relative mt-1">
              <IconSearch className="absolute left-2.5 top-2.5 text-zinc-400" width={16} height={16} />
              <input className={`${input} pl-8`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Nombre, email, teléfono, empresa, notas…")} />
            </div>
          </label>
          <label className="text-xs text-zinc-500">
            {tr("Estado")}
            <select className={`${input} mt-1`} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{tr("Todos")}</option>
              {(Object.keys(STATUS_LABEL) as ContactStatus[]).map((s) => (
                <option key={s} value={s}>
                  {tr(STATUS_LABEL[s])}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            {tr("Sitio")}
            <select className={`${input} mt-1`} value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">{tr("Todos")}</option>
              {state.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button className={btn.primary}>{tr("Filtrar")}</button>
        </form>

        <Card>
          {error && <div className="px-5 py-3 text-sm text-red-600">{error}</div>}
          {!data && !error && <div className="px-5 py-10 text-center text-sm text-zinc-400">{tr("Cargando…")}</div>}
          {data && data.contacts.length === 0 && (
            <Empty title={tr("Sin contactos todavía")}>{tr("Se crean solos cuando un cliente deja sus datos en el chat, la IA los guarda o los editas desde la ficha del chat.")}</Empty>
          )}
          {data && data.contacts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-5 py-2.5 font-medium">{tr("Contacto")}</th>
                    <th className="px-3 py-2.5 font-medium">{tr("Teléfono")}</th>
                    <th className="px-3 py-2.5 font-medium">{tr("Empresa")}</th>
                    <th className="px-3 py-2.5 font-medium">{tr("Estado")}</th>
                    <th className="px-3 py-2.5 font-medium">{tr("Sitio")}</th>
                    <th className="px-5 py-2.5 font-medium">{tr("Actualizado")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.contacts.map((c) => (
                    <tr key={c.id} onClick={() => setOpen(c)} className="cursor-pointer hover:bg-zinc-50">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name || c.email || "?"} id={c.id} size={30} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{c.name || tr("Sin nombre")}</div>
                            <div className="truncate text-xs text-zinc-500">{c.email ?? "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-600">{c.phone ?? "—"}</td>
                      <td className="px-3 py-2.5 text-zinc-600">{c.company ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={TONE[c.status] ?? "gray"}>{tr(STATUS_LABEL[c.status] ?? c.status)}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-600">{state.sites.find((s) => s.id === c.site_id)?.name ?? "—"}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-zinc-500">{dateTime(c.updated_at ?? c.created_at)}</td>
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
      {open && (
        <ContactDrawer
          contact={open === "new" ? null : open}
          onClose={() => setOpen(null)}
          onChanged={() => setReload((n) => n + 1)}
        />
      )}
    </>
  );
}

function ContactDrawer({ contact, onClose, onChanged }: { contact: Contact | null; onClose: () => void; onChanged: () => void }) {
  const { state } = useStore();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const isAdmin = state.me?.role === "owner" || state.me?.role === "admin";

  useEffect(() => {
    if (!contact) return;
    api<{ conversations: Conversation[] }>(`/api/contacts/${contact.id}`)
      .then((d) => setConvs(d.conversations))
      .catch(() => setConvs([]));
  }, [contact]);

  async function save(f: ContactFields) {
    if (contact) await api(`/api/contacts/${contact.id}`, { method: "PATCH", body: f });
    else await api("/api/contacts", { body: f });
    onChanged();
    if (!contact) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{contact ? contact.name || contact.email || "Contacto" : tr("Nuevo contacto")}</div>
            {contact && <div className="text-xs text-zinc-500">{tr("Creado")} {dateTime(contact.created_at)}</div>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label={tr("Cerrar")}>
            <IconClose />
          </button>
        </div>
        <div className="p-5">
          <ContactForm initial={contact ? { ...contact } : emptyContact()} onSave={save} />
        </div>
        {contact && (
          <div className="border-t border-zinc-100 px-5 py-4">
            <h3 className="text-sm font-semibold">{tr("Conversaciones")}</h3>
            {!contact.visitor_id && <p className="mt-2 text-sm text-zinc-500">{tr("Contacto creado a mano, sin chats.")}</p>}
            {contact.visitor_id && !convs && <p className="mt-2 text-sm text-zinc-400">{tr("Cargando…")}</p>}
            {convs?.length === 0 && contact.visitor_id && <p className="mt-2 text-sm text-zinc-500">{tr("Sin conversaciones.")}</p>}
            <ul className="mt-2 divide-y divide-zinc-100">
              {convs?.map((c) => (
                <li key={c.id}>
                  <Link href={`/dashboard/chats?c=${c.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:bg-zinc-50">
                    <span className="w-28 shrink-0 text-xs text-zinc-500">{dateTime(c.created_at)}</span>
                    <span className="flex-1 truncate text-zinc-700">{c.last_message ?? "—"}</span>
                    {c.goals_met && <Badge tone="green">✓ {c.goals_met}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {contact && isAdmin && (
          <div className="mt-auto border-t border-zinc-100 px-5 py-4">
            <button
              className={btn.danger}
              onClick={async () => {
                if (!confirm(tr("¿Eliminar este contacto del CRM?"))) return;
                await api(`/api/contacts/${contact.id}`, { method: "DELETE" });
                onChanged();
                onClose();
              }}
            >
              {tr("Eliminar contacto")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
