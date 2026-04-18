'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { ResourceCard } from '@/components/ttc/resource-card';
import { resourceIcons } from '@/components/ttc/resource-icons';
import type { TranslationKey } from '@/lib/i18n';

type Tool = {
  iconKey: keyof typeof resourceIcons;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  status: 'available' | 'coming-soon';
  href?: string;
};

const analysisTools: Tool[] = [
  { iconKey: 's3d', titleKey: 'tool.s3d', descKey: 'tool.s3d.desc', status: 'coming-soon' },
  { iconKey: 'beam', titleKey: 'tool.beam', descKey: 'tool.beam.desc', status: 'available', href: '/resources/beam' },
  { iconKey: 'sectionBuilder', titleKey: 'tool.sectionBuilder', descKey: 'tool.sectionBuilder.desc', status: 'available', href: '/resources/section-builder' },
  { iconKey: 'advancedBeam', titleKey: 'tool.advancedBeam', descKey: 'tool.advancedBeam.desc', status: 'coming-soon' },
];

const designTools: Tool[] = [
  { iconKey: 'quickDesign', titleKey: 'tool.quickDesign', descKey: 'tool.quickDesign.desc', status: 'coming-soon' },
  { iconKey: 'loadGen', titleKey: 'tool.loadGen', descKey: 'tool.loadGen.desc', status: 'coming-soon' },
  { iconKey: 'connection', titleKey: 'tool.connection', descKey: 'tool.connection.desc', status: 'coming-soon' },
  { iconKey: 'basePlate', titleKey: 'tool.basePlate', descKey: 'tool.basePlate.desc', status: 'coming-soon' },
  { iconKey: 'foundation', titleKey: 'tool.foundation', descKey: 'tool.foundation.desc', status: 'coming-soon' },
  { iconKey: 'rcDesign', titleKey: 'tool.rcDesign', descKey: 'tool.rcDesign.desc', status: 'coming-soon' },
  { iconKey: 'memberDesign', titleKey: 'tool.memberDesign', descKey: 'tool.memberDesign.desc', status: 'coming-soon' },
  { iconKey: 'composite', titleKey: 'tool.composite', descKey: 'tool.composite.desc', status: 'coming-soon' },
  { iconKey: 'retaining', titleKey: 'tool.retaining', descKey: 'tool.retaining.desc', status: 'available', href: '/resources/retaining-wall' },
  { iconKey: 'slab', titleKey: 'tool.slab', descKey: 'tool.slab.desc', status: 'coming-soon' },
];

export default function ResourcesPage() {
  const { t } = useTranslation();

  const renderCard = (tool: Tool, index: number) => {
    const statusLabel =
      tool.status === 'available' ? t('resources.available') : t('resources.comingSoon');
    return (
      <ResourceCard
        key={tool.titleKey}
        icon={resourceIcons[tool.iconKey]}
        title={t(tool.titleKey)}
        description={t(tool.descKey)}
        status={tool.status}
        statusLabel={statusLabel}
        href={tool.href}
        openLabel={t('resources.openTool')}
        delay={(index % 3) * 100}
      />
    );
  };

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section__label">{t('resources.section.label')}</span>
          <h1 className="page-hero__title">{t('resources.title')}</h1>
          <p className="page-hero__subtitle">{t('resources.subtitle')}</p>
        </div>
      </section>

      <section className="section resources-page">
        <div className="container">
          <div className="section__header">
            <span className="section__label">01</span>
            <h2 className="section__title">{t('resources.section.analysis')}</h2>
          </div>
          <div className="services__grid resources__grid">
            {analysisTools.map(renderCard)}
          </div>
        </div>
      </section>

      <section className="section resources-page resources-page--alt">
        <div className="container">
          <div className="section__header">
            <span className="section__label">02</span>
            <h2 className="section__title">{t('resources.section.design')}</h2>
          </div>
          <div className="services__grid resources__grid">
            {designTools.map(renderCard)}
          </div>
        </div>
      </section>

      <section className="section cta-section">
        <div className="container cta-section__inner">
          <h2>{t('resources.cta.heading')}</h2>
          <p className="cta-section__desc">{t('resources.cta.desc')}</p>
          <Link href="/contact" className="btn btn--primary" data-magnetic>
            <span>{t('cta.contact')}</span>
            <span className="btn__arrow">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
