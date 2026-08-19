'use client';

import React from 'react';
import { useTranslation } from './language-provider';

const STEPS_EN = [
  { n: '01', t: 'Scope & Site Review', d: 'We review your project, gather the documents, and define the scope — the loads, the geometry, and what the structure has to carry.' },
  { n: '02', t: 'Engineering & Analysis', d: 'We design the structure against ACI 318 and the Florida Building Code, sizing every member with margin.' },
  { n: '03', t: 'Documentation & P.E. Seal', d: 'We deliver clear, code-compliant, P.E.-stamped drawings your building department can rely on — on time.' },
  { n: '04', t: 'Permitting & Sign-Off', d: 'We support you through permitting and approvals — answering plan-review comments until your permit is issued.' },
];

const STEPS_ES = [
  { n: '01', t: 'Alcance y Revisión de Sitio', d: 'Revisamos tu proyecto, reunimos los documentos y definimos el alcance — las cargas, la geometría y lo que la estructura debe soportar.' },
  { n: '02', t: 'Ingeniería y Análisis', d: 'Diseñamos la estructura según ACI 318 y el Código de Construcción de Florida, dimensionando cada elemento con margen.' },
  { n: '03', t: 'Documentación y Sello P.E.', d: 'Entregamos planos claros, en cumplimiento y sellados por P.E. en los que tu departamento de construcción puede confiar — a tiempo.' },
  { n: '04', t: 'Permiso y Aprobación', d: 'Te acompañamos en permisos y aprobaciones — respondiendo los comentarios de revisión hasta que se emita tu permiso.' },
];

export function ProcessSection() {
  const { language } = useTranslation();
  const es = language === 'es';
  const steps = es ? STEPS_ES : STEPS_EN;
  const label = es ? 'Cómo Trabajamos' : 'How We Work';
  const title = es ? 'De la primera revisión a la certificación final' : 'From first review to final sign-off';
  const sub = es
    ? 'Un proceso claro y orientado a plazos — ya sea que diseñemos tu edificio o certifiquemos su seguridad.'
    : 'A clear, deadline-driven process — whether we are designing your building or certifying its safety.';

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
