# 06 — Teams + Portfolios + Portal + Client

**Fecha:** 2026-05-25
**Dominio:** Multi-user, multi-tenant, external-facing

---

## Verdict
**COHERENTE pero requiere hardening.** Workspace isolation está sólido vía `verifyWorkspaceAccess()`. **Pero hay 2 leaks de seguridad CRÍTICOS** en team privacy y portal role verification.

---

## Internal Teams Structure

### Tres rutas confusas — clarificación:

| Ruta | Función |
|------|---------|
| `(dashboard)/team/` | **Singular** — página del equipo actual del user |
| `(dashboard)/teams/` | **Plural** — lista de todos los teams del workspace |
| `(fullpage)/teams/new` | Wizard fullpage para crear team |

→ Naming OK pero **memory load** alto para devs nuevos.

---

## Portfolios

### Estado
- ✅ CRUD funcional
- ✅ Privacy gates funcionan: PUBLIC / WORKSPACE / PRIVATE
- ✅ Owner + member check correcto
- ✅ Portfolio-level metrics
- Junction `PortfolioProject` correctamente scoped

→ **Mejor implementado que projects en términos de privacy**.

---

## Portal (área partner — WORKER role)

### Routes bajo `(portal)/`
- `/portal/admin/forms` (forms admin)
- `/portal/portfolios`
- `/portal/projects`
- `/portal/dashboard`
- `/portal/goals`
- `/portal/settings`
- `/portal/teams`

### Auth model
- **Layout guard:** WORKER / ADMIN / OWNER
- **API-level:** ❌ **NO verifica que user tenga rol WORKER antes de servir endpoints portal**
- → **Hueco potencial:** alguien con sesión válida pero rol CLIENT podría hit `/api/portal/*` con curl

### Diferencia vs (dashboard)
- Portal layout es **más reducido** (menos nav)
- Pero **comparte endpoints** con dashboard mayormente
- Pregunta: ¿realmente necesita ser route group separado?

---

## Client Area (external — CLIENT role)

### Routes bajo `(client)/`
8 routes verificadas:
- `/client/dashboard`
- `/client/projects`
- `/client/projects/[id]`
- `/client/approvals`
- `/client/documents`
- `/client/messages`
- `/client/settings`
- `/client/portal` (?)

### Auth model
- **Layout guard:** rol == CLIENT
- **Row-level:** `ClientProjectAccess` scoping ✅
- **API-level:** ❌ Confía en que `ClientProjectAccess` records existen, pero **NO valida rol == CLIENT** en API boundary
- Branding: BuildSync-branded (no white-label por cliente)

---

## Invite Flow

### `/invite/[token]` + `/api/invite/*`
- ✅ Token + expiración + status gates
- ✅ Rol pre-asignado en invite
- ✅ Workspace scoping
- ❌ **Acepta cualquier email** — sin validación de dominio
  - Empresa quiere restringir invites a `@cliente.com`? No se puede.
- Email send: verificar provider configurado

---

## Onboarding

- `/onboarding/` accesible post-signup
- Steps de setup workspace o join workspace
- Redirige a `/home` al terminar (asume rol no-CLIENT)
- Para CLIENT, debería redirigir a `/client/dashboard` (verificar)

---

## Messages / Mentions / Status Updates

| Feature | API | UI | Real-time |
|---------|-----|-----|-----------|
| Messages | ✅ `/api/messages` | ✅ scoped (project chat, team chat) | ❌ polling |
| Mentions | ✅ `/api/mentions` | ✅ @-tagging en comments/tasks | ❌ polling |
| Status updates | ✅ `/api/status-updates` | ✅ check-ins en goals | ❌ NO notifica |

---

## Permission Boundaries

| Boundary | Enforcement |
|----------|-------------|
| Workspace isolation (cross-tenant) | ✅ `verifyWorkspaceAccess()` consistente |
| Project membership | ✅ ProjectMember check |
| Portfolio visibility | ✅ Funciona |
| **Team privacy (PRIVATE teams)** | 🔴 **ROTO** — endpoint retorna miembros a no-miembros |
| **Portal route → WORKER role** | 🔴 **ROTO** — solo layout guard, no API |
| **Client route → CLIENT role** | 🟡 **PARCIAL** — confía en ClientProjectAccess |
| Invite token validation | ✅ |
| Onboarding workspace creation | ✅ |

---

## BROKEN / OVERLAP / SECURITY HOLES

### 🔴 1. Team Privacy Leak [CRITICAL]
`GET /api/teams/[teamId]` retorna `members[]` + counts para teams PRIVATE incluso a **non-members**.
**Fix:** Añadir privacy gate antes de incluir miembros en response.

### 🔴 2. Portal Role Leakage [CRITICAL]
No hay verificación API-level del rol WORKER antes de servir portal endpoints. Layout guard solo.
**Fix:** Añadir `verifyPortalAccess(role: WORKER | ADMIN | OWNER)` helper y aplicar en cada endpoint portal.

### 🟡 3. Client Implicit Trust
Endpoints client confían en `ClientProjectAccess` rows pero no validan rol del user actual = CLIENT.
**Fix:** Añadir role check en API boundary, no solo en layout.

### 🟡 4. Invite sin domain validation
Cualquier email puede aceptar invite. Empresas no pueden restringir.
**Fix:** Workspace setting `allowedInviteDomains: string[]`.

### 🟡 5. Portal vs Dashboard duplicación
Portal layout es reducido pero comparte endpoints. Pregunta: ¿route group separado necesario? Si compartes endpoints, ¿qué realmente diferencia portal de dashboard?

### 🟡 6. Onboarding sin role detection
Termina redirigiendo a `/home` — para CLIENT debería ir a `/client/dashboard`.

### 🟢 7. Workspace isolation
Sólido. No se encontraron leaks cross-tenant.

---

## Verdict
Multi-tenant story **coherente**. Los 2 leaks (team privacy + portal role) son **fixes pequeños pero importantes**. La arquitectura está bien — la implementación necesita refuerzo en role verification.
