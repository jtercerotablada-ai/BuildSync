'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { FoundationCalculator } from '@/components/ttc/footing/FoundationCalculator';

export default function FoundationDesignPage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">{t('resources.title')}</Link>
            <span>/</span>
            <span>Foundation Design</span>
          </div>
          <span className="section__label">{t('resources.section.design')}</span>
          <h1 className="page-hero__title">Foundation Design — Spread Footings</h1>
          <p className="page-hero__subtitle">
            Isolated rectangular and circular spread footings per ACI 318-25 (SI Units).
            Service-load bearing (§13.3.1), one-way shear (§22.5.5.1(a)), two-way
            punching (§22.6 + Table 22.6.5.2), flexure at face of column
            (§13.3.3), bearing at column-footing interface (§22.8), overturning +
            sliding stability, bar fit/spacing, and development length with hooks.
            Auto-design driver sizes B, L, T and selects rebar to satisfy all
            checks. Validated against Wight & MacGregor 7e Ch 15 and ACI SP-17.
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <FoundationCalculator />
        </div>
      </section>
    </>
  );
}
