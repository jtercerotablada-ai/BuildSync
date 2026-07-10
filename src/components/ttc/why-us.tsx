'use client';

import React from 'react';
import { useTranslation } from './language-provider';

const Ico = {
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6M9 8h2" />
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
  { i: Ico.shield, t: 'Resident safety first', d: 'Independent, evidence-based assessments that put life-safety ahead of everything — because that is exactly what these inspections exist to protect.' },
  { i: Ico.stamp, t: 'Signed by a Registered P.E.', d: 'Every recertification and milestone report is engineered and stamped by a licensed Professional Engineer — and accepted by building departments.' },
  { i: Ico.clock, t: 'Ahead of your deadline', d: 'We track your 40-year and SB-4-D deadlines and deliver on time, so your association never slips into non-compliance.' },
  { i: Ico.report, t: 'Reports you can defend', d: 'Clear, thorough documentation that holds up with owners, boards, insurers, and the county — no ambiguity, no filler.' },
];

const ES = [
  { i: Ico.shield, t: 'La seguridad primero', d: 'Evaluaciones independientes y basadas en evidencia que ponen la seguridad de vida por encima de todo — que es justo lo que estas inspecciones existen para proteger.' },
  { i: Ico.stamp, t: 'Firmado por un P.E. registrado', d: 'Cada informe de recertificación e inspección milestone es diseñado y sellado por un Ingeniero Profesional licenciado — y aceptado por los departamentos de construcción.' },
  { i: Ico.clock, t: 'Adelantados a tu plazo', d: 'Damos seguimiento a tus plazos de 40 años y SB-4-D y entregamos a tiempo, para que tu asociación nunca caiga en incumplimiento.' },
  { i: Ico.report, t: 'Informes que puedes defender', d: 'Documentación clara y completa que se sostiene ante propietarios, juntas, aseguradoras y el condado — sin ambigüedad, sin relleno.' },
];

export function WhyUs() {
  const { language } = useTranslation();
  const es = language === 'es';
  const items = es ? ES : EN;
  const label = es ? 'Por qué Tercero Tablada' : 'Why Tercero Tablada';
  const title = es ? 'Por qué confían en nosotros' : 'Why owners and associations trust us';
  const sub = es
    ? 'Las recertificaciones e inspecciones milestone son de alto riesgo y con plazos estrictos. Esto es lo que obtienes al trabajar con nosotros.'
    : 'Recertification and milestone inspections are high-stakes and deadline-bound. Here is what you get by working with us.';

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
