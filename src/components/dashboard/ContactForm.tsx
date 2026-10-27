"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import type { Contact, ContactStatus } from "@/lib/types";
import { btn, input } from "./ui";

export const STATUS_LABEL: Record<ContactStatus, string> = {
  lead: "Lead",
  qualified: "Cualificado",
  customer: "Cliente",
  lost: "Perdido",
};

export type ContactFields = Pick<Contact, "name" | "email" | "phone" | "company" | "status" | "tags" | "notes">;

export function emptyContact(partial?: Partial<ContactFields>): ContactFields {
  return { name: "", email: "", phone: "", company: "", status: "lead", tags: "", notes: "", ...partial };
}

// Formulario del contacto del CRM (ficha del chat y página Contactos).
export function ContactForm({
  initial,
  onSave,
  compact,
}: {
  initial: ContactFields;
  onSave: (fields: ContactFields) => Promise<void>;
  compact?: boolean;
}) {
  const [f, setF] = useState<ContactFields>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof ContactFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });
  const field = "block text-xs text-zinc-500";

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await onSave(f);
          setMsg({ ok: true, text: tr("Guardado en el CRM") });
        } catch (err) {
          setMsg({ ok: false, text: err instanceof Error ? err.message : tr("No se pudo guardar") });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className={compact ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
        <label className={field}>
          {tr("Nombre")}
          <input className={`${input} mt-1`} value={f.name ?? ""} onChange={set("name")} />
        </label>
        <label className={field}>
          {tr("Email")}
          <input type="email" className={`${input} mt-1`} value={f.email ?? ""} onChange={set("email")} />
        </label>
        <label className={field}>
          {tr("Teléfono")}
          <input className={`${input} mt-1`} value={f.phone ?? ""} onChange={set("phone")} />
        </label>
        <label className={field}>
          {tr("Empresa")}
          <input className={`${input} mt-1`} value={f.company ?? ""} onChange={set("company")} />
        </label>
        <label className={field}>
          {tr("Estado")}
          <select className={`${input} mt-1`} value={f.status} onChange={set("status")}>
            {(Object.keys(STATUS_LABEL) as ContactStatus[]).map((s) => (
              <option key={s} value={s}>
                {tr(STATUS_LABEL[s])}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          {tr("Etiquetas")}
          <input className={`${input} mt-1`} value={f.tags ?? ""} onChange={set("tags")} placeholder={tr("vip, mayorista")} />
        </label>
      </div>
      <label className={field}>
        {tr("Notas")}
        <textarea className={`${input} mt-1`} rows={compact ? 3 : 4} value={f.notes ?? ""} onChange={set("notes")} />
      </label>
      <div className="flex items-center gap-3">
        <button className={btn.primary} disabled={busy}>
          {busy ? tr("Guardando…") : tr("Guardar contacto")}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? "text-zinc-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
