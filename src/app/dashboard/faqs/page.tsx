"use client";

import { useEffect, useState } from "react";
import { api, useStore } from "@/components/dashboard/store";
import { Badge, Card, Empty, PageHeader, btn, input } from "@/components/dashboard/ui";
import type { Faq } from "@/lib/faqs";
import { tr } from "@/lib/i18n";

export default function FaqsPage() {
  const { state } = useStore();
  const canEdit = state.me?.role === "owner" || state.me?.role === "admin";
  const [list, setList] = useState<Faq[] | null>(null);
  const [site, setSite] = useState("");
  const [editing, setEditing] = useState<Faq | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api<{ faqs: Faq[] }>("/api/faqs")
      .then((d) => setList(d.faqs))
      .catch(() => setList([]));
  }, [reload]);

  const shown = (list ?? []).filter((f) => !site || (site === "all" ? f.site_id === null : f.site_id === Number(site)));
  const siteName = (id: number | null) => (id === null ? tr("Todos los sitios") : (state.sites.find((s) => s.id === id)?.name ?? "—"));

  async function move(f: Faq, dir: -1 | 1) {
    const i = shown.indexOf(f);
    const other = shown[i + dir];
    if (!other) return;
    await Promise.all([
      api(`/api/faqs/${f.id}`, { method: "PATCH", body: { position: other.position } }),
      api(`/api/faqs/${other.id}`, { method: "PATCH", body: { position: f.position === other.position ? f.position + dir : f.position } }),
    ]);
    setReload((n) => n + 1);
  }

  return (
    <>
      <PageHeader title={tr("Preguntas frecuentes")} subtitle={tr("Tus clientes las leen en el widget y la IA las usa para responder")} />
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_400px]">
        <Card
          title={tr("Preguntas")}
          actions={
            <select className="rounded-md border border-zinc-300 bg-surface px-2 py-1 text-xs" value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">{tr("Todas")}</option>
              <option value="all">{tr("Todos los sitios")}</option>
              {state.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          }
        >
          {!list && <div className="px-5 py-8 text-center text-sm text-zinc-400">{tr("Cargando…")}</div>}
          {list && shown.length === 0 && <Empty title={tr("Aún no hay preguntas frecuentes")}>{tr("Crea la primera con el formulario.")}</Empty>}
          <ul className="divide-y divide-zinc-100">
            {shown.map((f, i) => (
              <li key={f.id} className={`flex gap-3 px-5 py-3 ${f.is_active ? "" : "opacity-50"}`}>
                {canEdit && (
                  <div className="flex shrink-0 flex-col text-zinc-400">
                    <button disabled={i === 0} onClick={() => move(f, -1)} className="px-1 hover:text-zinc-900 disabled:opacity-30" aria-label={tr("Subir")}>
                      ▲
                    </button>
                    <button disabled={i === shown.length - 1} onClick={() => move(f, 1)} className="px-1 hover:text-zinc-900 disabled:opacity-30" aria-label={tr("Bajar")}>
                      ▼
                    </button>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900">{f.question}</span>
                    <Badge>{siteName(f.site_id)}</Badge>
                    {!f.is_active && <Badge tone="red">{tr("Oculta")}</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-zinc-600">{f.answer}</p>
                </div>
                {canEdit && (
                  <span className="flex shrink-0 gap-3 text-xs">
                    <button className="font-medium text-zinc-700 underline" onClick={() => setEditing(f)}>
                      {tr("Editar")}
                    </button>
                    <button
                      className="font-medium text-zinc-700 underline"
                      onClick={async () => {
                        if (!confirm(tr("¿Eliminar esta pregunta?"))) return;
                        await api(`/api/faqs/${f.id}`, { method: "DELETE" });
                        setReload((n) => n + 1);
                      }}
                    >
                      {tr("Eliminar")}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
        {canEdit ? (
          <FaqForm
            key={editing?.id ?? "new"}
            editing={editing}
            onDone={() => {
              setEditing(null);
              setReload((n) => n + 1);
            }}
          />
        ) : (
          <Card>
            <Empty title={tr("Solo los administradores editan las preguntas frecuentes")} />
          </Card>
        )}
      </div>
    </>
  );
}

function FaqForm({ editing, onDone }: { editing: Faq | null; onDone: () => void }) {
  const { state } = useStore();
  const [question, setQuestion] = useState(editing?.question ?? "");
  const [answer, setAnswer] = useState(editing?.answer ?? "");
  const [site, setSite] = useState(editing?.site_id ? String(editing.site_id) : "");
  const [active, setActive] = useState(editing?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Card title={editing ? tr("Editar pregunta") : tr("Nueva pregunta")} className="h-fit">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          const body = { question, answer, site_id: site ? Number(site) : null, is_active: active };
          try {
            if (editing) await api(`/api/faqs/${editing.id}`, { method: "PATCH", body });
            else await api("/api/faqs", { body });
            setQuestion("");
            setAnswer("");
            onDone();
          } catch (e) {
            setErr(e instanceof Error ? e.message : tr("No se pudo guardar"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-xs font-medium text-zinc-600">
          {tr("Pregunta")}
          <input className={`${input} mt-1`} required value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={tr("¿Cuánto tarda el envío?")} />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          {tr("Respuesta")}
          <textarea className={`${input} mt-1`} rows={6} required value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </label>
        <label className="block text-xs font-medium text-zinc-600">
          {tr("Sitio")}
          <select className={`${input} mt-1`} value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">{tr("Todos los sitios")}</option>
            {state.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {tr("Visible en el widget")}
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button className={btn.primary} disabled={busy}>
            {busy ? tr("Guardando…") : editing ? tr("Guardar cambios") : tr("Crear pregunta")}
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
