"use client";

import { useSyncExternalStore } from "react";

// Reloj compartido que avanza cada 10 s para que los "hace X min" se actualicen.
// En el servidor vale 0 (no se usa la hora durante el prerender).
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 10_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function snapshot() {
  if (!now) now = Date.now();
  return now;
}

export function useNow() {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
