'use client';

import React from 'react';
import { useTranslation } from '@/components/ttc/language-provider';
import { ProjectCard } from '@/components/ttc/project-card';

/**
 * "Our Work" — capability gallery. These are the areas of work the firm
 * takes on (recertification, milestone inspection, concrete restoration),
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
    en: { category: 'Recertification', title: '40-Year Recertification', desc: 'Structural & electrical reports for Miami-Dade and Broward.' },
    es: { category: 'Recertificacion', title: 'Recertificacion de 40 Años', desc: 'Informes estructurales y electricos para Miami-Dade y Broward.' },
  },
  {
    image: '/ttc/img/projects/project-09.jpg',
    en: { category: 'Building Safety', title: 'Milestone Inspection', desc: 'Phase 1 & 2 assessments under Florida SB-4-D (553.899).' },
    es: { category: 'Seguridad', title: 'Inspeccion Milestone', desc: 'Evaluaciones Fase 1 y 2 bajo la ley SB-4-D de Florida (553.899).' },
  },
  {
    image: '/ttc/img/projects/project-05.jpg',
    en: { category: 'Reinforced Concrete', title: 'Concrete Restoration', desc: 'Spalling, corrosion, and structural strengthening of slabs & columns.' },
    es: { category: 'Concreto Reforzado', title: 'Restauracion de Concreto', desc: 'Desprendimiento, corrosion y refuerzo estructural de losas y columnas.' },
  },
  {
    image: '/ttc/img/projects/project-01.jpg',
    en: { category: 'Building Safety', title: 'Balcony & Railing Review', desc: 'Life-safety inspection of balconies, walkways, and guardrails.' },
    es: { category: 'Seguridad', title: 'Balcones y Barandales', desc: 'Inspeccion de seguridad de balcones, pasillos y barandales.' },
  },
  {
    image: '/ttc/img/projects/project-10.jpg',
    en: { category: 'Reinforced Concrete', title: 'Façade & Spall Repair', desc: 'Diagnosis and repair of façade deterioration and concrete spalling.' },
    es: { category: 'Concreto Reforzado', title: 'Fachadas y Desprendimientos', desc: 'Diagnostico y reparacion de deterioro de fachadas y desprendimientos.' },
  },
  {
    image: '/ttc/img/projects/project-07.jpg',
    en: { category: 'Reinforced Concrete', title: 'Parking Structure Repair', desc: 'Restoration of post-tensioned and reinforced parking decks.' },
    es: { category: 'Concreto Reforzado', title: 'Estacionamientos', desc: 'Restauracion de losas de estacionamiento postensadas y reforzadas.' },
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
