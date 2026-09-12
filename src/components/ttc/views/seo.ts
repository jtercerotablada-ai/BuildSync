import type { Lang } from '@/lib/ttc/i18n';

type PageSeo = { title: string; description: string; ogTitle?: string; keywords?: string[] };
type Pages = 'home' | 'services' | 'existing' | 'work' | 'about' | 'contact' | 'privacy' | 'terms';

/**
 * Titles and descriptions per page and language. Titles are what the browser
 * tab and the search result show; the layout appends the firm name through
 * its title template, so the home title is set in full here.
 */
export const SEO: Record<Lang, Record<Pages, PageSeo>> = {
  en: {
    home: {
      title: 'Structural Engineering for South Florida | Tercero Tablada Civil & Structural Engineering Inc.',
      description:
        'Structural engineer in Miami-Dade and Broward — structural design for new buildings, evaluation of existing buildings, building recertification, milestone inspections and BIM coordination across Miami-Dade and Broward.',
      ogTitle: 'Structural Engineering for South Florida | Tercero Tablada Civil & Structural Engineering Inc.',
      keywords: ['structural engineer Miami', 'structural engineer Broward', 'building recertification Miami-Dade', 'milestone inspection Florida', 'structural engineering South Florida'],
    },
    services: {
      title: 'Services — New Projects & Existing Buildings',
      description:
        'Structural engineering services in Miami-Dade and Broward organised by what you need: reinforced concrete design, structural analysis and foundations, BIM coordination and peer review for new projects; recertification, milestone inspections and assessments for existing buildings.',
      keywords: ['structural engineering services Miami', 'structural design Broward', 'building recertification', 'milestone inspection', 'BIM coordination'],
    },
    existing: {
      title: 'Existing Buildings — Recertification, Inspections & Repairs',
      description:
        'Structural services for existing South Florida buildings — Miami-Dade and Broward recertification, Florida milestone inspections, structural condition assessments, repair design and reinspections by a Florida P.E.',
      keywords: ['building recertification Miami-Dade', 'building recertification Broward', 'milestone inspection', 'condo structural inspection', 'balcony repair engineer'],
    },
    work: {
      title: 'Work',
      description:
        'Structural engineering engagements across South Florida — building types, structural systems, scope and deliverables for new construction and existing buildings in Miami-Dade and Broward.',
    },
    about: {
      title: 'About — Juan Tercero, PE., M.Sc.',
      description:
        'Tercero Tablada Civil & Structural Engineering Inc. is led by Juan Tercero, PE., M.Sc., Florida Professional Engineer — direct communication, a scope you can read, and one engineer responsible from proposal to sealed report.',
      keywords: ['Juan Tercero PE', 'structural engineer Miami', 'Florida professional engineer structural'],
    },
    contact: {
      title: 'Request a Proposal',
      description:
        'Request a structural engineering proposal for a new project or an existing building in Miami-Dade or Broward. Attach the notice, photos or drawings; the engineer replies with questions or a written scope.',
    },
    privacy: { title: 'Privacy Policy', description: 'How Tercero Tablada Civil & Structural Engineering Inc. handles information submitted through this website.' },
    terms: { title: 'Terms of Use', description: 'Terms governing use of the Tercero Tablada Civil & Structural Engineering Inc. website.' },
  },
  es: {
    home: {
      title: 'Ingeniería Estructural para el Sur de Florida | Tercero Tablada Civil & Structural Engineering Inc.',
      description:
        'Ingeniero estructural en Miami-Dade y Broward — diseño estructural de edificios nuevos, evaluación de edificios existentes, recertificación de edificios, inspecciones milestone y coordinación BIM en Miami-Dade y Broward.',
      ogTitle: 'Ingeniería Estructural para el Sur de Florida | Tercero Tablada Civil & Structural Engineering Inc.',
      keywords: ['ingeniero estructural Miami', 'ingeniero estructural Broward', 'recertificación de edificios Miami-Dade', 'inspección milestone Florida', 'ingeniería estructural Sur de Florida'],
    },
    services: {
      title: 'Servicios — Proyectos nuevos y edificios existentes',
      description:
        'Servicios de ingeniería estructural en Miami-Dade y Broward organizados según su necesidad: diseño en concreto reforzado, análisis estructural y cimentaciones, coordinación BIM y revisión independiente para proyectos nuevos; recertificación, inspecciones milestone y evaluaciones para edificios existentes.',
      keywords: ['servicios ingeniería estructural Miami', 'diseño estructural Broward', 'recertificación de edificios', 'inspección milestone', 'coordinación BIM'],
    },
    existing: {
      title: 'Edificios existentes — Recertificación, inspecciones y reparaciones',
      description:
        'Servicios estructurales para edificios existentes en el Sur de Florida — recertificación en Miami-Dade y Broward, inspecciones milestone de Florida, evaluaciones de condición estructural, diseño de reparaciones y reinspecciones por un P.E. de Florida.',
      keywords: ['recertificación de edificios Miami-Dade', 'recertificación Broward', 'inspección milestone condominio', 'ingeniero reparación de balcones'],
    },
    work: {
      title: 'Proyectos',
      description:
        'Encargos de ingeniería estructural en el Sur de Florida — tipos de edificio, sistemas estructurales, alcance y entregables para construcción nueva y edificios existentes en Miami-Dade y Broward.',
    },
    about: {
      title: 'Nosotros — Juan Tercero, PE., M.Sc.',
      description:
        'Tercero Tablada Civil & Structural Engineering Inc. está dirigida por Juan Tercero, PE., M.Sc., Ingeniero Profesional licenciado en Florida — comunicación directa, un alcance claro y un solo ingeniero responsable desde la propuesta hasta el informe sellado.',
      keywords: ['Juan Tercero PE', 'ingeniero estructural Miami', 'ingeniero profesional Florida estructural'],
    },
    contact: {
      title: 'Solicitar propuesta',
      description:
        'Solicite una propuesta de ingeniería estructural para un proyecto nuevo o un edificio existente en Miami-Dade o Broward. Adjunte el aviso, fotos o planos; el ingeniero responde con preguntas o con un alcance por escrito.',
    },
    privacy: { title: 'Política de privacidad', description: 'Cómo Tercero Tablada Civil & Structural Engineering Inc. maneja la información enviada a través de este sitio web.' },
    terms: { title: 'Términos de uso', description: 'Términos que rigen el uso del sitio web de Tercero Tablada Civil & Structural Engineering Inc.' },
  },
};
