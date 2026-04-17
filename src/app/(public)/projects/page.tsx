'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/components/ttc/language-provider';
import { ProjectCard } from '@/components/ttc/project-card';
import type { TranslationKey } from '@/lib/i18n';

type Category = 'all' | 'residential' | 'commercial' | 'industrial' | 'public';

interface ProjectItem {
  image: string;
  category: Exclude<Category, 'all'>;
  categoryKey: TranslationKey;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Category>('all');

  const allProjects: ProjectItem[] = [
    { image: '/ttc/img/projects/project-01.jpg', category: 'residential', categoryKey: 'category.residential', titleKey: 'project.residentialTower', descKey: 'project.residentialTower.desc' },
    { image: '/ttc/img/projects/project-02.jpg', category: 'commercial', categoryKey: 'category.commercial', titleKey: 'project.commercialComplex', descKey: 'project.commercialComplex.desc' },
    { image: '/ttc/img/projects/project-03.jpg', category: 'industrial', categoryKey: 'category.industrial', titleKey: 'project.industrialWarehouse', descKey: 'project.industrialWarehouse.desc' },
    { image: '/ttc/img/projects/project-04.jpg', category: 'residential', categoryKey: 'category.luxury', titleKey: 'project.luxuryResidence', descKey: 'project.luxuryResidence.desc' },
    { image: '/ttc/img/projects/project-05.jpg', category: 'residential', categoryKey: 'category.multifamily', titleKey: 'project.multiFamilyHousing', descKey: 'project.multiFamilyHousing.desc' },
    { image: '/ttc/img/projects/project-06.jpg', category: 'public', categoryKey: 'category.publicWorks', titleKey: 'project.publicInfrastructure', descKey: 'project.publicInfrastructure.desc' },
    { image: '/ttc/img/projects/project-07.jpg', category: 'commercial', categoryKey: 'category.parking', titleKey: 'project.parkingStructure', descKey: 'project.parkingStructure.desc' },
    { image: '/ttc/img/projects/project-08.jpg', category: 'commercial', categoryKey: 'category.mixedUse', titleKey: 'project.mixedUse', descKey: 'project.mixedUse.desc' },
    { image: '/ttc/img/projects/project-09.jpg', category: 'public', categoryKey: 'category.healthcare', titleKey: 'project.healthcare', descKey: 'project.healthcare.desc' },
    { image: '/ttc/img/projects/project-10.jpg', category: 'commercial', categoryKey: 'category.hospitality', titleKey: 'project.hospitality', descKey: 'project.hospitality.desc' },
    { image: '/ttc/img/projects/project-11.jpg', category: 'industrial', categoryKey: 'category.industrial', titleKey: 'project.distributionCenter', descKey: 'project.distributionCenter' },
    { image: '/ttc/img/projects/project-12.jpg', category: 'commercial', categoryKey: 'category.office', titleKey: 'project.officeBuilding', descKey: 'project.officeBuilding' },
  ];

  const filtered = filter === 'all' ? allProjects : allProjects.filter((p) => p.category === filter);

  const filterBtns: { key: Category; labelKey: TranslationKey }[] = [
    { key: 'all', labelKey: 'projects.filterAll' },
    { key: 'residential', labelKey: 'projects.filterResidential' },
    { key: 'commercial', labelKey: 'projects.filterCommercial' },
    { key: 'industrial', labelKey: 'projects.filterIndustrial' },
    { key: 'public', labelKey: 'projects.filterPublic' },
  ];

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
          <div className="projects-filter">
            {filterBtns.map((b) => (
              <button
                key={b.key}
                className={`filter-btn${filter === b.key ? ' active' : ''}`}
                onClick={() => setFilter(b.key)}
              >
                {t(b.labelKey)}
              </button>
            ))}
          </div>

          <div className="projects__grid projects__grid--full">
            {filtered.map((p, i) => (
              <ProjectCard
                key={p.image}
                image={p.image}
                category={t(p.categoryKey)}
                title={t(p.titleKey)}
                description={t(p.descKey)}
                index={i + 1}
                total={filtered.length}
                href="#"
                delay={(i % 4) * 100}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
