'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { BeamCalculator } from '@/components/ttc/beam/BeamCalculator';

export default function BeamToolPage() {
  const { t } = useTranslation();

  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">{t('resources.title')}</Link>
            <span>/</span>
            <span>{t('tool.beam')}</span>
          </div>
          <span className="section__label">{t('resources.section.analysis')}</span>
          <h1 className="page-hero__title">{t('tool.beam')}</h1>
          <p className="page-hero__subtitle">{t('tool.beam.desc')}</p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <BeamCalculator />
        </div>
      </section>
    </>
  );
}
