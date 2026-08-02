'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';

/* ── motion helper ───────────────────────────────────────────────────── */
function Reveal({ children, delay = 0, className }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const r = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={r ? false : { opacity: 0, y: 26 }}
      whileInView={r ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── data ────────────────────────────────────────────────────────────── */
const CREDS: { k: string; v: string }[] = [
  { k: 'Registered', v: 'P.E. / S.E.' },
  { k: 'Design code', v: 'ACI 318 · FBC' },
  { k: 'Loads', v: 'ASCE 7 · Wind / Seismic' },
  { k: 'Methodology', v: 'BIM · ISO 19650' },
  { k: 'Service area', v: 'Miami-Dade + Broward' },
  { k: 'Deliverables', v: 'Permit-ready & stamped' },
];

const PRINCIPLES: { t: string; d: string }[] = [
  { t: 'Rigor', d: 'Every member is analyzed and checked against the governing code before it reaches a drawing.' },
  { t: 'Constructibility', d: 'Details that respect the field — buildable, sequenceable and clear to the contractor.' },
  { t: 'Coordination', d: 'Structure resolved against architecture and MEP early, so clashes are caught in the model — not on site.' },
  { t: 'Accountability', d: 'One Registered P.E. responsible for the analysis and the seal. No anonymous hand-offs.' },
  { t: 'Longevity', d: 'Designed for durability and service life, not just the first day of occupancy.' },
];

/* ── page ────────────────────────────────────────────────────────────── */
export function AboutV2() {
  return (
    <div className="v2-root">
      {/* ══ HERO ══ */}
      <section className="v2-sec v2-about-hero">
        <AboutHeroArt />
        <div className="v2-shell">
          <Reveal className="v2-about-hero__kick">
            <span className="v2-kicker"><span className="v2-kicker__dot" /> About</span>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="v2-statement">
              We treat structure as a responsibility that <em>outlives</em> the project.
            </p>
          </Reveal>
          <Reveal delay={0.12} className="v2-about-hero__lede">
            Tercero Tablada is a structural engineering practice serving Miami-Dade and Broward.
            Every drawing we release is analyzed, coordinated and sealed by a Registered P.E. —
            engineered to the Florida Building Code, and built to last.
          </Reveal>
          <Reveal delay={0.18} className="v2-about-hero__meta">
            <span className="v2-mono">Structural Engineering</span>
            <span className="v2-about-hero__sep" aria-hidden="true">/</span>
            <span className="v2-mono">P.E. Stamped</span>
            <span className="v2-about-hero__sep" aria-hidden="true">/</span>
            <span className="v2-mono">Miami-Dade &amp; Broward, FL</span>
          </Reveal>
        </div>
      </section>

      {/* ══ 01 APPROACH ══ */}
      <section className="v2-sec">
        <div className="v2-shell">
          <Reveal className="v2-sec__head">
            <span className="v2-num">01</span><span className="v2-sec__label">Approach</span>
          </Reveal>
          <div className="v2-approach__grid">
            <Reveal>
              <h2 className="v2-h2">Engineering,<br />reviewed line<br />by line.</h2>
            </Reveal>
            <Reveal delay={0.08} className="v2-approach__body">
              <p>
                We are a structural practice built around a single standard: work that a Registered
                Professional Engineer will personally analyze, coordinate and stamp. Nothing leaves the
                office on assumption.
              </p>
              <p>
                Our methodology is BIM-first. Structure is modeled, coordinated and documented as one
                connected source of truth — checked against <span className="v2-accent">ACI 318</span>,
                the <span className="v2-accent">Florida Building Code</span> and{' '}
                <span className="v2-accent">ASCE 7</span> loads — so the design that gets permitted is
                the design that gets built.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ 02 STANDARDS & CREDENTIALS ══ */}
      <section className="v2-sec v2-about-creds">
        <div className="v2-shell">
          <Reveal className="v2-sec__head">
            <span className="v2-num">02</span><span className="v2-sec__label">Standards &amp; credentials</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="v2-h2">Built to code.<br />Backed by a stamp.</h2>
          </Reveal>
          <div className="v2-creds__grid">
            {CREDS.map((c, i) => (
              <Reveal key={c.k} delay={i * 0.05}>
                <div className="v2-cred-card">
                  <span className="v2-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="v2-cred-card__v">{c.v}</span>
                  <span className="v2-cred-card__k">{c.k}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 03 PRINCIPLES ══ */}
      <section className="v2-sec">
        <div className="v2-shell">
          <div className="v2-sec__top">
            <Reveal className="v2-sec__head">
              <span className="v2-num">03</span><span className="v2-sec__label">Principles</span>
            </Reveal>
            <Reveal delay={0.05}><h2 className="v2-h2">How we hold the line.</h2></Reveal>
          </div>
          <ul className="v2-list">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.t} delay={i * 0.04}>
                <li className="v2-row v2-row--static">
                  <span className="v2-row__n v2-mono">{String(i + 1).padStart(2, '0')}</span>
                  <span className="v2-row__t">{p.t}</span>
                  <span className="v2-row__d">{p.d}</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ══ 04 LEADERSHIP (placeholder — no fabricated bio) ══ */}
      <section className="v2-sec">
        <div className="v2-shell">
          <Reveal className="v2-sec__head">
            <span className="v2-num">04</span><span className="v2-sec__label">Leadership</span>
          </Reveal>
          <Reveal delay={0.05} className="v2-founder">
            <div className="v2-founder__frame" aria-hidden="true">
              <FounderMark />
            </div>
            <div className="v2-founder__body">
              <p className="v2-founder__lead">
                The practice is led by a Florida-registered Professional Engineer, personally responsible
                for the structural analysis and the seal on every project we deliver.
              </p>
              <p className="v2-founder__note v2-mono">Registered P.E. · Profile forthcoming</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ 05 CTA ══ */}
      <section className="v2-sec v2-cta">
        <div className="v2-shell">
          <Reveal className="v2-sec__head v2-sec__head--light">
            <span className="v2-num">05</span><span className="v2-sec__label">Start</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="v2-cta__title">Bring us in early.<br /><span className="v2-accent">We&apos;ll carry the load.</span></h2>
          </Reveal>
          <Reveal delay={0.12} className="v2-cta__row">
            <p>Tell us about the project. We&apos;ll scope the structural work and start the analysis —
              coordinated in BIM and stamped by a Registered P.E.</p>
            <Link href="/contact" className="v2-btn v2-btn--solid v2-btn--lg"><span>Request a Consultation</span><i>→</i></Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

/* ── hero line-art accent (blueprint, no photo) ──────────────────────── */
function AboutHeroArt() {
  return (
    <div className="v2-about-hero__art" aria-hidden="true">
      <svg viewBox="0 0 420 620" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="v2about-grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0H0V44" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.14" />
          </pattern>
        </defs>
        <rect width="420" height="620" fill="url(#v2about-grid)" />
        {/* stacked framing elevation — beams over columns */}
        <g stroke="currentColor" fill="none" strokeWidth="1.1" strokeOpacity="0.6">
          {[110, 250, 390, 530].map((y) => (
            <line key={y} x1="70" y1={y} x2="360" y2={y} />
          ))}
          {[110, 235, 360].map((x) => (
            <line key={x} x1={x} y1="90" x2={x} y2="552" />
          ))}
        </g>
        {/* node markers at intersections */}
        <g fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1">
          {[110, 250, 390, 530].flatMap((y) =>
            [110, 235, 360].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" />)
          )}
        </g>
        <text x="70" y="590" className="v2-about-hero__svgtext">FRAME · GRID A–C · TYP.</text>
      </svg>
    </div>
  );
}

/* ── leadership placeholder monogram (drafting frame) ────────────────── */
function FounderMark() {
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
      <rect x="12" y="12" width="176" height="176" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      {/* corner ticks */}
      <g stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.2">
        <path d="M12 32V12H32M188 32V12H168M12 168V188H32M188 168V188H168" fill="none" />
      </g>
      <line x1="12" y1="100" x2="188" y2="100" stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.75" />
      <line x1="100" y1="12" x2="100" y2="188" stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.75" />
      <text x="100" y="112" textAnchor="middle" className="v2-founder__mark-t">P.E.</text>
    </svg>
  );
}