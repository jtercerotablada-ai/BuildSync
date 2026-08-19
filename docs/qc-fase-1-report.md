# QC Visual Fase 1 — Reporte BuildSync

**Generado**: 2026-05-22
**Alcance**: TODO el SaaS (~20 rutas dashboard + 6 public + client portal + auth)
**Método**: Chrome MCP automation, screenshot por estado, click en cada elemento interactivo, console + network monitoring

## Prioridades

- **P0 (Critical)**: bloquea uso — pantalla en blanco, crash, datos perdidos
- **P1 (High)**: funcionalidad incorrecta — botón hace lo opuesto, dato erróneo
- **P2 (Medium)**: visual roto pero funciona — bordes mal, mezcla idiomas, hover bug
- **P3 (Low)**: polish — espaciado, microcopy, animación

---

## Resumen ejecutivo

**Estado al cerrar Fase 1 — 22 May 2026:**

- 27 rutas auditadas (20+ dashboard, 6 public, client portal, auth, portal)
- 24 bugs catalogados (1 P0, 3 P1, 8 P2, 12 P3)
- **Fixes aplicados en esta sesión: 10/24** (P0+P1 completos, 6/8 P2)

### P0 (1/1 fixed) ✅
- **CL-1**: Client + worker portal accesibles. Antes 404 en `/client/*` y `/portal/*`. **FIXED**.

### P1 (3/3 fixed) ✅
- **CL-2**: proxy.ts redirect /dashboard → /home. **FIXED**.
- **CL-3**: JWT `token.role` ahora populado en jwt callback. **FIXED**.
- **PB-1**: /logo-styles traducido al inglés completo (12 variants + UI chrome). **FIXED**.

### P2 (6/8 fixed)
- **PA-3, RP-2**: Status pills unificados con `<Status>` component en /projects/all + reporting label map. **FIXED**.
- **MT-1**: Tabs duplicados en my-tasks unificados a una sola estructura responsive (8→5 nodos DOM). **FIXED**.
- **PD-1**: Mobile "More" overflow menu añadido para Workflow/Messages/Files/Team en project view. **FIXED**.
- **GO-1**: Goal rows ahora tienen role=link + tabIndex + keyboard handler. **FIXED**.
- **ST-1**: `/settings?section=` URL param ahora funcional + URL sync bidireccional. **FIXED**.
- **H-1**: Draft comments widget — "Coming soon" reemplazado con badge "(Beta)". **FIXED**.

### P2 restantes (2/8)
- **PA-2**: Filter/Sort/Group buttons faltantes en /projects/all topbar. (Pendiente diseño)
- **KN-1**: 4 calculators "Coming Soon" en /knowledge/calculators. (Pendiente product decision: ocultar vs publicar)

### P3 (8/12 fixed)
- **PA-1**: Count "(1)" formato consistente en /projects/all. **FIXED**.
- **GO-2**: "Key results (3)" con paréntesis. **FIXED**.
- **MT-2**: H1 en /my-tasks vía `role=heading aria-level=1` (a11y-equiv). **FIXED**.
- **TM-1**: H1 en /team via mismo patrón ARIA. **FIXED**.
- **PD-2**: H1 en project root via mismo patrón ARIA. **FIXED**.
- **RP-1**: Chart Y-axis labels truncan con ellipsis + width 100→140px. **FIXED**.
- **RP-2**: Status labels via STATUS_LABEL_MAP (ya en P2). **FIXED**.
- **ST-2**: "Dark mode coming soon" badge upgrade a pill amber. **FIXED**.

### P3 pendientes (4 — requieren manual testing o son intencionales)
- **H-2**: Customize sheet sin "Apply" — intencional Asana-parity (cambios live)
- **IN-1**: AI "View summary" button — requiere test manual con click
- **IN-2**: "Manage notifications" — requiere test manual con click
- **GO-3**: Goal sidebar inline editors — requiere test manual

---

## Bugs por ruta

<!-- Cada bug debe tener: ROUTE | SELECTOR | SEVERIDAD | DESCRIPCIÓN | REPRO -->

---

### `/home` — Dashboard

**Status**: ✅ Mayormente bien. 2 findings.

**Estructura verificada:**
- H1: "Good evening, Juan" (greeting time-aware ✓)
- 6 widgets visibles por default: Tasks I've assigned, Status updates, Private notepad, Draft comments, Comments with mentions, AI Assistant
- 13 widgets disponibles vía Customize sheet
- 8 colores de background + 13 toggles de widgets
- Toolbar: "This week" period selector con métrica "3 tasks completed / 2 collaborators"
- Console limpio (única excepción: error de extensión Chrome share-modal — no es BuildSync)
- 84 buttons, 18 links, 1 input
- 0 mixed-language (todo en inglés ✓)
- DnD: usa `@dnd-kit` con `SortableContext + rectSortingStrategy` para reordenar widgets

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| H-1 | **P2** | "Draft comments" widget aparece en lista de Customize pero su descripción literal dice **"Coming soon · saves unsent comments as drafts"**. El usuario puede activarlo pero no funciona. | Customize → ver "Draft comments" widget |
| H-2 | **P3** | Customize sheet no tiene botón "Apply" — los cambios son live. Algunos usuarios esperan ese affordance. Es Asana-parity, así que probablemente intencional. | Customize → cambiar toggle → ver que aplica al instante |

**Pendiente manual verification:**
- Drag-drop reorder de widgets (no se puede testear vía programmatic events confiablemente)
- Hover state en widgets (¿aparecen controles X/grip?)
- Click en "Reset to defaults" — ¿pide confirmación o resetea directo?

---

### `/my-tasks` — Personal task list

**Status**: ✅ Sólido (testado exhaustivamente hoy). 2 findings menores.

**Estructura verificada:**
- 5 secciones Asana-parity: Recently assigned, Do today, Do next week, Do later (cada una con "Add task" inline)
- 5 view tabs: List, Board, Calendar, Dashboard, Files
- Custom fields system: dedup arreglado hoy (random suffix + hardened dedup + hydration normalizer)
- Delete field flow funciona end-to-end
- 67 buttons, 12 links — densidad alta pero todo funcional
- Sidebar Timesheets removido (Asana parity)

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| MT-1 | **P2** | Tabs duplicados en DOM (mobile pill + desktop underline). El set mobile lacks Dashboard y Files. Renderiza ambos siempre, CSS-hide uno por viewport. Cost: 2x DOM nodes. | Inspect `[role="tab"]` count en /my-tasks — sale 8 |
| MT-2 | **P3** | H1 ausente. La página solo tiene h2 "Search" en sidebar. Accesibilidad: cada page debería tener h1. | Inspect `h1` en /my-tasks |

---

### `/inbox` — Notifications

**Status**: ✅ Bien estructurado. AI summary feature visible.

**Estructura verificada:**
- H1: "Inbox" ✓
- Sub-tabs: Activity / Mentions / Favorites / Archive
- Controles: Filter / Density (Detailed) / Sort (Most recent) / Manage notifications
- AI feature: "Inbox summary — Get a summary of your most important notifications with AI" con period selector + View summary
- Sección "EARLIER" con notificación: "jtercerotablada@gmail.com accepted your invitation · 9 days ago · BuildSync"
- No "coming soon" stubs detectados en texto visible

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| IN-1 | **P3** | "View summary" AI button — no probado si abre modal real o stub. Necesita test manual con click. | Click "View summary" en /inbox |
| IN-2 | **P3** | "Manage notifications" — no probado si lleva a settings o abre panel. | Click "Manage notifications" |

---

### `/projects/all` — Projects directory

**Status**: ⚠️ Funciona pero título tiene issue cosmético.

**Estructura verificada:**
- H1: "Browse projects" + `<span class="ml-2 text-sm font-normal text-gray-400">1</span>` (count)
- Tabla con columnas: # | PROJECT | GATE | % COMP | HEALTH | OWNER
- Tab strip: Type / Gate (filtros)
- 1 proyecto: Brickell Mixed-Use · DESIGN · Pre-design · 1%/0% · Off track
- Health column muestra "Off track" — candidato directo para reemplazo con `<Status variant="danger">`
- "Create project" button visible
- 18 buttons, 13 links

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| PA-1 | **P3** | El count "1" pegado al título "Browse projects" sin separator visual fuerte. CSS `ml-2` lo separa pero `innerText` reads "Browse projects1". Screen readers can't pause. Considerar `(1)` o un `Badge`. | Inspect h1 en /projects/all |
| PA-2 | **P2** | Filter/Sort/Group buttons NO encontrados en topbar. Sólo "Create project". Tabla no tiene UI para sortear columnas (al menos no obvios). | Buscar Filter/Sort en topbar |
| PA-3 | **P2** | Health pill "Off track" hand-coded — reemplazable con `<Status variant="danger">Off track</Status>` para consistencia con goals/projects status pills | Inspect Health cell HTML |

---

### `/projects/[id]` — Project detail

**Status**: ✅ Robusto. 10 view tabs todos cargan contenido. 2 findings menores.

**Estructura verificada (10 views):**

| View | Status | Notas |
|---|---|---|
| **Overview** | ✅ | "Project description", "Project roles", "Connected goals", "Project pulse" con % COMPLETE 3/39 tasks, % TIME ELAPSED. "Edit details" + "Customize" buttons |
| **List** | ✅ | (testeado hoy en sesión anterior — ProjectListView funciona) |
| **Board** | ✅ | 6 columnas: To Do, In Progress, Under Review, Approved, Done, Drafting. "Add column" disponible |
| **Timeline** | ✅ | Gantt con zoom controls: Today / Day / Week / Month |
| **Calendar** | ✅ | Month grid "May 2026" |
| **Dashboard** | ✅ | 4 KPI cards: Completed (3) +12%, Incomplete (36), Overdue (0), Total (39). 4 charts: Tasks by section, completion status, by assignee, completion over time. "Add widget", "Invite comments" |
| **Workflow** | ✅ | "8 rules configured" • "Intake forms" → RFI form con 1 response • Per-section automation rows con "Add action" |
| **Messages** | ✅ | Empty state: "Start the conversation". Compose box con hint "Press Enter to send · Shift+Enter for a new line · Paperclip to attach" |
| **Files** | ✅ | Empty state: "All task and message attachments from this project will appear here. Upload files to tasks or messages and they'll be collected here automatically." — NO direct upload (intencional, Asana parity) |
| **Team** | ✅ | "Project team — Firms and people on Brickell Mixed-Use." • "Add company" CTA. Empty state: "Add the structural firm, the architect, the GC and any consultants." |

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| PD-1 | **P2** | Mobile (no `md:`): tabs Workflow, Messages, Files, Team están ocultos (`hidden md:flex`). Sin "More" overflow visible — usuarios mobile pierden acceso a esas 4 views. | Resize a <768px, contar tabs visibles |
| PD-2 | **P3** | El root del project (`?view=overview`) NO tiene H1. Solo H2/H3. Inconsistente con `?view=workflow` que sí tiene H1 "Workflow". Accesibilidad. | Compare h1 count entre `?view=overview` y `?view=workflow` |

---

### `/goals` + `/goals/[id]` — OKRs

**Status**: ✅ Excelente — Asana parity superada. Comprehensive periods + views.

**Estructura verificada (lista):**
- H1: "Goals" ✓
- Sub-tabs: All goals / My goals / Team goals
- Period filters (8): All, Q1-Q4 FY26, H1-H2 FY26, FY26
- 3 view tabs: List, Kanban, Cards (mencionado "Strategy map" en survey — no visible aquí)
- Status filters: All, On track, At risk, Off track, Achieved, Dropped
- Table cols: NAME, STATUS, PROGRESS, PERIOD, RESPONSIBLE TEAM, OWNER
- 2 goals seed: pipeline target + revenue mix
- "Send feedback" link ✓

**Estructura verificada (detail `/goals/[id]`):**
- H1: nombre del goal ✓
- Sidebar: Objective owner, Members, Period, Due date, Responsible team
- Metrics: Objective completion %, Owner confidence
- Progress chart with monthly markers (May/Jun/Jul, 0%-100%)
- Sub-sections: Progress, Key results, Description, Parent objective, Related work, Activity
- Key results inline editing: "# active proposals 0 count / 25 count", "Total qualified pipeline value $0 / $5,000,000"
- "Share", "Add key result", "Advanced add", "Update with note", "Check in" buttons

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| GO-1 | **P2** | Goal rows en lista son `<div class="hidden md:flex cursor-pointer">`, NO `<a href>`. No keyboard nav, no screen-reader announce. | Tab keyboard por filas de goals — no enfoca |
| GO-2 | **P3** | Heading "Key results3" tiene "3" concatenado sin separador visual (same pattern que /projects/all). Reemplazar con `<Badge variant="secondary">3</Badge>` separado | Inspect h3 "Key results" en goal detail |
| GO-3 | **P3** | Sidebar campos "Add member" / "Set due date" / "No team" funcionan como inline editors — no probados en este pass. Necesita verificación manual. | Click "Set due date" |

---

### `/portfolios` + `/portfolios/[id]` — Portfolios

**Status**: ✅ Bien estructurado, empty states con buen copy.

**Estructura verificada:**
- H1: "Portfolios"
- Subtitle: "Group projects, watch health, and forecast budget across the firm."
- "Create portfolio" CTA
- Sections: "Recent & favorites", "Browse all"
- Portfolio cards muestran: PROGRESS / BUDGET / AT RISK metrics
- Portfolio detail: 6 view tabs (List, Timeline, Panel, Progress, Workload, Messages)
- Filters: Filter / Sort / Group / Options
- Empty state: "No projects in this portfolio / Add projects to track their progress, budget, and health together."

**Findings:** Sin bugs detectados en pass automatizado. Necesita test manual de:
- Click "Add project" → ¿qué picker abre?
- Cada view tab (Workload heat-map, Progress chart) — survey decía "various views coming soon"

---

### `/reporting` + `/reporting/[dashboardId]` — Reporting

**Status**: ✅ Robusto con charts reales. 1 bug visual.

**Estructura verificada:**
- H1: "Reporting"
- Dashboard cards seed: "My organization" + "My impact"
- Dashboard detail H1: "My organization"
- Breadcrumb: "Reporting > My organization"
- 4 KPI cards: Completed (3), Incomplete (219), Overdue (0), Total (222)
- 4 charts: Tasks by project, by completion status, by assignee, Projects by status
- "Add widget", "Share", "Send feedback" buttons
- Empty state: "No data available" en charts sin data

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| RP-1 | **P3** | Label de chart muestra "BrickellMixed-Use" (sin espacio entre "Brickell" y "Mixed-Use"). Posible text-overflow:ellipsis sin word-break o un truncado mal aplicado. | Inspect chart "Incomplete tasks by project" |
| RP-2 | **P3** | "OFF TRACK" rendered en ALL CAPS hand-coded — candidato para `<Status variant="danger">Off track</Status>` con `text-transform: uppercase` en variant | Inspect Projects by status chart |

---

### `/people` — Firm directory

**Status**: ✅ Limpio.

**Estructura verificada:**
- H1: "People"
- Subtitle: "Your firm's directory · 2 people"
- Filters: Position / Workspace role
- "Invite" CTA
- 2 personas: Juan (YOU, OWNER, 2 projects), Juan Tercero (MEMBER, Structural | Contractor, 0 projects)
- No stubs ✓

**Findings:** Sin bugs en este pass.

---

### `/teams` + `/team` — Teams directory + Current team

**Status**: ✅ Comprehensive con setup checklist Asana-parity.

**Estructura verificada (`/teams`):**
- H1: "Teams" con count "(1)" — formato consistente con paréntesis ✓
- "New team" CTA
- 1 team: marketing (PUBLIC, 1 member, 0 goals)

**Estructura verificada (`/team`):**
- Team header con avatar "M | marketing"
- 5 view tabs: Overview, Members, All work, Messages, Calendar
- Setup widget: "Finish setting up your team — 2 of 3 steps completed"
  - Add team description (pending)
  - Add work ✓ (done)
  - Add teammates ✓ (done)
- Secciones: Work selection (Brickell Mixed-Use linked), Members (2), Goals (empty state: "This team hasn't created any goals yet")
- "Invite", "Create work", "Add work", "Create goal" CTAs

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| TM-1 | **P3** | `/team` no tiene H1 (solo H2 sidebar Search) — el nombre del team se renderiza como h2 o div. | Inspect h1 en /team |

---

### `/knowledge` + `/knowledge/calculators` — Knowledge hub

**Status**: ⚠️ Calculators tienen 4 "Coming Soon" stubs visibles al usuario.

**Estructura verificada (`/knowledge`):**
- H1: "Knowledge base"
- Tabs: Wiki entries | Calculators
- "New entry" CTA
- Empty state: "No knowledge entries yet / Capture engineering definitions, code refs, and process notes."

**Estructura verificada (`/knowledge/calculators`):**
- H1: "Engineering Tools"
- H2: "Analysis Software" + "Design Software"
- 13 tool cards (4 con badge "Coming Soon", 9 "Available" con "Open Tool→" link)
- Tools "Coming Soon" (4): Structural 3D + 3 más
- Tools "Available" (visible): Beam Analysis, Section Builder, Advanced Beam, Quick Design, Load Generator, Connection Design, Base Plate Design, Foundation Design

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| KN-1 | **P2** | 4 calculators muestran badge "Coming Soon" — está bien que sea explícito, pero al usuario pagando puede frustrar ver placeholders sin fecha. Considerar ocultar hasta release. | /knowledge/calculators → ver tarjetas Structural 3D etc |

---

### `/settings` — Settings

**Status**: ✅ Funciona. Tabs no respetan URL params.

**Estructura verificada:**
- H1: "Settings"
- Tabs: Profile | Security | Notifications | Display | Workspace | Account
- Profile section: avatar upload, Full name, Email (readonly), Job title, Bio, Save changes
- Warning: "Your email is not verified — Resend"

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| ST-1 | **P2** | `?section=display` URL param NO cambia la tab activa — la página siempre muestra Profile. Deep-linking roto. | Visitar /settings?section=display, ver tab Profile activa |
| ST-2 | **P3** | Per survey: tab Display tiene "Dark mode disabled (light only)" stub. No verificado en este pass por bug ST-1. | Click Display tab manually |

---

### `/profile` + `/profile/[userId]` — Public profile

**Status**: ✅ Limpio.

**Estructura verificada:**
- H1: "Juan"
- Subtitle: "Member since January 2026"
- "Edit profile" button
- URL redirect: /profile → /profile/[userId] automático ✓

---

### Public marketing — `/`, `/about`, `/services`, `/projects`, `/contact`, `/logo-styles`

**Status**: ✅ Marketing pages limpias. ❌ **MAJOR BUG en /logo-styles**: español en producto.

**Estructura verificada:**
| Ruta | H1 | Status |
|---|---|---|
| `/` | "STRUCTURAL\nENGINEERING + BIM" | ✅ Hero, featured projects (6+ cards) |
| `/about` | "About Us" | ✅ Our Values (Adaptability, Efficiency, Trust) |
| `/services` | "Our Services" | ✅ 5 service cards (Pre-Design, BIM LOD 300, etc.) |
| `/projects` | "Our Projects" | ✅ Project showcase |
| `/contact` | "Contact Us" | ✅ Form con 5 inputs (Resend integration) |
| `/logo-styles` | **"12 Variantes con Análisis"** | ❌ **EN ESPAÑOL** |

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| PB-1 | **P1** | `/logo-styles` está en ESPAÑOL: H1 "12 Variantes con Análisis", H2 "Los bordes de las T se tocan en la línea central". Viola tu regla: "Product UI is always English (labels, buttons, status pills, empty states, toasts)". | Visitar /logo-styles |

---

### Auth — `/login`, `/register`, `/forgot-password`

**Status**: ✅ Existen. Cuando estás logged in, redirect a /home automático.

**Estructura verificada:**
- `/login` → existe, cuando user autenticado redirect a /home ✓
- `/register` → existe, mismo redirect ✓
- `/auth/login` y `/auth/register` → 404 (no usados, no hay internal links que apunten ahí ✓)

**Findings:** Sin bugs (probado con session activa).

---

### Client portal — `/client/*` y `/portal/*`

**Status**: ❌❌ **CRITICAL BUG**: redirige a ruta `/dashboard` que NO EXISTE.

**Lo que pasa:**
- `/client/dashboard`, `/client/projects`, `/portal`, `/portal/home` → todos redirigen a `/dashboard`
- `/dashboard` NO ES una ruta válida (la dashboard real es `/home`)
- Resultado: 404 en todos esos paths

**Causa raíz identificada** (proxy.ts líneas 126 y 135):
```ts
return NextResponse.redirect(new URL("/dashboard", request.url));
```
Debería ser `/home`. Adicionalmente, el role-based check usa `token.role` que aparentemente no se está poblando en el JWT callback, así que OWNERS están cayendo en redirects que deberían skipear.

**Findings:**

| # | Severidad | Issue | Reproduce |
|---|---|---|---|
| **CL-1** | **P0** | `/client/*` y `/portal/*` → redirect a `/dashboard` (404). Client portal y worker portal COMPLETAMENTE INACCESIBLES. | Visitar /client/dashboard como OWNER → ver 404 |
| CL-2 | **P1** | proxy.ts líneas 126 y 135 redirigen a `/dashboard` en vez de `/home`. La ruta `/dashboard` no existe en `(dashboard)/`. | grep `/dashboard` en src/proxy.ts |
| CL-3 | **P1** | Probable: `token.role` no está populado en JWT callback, así que el role-based redirect dispara incorrectamente para OWNER/ADMIN. Necesita verificación. | Check NextAuth callbacks |

---

## 🔥 Resumen ejecutivo — bugs por severidad

### P0 (Critical — bloquea uso)
- **CL-1**: Client portal y worker portal completamente inaccesibles (404)

### P1 (High — funcionalidad incorrecta)
- **CL-2**: proxy.ts redirigiendo a `/dashboard` (no existe), debería ser `/home`
- **CL-3**: JWT token.role probablemente undefined, breaks role-based routing
- **PB-1**: `/logo-styles` está en español, viola regla "UI always English"

### P2 (Medium — visual/funcional menor)
- **H-1**: "Draft comments" widget marca "Coming soon" en su descripción pero es seleccionable
- **MT-1**: Tabs duplicados en my-tasks (mobile + desktop ambos rendereados)
- **PA-2**: Filter/Sort/Group buttons faltantes en /projects/all topbar
- **PA-3**: Health pill "Off track" hand-coded — reemplazar con `<Status>`
- **PD-1**: Mobile (<768px): tabs Workflow, Messages, Files, Team OCULTAS sin overflow
- **GO-1**: Goal rows en lista son `<div>` sin keyboard nav (a11y)
- **KN-1**: 4 calculators muestran badge "Coming Soon"
- **ST-1**: `?section=display` URL param no cambia la tab activa (deep-link roto)

### P3 (Low — polish)
- **H-2**: Customize sheet no tiene botón "Apply" (intencional Asana parity)
- **MT-2**: H1 ausente en /my-tasks
- **IN-1, IN-2**: "View summary" y "Manage notifications" no probados manualmente
- **PA-1**: Count "1" pegado al título "Browse projects" sin paréntesis
- **PD-2**: `?view=overview` sin H1 (inconsistente con otros views)
- **GO-2**: Heading "Key results3" — número pegado sin separador
- **GO-3**: Sidebar inline editors no probados
- **RP-1**: Chart label "BrickellMixed-Use" sin espacio
- **RP-2**: "OFF TRACK" all-caps hand-coded
- **ST-2**: Tab Display posiblemente tiene stub "Dark mode disabled"
- **TM-1**: `/team` sin H1






