"use client";

import { LangSwitch } from "@/components/I18nProvider";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { tr } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-4">
      <form
        className="w-full max-w-sm rounded-2xl bg-surface p-7 shadow-2xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(tr(data.error ?? "No se pudo iniciar sesión"));
            setBusy(false);
            return;
          }
          router.replace("/dashboard");
        }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={34} />
          <span className="text-xl font-semibold tracking-tight">{tr("falconchato")}</span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <LangSwitch />
          <ThemeSwitch />
        </div>
        <h1 className="mt-4 text-lg font-semibold">{tr("Entrar al panel")}</h1>
        <p className="text-sm text-zinc-500">{tr("Atiende a los visitantes de tus sitios en tiempo real.")}</p>
        <label className="mt-5 block text-xs font-medium text-zinc-600">
          {tr("Email")}
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-zinc-600">
          {tr("Contraseña")}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-brand/15"
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="mt-5 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
          {busy ? tr("Entrando…") : "Entrar"}
        </button>
      </form>
    </div>
  );
}
