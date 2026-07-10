'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from './language-provider';

/**
 * Essence — a single, large serif statement of philosophy
 * (pattern: estructuramx.com "essence" section). One idea, lots of air.
 */
export function EssenceSection() {
  const { language } = useTranslation();
  const es = language === 'es';
  const reduce = useReducedMotion();

  const label = es ? 'Nuestra esencia' : 'Our essence';

  return (
    <section className="essence" aria-label={label}>
      <div className="container">
        <motion.div
          className="essence__inner"
          initial={reduce ? false : { opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -80px 0px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="section__label">{label}</span>
          <p className="essence__statement">
            {es ? (
              <>Un edificio es una <em>promesa</em> para quienes lo habitan. Diseñamos las estructuras que hacen esa promesa — e inspeccionamos las que deben cumplirla.</>
            ) : (
              <>A building is a <em>promise</em> to the people inside it. We design the structures that make that promise — and inspect the ones that must keep it.</>
            )}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
