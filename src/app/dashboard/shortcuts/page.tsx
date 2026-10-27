"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/dashboard/store";
import { Card, Empty, PageHeader, btn, input } from "@/components/dashboard/ui";
import { tr } from "@/lib/i18n";
import type { Shortcut } from "@/lib/shortcuts";

export default function ShortcutsPage() {
  const [list, setList] = useState<Shortcut[] | null>(null);
  const [editing, setEditing] = useState<Shortcut | null>(null);
  const [q, setQ] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api<{ shortcuts: Shortcut[] }>("/api/shortcuts")
      .then((d) => setList(d.shortcuts))
      .catch(() => setList([]));
  }, [reload]);

  const shown = (list ?? []).filter((s) => !q || s.shortcut.includes(q.toLowerCase()) || s.body.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title={tr("Respuestas rápidas")} subtitle={tr("Escribe / en un chat para buscarlas e insertarlas")} />
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <div className="border-b border-zinc-100 p-4">
            <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Buscar")} />
          </div>
          {!list && <div className="px-5 py-8 text-center text-sm text-zinc-400">{tr("Cargando…")}</div>}
          {list && shown.length === 0 && <Empty title={tr("Aún no hay respuestas rápidas")}>{tr("Crea la primera con el formulario.")}</Empty>}
          <ul className="divide-y divide-zinc-100">
            {shown.map((s) => (
              <li key={s.id} className="flex items-start gap-4 px-5 py-3">
                <span className="mt-0.5 shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-zinc-900">/{s.shortcut}</span>
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-zinc-700">{s.body}</p>
                <span className="flex shrink-0 gap-3 text-xs">
                  <button className="font-medium text-zinc-700 underline" onClick={() => setEditing(s)}>
                    {tr("Editar")}
                  </button>
                  <button
                    className="font-medium text-zinc-700 underline"
                    onClick={async () => {
                      if (!confirm(tr("¿Eliminar /{shortcut}?", { shortcut: s.shortcut }))) return;
                      await api(`/api/shortcuts/${s.id}`, { method: "DELETE" });
                      setReload((n) => n + 1);
                    }}
                  >
                    {tr("Eliminar")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <ShortcutForm
          key={editing?.id ?? "new"}
          editing={editing}
          onDone={() => {
            setEditing(null);
            setReload((n) => n + 1);
          }}
        />
      </div>
    </>
  );
}

function ShortcutForm({ editing, onDone }: { editing: Shortcut | null; onDone: () => void }) {
  const [shortcut, setShortcut] = useState(editing?.shortcut ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Card title={editing ? tr("Editar respuesta") : tr("Nueva respuesta")} className="h-fit">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            if (editing) await api(`/api/shortcuts/${editing.id}`, { method: "PATCH", body: { shortcut, body } });
            else await api("/api/shortcuts", { body: { shortcut, body } });
            setShortcut("");
            setBody("");
            onDone();
          } catch (e) {
            setErr(e instanceof Error ? e.message : tr("No se pudo guardar"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-xs font-medium text-zinc-600">
          {tr("Atajo")}
          <div className="mt-1 flex items-center gap-1">
            <span className="font-mono text-sm text-zinc-500">/</span>
            <input className={`${input} font-mono`} required value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="envios" />
          </div>
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          {tr("Texto")}
          <textarea
            className={`${input} mt-1`}
            rows={6}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={tr("Hola {nombre}, enviamos en 24-48 h a toda la península.")}
          />
        </label>
        <p className="text-xs text-zinc-500">{tr("Variables: {nombre} = nombre del cliente · {agente} = tu nombre.")}</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button className={btn.primary} disabled={busy}>
            {busy ? tr("Guardando…") : editing ? tr("Guardar cambios") : tr("Crear respuesta")}
          </button>
          {editing && (
            <button type="button" className={btn.secondary} onClick={onDone}>
              {tr("Cancelar")}
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}
