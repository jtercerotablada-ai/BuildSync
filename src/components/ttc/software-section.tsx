'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from './language-provider';

/**
 * Integrated Software — quiet logo band (pattern: estructuramx.com).
 * Grayscale logos that regain color on hover; tiny small-caps captions.
 * Logo sources: official brand assets (cype.com, Autodesk badge CDN,
 * Wikimedia Commons, buildingSMART's own repo/account).
 */

const TOOLS = [
  { src: '/ttc/img/software/cype.png', alt: 'CYPE', caption: 'CYPE' },
  { src: '/ttc/img/software/autodesk.svg', alt: 'Autodesk', caption: 'Autodesk' },
  { src: '/ttc/img/software/revit.svg', alt: 'Autodesk Revit', caption: 'Revit' },
  { src: '/ttc/img/software/navisworks.png', alt: 'Autodesk Navisworks', caption: 'Navisworks' },
  { src: '/ttc/img/software/bcf.svg', alt: 'BCF — BIM Collaboration Format', caption: 'BCF' },
  { src: '/ttc/img/software/buildingsmart.png', alt: 'buildingSMART International (IFC / openBIM)', caption: 'buildingSMART' },
];

export function SoftwareSection() {
  const { language } = useTranslation();
  const es = language === 'es';
  const reduce = useReducedMotion();

  const label = es ? 'Software Integrado' : 'Integrated Software';
  const sub = es
    ? 'Herramientas BIM y de análisis estructural con las que trabajamos.'
    : 'The BIM and structural-analysis tools we work in.';

  return (
    <section className="soft" aria-label={label}>
      <div className="container">
        <div className="soft__head">
          <span className="section__label">{label}</span>
          <p className="soft__sub">{sub}</p>
        </div>
        <div className="soft__grid">
          {TOOLS.map((t, i) => (
            <motion.figure
              key={t.caption}
              className="soft__item"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -40px 0px' }}
              transition={{ duration: 0.5, delay: reduce ? 0 : i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.src} alt={t.alt} className="soft__logo" />
              <figcaption className="soft__caption">{t.caption}</figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
