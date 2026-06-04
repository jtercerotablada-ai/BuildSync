'use client';

import React from 'react';
import { useTranslation } from './language-provider';

// Real design codes & standards from the firm's reference library — authentic
// technical authority (the engineering-firm equivalent of a client-logo wall).
const STANDARDS = [
  'ACI 318-25',
  'AISC 360-22',
  'ASCE 7-22',
  'IBC 2024',
  'NDS 2024',
  'TMS 402',
  'AASHTO LRFD',
  'PCI',
  'ASCE 41',
  'Eurocode 2',
];

export function StandardsBand() {
  const { language } = useTranslation();
  const es = language === 'es';
  const label = es ? 'Autoridad Técnica' : 'Technical Authority';
  const title = es
    ? 'Diseñamos según los códigos más exigentes del mundo'
    : 'Engineered to the world’s most demanding codes';
  const sub = es
    ? 'Cada proyecto cumple las últimas normas internacionales de concreto reforzado y post-tensado, acero, madera, mampostería y puentes.'
    : 'Every project meets the latest international codes for reinforced & post-tensioned concrete, steel, wood, masonry, and bridges.';

  return (
    <section className="section standards-band" id="standards">
      <div className="container">
        <div className="section__header">
          <span className="section__label">{label}</span>
          <h2 className="section__title">{title}</h2>
          <p className="section__subtitle">{sub}</p>
        </div>
        <div className="standards-grid" data-aos>
          {STANDARDS.map((s) => (
            <div className="standard-chip" key={s}>
              <span className="standard-chip__check" aria-hidden="true">✓</span>
              {s}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
