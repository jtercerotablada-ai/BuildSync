'use client';

import React from 'react';
import { useTranslation } from './language-provider';

const STEPS_EN = [
  { n: '01', t: 'Assessment & Inspection', d: 'We visit the building, inspect the structure, and document existing conditions — a Phase 1 milestone walkthrough or a full recertification survey.' },
  { n: '02', t: 'Engineering Evaluation', d: 'We analyze the findings against the Florida Building Code and county requirements, then determine whether a Phase 2, testing, or repairs are needed.' },
  { n: '03', t: 'Report & Certification', d: 'We deliver a clear, defensible, P.E.-stamped report your association and the building department can rely on — on time.' },
  { n: '04', t: 'Restoration & Sign-Off', d: 'When repairs are required, we design the reinforced-concrete restoration and guide you through permitting to final compliance.' },
];

const STEPS_ES = [
  { n: '01', t: 'Evaluación e Inspección', d: 'Visitamos el edificio, inspeccionamos la estructura y documentamos las condiciones existentes — un recorrido milestone Fase 1 o un levantamiento completo de recertificación.' },
  { n: '02', t: 'Evaluación de Ingeniería', d: 'Analizamos los hallazgos según el Código de Construcción de Florida y los requisitos del condado, y determinamos si se necesita una Fase 2, pruebas o reparaciones.' },
  { n: '03', t: 'Informe y Certificación', d: 'Entregamos un informe claro, defendible y sellado por P.E. en el que tu asociación y el departamento de construcción pueden confiar — a tiempo.' },
  { n: '04', t: 'Restauración y Certificación Final', d: 'Cuando se requieren reparaciones, diseñamos la restauración de concreto reforzado y te guiamos por el permiso hasta el cumplimiento final.' },
];

export function ProcessSection() {
  const { language } = useTranslation();
  const es = language === 'es';
  const steps = es ? STEPS_ES : STEPS_EN;
  const label = es ? 'Cómo Trabajamos' : 'How We Work';
  const title = es ? 'De la inspección a la certificación' : 'From inspection to sign-off';
  const sub = es
    ? 'Un proceso claro y orientado a plazos que mantiene tu edificio seguro, en cumplimiento y sin violaciones.'
    : 'A clear, deadline-driven process that keeps your building safe, compliant, and clear of violations.';

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
