'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { MatFoundationCalculator } from '@/components/ttc/mat-foundation/MatFoundationCalculator';

export default function MatFoundationPage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">{t('resources.title')}</Link>
            <span>/</span>
            <span>Mat Foundation</span>
          </div>
          <span className="section__label">{t('resources.section.design')}</span>
          <h1 className="page-hero__title">Mat (Raft) Foundation — Conventional Rigid Method</h1>
          <p className="page-hero__subtitle">
            Rectangular mat foundations supporting N columns per ACI 318-25
            §13.3.4 and Wight & MacGregor 7e §15-7. Conventional rigid-method
            analysis: bilinear soil pressure from total load and eccentricity
            of the column resultant; per-column two-way (punching) shear at
            d/2 with auto-detected αs (interior/edge/corner). For rigorous
            plate-on-Winkler-foundation analysis with subgrade reaction
            (ks), export geometry to a dedicated finite-element foundation
            solver.
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <MatFoundationCalculator />
        </div>
      </section>
    </>
  );
}
