"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { IconPlus } from "@/components/icons";
import { api, useStore } from "@/components/dashboard/store";
import { Avatar, Badge, Card, PageHeader, btn, input } from "@/components/dashboard/ui";
import { useNow } from "@/components/dashboard/useNow";
import { toAvatar } from "@/lib/avatar";
import { timeAgo } from "@/lib/format";

type Row = {
  id: number;
  name: string | null;
  email: string;
  role: "owner" | "admin" | "agent";
  disabled: boolean;
  avatar: string | null;
  status: string;
  connected: boolean;
  last_seen_at: string | null;
};

const ROLE: Record<Row["role"], string> = { owner: "Propietario", admin: "Administrador", agent: "Agente" };

export default function TeamPage() {
  const { state, dispatch } = useStore();
  const now = useNow();
  const [agents, setAgents] = useState<Row[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const me = state.me;
  const isAdmin = me?.role === "owner" || me?.role === "admin";

  // Se recarga cuando cambia la presencia (llega por SSE).
  useEffect(() => {
    api<{ agents: Row[] }>("/api/agents")
      .then((d) => setAgents(d.agents))
      .catch(() => setAgents([]));
  }, [state.agents, reload]);

  async function patch(a: Row, body: Partial<Row>) {
    setError(null);
    try {
      await api(`/api/agents/${a.id}`, { method: "PATCH", body });
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("No se pudo guardar"));
    }
  }

  return (
    <>
      <PageHeader
        title={tr("Equipo")}
        subtitle={tr("Personas que atienden los chats")}
        actions={
          isAdmin && (
            <button className={btn.primary} onClick={() => setAdding(true)}>
              <IconPlus width={16} height={16} /> {tr("Añadir agente")}
            </button>
          )
        }
      />
      <div className="space-y-6 p-6">
        {adding && (
          <NewAgent
            canOwner={me?.role === "owner"}
            onClose={() => setAdding(false)}
            onCreated={() => {
              setAdding(false);
              setReload((n) => n + 1);
            }}
          />
        )}
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-2.5 font-medium">{tr("Nombre")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Email")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Rol")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Estado")}</th>
                  {isAdmin && <th className="px-5 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {agents?.map((a) => {
                  const self = a.id === me?.id;
                  const locked = self || (a.role === "owner" && me?.role !== "owner");
                  return (
                    <tr key={a.id} className={a.disabled ? "opacity-50" : ""}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <PhotoPicker
                            row={a}
                            editable={isAdmin || self}
                            onPicked={async (avatar) => {
                              await patch(a, { avatar });
                              if (self) dispatch({ type: "me", me: { ...state.me!, avatar } });
                            }}
                          />
                          <span className="font-medium">{a.name ?? "—"}</span>
                          {self && <Badge>{tr("Tú")}</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-zinc-600">{a.email}</td>
                      <td className="px-3 py-3 text-zinc-600">
                        {isAdmin && !locked ? (
                          <select
                            className="rounded-md border border-zinc-300 bg-surface px-2 py-1 text-sm"
                            value={a.role}
                            onChange={(e) => patch(a, { role: e.target.value as Row["role"] })}
                          >
                            {(Object.keys(ROLE) as Row["role"][])
                              .filter((r) => r !== "owner" || me?.role === "owner")
                              .map((r) => (
                                <option key={r} value={r}>
                                  {tr(ROLE[r])}
                                </option>
                              ))}
                          </select>
                        ) : (
                          tr(ROLE[a.role])
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {a.disabled ? (
                          <Badge tone="red">{tr("Desactivado")}</Badge>
                        ) : a.connected ? (
                          a.status === "online" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700">
                              <span className="h-2 w-2 rounded-full bg-green-500" />
                              {tr("En línea")}
                            </span>
                          ) : a.status === "away" ? (
                            <Badge tone="amber">{tr("Ausente")}</Badge>
                          ) : (
                            <Badge>{tr("Invisible")}</Badge>
                          )
                        ) : (
                          <span className="text-xs text-zinc-400">{tr("Desconectado ·")} {timeAgo(a.last_seen_at, now)}</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3 text-right">
                          {!locked && (
                            <span className="flex justify-end gap-3">
                              <button
                                className="text-xs font-medium text-zinc-700 underline"
                                onClick={async () => {
                                  const pw = prompt(tr("Nueva contraseña para {name} (mín. 8 caracteres):", { name: a.name ?? a.email }));
                                  if (!pw) return;
                                  setError(null);
                                  try {
                                    await api(`/api/agents/${a.id}/password`, { body: { password: pw } });
                                    alert(tr("Contraseña cambiada. Compártela con la persona."));
                                  } catch (e) {
                                    setError(e instanceof Error ? e.message : tr("No se pudo guardar"));
                                  }
                                }}
                              >
                                {tr("Cambiar contraseña")}
                              </button>
                              <button className="text-xs font-medium text-zinc-700 underline" onClick={() => patch(a, { disabled: !a.disabled })}>
                                {tr(a.disabled ? "Reactivar" : "Desactivar")}
                              </button>
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!agents && <div className="px-5 py-8 text-center text-sm text-zinc-400">{tr("Cargando…")}</div>}
          </div>
        </Card>
        <p className="text-xs text-zinc-500">
          <b>{tr("Propietario")}</b> {tr("y")} <b>{tr("Administrador")}</b> {tr("gestionan sitios, IA y equipo;")} <b>{tr("Agente")}</b> {tr("atiende chats y edita contactos. Un agente desactivado no puede entrar al panel.")}
        </p>
      </div>
    </>
  );
}

function NewAgent({ canOwner, onClose, onCreated }: { canOwner: boolean; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: "", email: "", password: "", role: "agent" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Card title={tr("Nuevo agente")}>
      <form
        className="grid gap-4 p-5 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await api("/api/agents", { body: f });
            onCreated();
          } catch (e) {
            setErr(e instanceof Error ? e.message : tr("No se pudo crear"));
            setBusy(false);
          }
        }}
      >
        <label className="text-xs font-medium text-zinc-600">
          {tr("Nombre *")}
          <input className={`${input} mt-1`} required value={f.name} onChange={set("name")} />
        </label>
        <label className="text-xs font-medium text-zinc-600">
          {tr("Email *")}
          <input type="email" className={`${input} mt-1`} required value={f.email} onChange={set("email")} />
        </label>
        <label className="text-xs font-medium text-zinc-600">
          {tr("Contraseña *")} <span className="font-normal text-zinc-400">{tr("(mín. 8 caracteres; compártela con la persona)")}</span>
          <input type="text" autoComplete="off" className={`${input} mt-1 font-mono`} required minLength={8} value={f.password} onChange={set("password")} />
        </label>
        <label className="text-xs font-medium text-zinc-600">
          {tr("Rol")}
          <select className={`${input} mt-1`} value={f.role} onChange={set("role")}>
            <option value="agent">{tr("Agente")}</option>
            <option value="admin">{tr("Administrador")}</option>
            {canOwner && <option value="owner">{tr("Propietario")}</option>}
          </select>
        </label>
        {err && <p className="text-sm text-red-600 md:col-span-2">{err}</p>}
        <div className="flex gap-2 md:col-span-2">
          <button className={btn.primary} disabled={busy}>
            {busy ? tr("Creando…") : tr("Crear agente")}
          </button>
          <button type="button" className={btn.secondary} onClick={onClose}>
            {tr("Cancelar")}
          </button>
          <button
            type="button"
            className="ml-auto text-xs text-zinc-500 underline"
            onClick={() => setF({ ...f, password: Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 56]).join("") + "-7" })}
          >
            {tr("Generar contraseña")}
          </button>
        </div>
      </form>
    </Card>
  );
}

// Foto del agente: la ve el visitante en el widget. Clic para cambiarla.
function PhotoPicker({ row, editable, onPicked }: { row: Row; editable: boolean; onPicked: (avatar: string) => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null);
  const avatar = <Avatar name={row.name ?? row.email} id={row.id} size={32} src={row.avatar} />;
  if (!editable) return avatar;
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await onPicked(await toAvatar(f));
          e.target.value = "";
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} title={tr("Cambiar foto (la ve el cliente)")} className="rounded-full ring-zinc-300 hover:ring-2">
        {avatar}
      </button>
    </>
  );
}
