"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { IconChat, IconCopy, IconMinus, IconPlus } from "@/components/icons";
import { api, useStore } from "@/components/dashboard/store";
import { Card, Empty, PageHeader, btn, input } from "@/components/dashboard/ui";
import type { AiMode, Site } from "@/lib/types";
import { AiAvatar } from "@/components/dashboard/AiAvatar";
import { useClient } from "@/lib/useClient";

type Draft = Pick<
  Site,
  | "name"
  | "domain"
  | "color"
  | "title"
  | "welcome_message"
  | "offline_message"
  | "position"
  | "is_active"
  | "agent_ids"
  | "ai_agent_ids"
  | "ai_mode"
  | "goals"
  | "auto_message"
  | "auto_message_delay"
  | "matrix_effect"
>;
type TeamMember = { id: number; name: string | null; email: string; role: string; disabled: boolean };

const AI_MODES: [AiMode, string, string][] = [
  ["off", "Desactivada", "Solo atienden personas."],
  ["offline", "Cuando no hay nadie", "La IA responde si no hay agentes asignados en línea."],
  ["always", "Siempre primero", "La IA atiende cada chat y pasa a una persona cuando hace falta."],
];

const NEW: Draft = {
  name: "",
  domain: "",
  color: "#27272a",
  title: "Chatea con nosotros",
  welcome_message: "¡Hola! ¿En qué podemos ayudarte?",
  offline_message: "Ahora no hay nadie conectado. Déjanos tu mensaje y te responderemos por email.",
  position: "right",
  is_active: true,
  agent_ids: [],
  ai_agent_ids: [],
  ai_mode: "off",
  goals: [],
  auto_message: "",
  auto_message_delay: 5,
  matrix_effect: true,
};

const SWATCHES = ["#09090b", "#18181b", "#27272a", "#3f3f46", "#52525b", "#71717a"];

export default function SitesPage() {
  const { state, refreshSites } = useStore();
  const canEdit = state.me?.role === "owner" || state.me?.role === "admin";
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const current = selected === "new" ? null : (state.sites.find((s) => s.id === selected) ?? state.sites[0] ?? null);
  const editing = selected === "new" || (state.ready && state.sites.length === 0 && canEdit);

  return (
    <>
      <PageHeader
        title={tr("Sitios y widget")}
        subtitle={tr("Cada sitio tiene su propio widget, colores y mensajes")}
        actions={
          canEdit && (
            <button className={btn.primary} onClick={() => setSelected("new")}>
              <IconPlus width={16} height={16} /> {tr("Nuevo sitio")}
            </button>
          )
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit">
          <ul className="p-2">
            {state.sites.length === 0 && <li className="px-3 py-2 text-sm text-zinc-400">{tr("Aún no hay sitios")}</li>}
            {state.sites.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSelected(s.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${
                    !editing && current?.id === s.id ? "bg-zinc-100 font-medium text-zinc-900" : "hover:bg-zinc-50"
                  }`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 truncate">{s.name}</span>
                  {!s.is_active && <span className="text-xs text-zinc-400">{tr("pausado")}</span>}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {editing ? (
          <SiteEditor
            key="new"
            site={null}
            canEdit={canEdit}
            onSaved={async (s) => {
              await refreshSites();
              setSelected(s.id);
            }}
          />
        ) : current ? (
          <SiteEditor key={current.id} site={current} canEdit={canEdit} onSaved={() => refreshSites()} onDeleted={async () => { await refreshSites(); setSelected(null); }} />
        ) : (
          <Card>
            <Empty title={tr("No hay sitios")}>{tr("Pide a un administrador que cree el primero.")}</Empty>
          </Card>
        )}
      </div>
    </>
  );
}

function SiteEditor({
  site,
  canEdit,
  onSaved,
  onDeleted,
}: {
  site: Site | null;
  canEdit: boolean;
  onSaved: (s: Site) => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(
    site
      ? {
          ...site,
          domain: site.domain ?? "",
          agent_ids: site.agent_ids ?? [],
          ai_agent_ids: site.ai_agent_ids ?? [],
          ai_mode: site.ai_mode ?? "off",
          goals: site.goals ?? [],
          auto_message: site.auto_message ?? "",
          auto_message_delay: site.auto_message_delay ?? 5,
          matrix_effect: site.matrix_effect ?? true,
        }
      : NEW,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const d = site
        ? await api<{ site: Site }>(`/api/sites/${site.id}`, { method: "PATCH", body: draft })
        : await api<{ site: Site }>("/api/sites", { body: draft });
      await onSaved(d.site);
      setMsg({ ok: true, text: site ? tr("Cambios guardados. Los widgets abiertos se actualizan al momento.") : tr("Sitio creado. Copia el código de abajo.") });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : tr("No se pudo guardar") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {site && <EmbedCode site={site} />}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title={site ? tr("Personalizar widget") : tr("Nuevo sitio")}>
          <form onSubmit={save} className="space-y-4 p-5">
            <fieldset disabled={!canEdit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={tr("Nombre del sitio *")}>
                  <input className={input} required value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder={tr("Mi tienda")} />
                </Field>
                <Field label={tr("Dominio")}>
                  <input className={input} value={draft.domain ?? ""} onChange={(e) => set("domain", e.target.value)} placeholder={tr("mitienda.com")} />
                </Field>
              </div>
              <Field label={tr("Título del widget")}>
                <input className={input} value={draft.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label={tr("Mensaje de bienvenida")}>
                <textarea className={input} rows={2} value={draft.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} />
              </Field>
              <Field label={tr("Mensaje cuando no hay agentes")}>
                <textarea className={input} rows={2} value={draft.offline_message} onChange={(e) => set("offline_message", e.target.value)} />
              </Field>
              <div className="rounded-lg border border-zinc-200 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
                  <Field label={tr("Mensaje automático (vacío = desactivado)")}>
                    <textarea
                      className={input}
                      rows={2}
                      value={draft.auto_message ?? ""}
                      onChange={(e) => set("auto_message", e.target.value)}
                      placeholder={tr("¡Gracias por visitarnos! Si quieres una cotización, déjanos tus datos aquí: https://…")}
                    />
                  </Field>
                  <Field label={tr("Aparece a los (s)")}>
                    <input
                      type="number"
                      min={0}
                      max={600}
                      className={input}
                      value={draft.auto_message_delay ?? 5}
                      onChange={(e) => set("auto_message_delay", Number(e.target.value))}
                    />
                  </Field>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {tr("Sale en una burbuja sobre el botón con un contador, y la pestaña del navegador alterna «(1) Tienes un mensaje nuevo» con el nombre de la web. Como mucho una vez al día por visitante.")}
                </p>
              </div>
              <Field label={tr("Color")}>
                <div className="flex flex-wrap items-center gap-2">
                  {SWATCHES.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => set("color", c)}
                      className={`h-8 w-8 rounded-full ring-offset-2 ${draft.color === c ? "ring-2 ring-zinc-900" : ""}`}
                      style={{ background: c }}
                      aria-label={c}
                    />
                  ))}
                  <input type="color" value={draft.color} onChange={(e) => set("color", e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-zinc-300" />
                </div>
              </Field>
              <div className="flex flex-wrap gap-6">
                <Field label={tr("Posición")}>
                  <div className="flex gap-2">
                    {(["left", "right"] as const).map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => set("position", p)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${draft.position === p ? "border-zinc-900 bg-zinc-100 text-zinc-900" : "border-zinc-300"}`}
                      >
                        {tr(p === "left" ? "Izquierda" : "Derecha")}
                      </button>
                    ))}
                  </div>
                </Field>
                <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
                  <input type="checkbox" checked={draft.is_active} onChange={(e) => set("is_active", e.target.checked)} />
                  {tr("Widget activo")}
                </label>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3">
                <input type="checkbox" className="mt-0.5" checked={draft.matrix_effect ?? true} onChange={(e) => set("matrix_effect", e.target.checked)} />
                <span>
                  <span className="block text-sm font-medium text-zinc-900">{tr("Efecto Matrix en el fondo del chat")}</span>
                  <span className="block text-xs text-zinc-500">
                    {tr("Lluvia de caracteres al abrir el chat; luego queda muy tenue. Desmárcalo para un fondo liso.")}
                  </span>
                </span>
              </label>
              <Assignments draft={draft} set={set} />
            </fieldset>
            {msg && <p className={`text-sm ${msg.ok ? "text-zinc-700" : "text-red-600"}`}>{msg.text}</p>}
            {canEdit && (
              <div className="flex justify-between gap-2 pt-1">
                <button className={btn.primary} disabled={busy}>
                  {busy ? tr("Guardando…") : site ? tr("Guardar cambios") : tr("Crear sitio")}
                </button>
                {site && onDeleted && (
                  <button
                    type="button"
                    className={btn.danger}
                    onClick={async () => {
                      if (!confirm(tr("¿Eliminar «{name}»? El widget dejará de funcionar en ese sitio.", { name: site.name }))) return;
                      try {
                        await api(`/api/sites/${site.id}`, { method: "DELETE" });
                        await onDeleted();
                      } catch (e) {
                        setMsg({ ok: false, text: e instanceof Error ? e.message : tr("No se pudo eliminar") });
                      }
                    }}
                  >
                    {tr("Eliminar")}
                  </button>
                )}
              </div>
            )}
          </form>
        </Card>
        <Preview draft={draft} />
      </div>
    </div>
  );
}

// Quién atiende este sitio (personas e IA) y qué objetivos persigue.
function Assignments({ draft, set }: { draft: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void }) {
  const { state } = useStore();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [goal, setGoal] = useState("");
  useEffect(() => {
    api<{ agents: TeamMember[] }>("/api/agents").then((d) => setTeam(d.agents.filter((a) => !a.disabled))).catch(() => {});
  }, []);
  const toggle = (k: "agent_ids" | "ai_agent_ids", id: number) => {
    const list = draft[k] ?? [];
    set(k, list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };
  const goals = draft.goals ?? [];

  return (
    <div className="space-y-5 border-t border-zinc-100 pt-5">
      <div>
        <div className="text-xs font-medium text-zinc-600">{tr("Agentes humanos de este sitio")}</div>
        <p className="text-xs text-zinc-500">{tr("Sin ninguno marcado, atienden todos. El widget sale «en línea» solo si alguno de los marcados lo está.")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {team.map((a) => (
            <label key={a.id} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${draft.agent_ids?.includes(a.id) ? "border-zinc-900 bg-zinc-900 text-zinc-50" : "border-zinc-300"}`}>
              <input type="checkbox" className="hidden" checked={!!draft.agent_ids?.includes(a.id)} onChange={() => toggle("agent_ids", a.id)} />
              {a.name || a.email}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-zinc-600">{tr("Inteligencia artificial")}</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {AI_MODES.map(([mode, label, hint]) => (
            <label key={mode} className={`cursor-pointer rounded-lg border p-3 ${draft.ai_mode === mode ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"}`}>
              <input type="radio" className="hidden" checked={draft.ai_mode === mode} onChange={() => set("ai_mode", mode)} />
              <div className="text-sm font-medium">{tr(label)}</div>
              <div className="mt-0.5 text-xs text-zinc-500">{tr(hint)}</div>
            </label>
          ))}
        </div>
        {draft.ai_mode !== "off" && (
          <div className="mt-3">
            <div className="text-xs text-zinc-500">{tr("Agentes IA (si marcas varios, se reparten los chats):")}</div>
            {state.aiAgents.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-600">
                {tr("Aún no tienes agentes IA.")} <a href="/dashboard/ai" className="underline">{tr("Créalos aquí")}</a>.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {state.aiAgents.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm ${draft.ai_agent_ids?.includes(a.id) ? "border-zinc-900 bg-zinc-900 text-zinc-50" : "border-zinc-300"}`}>
                    <input type="checkbox" className="hidden" checked={!!draft.ai_agent_ids?.includes(a.id)} onChange={() => toggle("ai_agent_ids", a.id)} />
                    <AiAvatar agent={a} size={24} />
                    {a.name}
                    {!a.is_active && <span className="text-xs opacity-60">{tr("(pausado)")}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-medium text-zinc-600">{tr("Objetivos del sitio")}</div>
        <p className="text-xs text-zinc-500">{tr("La IA intentará conseguirlos y marcará en cada chat los logrados (se ven en Analítica).")}</p>
        <ul className="mt-2 space-y-1.5">
          {goals.map((g, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-sm">
              <span className="flex-1">{g}</span>
              <button type="button" className="text-xs text-zinc-500 underline" onClick={() => set("goals", goals.filter((_, j) => j !== i))}>
                {tr("Quitar")}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            className={input}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={tr("Conseguir el email del cliente · Agendar una demo · Vender el plan Pro…")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (goal.trim()) set("goals", [...goals, goal.trim()]);
                setGoal("");
              }
            }}
          />
          <button
            type="button"
            className={btn.secondary}
            onClick={() => {
              if (goal.trim()) set("goals", [...goals, goal.trim()]);
              setGoal("");
            }}
          >
            {tr("Añadir")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-zinc-600">
      {label}
      <div className="mt-1 font-normal">{children}</div>
    </label>
  );
}

function EmbedCode({ site }: { site: Site }) {
  const origin = useClient(() => window.location.origin, "https://tu-dominio");
  const [copied, setCopied] = useState(false);
  const code = `<!-- falconchato -->\n<script async src="${origin}/widget.js" data-site="${site.site_key}"></script>`;

  return (
    <Card
      title={tr("Código de instalación")}
      actions={
        <a href={`/demo?site=${site.site_key}`} target="_blank" className="text-xs font-medium text-zinc-900">
          {tr("Probar en la página demo ↗")}
        </a>
      }
    >
      <div className="space-y-3 p-5">
        <p className="text-sm text-zinc-600">
          {tr("Pega este código justo antes de")} <code className="rounded bg-zinc-100 px-1">{tr("</body>")}</code> {tr("en todas las páginas de tu sitio.")}
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg bg-ink p-4 pr-24 font-mono text-[13px] leading-relaxed text-zinc-100">{code}</pre>
          <button
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-white hover:bg-white/20"
            onClick={async () => {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <IconCopy width={14} height={14} /> {tr(copied ? "Copiado" : "Copiar")}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          {tr("Puedes abrirlo desde tu web con")} <code className="rounded bg-zinc-100 px-1">{tr("FalconChato.open()")}</code>.
        </p>
      </div>
    </Card>
  );
}

// Vista previa estática del widget con los valores del formulario.
function Preview({ draft }: { draft: Draft }) {
  return (
    <Card title={tr("Vista previa")}>
      <div className={`flex flex-col gap-4 bg-zinc-100 p-5 ${draft.position === "left" ? "items-start" : "items-end"}`}>
        <div className="w-full max-w-[300px] overflow-hidden rounded-2xl bg-surface shadow-lg">
          <div className="flex items-center gap-2.5 px-3.5 py-3 text-white" style={{ background: draft.color }}>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
              <IconChat width={16} height={16} />
            </div>
            <div className="flex-1 leading-tight">
              <div className="text-sm font-semibold">{draft.title || "Chat"}</div>
              <div className="text-[11px] opacity-90">{tr("En línea")}</div>
            </div>
            <IconMinus width={16} height={16} />
          </div>
          <div className="space-y-2 bg-zinc-50 p-3.5">
            <div className="text-[10px] font-medium text-zinc-500">{draft.name || tr("Tu sitio")}</div>
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-3 py-2 text-xs text-zinc-700 shadow-sm">{draft.welcome_message}</div>
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 text-xs text-white" style={{ background: draft.color }}>
              {tr("Hola, tengo una pregunta")}
            </div>
          </div>
          <div className="border-t border-zinc-100 px-3.5 py-2.5 text-xs text-zinc-400">{tr("Escribe tu mensaje aquí")}</div>
        </div>
        {draft.auto_message?.trim() && (
          <div className="max-w-[240px] whitespace-pre-wrap break-words rounded-2xl bg-surface p-3 text-xs leading-relaxed text-zinc-700 shadow-lg">
            {draft.auto_message}
          </div>
        )}
        <div className="relative flex items-center gap-2.5 rounded-full py-2.5 pl-3.5 pr-4 text-white shadow-lg" style={{ background: draft.color }}>
          {draft.auto_message?.trim() && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-surface bg-red-600 px-1 text-[10px] font-bold">1</span>
          )}
          <IconChat width={18} height={18} />
          <span className="text-sm font-semibold">{draft.title || "Chat"}</span>
        </div>
      </div>
    </Card>
  );
}
