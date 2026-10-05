import type { Lang } from '@/lib/ttc/i18n';

type PageSeo = { title: string; description: string; ogTitle?: string; keywords?: string[] };
type Pages = 'home' | 'services' | 'existing' | 'work' | 'about' | 'contact' | 'privacy' | 'terms';

/**
 * Titles and descriptions per page and language. Titles are what the browser
 * tab and the search result show; the layout appends the firm name through
 * its title template, so the home title is set in full here.
 *
 * The appended firm name is ~53 characters, so a result shows only the first
 * ~55 characters of each title: the service keyword and the place go there.
 * Descriptions stay between 110 and 160 characters (longer ones are cut off
 * mid-sentence), each one unique, with no code names (ACI, ASCE, F.S.…).
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
 * program queries — the home page must not compete with them.
 */
export const SEO: Record<Lang, Record<Pages, PageSeo>> = {
  en: {
    home: {
      title: 'Structural Engineering for South Florida | Tercero Tablada Civil & Structural Engineering Inc.',
      description:
        'Miami-Dade building recertification, Broward BSIP inspections and structural design for new buildings in South Florida, led by a Florida Professional Engineer.',
      ogTitle: 'Structural Engineering for South Florida | Tercero Tablada Civil & Structural Engineering Inc.',
      keywords: ['structural engineer Miami', 'structural engineer Broward', 'building recertification Miami-Dade', 'Broward BSIP', 'building safety inspection program Broward', '40 year recertification Miami', 'structural engineering South Florida'],
    },
    services: {
      title: 'Structural Engineering Services — Miami-Dade & Broward',
      description:
        'Eight structural services in Miami-Dade and Broward: recertification, BSIP, inspections and repairs; design, analysis, BIM and peer review for new projects.',
      keywords: ['structural engineering services Miami', 'structural design Broward', 'building recertification Miami-Dade', 'Broward BSIP', 'milestone inspection', 'BIM coordination'],
    },
    existing: {
      title: 'Existing Buildings — Recertification, BSIP & Repairs',
      description:
        'Miami-Dade recertification, Broward BSIP, milestone inspections, condition assessments and repair design for existing buildings, by a Florida P.E.',
      keywords: ['building recertification Miami-Dade', 'Broward BSIP', 'building safety inspection program Broward', 'milestone inspection', 'condo structural inspection', 'balcony repair engineer'],
    },
    work: {
      // "Typical", never "representative work" or "anonymized": the profiles
      // are not past jobs (see `engagements` in site.ts).
      title: 'Work — Typical Structural Engagements in South Florida',
      description:
        'Typical structural engagements in South Florida: building type, structural system, scope and deliverables for new and existing buildings.',
    },
    about: {
      title: 'About — Juan Tercero, PE., M.Sc.',
      description:
        'Tercero Tablada Civil & Structural Engineering Inc. is led by Juan Tercero, PE., M.Sc.: one Florida P.E. responsible from the proposal to the sealed report.',
      keywords: ['Juan Tercero PE', 'structural engineer Miami', 'Florida professional engineer structural'],
    },
    contact: {
      title: 'Request a Structural Engineering Proposal',
      description:
        'Request a structural engineering proposal in Miami-Dade or Broward. Attach the notice, photos or drawings; the engineer replies with questions or a scope.',
    },
    privacy: { title: 'Privacy Policy', description: 'How Tercero Tablada Civil & Structural Engineering Inc. handles information submitted through this website.' },
    terms: { title: 'Terms of Use', description: 'Terms governing use of the Tercero Tablada Civil & Structural Engineering Inc. website.' },
  },
  es: {
    home: {
      title: 'Ingeniería estructural para el Sur de Florida | Tercero Tablada Civil & Structural Engineering Inc.',
      description:
        'Recertificación de edificios en Miami-Dade, BSIP en Broward y diseño estructural de edificios nuevos, a cargo de un Ingeniero Profesional (P.E.) de Florida.',
      ogTitle: 'Ingeniería estructural para el Sur de Florida | Tercero Tablada Civil & Structural Engineering Inc.',
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
      title: 'Edificios existentes — Recertificación, BSIP y reparaciones',
      description:
        'Recertificación en Miami-Dade, BSIP en Broward, inspecciones de hito (milestone), evaluaciones de condición y diseño de reparaciones para edificios existentes.',
      keywords: ['recertificación de edificios Miami-Dade', 'BSIP Broward', 'inspección de seguridad de edificios Broward', 'inspección milestone condominio', 'inspección de hitos condominio', 'ingeniero reparación de balcones'],
    },
    work: {
      title: 'Proyectos — Encargos estructurales típicos',
      description:
        'Encargos estructurales típicos en el Sur de Florida: tipo de edificio, sistema estructural, alcance y entregables para edificios nuevos y existentes.',
    },
    about: {
      title: 'Nosotros — Juan Tercero, PE., M.Sc.',
      description:
        'Tercero Tablada Civil & Structural Engineering Inc. está dirigida por Juan Tercero, PE., M.Sc.: un solo P.E. de Florida, de la propuesta al informe sellado.',
      keywords: ['Juan Tercero PE', 'ingeniero estructural Miami', 'ingeniero profesional Florida estructural'],
    },
    contact: {
      title: 'Solicitar una propuesta de ingeniería estructural',
      description:
        'Solicite una propuesta de ingeniería estructural en Miami-Dade o Broward: adjunte la notificación, fotos o planos, y el ingeniero le responde por escrito.',
    },
    privacy: { title: 'Política de privacidad', description: 'Cómo Tercero Tablada Civil & Structural Engineering Inc. maneja la información enviada a través de este sitio web.' },
    terms: { title: 'Términos de uso', description: 'Términos que rigen el uso del sitio web de Tercero Tablada Civil & Structural Engineering Inc.' },
  },
};
