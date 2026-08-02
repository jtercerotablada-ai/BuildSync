'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';

/* ── motion helpers ──────────────────────────────────────────────────── */
const EASE = [0.16, 1, 0.3, 1] as const;

function Reveal({ children, delay = 0, y = 26, className, as = 'div' }: {
  children: React.ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'span';
}) {
  const reduce = useReducedMotion();
  const Comp = as === 'span' ? motion.span : motion.div;
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

/* ── data ────────────────────────────────────────────────────────────── */
const SERVICES = [
  { n: '01', t: 'Reinforced Concrete Design', d: 'New RC buildings — foundations, columns, beams, slabs and shear walls. ACI 318 / Florida Building Code, permit-ready and P.E.-stamped.' },
  { n: '02', t: 'Structural Design & Analysis', d: 'Complete gravity and lateral systems — seismic and wind — modelled, analysed and detailed for constructability.' },
  { n: '03', t: 'BIM / Methodology', d: 'Coordinated, traceable, constructible models. Interdisciplinary coordination and clash detection under ISO 19650.' },
  { n: '04', t: 'Building Recertification', d: '40-year and milestone recertification across Miami-Dade and Broward — structural assessment and stamped reporting.' },
  { n: '05', t: 'Building Safety Inspection', d: 'Milestone / SB-4-D structural inspections — condition evaluation, findings and remediation guidance.' },
  { n: '06', t: 'Peer Review & Due Diligence', d: 'Independent structural review, code check and constructability assessment for owners and design teams.' },
];

const BIM = [
  '3D structural modelling',
  'Interdisciplinary coordination',
  'Interference / clash detection',
  'Precise, constructible documentation',
  'ISO 19650 · LOD 300 / 400 / 500',
];

const CREDS = [
  { k: 'Registered', v: 'P.E. / S.E.' },
  { k: 'Standards', v: 'ACI 318 · FBC' },
  { k: 'Methodology', v: 'BIM · ISO 19650' },
  { k: 'Service area', v: 'Miami-Dade + Broward' },
];

const MARQUEE = ['Reinforced Concrete', 'Foundations', 'Columns', 'Beams', 'Slabs', 'Shear Walls', 'Seismic', 'Wind', 'BIM', 'Recertification', 'Milestone Inspection', 'Peer Review'];

/* ── page ────────────────────────────────────────────────────────────── */
export function HomeV2() {
  const reduce = useReducedMotion();
  return (
    <div className="v2-root">
      {/* ══ HERO ══ */}
      <section className="v2-hero">
        <HeroFrame />
        <div className="v2-shell">
          <div className="v2-hero__grid">
            <div className="v2-hero__main">
              <motion.p className="v2-kicker" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.1 }}>
                <span className="v2-kicker__dot" /> Structural Engineering — Miami, FL
              </motion.p>
              <h1 className="v2-hero__title">
                {['Structural engineering', 'for projects that'].map((line, i) => (
                  <span className="v2-line" key={i}>
                    <motion.span
                      initial={reduce ? false : { y: '110%' }}
                      animate={{ y: '0%' }}
                      transition={{ duration: 0.95, ease: EASE, delay: 0.15 + i * 0.11 }}
                    >{line}</motion.span>
                  </span>
                ))}
                <span className="v2-line">
                  <motion.span className="v2-accent"
                    initial={reduce ? false : { y: '110%' }}
                    animate={{ y: '0%' }}
                    transition={{ duration: 0.95, ease: EASE, delay: 0.37 }}
                  >define the skyline.</motion.span>
                </span>
              </h1>
              <Reveal delay={0.5} className="v2-hero__desc">
                Behind every great project is a structure that makes it possible. We engineer
                reinforced-concrete buildings, recertifications and building-safety inspections
                across South Florida — with BIM precision and Registered P.E. authority.
              </Reveal>
              <Reveal delay={0.6} className="v2-hero__cta">
                <Link href="/contact" className="v2-btn v2-btn--solid"><span>Request a Consultation</span><i>→</i></Link>
                <Link href="/services" className="v2-btn v2-btn--line"><span>Our Services</span></Link>
              </Reveal>
            </div>

            <motion.ul className="v2-hero__creds"
              initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.7 }}>
              {CREDS.map((c, i) => (
                <li key={c.k}><span className="v2-num">0{i + 1}</span><span className="v2-cred__k">{c.k}</span><span className="v2-cred__v">{c.v}</span></li>
              ))}
            </motion.ul>
          </div>
        </div>
        <div className="v2-hero__foot">
          <span className="v2-mono">Reinforced Concrete · BIM · Recertification · Safety Inspection</span>
          <span className="v2-scroll"><i />Scroll</span>
        </div>
      </section>

      {/* ══ 01 ESSENCE ══ */}
      <section className="v2-sec v2-essence" data-ghost="01">
        <div className="v2-shell">
          <Reveal className="v2-sec__head"><span className="v2-num">01</span><span className="v2-sec__label">Our essence</span></Reveal>
          <Reveal delay={0.05}>
            <p className="v2-statement">
              We treat structure as a responsibility that <em>outlives</em> the project.
            </p>
          </Reveal>
          <Reveal delay={0.12} className="v2-essence__body">
            Every engineering decision carries people, investment and time. We design with rigor and
            judgment so each structure performs today — and keeps performing long after the work is done.
          </Reveal>
        </div>
      </section>

      {/* ══ 02 SERVICES ══ */}
      <section className="v2-sec v2-services" data-ghost="02">
        <div className="v2-shell">
          <div className="v2-sec__top">
            <Reveal className="v2-sec__head"><span className="v2-num">02</span><span className="v2-sec__label">Services</span></Reveal>
            <Reveal delay={0.05}><h2 className="v2-h2">Structural solutions for<br />extraordinary projects.</h2></Reveal>
          </div>
          <ul className="v2-list">
            {SERVICES.map((s, i) => (
              <Reveal as="div" key={s.n} delay={i * 0.04}>
                <li className="v2-row">
                  <span className="v2-row__n v2-mono">{s.n}</span>
                  <span className="v2-row__t">{s.t}</span>
                  <span className="v2-row__d">{s.d}</span>
                  <span className="v2-row__a">→</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ══ 03 BIM ══ */}
      <section className="v2-sec v2-bim" data-ghost="03">
        <div className="v2-shell">
          <div className="v2-bim__grid">
            <div>
              <Reveal className="v2-sec__head"><span className="v2-num">03</span><span className="v2-sec__label">BIM / Digital methodology</span></Reveal>
              <Reveal delay={0.05}><h2 className="v2-h2 v2-h2--tight">BIM as the language of<br />structural precision.</h2></Reveal>
              <Reveal delay={0.12} className="v2-bim__desc">
                We turn structural design into coordinated, traceable, buildable information — model,
                documentation and technical criteria integrated from the earliest stages to cut
                uncertainty and raise the quality of the project.
              </Reveal>
            </div>
            <ul className="v2-bim__list">
              {BIM.map((b, i) => (
                <Reveal as="div" key={b} delay={i * 0.05}>
                  <li><span className="v2-num">0{i + 1}</span>{b}</li>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ══ marquee ══ */}
      <div className="v2-marquee" aria-hidden="true">
        <div className="v2-marquee__track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}<i>◆</i></span>)}
        </div>
      </div>

      {/* ══ 04 CREDENTIALS ══ */}
      <section className="v2-sec v2-creds" data-ghost="04">
        <div className="v2-shell">
          <Reveal className="v2-sec__head"><span className="v2-num">04</span><span className="v2-sec__label">Credentials</span></Reveal>
          <Reveal delay={0.05}><h2 className="v2-h2">Quality, integrity and<br />continuous advancement.</h2></Reveal>
          <div className="v2-creds__grid">
            {CREDS.map((c, i) => (
              <Reveal as="div" key={c.k} delay={i * 0.06}>
                <div className="v2-cred-card">
                  <span className="v2-num">0{i + 1}</span>
                  <span className="v2-cred-card__v">{c.v}</span>
                  <span className="v2-cred-card__k">{c.k}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 05 PRESENCE / CTA ══ */}
      <section className="v2-sec v2-cta" data-ghost="05">
        <div className="v2-shell">
          <Reveal className="v2-sec__head v2-sec__head--light"><span className="v2-num">05</span><span className="v2-sec__label">Presence</span></Reveal>
          <Reveal delay={0.05}>
            <h2 className="v2-cta__title">Miami-Dade &amp; Broward.<br /><span className="v2-accent">One standard.</span></h2>
          </Reveal>
          <Reveal delay={0.12} className="v2-cta__row">
            <p>Structural engineering that endures — engineered for safety, efficiency and code compliance,
              stamped by a Registered P.E.</p>
            <Link href="/contact" className="v2-btn v2-btn--solid v2-btn--lg"><span>Start a Consultation</span><i>→</i></Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

/* ── hero technical line-art that DRAWS ITSELF (replaces a photo) ─────── */
function HeroFrame() {
  const reduce = useReducedMotion();
  const bars = [176, 265, 354].flatMap((x) => [146, 360, 574].map((y) => ({ x, y })));
  const draw = (delay: number, dur = 1.1) => (reduce ? {} : {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { pathLength: { duration: dur, ease: EASE, delay }, opacity: { duration: 0.25, delay } },
  });
  return (
    <div className="v2-hero__art" aria-hidden="true">
      <svg viewBox="0 0 520 720" preserveAspectRatio="xMidYMid meet" className="v2-hero__svg">
        <defs>
          <pattern id="v2grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.12" />
          </pattern>
        </defs>
        <motion.rect width="520" height="720" fill="url(#v2grid)"
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9 }} />
        <g stroke="currentColor" fill="none" strokeWidth="1.1">
          <motion.rect x="150" y="120" width="230" height="480" strokeOpacity="0.55" {...draw(0.3, 1.3)} />
          <motion.rect x="176" y="146" width="178" height="428" strokeOpacity="0.35" strokeDasharray="5 4" {...draw(0.7, 1.1)} />
          {bars.map(({ x, y }, i) => (
            <motion.circle key={`${x}-${y}`} cx={x} cy={y} r="6.5" strokeOpacity="0.7" fill="currentColor" fillOpacity="0.12" {...draw(1.1 + i * 0.045, 0.5)} />
          ))}
          <motion.line x1="150" y1="640" x2="380" y2="640" strokeOpacity="0.5" {...draw(1.55, 0.6)} />
          <motion.line x1="150" y1="632" x2="150" y2="648" strokeOpacity="0.5" {...draw(1.65, 0.3)} />
          <motion.line x1="380" y1="632" x2="380" y2="648" strokeOpacity="0.5" {...draw(1.7, 0.3)} />
        </g>
        <motion.text x="150" y="672" className="v2-hero__svgtext"
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1.85 }}>
          SECTION · Ø16 @ 150 · f&apos;c 5,000 PSI
        </motion.text>
      </svg>
    </div>
  );
}
