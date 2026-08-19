# 03 — Projects y Lifecycle Gates

**Fecha:** 2026-05-25
**Dominio:** Núcleo SaaS — projects, 4 types, 5 gates, kanban, calendar, maps

---

## Verdict
**85% production-ready.** UI ↔ API ↔ DB sólido. Vistas, filtros, cross-module wiring funcionan. **PERO los lifecycle gates son cosméticos**, los maps no geocodifican, y no hay diferenciación por tipo de proyecto.

---

## Project Routes Tree

```
(dashboard)/projects/
├── page.tsx                    → List (default), Grid, Gantt views
├── new/
│   └── page.tsx                → Create flow
├── [projectId]/
│   ├── page.tsx                → Overview (cockpit)
│   ├── list/                   → Tasks list view
│   ├── board/                  → Kanban
│   ├── timeline/               → Gantt
│   ├── calendar/               → Calendar
│   ├── files/                  → Attachments
│   ├── team/                   → Project members
│   ├── messages/               → Project chat
│   └── settings/               → Project config
```

**8 tabs en project detail.** Sub-nav consistente.

---

## Project List Views

| Vista | Funcional | Datos | Filtros |
|-------|-----------|-------|---------|
| List | ✅ | Real | type, status, gate, owner, client |
| Grid | ✅ | Real | mismos |
| Gantt | ✅ | Real | mismos |
| Calendar | ⚠️ parcial | Real | falta evento de milestones |
| Map | ❌ | N/A | Solo en cockpit home, no en project list |

**Bulk actions:** existen (select multiple → archive/delete/move)

---

## Project Detail Anatomy

8 tabs verificados:

1. **Overview** — Cockpit con widgets (progress, team, recent activity, gate)
2. **List** — Tasks scoped al proyecto
3. **Board** — Kanban (drag to move status — verificar persistencia)
4. **Timeline** — Gantt con dependencies
5. **Calendar** — Eventos del proyecto
6. **Files** — Attachments con upload
7. **Team** — Members del proyecto (subset workspace)
8. **Messages** — Chat del proyecto

**Falta tab Gates** explícito — gates se muestran solo en Overview.

---

## Lifecycle Gates (5)

Enum verificado en schema:
```
PRE_DESIGN → DESIGN → REVIEW → CONSTRUCTION → CLOSEOUT
```

**Estado actual:**
- ✅ Gate actual se muestra como badge/stepper
- ✅ API `PATCH /api/projects/[id]/gate` existe
- ❌ **NO hay transition logic** — cualquier rol puede saltar a cualquier gate
- ❌ **NO hay entry/exit criteria checks**
- ❌ **NO hay audit log de transiciones**
- ❌ **NO hay role gating** (drafter junior puede mover a CONSTRUCTION)
- ❌ **NO hay notificaciones cuando gate cambia**

**Esto es el GAP MÁS GRANDE del módulo Projects.** Es feature aspiracional.

---

## 4 Project Types

Enum (verificar nombres exactos):
- Estructural
- Civil
- Survey
- MEP (o similar)

**Estado:** Type es solo un label/filter. **NO hay:**
- Campos diferenciados por tipo
- Templates diferentes por tipo
- Workflows diferentes
- Calculators sugeridas por tipo

→ Type es decoración.

---

## Maps Integration (Leaflet)

- **Schema:** `Project.latitude`, `Project.longitude`, `Project.address`
- **Display:** Solo en cockpit home (Dashboard widget de proyectos en mapa)
- **Geocoding:** `/api/geocode` existe pero **NO se llama automáticamente** al crear/editar proyecto
- **Resultado:** Proyectos creados con address tienen `latitude/longitude = null` → no aparecen en mapa

---

## Cross-Module Wiring

| Conexión | Estado |
|----------|--------|
| Projects → Tasks | ✅ Scoped por `projectId` |
| Projects → Goals | ✅ Junction `ObjectiveProject`, panel LinkedWork |
| Projects → Files | ✅ Attachments funcional |
| Projects → Team | ✅ ProjectMember model |
| Projects → Portfolios | ✅ Junction `PortfolioProject` |
| Projects → Client Portal | ✅ ClientProjectAccess (row-level) |
| Projects → Messages | ✅ Chat scoped por proyecto |
| Projects → Calendar (workspace) | ⚠️ verificar feed |
| Projects → Knowledge | ❌ No hay link directo project↔knowledge entry |
| Projects → Reporting | ⚠️ Reporting usa mock data |

---

## BROKEN / STUB / DISCONNECTED

### 🔴 1. Gate transitions sin reglas
Cualquier rol puede cambiar cualquier gate. Sin audit. Sin entry criteria. Es el gap mayor.

### 🔴 2. Geocoding stub
Address se guarda como texto, lat/lng quedan null. Maps muestra solo proyectos con coords manuales (probablemente seed data).

### 🟡 3. Project Brief AI Composer = stub
El botón "Generate brief with AI" no llama OpenAI/Claude — devuelve texto hardcoded.

### 🟡 4. Portfolio visibility loophole
Si un miembro marca proyecto cliente como `visibility: PUBLIC`, no hay validación. Posible data leak.

### 🟡 5. Project type sin uso real
4 types pero comportamiento idéntico. Es metadata sin propósito.

### 🟡 6. Calendar de proyecto sin feed
No exporta iCal. No se sincroniza con my-tasks calendar.

### 🟡 7. Knowledge link missing
No puedes adjuntar un knowledge entry a un proyecto. Conexión faltante.

### 🟢 8. Kanban drag persistence
**Verificar manualmente** — código sugiere que sí persiste pero no se testeo.

---

## Verdict
Projects es la **mejor parte de BuildSync**. Cockpit funciona, vistas funcionan, cross-module wiring sólido. Pero los gates — el feature más vendible — son **decoración**. Hasta que tengas transition rules + audit + RBAC, es Asana con badges bonitos.
