'use client';

import React from 'react';
import Link from 'next/link';
import { CsaBeamCalculator } from '@/components/ttc/steel/CsaBeamCalculator';

export default function CsaIBeamPage() {
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
            CSA S16-14 (Limit States Design). Pick a W or S shape and grade, set the unbraced length,
            ω₂ and factored demands, and read every limit-state resistance, utilisation and governing
            clause — with the moment-resistance vs unbraced-length curve. SI units (kN, kN·m, MPa, mm).
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <CsaBeamCalculator />
        </div>
      </section>
    </>
  );
}
