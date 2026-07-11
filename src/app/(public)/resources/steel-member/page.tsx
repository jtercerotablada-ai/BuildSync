'use client';

import React from 'react';
import Link from 'next/link';
import { SteelMemberCalculator } from '@/components/ttc/steel/SteelMemberCalculator';

export default function SteelMemberPage() {
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">Engineering Tools</Link>
            <span>/</span>
            <span>Steel Member Design</span>
          </div>
          <span className="section__label">Design Software</span>
          <h1 className="page-hero__title">Steel Member Design</h1>
          <p className="page-hero__subtitle">
            Axial, bending, shear and combined-action checks for W, S, HSS and pipe sections per
            AISC 360-22 (LRFD). Pick a rolled shape and grade, set the effective lengths and
            factored demands, and read every limit-state capacity, utilisation and governing
            clause. Imperial units (kips, ksi, in, ft).
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <SteelMemberCalculator />
        </div>
      </section>
    </>
  );
}
