'use client';

import React from 'react';
import Link from 'next/link';
import { FlexureCalculator } from '@/components/ttc/flexure/FlexureCalculator';

export default function FlexurePage() {
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">Engineering Tools</Link>
            <span>/</span>
            <span>Flexure</span>
          </div>
          <span className="section__label">DESIGN SOFTWARE</span>
          <h1 className="page-hero__title">Flexural Design &amp; Analysis</h1>
          <p className="page-hero__subtitle">
            Singly-reinforced rectangular sections per ACI 318-25. Design the steel from a
            given Mu, or check the capacity φMn of a placed section — with cross-section and
            strain diagrams. Metric units (m, MPa, kN·m, cm²).
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <FlexureCalculator />
        </div>
      </section>
    </>
  );
}
