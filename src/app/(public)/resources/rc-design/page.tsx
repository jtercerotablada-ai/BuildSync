'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { RcCalculator } from '@/components/ttc/rc/RcCalculator';

export default function RcDesignPage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">{t('resources.title')}</Link>
            <span>/</span>
            <span>RC Design</span>
          </div>
          <span className="section__label">{t('resources.section.design')}</span>
          <h1 className="page-hero__title">RC Beam Design</h1>
          <p className="page-hero__subtitle">
            Reinforced concrete beam design per ACI 318-25 (SI units) — flexure
            (singly + doubly + T-beam), shear (Vc + Vs + max stirrup spacing),
            Branson deflection, and ACI §24.3 crack control. Validated against
            ACI 318-25 first-principles formulas (50/50 tests).
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <RcCalculator />
        </div>
      </section>
    </>
  );
}
