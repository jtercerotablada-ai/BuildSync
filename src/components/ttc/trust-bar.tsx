'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from './language-provider';

/**
 * Credentials band — four hairline-divided columns on the dark strip
 * under the hero (pattern: estructuramx.com opening stats). Honest
 * credentials only; no fabricated memberships or client counts.
 */

const COLS_EN = [
  { v: 'P.E.', l: 'Registered Professional Engineer' },
  { v: '30+', l: 'Years combined experience' },
  { v: 'ACI 318 · FBC', l: 'The codes we engineer to' },
  { v: 'Miami-Dade · Broward', l: 'Recertification & BSIP coverage' },
];
const COLS_ES = [
  { v: 'P.E.', l: 'Ingeniero Profesional Registrado' },
  { v: '30+', l: 'Años de experiencia combinada' },
  { v: 'ACI 318 · FBC', l: 'Los códigos con los que diseñamos' },
  { v: 'Miami-Dade · Broward', l: 'Cobertura de recertificación y BSIP' },
];

export function TrustBar() {
  const { language } = useTranslation();
  const es = language === 'es';
  const reduce = useReducedMotion();
  const cols = es ? COLS_ES : COLS_EN;
  const label = es ? 'Credenciales' : 'Credentials';

  return (
    <section className="trustbar" aria-label={label}>
      <div className="container">
        <div className="trustbar__grid">
          {cols.map((c, i) => (
            <motion.div
              key={c.v}
              className="trustbar__col"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -40px 0px' }}
              transition={{ duration: 0.55, delay: reduce ? 0 : i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="trustbar__value">{c.v}</span>
              <span className="trustbar__label">{c.l}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
