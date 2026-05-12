I have comprehensive data. Now let me compile the full report.

# Investigación Exhaustiva: 20 Plataformas de Gestión de Proyectos — Comparativa para BuildSync

**Cliente:** Juan Tercero, CEO Tercero Tablada Civil & Structural Engineering
**Producto en construcción:** BuildSync (SaaS interna para Construction / Design / Recertification / Permit)
**Fecha:** Mayo 2026
**Alcance:** 20 plataformas categorizadas, 6 secciones de síntesis

---

## A) AEC / CONSTRUCCIÓN (5)

### 1. Procore

**URL:** https://www.procore.com
**Categoría:** AEC
**Target market:** General contractors y construction managers medianos-grandes (15,700+ teams, 60%+ Fortune 500 GC adoption); secundario specialty contractors. Compradores típicos: VP Operations, Project Executive, PMP en GC de 50-2,000+ empleados.
**Pricing:** Modelo opaco basado en **Annual Construction Volume (ACV)** — no per-seat. Empieza ~$375/mes ($4,500-$10,000/año small contractor), >$25,000/año mid-large GC. NRR 114% en 2023 (clientes existentes pagan 14% más año tras año). **Unlimited users** es la palanca comercial: tú pagas por volumen $ que pasa por la plataforma, los users son ilimitados. Implementation: 4-8 semanas básico, 3-6 meses suite completa.

**Killer features:**
1. **Modelo de licenciamiento por ACV con usuarios ilimitados** — único en el mercado AEC, permite al GC invitar a TODOS los subs/owners/architects sin costo marginal
2. **RFI/Submittal workflows con AI Draft Agent** — drafting automático de subject, question, cost/schedule impact
3. **Procore Pay** — integrado con Lien Waivers, sub-tier waivers, AIA G702/G703 automation, compliance checks
4. **Procore Analytics + Data Connector** — extracción a BI tools, dashboards de Project Health
5. **Granular permissions** por tool, por project, por company-level

**Terminología propietaria:** RFI, Submittal, Daily Log, Punch List, T&M Ticket (Time & Material), Observations, Commitments (subcontracts), Prime Contract, Budget vs Actual, Forecast to Complete, Direct Costs, Owner Invoice, Subcontractor Invoice, Pay Application, Sub-Tier Waiver, Schedule of Values (SOV), Markup, Drawings (no Sheets — es "Drawings").

**UX patterns únicos:** Top-nav azul (`#1c5bba` Procore Blue), iconografía minimalista, densidad media-alta en tablas, navegación jerárquica Project → Tool. Layout de tres columnas con sidebar persistente. "Email-to-tool" — mandas email a una dirección y crea RFI/Punch item automático.

**Vistas:** Tabla (default), Kanban opcional, Schedule/Gantt (lite), Photos timeline, BIM viewer integrado, Map view de portfolio, Reports tab por cada tool.

**Métricas/dashboards:** Project Health (RFI response time, submittal review aging, % schedule complete, % budget consumed), Portfolio Financial Performance, Forecasted Cost at Completion, Budget Snapshot, Cost-to-Date vs Forecast. Por defecto NO muestra EVM clásico (PV/EV/AC) — usa terminología "Forecast" y "Original Budget vs Revised Budget vs Actual vs Forecast Final Cost".

**Integraciones notables:** QuickBooks, Sage 100/300/Intacct, Viewpoint Vista, DocuSign, Box, Bluebeam Revu, Autodesk Construction Cloud (bridge), Microsoft 365, ERP custom via Procore Connect.

**Qué BuildSync DEBE robar:**
- **Email-to-create** en cada tool (RFI, Punch, Observation) — reduce friction enorme en field
- **AIA G702/G703 generation automático** desde Schedule of Values
- **Permissions matriz por tool × user role** — granular y predecible
- **Lien waiver workflows** con sub-tier para subs de subs
- **"Forecast to Complete" terminology** en lugar de solo "Budget vs Actual" — más profesional

**Qué BuildSync DEBE evitar:**
- Pricing opaco y agresivo — Juan está construyendo una herramienta interna, pero si llega a vender debe publicar precios
- Implementation de 3-6 meses — Procore lo justifica con scale, una firma de 5-20 personas necesita onboarding de 1-2 días
- Sobrepoblar el menú principal con 30+ tools — Procore satura el sidebar; BuildSync debe consolidar

**PMI-feel:** **9/10** — es el estándar de facto para PMP/PE en construction. Compañeros con CCM (Certified Construction Manager) lo respetan.

[Sources: Procore Pricing 2026 (Planyard, TrustRadius), Procore vs Autodesk (Procore.com), Procore RFI/Submittal docs]

---

### 2. Autodesk Build / Construction Cloud (ACC)

**URL:** https://construction.autodesk.com (rebrand parcial a Autodesk Forma)
**Categoría:** AEC
**Target market:** Firms que ya usan Autodesk Revit/AutoCAD/Civil 3D upstream — GC y design-build con BIM workflow nativo. Architects, MEP engineers, structural engineers, large GC.
**Pricing:** Per-user license tiered. Autodesk Build ~$2,310/user/year. Bundle Construction Cloud (Build + Docs + Takeoff + BIM Collaborate) más caro. Modelo named-user de Autodesk Account Admin.

**Killer features:**
1. **BIM 360 + PlanGrid heritage unificado en ACC** — un solo modelo + sheets + issues integrados con BCF (BIM Collaboration Format)
2. **Model Coordination con clash detection** automático nativo, no plugin
3. **RFI/Submittal workflows configurables a nivel RFI individual** (no solo project-level)
4. **Autodesk Docs** — common data environment con permissions ISO 19650-compliant
5. **Cost Management con Cost Connect** — vincula budget items a contract documents, change orders, pay apps
6. **Takeoff con 2D + 3D quantification** directo del modelo Revit

**Terminología propietaria:** Sheets (drawings), Issues, Markups, Submittals, RFIs, Forms (daily reports/inspections), Assets, Photos, Meetings, Project Files, Companies, Members, Folders (DMS), Reviews, Approvals, Transmittals, BCF, Cost Items, Budget Codes, Change Orders, Main Contracts, Subcontracts, Bid Packages.

**UX patterns únicos:** Top-nav negro con accent azul Autodesk. Layout fuerte de "model + 2D" lado a lado. Densidad media. Navegación module-switcher arriba a la izquierda con drop-down de Insight / Build / Docs / Takeoff.

**Vistas:** Sheets viewer (2D), Model viewer (3D), List, Cards, Files tree, Kanban (Issues), Calendar (Schedule), Gantt (Schedule lite).

**Métricas/dashboards:** Project Home con widgets de issues abiertos, RFI aging, submittal aging, recently uploaded sheets. Insight & Reporting con Power BI templates. No EVM clásico — más enfoque en "Cost Forecast" y "Risk" via Construction IQ (AI risk scoring).

**Integraciones notables:** Revit/AutoCAD/Civil 3D obviamente, Bluebeam, Procore (vía ACC Connect), Bridge entre proyectos, BIM 360, PowerBI, ACC Connect (no-code integrations builder).

**Qué BuildSync DEBE robar:**
- **Issue + Markup workflow encima de planos** — pin de issue en el PDF/dwg con location, photo, asignee
- **BCF export/import** — interoperabilidad estructural con Revit/IFC
- **Cost Items vinculados a documents** — cada budget item linkea a su contrato, change order, invoice
- **ISO 19650 folder structure** — WIP / Shared / Published / Archive para BuildSync Document module

**Qué BuildSync DEBE evitar:**
- UI cargada por integración a 5+ modules — Build solo se siente "cohesionado" si pagas todo el suite
- Dependencia de Autodesk Account — vendor lock-in extremo
- Sheets viewer lento en mobile

**PMI-feel:** **8/10** — fuerte en design+construction integration, pero más BIM-céntrico que cost-céntrico. Respetado por architects más que por schedulers PMP.

[Sources: Autodesk Construction Cloud product updates blog, Capterra ACC reviews, BIMservices comparing BIM 360 vs ACC]

---

### 3. Buildertrend

**URL:** https://buildertrend.com
**Categoría:** AEC (residential focus)
**Target market:** Custom homebuilders, remodelers, specialty trade contractors (roofers, pool installers, landscapers). 20,000+ contractors. Empresa promedio: 3-25 empleados, residencial.
**Pricing:** Tiered flat (no per-seat). Essential $339/mes annual ($199 first month promo), Advanced $599/mes, Complete $829/mes. Implementación 1-2 semanas — muy rápida.

**Killer features:**
1. **CRM integrado** con sales pipeline → estimate → contract → project handoff (único en AEC)
2. **Homeowner portal** con selections, payments, daily updates — UX diseñada para consumidor final
3. **Takeoffs + Estimating + Proposals con eSignature** integrados
4. **Subcontractor portal gratis** para subs (no le cuesta al GC)
5. **Customer payments via integrated payment processor** (ACH + card)

**Terminología propietaria:** Leads, Opportunities, Bids, Proposals, Selections (decisiones de client tipo "tile color"), Change Orders, Daily Logs, To-Do's, Schedule items, Warranty (post-construction service tickets), Owner Invoices, Subcontractor Payments.

**UX patterns únicos:** Top-nav azul/blanco. Layout estilo "dashboard" con tiles. Densidad baja-media — diseñado para que homeowners no técnicos lo usen. iOS/Android apps con paridad muy alta.

**Vistas:** Dashboard tiles, List, Calendar, Gantt (lite, no critical path), Map.

**Métricas/dashboards:** Job profitability, Cash flow, Lead conversion rate, Time on selection decisions, Daily activity feed.

**Integraciones:** QuickBooks (deep), Xero, Gusto (payroll), DocuSign, CompanyCam, custom Zapier.

**Qué BuildSync DEBE robar:**
- **Selections module** — para Recertification y Permit projects, el cliente toma decisiones (qué inspector usar, qué scope) — un módulo "Selections" donde el cliente elige y firma es brillante
- **Daily Log con auto-pull weather** (Buildertrend trae weather automático en cada Daily Log)
- **Client-friendly UI** — para Juan, que sirve a developers y owners no técnicos, baja barrera de entrada
- **Warranty/service ticket módulo** — después de Recertification, hay seguimientos de inspección

**Qué BuildSync DEBE evitar:**
- Densidad baja — para una firma estructural PE/PMP, se sentiría "para tontos"
- No tiene CPM real, no resource leveling, no EVM
- Gantt sin critical path — lo opuesto a Primavera-feel

**PMI-feel:** **3/10** — diseñado anti-PMI. Es para builders, no para PEs.

[Sources: Buildertrend.com features, Buildertrend vs Procore (TechRepublic, Capterra), Submittal Link comparison]

---

### 4. Fieldwire (by Hilti)

**URL:** https://www.fieldwire.com
**Categoría:** AEC (field-focused)
**Target market:** Foremen, superintendents, field engineers en GC y specialty contractors. 4M+ jobsites. Sweet spot: projects $10M-$1B.
**Pricing:** Pro $29/user/mes, Business $49/user/mes, Premier $89/user/mes, Basic free. **Unlimited sheets + unlimited projects en todos los plans**.

**Killer features:**
1. **Tasks pinneadas en sheets/plans con location pin, photo, checklist** — el patrón de UX más copiado en AEC
2. **Offline-first mobile** — funciona sin conexión, sync cuando regresa señal (crítico en jobsites)
3. **Plan version control con auto-hyperlinking** — cuando una sheet referencia otra, Fieldwire crea hyperlink automático entre las dos
4. **As-built documentation con photo/video verification**
5. **Field Intelligence (AI)** — flags tasks con riesgo basado en patterns históricos

**Terminología propietaria:** Tasks (no Issues, no RFIs), Plans (no Drawings, no Sheets), Categories, Hashtags, Forms, Checklists, Markups, Locations, Floors.

**UX patterns únicos:** Layout 70% plan viewer + 30% task list. iOS-first design — el web feels like an iPad app. Gestures pinch-zoom muy refinados. Color coding por status: rojo/amarillo/verde/gris simple.

**Vistas:** Plan view (default), Task list, Schedule (basic), Categories grid, Forms list, Photos timeline.

**Métricas/dashboards:** Task completion rate, Aging tasks, Forms submitted, Photos uploaded, Daily activity by user. Minimal — Fieldwire es deliberadamente narrow scope.

**Integraciones:** Procore (sync bidireccional), Autodesk BIM 360/ACC, Microsoft Teams, Slack, Open API.

**Qué BuildSync DEBE robar:**
- **Pin de issue/task directamente en PDF/plan** — UX standard de AEC field tools, Procore lo tiene pero Fieldwire lo perfeccionó
- **Offline-first mobile** para field work (recertifications en CDMX o Bogotá pueden no tener señal)
- **Auto-hyperlinking entre sheets cuando S1.01 referencia S2.05** — para un structural firm es perfecto
- **"Forms" customizables** — checklists de inspección, daily reports, safety toolbox

**Qué BuildSync DEBE evitar:**
- Scope narrow — Fieldwire NO maneja contracts, RFIs formales, budgets, schedules complejos. BuildSync debe ser más amplio
- Densidad baja en task list — para PMP necesitas grid views con 15+ columnas

**PMI-feel:** **5/10** — respetado en field, pero PMOs de oficina lo ven como "punch list app".

[Sources: Fieldwire.com features, Fieldwire pricing 2026, Fieldwire punch list blogs]

---

### 5. Oracle Aconex

**URL:** https://www.oracle.com/construction-engineering/aconex/
**Categoría:** AEC (enterprise infrastructure)
**Target market:** Mega-proyectos de infrastructure ($500M-$10B+) — autopistas, aeropuertos, plantas nucleares, mineras. Owners (no GCs principalmente). Government agencies. 
**Pricing:** Custom enterprise. Para 1,000+ users: **$40,000-$100,000/mes**. Tiers: Project, Enterprise, Connect. Modelo pay-per-user-role (contractor, sub, owner, architect, engineer).

**Killer features:**
1. **Common Data Environment (CDE)** ISO 19650-compliant — "millions of documents and models with strict version control"
2. **Document workflows con Review Matrix** — auto-initiate approval flow basado en document metadata
3. **Mail module** — substituye email externo, todo logged y auditable
4. **Neutral platform** — owner-driven, no GC-driven. Todos los stakeholders en una sola CDE
5. **Aconex Connected Cost** + Primavera P6 integration nativa
6. **Document Process** (2024 launch) — comment management integrado en review

**Terminología propietaria:** CDE (Common Data Environment), Mail, Workflows, Tasks, Document Status Codes (S1, S2, A1, A2 — ISO 19650), Review Matrix, Bidding, Tenders, Packages, Lots, BIM Models, Models Register, Issues Register, RFI Register.

**UX patterns únicos:** Layout estilo enterprise CRM 2010 — funcional, no bonito. Top-nav rojo Oracle. Densidad alta. Mucho dropdown nested. Diseñado para auditoria legal — cada acción es loggeable y exportable a court.

**Vistas:** Document list (default), Workflow inbox, Calendar, Search results, Model viewer.

**Métricas/dashboards:** Workflow aging, Overdue reviews, Documents pending approval, Model federation status. Compliance-heavy.

**Integraciones:** Primavera P6 (deep — same Oracle), Oracle EBS, Unifier, JD Edwards, AutoCAD, Revit, IFC, BCF.

**Qué BuildSync DEBE robar:**
- **Document Status Codes ISO 19650** (S1-S6 para Shared, A1-A4 para Approved) — terminología que un PE/PMP estructural reconoce inmediatamente
- **Transmittal log** auditable — cada document sent tiene receipt, opened, downloaded timestamps
- **Review Matrix** — defines who reviews what based on metadata (discipline, doc type)
- **Owner-neutral data ownership** — el cliente owner mantiene los documentos al final del proyecto

**Qué BuildSync DEBE evitar:**
- UI viejísima — Aconex se siente como Lotus Notes
- Implementation 3-6 meses + $40k/mes overkill total para una firma de 5-20 PEs
- Curva de aprendizaje brutal para users casuales

**PMI-feel:** **10/10** — Aconex es donde se entrenan PMP/PMI-RMP en infrastructure. Es la "Bloomberg Terminal" del AEC.

[Sources: Oracle Aconex datasheet, Oracle PR 2026 release, ITQlick Aconex pricing review, Cleverence Aconex guide]

---

## B) ENTERPRISE PMO / SCHEDULE / EVM (5)

### 6. Primavera P6 (EPPM / Professional / Cloud)

**URL:** https://www.oracle.com/construction-engineering/primavera-p6/
**Categoría:** Enterprise PMO
**Target market:** Schedulers PMP/PSP (Planning Scheduling Professional), EPC contractors (Bechtel, Fluor, Kiewit), aerospace, defense, oil&gas, large infrastructure. Schedulers certificados con AACEi.
**Pricing:** 
- P6 Professional desktop: ~$3,520/user perpetual + $500-800/year support (22%)
- P6 EPPM cloud: ~$250-350/user/mes (subscription)
- P6 Cloud Service: $125/user/mes
- Add-ons: Portfolio Planning $2,640/user/year, Task Management $660/user/year
- Min purchase: 5 named users

**Killer features:**
1. **Critical Path Method (CPM) engine** — el más respetado de la industria. Schedules de 50,000+ activities con resource leveling
2. **EPS (Enterprise Project Structure) + OBS (Organization Breakdown Structure)** — multi-nivel hierarchies de portfolios
3. **WBS** detallado con WBS Summary activities, weights, completion methods
4. **Resource Leveling automático** con multi-pass algorithm — considera curvas de utilización por resource pool
5. **Reflection Projects** — what-if scenarios sin afectar baseline
6. **Activity Codes + UDFs (User Defined Fields)** — categorización custom infinita
7. **Multiple baselines** (project baseline, primary user, secondary user) — variance tracking robusto
8. **EVM completo:** PV (Planned Value), EV (Earned Value), AC (Actual Cost), CPI, SPI, EAC, ETC, TCPI, BCWS, BCWP, ACWP

**Terminología propietaria:** Activity (no Task), WBS, EPS, OBS, Predecessor/Successor con SS/FS/FF/SF + Lag, Total Float, Free Float, Drive Float, Constraint (FNLT, SNET, MFO, etc.), Reflection, Baseline, Recovery Schedule, Activity Code, UDF, Resource Curve, Resource Lag, Cost Account, Notebook Topic, Step (granular subtask), Look-Ahead (3-week, 6-week filter), TIA (Time Impact Analysis), Fragnet.

**UX patterns únicos:** Layout Windows-95-era tabla principal + Gantt encima. Densidad EXTREMA — schedulers ven 30+ columnas. Color: barras Gantt con patterns de hatching para diferentes activity types. Fonts: monospace para columnas numéricas (variance, days, %). Tooltip-heavy. Right-click menus profundos.

**Vistas:** Activity Network (PDM logic diagram), Gantt (default), Activity Table, Resource Profile (histogram + curve), Resource Usage Spreadsheet, WBS view, Trace Logic, Activity Usage Profile, Earned Value report.

**Métricas/dashboards:** Schedule Variance, Cost Variance, BAC (Budget at Completion), EAC (Estimate at Completion), ETC (Estimate to Complete), VAC (Variance at Completion), CPI, SPI, To-Complete Performance Index (TCPI), Float distribution histograms, Resource utilization curves, S-curve (planned vs actual).

**Integraciones:** Oracle Aconex (nativo), Unifier, Risk Analysis (PRA), EBS, JD Edwards, SAP, Microsoft Project (XML/XER import), Tilos (linear scheduling).

**Qué BuildSync DEBE robar:**
- **CPM engine con Total Float y Free Float visible por activity** — Juan ya tiene Gantt + gates, debe añadir CPM real con float calculations
- **Multiple baselines** (Original, Current Approved, Rebaseline 1, Rebaseline 2) con variance tracking
- **Activity Codes** — taxonomía custom (discipline, phase, location, contractor) para filtrar
- **Look-Ahead filter** (Activity Filter: Started or Will Start within 21 days) — standard PMP practice
- **S-curve graph** — planned cumulative cost vs actual cumulative — standard PE deliverable
- **Schedule QC metrics:** DCMA 14-point assessment (Logic, Leads, Lags, FS Relationships, Hard Constraints, High Float, Negative Float, High Duration, Invalid Dates, Resources, Missed Tasks, Critical Path Test, Critical Path Length Index, Baseline Execution Index)
- **EVM dashboard ya está, pero terminologías exactas:** BAC, EAC, ETC, VAC, TCPI deben aparecer literal, no solo "Estimate Final Cost"
- **Reflection / What-if scenarios** — duplicate schedule, test impacts, no afectar baseline

**Qué BuildSync DEBE evitar:**
- UI de los 90s — Juan ya tiene aesthetic moderna, no replicar Windows Forms
- Curva de aprendizaje 6 meses — Primavera tiene esa fama, BuildSync debe ser self-serve
- Desktop-only mentality — P6 Professional aún es desktop

**PMI-feel:** **10/10** — es EL estándar. Ningún software AEC compite con P6 en CPM puro. Schedulers AACEi PSP requieren P6 por cert exam.

[Sources: Oracle Primavera P6 official, Project Control Academy EVM tutorial, Multisoft P6 features, AACEi PMP P6 docs]

---

### 7. Microsoft Project / Planner & Project

**URL:** https://www.microsoft.com/en-us/microsoft-365/project
**Categoría:** Enterprise PMO
**Target market:** PMOs en empresas con stack Microsoft. PMs híbridos. Sept 2024 rebrand: Project Plan 3 → "Planner and Project Plan 3", Plan 5 → "Planner and Project Plan 5". Pivote hacia Planner web-first, Project Professional legacy.
**Pricing:** 
- Planner in M365 (free, parte de M365 E3/E5)
- Planner Plan 1: $10/user/mes
- Planner & Project Plan 3: $30/user/mes
- Planner & Project Plan 5: $55/user/mes
- Project Standard 2024 desktop perpetual: ~$680
- Project Professional 2024: ~$1,130

**Killer features:**
1. **EVM nativo** con PV/EV/AC, CPI, SPI, CV, SV calculados automáticamente desde baseline
2. **Resource Leveling** con priority + leveling delay
3. **Roadmaps** — agregación multi-project para portfolio view
4. **Microsoft 365 Copilot integration** — AI para plan generation, risk monitoring
5. **Power BI templates** out-of-box para Project Online dashboards
6. **Backlogs, sprints, lead/lag dependencies** en Planner & Project Plan 3
7. **Resource Engagements** (Plan 5) — request/approve workflow para shared resources

**Terminología propietaria:** Task, Summary Task, Milestone, Subtask, Predecessor/Successor con SS/FS/FF/SF + Lag, Constraint (ASAP, ALAP, MSO, MFO, SNET, FNLT), Baseline (10 baselines disponibles), Slack (alias de Float), Critical Task (Total Slack ≤ 0), Earned Value tables, Cost Resource, Material Resource, Work Resource, Generic Resource, Cost Rate Tables (A/B/C/D/E), Timesheets, Assignments.

**UX patterns únicos:** Ribbon menu (legacy Office), Gantt con barras simples (menos pattern-heavy que P6), tabla densa columns customizables. New Planner web-app más limpia, board-style. Theme azul-claro Microsoft Fluent.

**Vistas:** Gantt (default), Task Sheet, Resource Sheet, Resource Usage, Task Usage, Network Diagram (PERT), Calendar, Team Planner, Timeline, Roadmap (Plan 3+), Grid (Planner web), Board (Planner web), Schedule (Planner web).

**Métricas/dashboards:** EVM table con 16 columnas (BCWS, BCWP, ACWP, SV, CV, EAC, BAC, VAC, CPI, SPI, etc.). Power BI Project Web App dashboard. Critical path highlight in red.

**Integraciones:** Native Microsoft 365 (Teams, SharePoint, Outlook), Power BI, Power Automate, Power Apps, Azure DevOps, Dynamics 365.

**Qué BuildSync DEBE robar:**
- **EVM table layout con las 16 columnas standard PMI** (CPI, SPI, BCWS, BCWP, ACWP, EAC, ETC, VAC) — BuildSync ya tiene PV/EV/AC/CPI/SPI/EAC, debe añadir BCWS/BCWP/ACWP aliases (PMP exam terminology), VAC, ETC, TCPI
- **10 baselines** — múltiples baselines snapshots con timestamp y autor
- **Network Diagram (PERT) view** — diagrama logic diagram que muestra Predecessor → Successor explícito con float
- **Constraint types FNLT/SNET/MSO/MFO** — terminología estándar
- **Resource Sheet con Cost Rate Tables A-E** (rates diferentes para overtime, special projects)
- **Timeline view** — band horizontal con milestones para reportes ejecutivos

**Qué BuildSync DEBE evitar:**
- UX cargada con ribbon — modernizar
- Desktop client legacy — solo web
- Project Online complexity setup

**PMI-feel:** **8/10** — respetado por PMP de habla inglesa, especialmente en gobierno y enterprise IT. En AEC pierde frente a P6.

[Sources: Microsoft Project page, theprojectgroup EVM 2024, schneider.im plan 3 vs 5 name changes, theknowledgeacademy MS Project blog]

---

### 8. Smartsheet

**URL:** https://www.smartsheet.com
**Categoría:** Enterprise PMO (spreadsheet-native)
**Target market:** PMOs que migran de Excel, construction firms operacionales, government, healthcare. Smart spot: Marketing/Ops cross-functional teams en empresas 100-10,000 empleados.
**Pricing:**
- Pro: $9/user/mes annual
- Business: $19/user/mes annual
- Enterprise: custom
- **Advanced Work Management add-on** (~paid extra): Control Center, Dynamic View, Data Shuttle
- Resource Management (formerly 10,000ft): separate ~$15/user/mes
- Brandfolder (DAM): separate

**Killer features:**
1. **Grid/Sheet view spreadsheet-native** — sintaxis Excel-like, formulas, cell linking entre sheets
2. **Control Center** — provisioning multi-project from templates, blueprint-based standardization
3. **Dynamic View** — surface filtered data to external stakeholders sin darles edit access al sheet completo
4. **WorkApps** — custom apps from sheets/reports/dashboards (no-code app builder)
5. **Conditional Formatting** robusto en Grid view
6. **Bridge** — workflow automation deeper que basic automations
7. **DataMesh, Data Shuttle, DataTable** — ETL light para sincronizar sheets

**Terminología propietaria:** Sheets, Rows, Columns, Cell Linking, Reports (cross-sheet queries), Dashboards, Forms, WorkApps, Workspaces, Sights, Dynamic View, Premium App, Blueprint (Control Center template), Source Sheet, Summary Sheet.

**UX patterns únicos:** Layout Excel-esque. Tabs en bottom como Excel sheets. Densidad extrema en Grid view. Color azul Smartsheet. Conditional formatting con color bars en cells. Gantt anclado al Grid (no separado).

**Vistas:** Grid (default, Excel-like), Gantt, Card (Kanban), Calendar, Reports (cross-sheet queries), Dashboards (widgets), Forms (intake), Timeline.

**Métricas/dashboards:** Highly customizable — usuarios construyen sus dashboards. Default widgets: Chart, Metric, Rich Text, Sheet Filter, Web Content. Common views: % Complete by Phase, At-Risk Tasks (formula-driven), Budget Burndown.

**Integraciones:** Microsoft 365, Google Workspace, Slack, Jira, Salesforce, DocuSign, Tableau, Power BI. 100+ via Bridge.

**Qué BuildSync DEBE robar:**
- **Cell linking entre projects** — change order en Project A actualiza budget consolidado en Portfolio dashboard
- **Conditional formatting cell-level** — task row turns red si due date < today AND status ≠ Complete (lo que BuildSync ya hace en list views, refinar)
- **Forms para intake** — clientes / subs llenan form → crea row en project sheet (RFI intake, Change Request intake)
- **Reports cross-sheet** — agregación tipo "all overdue RFIs across all projects" como standing report
- **Blueprint** templates — Recertification project, Permit project, Design project — instanciables con 1 click

**Qué BuildSync DEBE evitar:**
- Add-on hell (Smartsheet vende 8+ add-ons separados) — BuildSync debe tener everything-included
- Resource Management como separate SKU
- UX que feels like Excel — para PE/PMP es OK, para field workers es horrible

**PMI-feel:** **6/10** — usado en PMOs tradicionales, pero menos prestigio que P6/MSP. PMPs lo respetan como "advanced Excel".

[Sources: Smartsheet pricing 2026 (TheDigitalProjectManager, ITQlick), Smartsheet platform features, Smartsheet view docs]

---

### 9. Wrike

**URL:** https://www.wrike.com
**Categoría:** Enterprise PMO
**Target market:** Marketing teams (core), creative agencies, PMOs, professional services. 20,000+ companies. Empresas 100-5,000 empleados.
**Pricing (5 tiers):**
- Free
- Team: $10/user/mes
- Business: $25/user/mes
- Pinnacle: custom
- Apex: custom

**Killer features:**
1. **Custom Item Types (CITs)** — define tu propia jerarquía y vocabulario (e.g. "Design Brief", "Permit Application")
2. **Cross-Tagging** — un item puede pertenecer a multiple folders/projects/spaces
3. **Wrike Datahub** — meta-database de business objects (clients, products, vendors) referenciables desde tasks
4. **Wrike Sync** — bi-directional sync con 22 systems (Jira, GitHub, Salesforce, HubSpot)
5. **Wrike Integrate** — 400+ apps connector
6. **Proofing** — visual asset feedback con markup pins
7. **Wrike Lock** — customer-managed encryption keys (financial services, healthcare)
8. **Blueprints** — templates de proyectos replicables

**Terminología propietaria:** Spaces, Folders, Projects, Tasks, Subtasks, Custom Item Types, Cross-Tags, Blueprints, Approvals, Proofing, Requests, Dashboards, Workflows (status-based), Custom Fields, Datahub Records.

**UX patterns únicos:** Top-nav verde Wrike. Layout 3-column con sidebar de spaces. Densidad media-alta. Color de tasks por status.

**Vistas:** List, Table (Excel-like), Board (Kanban), Gantt, Calendar, Files, Stream (activity feed), Reports, Dashboards, Workload (resource planning), Analytics charts.

**Métricas/dashboards:** Custom dashboards con 25+ widget types. Project health (RAG status), Workload heatmaps, Time tracking summaries, Custom calculated fields.

**Integraciones:** 400+ via Wrike Integrate (Workato-powered). Native: Microsoft 365, Google, Salesforce, Slack, Adobe Creative Cloud, Jira.

**Qué BuildSync DEBE robar:**
- **Custom Item Types** — BuildSync ya tiene 4 project types (Construction/Design/Recertification/Permit) — formalizar esto como CIT system con default fields, statuses, views por tipo
- **Cross-Tagging** — un Daily Log puede pertenecer a Project A + Recertification Cycle B + Q2 Capacity Plan
- **Datahub** — clients, vendors (inspectors, fabricators), subs como entities referenciables, no free-text
- **Blueprints** — Recertification project template, Permit template, Design phase template
- **Proofing markup** — para drawing review (PE stamps a drawing, leaves markup)

**Qué BuildSync DEBE evitar:**
- Demasiados spaces/folders/projects/tasks — jerarquía profunda confunde
- Pinnacle/Apex tier walls — todo debe ser incluido

**PMI-feel:** **6/10** — más marketing-PMO que construction-PMO. PMPs lo aceptan pero prefieren MSP/P6.

[Sources: Wrike.com features, Wrike pricing 2026 (SaaSworthy, CheckThat), Wrike Datahub help docs]

---

### 10. Planview (AdaptiveWork + Portfolios)

**URL:** https://www.planview.com
**Categoría:** Enterprise PMO (PPM/SPM)
**Target market:** 
- **AdaptiveWork** (formerly Clarizen): organizations <500 empleados, profesional services
- **Portfolios** (formerly Enterprise One): enterprise 1,000+ empleados, complex PPM, financial services, telco

**Pricing:** Custom enterprise. Sin published pricing. Tiers desde "AdaptiveWork" hasta "Portfolios" con add-ons.

**Killer features:**
1. **Planview Anvi (AI)** — sentiment analysis para identificar risks before they escalate, conversational project intelligence
2. **OKR framework integrado con strategy + financials + work** — único entre PPM tools
3. **Lifecycle workflows configurables** end-to-end (request → portfolio → project → financial)
4. **Slide Publisher** — auto-generación de PowerPoint executive decks desde dashboards
5. **Capacity & Resource Planning** con forecasting multi-pass
6. **Outcome-driven portfolio prioritization** con scoring models
7. **Top vendor de Gartner Magic Quadrant 2024 Adaptive Project Management & Reporting (Leader)**
8. **Forrester Wave Strategic Portfolio Management Tools Q2 2024 (Leader)**

**Terminología propietaria:** Portfolios, Programs, Projects, Work Items, Outcomes, Initiatives, Capabilities, Value Streams, Resource Pool, Roles vs Resources, Demand vs Capacity, Lifecycles, Investment Categories, Strategic Objectives, OKRs, Scenarios, Roadmaps.

**UX patterns únicos:** Layout enterprise dashboard-heavy. Densidad media. Configurable, lego-like — cada empresa la construye distinto. Color customizable.

**Vistas:** Portfolio Roadmap (timeline + swimlanes), Gantt, Board, Table, Resource Heatmap, Scorecards, Financial Forecasts, Dependency Map.

**Métricas/dashboards:** Portfolio Health Score, NPV/IRR/Payback period por initiative, Resource utilization forecast, Capacity vs Demand gap, OKR progress aggregated, Strategy realization.

**Integraciones:** Jira, Azure DevOps, ServiceNow, SAP, Oracle, Workday, Salesforce. Open API.

**Qué BuildSync DEBE robar:**
- **OKR/Goal framework conectado a projects** — un Goal "Increase Recertification revenue 30% in 2026" se conecta a projects, cada project lifts goal
- **Capacity vs Demand gap visualization** — heatmap mostrando demanda futura de PEs vs capacity available (BuildSync ya tiene capacity matrix, falta el lado de demand forecast)
- **Scenarios / What-if** — duplicate a portfolio, change priorities, compare
- **Outcome scoring** — score each project by Strategic Fit / NPV / Risk / Resource Need
- **Slide Publisher** equivalent — auto-PowerPoint exec dashboard

**Qué BuildSync DEBE evitar:**
- Implementación 6-12 meses, $200k+ — overkill total
- Cada feature requiere consultor certificado Planview

**PMI-feel:** **9/10** — top-tier enterprise PMO. PMP+ProgramPM lo respetan. PgMP/PfMP cert exam friendly.

[Sources: Planview AdaptiveWork product page, Planview Portfolios page, Planview vs AdaptiveWork Ignite Tec blog, Gartner Magic Quadrant 2024]

---

## C) SOFTWARE-DEV MODERNO (5)

### 11. Linear

**URL:** https://linear.app
**Categoría:** Modern Dev
**Target market:** Engineering teams (10-500), product teams, design teams en SaaS modernas. Vercel, Cash App, Ramp, Loom, OpenAI son customers públicos.
**Pricing:** Free (10 users limit), Standard $8/user/mes, Plus $16/user/mes, Enterprise custom.

**Killer features:**
1. **Keyboard-first UX** — todo accesible via shortcuts (Cmd+K commandbar, instant navigation)
2. **Cycles** — sprints reimaginados, automated rollover de incomplete issues, set length/start day
3. **Triage** — inbox de incoming issues with Triage Rules + Triage Intelligence (auto-routing)
4. **Customer Requests** — feedback de customers se convierte en issues con prioritization
5. **Linear Asks** — convert Slack/email requests into issues
6. **Roadmap + Initiatives** — project clustering hacia strategic outcomes
7. **Instant analytics** (Insights) — pre-built charts on any stream of work
8. **GitHub/GitLab integration first-class** — branch auto-links, PR status syncs issue automatically
9. **Speed obsession** — instant load, offline-first, optimistic UI updates

**Terminología propietaria:** Issues, Cycles, Projects, Initiatives, Triage, Workflow States (Backlog, Todo, In Progress, In Review, Done, Cancelled — fixed by default but customizable), Sub-issues, Parent issues, Labels, Estimates, Priority (Urgent/High/Medium/Low/No priority), Workspaces.

**UX patterns únicos:** **Layout extremadamente limpio** — minimal chrome, lots of white space (or dark space). **Fixed sidebar** con navegación issue-centric. **Cmd+K command bar** ubícuo. **Optimistic UI** — clicks no esperan server. **Dark mode default** en gran parte de comunidad. Font: Inter. Color accent: violet/purple. Tipografía variable weight. Spacing tight pero respiramos. Animations 100-200ms snappy.

**Vistas:** List (default), Board (Kanban), Triage inbox, Roadmap (timeline of projects), Cycle view, Initiative view, Insights (chart builder), My Issues, My Active Issues, Created by me, Subscribed.

**Métricas/dashboards:** Cycle progress (burndown-like), Scope changes per cycle, Velocity, Issue throughput, Time to resolution, Created vs Completed, Bug rate. Insights builder permite ad-hoc charts.

**Integraciones:** GitHub (first-class), GitLab, Slack, Figma, Sentry, Zendesk, Intercom, Notion, Loom.

**Qué BuildSync DEBE robar:**
- **Cmd+K command bar ubícuo** — go to any project, create issue, assign, change status — todo desde keyboard
- **Speed obsession con optimistic UI** — Juan ya valora performance, Linear's bar es el techo
- **Triage inbox** — incoming RFIs, change requests, client emails todos llegan a triage, PE asigna, route, prioritize
- **Cycles concept para Recertification recurring work** — recertifications anuales o trianuales son perfectos para "cycle"
- **Initiatives** = strategic groupings de projects (e.g. "NYC LL11 wave 2026" agrupa 12 building recertifications)
- **Customer Requests linking** — owner / building manager submits issue → linked to Recertification project
- **Insights chart builder** — ad-hoc queries sobre cualquier field

**Qué BuildSync DEBE evitar:**
- Hyper-narrow scope a software dev — Linear no tiene Gantt real, no tiene EVM, no tiene budgets
- Workflow states fijos por default — engineering tiene "In Progress / In Review", construction tiene "Submitted / Under Review by City / Approved / Stamped" — más complejo

**PMI-feel:** **2/10** — Linear es anti-PMI, anti-PMP. Diseñado para velocidad de engineering, no for governance. Pero su UX bar es lo que BuildSync debe robar visualmente.

[Sources: Linear docs (conceptual model, triage), Linear.app features, Linear vs ClickUp (Efficient App, Ideaplan), Lenny's newsletter on Linear]

---

### 12. Asana

**URL:** https://asana.com
**Categoría:** Modern Dev (cross-functional)
**Target market:** Cross-functional teams en empresas 100-10,000. Marketing, ops, IT, product. Less developer-centric, more PM-centric. Used by Pinterest, Spotify, AirBnb, Deloitte.
**Pricing:** Personal (free), Starter $10.99/user/mes, Advanced $24.99/user/mes, Enterprise custom, Enterprise+ custom.

**Killer features:**
1. **Goals** — company OKRs linkados a projects (cascading goals)
2. **Portfolios** — "mission control" monitoring conectado projects
3. **Workload view** — capacity rebalancing visual
4. **Custom Fields** sortable/filterable/reportable
5. **Rules** — automation builder (when X, then Y)
6. **Forms** intake
7. **AI Studio** (2024) — build AI agents (Smart Goals, Smart Status, Smart Summary)
8. **Universal Reporting** — cross-project dashboards
9. **Timeline view** (Gantt-equivalent, in Premium+)

**Terminología propietaria:** Tasks, Subtasks, Sections, Projects, Portfolios, Goals (with sub-goals), Milestones, Custom Fields, Tags, Rules, Forms, Templates, My Tasks, Inbox, Workload, Status updates.

**UX patterns únicos:** Layout 3-column con sidebar persistent. Color rojo/orange Asana en lugar de azul. **Celebration animations** (unicorns flying when task completed). Densidad media-alta. Font: Asana Sans (custom). Multiple views per project, switchable instantly.

**Vistas:** List, Board, Timeline (Gantt), Calendar, Files, Workflow (builder), Dashboards, Messages, Forms, Workload.

**Métricas/dashboards:** Project status (On track / At risk / Off track) with weekly check-in nudges. Burnup charts, Task completion rate, Custom field rollups, Workload utilization.

**Integraciones:** Slack, MS Teams, Google Workspace, Microsoft 365, Salesforce, Jira, GitHub, Figma, Adobe, Tableau. 270+ apps.

**Qué BuildSync DEBE robar:**
- **Goals con cascading** — Goal "2026 Revenue $5M" → Goal "Recertification Revenue $2M" → linkado a 30 Recert projects
- **Custom Fields** flexible — pero con strong defaults (BuildSync ya tiene gates/phases)
- **Universal Reporting** — cross-project dashboards filterable
- **Workload view** con capacity rebalancing drag-and-drop (BuildSync tiene capacity matrix por team)
- **Rules** — when project moves to "Permit Approved" gate, auto-create tasks "Mobilize Construction Team", notify subs

**Qué BuildSync DEBE evitar:**
- Unicorn animations — no PE certificada respeta animations playful
- Asana feel "fun corporate" — BuildSync target es serious engineering
- Inbox-first UX — Linear's triage es mejor pattern

**PMI-feel:** **5/10** — usado por PMs no certificados. PMPs lo critican por falta de CPM, EVM, baselines.

[Sources: Asana.com features, Linear vs Asana (Clickup blog, Efficient App)]

---

### 13. Monday.com

**URL:** https://monday.com
**Categoría:** Modern Dev
**Target market:** SMB to enterprise (60% Fortune 500). Marketing, sales, product, IT, R&D, HR, ops. Construction es vertical secundario. Industries: Retail, Media, Construction, Government.
**Pricing (5 tiers, per seat min 3):** Free, Basic $9/seat/mes, Standard $12/seat/mes, Pro $19/seat/mes, Enterprise custom.

**Killer features:**
1. **Boards** con column types extensibles (status, person, date, number, formula, mirror, dependency, time tracking, files, etc — 30+ tipos)
2. **AI agents** pre-built (Meeting Scheduler, Project Monitor, Competitor Researcher, Content Creator) + custom
3. **Automations** 250-250,000/mes según tier
4. **Mirror columns** — referenciar data de otra board (relational lite)
5. **Dashboards** con 30+ widget types
6. **Workforms** intake builder
7. **Visual workflow builder** (canvas-style automation)

**Terminología propietaria:** Boards, Items, Subitems, Groups, Columns (Status, Person, etc.), Mirror, Connect Boards, Updates, Workdocs, Dashboards, Workspaces, Folders, Workforms, Automations Recipes.

**UX patterns únicos:** Layout color-explosion — boards muy coloridas con status pills brillantes. Densidad media. Color accent verde Monday. Font: Roboto-like. Drag-and-drop everything. Mobile parity buena.

**Vistas:** Main Table (default), Kanban, Timeline (Gantt), Calendar, Map, Chart, Form, Files Gallery, Workdocs.

**Métricas/dashboards:** Highly visual — pies, donuts, bars con animations. Standard widgets: Battery (gauge), Numbers, Chart, Timeline, Workload.

**Integraciones:** 200+ apps. Slack, MS Teams, Google, Salesforce, Jira, GitHub, Zoom, Mailchimp. MCP (Model Context Protocol) support para AI tools.

**Qué BuildSync DEBE robar:**
- **Mirror columns** — un Daily Log en Project A's board puede mostrar relevant data de Subs board sin duplicar
- **Status pills con colores configurable** — pero BuildSync ya hace esto en list views; refinar
- **Automation recipes** library — pre-built recipes (when Permit Approved status, create 5 follow-up tasks)
- **Visual workflow builder** — canvas con drag-and-drop steps (más visual que Linear's rules)

**Qué BuildSync DEBE evitar:**
- **Sobrecarga de colores** — para PE/PMP serious, Monday se ve "infantil"
- **Boards proliferation** — usuarios crean 100 boards sin estructura
- **Per-seat pricing min 3 seats** — frustrante para solo practitioners

**PMI-feel:** **4/10** — PMPs lo ven como "Trello fancy". Sin CPM, EVM, baselines.

[Sources: Monday.com pricing 2024 (TheDigitalProjectManager, monday.com docs), Monday work management page]

---

### 14. ClickUp

**URL:** https://clickup.com
**Categoría:** Modern Dev
**Target market:** SMB que busca "all-in-one" para reemplazar Asana + Notion + Jira + ToDoist. Marketing, ops, dev mixed teams.
**Pricing:** Free Forever, Unlimited $7/user/mes, Business $12/user/mes, Business Plus $19/user/mes, Enterprise custom.

**Killer features:**
1. **15+ views nativas** (List, Board, Calendar, Gantt, Timeline, Workload, Activity, Map, Mind Map, Whiteboard, Doc, Embed, Form, Chat view, Table)
2. **ClickUp Brain (AI)** — ambient AI assistant, task assignment, status updates auto-drafted
3. **Super Agents** (2024) — 24/7 AI agents con 500+ tool integrations + memory
4. **Brain MAX** — voice-to-task dictation
5. **Hierarchical levels:** Workspace → Space → Folder → List → Task → Subtask → Checklist
6. **Custom Statuses** per List (no fijo workflow)
7. **Custom Fields** unlimited
8. **Goals + Targets + Time tracking + Docs + Whiteboards + Chat + Email + Calendar** todo en uno
9. **Forms + Automations**

**Terminología propietaria:** Workspaces, Spaces, Folders, Lists, Tasks, Subtasks, Checklists, Custom Statuses, Custom Fields, Goals, Targets, Sprints, Time Estimates, Docs, Whiteboards, Chat, Inbox, Notepad.

**UX patterns únicos:** **Layout overcrowded** — 8-level navigation. Sidebar profundo. Toolbar full. Densidad alta. Color customizable por Space. Font: system. Feature-density obsession (anti-Linear).

**Vistas:** 15+ ya listadas. Cada List puede tener views múltiples salvadas.

**Métricas/dashboards:** Dashboards con 50+ widget types. Sprint burndown, Velocity, Workload by user, Time tracked, Goal progress, Custom Field rollups.

**Integraciones:** 1,000+ via Zapier/Make + 200+ native. Slack, Teams, Google, GitHub, GitLab, Figma, Zoom.

**Qué BuildSync DEBE robar:**
- **15+ views biblioteca** — pero NO implementar 15+, escoger 6-7 críticos (List, Board, Timeline/Gantt, Calendar, Workload, Map, Dashboard)
- **Custom Statuses per List** — Permit Application List tiene statuses (Drafted → Submitted → Reviewer Assigned → Comments Received → Resubmitted → Approved), Construction List tiene otros (Pre-Construction → Mobilized → 25% → 50% → 75% → Substantial Completion → Final)
- **Hierarchical structure** — Workspace (Tercero Tablada) → Space (NYC / Miami / CDMX / Bogotá) → Folder (Recertifications / Permits / Construction / Design) → List (specific projects)
- **Goals con Targets numéricos** — KPI tracking

**Qué BuildSync DEBE evitar:**
- **Feature bloat** — ClickUp es famoso por overwhelm
- **8-level hierarchy** — confusing, 3-4 levels suficiente
- **UI inconsistente** entre Spaces — each Space looks different

**PMI-feel:** **3/10** — too many features sin opinión. PMPs prefieren más restrictivo.

[Sources: ClickUp homepage, Linear vs ClickUp (Efficient App, Ideaplan)]

---

### 15. Height

**URL:** https://height.app
**Categoría:** Modern Dev (AI-native)
**Target market:** Product teams, engineering teams. Más pequeño que Linear adoption-wise. Launched 2.0 in Oct 2024 as "autonomous project management".
**Pricing:** Free for small teams, Pro plan ($6.99/user/mes was historical), Enterprise custom. Note: Height showed signs of slowing down per skywork.ai analysis "Rise and Sunset".

**Killer features:**
1. **Autonomous AI features** (2024 launch):
   - **Live product documentation** — AI updates specs en tiempo real basado en team activity
   - **Backlog upkeep** — AI prunes y mantains backlog
   - **Bug triage** — AI prioritizes, assigns, escalates
   - **Project updates** — AI drafts scheduled progress reports y standups
2. **Height Copilot** — brainstorm, auto-async standups, dedupe tasks
3. **Chat-centric workspace** — collaboration en threads tipo Slack pero atados a tasks
4. **Multiple views:** Spreadsheet, Kanban, Gantt, Calendar

**Terminología propietaria:** Tasks, Lists, Workspaces, Chat threads, Copilot, Async Standups.

**UX patterns únicos:** Layout chat-centric. Densidad media. Color accent rojo Height. Minimal interface.

**Vistas:** Spreadsheet, Kanban, Gantt, Calendar.

**Métricas/dashboards:** Standard project completion, backlog age.

**Integraciones:** GitHub, Slack, Figma, Linear (import).

**Qué BuildSync DEBE robar:**
- **AI auto-drafted weekly status reports** — Juan ya tiene Weekly Reports manuales; auto-draft con AI sería killer
- **AI bug/issue triage** — incoming RFI/Change Request → AI categorizes (urgent/normal/low), suggests assignee, drafts response
- **Live documentation auto-update** — meeting transcripts → AI updates project README / scope

**Qué BuildSync DEBE evitar:**
- Height tiene riesgo de sunsetting — no dependerse de su modelo
- Chat-first puede distraer en serious eng work

**PMI-feel:** **3/10** — bleeding edge AI but no PMI methodology.

[Sources: Height.app/autonomous, TechRepublic Height review, Skywork.ai "Rise and Sunset" analysis, Height 2.0 launch (BusinessWire)]

---

## D) ESPECIALIZADOS EN RECURSOS / PLANNING (3)

### 16. Float

**URL:** https://www.float.com
**Categoría:** Resource Management
**Target market:** Professional services firms — agencies (creative, marketing), consultancies, software houses. 4,500+ firms. Clients: Google, Atlassian, Ogilvy, Wieden+Kennedy.
**Pricing:** Per-scheduled-person (no per-user) — solo pagas por gente activamente scheduled. Resource Planning $7.50/person/mes, Pro $12.50/person/mes (annual).

**Killer features:**
1. **Real-time staffing plans** que adaptan as work evolves
2. **Skill-based matching** — match work con skills, availability, capacity en global talent pool
3. **Project scoping con profit focus** — target budget + margins predefinidos, compare actuals vs baseline
4. **Capacity dashboards** — heatmap de utilization
5. **Forecasting** — utilization forecast 6-12 meses
6. **Profitability tracking** integrado
7. **Phases** dentro de un project con budget por phase

**Terminología propietaria:** People, Projects, Phases, Tasks, Time Off, Allocations, Tentative bookings, Roles, Skills, Tags, Rates, Budgets, Capacity, Utilization, Billable vs Non-billable.

**UX patterns únicos:** Layout horizontal-timeline (left = list of people, right = timeline of weeks/months). Densidad media. Color-coded por project. Drag-and-drop bookings. Mobile responsive.

**Vistas:** Schedule (default — people × weeks heatmap), Project view, Reports (utilization, billable, profitability).

**Métricas/dashboards:** Utilization %, Billable %, Capacity vs Allocated, Projected revenue, Margin, Profit by project/client.

**Integraciones:** Sage Intacct, HubSpot, Jira, Google Calendar, Salesforce, QuickBooks, Zapier.

**Qué BuildSync DEBE robar:**
- **Skill-based matching** — para una firma estructural, ¿quién tiene NYC SEI license + experience LL11? ¿Quién maneja Miami 40-year recertification? ¿Quién habla español para CDMX/Bogotá?
- **Phases con budget per phase** — Schematic / DD / CD / Construction Administration cada uno con own budget
- **Tentative bookings** — soft-allocate someone para proyecto que aún no es 100% confirmado
- **Utilization heatmap** people × weeks — BuildSync tiene capacity matrix por team, esto es next-level: por person × week

**Qué BuildSync DEBE evitar:**
- Float es ONLY resource — no project execution, no docs, no Gantt logic
- Per-scheduled-person pricing model puede confundir

**PMI-feel:** **6/10** — respetado por professional services PMs, no en construction PMs.

[Sources: Float.com, Resource Guru vs Float (Digital Project Manager, FinancesOnline)]

---

### 17. Forecast.app

**URL:** https://www.forecast.app
**Categoría:** Resource Management (PSA)
**Target market:** Professional services (software dev, IT services, digital agencies, consulting, NGOs, research institutes).
**Pricing:** Custom, no public pricing. Demo required.

**Killer features:**
1. **AI-powered allocation assistant** — auto-match talent to work
2. **AI-assisted time tracking** — predict timesheets
3. **Predictive alerts** — drifting deadlines, budget overruns
4. **AI project end-date forecasting**
5. **Workload balancing recommendations**
6. **Custom rate cards** con flexible pricing scenarios
7. **Revenue recognition software**
8. **Revenue leakage recovery** (3-7% documented)
9. **Margin erosion reduction** (12-18% documented)
10. **Utilization improvements** (5-8%)
11. **Placeholders** for demand forecasting (before resource is hired)

**Terminología propietaria:** People, Placeholders, Projects, Phases, Tasks, Allocations, Time Entries, Expenses, Rate Cards, Revenue Recognition, Roles, Skills.

**UX patterns únicos:** Layout horizontal-timeline (similar Float). Densidad media. Color accent azul. Drag-and-drop. Charts heavy.

**Vistas:** Gantt (drag-and-drop), Schedule (people × weeks), People view, Project view, Reports.

**Métricas/dashboards:** Utilization, Realization %, Effective billable rate, Forecasted revenue, Margin per project, Project health (AI-derived).

**Integraciones:** Sage Intacct, HubSpot, Jira, Salesforce, QuickBooks, Google Calendar.

**Qué BuildSync DEBE robar:**
- **Placeholders** — demand forecasting con un placeholder PE (rol Senior PE Structural) para 6 meses futuro, antes de contratar
- **Custom rate cards** — para CDMX/Bogotá distinto a NYC, billable rates por person/role/region
- **Predictive alerts** — drift early warning
- **Revenue recognition por phase** — important for AIA billing rhythm

**Qué BuildSync DEBE evitar:**
- No public pricing — opacidad disuade adoption
- Niche audience

**PMI-feel:** **6/10** — usado por PSA PMs, no AEC PMs traditionally.

[Sources: Forecast.app product page]

---

### 18. Resource Guru

**URL:** https://resourceguruapp.com
**Categoría:** Resource Management
**Target market:** Agencies, consultancies, **construction firms** (mencionado explícitamente), engineering companies, IT departments. 65,000+ users in 100+ countries.
**Pricing:** 
- Grasshopper: $4.16/person/mes annual ($5/mo monthly billing)
- Blackbelt: $6.65/person/mes (más features)
- Master: $12/person/mes (advanced reports, capacity)

**Killer features:**
1. **Drag-and-drop scheduling** with conflict detection
2. **Heatmaps** de availability/workload/utilization
3. **Clash management** — auto-prevent double-booking
4. **Leave management** built-in
5. **Waiting list** — bookings con confirmation pending
6. **Bookings calendar sync** — Google/Outlook
7. **Project phases con budget**
8. **Timesheets con one-click submission**

**Terminología propietaria:** Resources (people, rooms, equipment), Bookings, Tentative bookings, Clashes, Leave, Waiting list, Projects, Phases, Clients, Capacity.

**UX patterns únicos:** Layout horizontal timeline (resources × days/weeks). Densidad media. Color minimal. Simple, focused on scheduling only.

**Vistas:** Schedule (default), Daily, Weekly, Monthly, Reports.

**Métricas/dashboards:** Utilization %, Billable hours, Capacity vs Booked, Heatmap views.

**Integraciones:** Google Calendar, Outlook, iCal, Zapier.

**Qué BuildSync DEBE robar:**
- **Clash detection** — un PE assigned a 2 proyectos al mismo tiempo > capacity → red conflict alert
- **Waiting list / tentative** — soft bookings pending confirmation
- **Leave management** integrado con scheduling — vacaciones bloquean availability
- **Heatmap utilization** — green/yellow/red por person/week

**Qué BuildSync DEBE evitar:**
- Scope narrow — solo scheduling, no project execution
- UI dated

**PMI-feel:** **5/10** — práctico pero narrow.

[Sources: ResourceGuruApp.com, Resource Guru pricing 2026 (Digital Project Manager)]

---

## E) HÍBRIDOS / NUEVOS (2)

### 19. Notion Projects

**URL:** https://www.notion.com/product/projects
**Categoría:** Hybrid (docs + DB + projects)
**Target market:** Teams 100-1,000+, engineering, product, content. Adopted by OpenAI, Pixar, AppLovin.
**Pricing:** Free, Plus $10/user/mes, Business $15/user/mes, Enterprise custom. AI add-on $8/user/mes.

**Killer features:**
1. **Database-driven everything** — projects son DBs, tasks son DBs, relations entre DBs nativas
2. **Linked databases** — un mismo DB shown con multiple filters/views en diferentes pages
3. **Multi-view per database:** Table, Board, Timeline, Calendar, Gallery, List
4. **Notion AI** — Autofill (genera user stories, key results, project updates), Q&A across workspace
5. **Wikis + Docs + Projects integrados** sin add-on cost
6. **Properties:** 20+ types (relation, rollup, formula, status, person, file, etc.)
7. **Customizable AI Autofill** per database

**Terminología propietaria:** Pages, Databases, Properties, Views, Relations, Rollups, Sub-items, Filters, Sorts, Groups, Templates, Workspaces, Teamspaces.

**UX patterns únicos:** **Block-based editor** — everything is a block. Minimalist white. Densidad media-baja (much padding). Font: Inter / system. Drag-and-drop block reordering. Slash commands `/` ubicuos.

**Vistas:** Table (default), Board, Timeline, Calendar, Gallery, List.

**Métricas/dashboards:** Charts ahora nativas (2024 add). Aggregations en rollups. Custom formulas.

**Integraciones:** Figma, Slack, GitHub, Amplitude, Jira embed.

**Qué BuildSync DEBE robar:**
- **Relations entre entidades** — Project ↔ Client ↔ Vendor ↔ Permit ↔ RFI todos linkados, query cross
- **Rollup aggregations** — Project's "Total Outstanding RFIs" = COUNT of related RFIs WHERE status = Open
- **Custom AI Autofill** — generar weekly status, generate scope summary, draft RFI response
- **Multi-view per DB** — same data shown 5 ways
- **Wiki / Docs integration** — project specs, meeting notes, SOPs todos en uno

**Qué BuildSync DEBE evitar:**
- Notion es slow en DBs grandes (10,000+ rows)
- No tiene CPM, EVM, baselines
- Mobile UX inferior a desktop

**PMI-feel:** **4/10** — used by PMs pero no PMI-respected.

[Sources: Notion.com/product/projects]

---

### 20. Airtable (Interfaces para PM)

**URL:** https://www.airtable.com
**Categoría:** Hybrid (spreadsheet + DB + apps)
**Target market:** 500,000+ orgs. OpenAI, Amazon, Netflix, Walmart, Google. Marketing, ops, content, product. Enterprise increasingly via "Omni".
**Pricing:** Free, Team $20/user/mes, Business $45/user/mes, Enterprise custom. AI add-on.

**Killer features:**
1. **Relational database con UI spreadsheet-friendly**
2. **Interfaces** — custom app UIs sobre Bases — dashboards, forms, record details — sin código
3. **Omni** (2024 launch) — enterprise app builder, conversational
4. **AI Agents** — operate across thousands of records, orchestrate actions
5. **HyperDB** — escala a 100Ms records, 10Ks users
6. **Views:** Grid, Calendar, Gallery, Kanban, Timeline, Gantt, Form
7. **Automations** native
8. **Sync** — sync data desde Salesforce/Jira/Google Drive into Airtable Base
9. **Portals** — external collaboration con guests

**Terminología propietaria:** Bases, Tables, Records, Fields, Views, Interfaces, Automations, Forms, Portals, Workspaces, Omni Apps, Linked Records, Lookups, Rollups, Formulas.

**UX patterns únicos:** Layout spreadsheet base + Interfaces overlay. Densidad alta en Grid. Color vibrante customizable (record colors). Cell types extensible (attachments, multi-select, barcode, etc).

**Vistas:** Grid, Calendar, Gallery, Kanban, Timeline, Gantt, Form.

**Métricas/dashboards:** Dashboards via Interfaces — fully custom. Charts, numbers, lists.

**Integraciones:** 1,000+ via Zapier, Make. Native: Slack, Google, Microsoft 365, GitHub, Jira, Salesforce.

**Qué BuildSync DEBE robar:**
- **Interfaces concept** — Different stakeholders see different UIs over same data: PE Interface (drawing review focused), Client Interface (project status focused), Sub Interface (deliverables focused). Cada uno solo ve lo que necesita.
- **Linked Records + Lookups + Rollups** — relational data model (BuildSync ya tiene Prisma schema, but UI surface this)
- **Sync** — pull from external (Procore project, AutoCAD file metadata, Building Department portal status)

**Qué BuildSync DEBE evitar:**
- No tiene CPM
- Performance degrada con grandes DBs

**PMI-feel:** **3/10** — flexible but not PMI-recognized.

[Sources: Airtable.com homepage]

---

## SECCIÓN DE SÍNTESIS

---

### 1. Patrones que separan "PM software pro" de "productivity app genérica"

Lo que Primavera, MS Project, Aconex, Planview hacen y Asana/Linear/Monday no:

| Patrón | Pro tools | Generic tools |
|---|---|---|
| **CPM real con float calc** | P6, MSP — calculan Total Float, Free Float, Drive Float por activity | Asana, Linear: no float, no critical path |
| **Multiple baselines** | P6: ilimitados, MSP: 10, Aconex: snapshots versioned | Asana/Linear/Monday: zero |
| **EVM completo (PV/EV/AC + CPI/SPI/EAC/ETC/TCPI/BAC/VAC)** | P6, MSP, Planview, 4castplus, Celoxis | Asana/Linear/Monday/ClickUp: ninguno nativo |
| **Resource leveling automático multi-pass** | P6, MSP, Planview | Monday/Asana: simple workload balance |
| **WBS hierarchies con weights** | P6, MSP, Aconex | Otros: flat task list |
| **Constraint types (FNLT, SNET, MFO, MSO, ASAP, ALAP)** | P6, MSP nativo | Otros: solo "due date" |
| **Activity logic con SS/FS/FF/SF + Lead/Lag** | P6, MSP, Smartsheet (lite) | Linear/Asana/Monday: solo FS implícito |
| **Document Status Codes ISO 19650 (S1-S6, A1-A4)** | Aconex, ACC Docs | Ninguno generic |
| **DCMA 14-point schedule QC** | P6 (manual), specialized add-ons | Ninguno |
| **PMI/PMP/AACEi vocabulary literal** | P6, MSP, Planview, Aconex | Marketing-speak en Asana/Linear/Monday |
| **Auditable change log con timestamp + actor + reason** | Aconex, P6 (notebook), Procore | Linear/Asana: yes pero shallow |
| **Submittal/RFI/Change Order workflows** | Procore, ACC, Aconex | Ninguno generic |
| **Curva S-curve (planned vs actual cumulative)** | P6, MSP, Planview, 4castplus | Ninguno |
| **Cost Account / WBS-coded budget structure** | P6 + EBS, Aconex | Asana/Linear: solo total |

**Por qué los PMPs respetan esto:**
- **Defensibilidad legal:** En claims/disputes (delays, scope changes), P6 schedules con baselines + variance + EVM son admisibles en court / arbitration. Asana screenshots no.
- **Standards compliance:** PMI PMBOK 7, AACEi RP-29R-03 (Forensic Schedule Analysis), USACE EM 1110, ISO 21500/21502 todos asumen CPM + EVM + baselines.
- **AACEi PSP / PMI-SP cert exams** explícitamente requieren conocimiento de Total Float, Resource Leveling, Reflection schedules — features que solo P6/MSP tienen.
- **Government/DoD contracts:** EVM compliance required for projects >$20M (per ANSI/EIA-748). Sin EVM nativo = no eligible.
- **Auditability:** Owners y lenders piden monthly progress reports con BCWS/BCWP/ACWP + CPI/SPI + EAC. No es "marketing speak" — es contractual requirement en construction loans / development financing.

---

### 2. Lo que NINGUNA plataforma tiene bien resuelto — Oportunidades de diferenciación para BuildSync

1. **PE/PMP-grade EVM + modern UX** — Primavera/MSP tienen EVM completo pero UX antigua. Linear/Asana tienen UX moderna pero NO EVM. **Gap: EVM completo (BAC/EAC/ETC/TCPI/VAC/CPI/SPI) con UX 2026.**

2. **Recertification-specific workflow** — Ningún tool maneja recurring inspections (NYC LL11, Miami 40-year, CDMX dictamen estructural) como first-class citizen. Todos asumen "one-shot project". **Gap: Cycle-based recertification con auto-rollover de inspection dates + reminder workflows + jurisdiction-specific requirements.**

3. **Permit jurisdiction tracking** — NYC DOB, Miami-Dade, CDMX SEDUVI, Bogotá Curaduría — cada uno tiene su propio workflow, requirement set, fees, timelines. Ningún tool tiene base de datos de jurisdictions con permit requirements modelados. **Gap: Permit module con jurisdiction-aware checklists + auto-generated submission packages.**

4. **Stamping / Sealing workflow** — PE stamps cada drawing/calculation con seal + signature + date. Ningún tool maneja stamping with audit trail (who stamped, when, on which revision, with which PE license #). **Gap: Digital sealing workflow PE-license tracked.**

5. **Bilingual EN/ES native** — Procore/Bluebeam tienen ES localization parcial. Aconex casi nada. Linear/Asana hacen translation pero no bilingual mixed-language UI (PE en NYC mixing EN drawings + ES communications a CDMX office). **Gap: Truly bilingual workflows.**

6. **Calculation traceability** — Engineering calculations (beam design, retaining wall, load gen — Juan ya las tiene) son outputs que cambian cuando inputs cambian. Ningún PM tool linkea calculations a drawing revisions automáticamente. **Gap: Calc-to-drawing-revision links.**

7. **Multi-jurisdiction reporting** — Juan opera en 4 markets (NYC, Miami, CDMX, Bogotá) con currencies, codes, billing standards distintos. Aconex/P6 lo soportan pero requieren config heavy. **Gap: Multi-currency, multi-code, multi-jurisdiction nativo.**

8. **Client-facing portal con engineering deliverable timeline** — Buildertrend tiene homeowner portal residencial. Aconex tiene neutral CDE pero impráctico para small clients. **Gap: Client portal específico para engineering deliverables (drawings released, calcs approved, stamps applied, permits filed).**

9. **Mobile field with offline + sync conflict resolution** — Fieldwire offline-first pero narrow. Procore mobile OK pero conflict resolution rudimentaria. **Gap: Robust offline-first con conflict resolution claro (similar Linear's optimistic UI pero para field data).**

10. **Look-Ahead + Pull Planning integrated** — Touchplan/InTakt tienen Lean construction (LPS) pero son apps standalone. P6 no native LPS. Procore parcial. **Gap: Pull Planning + Last Planner System integrado con master schedule + Look-Ahead window.**

---

### 3. Top 15 Features ranqueadas para una firma estructural

| # | Feature | Qué hace | Tools que la tienen | Dificultad |
|---|---|---|---|---|
| 1 | **EVM completo (BCWS/BCWP/ACWP + CPI/SPI/EAC/ETC/TCPI/VAC)** | Métricas PMI nativas con baseline tracking | P6, MSP, Planview | **M** (BuildSync ya tiene PV/EV/AC) — añadir aliases BCWS/BCWP/ACWP + ETC/TCPI/VAC |
| 2 | **CPM real con Total Float / Free Float visible** | Calcula float por activity, highlight critical path en rojo | P6, MSP | **L** — engine de scheduling con FS/SS/FF/SF + Lead/Lag |
| 3 | **Multiple baselines + variance tracking** | Save baseline, compare current vs baseline N | P6 (∞), MSP (10), Smartsheet | **M** |
| 4 | **Look-Ahead window filter (3-week / 6-week)** | Filter view: activities started or starting within N days | P6, Touchplan | **S** |
| 5 | **Submittal / RFI workflows with stamping** | Forms with review steps, due dates, aging, attach drawings + stamp | Procore, ACC, Aconex | **M** |
| 6 | **Daily Log con weather + manpower + equipment** | Field-friendly daily entry con auto-weather + photos | Procore, Buildertrend, Fieldwire | **S** |
| 7 | **Punch List (pinned to drawings with photos)** | Issues pinned a drawing locations, photos, asignee | Fieldwire, Procore, ACC | **M** |
| 8 | **AIA G702/G703 generation** | Auto-generate pay app from Schedule of Values | Procore, Sage 100, ACC | **M** |
| 9 | **Document Status Codes ISO 19650 (S1-S6, A1-A4)** | Document workflow status tracking ISO-compliant | Aconex, ACC | **S** |
| 10 | **Resource leveling con capacity heatmap** | Auto-level overallocations + heatmap visualization | P6, MSP, Float | **M** (BuildSync tiene capacity matrix, add leveling) |
| 11 | **Custom Item Types per project type** | Construction / Design / Recertification / Permit cada con own fields, statuses, views | Wrike, Linear (projects), ClickUp | **M** |
| 12 | **Activity Codes / Tags taxonomy multi-axis** | Tag activities by discipline, phase, location, contractor | P6, Asana | **S** |
| 13 | **Goals / OKRs cascading to projects** | Strategic goals linked to projects, auto-progress | Planview, Asana, Linear (Initiatives) | **S** (BuildSync ya tiene Goals upgraded — verify cascading) |
| 14 | **Auditable change log + transmittal log** | Every change/document timestamped, signed, queryable | Aconex, P6 Notebook, Procore | **M** |
| 15 | **Mobile offline-first with sync conflict resolution** | Field work without signal, smart merge on reconnect | Fieldwire, Procore mobile | **L** |

**Difficulty key:**
- **S (Small):** 1-3 días con BuildSync's current stack
- **M (Medium):** 1-2 semanas con engine modifications
- **L (Large):** 3+ semanas, often requires scheduling engine work

---

### 4. Vocabulario PMI / AEC — Glosario 30+ términos

**Schedule / CPM:**
1. **Activity** — work unit. P6 prefiere "Activity" sobre "Task" (Task = sub of Activity).
2. **WBS (Work Breakdown Structure)** — hierarchical decomposition of work.
3. **CPM (Critical Path Method)** — algorithm to identify longest path through schedule.
4. **Critical Path** — chain of activities with zero or negative total float.
5. **Total Float (TF)** — days an activity can slip without delaying project finish.
6. **Free Float (FF)** — days an activity can slip without delaying successor.
7. **Drive Float** — used in resource-driven schedules.
8. **Constraint** — FNLT (Finish No Later Than), SNET (Start No Earlier Than), MSO (Must Start On), MFO (Must Finish On), ASAP, ALAP.
9. **Relationship Types** — FS (Finish-to-Start, default), SS, FF, SF, with Lag (positive) or Lead (negative).
10. **Look-Ahead** — short-term filtered schedule view (typical 3-week or 6-week).
11. **Reflection / What-If Scenario** — parallel copy of schedule for analysis.
12. **Baseline** — approved snapshot of schedule + budget at point in time.
13. **TIA (Time Impact Analysis)** — forensic delay analysis methodology.
14. **Fragnet** — fragment of network inserted to analyze delay impact.

**EVM (Earned Value):**
15. **PV / BCWS (Planned Value / Budgeted Cost of Work Scheduled)** — planned cumulative cost.
16. **EV / BCWP (Earned Value / Budgeted Cost of Work Performed)** — value of work done.
17. **AC / ACWP (Actual Cost / Actual Cost of Work Performed)** — actual spend.
18. **CPI (Cost Performance Index)** — EV/AC. >1 favorable.
19. **SPI (Schedule Performance Index)** — EV/PV. >1 ahead of schedule.
20. **EAC (Estimate at Completion)** — projected total cost. EAC = BAC/CPI.
21. **ETC (Estimate to Complete)** — remaining cost. ETC = EAC - AC.
22. **BAC (Budget at Completion)** — original total budget.
23. **VAC (Variance at Completion)** — BAC - EAC.
24. **TCPI (To-Complete Performance Index)** — CPI required to finish on budget.
25. **CV (Cost Variance)** — EV - AC.
26. **SV (Schedule Variance)** — EV - PV.

**Construction operations:**
27. **RFI (Request for Information)** — formal question from contractor to design team.
28. **Submittal** — product data / shop drawings sent for design review.
29. **Punch List / Punch Items** — final completion items at substantial completion.
30. **Daily Log / Daily Report** — daily field record (weather, manpower, equipment, deliveries, issues).
31. **Change Order (CO) / Potential Change Order (PCO) / Change Order Request (COR)** — modification to contract.
32. **T&M Ticket (Time & Materials)** — out-of-scope work tracking.
33. **Schedule of Values (SOV)** — line-item budget for billing.
34. **AIA G702 / G703** — payment application + continuation sheet.
35. **Lien Waiver / Sub-Tier Lien Waiver** — release of right to file lien on payment.
36. **Substantial Completion** — owner can occupy/use; punch list begins.
37. **Final Completion / Closeout** — all punch items done, retention released.
38. **Retainage** — % withheld from each payment (typical 5-10%).
39. **Pre-Construction (Preconstruction)** — phase before mobilization.
40. **Mobilization** — contractor begins field work.

**Lean Construction:**
41. **Last Planner System (LPS)** — Glenn Ballard's production planning system.
42. **Pull Planning** — backward-from-milestone collaborative planning.
43. **Look-Ahead Plan** — 3-6 week constraint-removal plan.
44. **Weekly Work Plan (WWP)** — committed weekly tasks.
45. **PPC (Percent Plan Complete)** — % of WWP tasks completed as planned.
46. **Constraints** — preconditions blocking work readiness.
47. **Make-Ready Planning** — process of removing constraints.

**Design / Stamping:**
48. **Schematic Design (SD)** — concept phase.
49. **Design Development (DD)** — refinement phase.
50. **Construction Documents (CDs)** — issued-for-construction drawings + specs.
51. **IFC (Issued for Construction)** — final stamped drawings.
52. **Stamp / Seal** — PE professional seal + signature on drawings.
53. **PE License Number** — state-issued professional engineer license.
54. **Construction Administration (CA)** — design team's role during construction.

**Document control (ISO 19650):**
55. **CDE (Common Data Environment)** — shared digital workspace.
56. **WIP (Work in Progress)** — author's working area.
57. **Shared** — coordinated with other disciplines.
58. **Published** — approved/issued.
59. **Archive** — final record.
60. **S1-S6 / A1-A4** — document status codes per ISO 19650.

**Recertification specific (NYC LL11, Miami 40-year):**
61. **FISP / Local Law 11** — Façade Inspection Safety Program (NYC, every 5 years).
62. **TR-6 / SWARMP / UNSAFE** — façade condition classifications.
63. **40-Year Recertification** — Miami-Dade structural + electrical recertification.
64. **Dictamen Estructural** — Mexico CDMX structural certification per Reglamento de Construcciones.
65. **Curaduría Urbana** — Bogotá urban permitting entity.

---

### 5. Visual patterns que dan "seriedad técnica"

**Tools que se sienten "Primavera-grade":**

**Typography:**
- **Monospace** o **tabular-nums** para columnas numéricas (variance, CPI, days, %). P6 uses Arial/Tahoma with tabular alignment. MSP same. Smartsheet uses Lato/Roboto Mono for numbers.
- **Sans-serif neutral** for UI body: Segoe UI (MSP), Roboto (Smartsheet/Asana), Inter (Linear), Open Sans (Procore).
- **NO playful fonts** (no Comic Sans, no rounded display fonts). Asana's "Asana Sans" custom font is the edge.

**Color:**
- **Conservative palette:** blues, grays, blacks, whites. Procore Blue `#1c5bba`. Autodesk Orange `#FF7100`. Microsoft Blue `#0078D4`. Linear violet `#5E6AD2`.
- **Accent colors for status, never for chrome:** Red = critical/overdue, Yellow = at-risk, Green = on-track, Gray = future/inactive.
- **Saturation low** — pastel saturated colors (Asana, Monday) feel less serious than muted/desaturated (Linear, Procore).
- **Avoid color-explosion** (Monday's vibrant board view is anti-Primavera).

**Density:**
- **High density tables** — P6 shows 30+ columns. MSP shows 20+. Smartsheet 15+. PE/PMPs want data-dense, not whitespace-pretty.
- **Tight row heights** — 28-36px per row in serious tools vs 44-52px in consumer tools.
- **Compact sidebars** — not 280px wide; 220-240px max.

**Layout patterns:**
- **Persistent left sidebar** for navigation (Procore, MSP, P6, Linear, Asana).
- **Gantt anchored to grid** (no separate tab) — P6, MSP, Smartsheet always show Grid + Gantt simultaneously.
- **Right-side details panel** sliding in on row click — Linear pattern, Procore pattern.
- **Top bar with breadcrumbs + actions** — Procore, ACC, Linear.
- **Status pills** with icon + text + color — not just color blocks.

**Information architecture:**
- **Tabular nums + right-alignment** for numbers (BuildSync ya hace esto — preservar).
- **Sortable, filterable, groupable columns** in every list.
- **Saved views** — every list/grid should be saveable with filter+sort+columns state.
- **Bulk actions** via checkbox column — select-all + apply.

**Tools que NO se sienten serious:**
- Monday.com (color overload, unicorns vibes).
- Buildertrend (consumer-friendly UI).
- ClickUp (overcrowded, inconsistent across spaces).
- Notion (slow, too generous whitespace).
- Asana (unicorn celebrations).

**Tools que SÍ se sienten serious:**
- Primavera P6 (extreme density, conservative).
- Microsoft Project (Excel-like rigor).
- Aconex (enterprise CRM feel).
- Procore (clean, blue, dense tables).
- Linear (modern + dense + opinionated — best of both).
- Smartsheet (Excel rigor + modern web).

---

### 6. Top 5 Recomendaciones priorizadas para BuildSync (2-4 semanas)

**Dado que BuildSync ya tiene:** EVM (PV/EV/AC/CPI/SPI/EAC), Gantt con gates, milestones, capacity matrix por team, list views densas con tabular-nums.

**Aquí está el roadmap "Primavera-grade vs Asana-clone":**

#### **Recomendación 1: Expandir EVM al set PMI completo + S-curve**
**Por qué:** BuildSync tiene PV/EV/AC/CPI/SPI/EAC. PMPs esperan también **BCWS, BCWP, ACWP** (aliases legacy), **BAC, VAC, ETC, TCPI**. Y la visualización icónica de EVM es el **S-curve** (planned cumulative cost line + actual cumulative cost line + earned value line over time).

**Qué construir:**
- Add columns BCWS, BCWP, ACWP como aliases sinónimos de PV, EV, AC en EVM views (terminología legacy AACEi/PMI).
- Calculate y display **ETC = EAC - AC**, **VAC = BAC - EAC**, **TCPI = (BAC - EV) / (BAC - AC)**.
- S-curve chart con 3 líneas (PV/EV/AC) + variance band shading + forecast EAC extension.
- DCMA 14-point check report — sanity check del schedule.

**Effort:** M (1-2 semanas)
**Impact:** Critical — esto literal le da el "PMI seal of approval" feel.

#### **Recomendación 2: Document Status Codes ISO 19650 + Stamping workflow**
**Por qué:** Para una firma estructural, drawings + calcs + reports stamped son el deliverable. Aconex y ACC Docs son los únicos con ISO 19650 status codes (S1-S6, A1-A4). Esto es HUGE PMI-feel señal.

**Qué construir:**
- Document module con status field tipo enum: S1 (Suitable for Coordination), S2 (Suitable for Information), S3 (Suitable for Review), S4 (Suitable for Stage Approval), A1 (Approved), A2 (Approved with Comments), A3 (Approved as Noted), A4 (Approved for Construction).
- Revision tracking (Rev 0, Rev 1, etc.) per document.
- Stamping workflow: PE digitally stamps with license number, signature, date — immutable record.
- Transmittal log (every document sent → who, when, opened/downloaded receipts).

**Effort:** M (1-2 semanas)
**Impact:** Critical — diferenciador masivo vs Linear/Asana/Monday que no tienen NADA de esto.

#### **Recomendación 3: Look-Ahead view + Critical Path real con Total Float**
**Por qué:** BuildSync tiene Gantt con gates pero probablemente sin CPM real. Sin Total Float visible, sin Free Float, sin auto-highlight de critical path en rojo, no es "P6-grade".

**Qué construir:**
- Scheduling engine: implement CPM forward/backward pass calculations (early start, late start, early finish, late finish).
- Total Float = LS - ES (or LF - EF), display per activity.
- Critical Path highlight: activities with TF ≤ 0 (configurable threshold, e.g., TF ≤ 2 days).
- Look-Ahead view: filter button "3-week" / "6-week" / "Custom" — shows only activities starting or in progress within window.
- Relationship types: support SS, FS, FF, SF + Lead/Lag.
- Constraints: FNLT, SNET, MFO, MSO.

**Effort:** L (3+ semanas) — pero algunas partes (Look-Ahead filter) son S si el modelo data ya tiene predecessors.
**Impact:** Critical — esto SEPARA herramienta seria de Trello.

#### **Recomendación 4: RFI + Submittal + Daily Log modules (AEC core)**
**Por qué:** Cualquier PE/PMP/CCM evaluando BuildSync va a preguntar "where's RFI? Submittal? Daily Log?" — estos tres son AEC table stakes. Sin esto, Juan no puede pitchear a un GC client o a un structural client serio.

**Qué construir:**
- **RFI module:** RFI # (auto), Subject, Question, Cost Impact, Schedule Impact, Drawing reference, Submitted by, Assigned to (design team), Response due, Status (Open / Pending / Answered / Closed), aging metrics. Email-to-create.
- **Submittal module:** Submittal #, Spec section, Type (Product Data / Shop Drawings / Sample), Submitted by, Reviewer, Status (Submitted / Under Review / Approved / Approved as Noted / Revise and Resubmit), revision history.
- **Daily Log module:** Date, Weather (auto-pull via API), Manpower by trade, Equipment, Visitors, Deliveries, Activities performed, Issues/Delays, Photos.

**Effort:** M (2 semanas — schemas + UIs + email-to-create)
**Impact:** High — open's the door to AEC market positioning.

#### **Recomendación 5: Multi-baseline tracking + Variance dashboard**
**Por qué:** BuildSync probablemente tiene 1 baseline implícito (the original schedule). PMPs/AACEi assessors quieren ver Original Baseline + Current Approved Baseline + Rebaseline 1 + Rebaseline 2, con variance entre cualquier par.

**Qué construir:**
- Baseline snapshot system: at any point, "Save as Baseline" creates immutable copy of current schedule + budget.
- Baseline selector dropdown in Gantt: show baseline bars (gray) underneath current bars (color).
- Variance view: per activity, show Start Variance, Finish Variance, Duration Variance, Cost Variance vs selected baseline.
- Multiple baselines (suggest 5 slots: Original, Approved Revised 1, Approved Revised 2, etc.) with timestamps + actor (who saved it) + reason (text note).

**Effort:** M (1-2 semanas — primarily schema work + view rendering)
**Impact:** High — defensibility for claims, governance, exec reporting.

---

### Resumen de seriousness PMI-feel scores (1-10)

| # | Tool | Score |
|---|---|---|
| 1 | Procore | 9 |
| 2 | Autodesk Build / ACC | 8 |
| 3 | Buildertrend | 3 |
| 4 | Fieldwire | 5 |
| 5 | Oracle Aconex | 10 |
| 6 | Primavera P6 | 10 |
| 7 | Microsoft Project | 8 |
| 8 | Smartsheet | 6 |
| 9 | Wrike | 6 |
| 10 | Planview | 9 |
| 11 | Linear | 2 (anti-PMI by design, BUT amazing UX) |
| 12 | Asana | 5 |
| 13 | Monday.com | 4 |
| 14 | ClickUp | 3 |
| 15 | Height | 3 |
| 16 | Float | 6 |
| 17 | Forecast.app | 6 |
| 18 | Resource Guru | 5 |
| 19 | Notion Projects | 4 |
| 20 | Airtable | 3 |

**Conclusión accionable:** Las tools más respetadas por PMP/PE (P6, Aconex, Planview, Procore, MSP) comparten 4 atributos:
1. **CPM real + EVM completo**
2. **Multiple baselines + variance**
3. **Vocabulario PMI literal** (no "marketing-speak")
4. **Density visual + tabular-nums + monospace para numbers**

BuildSync ya tiene #4. Para llegar a P6-grade, las 5 recomendaciones arriba (EVM completo + ISO 19650 + CPM + RFI/Submittal/DL + Multi-baseline) lo posicionan en el mismo cuadrante que Procore/MSP, con la UX moderna de Linear. Esto es el unique selling point: **"P6/Procore-grade methodology con Linear-grade UX"**.

---

## Sources

- [Procore Project Management](https://www.procore.com/project-management)
- [Procore Pricing Analysis (Planyard 2024)](https://planyard.com/blog/cost-of-procore-construction-software-explained)
- [Procore RFI Software](https://www.procore.com/project-management/rfis)
- [Procore vs Autodesk](https://www.procore.com/compare/procore-vs-autodesk)
- [Procore Pay (Lien Waivers) 2024](https://www.procore.com/whats-new/whats-new-in-procore-pay-july-2024)
- [Autodesk Construction Cloud Product Updates](https://www.autodesk.com/blogs/construction/50-new-product-updates-autodesk-construction-cloud/)
- [July 2025 Construction Product Release (Autodesk)](https://www.autodesk.com/blogs/construction/july-2025-construction-product-release/)
- [Buildertrend Features](https://buildertrend.com/features/)
- [Buildertrend vs Procore 2026 (Buildertrend)](https://buildertrend.com/buildertrend-vs-procore/)
- [Fieldwire Plans and Pricing](https://www.fieldwire.com/pricing/)
- [Fieldwire Punch List](https://www.fieldwire.com/punch-list-app/)
- [Oracle Aconex Project Controls Datasheet](https://www.oracle.com/construction-engineering/aconex/datasheet/)
- [Oracle Aconex Capabilities 2026](https://www.oracle.com/news/announcement/new-oracle-aconex-capabilities-improve-project-transparency-and-control-2026-04-13/)
- [Aconex Pricing (ITQlick)](https://www.itqlick.com/oracle-aconex/pricing)
- [Primavera P6 EPPM (Oracle)](https://www.oracle.com/construction-engineering/primavera-p6/)
- [Primavera P6 Pricing (Taradigm)](https://www.taradigm.com/how-much-does-primavera-p6-cost/)
- [EVM in Primavera P6 (Project Control Academy)](https://www.projectcontrolacademy.com/earned-value-management-in-primavera-p6/)
- [Microsoft Project Plans](https://www.microsoft.com/en-us/microsoft-365/project/project-management-software)
- [Earned Value Analysis with MS Project (TheProjectGroup 2024)](https://www.theprojectgroup.com/blog/en/earned-value-analysis-ms-project/)
- [MS Project Plan 3 vs Plan 5 Rebrand](https://www.schneider.im/microsoft-project-plan-3-and-5-name-changes/)
- [Smartsheet Platform](https://www.smartsheet.com/platform)
- [Smartsheet Views](https://www.smartsheet.com/platform/features/views)
- [Smartsheet Pricing (TheDigitalProjectManager)](https://thedigitalprojectmanager.com/tools/smartsheet-pricing/)
- [Wrike Features](https://www.wrike.com/features/)
- [Wrike Pricing (CheckThat)](https://checkthat.ai/brands/wrike/pricing)
- [Wrike Datahub Help](https://help.wrike.com/hc/en-us/community/posts/27272953759895)
- [Planview AdaptiveWork](https://www.planview.com/products-solutions/products/adaptivework/)
- [Planview Portfolios](https://www.planview.com/products-solutions/products/planview-portfolios/)
- [Linear Features](https://linear.app/features)
- [Linear Conceptual Model](https://linear.app/docs/conceptual-model)
- [Linear Triage Docs](https://linear.app/docs/triage)
- [Asana Features](https://asana.com/features)
- [Linear vs Asana (ClickUp Blog)](https://clickup.com/blog/linear-vs-asana/)
- [Monday.com Pricing 2024 (TheDigitalProjectManager)](https://thedigitalprojectmanager.com/tools/monday-pricing/)
- [Monday.com Pricing Adjustment Jan 2024](https://support.monday.com/hc/en-us/articles/16274345773842)
- [ClickUp Features](https://clickup.com/features)
- [Height Autonomous Project Management](https://height.app/autonomous)
- [Height 2.0 Launch (BusinessWire)](https://www.businesswire.com/news/home/20241008197812/en/Height.app-Unveils-First-Ever-Autonomous-Project-Collaboration-Tool-for-Product-Builders)
- [Height App Review (TechRepublic)](https://www.techrepublic.com/article/height-app-review/)
- [Float Resource Management](https://www.float.com/)
- [Forecast.app](https://www.forecast.app/)
- [Resource Guru Features](https://resourceguruapp.com/features)
- [Resource Guru vs Float](https://thedigitalprojectmanager.com/tools/resource-guru-vs-float/)
- [Notion Projects](https://www.notion.com/product/projects)
- [Airtable](https://www.airtable.com/)
- [PMI Critical Path Method Calculations](https://www.pmi.org/learning/library/critical-path-method-calculations-scheduling-8040)
- [PMP Glossary (Manager2Be)](https://www.manager2be.com/post/pmp-glossary)
- [Last Planner System (Lean Construction Institute)](https://leanconstruction.org/lean-topics/last-planner-system/)
- [Touchplan Lean Construction Planning](https://touchplan.io/digitize-lean-construction-planning/)
- [EVM Software Comparison (Celoxis 2026)](https://www.celoxis.com/article/earned-value-management-projects)
- [Cost Performance Index (Cleopatra Enterprise)](https://cleopatraenterprise.com/blog/cost-performance-index-cpi/)
- [AIA G702/G703 Construction Filing Guide](https://www.constructioncostaccounting.com/post/construction-application-for-payment-aia-g702-g703-complete-filing-guide)
- [Procore AIA Billing Guide](https://www.procore.com/library/aia-billing)
- [15 Best PM Systems for AEC Firms 2026 (Flowcase)](https://www.flowcase.com/blog/15-best-project-management-systems-for-aec-firms)
- [PermitFlow Construction Permitting](https://www.permitflow.com/)
- [Monograph PM for Architects/Engineers](https://monograph.com/)

agentId: a226c7ff0e7d4c514 (use SendMessage with to: 'a226c7ff0e7d4c514' to continue this agent)
<usage>total_tokens: 130178
tool_uses: 59
duration_ms: 621298</usage>