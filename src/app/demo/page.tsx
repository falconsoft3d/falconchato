"use client";

// Página de pruebas: simula un sitio de cliente con el widget instalado.
// /demo?site=CLAVE carga el widget de ese sitio (por defecto "demo").

import { tr } from "@/lib/i18n";
import { useEffect, useState } from "react";

const PRODUCTS = [
  { name: "Café de especialidad", price: "12,90 €", tone: "bg-amber-100" },
  { name: "Taza de cerámica", price: "18,00 €", tone: "bg-sky-100" },
  { name: "Molinillo manual", price: "45,00 €", tone: "bg-emerald-100" },
];

export default function DemoPage() {
  const [page, setPage] = useState("Inicio");

  useEffect(() => {
    const site = new URLSearchParams(location.search).get("site") ?? "demo";
    const s = document.createElement("script");
    s.src = "/widget.js";
    s.async = true;
    s.dataset.site = site;
    document.body.appendChild(s);
  }, []);

  useEffect(() => {
    document.title = `${tr(page)} · ${tr("Tienda demo")}`;
  }, [page]);

  // Navegación tipo SPA para probar el seguimiento de páginas.
  const go = (name: string) => {
    setPage(name);
    const url = new URL(location.href);
    url.hash = name.toLowerCase();
    history.pushState(null, "", url);
  };

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-800">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold">{tr("☕ Tienda demo")}</span>
          <nav className="flex gap-5 text-sm">
            {["Inicio", "Productos", tr("Envíos"), "Contacto"].map((n) => (
              <button key={n} onClick={() => go(n)} className={page === n ? "font-semibold" : "text-stone-500 hover:text-stone-800"}>
                {tr(n)}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">{tr("Página:")} {tr(page)}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">{tr("El mejor café, directo a tu casa")}</h1>
        <p className="mt-3 max-w-xl text-stone-600">
          {tr("Esto es una web de ejemplo con el widget de falconchato instalado. Escribe en el chat de abajo y contesta desde el panel.")}
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {PRODUCTS.map((p) => (
            <div key={p.name} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className={`h-36 rounded-lg ${p.tone}`} />
              <div className="mt-3 font-medium">{tr(p.name)}</div>
              <div className="text-sm text-stone-500">{p.price}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => (window as unknown as { FalconChato?: { open: () => void } }).FalconChato?.open()}
          className="mt-10 rounded-lg bg-stone-900 px-5 py-3 text-sm font-semibold text-white"
        >
          {tr("¿Dudas? Abre el chat")}
        </button>
      </main>
    </div>
  );
}
