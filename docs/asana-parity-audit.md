# BuildSync ↔ Asana — Auditoría de Paridad

> Análisis exhaustivo de Asana vs BuildSync con el objetivo de **fidelidad funcional + estructural máxima**, manteniendo la identidad de marca de BuildSync (color, logo, copy).
>
> Documento vivo. Última actualización: 2026-05-20.

---

## A. Resumen general de similitud actual

**Estado global:** BuildSync está al **~70%** de paridad con Asana, con varias áreas donde ya **supera** Asana y otras donde quedan gaps reales.

| Área | Estado | Notas |
|---|---|---|
| Home dashboard | 90% | 9 widgets implementados; varios superan Asana (StatusUpdates per-project rollup, ⋯ menú custom, Goals 3 tabs) |
| My Tasks page | 75% | 5 vistas existen (List/Board/Calendar/Dashboard/Files); Calendar le falta view selector + inline create; Dashboard le falta "+ Add widget" + per-chart filter UI |
| Inbox | 60% | Tabs base + AI summary; faltan: Period selector del summary, "View summary" CTA visible, notification grouping por entidad |
| Projects page | sin auditar | task #4 pending |
| Portfolios | sin auditar | task #5 pending |
| Goals | sin auditar (página completa) | widget cubierto; full page pendiente |
| Reporting | sin auditar | task #7 pending |
| Sidebar global | 80% | Tiene Home/MyTasks/Inbox/People + Insights + Projects/Teams; falta sección "Favoritos" |
| Botón global +Crear | 85% | Existe arriba sidebar; falta auditar contenido del dropdown vs Asana ("+ Crear" expande a Tarea/Proyecto/Mensaje/Portafolio/Objetivo/Equipo/Invitar) |
| Sistema de notificaciones | sin auditar a fondo | producer/consumer chain |
| Detail panel de task | 85% | Side panel + Full page; falta Section selector en panel |
| Estilo visual / gridlines | 75% | List view recién pusheado fix de gridlines (commit `a8fa550`) |

---

## B. Funcionalidades faltantes

### B.1 Alta prioridad (FUNCIONAL, paridad core)

| # | Faltante | Dónde |
|---|---|---|
| F1 | **Period selector en Inbox AI summary** ("Semana anterior" dropdown) | `/inbox` AI summary card |
| F2 | **"View summary" CTA button** visible en AI summary card | `/inbox` |
| F3 | **Notification grouping** por entidad ("Tus tareas para hoy" agrupa varias) | `/inbox` |
| F4 | **Sort dropdown visible** en /inbox toolbar (Most recent / Relevance) | Existe en código pero no renderiza |
| F5 | **+ Custom tab** en /inbox tabs | `/inbox` |
| F6 | **"Manage notifications"** link arriba derecha | `/inbox` (existe en código pero no se ve) |
| F7 | **"Hoy / Ayer / Últimos 7 días"** sections en /inbox (BuildSync solo muestra "THIS WEEK") | `/inbox` |
| F8 | **Calendar view selector** (Mes / Semana) | `/my-tasks` Calendar tab |
| F9 | **Calendar inline + Add task** al hover sobre una cell | `/my-tasks` Calendar tab |
| F10 | **Dashboard "+ Add widget"** botón | `/my-tasks` Dashboard tab |
| F11 | **Dashboard per-chart "Ver todo" links** + filter UI clickable | `/my-tasks` Dashboard tab |
| F12 | **Section selector** (dropdown "Asignadas recientemente ▼") en task detail panel | task detail side panel |
| F13 | **"Personalizar" panel** del project view (Rules / Fields / Apps) | `/my-tasks` y `/projects/[id]` |
| F14 | **"+ Add custom view" tab** después de los view tabs | `/my-tasks` tab bar |
| F15 | **Sidebar "Favoritos" section** con portafolios marcados | Sidebar global |
| F16 | **Sidebar secciones colapsables** ("Análisis de datos / Favoritos / Proyectos / Equipos" con expand toggle) | Sidebar global |
| F17 | **+ Add custom column** en header de columnas (separado del dropdown actual) | `/my-tasks` List view |
| F18 | **Date range UI** en task widget Home y List view ("mayo 14 – 28" como banda continua) | varios |
| F19 | **AssignedTasks producer**: no hay UI que escribe a `uiState.draftComments` (orphan widget) | DraftCommentsWidget |
| F20 | **Search local de tasks** en /my-tasks action row (icono lupa) | `/my-tasks` |

### B.2 Media prioridad

| # | Faltante | Dónde |
|---|---|---|
| M1 | Per-project "..." menu en Recent Projects widget (Pin / Hide) | Home widget |
| M2 | Like / heart action en notificaciones individuales | `/inbox` |
| M3 | Right-click context menu en task rows | `/my-tasks` List view |
| M4 | Keyboard shortcuts visible help (Cmd+K palette tipo Asana) | Global |
| M5 | "Mostrar más widgets" link al fondo del Home (Asana lo tiene) | `/home` |
| M6 | Pin/Star button per person en People widget | Home widget |

### B.3 Baja prioridad / features complejas

| # | Faltante | Dónde |
|---|---|---|
| L1 | Rules engine (automation, Asana "Reglas") | Personalizar panel |
| L2 | Custom fields management UI | Personalizar panel |
| L3 | Apps integration management | Personalizar panel |
| L4 | "+ Add custom inbox tab" (custom filters as tabs) | `/inbox` |
| L5 | Timeline view (Gantt) en /my-tasks | Tab |
| L6 | "Agregar tareas por IA" handler real (UI existe) | Header dropdown |
| L7 | "Agregar tareas por email" handler real | Header dropdown |
| L8 | Sync/export real (iCal, Google Sheets, JSON) | Header dropdown |

---

## C. Flujos que no se comportan igual

### C.1 Creación de task

| Paso | Asana | BuildSync |
|---|---|---|
| Click "+ Agregar tarea" | Inline row aparece con: checkbox, input, **botón Fecha**, **botón Detalles** | Inline row con checkbox, input, **botón Fecha (✓ implementado)**, **botón Detalles (✓ implementado)** |
| Click Detalles | Abre modal/panel con la task draft pre-llena | Persiste primero (si tiene name) y navega a `/my-tasks` |
| Type Enter | Crea task y muestra otra row inline (continuar creando) | Crea task y cierra inline composer |
| **Diferencia funcional** | Asana permite crear N tasks seguidas sin tocar mouse | BuildSync cierra después de cada Enter |
| **Fix necesario** | Después de crear, dejar otra row inline abierta lista para typing | Cambiar handleCreateTask para no setIsCreating(false) si vino de Enter |

### C.2 Completar task desde widget

| Paso | Asana | BuildSync |
|---|---|---|
| Click checkbox | Toast "Se completó ✓ X" + botón **Deshacer** + auto-dismiss ~5s | Toast "Task completed [Undo]" ✓ (paridad) |
| Tab "Con retraso (1)" → "Con retraso" | Badge desaparece cuando count = 0 | Igual ✓ |

### C.3 Click en task del widget

| Paso | Asana | BuildSync |
|---|---|---|
| Click título de la task | Abre **modal centrado** con detalle | Abre **TaskDetailModal** (paridad) |
| **Diferencia** | Asana usa modal/panel híbrido | Igual ✓ |

### C.4 Drag-drop entre secciones (List view)

| Paso | Asana | BuildSync |
|---|---|---|
| Drag task de "Hoy" a "Próxima semana" | Reordena visualmente + PATCH al backend con nueva position + section | dnd-kit con SortableContext implementado |
| **Verificar** | Que el PATCH realmente persista section change | Pendiente: probar visualmente |

### C.5 Acceso al widget My Tasks ⋯ menu

| Paso | Asana | BuildSync (post-fix `fa1382e`) |
|---|---|---|
| Click ⋯ | Menu: Crear tarea / Ver todas / Tamaño medio / Tamaño completo / Eliminar | Menu: Create task / View all / Half size / Full size / Remove widget ✓ |

### C.6 Recibir notificación → abrir item

| Paso | Asana | BuildSync |
|---|---|---|
| Notification de mention | Click → abre project messages tab con scroll al mensaje | Implementado con `?view=messages&message=X` deep-link |
| Notification de task assigned | Click → abre task detail | Implementado |

---

## D. Diferencias visuales

### D.1 Gridlines List view (RESUELTO)

| | Asana | BuildSync |
|---|---|---|
| Antes | Líneas tipo Excel (rows + cols) | Solo horizontals sutiles |
| Ahora (commit `a8fa550`) | — | Líneas slate-400 visibles en H + V ✓ |

### D.2 Color de marca

| | Asana | BuildSync |
|---|---|---|
| Primary | Naranja/coral | Gold (`#c9a84c`) — mantener |
| Accent secondary | Verde / azul | Variations of gold |

### D.3 Espaciados y paddings

Pendiente auditoría detallada. Patrón observado: BuildSync usa Tailwind defaults (px-4 md:px-6 py-2), similar a Asana.

### D.4 Iconografía

| | Asana | BuildSync |
|---|---|---|
| Sistema | Custom icons + Material? | lucide-react (consistente) |
| Recomendación | Mantener lucide-react (paridad estructural) | — |

### D.5 Avatars

| | Asana | BuildSync |
|---|---|---|
| Default fallback | Círculo color random + initial | Círculo gray + initial |
| Recomendación | Considerar random color de hash(userId) para consistencia con Asana | — |

---

## E. Bugs e inconsistencias detectadas

| # | Bug | Estado | Commit |
|---|---|---|---|
| B1 | Manage privacy modal placeholder mostraba `…` literal | FIXED | `b7ddc9f` |
| B2 | List view gridlines casi invisibles (#e6e9ef → #94a3b8) | FIXED | `99f2be3`, `a8fa550` |
| B3 | Workflow button en /my-tasks no hace nada (sólo aplica en /projects/[id]) | OPEN | — |
| B4 | "Sort", "More options" y "Manage notifications" del Inbox no rendering visualmente (existen en código) | OPEN | InvestiGAR |
| B5 | Calendar view solo muestra 6 columns (MON-SAT, falta SUN) | OPEN | confirmar |
| B6 | DraftCommentsWidget: no hay producer (orphan feature) | OPEN | — |
| B7 | Customize button background-color picker — feature decorativa que Juan rechazó pero el código sigue ahí | DECIDIR (mantener/eliminar) | — |

---

## F. Prioridades de corrección

### Sprint inmediato (~1 día, lo más rentable)

1. **Inbox toolbar visible**: investigar por qué Sort/More/Manage notifications no aparecen, fix CSS
2. **Notification grouping en /inbox**: "Hoy / Ayer / Últimos 7 días" sections (existe en code, ver groupedNotifications)
3. **AI summary CTA** ("View summary" button visible + Period selector dropdown)
4. **Sidebar Favoritos section** (nueva sección colapsable con pinned portfolios)
5. **Auto-continue inline composer** después de Enter en /my-tasks

### Sprint corto (~1 semana)

6. **Calendar view selector** (Mes / Semana)
7. **Calendar inline + Add task** al hover cell
8. **Dashboard "+ Add widget"** + per-chart filter UI
9. **Section selector** en task detail panel
10. **Date range UI** (banda continua "mayo 14 – 28") en list/widget
11. **Search icon local** en /my-tasks action row
12. **Botón global +Create** auditar (debe expandir a Tarea/Proyecto/Mensaje/Portafolio/Objetivo/Equipo/Invitar)

### Sprint mediano (~1 mes)

13. **Personalizar panel** con Rules / Fields / Apps (escope grande)
14. **+ Add custom view tab** (vistas guardadas custom)
15. **+ Add custom column** UI
16. **Custom Inbox tabs** (filters as saved tabs)
17. **Timeline / Gantt view** en /my-tasks
18. **DraftComments producer** (autosave at typing on comment box)

### Backlog (cuando aplique)

19. Rules engine real (automation)
20. Apps integrations
21. "Agregar por IA" / "Agregar por email" handlers reales
22. Sync/export real (iCal, Google Sheets, JSON)

---

## G. Checklist QA para desarrollador

### G.1 Navegación
- [ ] Sidebar global muestra: Home, My Tasks, Inbox, People, Reporting, Portfolios, Goals, Knowledge, Projects (+New), Teams (+New), Settings
- [ ] Sidebar tiene sección "Favoritos" colapsable (FALTA)
- [ ] Click en cada item del sidebar navega a la ruta correcta
- [ ] El item activo tiene highlight visual claro (bg-gray-200/80)
- [ ] Toggle de colapsar sidebar funciona y persiste en `uiState`

### G.2 Proyectos
- [ ] `/projects/all` muestra todos los proyectos en grid/list
- [ ] `/projects/[id]` abre con vista por defecto (List)
- [ ] Cada proyecto tiene 5 view tabs (List/Board/Calendar/Dashboard/Files)
- [ ] Click "+ New project" abre modal con template gallery (Asana parity)
- [ ] Status del proyecto (On track/At risk/Off track/Complete) renderiza pill
- [ ] Crear proyecto persiste y aparece en sidebar + Home

### G.3 Tareas
- [ ] Click "+ Add task" en List/Board crea inline row editable
- [ ] Enter en inline composer crea task Y abre otra row para continuar (FIX necesario)
- [ ] Calendar button inline composer abre date picker (Asana parity ✓)
- [ ] Chevron button abre detail con draft pre-llena (Asana parity ✓)
- [ ] Click checkbox completa task + toast con Undo (paridad ✓)
- [ ] Click task title abre side panel detail
- [ ] Double-click task title activa inline rename
- [ ] Right-click task row → context menu (FALTA)

### G.4 Subtareas
- [ ] Detail panel → "Add subtask" crea subtask con misma jerarquía visual que Asana
- [ ] Subtask se puede expandir/colapsar
- [ ] Subtask hereda parent del task original
- [ ] Click en subtask abre su propio detail (puede ser inline o navegación)

### G.5 Comentarios
- [ ] Detail panel tiene tabs "Comments" / "All activity"
- [ ] Comment input al fondo con avatar + paperclip + Post button
- [ ] @ mention abre user picker
- [ ] Like/heart en comments (FALTA)

### G.6 Archivos
- [ ] Files tab de /my-tasks muestra filter tabs (All/Images/PDF/Docs/Other)
- [ ] Click en file abre viewer
- [ ] Upload via paperclip funciona

### G.7 Fechas
- [ ] DueDatePicker permite range (start + due)
- [ ] Date range renderiza como banda continua en List/Calendar (FALTA en List)
- [ ] "No date (N)" pill en Calendar header (paridad ✓ commit `e318477`)
- [ ] Overdue muestra "Overdue · 8 days" en rojo

### G.8 Responsables
- [ ] AssigneeSelector abre user picker con avatar + name
- [ ] Asignación se persiste y propaga a otros widgets (Home AssignedTasks)
- [ ] Cambiar asignación dispara notificación al nuevo asignado

### G.9 Vistas
- [ ] List view tiene gridlines visibles (paridad ✓ commit `a8fa550`)
- [ ] Board view tiene 4+ columnas Kanban con + Add section (paridad ✓)
- [ ] Calendar view month grid (FALTA view selector Mes/Semana)
- [ ] Dashboard 4 KPI cards + 4 charts (FALTA + Add widget)
- [ ] Files view con type filter tabs (paridad ✓)
- [ ] + Add custom view tab (FALTA)

### G.10 Filtros
- [ ] Filter dropdown con 4 quick filters (Incomplete/Completed/Due this week/Due next week)
- [ ] Filter dropdown con "Clear" button (FALTA — Asana lo tiene)
- [ ] + Add filter para custom filters

### G.11 Ordenamiento
- [ ] Sort dropdown con 9 opciones (Start/Due/Creator/Created/LastMod/Completed/Likes/Alphabetical/Project) (paridad ✓)

### G.12 Búsqueda
- [ ] Search global top bar funciona
- [ ] Search local en /my-tasks action row (FALTA — icono lupa)

### G.13 Inbox
- [ ] Tabs: Activity / Mentions / Favorites / Archive (+ Custom FALTA)
- [ ] Filter dropdown (Asana style chips vs BuildSync radio — diferencia UX intencional)
- [ ] Sort dropdown visible (FALTA renderizar — existe en code)
- [ ] Density dropdown (Detailed / Compact)
- [ ] AI summary card con "View summary" CTA + Period selector (FALTAN ambos)
- [ ] Sections por tiempo: Today / Yesterday / This week / Earlier (FALTA — solo muestra "THIS WEEK")
- [ ] Notification grouping por entidad (FALTA)
- [ ] Manage notifications button arriba derecha (FALTA renderizar)
- [ ] Click notification → deep-link al recurso (paridad)

### G.14 Equipos
- [ ] /teams lista todos los teams
- [ ] /teams/[id] muestra: calendar / join / members / messages / work
- [ ] /teams/new crea team
- [ ] Members management con roles

### G.15 Permisos
- [ ] Manage privacy modal para task (paridad ✓ fix `b7ddc9f`)
- [ ] Visibility column en /my-tasks (Solo yo / Mi espacio de trabajo / etc.)

### G.16 Modales
- [ ] Customize widgets modal/sheet (paridad ✓ commit `db4c03d`)
- [ ] QuickCreateTaskModal (pinned bottom-right como Gmail compose) (paridad ✓)
- [ ] TaskDetailModal (centrado con detail completo) (paridad ✓)
- [ ] ManagePrivacyModal (paridad ✓)

### G.17 Estados vacíos
- [ ] /my-tasks widget — "No upcoming tasks" / "No overdue tasks. You're on track!" / "Nothing completed yet" (paridad ✓ commit `bfe9d2e`)
- [ ] AssignedTasksWidget — copy específico per tab (paridad ✓ commit `6c15949`)
- [ ] /inbox vacío — empty state (verificar)
- [ ] StatusUpdatesWidget — "Keep your projects visible" (paridad)
- [ ] DraftCommentsWidget — "No draft comments" (paridad)

### G.18 Estados de error
- [ ] Network error → toast.error
- [ ] 404 task → redirect a /my-tasks
- [ ] Permission denied → mensaje claro

### G.19 Estados de carga
- [ ] Skeletons para widgets (paridad ✓)
- [ ] Loading spinners para detail panel fetch
- [ ] Optimistic updates para create/complete/archive

### G.20 Responsive
- [ ] Sidebar collapse en mobile
- [ ] Action row stackable en mobile (Filter+Sort+Group como horizontal scroll)
- [ ] Task detail panel se vuelve full-screen en mobile
- [ ] Calendar grid 7 columns desktop, scrollable en mobile

### G.21 Accesibilidad
- [ ] Esc cierra modales/drawers (paridad ✓ tip visible)
- [ ] Tab navega entre inputs en orden lógico
- [ ] Aria labels en buttons sin texto (avatares, icon-only)
- [ ] Focus rings visibles
- [ ] Contraste WCAG AA en todos los textos

### G.22 Consistencia visual
- [ ] Spacing consistente (px-4 md:px-6 patrón)
- [ ] Font sizes: text-xs (11px) / text-sm (13px) / text-base (15px) / heading sizes
- [ ] Border colors: gray-200 (general) / slate-400 (gridlines)
- [ ] Shadow consistente en cards (shadow-sm hover:shadow-md)
- [ ] Radius consistente (rounded-md, rounded-lg, rounded-full)

---

## H. Checklist visual

### H.1 Sidebar
- [ ] Width 240px desktop, 270px tablet, full-overlay mobile
- [ ] Background `#fafafa`
- [ ] Item hover bg-black/[0.04]
- [ ] Item active bg-gray-200/80
- [ ] Icon 18px lucide
- [ ] Text 13px font-medium
- [ ] Gap 2.5 entre icon y label
- [ ] Settings al fondo separado por border

### H.2 Topbar (global)
- [ ] + Create button arriba izquierda (visible en Home screenshot)
- [ ] Search bar centrado (50% width)
- [ ] AI / Notifications / Help / Avatar arriba derecha (Asana style)
- [ ] BuildSync tiene Search visible ✓

### H.3 Project / Page header
- [ ] Avatar circle + title + dropdown chevron
- [ ] Subtitle / breadcrumb opcional
- [ ] Right side: Share + Workflow (BuildSync extra) / Personalizar (FALTA)
- [ ] Tab bar debajo con 5 tabs + "+" custom
- [ ] Action row con: + Add task | Filter | Sort | Group | Options | Search

### H.4 Task list
- [ ] Column headers: Task name / Due date / Collaborators / Projects / Visibility / + Add column
- [ ] Section header collapsible con count (e.g. "Recently assigned 6")
- [ ] Section divider visible
- [ ] Row height: var(--row-h) consistente
- [ ] Hover row: bg-[var(--surface-hover)]
- [ ] Drag handle visible on hover (left side)
- [ ] Checkbox circular con icon variant (Diamond para Milestone, ThumbsUp para Approval)

### H.5 Board columns
- [ ] Column header con nombre + count + ... menu
- [ ] Cards con: checkbox + title + project tag + due date + assignee avatar
- [ ] Add task inline al fondo de cada column
- [ ] + Add section a la derecha
- [ ] Drag-drop entre columns funciona

### H.6 Task cards (Board)
- [ ] Border radius 8px
- [ ] Padding p-3
- [ ] Shadow sutil
- [ ] Hover lift effect

### H.7 Task detail panel
- [ ] Side panel right o full-page modal
- [ ] Header: Mark complete + Like + Attach + Copy link + Expand + More + Close
- [ ] Privacy notice banner
- [ ] Title editable inline
- [ ] Fields stack: Assignee / Section (FALTA) / Due date / Dependencies / Projects / Priority
- [ ] Description editable
- [ ] Attachments section
- [ ] Subtasks section
- [ ] Comments + All activity tabs
- [ ] Add comment composer al fondo
- [ ] Collaborators row

### H.8 Buttons
- [ ] Primary: bg-black text-white (Asana style negro/oscuro)
- [ ] Secondary: variant outline
- [ ] Ghost: variant ghost
- [ ] Sizes: sm h-8 / default h-10 / lg h-12
- [ ] Icon-only buttons: h-8 w-8

### H.9 Inputs
- [ ] Border gray-200 → focus ring black/10
- [ ] Padding px-3 h-10
- [ ] Placeholder gray-400

### H.10 Dropdowns
- [ ] Background white + border + shadow-lg
- [ ] Item padding px-3 py-2
- [ ] Hover bg-gray-50
- [ ] Separator gray-100
- [ ] Icons opcional + label
- [ ] Keyboard shortcut hint a la derecha (Asana style, ej. "Tab N")

### H.11 Modales
- [ ] Center overlay con backdrop bg-black/50
- [ ] Border radius lg
- [ ] Max width responsive
- [ ] Header con title + close X
- [ ] Body scrollable
- [ ] Footer con primary action a la derecha

### H.12 Popovers
- [ ] Smaller than modal
- [ ] Arrow opcional pointing to trigger
- [ ] Auto-positioning (Radix)

### H.13 Avatars
- [ ] Sizes: xs (h-4) / sm (h-5) / md (h-8) / lg (h-12)
- [ ] Fallback con initials
- [ ] BuildSync usa AvatarFallback bg-gray-900 → considerar random hash color (Asana style)

### H.14 Tags / Pills
- [ ] Border radius full (rounded-full) o md
- [ ] Padding px-2 py-0.5
- [ ] Semantic colors (verde / amarillo / rojo / azul / gris)

### H.15 Date pickers
- [ ] Popover-style trigger
- [ ] Calendar grid + day picker
- [ ] Range support (start + due)
- [ ] "Today" / "Tomorrow" / "Yesterday" labels

### H.16 Search bar
- [ ] Top global: icon left + placeholder "Search"
- [ ] Local /my-tasks: icon button → expand input (FALTA)

### H.17 Empty states
- [ ] Icon + headline + subtext + CTA
- [ ] Copy específico por contexto (Asana style empático)

### H.18 Loading states
- [ ] Skeleton bars con animate-pulse
- [ ] Spinner Loader2 con animate-spin

### H.19 Error states
- [ ] Toast con error icon
- [ ] Inline error mensaje cerca del field

### H.20 Hover states
- [ ] Cursor pointer
- [ ] Background change sutil
- [ ] Icon visibility cambia (drag handle aparece on hover)

### H.21 Selected states
- [ ] Background highlight
- [ ] Border accent color

### H.22 Mobile/tablet
- [ ] Sidebar collapses to icons-only
- [ ] Tabs become horizontal scroll
- [ ] Task detail full-screen
- [ ] Action row stackable

---

## I. Recomendaciones finales

### I.1 Decisiones de producto a tomar

1. **Color picker del Home background**: Juan rechazó esta feature (Mayo 20). El código sigue en producción (commit `db4c03d`). Recomendación: ELIMINAR el código del color picker para no confundir UX, o esconderlo bajo flag.

2. **Workflow button en /my-tasks**: No hace nada en esa ruta. Opciones:
   - (a) Remover el button del /my-tasks header (solo dejarlo en /projects/[id])
   - (b) Hacerlo apuntar a algún settings de workflows globales
   - Recomendación: (a) — más limpio

3. **DraftCommentsWidget orphan**: No tiene producer. Decisión:
   - (a) Implementar el producer (autosave en comment composer)
   - (b) Esconder el widget del Customize hasta tener producer
   - Recomendación: (b) por ahora — evita la confusión

### I.2 Mejoras propias de BuildSync (mantener, no remover)

BuildSync ya supera Asana en estas áreas — **NO eliminar para "parecerse" más a Asana**:

- ✓ StatusUpdates widget — per-project rollup con stale detection (mejor diseño)
- ✓ Files view con filter tabs (All/Images/PDF/Docs/Other)
- ✓ Recent Projects widget con 3 sort options + status pills + task counts
- ✓ Goals widget 3 tabs (My/Team/Company) vs Asana 2
- ✓ Options panel con badge count + Esc tip
- ✓ People widget con upcoming stat (3 stats vs Asana 3 ✓ ahora)
- ✓ Private Notepad con AI Assist 4 acciones + emoji + @mention picker
- ✓ Show more (N) en widget de tareas

### I.3 Performance / técnico

- Mantener Server Components donde sea posible
- Optimistic UI updates (paridad ✓ en checkbox toggle)
- Auto-save con debounce (paridad ✓ en Notepad)
- DB-first persistence via uiState (paridad ✓)

### I.4 Próximos pasos del equipo de dev

**Sprint 1 (esta semana):**
- F4 Inbox Sort dropdown rendering fix
- F6 Manage notifications button rendering fix
- F1+F2 Period selector + View summary CTA en AI card
- F7 Sections temporales en /inbox
- F15+F16 Sidebar Favoritos + colapsables

**Sprint 2 (próxima semana):**
- F3 Notification grouping por entidad
- F12 Section selector en detail panel
- F8+F9 Calendar view selector + inline create
- F18 Date range UI continuo
- F20 Search icon en /my-tasks
- Bug B3 Workflow button cleanup

**Sprint 3:**
- F10+F11 Dashboard "+ Add widget" + per-chart UI
- F13 Personalizar panel base (mínimo: link a /settings)
- F14 + custom view tabs (saved views model + UI)
- F17 Custom columns full UI

**Backlog (cuando el negocio lo pida):**
- Timeline / Gantt view
- Rules engine
- Apps integrations
- Sync/export real

---

## J. Estado de commits relacionados

| Commit | Cambio |
|---|---|
| `db4c03d` | Home Customize → Sheet drawer + background color picker |
| `521d9ca` | Inbox @Mentions tab |
| `fa1382e` | My Tasks widget ⋯ menu Create/View all + Overdue badge |
| `bfe9d2e` | Title links + UNDO toast + empty states empáticos |
| `bb547bd` | Inline due-date + Open details + Show more |
| `6c15949` | AssignedTasks 4-tab layout + counts + empáticas |
| `e4e7fd4` | Goals widget period + status pill |
| `fbcf561` | People upcoming stat + profile link |
| `c1ed1b9` | Notepad Undo/Redo buttons |
| `e318477` | Calendar "No date (N)" pill |
| `b7ddc9f` | Privacy modal placeholder fix |
| `99f2be3` | Gridlines bump #d1d5db |
| `a8fa550` | Gridlines slate-400 |

---

**Cierre:** Este documento se actualiza después de cada sprint de paridad. Próxima actualización después de Sprint 1 con los items F1-F2-F4-F6-F7-F15-F16.
