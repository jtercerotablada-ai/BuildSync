'use client';

import React from 'react';
import Link from 'next/link';
import { ShearWallCalculator } from '@/components/ttc/concrete/ShearWallCalculator';

export default function ShearWallPage() {
  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">Engineering Tools</Link>
            <span>/</span>
            <span>Concrete Shear Wall Design</span>
          </div>
          <span className="section__label">Design Software</span>
          <h1 className="page-hero__title">Concrete Shear Wall Design</h1>
          <p className="page-hero__subtitle">
            Reinforced concrete structural walls per ACI 318-19. In-plane shear (§11.5.4), axial-flexure P-M
            interaction by strain compatibility, minimum reinforcement and detailing (§11.6/§11.7), simplified
            axial strength (§11.5.3) and special boundary-element triggers (§18.10.6) — with the full interaction
            diagram and demand point. US units (kips, kip·ft, psi, in).
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <ShearWallCalculator />
        </div>
      </section>
    </>
  );
}
