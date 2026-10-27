"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

// Lee un valor que solo existe en el navegador (location, Notification…) sin
// desajustes de hidratación: en el servidor devuelve `server`.
export function useClient<T>(get: () => T, server: T): T {
  return useSyncExternalStore(noop, get, () => server);
}
