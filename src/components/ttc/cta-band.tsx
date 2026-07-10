'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from './language-provider';

export function CtaBand() {
  const { language } = useTranslation();
  const es = language === 'es';
  const title = es ? 'Construyamos juntos.' : 'Let’s build together.';
  const sub = es
    ? 'Habla con un P.E. registrado sobre el diseño de concreto armado, tu recertificación o una inspección de seguridad — sin compromiso.'
    : 'Talk to a Registered P.E. about reinforced-concrete design, your recertification, or a building safety inspection — no obligation.';
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
