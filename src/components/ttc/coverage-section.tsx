'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from './language-provider';

/**
 * Service Area — the official Miami-Dade municipality list where the firm
 * offers building recertification, rendered as a numbered editorial grid
 * (also strong local-SEO signal). "Islandia" from the county's original
 * numbering is omitted — the municipality was dissolved in 2012.
 */

const MUNICIPALITIES = [
  'Miami',
  'Miami Beach',
  'Coral Gables',
  'Hialeah',
  'Miami Springs',
  'North Miami',
  'North Miami Beach',
  'Opa-locka',
  'South Miami',
  'Homestead',
  'Miami Shores',
  'Bal Harbour',
  'Bay Harbor Islands',
  'Surfside',
  'West Miami',
  'Florida City',
  'Biscayne Park',
  'El Portal',
  'Golden Beach',
  'Pinecrest',
  'Indian Creek',
  'Medley',
  'North Bay Village',
  'Key Biscayne',
  'Sweetwater',
  'Virginia Gardens',
  'Hialeah Gardens',
  'Aventura',
  'Unincorporated Miami-Dade County',
  'Sunny Isles Beach',
  'Miami Lakes',
  'Palmetto Bay',
  'Miami Gardens',
  'Doral',
  'Cutler Bay',
];

export function CoverageSection() {
  const { language } = useTranslation();
  const es = language === 'es';
  const reduce = useReducedMotion();

  const label = es ? 'Área de Servicio' : 'Service Area';
  const title = es ? (
    <>Recertificación en <em>todo</em> Miami-Dade.</>
  ) : (
    <>Recertification across <em>all</em> of Miami-Dade.</>
  );
  const sub = es
    ? 'Ofrecemos recertificación de edificios en cada municipio del condado — y inspecciones de seguridad (BSIP) en todo Broward.'
    : 'We provide building recertification in every municipality of the county — and building safety inspections (BSIP) across Broward.';

  return (
    <section className="coverage" aria-label={label}>
      <div className="container">
        <motion.div
          className="coverage__head"
          initial={reduce ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -60px 0px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="section__label">{label}</span>
          <h2 className="section__title">{title}</h2>
          <p className="coverage__sub">{sub}</p>
        </motion.div>

        <motion.ol
          className="coverage__grid"
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '0px 0px -60px 0px' }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          {MUNICIPALITIES.map((m, i) => (
            <li key={m} className="coverage__item">
              <span className="coverage__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="coverage__name">{m}</span>
            </li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
