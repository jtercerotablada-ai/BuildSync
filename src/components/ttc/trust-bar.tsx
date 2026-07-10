'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from './language-provider';

/**
 * Honest trust band — credentials we actually hold and the audiences we
 * serve. Replaces the placeholder project gallery on the home page so the
 * site leads with authority, not fabricated case studies.
 */

const CREDENTIALS_EN = [
  'Registered P.E.',
  'ACI 318 Concrete Design',
  'Miami-Dade & Broward',
  'Florida SB-4-D / BSIP',
];
const CREDENTIALS_ES = [
  'P.E. Registrado',
  'Diseño de Concreto ACI 318',
  'Miami-Dade y Broward',
  'SB-4-D / BSIP Florida',
];

const AUDIENCE_EN = ['Developers & Owners', 'Condominium Associations', 'HOAs', 'Property Managers'];
const AUDIENCE_ES = ['Desarrolladores y Propietarios', 'Asociaciones de Condominios', 'HOAs', 'Administradores'];

export function TrustBar() {
  const { language } = useTranslation();
  const es = language === 'es';
  const reduce = useReducedMotion();
  const creds = es ? CREDENTIALS_ES : CREDENTIALS_EN;
  const audience = es ? AUDIENCE_ES : AUDIENCE_EN;
  const label = es ? 'Quiénes confían en nosotros' : 'Who we work with';

  return (
    <section className="trustbar" aria-label={label}>
      <div className="container">
        <motion.ul
          className="trustbar__creds"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -40px 0px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {creds.map((c) => (
            <li key={c} className="trustbar__cred">
              <span className="trustbar__dot" aria-hidden="true" />
              {c}
            </li>
          ))}
        </motion.ul>

        <div className="trustbar__audience">
          <span className="trustbar__audience-label">{label}</span>
          <div className="trustbar__audience-list">
            {audience.map((a) => (
              <span key={a} className="trustbar__pill">{a}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
