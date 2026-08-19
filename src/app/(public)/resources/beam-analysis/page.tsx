'use client';

import React from 'react';
import Link from 'next/link';
import { BeamAnalysisCalculator } from '@/components/ttc/beam/BeamAnalysisCalculator';

export default function BeamAnalysisPage() {
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">Engineering Tools</Link>
            <span>/</span>
            <span>Beam Analysis</span>
          </div>
          <span className="section__label">Analysis Software</span>
          <h1 className="page-hero__title">Beam Analysis</h1>
          <p className="page-hero__subtitle">
            Quick and accurate single-beam analysis with shear, moment and deflection diagrams. Direct-stiffness
            (FEM) Euler-Bernoulli solution for any support layout — simply supported, cantilever, propped, fixed,
            overhanging or multi-span — under point loads, distributed (trapezoidal) loads and applied moments.
            Reactions, envelopes and full diagrams, validated against closed-form beam solutions. US units.
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <BeamAnalysisCalculator />
        </div>
      </section>
    </>
  );
}
