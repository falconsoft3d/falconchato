// Cliente mínimo de la API REST de falcondatabase. Solo se usa en el servidor:
// los datos van con la service key (las tablas son privadas) y el login de
// agentes con la clave anon.

const BASE = (process.env.FDB_URL ?? "https://falcondatabase.com").replace(/\/$/, "");
const PROJECT = process.env.FDB_PROJECT ?? "";
const ANON_KEY = process.env.FDB_ANON_KEY ?? "";
const SERVICE_KEY = process.env.FDB_SERVICE_KEY ?? "";

export class FdbError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type Query = Record<string, string | number | undefined | null>;

type CallOptions = {
  body?: unknown;
  query?: Query;
  apikey?: string;
  token?: string;
};

async function call<T>(method: string, path: string, opts: CallOptions = {}): Promise<T> {
  if (!PROJECT || !SERVICE_KEY || !ANON_KEY) {
    throw new FdbError("Faltan FDB_PROJECT, FDB_ANON_KEY o FDB_SERVICE_KEY en el entorno", 500);
  }
  const url = new URL(`${BASE}/api/v1/${PROJECT}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {
    apikey: opts.apikey ?? SERVICE_KEY,
    "Accept-Language": "es",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new FdbError(`Respuesta inesperada de falcondatabase (${res.status})`, res.status);
  }
  if (!res.ok) {
    const msg = (json as { error?: string } | null)?.error ?? `Error ${res.status}`;
    throw new FdbError(msg, res.status);
  }
  return json as T;
}

export const db = {
  async list<T>(table: string, query?: Query): Promise<{ data: T[]; count: number }> {
    return call("GET", `/tables/${table}`, { query });
  },

  // Recorre todas las páginas; para analítica e historial.
  async listAll<T>(table: string, query?: Query, max = 10000): Promise<T[]> {
    const pageSize = 1000;
    const rows: T[] = [];
    for (let offset = 0; offset < max; offset += pageSize) {
      const { data, count } = await db.list<T>(table, { ...query, limit: pageSize, offset });
      rows.push(...data);
      if (rows.length >= count || data.length < pageSize) break;
    }
    return rows;
  },

  async first<T>(table: string, query?: Query): Promise<T | null> {
    const { data } = await db.list<T>(table, { ...query, limit: 1 });
    return data[0] ?? null;
  },

  async get<T>(table: string, id: number): Promise<T | null> {
    try {
      const { data } = await call<{ data: T }>("GET", `/tables/${table}/${id}`);
      return data;
    } catch (e) {
      if (e instanceof FdbError && e.status === 404) return null;
      throw e;
    }
  },

  async insert<T>(table: string, row: object): Promise<T> {
    const { data } = await call<{ data: T }>("POST", `/tables/${table}`, { body: row });
    return data;
  },

  async update<T>(table: string, id: number, values: object): Promise<T> {
    const { data } = await call<{ data: T }>("PATCH", `/tables/${table}/${id}`, { body: values });
    return data;
  },

  async remove(table: string, id: number): Promise<void> {
    await call("DELETE", `/tables/${table}/${id}`);
  },
};

// Herramientas de administración de falcondatabase (token de IA). Solo para lo
// que la API REST no permite, como cambiar la contraseña de un usuario.
const ADMIN_TOKEN = process.env.FDB_ADMIN_TOKEN ?? "";

export const fdbAdmin = {
  enabled: () => !!ADMIN_TOKEN,
  async setPassword(userId: number, password: string) {
    if (!ADMIN_TOKEN) throw new FdbError("Falta FDB_ADMIN_TOKEN en el servidor para cambiar contraseñas", 501);
    const res = await fetch(`${BASE}/api/ai/tools/update_user`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json", "Accept-Language": "es" },
      body: JSON.stringify({ project: PROJECT, user: userId, password }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new FdbError(data?.error ?? `Error ${res.status}`, res.status);
  },
};

export type FdbUser = {
  id: number;
  email: string;
  data: { name?: string; role?: string } | null;
};

export const fdbAuth = {
  // Alta de usuario con la service key (funciona aunque el registro público esté desactivado).
  signup(email: string, password: string, data: Record<string, unknown>) {
    return call<{ user: FdbUser; token: string }>("POST", "/auth/signup", { body: { email, password, data } });
  },

  login(email: string, password: string) {
    return call<{ user: FdbUser; token: string; expires_in: number }>("POST", "/auth/login", {
      apikey: ANON_KEY,
      body: { email, password },
    });
  },

  async user(token: string): Promise<FdbUser | null> {
    try {
      const { user } = await call<{ user: FdbUser }>("GET", "/auth/user", { apikey: ANON_KEY, token });
      return user;
    } catch (e) {
      if (e instanceof FdbError && (e.status === 401 || e.status === 403)) return null;
      throw e;
    }
  },
};
