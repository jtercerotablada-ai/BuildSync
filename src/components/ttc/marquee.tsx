'use client';

import React from 'react';
import { useTranslation } from './language-provider';

// Honest partner TYPES (the firm collaborates with these) — not fabricated
// named clients. Swap in real client names here once available.
const PARTNERS: Record<string, string[]> = {
  en: [
    'ARCHITECTS',
    'REAL ESTATE DEVELOPERS',
    'GENERAL CONTRACTORS',
    'CONSTRUCTION MANAGERS',
    'DESIGN-BUILD FIRMS',
    'OWNERS & INVESTORS',
    'MEP ENGINEERS',
    'PUBLIC AGENCIES',
  ],
  es: [
    'ARQUITECTOS',
    'DESARROLLADORES INMOBILIARIOS',
    'CONTRATISTAS GENERALES',
    'GERENTES DE CONSTRUCCIÓN',
    'FIRMAS DISEÑO-CONSTRUCCIÓN',
    'PROPIETARIOS E INVERSORES',
    'INGENIEROS MEP',
    'AGENCIAS PÚBLICAS',
  ],
};

export function Marquee() {
  const { language } = useTranslation();
  const base = PARTNERS[language] ?? PARTNERS.en;
  const items = [...base, ...base];

  return (
    <div className="marquee">
      <div className="marquee__track">
        {items.map((item, i) => (
          <React.Fragment key={i}>
            <span>{item}</span>
            <span>{'·'}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
