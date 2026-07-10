'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { CombinedFootingCalculator } from '@/components/ttc/combined-footing/CombinedFootingCalculator';

export default function CombinedFootingPage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">{t('resources.title')}</Link>
            <span>/</span>
            <span>Combined Footing</span>
          </div>
          <span className="section__label">{t('resources.section.design')}</span>
          <h1 className="page-hero__title">Combined Footing Design — Two Columns</h1>
          <p className="page-hero__subtitle">
            Rectangular combined footings supporting two columns per ACI 318-25
            §13.3.4 and Wight & MacGregor 7e §15-6. Computes the resultant of the
            column loads, sizes the footing for uniform soil pressure, runs a full
            beam analysis (BMD + SFD with two factored point loads + distributed
            soil reaction), then checks two-way shear at each column, one-way
            shear, longitudinal flexure (positive at cantilever / negative
            between columns), and transverse flexure under each column.
            Cross-validated against Wight Ex 15-5 within 3% on every quantity.
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <CombinedFootingCalculator />
        </div>
      </section>
    </>
  );
}
