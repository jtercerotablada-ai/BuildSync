'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { RetainingWallCalculator } from '@/components/ttc/retaining-wall/RetainingWallCalculator';

export default function RetainingWallPage() {
  const { t } = useTranslation();

  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">{t('resources.title')}</Link>
            <span>/</span>
            <span>{t('tool.retaining')}</span>
          </div>
          <span className="section__label">{t('resources.section.design')}</span>
          <h1 className="page-hero__title">{t('tool.retaining')}</h1>
          <p className="page-hero__subtitle">{t('tool.retaining.desc')}</p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <RetainingWallCalculator />
        </div>
      </section>
    </>
  );
}
