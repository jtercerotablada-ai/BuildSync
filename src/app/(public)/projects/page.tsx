'use client';

import React from 'react';
import { useTranslation } from '@/components/ttc/language-provider';
import { ProjectCard } from '@/components/ttc/project-card';

/**
 * "Our Work" — capability gallery. These are the areas of work the firm
 * takes on (reinforced-concrete design, recertification, safety inspection),
 * illustrated with representative imagery — not claimed, named case studies
 * (we don't fabricate client work). Swap in real project photos when available.
 */

interface Capability {
  image: string;
  en: { category: string; title: string; desc: string };
  es: { category: string; title: string; desc: string };
}

const CAPABILITIES: Capability[] = [
  {
    image: '/ttc/img/projects/project-02.jpg',
    en: { category: 'Reinforced Concrete', title: 'Concrete Building Design', desc: 'Foundations, columns, beams, slabs, and shear walls per ACI 318 & the Florida Building Code.' },
    es: { category: 'Concreto Armado', title: 'Diseño de Edificios de Concreto', desc: 'Cimentaciones, columnas, vigas, losas y muros según ACI 318 y el Código de Florida.' },
  },
  {
    image: '/ttc/img/projects/project-05.jpg',
    en: { category: 'Reinforced Concrete', title: 'Foundation & Slab Design', desc: 'Shallow and deep foundations, mat foundations, and reinforced or post-tensioned slabs.' },
    es: { category: 'Concreto Armado', title: 'Cimentaciones y Losas', desc: 'Cimentaciones superficiales y profundas, losas de cimentación y losas armadas o postensadas.' },
  },
  {
    image: '/ttc/img/projects/project-01.jpg',
    en: { category: 'Recertification', title: '30-Year Recertification', desc: 'Structural & electrical recertification for Miami-Dade — 25 years for coastal buildings.' },
    es: { category: 'Recertificacion', title: 'Recertificación de 30 Años', desc: 'Recertificación estructural y eléctrica para Miami-Dade — 25 años en zona costera.' },
  },
  {
    image: '/ttc/img/projects/project-09.jpg',
    en: { category: 'Building Safety', title: 'Building Safety Inspection', desc: 'Broward’s BSIP for buildings three stories and taller, under Florida Statute 553.899.' },
    es: { category: 'Seguridad', title: 'Inspección de Seguridad', desc: 'El BSIP de Broward para edificios de tres pisos o más, bajo el Estatuto de Florida 553.899.' },
  },
  {
    image: '/ttc/img/projects/project-10.jpg',
    en: { category: 'Building Safety', title: 'Milestone Inspection', desc: 'Phase 1 & 2 milestone inspections for condominiums and cooperatives (SB-4-D).' },
    es: { category: 'Seguridad', title: 'Inspección Milestone', desc: 'Inspecciones milestone Fase 1 y 2 para condominios y cooperativas (SB-4-D).' },
  },
  {
    image: '/ttc/img/projects/project-07.jpg',
    en: { category: 'Structural', title: 'Structural Review', desc: 'Independent peer review and value engineering of existing structural designs.' },
    es: { category: 'Estructural', title: 'Revisión Estructural', desc: 'Revisión independiente e ingeniería de valor de diseños estructurales existentes.' },
  },
];

export default function ProjectsPage() {
  const { t, language } = useTranslation();
  const es = language === 'es';

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section__label">{t('section.portfolio')}</span>
          <h1 className="page-hero__title">{t('projects.title')}</h1>
          <p className="page-hero__subtitle">{t('projects.subtitle')}</p>
        </div>
      </section>

      <section className="section projects-page">
        <div className="container">
          <div className="projects__grid projects__grid--full">
            {CAPABILITIES.map((c, i) => {
              const copy = es ? c.es : c.en;
              return (
                <ProjectCard
                  key={c.image}
                  image={c.image}
                  category={copy.category}
                  title={copy.title}
                  description={copy.desc}
                  index={i + 1}
                  total={CAPABILITIES.length}
                  delay={(i % 4) * 100}
                />
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
