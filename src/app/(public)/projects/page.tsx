'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/components/ttc/language-provider';
import { ScrollAnimation } from '@/components/ttc/scroll-animation';
import { ProjectCard } from '@/components/ttc/project-card';

type Category = 'all' | 'residential' | 'commercial' | 'industrial' | 'public';

interface ProjectData {
  image: string;
  titleKey: string;
  descKey: string;
  category: Category;
}

const allProjects: ProjectData[] = [
  { image: '/ttc/img/projects/project-01.jpg', titleKey: 'project.residentialTower', descKey: 'project.residentialTower.full', category: 'residential' },
  { image: '/ttc/img/projects/project-02.jpg', titleKey: 'project.commercialComplex', descKey: 'project.commercialComplex.full', category: 'commercial' },
  { image: '/ttc/img/projects/project-03.jpg', titleKey: 'project.industrialWarehouse', descKey: 'project.industrialWarehouse.full', category: 'industrial' },
  { image: '/ttc/img/projects/project-04.jpg', titleKey: 'project.luxuryResidence', descKey: 'project.luxuryResidence.full', category: 'residential' },
  { image: '/ttc/img/projects/project-05.jpg', titleKey: 'project.multiFamilyHousing', descKey: 'project.multiFamilyHousing.full', category: 'residential' },
  { image: '/ttc/img/projects/project-06.jpg', titleKey: 'project.publicInfrastructure', descKey: 'project.publicInfrastructure.full', category: 'public' },
  { image: '/ttc/img/projects/project-07.jpg', titleKey: 'project.parkingStructure', descKey: 'project.parkingStructure.full', category: 'commercial' },
  { image: '/ttc/img/projects/project-08.jpg', titleKey: 'project.mixedUse', descKey: 'project.mixedUse.full', category: 'commercial' },
  { image: '/ttc/img/projects/project-09.jpg', titleKey: 'project.oceanfront', descKey: 'project.oceanfront.full', category: 'residential' },
  { image: '/ttc/img/projects/project-10.jpg', titleKey: 'project.customHome', descKey: 'project.customHome.full', category: 'residential' },
  { image: '/ttc/img/projects/project-11.jpg', titleKey: 'project.distributionCenter', descKey: 'project.distributionCenter.full', category: 'industrial' },
  { image: '/ttc/img/projects/project-12.jpg', titleKey: 'project.officeBuilding', descKey: 'project.officeBuilding.full', category: 'commercial' },
];

export default function ProjectsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Category>('all');

  const filters: { key: Category; labelKey: string }[] = [
    { key: 'all', labelKey: 'projects.filterAll' },
    { key: 'residential', labelKey: 'projects.filterResidential' },
    { key: 'commercial', labelKey: 'projects.filterCommercial' },
    { key: 'industrial', labelKey: 'projects.filterIndustrial' },
    { key: 'public', labelKey: 'projects.filterPublic' },
  ];

  const filtered = filter === 'all' ? allProjects : allProjects.filter((p) => p.category === filter);

  return (
    <>
      {/* Page Hero */}
      <section className="ttc-page-hero">
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
          <span className="ttc-section-label">{t('section.portfolio')}</span>
          <h1>{t('projects.title')}</h1>
          <p>{t('projects.subtitle')}</p>
        </div>
      </section>

      {/* Projects Grid */}
      <section style={{ padding: '4rem 2rem 6rem', background: '#0a0a0a' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginBottom: '3rem',
            }}
          >
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`ttc-filter-btn ${filter === f.key ? 'active' : ''}`}
              >
                {t(f.labelKey as any)}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
              gap: '1.5rem',
            }}
          >
            {filtered.map((p, i) => (
              <ScrollAnimation key={p.titleKey + filter} delay={(i % 3) * 100}>
                <ProjectCard
                  image={p.image}
                  title={t(p.titleKey as any)}
                  description={t(p.descKey as any)}
                  href="#"
                />
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
