"use client";

import { tr, trSystem } from "@/lib/i18n";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { IconClip, IconCopy, IconSend, IconSparkle } from "@/components/icons";
import { AiAvatar } from "@/components/dashboard/AiAvatar";
import { Attachment } from "@/components/dashboard/Attachment";
import { compressImage } from "@/lib/image";
import { copyText, transcript } from "@/lib/transcript";
import { ContactForm, emptyContact } from "@/components/dashboard/ContactForm";
import { activeConversations, api, useStore, type Msg } from "@/components/dashboard/store";
import { Avatar, Badge, Empty, btn, input } from "@/components/dashboard/ui";
import { useNow } from "@/components/dashboard/useNow";
import { browserInfo, clock, conversationName, dateTime, flag, shortUrl, timeAgo } from "@/lib/format";
import type { Shortcut } from "@/lib/shortcuts";
import type { AiAgent, Contact, Conversation, Visitor } from "@/lib/types";

export default function ChatsPage() {
  return (
    <Suspense>
      <Chats />
    </Suspense>
  );
}

function Chats() {
  const { state } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const selected = Number(params.get("c")) || null;
  const [tab, setTab] = useState<"all" | "waiting" | "offline">("all");
  const now = useNow();

  const all = activeConversations(state);
  const list = all.filter((c) =>
    tab === "waiting" ? c.status === "open" && !c.first_response_at : tab === "offline" ? c.status === "offline" : true,
  );
  const select = (id: number | null) => router.replace(id ? `/dashboard/chats?c=${id}` : "/dashboard/chats");

  return (
    <div className="flex h-full min-h-0">
      <div className={`flex w-full flex-col border-r border-zinc-200 bg-surface md:w-80 md:shrink-0 ${selected ? "max-md:hidden" : ""}`}>
        <div className="border-b border-zinc-200 px-4 pb-0 pt-4">
          <h1 className="text-lg font-semibold">{tr("Chats")}</h1>
          <div className="mt-3 flex gap-4 text-sm">
            {(
              [
                ["all", tr("Activos ({n})", { n: all.length })],
                ["waiting", tr("Sin responder")],
                ["offline", "Offline"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`border-b-2 pb-2.5 ${tab === key ? "border-zinc-900 font-medium text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto">
          {list.length === 0 && <Empty title={tr("Nada por aquí")}>{tr("Los chats nuevos aparecen al instante.")}</Empty>}
          {list.map((c) => {
            const typing = state.typing[c.id];
            const site = state.sites.find((s) => s.id === c.site_id);
            const online = !!state.visitors[c.visitor_id];
            return (
              <li key={c.id}>
                <button
                  onClick={() => select(c.id)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${selected === c.id ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
                >
                  <div className="relative">
                    <Avatar name={conversationName(c)} id={c.visitor_id} />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${online ? "bg-green-500" : "bg-zinc-300"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`truncate text-sm ${c.unread ? "font-semibold" : "font-medium"}`}>{conversationName(c)}</span>
                      <span className="ml-auto shrink-0 text-xs text-zinc-400">{timeAgo(c.last_message_at, now)}</span>
                    </div>
                    <div className="truncate text-xs text-zinc-400">{site?.name}</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className={`flex-1 truncate text-sm ${typing ? "italic text-zinc-800" : "text-zinc-500"}`}>
                        {typing?.sender === "visitor" ? tr("Escribiendo…") : typing?.sender === "bot" ? tr("La IA está respondiendo…") : c.last_message}
                      </span>
                      {c.ai_agent_id && !c.ai_paused && c.status !== "closed" && (
                        <IconSparkle width={14} height={14} className="shrink-0 text-zinc-500" aria-label={tr("Atendido por IA")} />
                      )}
                      {c.status === "offline" && <Badge tone="amber">{tr("Offline")}</Badge>}
                      {c.unread > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-zinc-900 px-1.5 text-xs font-bold text-zinc-50">{c.unread}</span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selected ? (
        <ConversationView key={selected} id={selected} onBack={() => select(null)} />
      ) : (
        <div className="hidden flex-1 place-items-center text-sm text-zinc-400 md:grid">{tr("Elige un chat de la lista")}</div>
      )}
    </div>
  );
}

function ConversationView({ id, onBack }: { id: number; onBack: () => void }) {
  const { state, focus, openConversation, sendMessage } = useStore();
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  // Respuestas rápidas: escribir "/" abre el buscador.
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [pick, setPick] = useState(0);
  useEffect(() => {
    api<{ shortcuts: Shortcut[] }>("/api/shortcuts")
      .then((d) => setShortcuts(d.shortcuts))
      .catch(() => {});
  }, []);
  const listRef = useRef<HTMLDivElement>(null);
  const lastTyping = useRef(0);

  const conv = state.conversations[id] as Conversation | undefined;
  const messages = state.messages[id];
  const typing = state.typing[id];
  const live = conv ? state.visitors[conv.visitor_id] : undefined;
  const v = live?.visitor ?? visitor;
  const site = conv ? state.sites.find((s) => s.id === conv.site_id) : undefined;
  const closed = conv?.status === "closed";
  const ai = conv?.ai_agent_id ? state.aiAgents.find((a) => a.id === conv.ai_agent_id) : undefined;

  useEffect(() => {
    focus(id);
    openConversation(id)
      .then((d) => setVisitor(d.visitor))
      .catch((e) => setError(e.message));
    return () => focus(null);
  }, [id, focus, openConversation]);

  // Marcar como leído al verlo.
  const unread = conv?.unread ?? 0;
  useEffect(() => {
    if (unread > 0) api(`/api/conversations/${id}`, { method: "PATCH", body: { action: "read" } }).catch(() => {});
  }, [id, unread]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages?.length, typing?.text]);

  function onType(value: string) {
    setText(value);
    // Avisar "escribiendo" como mucho cada 2 s.
    if (value && Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      api(`/api/conversations/${id}/typing`, { body: { typing: true } }).catch(() => {});
    }
  }

  const slash = /^\/([^\s]*)$/.exec(text);
  const query = slash?.[1].toLowerCase() ?? "";
  const matches = slash
    ? shortcuts.filter((s) => s.shortcut.includes(query) || s.body.toLowerCase().includes(query)).slice(0, 8)
    : null;

  function insertShortcut(s: Shortcut) {
    // Sin nombre, "Hola {nombre}," queda "Hola,".
    const name = conv?.visitor_name ?? v?.name ?? "";
    const filled = s.body
      .replace(/ ?\{nombre\}/g, name ? ` ${name}` : "")
      .replace(/ ?\{agente\}/g, state.me?.name ? ` ${state.me.name}` : "")
      .replace(/ {2,}/g, " ")
      .trim();
    setText(filled);
    setPick(0);
  }

  // Foto: se comprime en el navegador y se envía con el texto escrito (si lo hay).
  const fileRef = useRef<HTMLInputElement>(null);
  async function attach(file: File) {
    if (closed) return;
    try {
      const data = await compressImage(file);
      const body = text.trim();
      setText("");
      await sendMessage(id, body, data);
    } catch (e) {
      setError(e instanceof Error && e.message !== "not-image" ? e.message : tr("Solo se pueden adjuntar imágenes"));
    }
  }

  function submit() {
    const body = text.trim();
    if (!body || closed) return;
    setText("");
    lastTyping.current = 0;
    sendMessage(id, body).catch((e) => setError(e.message));
  }

  if (error && !conv) return <div className="grid flex-1 place-items-center text-sm text-red-600">{error}</div>;
  if (!conv) return <div className="grid flex-1 place-items-center text-sm text-zinc-400">{tr("Cargando…")}</div>;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col bg-zinc-50">
        <div className="flex items-center gap-3 border-b border-zinc-200 bg-surface px-4 py-3">
          <button onClick={onBack} className="text-sm text-zinc-500 md:hidden">
            ←
          </button>
          <Avatar name={conversationName(conv)} id={conv.visitor_id} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-semibold">{conversationName(conv)}</span>
              <span className="shrink-0 whitespace-nowrap">
                {closed ? <Badge>{tr("Finalizado")}</Badge> : conv.status === "offline" ? <Badge tone="amber">{tr("Mensaje offline")}</Badge> : <Badge tone="green">{tr("En curso")}</Badge>}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
              {ai && !closed && (
                <span className="flex shrink-0 items-center gap-1 font-medium text-zinc-700">
                  <AiAvatar agent={ai} size={16} />
                  {conv.ai_paused ? tr("{name} en pausa ·", { name: ai.name }) : tr("Atiende {name} (IA) ·", { name: ai.name })}
                </span>
              )}
              <span className="truncate">
                {site?.name} · {live ? tr("En línea · viendo {page}", { page: live.visitor.page_title || shortUrl(live.visitor.current_url) }) : tr("Fuera del sitio")}
              </span>
            </div>
          </div>
          {ai && !closed && (
            <button
              className={`${btn.secondary} shrink-0 whitespace-nowrap`}
              onClick={() =>
                api(`/api/conversations/${id}`, { method: "PATCH", body: { action: conv.ai_paused ? "ai_resume" : "ai_pause" } }).catch((e) =>
                  setError(e.message),
                )
              }
            >
              {conv.ai_paused ? tr("Reactivar IA") : tr("Tomar el control")}
            </button>
          )}
          {messages && messages.length > 0 && (
            <button
              className={`${btn.secondary} shrink-0`}
              title={tr("Copiar conversación")}
              aria-label={tr("Copiar conversación")}
              onClick={async () => {
                const ok = await copyText(transcript(messages, conversationName(conv)));
                setCopied(ok);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <IconCopy width={16} height={16} />
              {copied && <span className="text-xs">{tr("Copiado")}</span>}
            </button>
          )}
          {!closed && (
            <button
              className={`${btn.secondary} shrink-0`}
              onClick={() => api(`/api/conversations/${id}`, { method: "PATCH", body: { action: "close" } }).catch((e) => setError(e.message))}
            >
              {tr("Finalizar")}
            </button>
          )}
        </div>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5 md:px-8">
          {!messages && <div className="text-center text-sm text-zinc-400">{tr("Cargando mensajes…")}</div>}
          {messages?.map((m) => (
            <MessageRow key={m.client_id} m={m} ai={m.sender === "bot" ? state.aiAgents.find((a) => a.id === m.agent_id) : undefined} />
          ))}
          {typing && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="flex gap-0.5 rounded-full bg-surface px-3 py-2.5 shadow-sm">
                <i className="fc-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
                <i className="fc-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
                <i className="fc-dot h-1.5 w-1.5 rounded-full bg-zinc-400" />
              </span>
              {typing.sender === "visitor" && typing.text ? (
                <span className="italic">
                  {tr("Escribiendo:")} <span className="text-zinc-700">«{typing.text}»</span>
                </span>
              ) : typing.sender === "bot" ? (
                tr("{name} está escribiendo…", { name: ai?.name ?? tr("La IA") })
              ) : (
                tr("Escribiendo…")
              )}
            </div>
          )}
        </div>

        {error && <div className="bg-red-50 px-4 py-1.5 text-xs text-red-700">{error}</div>}
        {closed ? (
          <div className="border-t border-zinc-200 bg-surface px-4 py-3 text-center text-sm text-zinc-500">{tr("Este chat ha finalizado.")}</div>
        ) : (
          <div className="relative flex items-end gap-2 border-t border-zinc-200 bg-surface p-3">
            {matches && (
              <div className="absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-surface shadow-xl">
                <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500">
                  <span>{tr("Respuestas rápidas")}</span>
                  <span>{tr("↑↓ elegir · Enter insertar · Esc cerrar")}</span>
                </div>
                {matches.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-zinc-500">
                    {tr("Ninguna coincide.")}{" "}
                    <Link href="/dashboard/shortcuts" className="underline">
                      {tr("Crear respuestas rápidas")}
                    </Link>
                  </div>
                ) : (
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {matches.map((s, i) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setPick(i)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertShortcut(s);
                          }}
                          className={`flex w-full gap-3 px-3 py-2 text-left text-sm ${i === pick ? "bg-zinc-100" : ""}`}
                        >
                          <span className="shrink-0 font-mono text-xs font-semibold text-zinc-900">/{s.shortcut}</span>
                          <span className="truncate text-zinc-600">{s.body}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) attach(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid h-10 w-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label={tr("Adjuntar foto")}
              title={tr("Adjuntar foto")}
            >
              <IconClip />
            </button>
            <textarea
              value={text}
              rows={1}
              onPaste={(e) => {
                const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
                if (f) {
                  e.preventDefault();
                  attach(f);
                }
              }}
              onChange={(e) => {
                onType(e.target.value);
                setPick(0);
              }}
              onKeyDown={(e) => {
                if (matches) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    if (matches.length) setPick((p) => (p + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
                    return;
                  }
                  if ((e.key === "Enter" || e.key === "Tab") && matches[pick]) {
                    e.preventDefault();
                    insertShortcut(matches[pick]);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setText("");
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              onBlur={() => api(`/api/conversations/${id}/typing`, { body: { typing: false } }).catch(() => {})}
              placeholder={
                ai && !conv.ai_paused
                  ? tr("Si escribes, {name} (IA) se retira de este chat", { name: ai.name })
                  : live
                    ? tr("Escribe tu respuesta… (Enter envía, / respuestas rápidas)")
                    : tr("El visitante ya no está en el sitio; verá tu respuesta si vuelve")
              }
              className={`${input} max-h-36 min-h-10 resize-none`}
              style={{ fieldSizing: "content" } as React.CSSProperties}
              autoFocus
            />
            <button onClick={submit} disabled={!text.trim()} className={`${btn.primary} h-10`} aria-label={tr("Enviar")}>
              <IconSend />
            </button>
          </div>
        )}
      </div>

      <VisitorPanel conv={conv} visitor={v} online={!!live} />
    </div>
  );
}

function MessageRow({ m, ai }: { m: Msg; ai?: AiAgent }) {
  if (m.sender === "system") return <div className="text-center text-xs text-zinc-400">{trSystem(m.body)}</div>;
  const mine = m.sender === "agent" || m.sender === "bot";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      {m.sender === "bot" && (
        <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
          {ai && <AiAvatar agent={ai} size={18} />}
          {m.author_name ?? "IA"} {tr("· IA")}
        </span>
      )}
      {m.attachment && <Attachment src={m.attachment} />}
      {m.body && (
        <div
          className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            m.sender === "bot"
              ? "rounded-br-md border border-green-200 bg-green-50 text-green-950"
              : mine
                ? "rounded-br-md bg-brand text-white"
                : "rounded-bl-md bg-surface text-zinc-800 shadow-sm"
          } ${m.pending ? "opacity-70" : ""}`}
        >
          {m.body}
        </div>
      )}
      <span className={`mt-0.5 px-1 text-[11px] ${m.failed ? "text-red-500" : "text-zinc-400"}`}>
        {m.failed ? tr("No se pudo enviar") : `${m.sender === "agent" && m.author_name ? `${m.author_name} · ` : ""}${clock(m.created_at)}`}
      </span>
    </div>
  );
}

function VisitorPanel({ conv, visitor, online }: { conv: Conversation; visitor: Visitor | null; online: boolean }) {
  const [tags, setTags] = useState(conv.tags ?? "");
  const [contact, setContact] = useState<Contact | null | undefined>(undefined);
  const b = browserInfo(visitor?.user_agent);

  useEffect(() => {
    api<{ contact: Contact | null }>(`/api/contacts?visitor_id=${conv.visitor_id}`)
      .then((d) => setContact(d.contact))
      .catch(() => setContact(null));
  }, [conv.visitor_id]);

  const rows: [string, React.ReactNode][] = [
    [tr("Ubicación"), visitor?.country ? `${flag(visitor.country)} ${visitor.country}` : "—"],
    ["IP", visitor?.ip ?? "—"],
    [tr("Página"), visitor?.current_url ? <a href={visitor.current_url} target="_blank" rel="noreferrer" className="break-all underline">{shortUrl(visitor.current_url)}</a> : "—"],
    ["Procedencia", visitor?.referrer ? shortUrl(visitor.referrer) : tr("Directo")],
    ["Navegador", `${b.browser} · ${b.os}${b.mobile ? tr(" · móvil") : ""}`],
    ["Visitas", visitor?.visits ?? "—"],
    [tr("Primera visita"), dateTime(visitor?.created_at)],
    [tr("Chat iniciado"), dateTime(conv.created_at)],
  ];

  return (
    <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-zinc-200 bg-surface xl:block">
      <div className="flex flex-col items-center border-b border-zinc-100 px-5 py-5 text-center">
        <Avatar name={conversationName(conv)} id={conv.visitor_id} size={56} />
        <div className="mt-2 font-semibold">{conversationName(conv)}</div>
        {visitor?.known_by_ip && (
          <span className="mt-1" title={tr("Nombre recuperado de otra visita desde la misma IP; confírmalo con el cliente")}>
            <Badge tone="amber">{tr("Reconocido por IP")}</Badge>
          </span>
        )}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
          <span className={`h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-zinc-300"}`} />
          {online ? tr("En el sitio ahora") : tr("Fuera del sitio")}
        </div>
        {conv.goals_met && <div className="mt-2 text-xs text-zinc-600">{tr("✓ Objetivos:")} {conv.goals_met}</div>}
      </div>

      <div className="border-b border-zinc-100 px-5 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{tr("Contacto (CRM)")}</h3>
        {contact === undefined ? (
          <p className="text-sm text-zinc-400">{tr("Cargando…")}</p>
        ) : (
          <ContactForm
            key={contact?.id ?? "new"}
            compact
            initial={contact ? { ...contact } : emptyContact({ name: visitor?.name ?? conv.visitor_name ?? "", email: visitor?.email ?? conv.visitor_email ?? "" })}
            onSave={async (f) => {
              const d = await api<{ contact: Contact }>("/api/contacts", { body: { ...f, visitor_id: conv.visitor_id } });
              setContact(d.contact);
            }}
          />
        )}
      </div>

      <dl className="space-y-3 px-5 py-4 text-sm">
        {rows.map(([k, val]) => (
          <div key={k}>
            <dt className="text-xs text-zinc-500">{tr(k)}</dt>
            <dd className="mt-0.5 text-zinc-800">{val}</dd>
          </div>
        ))}
      </dl>
      <form
        className="border-t border-zinc-100 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          api(`/api/conversations/${conv.id}`, { method: "PATCH", body: { tags } }).catch(() => {});
        }}
      >
        <label className="text-xs text-zinc-500" htmlFor="tags">
          {tr("Etiquetas del chat")}
        </label>
        <div className="mt-1 flex gap-2">
          <input id="tags" className={input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={tr("venta, soporte")} />
          <button className={btn.secondary}>{tr("OK")}</button>
        </div>
      </form>
      <div className="px-5 pb-5">
        <Link href={`/dashboard/history?q=%23${conv.visitor_id}`} className="text-xs font-medium underline">
          {tr("Ver chats anteriores de este visitante")}
        </Link>
      </div>
    </aside>
  );
}
