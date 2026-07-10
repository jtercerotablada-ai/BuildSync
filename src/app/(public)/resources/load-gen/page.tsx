'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { LoadGenerator } from '@/components/ttc/load-gen/LoadGenerator';

export default function LoadGenPage() {
  const { t } = useTranslation();

  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">{t('resources.title')}</Link>
            <span>/</span>
            <span>{t('tool.loadGen')}</span>
          </div>
          <span className="section__label">{t('resources.section.design')}</span>
          <h1 className="page-hero__title">{t('tool.loadGen')}</h1>
          <p className="page-hero__subtitle">{t('tool.loadGen.desc')}</p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <LoadGenerator />
        </div>
      </section>
    </>
  );
}
