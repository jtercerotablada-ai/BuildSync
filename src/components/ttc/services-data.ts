import type React from 'react';
import { serviceIcons } from './service-icons';

/**
 * Single source of truth for the firm's three core services.
 * Used by the Services showcase (home + /services), the footer service
 * links, and the contact-form service dropdown so they never drift.
 *
 * Bilingual data lives inline (same pattern as WhyUs / ProcessSection)
 * because these are long, structured marketing strings — not simple
 * UI labels — and keeping them together makes the offering easy to edit.
 */

export interface ServiceDef {
  slug: 'recertification' | 'inspection' | 'concrete';
  iconKey: 'recert' | 'inspection' | 'concrete';
  icon: React.ReactNode;
  en: { title: string; short: string; desc: string; tags: string[] };
  es: { title: string; short: string; desc: string; tags: string[] };
}

export const SERVICES: ServiceDef[] = [
  {
    slug: 'recertification',
    iconKey: 'recert',
    icon: serviceIcons.recert,
    en: {
      title: '40-Year Building Recertification',
      short: 'Recertification',
      desc: 'Structural and electrical recertification reports for Miami-Dade and Broward. We inspect, document, and certify your building at 40 years — and every 10 years after — so your property stays compliant and clear of unsafe-structure violations.',
      tags: ['Miami-Dade & Broward', 'Structural + Electrical', 'Every 10 years'],
    },
    es: {
      title: 'Recertificación de 40 Años',
      short: 'Recertificación',
      desc: 'Informes de recertificación estructural y eléctrica para Miami-Dade y Broward. Inspeccionamos, documentamos y certificamos tu edificio a los 40 años — y cada 10 años después — para mantener tu propiedad en cumplimiento y libre de violaciones por estructura insegura.',
      tags: ['Miami-Dade y Broward', 'Estructural + Eléctrico', 'Cada 10 años'],
    },
  },
  {
    slug: 'inspection',
    iconKey: 'inspection',
    icon: serviceIcons.inspection,
    en: {
      title: 'Building Safety & Milestone Inspection',
      short: 'Building Safety Inspection',
      desc: 'Milestone Inspections (Phase 1 & 2) under Florida Statute 553.899 for condominiums and cooperatives three stories and taller. Independent, P.E.-stamped structural assessments that protect residents and meet your association’s legal deadlines.',
      tags: ['Florida SB-4-D', 'Phase 1 & 2', 'Condos 3+ stories'],
    },
    es: {
      title: 'Seguridad e Inspección Milestone',
      short: 'Inspección de Seguridad',
      desc: 'Inspecciones Milestone (Fase 1 y 2) bajo el Estatuto de Florida 553.899 para condominios y cooperativas de tres pisos o más. Evaluaciones estructurales independientes y selladas por P.E. que protegen a los residentes y cumplen los plazos legales de tu asociación.',
      tags: ['Florida SB-4-D', 'Fase 1 y 2', 'Condos de 3+ pisos'],
    },
  },
  {
    slug: 'concrete',
    iconKey: 'concrete',
    icon: serviceIcons.concrete,
    en: {
      title: 'Reinforced Concrete Restoration',
      short: 'Reinforced Concrete',
      desc: 'Repair and strengthening of deteriorated reinforced concrete — spalling, corrosion, cracking, and structural strengthening. We find the root cause, engineer the fix, and restore capacity and durability to slabs, columns, beams, balconies, and façades.',
      tags: ['Spalling & corrosion', 'Structural strengthening', 'Balconies & façades'],
    },
    es: {
      title: 'Restauración de Concreto Reforzado',
      short: 'Concreto Reforzado',
      desc: 'Reparación y refuerzo de concreto reforzado deteriorado — desprendimientos, corrosión, fisuras y refuerzo estructural. Encontramos la causa raíz, diseñamos la reparación y devolvemos capacidad y durabilidad a losas, columnas, vigas, balcones y fachadas.',
      tags: ['Desprendimiento y corrosión', 'Refuerzo estructural', 'Balcones y fachadas'],
    },
  },
];
