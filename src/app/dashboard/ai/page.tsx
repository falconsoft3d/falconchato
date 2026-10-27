"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { IconPlus, IconSend, IconUpload } from "@/components/icons";
import { AiAvatar } from "@/components/dashboard/AiAvatar";
import { toAvatar } from "@/lib/avatar";
import { api, useStore } from "@/components/dashboard/store";
import { Badge, Card, Empty, PageHeader, btn, input } from "@/components/dashboard/ui";
import type { AiAgent } from "@/lib/types";

type Settings = { configured: boolean; key_hint: string | null; model: string };
type Draft = Pick<AiAgent, "name" | "personality" | "knowledge" | "avatar" | "is_active" | "contact_email" | "whatsapp">;

const MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];
const EMPTY: Draft = { name: "", personality: "", knowledge: "", avatar: null, is_active: true, contact_email: "", whatsapp: "" };
const PRESETS: [string, string][] = [
  ["Cercano", "Amable, cercano y con un toque de humor. Tutea al cliente y usa algún emoji de vez en cuando."],
  ["Profesional", "Profesional, preciso y educado. Trata de usted, sin emojis. Va al grano."],
  ["Vendedor", "Entusiasta y resolutivo. Detecta qué necesita el cliente, recomienda el producto adecuado y propone el siguiente paso (comprar, reservar o dejar sus datos)."],
];

export default function AiPage() {
  const { state } = useStore();
  const canEdit = state.me?.role === "owner" || state.me?.role === "admin";

  return (
    <>
      <PageHeader title={tr("Agentes IA")} subtitle={tr("Asistentes con ChatGPT que atienden a tus clientes y te pasan el chat cuando hace falta")} />
      <div className="space-y-6 p-6">
        {!state.ready ? null : canEdit ? (
          <>
            <Connection />
            <Agents />
          </>
        ) : (
          <Card>
            <Empty title={tr("Solo los administradores configuran la IA")} />
          </Card>
        )}
      </div>
    </>
  );
}

function Connection() {
  const [s, setS] = useState<Settings | null>(null);
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<Settings>("/api/ai/settings")
      .then((d) => {
        setS(d);
        setModel(d.model);
      })
      .catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);

  async function save(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api<Settings>("/api/ai/settings", { method: "PUT", body });
      setS(d);
      setKey("");
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : tr("No se pudo guardar") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={tr("Conexión con ChatGPT")}
      actions={s && (s.configured ? <Badge tone="green">{tr("Conectado ·")} {s.key_hint}</Badge> : <Badge tone="red">{tr("Sin API key")}</Badge>)}
    >
      <form
        className="grid gap-4 p-5 md:grid-cols-[1fr_220px_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          save({ api_key: key || undefined, model }, tr("Ajustes guardados"));
        }}
      >
        <label className="text-xs font-medium text-zinc-600">
          {tr("API key de OpenAI")}
          <input
            type="password"
            autoComplete="off"
            className={`${input} mt-1 font-mono`}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={s?.configured ? tr("Guardada · escribe otra para cambiarla") : "sk-…"}
          />
        </label>
        <label className="text-xs font-medium text-zinc-600">
          {tr("Modelo")}
          <input className={`${input} mt-1`} list="fc-models" value={model} onChange={(e) => setModel(e.target.value)} />
          <datalist id="fc-models">
            {MODELS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <div className="flex gap-2">
          <button className={btn.primary} disabled={busy}>
            {tr("Guardar")}
          </button>
          <button
            type="button"
            className={btn.secondary}
            disabled={busy || !s?.configured}
            onClick={async () => {
              setBusy(true);
              setMsg(null);
              try {
                const d = await api<{ reply: string }>("/api/ai/test", { body: {} });
                setMsg({ ok: true, text: tr("Conexión correcta. ChatGPT respondió: «{reply}»", { reply: d.reply }) });
              } catch (e) {
                setMsg({ ok: false, text: e instanceof Error ? e.message : tr("No se pudo conectar") });
              } finally {
                setBusy(false);
              }
            }}
          >
            {tr("Probar")}
          </button>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
        <span>
          {tr("La key se guarda cifrada en falcondatabase y nunca se envía al navegador. Consíguela en platform.openai.com → API keys.")}
        </span>
        {s?.configured && (
          <button className="font-medium text-zinc-700 underline" onClick={() => confirm(tr("¿Quitar la API key? La IA dejará de responder.")) && save({ api_key: null }, tr("API key eliminada"))}>
            {tr("Quitar key")}
          </button>
        )}
      </div>
      {msg && <p className={`px-5 pb-4 text-sm ${msg.ok ? "text-zinc-700" : "text-red-600"}`}>{msg.text}</p>}
    </Card>
  );
}

function Agents() {
  const { state, refreshAiAgents } = useStore();
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const agents = state.aiAgents;
  const current = selected === "new" ? null : (agents.find((a) => a.id === selected) ?? agents[0] ?? null);
  const creating = selected === "new" || agents.length === 0;
  const usedIn = (id: number) => state.sites.filter((s) => s.ai_mode !== "off" && s.ai_agent_ids?.includes(id)).map((s) => s.name);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 className="text-sm font-semibold">{tr("Tus agentes IA")}</h2>
          <button className="rounded-md p-1 text-zinc-600 hover:bg-zinc-100" onClick={() => setSelected("new")} aria-label={tr("Nuevo agente IA")}>
            <IconPlus width={16} height={16} />
          </button>
        </div>
        <ul className="p-2">
          {agents.length === 0 && <li className="px-3 py-2 text-sm text-zinc-400">{tr("Crea el primero →")}</li>}
          {agents.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setSelected(a.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${!creating && current?.id === a.id ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
              >
                <AiAvatar agent={a} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="truncate text-xs text-zinc-500">
                    {!a.is_active ? "Pausado" : usedIn(a.id).length ? usedIn(a.id).join(", ") : tr("Sin sitio asignado")}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
          {tr("Asigna cada agente a tus webs en")} <b>{tr("Sitios y widget")}</b>{tr(", junto con los objetivos.")}
        </p>
      </Card>

      <AgentEditor
        key={creating ? "new" : current!.id}
        agent={creating ? null : current}
        onSaved={async (a) => {
          await refreshAiAgents();
          setSelected(a?.id ?? null);
        }}
      />
    </div>
  );
}

function AgentEditor({ agent, onSaved }: { agent: AiAgent | null; onSaved: (a: AiAgent | null) => void | Promise<void> }) {
  const { state } = useStore();
  const [draft, setDraft] = useState<Draft>(agent ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const d = agent
        ? await api<{ agent: AiAgent }>(`/api/ai/agents/${agent.id}`, { method: "PATCH", body: draft })
        : await api<{ agent: AiAgent }>("/api/ai/agents", { body: draft });
      await onSaved(d.agent);
      setMsg({ ok: true, text: agent ? "Guardado" : tr("Agente creado. Asígnalo a un sitio en «Sitios y widget».") });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : tr("No se pudo guardar") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_380px]">
      <Card title={agent ? tr("Editar {name}", { name: agent.name }) : tr("Nuevo agente IA")}>
        <form onSubmit={save} className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <AiAvatar agent={draft} size={72} />
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) set("avatar", await toAvatar(f));
                  e.target.value = "";
                }}
              />
              <button type="button" className={btn.secondary} onClick={() => fileRef.current?.click()}>
                <IconUpload width={16} height={16} /> {tr("Subir foto")}
              </button>
              {draft.avatar && (
                <button type="button" className="ml-2 text-xs text-zinc-500 underline" onClick={() => set("avatar", null)}>
                  {tr("Quitar")}
                </button>
              )}
              <p className="text-xs text-zinc-500">{tr("La verá el cliente en el chat.")}</p>
            </div>
          </div>
          <label className="block text-xs font-medium text-zinc-600">
            {tr("Nombre que verá el cliente *")}
            <input className={`${input} mt-1`} required value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder={tr("Sofía")} />
          </label>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-600">{tr("Personalidad")}</span>
              <span className="flex gap-1">
                {PRESETS.map(([label, text]) => (
                  <button key={label} type="button" className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100" onClick={() => set("personality", tr(text))}>
                    {tr(label)}
                  </button>
                ))}
              </span>
            </div>
            <textarea
              className={`${input} mt-1`}
              rows={3}
              value={draft.personality ?? ""}
              onChange={(e) => set("personality", e.target.value)}
              placeholder={tr("Cómo habla, qué tono usa, qué evita…")}
            />
          </div>
          <label className="block text-xs font-medium text-zinc-600">
            {tr("Lo que debe saber de tu negocio")}
            <textarea
              className={`${input} mt-1 font-mono text-[13px]`}
              rows={9}
              value={draft.knowledge ?? ""}
              onChange={(e) => set("knowledge", e.target.value)}
              placeholder={tr("Horario: L-V 9:00-18:00\nEnvíos: 24-48 h en península, gratis desde 50 €\nDevoluciones: 30 días\nPrecios: …\nPreguntas frecuentes: …")}
            />
            <span className="mt-1 block font-normal text-zinc-500">{tr("Solo responderá con esta información; si no sabe algo, ofrecerá pasar con una persona.")}</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-zinc-600">
              {tr("Email de contacto")}
              <input type="email" className={`${input} mt-1`} value={draft.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} placeholder="hola@miempresa.com" />
            </label>
            <label className="block text-xs font-medium text-zinc-600">
              WhatsApp
              <input className={`${input} mt-1`} value={draft.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+34 600 000 000" />
            </label>
          </div>
          <p className="-mt-2 text-xs text-zinc-500">{tr("Opcionales. Si los rellenas, el cliente los verá en la cabecera del chat.")}</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            {tr("Activo")}
          </label>
          {msg && <p className={`text-sm ${msg.ok ? "text-zinc-700" : "text-red-600"}`}>{msg.text}</p>}
          <div className="flex justify-between gap-2">
            <button className={btn.primary} disabled={busy}>
              {busy ? tr("Guardando…") : agent ? tr("Guardar cambios") : tr("Crear agente")}
            </button>
            {agent && (
              <button
                type="button"
                className={btn.danger}
                onClick={async () => {
                  if (!confirm(tr("¿Eliminar a {name}?", { name: agent.name }))) return;
                  await api(`/api/ai/agents/${agent.id}`, { method: "DELETE" });
                  await onSaved(null);
                }}
              >
                {tr("Eliminar")}
              </button>
            )}
          </div>
        </form>
      </Card>
      {agent ? <Playground agent={agent} sites={state.sites} /> : null}
    </div>
  );
}

type Turn = { role: "user" | "assistant"; content: string; actions?: string[] };

const ACTION_LABEL: Record<string, string> = {
  save_contact: "Guardaría el contacto en el CRM",
  goal_achieved: "Marcaría un objetivo como conseguido",
  transfer_to_human: "Pasaría el chat a una persona",
};

// Chat de prueba: responde con la configuración guardada, sin afectar a clientes reales.
function Playground({ agent, sites }: { agent: AiAgent; sites: { id: number; name: string }[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [site, setSite] = useState(sites[0]?.id ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns.length, busy]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    const next = [...turns, { role: "user" as const, content: body }];
    setTurns(next);
    setText("");
    setBusy(true);
    setErr(null);
    try {
      const d = await api<{ reply: string; actions: string[] }>(`/api/ai/agents/${agent.id}/preview`, {
        body: { site_id: site, messages: next.map(({ role, content }) => ({ role, content })) },
      });
      setTurns([...next, { role: "assistant", content: d.reply || "…", actions: d.actions }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("No se pudo responder"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={tr("Probar el agente")}
      actions={
        <button className="text-xs text-zinc-500 underline" onClick={() => setTurns([])}>
          {tr("Reiniciar")}
        </button>
      }
    >
      <div className="flex h-[520px] flex-col">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 text-xs text-zinc-500">
          {tr("Como si estuviera en")}
          <select className="rounded border border-zinc-300 px-1.5 py-1 text-xs" value={site} onChange={(e) => setSite(Number(e.target.value))}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {tr("(usa sus objetivos)")}
        </div>
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4">
          {turns.length === 0 && <p className="text-center text-xs text-zinc-400">{tr("Escribe como si fueras un cliente. No se guarda nada.")}</p>}
          {turns.map((t, i) => (
            <div key={i} className={`flex flex-col ${t.role === "user" ? "items-end" : "items-start"}`}>
              {t.role === "assistant" && (
                <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                  <AiAvatar agent={agent} size={18} />
                  {agent.name}
                </span>
              )}
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  t.role === "user" ? "rounded-br-md bg-zinc-800 text-zinc-50" : "rounded-bl-md bg-surface shadow-sm"
                }`}
              >
                {t.content}
              </div>
              {t.actions?.map((a, j) => (
                <span key={j} className="mt-1 text-[11px] text-zinc-500">
                  ⚙ {tr(ACTION_LABEL[a] ?? a)}
                </span>
              ))}
            </div>
          ))}
          {busy && <div className="text-xs text-zinc-400">{agent.name} {tr("está escribiendo…")}</div>}
          {err && <div className="text-xs text-red-600">{err}</div>}
        </div>
        <div className="flex gap-2 border-t border-zinc-100 p-3">
          <input
            className={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={tr("Hola, ¿hacéis envíos a Canarias?")}
          />
          <button className={btn.primary} onClick={send} disabled={busy || !text.trim()} aria-label={tr("Enviar")}>
            <IconSend width={16} height={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}
