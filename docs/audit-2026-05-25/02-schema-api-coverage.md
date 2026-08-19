# 02 — Schema Prisma y Cobertura API

**Fecha:** 2026-05-25
**Dominio:** Data layer — modelos Prisma, 153 endpoints, UI↔API matrix

---

## Verdict
**Schema sólido y normalizado, API rica pero con stubs disfrazados.** 153 endpoints, 65+ modelos. Cobertura buena en módulos principales (projects, tasks, objectives), pobre en Knowledge CRUD y Client Portal.

---

## Resumen Numérico
- **65+ modelos** en `prisma/schema.prisma`
- **153 endpoints** bajo `src/app/api/`
- **Multi-tenant** vía `workspaceId` en todas las entidades core
- **Soft delete** y audit fields presentes en mayoría

---

## Modelos Agrupados

### Auth & Users
- `User`, `Account`, `Session`, `VerificationToken` (NextAuth)
- `WorkspaceMember` (join user ↔ workspace + role)
- `Invite` (token + expiración + rol pre-asignado)

### Workspaces & Teams
- `Workspace` (tenant raíz)
- `Team`, `TeamMember`, `TeamRole`
- `Portfolio`, `PortfolioMember`, `PortfolioProject`

### Projects & Lifecycle
- `Project`, `ProjectMember`, `ProjectGate`
- `ProjectBrief`, `ProjectDocument`, `ProjectFile`
- `ProjectVisibility` enum (PUBLIC, WORKSPACE, PRIVATE)
- `ProjectType` enum (4 tipos)
- `LifecycleGate` enum (5 gates)

### Tasks & Productivity
- `Task`, `TaskComment`, `TaskAttachment`
- `TaskDependency` (junction blocking/blocked-by)
- `Subtask` (self-relation)
- `TaskStatus` enum (ON_TRACK/AT_RISK/OFF_TRACK) — **NO USADO en vistas**
- `MyTaskSection` (Do Today, Do Next Week, Do Later)
- `CustomField`, `CustomFieldValue`

### Goals/OKRs
- `Objective`, `KeyResult`, `ObjectiveProject` (junction)
- `ObjectiveMember` (sharing — schema-ready, sin UI)
- `StatusUpdate` (check-ins)
- `ProgressStrategy` enum (KEY_RESULTS, SUB_OBJECTIVES, PROJECTS)

### Knowledge
- `KnowledgeEntry` — model completo
- Tags, categories

### Client Portal
- `ClientProjectAccess` (row-level)
- `ClientApproval`
- `DirectMessage`
- → Schema rico, pero solo **9 endpoints** reales

### Notifications & Comms
- `Notification` (8 tipos: mention, comment, task_assigned, update, system, form_submitted, etc.)
- `Mention`
- `Message`

### Forms
- `Form`, `FormSubmission`, `FormField`
- Tracking públicos

### AI & Integrations
- `AICoachSession`
- Sin modelos específicos para geocoding (stateless)

### Timesheets
- ❌ `TimeEntry` mencionado en comentarios como TODO
- **Actualmente localStorage-only** — riesgo data loss

---

## API Inventory (resumen por módulo)

| Módulo | Endpoints | CRUD completo | Auth | Workspace-scoped |
|--------|-----------|---------------|------|------------------|
| `/api/auth/*` | NextAuth std | N/A | N/A | N/A |
| `/api/users/*` | ~6 | ✅ | ✅ | ✅ |
| `/api/workspace[s]/*` | ~12 | ✅ | ✅ | ✅ |
| `/api/projects/*` | ~25 | ✅ | ✅ | ✅ |
| `/api/tasks/*` | ~18 | ✅ | ✅ | ✅ |
| `/api/my-tasks/*` | ~10 | ✅ | ✅ | ✅ |
| `/api/objectives/*` | ~15 | ✅ | ✅ | ✅ |
| `/api/portfolios/*` | ~8 | ✅ | ✅ | ✅ |
| `/api/teams/*` | ~10 | ✅ | ⚠️ | ✅ |
| `/api/forms/*` | ~12 | ✅ | mixto | ✅ |
| `/api/notifications/*` | ~6 | parcial | ✅ | ✅ |
| `/api/mentions/*` | ~3 | parcial | ✅ | ✅ |
| `/api/messages/*` | ~5 | parcial | ✅ | ✅ |
| `/api/status-updates/*` | ~4 | parcial | ✅ | ✅ |
| `/api/dashboards/*` | ~6 | ✅ | ✅ | ✅ |
| `/api/client/*` | 9 | parcial | ✅ | ✅ |
| `/api/admin/*` | ~8 | ✅ | ⚠️ | parcial |
| `/api/ai/*` (assist, coach) | 4 | N/A | ✅ | ✅ |
| `/api/geocode/*` | 1 | N/A | ✅ | N/A |
| `/api/load-gen/*` (wind, elevation) | 3 | N/A | ✅ | N/A |
| `/api/workspace/knowledge` | 1 | ⚠️ todo en un handler | ✅ | ✅ |
| `/api/contact/*` | 1 | N/A | público | N/A |
| `/api/search/*` | 2 | N/A | ✅ | ✅ |
| `/api/tags/*` | 4 | ✅ | ✅ | ✅ |
| `/api/sections/*` | 3 | ✅ | ✅ | ✅ |
| `/api/me/*` | 3 | parcial | ✅ | ✅ |
| `/api/work/*` | 4 | parcial | ✅ | ✅ |
| `/api/invite/*` | 4 | ✅ | mixto | ✅ |
| `/api/forms/[id]/track/*` | 2 | público | ⚠️ revisar | N/A |

---

## ORPHAN ENDPOINTS (APIs sin UI visible)

1. **`/api/admin/clients`** — no se encontró componente UI
2. **`/api/admin/workers`** — no se encontró UI
3. Posibles otros admin endpoints — verificar bajo `/admin/*`

---

## MISSING ENDPOINTS / Features con backing parcial

1. **Knowledge CRUD** — `/api/workspace/knowledge` tiene un solo route handler para los 4 verbos. Debería ser:
   - `GET /api/knowledge` → list
   - `POST /api/knowledge` → create
   - `GET/PUT/DELETE /api/knowledge/[id]` → single
2. **Project Brief POST** — existe `GET/PUT /api/projects/[id]/brief` pero no `POST` para crear
3. **Timesheets API** — completamente ausente (TimeEntry es localStorage)
4. **Client batch approvals** — schema permite múltiples approvals pero no hay endpoint batch
5. **DM threading** — `DirectMessage` model existe pero el endpoint es básico (sin threading/UI)

---

## Schema smells

- `TaskStatus` enum (ON_TRACK/AT_RISK/OFF_TRACK) — declarado pero **no se usa en task list views**
- `CommentVisibility` enforced en schema pero **no hay toggle en UI**
- `ObjectiveMember` model completo pero sin UI de sharing
- `ClientApproval.batchId` field existe pero no se usa

---

## Integraciones

| Integración | Estado | Notas |
|-------------|--------|-------|
| **AI Coach** (`/api/ai/coach`) | ✅ REAL | Claude Sonnet, contexto rico |
| **AI Assist** (`/api/ai/assist`) | ✅ | Para summaries varios |
| **Geocoding** (`/api/geocode`) | ❌ STUB | Schema almacena lat/lng pero geocoding no se ejecuta automático |
| **Load Gen — Wind hazard** | ✅ | API externa |
| **Load Gen — Elevation** | ✅ | API externa |
| **Email (invites, notifs)** | ⚠️ verificar | Si hay provider configurado |
| **Maps (Leaflet)** | parcial | Render OK, geocoding stub |

---

## Verdict
Data layer **listo en 80%**. Los gaps grandes:
1. Knowledge CRUD mal estructurado
2. Client portal con schema rico pero implementación pobre
3. Timesheets es una bomba de tiempo (data loss)
4. Algunos enums (TaskStatus) declarados pero no usados → indica feature aspiracional sin ejecución
