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
 */
export const SEO: Record<Lang, Record<Pages, PageSeo>> = {
  en: {
    home: {
      title: 'Structural Engineering for South Florida | Tercero Tablada Civil & Structural Engineering Inc.',
      description:
        'Structural engineer for Miami-Dade and Broward: design of new buildings, recertification, milestone inspections and repair design, led by a Florida P.E.',
      ogTitle: 'Structural Engineering for South Florida | Tercero Tablada Civil & Structural Engineering Inc.',
      keywords: ['structural engineer Miami', 'structural engineer Broward', 'building recertification Miami-Dade', 'milestone inspection Florida', 'structural engineering South Florida'],
    },
    services: {
      title: 'Structural Engineering Services — Miami-Dade & Broward',
      description:
        'Seven structural services in Miami-Dade and Broward: design, analysis, BIM and peer review for new projects; recertification, inspections and repairs.',
      keywords: ['structural engineering services Miami', 'structural design Broward', 'building recertification', 'milestone inspection', 'BIM coordination'],
    },
    existing: {
      title: 'Existing Buildings — Recertification, Inspections & Repairs',
      description:
        'Miami-Dade and Broward recertification, Florida milestone inspections, condition assessments and repair design for existing buildings, by a Florida P.E.',
      keywords: ['building recertification Miami-Dade', 'building recertification Broward', 'milestone inspection', 'condo structural inspection', 'balcony repair engineer'],
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
        'Ingeniero estructural en Miami-Dade y Broward: diseño de edificios nuevos, recertificación, inspecciones de hito (milestone), reparaciones y BIM.',
      ogTitle: 'Ingeniería estructural para el Sur de Florida | Tercero Tablada Civil & Structural Engineering Inc.',
      // People search "inspección milestone"; the page says "inspección de hito".
      keywords: ['ingeniero estructural Miami', 'ingeniero estructural Broward', 'recertificación de edificios Miami-Dade', 'inspección milestone Florida', 'inspección de hito Florida', 'ingeniería estructural Sur de Florida'],
    },
    services: {
      title: 'Servicios de ingeniería estructural — Miami-Dade y Broward',
      description:
        'Siete servicios estructurales en Miami-Dade y Broward: diseño, análisis, BIM y revisión por pares para obra nueva; recertificación, inspecciones y reparaciones.',
      keywords: ['servicios ingeniería estructural Miami', 'diseño estructural Broward', 'recertificación de edificios', 'inspección milestone', 'inspección de hito', 'coordinación BIM'],
    },
    existing: {
      title: 'Edificios existentes — Recertificación, inspecciones y reparaciones',
      description:
        'Recertificación en Miami-Dade y Broward, inspecciones de hito (milestone), evaluaciones de condición y diseño de reparaciones para edificios existentes.',
      keywords: ['recertificación de edificios Miami-Dade', 'recertificación Broward', 'inspección milestone condominio', 'inspección de hitos condominio', 'ingeniero reparación de balcones'],
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
