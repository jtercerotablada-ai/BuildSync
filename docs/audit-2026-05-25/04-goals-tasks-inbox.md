# 04 — Goals/OKRs + Tasks + Inbox

**Fecha:** 2026-05-25
**Dominio:** Productivity layer

---

## Verdict
**NO es mockup — infraestructura real con LLM real.** Pero promete "5 vistas Goals" y entrega 4. Inbox es polling 30s, no real-time. Goal sharing está en schema sin UI. Es **mejor que Asana en AI Coach, peor en sharing y real-time**.

---

## Goals/OKRs

### Vistas Goals
**Promesa marketing:** 5 vistas (list, board, tree, timeline, dashboard)
**Realidad:** **4 vistas funcionales**

| Vista | Estado |
|-------|--------|
| List | ✅ Funcional |
| Kanban (Board) | ✅ Funcional |
| Cards | ✅ Funcional |
| Tree (Strategy Map) | ✅ Funcional, parent-child hierarchy |
| **Timeline** | ❌ **MISSING** |
| **Dashboard** | ❌ **MISSING** |

### Auto-progress (REAL)
3 estrategias implementadas en `GoalProgressService`:
- `KEY_RESULTS` → promedio % de KRs
- `SUB_OBJECTIVES` → promedio % de hijos
- `PROJECTS` → % task completion de proyectos linkeados

**Cascada hacia arriba funciona** — task completa → recalcula objective → recalcula parent.

### AI Coach (REAL, mejor que Asana)
- Endpoint `/api/ai/coach`
- Modelo: **Claude Sonnet**
- Contexto enviado: objective + projects + KRs + overdue tasks + check-ins
- Respuesta: markdown analysis
- **Verdict:** Esta feature **vale el módulo entero**

### Engineering Templates (REAL)
- 337 líneas en `goal-templates.ts`
- 5+ OKR templates pre-cargados para construction firms:
  - Revenue mix
  - P.E. signatures
  - Permit velocity
  - Project margin
  - Safety incidents
- **PERO** falta página `/goals/templates` standalone — solo dropdown en create modal

### Confidence Score
- Stored: 1-10, nullable
- Displayed: ✅ en cards
- Usado en logic: ❌ **NO** — solo display, no afecta rollup ni alertas

### Goal Sharing (STUB)
- Model `ObjectiveMember` con EDITOR/VIEWER roles → **completo en DB**
- UI: **NO existe botón "Share"** en detail view
- Notificaciones de share: NO implementadas

### Status Updates / Check-ins
- Model `StatusUpdate` ✅
- Dialog UI ✅
- ⚠️ **NO genera notificación** al hacer check-in

---

## Tasks

### `/tasks` vs `/my-tasks` (CONFUSO)

| Ruta | Función |
|------|---------|
| `/tasks` | **Stub** — solo redirect a task detail |
| `/tasks/[id]` | Detail view (modal/page) |
| `/my-tasks` | **5 vistas reales** asignadas al user |
| `/projects/[id]/list` | Tasks scoped al proyecto |

**Problema UX:** No hay "view all workspace tasks" — solo `my-tasks` (asignadas a mí) o scoped por proyecto.

### My-Tasks 5 Vistas (REALES)
1. **List** — Tabla
2. **Board** — Kanban por `MyTaskSection` (Do Today / Do Next Week / Do Later)
3. **Calendar** — Widget completo con drag-drop
4. **Dashboard** — Recharts (completion trend, project breakdown, totals)
5. **Files** — Attachment gallery

### Task Model (Asana-deep)
- Subtasks ✅
- Dependencies (blocking/blocked-by) ✅
- Custom fields ✅
- Collaborators ✅
- Comments ✅
- Attachments ✅
- Tags ✅
- Priority ✅
- Due date ✅
- Recurring (verificar)

### Smart Sections (`MyTaskSection`)
- Persisten via `PATCH /api/tasks/:id { myTaskSection }`
- Board view los usa correctamente
- ⚠️ Inbox NO muestra en qué section vive una task

---

## Inbox

### Estado
- **Polling 30 segundos** (`setInterval`) — **NO real-time**
- Asana hace push <5s → BuildSync tiene 6× más lag
- 8 tipos de notificación:
  - mention, comment, task_assigned, update, system, form_submitted, etc.
- Mark read/unread ✅
- Archive ✅
- Filter by type ✅

### Notificaciones que se generan
- Task assigned ✅
- Comment / mention ✅
- Form submitted ✅
- Update (status change) ✅
- ❌ Status update / check-in en goal → **NO genera notif**
- ❌ Goal compartido contigo → **NO genera notif**
- ❌ Gate transition en proyecto → **NO genera notif**

---

## Goal ↔ Task ↔ Project Rollup

| Dirección | Estado |
|-----------|--------|
| Task complete → Goal % | ✅ Cascada automática |
| Goal % → Parent goal % | ✅ Recursive |
| Project task completion → Goal | ✅ |
| **Task UI muestra qué goals impacta** | ❌ NO |
| **Goal detail muestra tasks linkeadas** | parcial — vía LinkedWorkPanel |

---

## Asana Parity Scorecard

| Feature | Asana | BuildSync | Status |
|---------|-------|-----------|--------|
| Goal list + Kanban | ✅ | ✅ | Parity |
| Goal timeline | ✅ | ❌ | Missing |
| Goal portfolio view | ✅ | ❌ | Missing |
| 5+ task views (my-tasks) | ✅ | ✅ | Parity |
| Task comments | ✅ | ✅ | Parity |
| Task dependencies | ✅ | ✅ | Parity |
| Goal rollup auto | ✅ | ✅ parcial | Partial |
| Confidence scoring | ✅ usado | ✅ display only | Weak |
| Inbox real-time | ✅ <5s | polling 30s | Behind |
| Goal sharing + perms | ✅ | schema only | Stub |
| AI coaching | ❌ | ✅ Claude | **BuildSync wins** |

---

## BROKEN / STUB / MOCK DATA

1. **Goals timeline view** — ausente, promesa "5 vistas" rota
2. **Goals dashboard view** — ausente
3. **`/tasks` route** — stub, redirect only
4. **Goal sharing UI** — model existe, UI no
5. **Goal `/templates` page** — solo dropdown inline, no standalone
6. **Status update notification** — check-ins no notifican
7. **Calendar feed** — endpoint `iCal URL` existe pero no testeado
8. **Confidence score logic** — solo display
9. **Inbox real-time** — polling, debería ser SSE/websocket
10. **Task → Goals impact** — no se muestra en task UI

---

## Verdict
**Es un Asana clone con AI Coach superior.** Para uso interno engineering firm está listo. Para desplazar Asana en el mercado faltan: Goal timeline, real-time inbox, goal sharing UI. **AI Coach es el moat real.**
