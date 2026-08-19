# QC Fase 2 — Asana Parity Audit

**Generado**: 2026-05-23
**Método**: Asana MCP API queries contra workspace `pecivilclicksimulators.com` (gid `1212771299103946`) + Explore agent mapping de `prisma/schema.prisma` (1708 líneas).
**Resultado global**: BuildSync cubre **~75%** del schema core de Asana, con ventajas diferenciadoras en el dominio engineering firm.

---

## Resumen ejecutivo

### 🟢 Donde BuildSync GANA contra Asana
- **Engineering domain**: `ProjectType` (Construction/Design/Recertification/Permit), `ProjectGate` (5-stage lifecycle), `Position` enum (CEO→Project Engineer con stamping rights), `ProjectCompany` (multi-firm collab: structural + arquitecto + GC + consultants), `ClientProjectAccess` (per-client visibility) — Asana **no tiene nada de esto**.
- **OKR depth**: `KeyResult` con format (NUMBER/PERCENTAGE/CURRENCY/BOOLEAN), `confidenceScore` 1-10, `ObjectiveStatusUpdate` con block-builder, nesting via `parentId`. Asana Goals requiere Business+ — vos lo tenés free.
- **Intake forms**: Form → FormSubmission → auto-Task, con submission tracking URL pública y CommentSource para guests. Asana Forms es premium.
- **Calculators**: 12 engineering tools activos en `/knowledge/calculators` — Asana no tiene NINGUNO.

### 🟡 Donde BuildSync EMPATA con Asana
- Tasks core, dependencies, custom fields rich types, sections, board/list/calendar/timeline/dashboard views, status updates, mentions, comments.

### 🔴 Donde BuildSync se queda corto
- **`due_at` datetime** (tenés solo date), **multi-project tasks**, **recurring tasks**, **task templates per-project**, **Time tracking UI** (el field type existe pero no la UI), **automation triggers** (solo 2 vs ~20 de Asana), **conditional rules**, **webhooks**.

---

## 1. TASK — schema diff

| Campo Asana | Tipo Asana | BuildSync equivalente | Estado |
|---|---|---|---|
| `gid` | string | `id` (cuid) | ✅ Paridad |
| `name` | string | `name` | ✅ Paridad |
| `html_notes` | string (HTML) | `description` (markdown/plain) | 🟡 BuildSync usa plain — sin rich format |
| `due_on` | date | `dueDate` | ✅ Paridad |
| **`due_at`** | **datetime** | ❌ no existe | 🔴 **GAP** — sin hora específica |
| `start_on` | date | `startDate` | ✅ Paridad |
| **`start_at`** | datetime | ❌ no existe | 🔴 GAP |
| `assignee` | user | `assigneeId` + `TaskCollaborator[]` | ✅ Mejor (collaborators array) |
| `completed` | boolean | `completed` | ✅ Paridad |
| `completed_at` | datetime | `completedAt` | ✅ Paridad |
| **`completed_by`** | user | ❌ no se guarda quién completó | 🟡 GAP menor |
| `resource_subtype` | enum (default/milestone/approval) | `taskType` (TASK/MILESTONE/APPROVAL) | ✅ Paridad |
| `parent` | task | `parentTaskId` | ✅ Paridad (subtasks) |
| `num_subtasks` | int | computed via `_count.subtasks` | ✅ Paridad |
| `dependencies` / `dependents` | task[] | `TaskDependency` table con 4 tipos (FS/SS/FF/SF) | ✅ **Mejor** (Asana solo finish-to-start) |
| `tags` | tag[] | `Tag` + `TaskTag` join | ✅ Paridad |
| `liked` / `likes` / `hearts` | boolean + user[] | `TaskLike` model | ✅ Paridad |
| `actual_time_minutes` | int | `CustomFieldType.TIME_TRACKING` (designed) | 🟡 Diseñado, sin UI implementada |
| **`projects`** | project[] | `projectId` (single) | 🔴 **GAP** — tasks no pueden estar en N proyectos |
| `memberships` | section+project tuples | `sectionId` (single) | 🔴 Mismo gap que above |
| `followers` | user[] | `TaskCollaborator[]` (con role) | ✅ **Mejor** (rol por collab) |
| `assignee_status` | upcoming/today/later/new | `myTaskSection` (Recently/Today/Next week/Later) | ✅ Paridad |
| `is_rendered_as_separator` | bool | ❌ no existe | 🟡 GAP menor (Asana lets tasks act as separators) |
| `permalink_url` | string | implícito (`/tasks/[id]`) | ✅ Paridad |
| **recurring** | recurrence_rule | ❌ no existe | 🔴 **GAP** crítico para PM repetitivo |

**Asana-only features NOT in BuildSync schema:**
- Task moved BETWEEN projects (Asana: drag task to another project from sidebar)
- Hearts vs Likes (Asana mantiene ambos por legacy — irrelevante)
- External system sync (`external` field para Jira/etc bridging)

---

## 2. PROJECT — schema diff

| Campo Asana | BuildSync | Estado |
|---|---|---|
| `name` | `name` | ✅ |
| `archived` | ❌ no existe explícito | 🟡 GAP — solo `status: COMPLETE`. Asana separa "completado" de "archivado" |
| `color` | `color` | ✅ |
| `icon` | `icon` | ✅ Paridad |
| `created_at` / `modified_at` | `createdAt` / `updatedAt` | ✅ |
| `default_view` | `ProjectView` con `LIST/BOARD/TIMELINE/CALENDAR/GANTT/DASHBOARD/FILES` | ✅ **Mejor** (más views) |
| `due_on` / `start_on` | `endDate` / `startDate` | ✅ |
| `followers` (watchers) | `ProjectMember` con role | ✅ |
| `html_notes` | `description` (plain) | 🟡 sin HTML rich notes |
| `members` | `ProjectMember[]` | ✅ |
| `owner` | `ownerId` | ✅ |
| `privacy_setting` | `visibility` (PRIVATE/WORKSPACE/PUBLIC) | ✅ Paridad |
| `minimum_access_level_for_customization` | ❌ no granular | 🟡 GAP — BuildSync usa role binary |
| `minimum_access_level_for_sharing` | ❌ no granular | 🟡 GAP |
| `sections` | `Section[]` | ✅ |
| `task_template_count` | ❌ no per-project templates | 🔴 GAP — solo `ProjectTemplate` global |
| `workflows` | `Workflow + WorkflowRule[]` | ✅ presente, schema más rico (workflow per project) |
| `current_status_update` | `StatusUpdate` model | ✅ **Mejor** (block-builder con sections) |
| **`project_brief`** | ❌ no existe — solo `WorkspaceNote` (workspace-scoped) | 🔴 **GAP** — Asana tiene "Brief" doc per project |
| **`custom_field_settings`** | `ProjectCustomField` | ✅ Paridad |

**BuildSync-exclusive engineering fields**:
- `type` (CONSTRUCTION|DESIGN|RECERTIFICATION|PERMIT) — domain-critical
- `gate` (PRE_DESIGN|DESIGN|PERMITTING|CONSTRUCTION|CLOSEOUT) — engineering lifecycle
- `projectNumber` (TT-2026-001 etc.) — accounting cross-ref
- `clientName`, `location`, `budget`, `currency` — billing/forecast fields
- `ProjectCompany[]` (multi-firm: structural / architect / GC / consultant)

---

## 3. CUSTOM FIELDS — schema diff

| Asana type | BuildSync `CustomFieldType` | Estado |
|---|---|---|
| `text` | TEXT | ✅ |
| `number` | NUMBER | ✅ |
| `date` | DATE | ✅ |
| `enum` (single) | DROPDOWN | ✅ |
| `multi_enum` | MULTI_SELECT | ✅ |
| `people` | PEOPLE | ✅ |
| (no checkbox in Asana) | CHECKBOX | ✅ **Más** |
| `currency` (premium) | CURRENCY | ✅ |
| `percentage` (premium) | PERCENTAGE | ✅ |
| (no reference field) | REFERENCE | 🟡 enum existe, sin resolver |
| `formula` (Enterprise) | FORMULA | 🟡 enum existe, sin executor |
| (no timer field) | TIMER | ✅ **Más** |
| `time_tracking` (Business+) | TIME_TRACKING | 🟡 enum + esquema, sin UI |
| `roll_up` (Enterprise) | ROLLUP | 🟡 enum existe, sin compute logic |

**Conclusión**: BuildSync **diseñó** más tipos que Asana free, pero le falta executor para FORMULA / TIME_TRACKING / ROLLUP / REFERENCE. Asana Enterprise tiene formula+rollup workings.

---

## 4. USER + WORKSPACE MEMBER

| Asana | BuildSync | Estado |
|---|---|---|
| User name/email/image | User name/email/image | ✅ |
| Roles (Member/Limited/Guest) | `WorkspaceRole` (OWNER/ADMIN/MEMBER/GUEST/WORKER/CLIENT) | ✅ **Más** roles (CLIENT/WORKER específicos) |
| Per-project role (Editor/Commenter/Viewer) | `ProjectMember.role` (ADMIN/EDITOR/COMMENTER/VIEWER) | ✅ Paridad |
| User availability/PTO (Asana Business+) | ❌ no existe | 🟡 GAP |
| Capacity hours | ❌ no existe | 🟡 GAP (workload view existe read-only) |
| Position/title | `Position` enum (CEO/Senior Engineer/Project Engineer/Drafter/etc.) | ✅ **Mejor** (domain-specific) |
| Notification preferences | `UserPreferences.notify*` (6 toggles) | ✅ |

---

## 5. GOAL / OBJECTIVE

| Asana Goal (premium) | BuildSync Objective | Estado |
|---|---|---|
| Goal name, owner, period, status | name, ownerId, period, status | ✅ |
| Status: ON_TRACK/AT_RISK/OFF_TRACK/ACHIEVED/DROPPED | Mismo + PARTIAL/MISSED | ✅ **Más** |
| Metric (current/target/initial) | `KeyResult.{startValue,currentValue,targetValue}` | ✅ |
| metric format | `KeyResultFormat` (NUMBER/PERCENTAGE/CURRENCY/BOOLEAN) | ✅ |
| Parent goal (nesting) | `parentId` | ✅ |
| `liked` | `ObjectiveLike` | ✅ |
| `is_workspace_level` | `teamId` null = workspace-level | ✅ |
| Check-ins | `ObjectiveStatusUpdate` + `KeyResultUpdate` | ✅ Paridad |
| **`confidenceScore`** | 1-10 trended | ✅ **Mejor** (Asana no trend confidence) |
| Goal shared with users | `ObjectiveMember` con role (EDITOR/VIEWER) | ✅ |
| Linked projects/tasks | `ObjectiveProject` + `ObjectiveTask` join tables | ✅ |

**BuildSync wins here**. Le ganás a Asana en goals.

---

## 6. PORTFOLIO

Asana = premium. BuildSync free.

| Concepto | Asana | BuildSync | Estado |
|---|---|---|---|
| Portfolio CRUD | sí | `Portfolio` model | ✅ |
| Member access | role | `PortfolioMember` con OWNER/EDITOR/VIEWER | ✅ |
| Status update | sí | `PortfolioStatusUpdate` | ✅ |
| Custom fields en portfolio | sí | ❌ no aplicado a portfolios (solo a projects) | 🟡 GAP |
| Workload heat-map view | premium | placeholder en `portfolio-workload-view.tsx` (coming soon) | 🟡 stub |
| Timeline view | premium | `portfolio-timeline-view.tsx` (parcial) | 🟡 parcial |

---

## 7. WORKFLOW / RULES

| Asana | BuildSync | Estado |
|---|---|---|
| Trigger types (~20: task added/moved/completed/due/comment/assignee/field-changed/...) | 2 triggers: `TASK_MOVED_TO_SECTION`, `TASK_COMPLETED` | 🔴 **GAP** crítico |
| Actions (~30: assign/set-field/notify/add-collab/add-comment/add-subtask/move/Slack/...) | 7 actions: SET_ASSIGNEE, ADD_COLLABORATORS, ADD_COMMENT, MARK_COMPLETE, ADD_TO_PROJECT, SET_PRIORITY, ADD_SUBTASK | 🟡 buen comienzo |
| Conditions (if-then-else) | flat trigger→actions[] | 🔴 GAP |
| Time-based triggers (daily/weekly/N-days-before) | ❌ no | 🔴 GAP |
| Cross-project rules | ❌ rule per project | 🟡 GAP |

---

## 8. FORM / INTAKE

BuildSync = paridad o mejor (Asana Forms es premium):

| Feature | Asana | BuildSync | Estado |
|---|---|---|---|
| Form fields | sí | `Form.fields` JSON | ✅ |
| Auto-create task on submit | sí | `FormSubmission.taskId` | ✅ |
| Public submit (no login) | premium | `visibility: PUBLIC` ✓ | ✅ |
| Conditional fields | premium | ❌ no | 🟡 GAP |
| Form versioning | sí | ❌ no audit | 🟡 GAP |
| Submission tracking URL para guests | ❌ no | ✅ tenés `Comment.guestName/Email` + tracking URL | ✅ **Mejor** |

---

## 9. NOTIFICATIONS / INBOX

| Asana | BuildSync | Estado |
|---|---|---|
| Inbox feed | sí | `Notification` model | ✅ |
| Event types | sí (~15) | 9 types: TASK_ASSIGNED, TASK_COMPLETED, COMMENT_ADDED, MENTIONED, DUE_DATE_APPROACHING, PROJECT_INVITATION, STATUS_UPDATE, OBJECTIVE_SHARED, FORM_SUBMITTED | ✅ buen cubrimiento |
| Daily digest email | sí | `UserPreferences.notifyWeeklyDigest` solo (no daily) | 🟡 GAP |
| Push (mobile) | sí | ❌ no implementado | 🔴 GAP (futuro) |
| AI summary | premium reciente | ✅ ya implementado (`/api/ai/assist` + Inbox summary widget) | ✅ **Mejor — al toque del lanzamiento** |

---

## 10. SEARCH

Asana tiene 30+ filtros en `/tasks/search`:
- assignee_any/not, assigned_by_any/not, commented_on_by_not
- followers_any/not, liked_by_not, created_by_any/not
- completed/at/on (with after/before)
- due_at/on (after/before), start_on/at
- modified_at/on, created_at/on
- has_attachment, is_blocked, is_blocking, is_subtask
- portfolios_any, projects_all/any/not
- resource_subtype (milestone/approval)
- sections_all/any/not, tags_all/any/not, teams_any
- custom_fields (JSON), text, sort_by(due/created/completed/likes/modified)

| BuildSync filter | Estado |
|---|---|
| Text search | ✅ `/api/search` |
| Tag filter | ✅ |
| Status filter | ✅ |
| Date range filter | ✅ |
| Custom field filter | parcial |
| **Saved search** | ❌ **GAP** |
| **Multi-filter combiner** (AND/OR) | ❌ **GAP** |
| **30+ filter types como Asana** | ❌ **GAP** |

---

## 🎯 Plan de cierre — gaps priorizados

### Priority 1 — Quick wins (1-2 días cada uno)
1. **Project `archived` field**: agregar `archivedAt: DateTime?` al Project + filter en /projects/all. Separa "completado" de "ocultado".
2. **Task `completedBy`**: guardar quién marcó complete (no solo cuándo). Field migration + UI tooltip.
3. **Daily/Custom digest cadence**: extender `UserPreferences.notifyWeeklyDigest` → `notifyDigestCadence: NEVER/DAILY/WEEKLY`.
4. **Activity feed (Asana "stories")**: ya tenés `Activity` model — exponer como stream visible en task detail panel.

### Priority 2 — Schema work (3-5 días cada uno)
5. **`dueAt` datetime field**: migration `dueAt: DateTime?` además de `dueDate`. UI: time picker opcional al lado del date picker. Asana parity directo.
6. **Multi-project tasks**: nuevo `TaskMembership` join (taskId + projectId + sectionId + position). Migrar `task.projectId` → primer membership. Big architectural change pero alinea con Asana.
7. **Task templates per-project**: nueva tabla `TaskTemplate` con name + defaults (assignee, due offset, custom fields). UI: "Use template" en Add task.
8. **Project Brief**: nuevo `ProjectBrief` model (richText, projectId, lastEditedBy). UI: nueva tab "Brief" en project detail.

### Priority 3 — Implementation work (1-2 weeks cada uno)
9. **TIME_TRACKING field UI**: implementar timer start/stop, log entries, total mins por usuario+task. Schema ya está designed.
10. **Recurring tasks**: `RecurrenceRule` model (cron-like + endDate). Background job que crea instances. Significativo.
11. **Webhooks**: `Webhook` model + delivery worker. Foundation para Slack/GitHub/Jira integrations.
12. **Automation triggers expansion**: 2→10+ triggers. ADD_COMMENT, DUE_DATE_APPROACHING, FIELD_CHANGED, ASSIGNEE_CHANGED, SUBTASK_COMPLETED, etc.
13. **FORMULA + ROLLUP executors**: parser para expresiones tipo `=[Field A] + [Field B]` + safe eval. Asana solo lo tiene en Enterprise — sería diferenciador.

### Priority 4 — UI polish (días sueltos cuando se necesite)
14. **Rich HTML notes**: Tiptap o Lexical editor para task description (en vez de plain).
15. **Granular project access levels**: `minimum_access_level_for_*` controls.
16. **Conditional form fields**: if/then visibility rules en FormField type.
17. **Saved searches**: nuevo `SavedSearch` model + UI para "Pin to sidebar" / "Share with team".

---

## Resumen final

| Categoría | Coverage | Comentario |
|---|---|---|
| Tasks core | 85% | falta `due_at`, multi-project, recurring |
| Projects | 80% | falta archived, project brief, granular ACL |
| Custom fields | 70% diseño / 50% impl | enum rich, executors faltan |
| Users + workspace | 90% | mejor que Asana en domain-specific roles |
| Goals/OKRs | 110% | **Le ganás a Asana** (free vs premium) |
| Portfolios | 85% | algunas views stub |
| Workflow/rules | 30% | gap crítico para automatización seria |
| Forms | 100% | **Le ganás a Asana** |
| Notifications | 80% | falta daily digest, push |
| Search | 40% | gap grande en breadth de filtros |
| **Engineering domain** | **N/A** | **Asana no tiene NADA de esto** |

**Veredicto**: para un AEC engineering firm, BuildSync ya es competitivo con Asana en lo esencial y le supera ampliamente en domain-specific. Los 3 gaps que más duelen al pipeline de ventas son:
1. **Recurring tasks** — todo PM repetitivo necesita esto
2. **Workflow triggers breadth** — el motor de automatización es bare-bones
3. **Time tracking UI** — para billing es crítico

Si querés cerrar estos 3 en próximas sesiones, ya quedás 100% Asana-parity en lo que importa para vender.
