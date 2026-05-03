'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { BasePlateCalculator } from '@/components/ttc/baseplate/BasePlateCalculator';

export default function BasePlatePage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">{t('resources.title')}</Link>
            <span>/</span>
            <span>Base Plate Design</span>
          </div>
          <span className="section__label">{t('resources.section.design')}</span>
          <h1 className="page-hero__title">Base Plate Design</h1>
          <p className="page-hero__subtitle">
            Steel column base connections per AISC Design Guide 1, 3rd Edition (2024) +
            AISC 360-22 + ACI 318-25 Chapter 17 — bearing, plate flexion, anchor tension,
            concrete pullout & breakout, shear, weld design.
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <BasePlateCalculator />
        </div>
      </section>
    </>
  );
}
