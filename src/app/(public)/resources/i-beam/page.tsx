'use client';

import React from 'react';
import Link from 'next/link';
import { AiscBeamCalculator } from '@/components/ttc/steel/AiscBeamCalculator';

export default function AiscIBeamPage() {
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">Engineering Tools</Link>
            <span>/</span>
            <span>Steel I-Beam Design</span>
          </div>
          <span className="section__label">Design Software</span>
          <h1 className="page-hero__title">Steel I-Beam Design</h1>
          <p className="page-hero__subtitle">
            Flexure, shear, deflection and lateral-torsional buckling for hot-rolled I-sections per
            AISC 360-16 (LRFD). Pick a W or S shape and grade, set the unbraced length Lb, Cb and
            factored demands, and read every limit-state strength, utilisation and governing clause —
            with the design-moment vs unbraced-length curve. US units (kips, kip·ft, ksi, in).
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <AiscBeamCalculator />
        </div>
      </section>
    </>
  );
}
