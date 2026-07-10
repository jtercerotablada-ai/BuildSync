'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from './language-provider';

export function CtaBand() {
  const { language } = useTranslation();
  const es = language === 'es';
  const title = es ? '¿Tu edificio necesita recertificación?' : 'Is your building due for recertification?';
  const sub = es
    ? 'Habla con un P.E. registrado sobre tu recertificación de 40 años, inspección milestone o restauración de concreto — sin compromiso.'
    : 'Talk to a Registered P.E. about your 40-year recertification, milestone inspection, or concrete restoration — no obligation.';
  const btn = es ? 'Solicitar una inspección' : 'Request an inspection';

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
