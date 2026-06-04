'use client';

import React from 'react';
import { useTranslation } from './language-provider';

const STEPS_EN = [
  { n: '01', t: 'Consultation & Value Engineering', d: 'We align the engineering with your budget from day one — cutting cost and risk before a single line is drawn.' },
  { n: '02', t: 'Design + BIM Modeling', d: 'Complete structural design in BIM (LOD 300), coordinated precisely with architecture and MEP.' },
  { n: '03', t: 'Coordination & Clash Detection', d: 'We catch and resolve conflicts between trades inside the model — never in the field.' },
  { n: '04', t: 'Delivery & Site Support', d: 'Construction documents, post-tension stressing, and on-site support through to completion.' },
];

const STEPS_ES = [
  { n: '01', t: 'Consultoría e Ingeniería de Valor', d: 'Alineamos la ingeniería con tu presupuesto desde el día uno — reduciendo costo y riesgo antes de dibujar una sola línea.' },
  { n: '02', t: 'Diseño + Modelado BIM', d: 'Diseño estructural completo en BIM (LOD 300), coordinado con precisión con arquitectura y MEP.' },
  { n: '03', t: 'Coordinación y Detección de Conflictos', d: 'Detectamos y resolvemos conflictos entre disciplinas dentro del modelo — nunca en la obra.' },
  { n: '04', t: 'Entrega y Soporte en Obra', d: 'Documentación de construcción, tensado de postensado y soporte en sitio hasta la finalización.' },
];

export function ProcessSection() {
  const { language } = useTranslation();
  const es = language === 'es';
  const steps = es ? STEPS_ES : STEPS_EN;
  const label = es ? 'Cómo Trabajamos' : 'How We Work';
  const title = es ? 'Del concepto a la entrega' : 'From concept to completion';
  const sub = es
    ? 'Un proceso disciplinado y transparente que mantiene tu proyecto en presupuesto, en plazo y sin conflictos en obra.'
    : 'A disciplined, transparent process that keeps your project on budget, on schedule, and conflict-free on site.';

  return (
    <section className="pop-process" id="process">
      <div className="pop-grid-lines" aria-hidden="true" />
      <div className="container">
        <div className="pop-process__head">
          <span className="pop-label">{label}</span>
          <h2 className="pop-process__title">{title}</h2>
          <p className="pop-process__sub">{sub}</p>
        </div>
        <div className="pop-steps">
          {steps.map((s, i) => (
            <div className="pop-step" data-aos data-aos-delay={String((i % 4) * 90)} key={s.n}>
              <div className="pop-step__num">{s.n}</div>
              <div className="pop-step__bar" aria-hidden="true" />
              <h3 className="pop-step__title">{s.t}</h3>
              <p className="pop-step__desc">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
