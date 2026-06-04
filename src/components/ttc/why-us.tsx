'use client';

import React from 'react';
import { useTranslation } from './language-provider';

const Ico = {
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" />
    </svg>
  ),
  save: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M14.5 9.2c0-1.2-1.1-1.9-2.5-1.9s-2.5.7-2.5 1.9 1.1 1.7 2.5 1.7 2.5.6 2.5 1.9-1.1 1.9-2.5 1.9-2.5-.7-2.5-1.9" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  stamp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9.5 14.5l1.6 1.6 3.4-3.4" />
    </svg>
  ),
};

const EN = [
  { i: Ico.globe, t: 'Borderless by design', d: 'An international, fully bilingual team — structural engineering delivered seamlessly across borders and building codes.' },
  { i: Ico.save, t: 'Engineered to save you money', d: 'We optimize the structure from day one to cut material and construction cost — without ever compromising safety.' },
  { i: Ico.shield, t: 'No surprises in the field', d: 'Clashes are caught and resolved in the 3D model before construction — protecting your schedule and your budget.' },
  { i: Ico.stamp, t: 'Permit-ready, code-compliant', d: 'Every design is stamped by a Registered P.E. and built to current codes — ready to build.' },
];

const ES = [
  { i: Ico.globe, t: 'Ingeniería sin fronteras', d: 'Un equipo internacional y totalmente bilingüe — ingeniería estructural entregada sin fricción a través de fronteras y códigos.' },
  { i: Ico.save, t: 'Diseñado para ahorrarte dinero', d: 'Optimizamos la estructura desde el día uno para reducir el costo de material y construcción — sin comprometer la seguridad.' },
  { i: Ico.shield, t: 'Sin sorpresas en la obra', d: 'Detectamos y resolvemos conflictos en el modelo 3D antes de construir — protegiendo tu plazo y tu presupuesto.' },
  { i: Ico.stamp, t: 'Lista para permiso y según código', d: 'Cada diseño lleva el sello de un Ingeniero P.E. registrado y cumple los códigos vigentes — lista para construir.' },
];

export function WhyUs() {
  const { language } = useTranslation();
  const es = language === 'es';
  const items = es ? ES : EN;
  const label = es ? 'Por qué Tercero Tablada' : 'Why Tercero Tablada';
  const title = es ? 'Por qué trabajar con nosotros' : 'Why work with us';
  const sub = es
    ? 'Somos un equipo estructural enfocado y liderado por seniors — esto es lo que significa para tu proyecto.'
    : "We're a focused, senior-led structural team — here's what that means for your project.";

  return (
    <section className="why-us" id="why-us">
      <div className="pop-grid-lines" aria-hidden="true" />
      <div className="container">
        <div className="pop-process__head">
          <span className="pop-label">{label}</span>
          <h2 className="pop-process__title">{title}</h2>
          <p className="pop-process__sub">{sub}</p>
        </div>
        <div className="why-grid">
          {items.map((it, i) => (
            <div className="why-card" data-aos data-aos-delay={String((i % 4) * 90)} key={it.t}>
              <div className="why-card__icon">{it.i}</div>
              <h3 className="why-card__title">{it.t}</h3>
              <p className="why-card__desc">{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
