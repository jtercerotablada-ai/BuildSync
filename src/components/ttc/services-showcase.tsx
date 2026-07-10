'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from './language-provider';
import { SERVICES } from './services-data';

/**
 * The three core services, rendered as a premium 3-up feature grid.
 * Shared by the home page and /services. Framer Motion drives a subtle
 * staggered reveal; reduced-motion users get the static end state.
 */
export function ServicesShowcase({ withHeader = true }: { withHeader?: boolean }) {
  const { language } = useTranslation();
  const es = language === 'es';
  const reduce = useReducedMotion();

  const label = es ? 'Lo Que Hacemos' : 'What We Do';
  const title = es ? (
    <>Tres especialidades. Cero <em>improvisación</em>.</>
  ) : (
    <>Three specialties. Zero <em>guesswork</em>.</>
  );
  const sub = es
    ? 'Nos enfocamos en lo que mantiene los edificios seguros y en cumplimiento — y lo hacemos con la profundidad de un especialista, no de un generalista.'
    : 'We focus on what keeps buildings safe and compliant — and we do it with a specialist’s depth, not a generalist’s spread.';
  const cta = es ? 'Solicitar este servicio' : 'Request this service';

  return (
    <section className="section svc2" id="services">
      <div className="svc2__grid-lines" aria-hidden="true" />
      <div className="container">
        {withHeader && (
          <div className="svc2__head">
            <span className="section__label">{label}</span>
            <h2 className="section__title">{title}</h2>
            <p className="svc2__sub">{sub}</p>
          </div>
        )}

        <div className="svc2__grid">
          {SERVICES.map((s, i) => {
            const c = es ? s.es : s.en;
            return (
              <motion.article
                key={s.slug}
                className="svc2-card"
                initial={reduce ? false : { opacity: 0, y: 34 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -80px 0px' }}
                transition={{ duration: 0.6, delay: reduce ? 0 : i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="svc2-card__top">
                  <span className="svc2-card__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="svc2-card__icon" aria-hidden="true">{s.icon}</span>
                </div>
                <h3 className="svc2-card__title">{c.title}</h3>
                <p className="svc2-card__desc">{c.desc}</p>
                <ul className="svc2-card__tags">
                  {c.tags.map((tag) => (
                    <li key={tag} className="svc2-chip">{tag}</li>
                  ))}
                </ul>
                <Link href={`/contact?service=${s.slug}`} className="svc2-card__link">
                  <span>{cta}</span>
                  <span className="svc2-card__arrow" aria-hidden="true">→</span>
                </Link>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
