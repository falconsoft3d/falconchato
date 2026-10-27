# falconchato

Chat en vivo para tus sitios web, inspirado en Zopim / Zendesk Chat. Un widget ligero que se pega en cualquier web y un panel en tiempo real para el equipo. Backend sobre **falcondatabase**.

- **Widget** con una línea de código, colores y mensajes por sitio, formulario offline y valoración 👍/👎.
- **Tiempo real** por Server-Sent Events: los mensajes llegan en ~10 ms, con «escribiendo…» y vista previa de lo que teclea el visitante.
- **Panel**: visitantes en vivo (página, procedencia, navegador, país, IP), chats, chat proactivo, historial con filtros, analítica, sitios y equipo. Aviso «toc, toc» cuando entra un visitante.
- **Agentes IA con ChatGPT**: nombre, foto, personalidad e información del negocio. Atienden en el widget, guardan los datos del cliente en el CRM, persiguen los objetivos de cada web y pasan el chat a una persona cuando hace falta.
- **CRM integrado**: contactos y leads editables desde el chat o la página Contactos.
- **Por sitio**: agentes humanos asignados, varios agentes IA (en rotación), modo de IA y objetivos.
- **Reconocimiento por IP**: si vuelve alguien desde una IP conocida del mismo sitio, se recupera su nombre (marcado «por IP» para confirmarlo).
- **Título parpadeante** en la pestaña del sitio («Marlon: Hola que tal») cuando llega un mensaje con el chat minimizado.
- **Mensaje automático** por sitio: burbuja sobre el botón a los N segundos, contador y pestaña «(1) Tienes un mensaje nuevo».
- **Foto y nombre del agente** (humano o IA) en el widget minimizado y abierto, y «escribiendo» con burbuja animada.
- **Soporte en la home**: la página `/` lleva su propio widget atendido por el agente IA «Falco» (el sitio `home` se crea solo la primera vez).
- **Español e inglés** en la home, el login, el widget (según el navegador del visitante) y el panel (selector ES/EN).
- **Mi perfil**: foto, nombre, contraseña y, opcionalmente, email y WhatsApp de contacto que el cliente ve en la cabecera del widget (también en los agentes IA).
- **Respuestas rápidas**: escribe `/` en un chat para buscar e insertar respuestas guardadas (con `{nombre}` y `{agente}`).
- **Mapa de visitantes por país** (hoy, este mes, este año) en la página Visitantes.
- **Preguntas frecuentes**: se gestionan en el panel (por sitio o para todos), el visitante las lee en una pestaña del widget y la IA las usa para responder.
- **Fotos en el chat**: el visitante y el agente pueden adjuntar o pegar imágenes (se comprimen en el navegador y, de momento, se guardan con el mensaje; cuando actives el almacenamiento de falcondatabase conviene moverlas a un bucket).
- **Valoración con caras** (contento, normal, descontento) y comentario opcional al terminar el chat.
- **Copiar la conversación** desde el menú del widget o desde el chat del panel.
- **Efecto Matrix** opcional en el fondo del chat al abrirlo, y los cambios de un sitio (color, textos…) llegan al momento a los widgets abiertos.
- **Modo claro / oscuro / sistema** en la home, el login y el panel (el widget y la demo siempre en claro).
- **API lista para la app móvil**: el mismo backend acepta `Authorization: Bearer`.

## Puesta en marcha

```bash
cp .env.example .env.local   # rellena las claves del proyecto de falcondatabase
npm install
npm run dev                  # http://localhost:3000
```

| Variable | Qué es |
|---|---|
| `FDB_URL` | `https://falcondatabase.com` |
| `FDB_PROJECT` | ref del proyecto (20 letras) |
| `FDB_ANON_KEY` | clave anon: solo se usa para el login de agentes |
| `FDB_SERVICE_KEY` | clave service: lectura/escritura de datos. **Nunca** sale del servidor |
| `FDB_ADMIN_TOKEN` | opcional: token de IA de falcondatabase, solo para cambiar contraseñas (la API REST no lo permite) |
| `HOME_SITE_KEY` | opcional: clave del sitio de soporte de la home (por defecto `home`) |

Rutas útiles: `/login` (panel), `/demo?site=<clave>` (web de pruebas con el widget), `/dashboard/sites` (código de instalación).

### Instalar el widget en un sitio

En **Sitios y widget** crea el sitio y copia el código:

```html
<script async src="https://TU_DOMINIO/widget.js" data-site="CLAVE_DEL_SITIO"></script>
```

Desde la web se puede abrir con `FalconChato.open()` y cerrar con `FalconChato.close()`.

### Agentes humanos

Se crean en **Equipo → Añadir agente** (owner/admin). El servidor da de alta el usuario en el login de falcondatabase con la service key; el registro público sigue desactivado. Roles: `owner` y `admin` gestionan sitios, IA y equipo; `agent` atiende chats y edita contactos. Un agente desactivado no puede entrar.

### Agentes IA (ChatGPT)

1. **Agentes IA → Conexión con ChatGPT**: pega tu API key de OpenAI (se guarda cifrada con AES-256-GCM en la tabla `settings`; nunca vuelve al navegador) y elige el modelo.
2. Crea uno o varios agentes: foto, nombre, personalidad e información del negocio. Pruébalos en el chat de prueba.
3. En **Sitios y widget** asigna los agentes IA al sitio, elige el modo (*desactivada*, *cuando no hay nadie*, *siempre primero*) y define los **objetivos**.

La IA llama a tres herramientas: `save_contact` (CRM), `goal_achieved` (objetivos, visibles en Analítica) y `transfer_to_human` (pausa la IA en ese chat). Si responde una persona, la IA se retira de ese chat; desde la cabecera del chat se puede «Tomar el control» o «Reactivar IA». Si OpenAI falla, el chat queda para los humanos.

## Arquitectura

```
 sitio del cliente                      servidor Next.js (un proceso)                falcondatabase
┌──────────────────┐  iframe  ┌──────────────────────────────────────────┐  REST  ┌──────────────┐
│ /widget.js       │────────▶│ /widget/[siteKey]  ─┐                     │──────▶│ sites        │
│ (botón + iframe) │          │ /api/widget/*      ─┼─▶ bus pub/sub ──SSE─┼─▶ panel│ agents       │
└──────────────────┘          │ /api/*  (panel)    ─┘   + presencia      │       │ visitors     │
                              │                         + cachés         │       │ conversations│
                              └──────────────────────────────────────────┘       │ messages     │
                                                                                  └──────────────┘
```

- **Todas las escrituras pasan por Next.js.** Cada mensaje se publica en el bus en memoria y se empuja por SSE al instante; se guarda en falcondatabase después, en una cola por conversación que conserva el orden. Así la latencia no depende de la base de datos (~250 ms por llamada).
- **Tablas privadas**: solo la service key puede leerlas. Con la clave anon no se ve nada.
- **Presencia**: una conexión SSE abierta = visitante o agente en línea (con 6 s de gracia para recargas de página).
- **Login de agentes**: el token de falcondatabase va en una cookie `httpOnly` (web) o en `Authorization: Bearer` (móvil).

> **IP y privacidad:** la IP de cada visitante se guarda para reconocerle. Es un dato personal (RGPD): menciónalo en la política de privacidad de tus webs. En local todos los visitantes comparten la IP `::1`, así que el reconocimiento por IP no es significativo hasta producción.

> **Despliegue:** necesita **un único proceso Node de larga duración** (`npm run build && npm start`, Docker, VPS, Railway, Fly…). En serverless (Vercel) o con varias réplicas el bus en memoria no se comparte: habría que cambiarlo por Redis pub/sub en `src/lib/realtime.ts`. Si hay un proxy delante (nginx), desactiva el buffering para `/api/stream` y `/api/widget/stream` (la cabecera `X-Accel-Buffering: no` ya va incluida). Sirve la app por **HTTPS/HTTP2**: con HTTP/1.1 los navegadores limitan a 6 conexiones por dominio y cada pestaña del panel mantiene una conexión SSE abierta.

| Carpeta | Contenido |
|---|---|
| `public/widget.js` | script que se pega en los sitios (JS plano, sin dependencias) |
| `src/app/widget/[siteKey]` | interfaz del widget (dentro del iframe) |
| `src/app/dashboard/*` | panel de agentes |
| `src/app/api/*` | API (panel, widget y app móvil) |
| `src/lib/fdb.ts` | cliente REST de falcondatabase |
| `src/lib/realtime.ts` | bus pub/sub, SSE y presencia |
| `src/lib/chat.ts` | lógica del chat, cachés y cola de escritura |
| `src/lib/ai.ts` | agentes IA: OpenAI, herramientas, rotación y respuesta automática |
| `src/lib/contacts.ts` | CRM |
| `src/lib/i18n.ts`, `src/lib/i18n-en.ts` | traducciones: el texto en español es la clave; `tr("…")` devuelve el inglés si toca |
| `src/lib/seed.ts` | sitio y agente IA de soporte de la home |
| `src/components/ThemeSwitch.tsx` | tema claro/oscuro; en `globals.css` el modo oscuro invierte la escala gris |
| `src/components/dashboard/WorldMap.tsx`, `src/components/HeroMap.tsx` | mapa de visitantes y mapa decorativo de la home |

## API para la app móvil

Base: `https://TU_DOMINIO`. Todas las respuestas son JSON; los errores, `{"error": "mensaje"}` con su código HTTP (`401` = sesión caducada).

### Autenticación

```http
POST /api/auth/login
{"email": "ana@miempresa.com", "password": "…", "client": "mobile"}
→ {"agent": {...}, "token": "…", "expires_in": 604800}
```

Envía el token en todas las peticiones: `Authorization: Bearer <token>` (dura 7 días). `POST /api/auth/logout` lo olvida en el servidor.

### Tiempo real

`GET /api/stream` (SSE, con la cabecera Bearer). En React Native, por ejemplo con `react-native-sse`:

```js
const es = new EventSource(`${BASE}/api/stream`, { headers: { Authorization: `Bearer ${token}` } });
es.addEventListener("message", (e) => { const m = JSON.parse(e.data); /* … */ });
```

| Evento | Datos |
|---|---|
| `hello` | `{agents, online}` al conectar |
| `message` | `Message`: `{client_id, conversation_id, sender: "visitor"\|"agent"\|"bot"\|"system", body, author_name, agent_id, created_at}` (en `bot`, `agent_id` es el id del agente IA) |
| `conversation` | `Conversation` creada o actualizada (estado, no leídos, etiquetas…) |
| `typing` | `{conversation_id, sender: "visitor"\|"agent"\|"bot", typing, text}`: `text` es la vista previa del visitante |
| `visitor` / `visitor_left` | visitante en línea (`LiveVisitor`) / `{id}` cuando se va |
| `agents` | presencia de los agentes |

Al reconectar, vuelve a pedir `/api/conversations` y `/api/visitors` para resincronizar. Los tipos están en `src/lib/types.ts`.

### Endpoints

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/me` | agente actual |
| PATCH | `/api/me` | `{"status": "online"\|"away"\|"invisible", "name"?}` |
| GET | `/api/conversations` | chats activos (abiertos y offline) |
| GET | `/api/conversations?scope=history&status=served\|missed\|offline\|open&rating=good\|bad&site=&from=YYYY-MM-DD&to=&q=&page=` | historial (25 por página; `q=#123` = visitante 123) |
| POST | `/api/conversations` | chat proactivo `{"visitor_id", "body"}` |
| GET | `/api/conversations/:id` | `{conversation, messages, visitor, visitor_online}` |
| PATCH | `/api/conversations/:id` | `{"action": "close" \| "read" \| "ai_pause" \| "ai_resume"}` o `{"tags": "a, b"}` |
| POST | `/api/conversations/:id/messages` | responder `{"body", "client_id"?, "attachment"?}` (`attachment`: data URL de imagen) |
| POST | `/api/conversations/:id/typing` | `{"typing": true\|false}` |
| GET | `/api/visitors` | visitantes en línea |
| GET | `/api/agents` | equipo y presencia |
| POST | `/api/agents` | alta `{"name", "email", "password", "role"}` (owner, admin) |
| PATCH | `/api/agents/:id` | `{"name"?, "avatar"?}` (uno mismo) · `{"role"?, "disabled"?}` (owner, admin) |
| POST | `/api/agents/:id/password` | restablecer contraseña `{"password"}` (owner, admin) |
| POST | `/api/me/password` | cambiar la propia `{"current", "password"}` |
| GET | `/api/contacts?q=&status=lead\|qualified\|customer\|lost&site=&page=` | CRM (50 por página) |
| GET | `/api/contacts?visitor_id=` | contacto de un visitante |
| POST | `/api/contacts` | guardar `{visitor_id?, name, email, phone, company, status, tags, notes}` |
| GET/PATCH/DELETE | `/api/contacts/:id` | ver (con sus chats) / editar / borrar |
| GET | `/api/ai/agents` | agentes IA (nombre, foto) para pintar sus mensajes |
| GET/POST | `/api/shortcuts` | respuestas rápidas `{"shortcut", "body"}` |
| PATCH/DELETE | `/api/shortcuts/:id` | editar / borrar |
| GET | `/api/geo?period=day\|month\|year&tz=&site=` | visitantes únicos por país |
| GET/POST | `/api/faqs` | preguntas frecuentes `{"question", "answer", "site_id"?, "is_active"?}` (editar: owner, admin) |
| PATCH/DELETE | `/api/faqs/:id` | editar / borrar (`position` para ordenar) |
| GET | `/api/analytics?days=7&tz=<getTimezoneOffset>&site=` | serie diaria y totales |
| GET/POST | `/api/sites` | listar / crear (owner, admin) |
| PATCH/DELETE | `/api/sites/:id` | editar (owner, admin) / borrar (owner) |

Usa `client_id` (UUID) en los mensajes que envíes: el eco que llega por SSE trae el mismo `client_id`, así sustituyes el mensaje optimista sin duplicarlo.

**Pendiente para la app:** notificaciones push cuando la app está en segundo plano (registrar el token de Expo/FCM en una tabla `devices` y enviarlo desde `postMessage` en `src/lib/chat.ts` a los agentes sin conexión SSE).

## Traducciones

Envuelve cualquier texto nuevo de la interfaz con `tr("Texto en español")` (de `@/lib/i18n`) y añade su versión en `src/lib/i18n-en.ts`. Admite variables: `tr("Hola, {name}", { name })`. Sin traducción se muestra el español.
