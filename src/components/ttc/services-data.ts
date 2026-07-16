import type React from 'react';
import { serviceIcons } from './service-icons';

/**
 * Single source of truth for the firm's services.
 * Used by the Services showcase (home + /services), the footer service
 * links, and the contact-form service dropdown so they never drift.
 */

export interface ServiceDef {
  slug: 'concrete';
  iconKey: 'concrete';
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
];
