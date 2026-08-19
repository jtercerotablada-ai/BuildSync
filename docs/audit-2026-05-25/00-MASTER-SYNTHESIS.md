# BuildSync — Análisis Total del Flujo Web

**Fecha:** 2026-05-25
**Auditor:** 6 agentes paralelos especializados + síntesis
**Scope:** SaaS routes (dashboard / portal / client / fullpage / auth) + API + schema

---

## TL;DR — Veredicto General

BuildSync es una **aplicación seria, real, no un mockup**. Schema robusto (65+ modelos), 153 endpoints reales, infraestructura productiva.

**PERO** tiene **3 categorías de problemas que rompen el flujo lógico:**

1. **Feature aspiracional sin ejecución** (gates cosméticos, goals "5 vistas" reales 4, templates genéricos en SaaS de ingeniería)
2. **Wiring incompleto** (componentes missing, geocoding no se ejecuta, reporting con mock data)
3. **Holes de seguridad** (team privacy leak, portal role no verificado en API, invite sin domain validation)

**Producción ready para:**
- Uso interno de Tercero Tablada como cockpit → SÍ con caveats
- Demos a clientes → SÍ (las 12 calcs y AI Coach impresionan)
- Marketing como "Asana killer" → NO (Goals tiene 4 vistas, no 5; sharing UI ausente; inbox no es real-time)

---

## Mapa de Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTH BOUNDARY                            │
│  /(auth)/login → NextAuth Credentials → JWT con token.role  │
│  proxy.ts decide redirect según role                        │
└────────────┬────────────────────────────────────────────────┘
             │
   ┌─────────┴─────────┬─────────────┬─────────────┐
   │                   │             │             │
   ▼                   ▼             ▼             ▼
OWNER/ADMIN         WORKER         CLIENT      no-role
/home               /portal/       /client/    /onboarding
(dashboard)         dashboard      dashboard   o /home
   │
   ├── /projects ──→ Lifecycle gates (cosmético) ──→ tasks, files, team, goals, portfolios
   │       │
   │       └─→ Cockpit con widgets (real data)
   │
   ├── /goals ──→ AI Coach (Claude Sonnet, REAL) ──→ KRs, sub-objectives, projects (rollup auto)
   │       │                                         confidence score (display only)
   │       └─→ 4 vistas (list, kanban, cards, tree) — falta timeline + dashboard
   │
   ├── /my-tasks ──→ 5 vistas reales (list, board, calendar, dashboard, files)
   │       │       smart sections (Do Today / Next Week / Later)
   │       └─→ Subtasks, dependencies, custom fields, comments
   │
   ├── /tasks ──→ STUB (solo redirect a task detail)
   │
   ├── /inbox ──→ Polling 30s (NO real-time)
   │       │     8 tipos de notif
   │       └─→ NO genera notif para goal check-in ni gate transitions
   │
   ├── /knowledge ──→ Tab Wiki + Tab Calculators
   │       │           12 calcs reales + 2 ROTAS (LoadGen, SectionBuilder)
   │       │           + 4 declaradas "coming soon"
   │       └─→ Sin save-to-project, sin export PDF
   │
   ├── /templates ──→ 25+ templates GENÉRICOS (HR, sales) NO de ingeniería
   │
   ├── /reporting ──→ Dashboard builder con Recharts
   │       │           Mock data (DEFAULT_DASHBOARDS hardcoded)
   │       └─→ Filtros decorativos, NO triggerean API
   │
   ├── /portfolios ──→ CRUD funcional, privacy gates OK
   │
   ├── /teams, /team, (fullpage)/teams/new ──→ Naming confuso pero funciona
   │       │
   │       └─→ ⚠️ Team privacy LEAK (members visibles a non-members)
   │
   ├── /people ──→ Org chart, allocation (overlap con /team?)
   │
   ├── /profile ──→ Editable user info
   │
   └── /settings ──→ 6 tabs (verificar persistencia Notifications + Display)
```

---

## Conexiones Lógicas — Estado por par

### ✅ Conexiones SÓLIDAS

| Origen → Destino | Cómo |
|------------------|------|
| Task → Project | `projectId` FK, scoped queries |
| Task → Goal | Auto-progress rollup via `GoalProgressService` |
| Goal → Sub-goal | Parent-child con cascada |
| Goal → Project (linkeado) | Junction `ObjectiveProject` |
| Project → Portfolio | Junction `PortfolioProject` |
| Project → Team | `ProjectMember` |
| Workspace → todo | Multi-tenant scoping via `verifyWorkspaceAccess()` |
| Comment/Mention → Notification | Inbox recibe (polling) |
| Invite → User → Workspace | Token flow correcto |

### 🟡 Conexiones PARCIALES

| Origen → Destino | Por qué parcial |
|------------------|-----------------|
| Goal → Task UI | Task no muestra "afecto a goals X, Y" |
| Project gate → Audit log | Cambia gate pero no se loggea |
| Project gate → Notification | Cambio no notifica al team |
| Project address → Lat/Lng | Geocoding stub, no se ejecuta |
| Calculator → Project | No puedes guardar calc en project files |
| Knowledge entry → Project | Sin link directo |
| Reporting widget → API real | Widgets usan mock data |
| Status update (check-in) → Notification | Se hace check-in, nadie se entera |

### 🔴 Conexiones ROTAS

| Origen → Destino | Qué rompe |
|------------------|-----------|
| `/` (root) → cualquier cosa | **page.tsx no existe → 404** |
| Portal layout → "/" | Mismo 404 |
| `LoadGenerator` page → component | Componente missing → page rota |
| `SectionBuilder` page → component | Componente missing → page rota |
| `/tasks` → workspace task list | Stub, solo redirect |
| Goals "5 vistas" → timeline + dashboard | NO existen |
| Goal sharing → UI | Schema-ready, ZERO UI |
| Templates → casos de uso AEC | Templates genéricos |
| Reporting → data viva | Mock data, filtros no API |

---

## Issues Priorizados (Top 20)

### 🔴 CRÍTICOS (rompen funcionalidad o seguridad)

1. **Missing `src/app/page.tsx`** — Portal users 404 en redirects
2. **Team Privacy Leak** — `GET /api/teams/[teamId]` retorna miembros de PRIVATE teams a non-members
3. **Portal Role no verificado API-level** — solo layout guard, hueco potencial
4. **LoadGenerator component MISSING** — calculadora rota
5. **SectionBuilder component MISSING** — calculadora rota
6. **Timesheets es localStorage-only** — riesgo data loss
7. **Lifecycle gates sin transition logic** — cualquier rol salta gates sin validación/audit
8. **Project visibility loophole** — miembros pueden marcar proyecto cliente como PUBLIC

### 🟡 IMPORTANTES (UX/parity issues)

9. **Goals "5 vistas" → solo 4** — timeline + dashboard ausentes
10. **`/tasks` route es stub** — no hay "view all workspace tasks"
11. **Inbox polling 30s** — no real-time (vs. Asana <5s)
12. **Goal sharing UI ausente** — schema completo, UI cero
13. **Status update → no notifica** — check-ins son silenciosos
14. **Templates genéricos** — HR/sales en SaaS de ingeniería
15. **Reporting mock data** — widgets no consumen API real
16. **Geocoding no auto-ejecuta** — projects con address pero sin lat/lng
17. **Goal templates sin standalone page** — solo dropdown inline
18. **Project Brief AI = stub** — no llama LLM real
19. **JWT `role` no tipado** — risk runtime error
20. **Invite acepta cualquier email** — sin domain validation

### 🟢 MENORES (nice to have)

- Redirects inconsistentes entre route groups
- Double-redirect risk (auth) + proxy.ts
- TaskStatus enum unused
- CommentVisibility enforced en schema sin UI toggle
- Project type sin comportamiento diferenciado
- People vs Team posible overlap
- Settings Notifications/Display tabs verificar persistencia
- Admin endpoints (`/admin/clients`, `/admin/workers`) sin UI
- Calculator sin save-to-project / sin export PDF

---

## Lo que SÍ está EXCELENTE

✅ **AI Coach con Claude Sonnet** — feature real, contexto rico, mejor que Asana
✅ **Auto-progress de Goals** — 3 estrategias (KEY_RESULTS, SUB_OBJECTIVES, PROJECTS) con cascada
✅ **My-Tasks 5 vistas reales** — list, board, calendar, dashboard, files (todas funcionales)
✅ **Engineering OKR templates** — 5+ templates AEC ready (revenue mix, permit velocity, P.E. signatures)
✅ **Task model Asana-deep** — subtasks, dependencies, custom fields, mentions
✅ **10/12 Calculators con solvers reales + 3D viz** — no son mockups
✅ **Workspace isolation** — `verifyWorkspaceAccess()` consistente, sin leaks cross-tenant
✅ **Portfolios privacy gates** — PUBLIC/WORKSPACE/PRIVATE funcionan
✅ **Project cross-module wiring** — projects ↔ tasks/files/team/goals/portfolios
✅ **CEO demo seed** — `seed-ceo-demo.ts` cubre módulos principales

---

## Recomendaciones Estratégicas

### Fase 1 — Fixes críticos (1-2 días)
- [ ] Crear `src/app/page.tsx` con redirect role-based
- [ ] Añadir privacy gate a `/api/teams/[teamId]`
- [ ] Añadir role check API-level en endpoints portal y client
- [ ] Crear componentes `LoadGenerator` y `SectionBuilder`
- [ ] Tipar JWT.role y Session.user.role en next-auth.d.ts

### Fase 2 — Cierre de wiring (3-5 días)
- [ ] Implementar transition logic + audit log + RBAC para lifecycle gates
- [ ] Auto-geocodificar address al crear/editar proyecto
- [ ] Conectar reporting widgets a API real
- [ ] Notificar status updates (check-ins) y gate transitions al inbox
- [ ] Implementar UI de Goal sharing (usando `ObjectiveMember` existente)

### Fase 3 — Closing the marketing gap (1-2 semanas)
- [ ] Build Goal timeline view
- [ ] Build Goal dashboard view
- [ ] Migrar inbox a real-time (SSE o polling 5s)
- [ ] Reescribir templates para audiencia AEC (ACI 318, AISC, permit workflows)
- [ ] Calculator save-to-project + export PDF
- [ ] Conectar Knowledge entry ↔ Project

### Fase 4 — Tech debt
- [ ] Convertir Timesheets a API-backed (no localStorage)
- [ ] Refactor `/api/workspace/knowledge` a CRUD separado
- [ ] Resolver overlap People vs Team
- [ ] Documentar proxy.ts (o renombrar a middleware.ts)

---

## Métrica de Madurez por Módulo

| Módulo | Madurez | Notas |
|--------|---------|-------|
| Auth + Session | 80% | Tipos sueltos + page.tsx missing |
| Routing + Layouts | 85% | Funcional con redirects inconsistentes |
| Projects core | 85% | Excelente excepto gates |
| Lifecycle Gates | 30% | Cosmético sin logic |
| Tasks (my-tasks) | 95% | Casi Asana-parity |
| Tasks (`/tasks`) | 10% | Stub |
| Goals | 70% | AI Coach es genial, 2 vistas faltantes |
| Knowledge wiki | 85% | Solid |
| Calculators | 75% | 10/12 reales |
| Templates | 40% | Genéricos en SaaS de ingeniería |
| Reporting | 35% | Mock data |
| Inbox | 60% | Polling vs real-time |
| Portfolios | 90% | Bien implementado |
| Teams/Team | 70% | Privacy leak |
| Portal | 65% | Role check incompleto |
| Client area | 70% | Trust implícito |
| Invite/Onboarding | 80% | Sin domain validation |
| Schema/Data layer | 90% | Robusto, algunos enums unused |
| API coverage | 80% | 153 endpoints, knowledge mal estructurado |

**Promedio: 67% madurez** — sólido para uso interno, falta para marketing competitivo.

---

## Conclusión

BuildSync no es vaporware. Hay **trabajo real, infraestructura real, decisiones de producto sensatas**. Pero el gap entre "lo que dice el marketing" y "lo que el código hace" es significativo:

- "13 calculadoras" → realidad 12 (2 rotas)
- "5 vistas de Goals" → realidad 4
- "Lifecycle gates" → realidad badges decorativos
- "Asana killer" → realidad: clone con AI Coach superior y bordes ásperos

**El core (projects + my-tasks + AI Coach + calculadoras funcionales) es production-ready hoy** para uso interno de Tercero Tablada. **Para el pitch a mercado externo, faltan 1-2 sprints de ejecución** para cerrar los gaps de Goals timeline, real-time inbox, sharing UI, y reescribir templates.

**Lo más alarmante:** los 2 leaks de seguridad (team privacy + portal role) deberían fixearse YA — son fixes pequeños pero exposición real.

**Lo más prometedor:** AI Coach con Claude Sonnet es genuinamente diferenciador. Es el moat real de BuildSync vs Asana/Linear.
