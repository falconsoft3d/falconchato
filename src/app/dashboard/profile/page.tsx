"use client";

import { useEffect, useRef, useState } from "react";
import { IconUpload } from "@/components/icons";
import { api, useStore } from "@/components/dashboard/store";
import { Avatar, Card, PageHeader, btn, input } from "@/components/dashboard/ui";
import { toAvatar } from "@/lib/avatar";
import { tr } from "@/lib/i18n";
import type { Agent } from "@/lib/types";

export default function ProfilePage() {
  const { state } = useStore();
  return (
    <>
      <PageHeader title={tr("Mi perfil")} subtitle={tr("Tu foto y tu nombre los ven los clientes en el chat")} />
      <div className="grid max-w-4xl gap-6 p-6 lg:grid-cols-2">{state.me && <ProfileCard me={state.me} />}<PasswordCard /></div>
    </>
  );
}

function ProfileCard({ me }: { me: Agent }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(me.name ?? "");
  const [avatar, setAvatar] = useState<string | null>(me.avatar ?? null);
  const [contactEmail, setContactEmail] = useState(me.contact_email ?? "");
  const [whatsapp, setWhatsapp] = useState(me.whatsapp ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card title={tr("Foto y nombre")}>
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          try {
            const d = await api<{ agent: Agent }>(`/api/agents/${me.id}`, { method: "PATCH", body: { name, avatar, contact_email: contactEmail, whatsapp } });
            dispatch({ type: "me", me: { ...me, ...d.agent } });
            setMsg({ ok: true, text: tr("Guardado") });
          } catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : tr("No se pudo guardar") });
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex items-center gap-4">
          <Avatar name={name || me.email} id={me.id} size={72} src={avatar} />
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setAvatar(await toAvatar(f));
                e.target.value = "";
              }}
            />
            <button type="button" className={btn.secondary} onClick={() => fileRef.current?.click()}>
              <IconUpload width={16} height={16} /> {tr("Cambiar foto")}
            </button>
            {avatar && (
              <button type="button" className="ml-2 text-xs text-zinc-500 underline" onClick={() => setAvatar(null)}>
                {tr("Quitar")}
              </button>
            )}
          </div>
        </div>
        <label className="block text-xs font-medium text-zinc-600">
          {tr("Nombre que verá el cliente *")}
          <input className={`${input} mt-1`} required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-600">
            {tr("Email de contacto")}
            <input type="email" className={`${input} mt-1`} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="ventas@miempresa.com" />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            WhatsApp
            <input className={`${input} mt-1`} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+34 600 000 000" />
          </label>
        </div>
        <p className="text-xs text-zinc-500">{tr("Opcionales. Si los rellenas, el cliente los verá en el chat cuando le atiendas.")}</p>
        <div className="text-xs text-zinc-500">
          {tr("Acceso:")} {me.email}
        </div>
        {msg && <p className={`text-sm ${msg.ok ? "text-zinc-700" : "text-red-600"}`}>{msg.text}</p>}
        <button className={btn.primary} disabled={busy}>
          {busy ? tr("Guardando…") : tr("Guardar cambios")}
        </button>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<{ enabled: boolean }>("/api/me/password")
      .then((d) => setEnabled(d.enabled))
      .catch(() => setEnabled(false));
  }, []);

  return (
    <Card title={tr("Cambiar contraseña")}>
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg(null);
          if (next !== repeat) return setMsg({ ok: false, text: tr("Las contraseñas nuevas no coinciden") });
          setBusy(true);
          try {
            await api("/api/me/password", { body: { current, password: next } });
            setCurrent("");
            setNext("");
            setRepeat("");
            setMsg({ ok: true, text: tr("Contraseña cambiada") });
          } catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : tr("No se pudo guardar") });
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={enabled === false} className="space-y-4">
          <label className="block text-xs font-medium text-zinc-600">
            {tr("Contraseña actual")}
            <input type="password" autoComplete="current-password" required className={`${input} mt-1`} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            {tr("Nueva contraseña")} <span className="font-normal text-zinc-400">{tr("(mín. 8 caracteres)")}</span>
            <input type="password" autoComplete="new-password" required minLength={8} className={`${input} mt-1`} value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            {tr("Repite la nueva contraseña")}
            <input type="password" autoComplete="new-password" required minLength={8} className={`${input} mt-1`} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </label>
          <button className={btn.primary} disabled={busy}>
            {busy ? tr("Guardando…") : tr("Cambiar contraseña")}
          </button>
        </fieldset>
        {enabled === false && (
          <p className="text-xs text-zinc-500">{tr("Para cambiar contraseñas, añade FDB_ADMIN_TOKEN (token de IA de falcondatabase) al servidor.")}</p>
        )}
        {msg && <p className={`text-sm ${msg.ok ? "text-zinc-700" : "text-red-600"}`}>{msg.text}</p>}
      </form>
    </Card>
  );
}
