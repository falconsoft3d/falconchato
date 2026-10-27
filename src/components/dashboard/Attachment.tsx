"use client";

import { tr } from "@/lib/i18n";

// Foto adjunta: clic para verla en grande en otra pestaña.
export function Attachment({ src }: { src: string }) {
  return (
    <a
      href={src}
      download="foto.jpg"
      onClick={(e) => {
        e.preventDefault();
        const w = window.open();
        if (w) w.document.write(`<img src="${src}" style="max-width:100%">`);
      }}
      className="mb-1 block max-w-[60%]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={tr("Foto adjunta")} className="max-h-64 rounded-2xl object-cover shadow-sm" />
    </a>
  );
}
