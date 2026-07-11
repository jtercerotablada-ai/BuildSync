'use client';

import React from 'react';
import Link from 'next/link';
import { AiscChannelCalculator } from '@/components/ttc/steel/AiscChannelCalculator';

export default function AiscChannelPage() {
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">Engineering Tools</Link>
            <span>/</span>
            <span>Steel Channel Design</span>
          </div>
          <span className="section__label">Design Software</span>
          <h1 className="page-hero__title">Steel Channel Design</h1>
          <p className="page-hero__subtitle">
            Bending, shear and buckling checks for hot-rolled channel (C and MC) sections per AISC 360-16 (LRFD).
            Pick a channel and grade, set the unbraced length, Cb and factored demands, and read major/minor flexure
            with the channel c-factor, shear, flexural-torsional compression buckling, deflection and every governing
            limit state — with the design-moment vs unbraced-length curve. US units (kips, kip·ft, ksi, in).
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <AiscChannelCalculator />
        </div>
      </section>
    </>
  );
}
