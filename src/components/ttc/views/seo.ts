import type { Lang } from '@/lib/ttc/i18n';

type PageSeo = { title: string; description: string; ogTitle?: string; keywords?: string[] };
type Pages = 'home' | 'services' | 'existing' | 'work' | 'about' | 'contact' | 'privacy' | 'terms';

/**
 * Titles and descriptions per page and language. Titles are what the browser
 * tab and the search result show.
 *
 * A TITLE HERE IS WRITTEN WITHOUT THE FIRM. It says what the page is about
 * and where, in that order, and `pageTitle` (meta.tsx) adds "· Tercero
 * Tablada" only when the whole line still fits the 580 px a search result
 * shows. Most do not: the short name costs 165 px, so it rides on the home
 * page and the legal pages and the rest go out alone. Never shorten the
 * subject or the place to make room for it, and never type the firm into a
 * title — the full name is 469 px by itself, which is why all 32 titles were
 * over the limit on October 7, 2026. seo.test.ts measures every title and
 * every description the way the owner's SEO check does (serp.ts), and fails
 * on one that is too long, repeats a word or says what another page says.
 *
 * Descriptions stay under 1000 px on the same ruler — about 150 characters;
 * longer ones are cut off mid-sentence — each one unique, with no code names
 * (ACI, ASCE, F.S.…).
 *
 * The descriptions lead with the two county programs, each by its own name —
 * Miami-Dade's is "recertification", Broward's is the "Building Safety
 * Inspection Program (BSIP)" — because that is the order of the site and
 * what the people holding a notice search for. NO age and NO day count goes
 * in a description: those numbers live in the timing rows of site.ts, next
 * to their authority and their date, and a meta description is where a
 * stale number survives longest. The titles keep their structure on purpose:
 * the home title is the approved tagline, and the two program pages (their
 * `seo` lives with each service in site.ts) are the ones that target the
 * program queries — the home page must not compete with them. That includes
 * the name owners still type, "40-year recertification": it is in the two
 * program titles, as a former name, and in no title in this file.
 */
export const SEO: Record<Lang, Record<Pages, PageSeo>> = {
  en: {
    home: {
      title: 'Structural Engineering for South Florida',
      description:
        'Miami-Dade building recertification, Broward BSIP inspections and structural design for new buildings in South Florida, led by a Florida Professional Engineer.',
      keywords: ['structural engineer Miami', 'structural engineer Broward', 'building recertification Miami-Dade', 'Broward BSIP', 'building safety inspection program Broward', '40 year recertification Miami', 'structural engineering South Florida'],
    },
    services: {
      title: 'Structural Engineering Services — Miami-Dade & Broward',
      description:
        'Eight structural services in Miami-Dade and Broward: recertification, BSIP, inspections and repairs; design, analysis, BIM and peer review for new projects.',
      keywords: ['structural engineering services Miami', 'structural design Broward', 'building recertification Miami-Dade', 'Broward BSIP', 'milestone inspection', 'BIM coordination'],
    },
    existing: {
      // The place came in and "& Repairs" went out to pay for it: the two
      // programs are what an owner with a notice types.
      title: 'Existing Buildings in South Florida — Recertification & BSIP',
      description:
        'Miami-Dade recertification, Broward BSIP, milestone inspections, condition assessments and repair design for existing buildings, by a Florida P.E.',
      keywords: ['building recertification Miami-Dade', 'Broward BSIP', 'building safety inspection program Broward', 'milestone inspection', 'condo structural inspection', 'balcony repair engineer'],
    },
    work: {
      // "Typical", never "representative work" or "anonymized": the profiles
      // are not past jobs (see `engagements` in site.ts). No "Work —" in
      // front either: the page is named for what it holds, in its title as
      // in its nav label, until there are real case studies to show.
      // And NO PLACE, here or in the H1 (`workPage`): "…in South Florida" in
      // both made the on-page check list this page and the home page as
      // competing for those two words, and the home page is the one that
      // should be found for them. What follows the colon are rows every
      // profile on the page has. The description keeps the place.
      title: 'Typical Structural Engagements: Scope, System, Deliverables',
      description:
        'Typical structural engagements in South Florida: building type, structural system, scope and deliverables for new and existing buildings.',
    },
    about: {
      // The engineer by name, then the trade and the place. No brand after
      // it, whatever the width: "Tercero" twice in one title is what the
      // check reports as word repetition.
      title: 'Juan Tercero, PE., M.Sc. — Structural Engineer, South Florida',
      description:
        'Tercero Tablada Civil and Structural Engineering Inc. is led by Juan Tercero, PE., M.Sc.: one Florida P.E. responsible from the proposal to the sealed report.',
      keywords: ['Juan Tercero PE', 'structural engineer Miami', 'Florida professional engineer structural'],
    },
    contact: {
      title: 'Request a Structural Engineering Proposal in South Florida',
      description:
        'Request a structural engineering proposal in Miami-Dade or Broward. Attach the notice, photos or drawings; the engineer replies with questions or a scope.',
    },
    privacy: { title: 'Privacy Policy', description: 'How Tercero Tablada Civil and Structural Engineering Inc. handles information submitted through this website.' },
    terms: { title: 'Terms of Use', description: 'Terms governing use of the Tercero Tablada Civil and Structural Engineering Inc. website.' },
  },
  es: {
    home: {
      title: 'Ingeniería estructural para el Sur de Florida',
      description:
        'Recertificación de edificios en Miami-Dade, BSIP en Broward y diseño estructural de edificios nuevos, a cargo de un Ingeniero Profesional (P.E.) de Florida.',
      // "BSIP" and "recertificación 40 años" are what people type; the page
      // says "Programa de Inspección de Seguridad de Edificios (BSIP)".
      keywords: ['ingeniero estructural Miami', 'ingeniero estructural Broward', 'recertificación de edificios Miami-Dade', 'BSIP Broward', 'inspección de seguridad de edificios Broward', 'recertificación 40 años Miami', 'ingeniería estructural Sur de Florida'],
    },
    services: {
      title: 'Servicios de ingeniería estructural — Miami-Dade y Broward',
      description:
        'Ocho servicios estructurales en Miami-Dade y Broward: recertificación, BSIP, inspecciones y reparaciones; diseño, análisis, BIM y revisión por pares.',
      // People search "inspección milestone"; the page says "inspección de hito".
      keywords: ['servicios ingeniería estructural Miami', 'diseño estructural Broward', 'recertificación de edificios Miami-Dade', 'BSIP Broward', 'inspección milestone', 'inspección de hito', 'coordinación BIM'],
    },
    existing: {
      title: 'Edificios existentes del Sur de Florida — Recertificación y BSIP',
      description:
        'Recertificación en Miami-Dade, BSIP en Broward, inspecciones de hito (milestone), evaluaciones de condición y diseño de reparaciones para edificios existentes.',
      keywords: ['recertificación de edificios Miami-Dade', 'BSIP Broward', 'inspección de seguridad de edificios Broward', 'inspección milestone condominio', 'inspección de hitos condominio', 'ingeniero reparación de balcones'],
    },
    work: {
      // "Trabajos típicos", the page's name in Spanish (site.es.ts). It used
      // to open with "Proyectos", which the page does not show. No place,
      // as in English: it is the home page's.
      title: 'Trabajos típicos: alcance, sistema estructural y entregables',
      description:
        'Trabajos típicos de ingeniería estructural en el Sur de Florida: tipo de edificio, sistema estructural, alcance y entregables en edificios nuevos y existentes.',
    },
    about: {
      // "en Florida", where English says "South Florida": with "Sur de
      // Florida" this title is 578 px, and a result shows 580.
      title: 'Juan Tercero, PE., M.Sc. — Ingeniero estructural en Florida',
      description:
        'Tercero Tablada Civil and Structural Engineering Inc. está dirigida por Juan Tercero, PE., M.Sc.: un solo P.E. de Florida, de la propuesta al informe sellado.',
      keywords: ['Juan Tercero PE', 'ingeniero estructural Miami', 'ingeniero profesional Florida estructural'],
    },
    contact: {
      title: 'Solicitar propuesta de ingeniería estructural — Sur de Florida',
      description:
        'Solicite una propuesta de ingeniería estructural en Miami-Dade o Broward: adjunte la notificación, fotos o planos, y el ingeniero le responde por escrito.',
    },
    privacy: { title: 'Política de privacidad', description: 'Cómo Tercero Tablada Civil and Structural Engineering Inc. maneja la información enviada a través de este sitio web.' },
    terms: { title: 'Términos de uso', description: 'Términos que rigen el uso del sitio web de Tercero Tablada Civil and Structural Engineering Inc.' },
  },
};
