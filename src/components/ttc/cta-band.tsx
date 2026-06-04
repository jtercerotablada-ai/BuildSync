'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from './language-provider';

export function CtaBand() {
  const { language } = useTranslation();
  const es = language === 'es';
  const title = es ? '¿Listo para construir con precisión?' : 'Ready to build with precision?';
  const sub = es
    ? 'Conversemos sobre tu próximo proyecto estructural — desde la consultoría en etapa de diseño hasta la construcción.'
    : 'Let’s talk about your next structural project — from early-design consulting through construction.';
  const btn = es ? 'Solicitar una consulta' : 'Request a consultation';

  return (
    <section className="cta-band" id="get-started">
      <div className="container">
        <div className="cta-band__inner" data-aos>
          <div className="cta-band__text">
            <h2 className="cta-band__title">{title}</h2>
            <p className="cta-band__sub">{sub}</p>
          </div>
          <Link href="/contact" className="btn btn--primary cta-band__btn" data-magnetic>
            <span>{btn}</span>
            <span className="btn__arrow">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
