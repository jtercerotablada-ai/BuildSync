'use client';

import React from 'react';
import Link from 'next/link';
import { AngleDesignCalculator } from '@/components/ttc/steel/AngleDesignCalculator';

export default function SteelAnglePage() {
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">Engineering Tools</Link>
            <span>/</span>
            <span>Steel Angle Design</span>
          </div>
          <span className="section__label">Design Software</span>
          <h1 className="page-hero__title">Steel Angle Design</h1>
          <p className="page-hero__subtitle">
            Tension, compression and flexural capacity of single (L) and double (2L) hot-rolled angles per
            AISC 360-16 (LRFD). Pick a shape and grade, set the connection, effective lengths and demands,
            and read every limit-state resistance, utilisation and governing clause — including single-angle
            E5 effective slenderness and F10 flexure about the principal axes. Imperial units (kips, ksi, in).
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <AngleDesignCalculator />
        </div>
      </section>
    </>
  );
}
