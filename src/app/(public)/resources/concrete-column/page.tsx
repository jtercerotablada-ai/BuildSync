'use client';

import React from 'react';
import Link from 'next/link';
import { ColumnCalculator } from '@/components/ttc/concrete/ColumnCalculator';

export default function ConcreteColumnPage() {
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">Engineering Tools</Link>
            <span>/</span>
            <span>Concrete Column Design</span>
          </div>
          <span className="section__label">Design Software</span>
          <h1 className="page-hero__title">Concrete Column Design</h1>
          <p className="page-hero__subtitle">
            Reinforced concrete columns per ACI 318-19 — rectangular tied and circular spiral sections under axial
            load with uniaxial or biaxial bending. Full P-M interaction by strain compatibility, Bresler reciprocal
            and PCA load-contour biaxial checks, non-sway slenderness magnification (§6.6.4) and detailing limits —
            with the interaction diagram and demand point. US units (kips, kip·ft, psi, in).
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <ColumnCalculator />
        </div>
      </section>
    </>
  );
}
