"use client";

// Lluvia de caracteres al estilo Matrix para el fondo del chat. Al abrir el chat
// cae con fuerza unos segundos y luego queda muy tenue para no molestar al leer.
// Se pausa con la pestaña oculta y no se activa si el visitante pide menos movimiento.

import { useEffect, useRef } from "react";

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789";
const SIZE = 14;
const FPS = 22;
const BURST_MS = 3000;

export function MatrixRain({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let drops: number[] = [];
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.ceil(w / SIZE);
      // Cada columna empieza a una altura distinta (por encima de la vista).
      drops = Array.from({ length: cols }, (_, i) => drops[i] ?? -Math.random() * (h / SIZE));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const start = performance.now();
    let last = 0;
    let raf = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || t - last < 1000 / FPS) return;
      last = t;
      // Ráfaga al abrir que se va apagando hasta un nivel ambiental.
      const k = Math.max(0, 1 - (t - start) / BURST_MS);
      const alpha = 0.1 + 0.35 * k;

      // Estela: borrar un poco cada fotograma (el fondo es transparente).
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      ctx.font = `${SIZE}px ui-monospace, monospace`;
      ctx.fillStyle = color;
      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * SIZE;
        if (y > 0) {
          ctx.globalAlpha = alpha;
          ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * SIZE, y);
        }
        // Más rápido durante la ráfaga; luego, lluvia lenta.
        drops[i] += 0.5 + 0.7 * k + Math.random() * 0.2;
        if (y > h && Math.random() > 0.975) drops[i] = -Math.random() * 8;
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [color]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
