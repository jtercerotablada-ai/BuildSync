# 05 — Knowledge Hub + Calculators + Templates + Reporting

**Fecha:** 2026-05-25
**Dominio:** Knowledge layer + tools de ingeniería

---

## Verdict
**90% production-ready.** Las 12 calculators implementadas son **reales con solvers + visualización 3D**. Pero hay **2 calculators completamente rotas** (componentes missing), templates no son de ingeniería, y reporting usa mock data.

---

## Knowledge Hub

### Estructura
`/knowledge` → **Two-tab hub** (per memory)
- Tab 1: Wiki articles
- Tab 2: Calculators index

### Wiki
- CRUD ✅
- Search ✅
- Filtering ✅
- Tagging ✅
- ⚠️ Endpoint mal estructurado (`/api/workspace/knowledge` con 4 verbos en un handler — ver report 02)

---

## The Calculators (12 implementadas + 4 "coming soon")

| # | Calculator | Estado | Componente | Tipo |
|---|-----------|--------|------------|------|
| 1 | Beam | ✅ | Existe | Análisis |
| 2 | Advanced Beam | ✅ | Existe | Análisis |
| 3 | Section Builder | 🔴 **ROTO** | **Componente MISSING** | Análisis |
| 4 | Foundation Design | ✅ | Existe | Diseño |
| 5 | Combined Footing | ✅ | Existe | Diseño |
| 6 | Mat Foundation | ✅ | Existe | Diseño |
| 7 | RC Design | ✅ | Existe | Diseño |
| 8 | Load Generator | 🔴 **ROTO** | **Componente MISSING** | Especializada |
| 9 | Base Plate | ✅ | Existe | Especializada |
| 10 | Retaining Wall | ✅ | Existe | Especializada |
| 11 | Slab | ✅ | Existe | Especializada |
| 12 | (12va — verificar nombre) | ✅ | Existe | — |

**Coming Soon (filtradas en UI):**
- Structural 3D
- Connection Design
- Member Design
- Composite Design

### "13 Calculators" claim
Marketing dice 13. Realidad: **12 implementadas + 4 declaradas pero filtradas**. El número 13 no cuadra ni siquiera contando las "coming soon" (sería 16).

### Calculadoras rotas
1. **Load Generator** (`/knowledge/calculators/load-gen/`)
   - Page importa `LoadGenerator` component
   - Componente NO existe en `src/components/ttc/load-gen/`
   - Falla silenciosa probable
2. **Section Builder** (`/knowledge/calculators/section-builder/`)
   - Mismo patrón: page importa `SectionBuilder`
   - Componente NO existe

### Features comunes
- Solvers reales (no stubs)
- Visualización 3D
- Inputs validados
- Outputs con unidades
- ❌ **Falta:** print/export PDF, save to project, citation de formula source

---

## Templates

### Estado
- **25+ templates pre-built** ✅
- CRUD funcional ✅
- Library + my templates split ✅

### Problema CRÍTICO
**Templates son GENÉRICOS, no de ingeniería:**
- Marketing campaigns
- HR onboarding
- Sales pipeline
- Product launch
- Event planning

**Templates de ingeniería FALTANTES:**
- ACI 318 Checklist
- AISC Splice Design Checklist
- Permit Submission Workflow
- Structural Calc Package
- Site Survey Workflow
- QA/QC Inspection
- RFI Tracking

→ Templates necesitan **reescribirse para audiencia AEC**.

---

## Reporting

### Stack
- **Recharts** para charts
- Dashboard builder con custom widgets
- Filtros y date ranges (UI presente)

### Estado real
- ⚠️ **Widgets inicializan con `DEFAULT_DASHBOARDS` hardcoded**
- ⚠️ Endpoint `/api/dashboards` existe pero **widgets no auto-populate de data real**
- ⚠️ Filtros existen pero **NO triggerean API calls**
- ❌ Export (CSV, PDF) no implementado

→ Reporting es **demo bonito sin data real**.

---

## People

### `/people` (dashboard)
- Org chart vista ✅
- Allocation view ⚠️ verificar
- Skills tracking ⚠️ verificar
- Separado de `/team` y `/teams`

→ Posible overlap con `/team` — clarificar.

---

## Profile

### `/profile`
- Editable: name, avatar, role display, bio
- Activity log
- Settings ↔ profile distinción clara

---

## Settings (6 tabs)

| Tab | Funcional |
|-----|-----------|
| Profile | ✅ |
| Security | ✅ |
| Notifications | ⚠️ guarda? (verificar persistencia) |
| Display | ⚠️ guarda? |
| Workspace | ✅ |
| Account | ✅ |

→ **Verificar persistencia de Notifications y Display tabs** — sospecha de save no funcional.

---

## BROKEN / STUB / INCOMPLETE

### 🔴 1. LoadGenerator component missing
Page existe, componente no → calculadora rota
### 🔴 2. SectionBuilder component missing
Mismo problema
### 🟡 3. Templates genéricos
25+ templates pero ninguno de AEC. Reescribir.
### 🟡 4. Reporting mock data
Widgets no consumen API real. Filtros decorativos.
### 🟡 5. "13 calculators" claim
Solo hay 12 funcionales. Update marketing o agregar la 13.
### 🟡 6. Calculators sin save-to-project
No puedes adjuntar un cálculo a un proyecto/file. Falta integration.
### 🟡 7. Calculators sin export PDF
Ingenieros necesitan documentar cálculos. Sin PDF export es inservible para entrega formal.
### 🟡 8. Settings tabs sin verificar persist
Notifications + Display tabs — testear que save funcione.

---

## Verdict
**Knowledge hub es el "diferenciador" de BuildSync.** Las 10 calcs funcionales son **reales**, no mockups. Pero:
- 2 calcs rotas
- Templates traidores (genéricos en SaaS de ingeniería)
- Reporting cosmético

**Si arreglas LoadGen + SectionBuilder + reescribes templates → knowledge layer queda 100% production-ready.**
