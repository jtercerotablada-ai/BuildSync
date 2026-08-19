# 01 — Arquitectura, Auth y Layouts

**Fecha:** 2026-05-25
**Dominio:** Foundation — route groups, NextAuth, RBAC, middleware

---

## Verdict
**MOSTLY SOLID** con 5 gaps críticos. JWT/role logic es sólida, pero hay rutas rotas y typing inconsistente que pueden causar 404s y runtime errors.

---

## Route Groups Map

```
src/app/
├── (auth)/         → login, signup, forgot-password
├── (dashboard)/    → cockpit interno (staff)
│   ├── goals, home, inbox, knowledge, my-tasks,
│   ├── people, portfolios, profile, projects,
│   ├── reporting, settings, tasks, team, teams, templates
├── (portal)/       → área partner (WORKER role)
│   └── teams/
├── (client)/       → área cliente externo (CLIENT role)
│   └── portal/, client/
├── (fullpage)/     → vistas fullpage (sin sidebar)
│   └── teams/new (crear team)
├── (public)/       → marketing site [out of scope]
├── api/            → 153 endpoints
├── onboarding/     → setup post-signup
├── invite/         → flujo invitación con token
├── maintenance/    → página de mantenimiento
└── layout.tsx      → root (providers globales)
```

**MISSING:** `src/app/page.tsx` — no existe la ruta `/` raíz.

---

## NextAuth Setup

- **Config:** `src/lib/auth.ts`
- **Endpoint:** `src/app/api/auth/[...nextauth]/route.ts`
- **Strategy:** JWT session
- **Providers:** Credentials (verificar si hay OAuth adicional)
- **Callbacks:**
  - `jwt()` línea 118 → setea `token.role`
  - `session()` línea 87 → castea `session.user as { role?: string }`

**PROBLEM:** El tipo `Session.user` en `src/types/next-auth.d.ts` NO declara el campo `role`. El código castea dinámicamente con `token as Record<string, unknown>`. Cualquier consumer client-side puede romperse silenciosamente.

---

## Middleware / Proxy

- **NO existe** `src/middleware.ts`
- **EXISTE** `src/proxy.ts` con patrón custom de routing/access control
- `proxy.ts` maneja:
  - `publicExactRoutes` (referencia a `/`)
  - Redirect CLIENT → `/client/dashboard`
  - Redirect autenticados sin role → `/home`

---

## Roles & Permissions

Roles encontrados en código:
- **OWNER** — admin total workspace
- **ADMIN** — admin workspace
- **WORKER** — staff/partner (acceso portal)
- **CLIENT** — cliente externo (acceso client area)

**Enforcement:**
- Layout-level: `(auth)`, `(dashboard)`, `(portal)`, `(client)` cada uno checkea role
- API-level: helper `verifyWorkspaceAccess()` aplicado en muchos endpoints (NO en todos — ver Agente 6)

---

## Layouts Comparison

| Group | Shell | Sidebar | Topbar | Auth check |
|-------|-------|---------|--------|------------|
| (auth) | Centered card | ❌ | ❌ | Si autenticado → redirect /home |
| (dashboard) | Sidebar + topbar | ✅ Full nav | ✅ | Si no auth → /login |
| (portal) | Sidebar partner | ✅ Reducida | ✅ | Si rol != WORKER → "/" (ROTO) |
| (client) | Sidebar cliente | ✅ Mínima | ✅ | Si rol != CLIENT → /home |
| (fullpage) | Sin shell | ❌ | ❌ | Auth check sí |

---

## BROKEN / DISCONNECTED / SUSPICIOUS

### 🔴 1. MISSING ROOT PAGE (`/`)
**File:** `src/app/page.tsx` no existe
**Impact:** Portal layout y `proxy.ts publicExactRoutes` referencian `/` → 404
**Fix:** Crear `src/app/page.tsx` con redirect basado en role, O cambiar portal redirect a `/home`

### 🔴 2. Redirect Targets Inconsistentes
- Portal layout → `/` (roto)
- Client layout → `/home` (válido)
- Dashboard guests → `/home`
- (auth) authenticated → `/home` (no checkea CLIENT)
**Fix:** Estandarizar todos a `/home` con detection de rol, o a `/dispatch` que decida.

### 🟡 3. JWT Role No Tipado
**File:** `src/types/next-auth.d.ts` falta `role?: string` en `JWT` interface
**Impact:** Code casts dinámicos, sin type safety, errores runtime
**Fix:** Extender `JWT` y `Session.user` interfaces con `role?: string`

### 🟡 4. Double-Redirect Risk
`(auth)/layout.tsx` redirige authenticated → `/home` sin checar role CLIENT
`proxy.ts` después intercepta CLIENT → `/client/dashboard`
**Resultado:** Doble redirect en signup de cliente (lento + flicker)
**Fix:** Una sola fuente de verdad — o layout decide, o proxy decide. Eliminar redundancia.

### 🟡 5. No middleware.ts estándar
Usa `proxy.ts` custom. Funcionalidad similar pero **no es el patrón Next.js**. Devs nuevos van a buscar `middleware.ts` y no encontrarán nada.
**Fix:** Documentar en README o renombrar a `middleware.ts`.

### Other notes
- Onboarding redirige a `/home` (dashboard protected) — funciona pero confiar en session reload
- `invite/` flow separado de `(auth)/` — verificar consistencia visual

---

## Verdict final
Foundation funcional. Los issues son **5 fixes pequeños** (1-2 horas total). Ninguno bloquea features, pero el 404 del portal sí afecta usuarios reales.
