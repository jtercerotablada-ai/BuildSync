'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { AdvancedBeamCalculator } from '@/components/ttc/advanced-beam/AdvancedBeamCalculator';

export default function AdvancedBeamPage() {
  const { t } = useTranslation();

  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">{t('resources.title')}</Link>
            <span>/</span>
            <span>{t('tool.advancedBeam')}</span>
          </div>
          <span className="section__label">{t('resources.section.analysis')}</span>
          <h1 className="page-hero__title">{t('tool.advancedBeam')}</h1>
          <p className="page-hero__subtitle">{t('tool.advancedBeam.desc')}</p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <AdvancedBeamCalculator />
        </div>
      </section>
    </>
  );
}
