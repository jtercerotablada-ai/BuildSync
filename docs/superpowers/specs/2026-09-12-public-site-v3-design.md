# Public site v3 — "Structural Engineering for South Florida"

Date: 2026-09-12 · Scope: `src/app/(public)/**`, `src/components/ttc/mp/**`, `src/lib/ttc/**`, `src/app/api/contact/**`, `src/proxy.ts`, `src/app/sitemap.ts`.

## 1. Goal

Turn ttcivilstructural.com from a well-designed but anonymous practice site into a
credibility-and-conversion site for owners, property managers, condominium
associations, architects and developers. Three things must be obvious inside
the first screen: **what we do, where we do it, who is responsible** — and one
action: **Request a Proposal**.

Everything published stays verifiable. No invented clients, metrics,
testimonials, license numbers or biography details. Slots exist for each of
those; they render only when real data is supplied in `site.ts`.

## 2. Information architecture

Same URLs as today (SEO preserved). Spanish mirrors under `/es/…`.

| Route | Purpose (EN) | ES mirror |
|---|---|---|
| `/` | Hero → two paths → what we design → recertification band → meet the engineer → how we work → BIM → service area → request a proposal | `/es` |
| `/services` | Services organised by need: **New projects** / **Existing buildings**. Each card: when you need it · what's included · what you receive · next step | `/es/services` |
| `/services/[slug]` (7) | Detail: why it matters · when you need it · what's included · what you receive · how it runs · when it applies (regulated services) · considerations · next step | `/es/services/[slug]` |
| `/existing-buildings` | Landing for associations/managers: four moments that need an engineer · the three existing-building services · recertification timeline by jurisdiction | `/es/existing-buildings` |
| `/projects` | Work: real case studies when supplied; until then representative engagements, clearly labelled. Firm projects vs. prior professional experience are separate lists. | `/es/projects` |
| `/about` | Hero → **Meet the Engineer** (`#engineer`) → how we work with clients → principles → standards → service area → CTA | `/es/about` |
| `/contact` | Request a proposal: form with attachments, what happens next, direct email | `/es/contact` |
| `/privacy`, `/terms` | Legal, translated | `/es/privacy`, `/es/terms` |
| `/credits` | Image credits (EN only, linked from both) | — |

Nav (EN): Services · Existing Buildings · Work · About · Contact · [EN/ES] · **Request a Proposal**.
Nav (ES): Servicios · Edificios existentes · Proyectos · Nosotros · Contacto · [EN/ES] · **Solicitar propuesta**.

## 3. Copy direction (final texts live in `site.ts` / `site.es.ts`)

**Hero.** Eyebrow: "Miami-Dade · Broward · Florida Professional Engineer".
H1: "Structural Engineering for South Florida."
Sub: "Structural design for new buildings, evaluation of existing ones,
building recertification and BIM coordination — led by a Florida Professional
Engineer who stays on your project from proposal to final report."
Primary: Request a Proposal → `/contact`. Secondary: Explore Our Services → `/services`.
Engineer plate (small, right of the CTAs): "Juan Tercero, PE., M.Sc. · Principal Engineer · Florida Professional Engineer" → `/about#engineer`.

**Two paths.** "New projects" (design, analysis & foundations, BIM, peer review) and
"Existing buildings" (recertification, milestone & safety inspections,
assessments & repair design). One sentence each + 4 service links + CTA.

**Recertification band.** Facts verified 2026-09-12:
- Miami-Dade (Code §8-11(f)): first at 30 years, 25 years within ~3 miles of the coast; then every 10 years; 90 days from notice to submit.
- Broward (Building Safety Inspection Program, BORA): first at 25 years; then every 10 years.
- State milestone (F.S. 553.899): condos/co-ops 3+ habitable stories; 30 years (25 where the local authority requires it for salt-water proximity); every 10 years; phase two only on substantial deterioration.
The site never prints a single "30 years" for both counties again.

**Meet the Engineer.** Only confirmed facts: name "Juan Tercero, PE., M.Sc.",
Florida-licensed Professional Engineer, Master of Science, founder and
principal of the firm, practice focus (reinforced concrete, existing
buildings, BIM), South Florida. License number + DBPR verification link render
only when `leadership.license` is filled. Portrait renders only when
`leadership.portrait` is set; until then a typographic plate (real monogram +
name + credential) takes the slot — no stock person, no silhouette.
"What this means for you": direct communication · a scope you can read · one
engineer's judgment from first call to sealed report.

**How we work.** 5 steps: Initial consultation → Scope & proposal → Evaluation
or design → Delivery → Follow-up. Each step says what the client does and what
they get. Process language is client-first; technical detail only where it
helps a decision.

**Contact.** Required: name, email, service, project location, description.
Optional: phone, company/association, attachments (notice, photos, plans).
Post-submit panel: reference, what happens next (3 lines), direct email. No
response-time promise is published.

## 4. Visual direction

Keep the QUIET PRECISION system (graphite `#0B0C0D`, paper `#F6F4EF`, gold
`#C99A38` marks / `#7A5D1C` gold text, Geist + Geist Mono + Instrument Serif
accent, radius 0, hairlines). Additions, all subtle and non-illustrative:

- **Plan grid**: a faint 1px module grid (`.mp-grid-bg`) on dark surfaces (hero, closing CTA, engineer plate) — the drawing-sheet feel without any drawn object.
- **Title-block fact tables**: `dl` blocks with gold key labels for facts (hero engineer plate, service "at a glance", recert timing).
- **Gold tick marks** on section indices (already present) — kept as the only ornament.
- **Motion budget cut**: reveal duration 0.72s → 0.5s, offset 22px → 14px, clip-mask headline reveals only on heroes; all copy is visible without JS (noscript rule kept) and with reduced motion.
- No SVG line-art, no wireframes, no chip walls of codes (per Juan's standing feedback).

## 5. Technical design

### 5.1 Language
- `src/lib/ttc/i18n.ts`: `Lang`, `LANGS`, `langFromPathname`, `stripLang`, `localePath`, `altPath`.
- Content: `site.ts` stays the EN source of truth (edited). `site.es.ts` mirrors every text object in Spanish. `content.ts` exports `getContent(lang)` returning one typed bundle; components take `lang` (server) or `useLang()` (client, derived from `usePathname()`).
- Routes under `src/app/(public)/es/**` are thin wrappers calling shared page views in `src/components/ttc/views/*.tsx` with `lang="es"`. EN routes call the same views with `lang="en"`.
- `<html lang>` is corrected client-side (`LangHtml`) and every page declares `alternates.languages` (hreflang en / es / x-default).
- `proxy.ts`: `/es` and `/es/` are public and marketing. `sitemap.ts` emits both languages.
- Header switch: `EN | ES`, links to the equivalent page.

### 5.2 Contact with attachments
- Client-direct upload to Vercel Blob (private) via `POST /api/contact/upload` (`handleUpload`, kind `contact-attachment`): no session, IP rate-limited, ≤ 25 MB/file, ≤ 5 files, allowlist = PDF, images (jpg/png/heic/webp), DWG/DXF, ZIP; pathname pinned to `contact/<uuid>/`.
- `POST /api/contact` accepts `files: [{url,name,size,type}]`, validates each is a private blob under `contact/`, stores in `ContactSubmission.files`, emails the office with names + a link to the inbox, and sends the submitter a fixed-copy confirmation (never echoes their message — no relay).
- Admin: `/api/files/contact/<submissionId>?i=<n>` streams an attachment after `canReadContactInbox`; the admin submissions table lists attachments.

### 5.3 SEO / a11y / performance
- Localised titles + descriptions; `Person` schema for the engineer linked as `founder`; service `areaServed` Miami-Dade/Broward; keep all canonical URLs.
- Labels, focus rings, `aria-current`, keyboard-trapped mobile menu (existing) + language switch reachable by keyboard.
- Hero video keeps poster-first; images `srcset`; motion budget reduced.

### 5.4 Testing
- `src/proxy.test.ts`: `/es`, `/es/services/x` public; `/escalate` not.
- `src/lib/ttc/i18n.test.ts`: path helpers.
- Manual: desktop + phone screenshots of every page in both languages (headless Chromium), one real form submission with an attachment (then deleted from the DB), `npm run build` clean.

## 6. Out of scope / pending real data (rendered only when supplied)
Portrait, license number, education details beyond "M.Sc.", years of experience, prior employers, named projects and photos, testimonials, phone, office address, LinkedIn.
