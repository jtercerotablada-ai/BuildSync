import type React from 'react';
import { serviceIcons } from './service-icons';

/**
 * Single source of truth for the firm's three core services.
 * Used by the Services showcase (home + /services), the footer service
 * links, and the contact-form service dropdown so they never drift.
 *
 * Facts verified 2026-07 against Miami-Dade Code §8-11(f), Broward BSIP,
 * and Florida Statute 553.899 (milestone inspections):
 *  - Recertification: 30 yrs (25 for coastal, within 3 mi), then every 10.
 *  - BSIP (Broward): buildings 3 stories+, 25 yrs then every 10.
 */

export interface ServiceDef {
  slug: 'concrete' | 'recertification' | 'inspection';
  iconKey: 'concrete' | 'recert' | 'inspection';
  icon: React.ReactNode;
  en: { title: string; short: string; desc: string; tags: string[] };
  es: { title: string; short: string; desc: string; tags: string[] };
}

export const SERVICES: ServiceDef[] = [
  {
    slug: 'concrete',
    iconKey: 'concrete',
    icon: serviceIcons.concrete,
    en: {
      title: 'Reinforced Concrete Design',
      short: 'Reinforced Concrete Design',
      desc: 'Complete structural design of reinforced-concrete buildings — foundations, columns, beams, slabs, and shear walls — engineered for safety, efficiency, and code compliance under ACI 318 and the Florida Building Code. Permit-ready, P.E.-stamped drawings.',
      tags: ['ACI 318 & Florida Building Code', 'Foundations to slabs', 'Permit-ready, P.E.-stamped'],
    },
    es: {
      title: 'Diseño de Concreto Armado',
      short: 'Diseño de Concreto Armado',
      desc: 'Diseño estructural completo de edificios de concreto armado — cimentaciones, columnas, vigas, losas y muros de cortante — para seguridad, eficiencia y cumplimiento según ACI 318 y el Código de Construcción de Florida. Planos listos para permiso y sellados por P.E.',
      tags: ['ACI 318 y Código de Florida', 'De cimentación a losas', 'Listo para permiso, sellado P.E.'],
    },
  },
  {
    slug: 'recertification',
    iconKey: 'recert',
    icon: serviceIcons.recert,
    en: {
      title: 'Building Recertification',
      short: 'Recertification',
      desc: 'Structural and electrical recertification in every Miami-Dade municipality. Buildings are recertified at 30 years — 25 years for coastal buildings — and every 10 years after. We inspect, document, and certify so your property stays compliant and clear of unsafe-structure violations.',
      tags: ['Every Miami-Dade municipality', '30 yrs · 25 coastal → every 10', 'Structural + Electrical'],
    },
    es: {
      title: 'Recertificación de Edificios',
      short: 'Recertificación',
      desc: 'Recertificación estructural y eléctrica en todos los municipios de Miami-Dade. Los edificios se recertifican a los 30 años — 25 años en zona costera — y cada 10 años después. Inspeccionamos, documentamos y certificamos para mantener tu propiedad en cumplimiento y sin violaciones por estructura insegura.',
      tags: ['Todos los municipios de Miami-Dade', '30 años · 25 costero → cada 10', 'Estructural + Eléctrico'],
    },
  },
  {
    slug: 'inspection',
    iconKey: 'inspection',
    icon: serviceIcons.inspection,
    en: {
      title: 'Building Safety Inspection (BSIP)',
      short: 'Building Safety Inspection',
      desc: 'Broward’s Building Safety Inspection Program and statewide milestone inspections under Florida Statute 553.899 — mandatory for buildings three stories and taller. Independent, P.E.-stamped Phase 1 & 2 structural assessments that protect residents and meet your legal deadlines.',
      tags: ['Broward BSIP · FL 553.899', '3+ stories', 'Phase 1 & 2'],
    },
    es: {
      title: 'Inspección de Seguridad (BSIP)',
      short: 'Inspección de Seguridad',
      desc: 'El Programa de Inspección de Seguridad de Edificios (BSIP) de Broward y las inspecciones milestone estatales bajo el Estatuto de Florida 553.899 — obligatorias para edificios de tres pisos o más. Evaluaciones estructurales independientes Fase 1 y 2, selladas por P.E., que protegen a los residentes y cumplen tus plazos legales.',
      tags: ['BSIP Broward · FL 553.899', '3+ pisos', 'Fase 1 y 2'],
    },
  },
];
