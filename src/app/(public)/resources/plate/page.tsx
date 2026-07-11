'use client';

import React from 'react';
import Link from 'next/link';
import { AiscPlateCalculator } from '@/components/ttc/steel/AiscPlateCalculator';

export default function AiscPlatePage() {
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">Engineering Tools</Link>
            <span>/</span>
            <span>Steel Plate Design</span>
          </div>
          <span className="section__label">Design Software</span>
          <h1 className="page-hero__title">Steel Plate Design</h1>
          <p className="page-hero__subtitle">
            Minor-axis bending and shear capacity of flat plates and rectangular bars per AISC 360-22 (LRFD).
            Set the plate width, thickness and grade, and read the flexural strength (Section F11 — yielding, with
            major-axis lateral-torsional buckling) and shear strength (Section J4.2 — yielding and rupture), with
            utilisations and the governing limit state. US units (kips, kip·ft, ksi, in).
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <AiscPlateCalculator />
        </div>
      </section>
    </>
  );
}
