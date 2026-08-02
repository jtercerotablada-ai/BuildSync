'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';

/* ── motion helper ───────────────────────────────────────────────────── */
const EASE = [0.16, 1, 0.3, 1] as const;

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
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── blueprint line-art glyphs (placeholders for forthcoming photos) ──── */
function GlyphTower() {
  const floors = [30, 42, 54, 66, 78, 90, 102, 114];
  return (
    <svg viewBox="0 0 200 150" className="v2-cap__svg" aria-hidden="true">
      <g stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="square">
        <rect x="80" y="18" width="40" height="114" />
        <line x1="100" y1="18" x2="100" y2="132" strokeOpacity="0.55" />
        {floors.map((y) => <line key={y} x1="80" y1={y} x2="120" y2={y} strokeOpacity="0.7" />)}
        <rect x="94" y="120" width="12" height="12" strokeOpacity="0.85" />
        <line x1="50" y1="132" x2="150" y2="132" strokeWidth="1.7" />
      </g>
    </svg>
  );
}

function GlyphCommercial() {
  const vx = [64, 88, 112, 136];
  const hy = [60, 78, 96];
  return (
    <svg viewBox="0 0 200 150" className="v2-cap__svg" aria-hidden="true">
      <g stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="square">
        <rect x="40" y="42" width="120" height="90" />
        {vx.map((x) => <line key={x} x1={x} y1="42" x2={x} y2="114" strokeOpacity="0.55" />)}
        {hy.map((y) => <line key={y} x1="40" y1={y} x2="160" y2={y} strokeOpacity="0.55" />)}
        <line x1="40" y1="114" x2="160" y2="114" strokeWidth="1.5" />
        <rect x="92" y="114" width="16" height="18" strokeOpacity="0.85" />
        <line x1="30" y1="132" x2="170" y2="132" strokeWidth="1.7" />
      </g>
    </svg>
  );
}

function GlyphFoundation() {
  const rebar = [72, 86, 100, 114, 128];
  const hatch = [50, 68, 86, 104, 122, 140, 158];
  return (
    <svg viewBox="0 0 200 150" className="v2-cap__svg" aria-hidden="true">
      <g stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="square">
        <rect x="86" y="34" width="28" height="46" strokeOpacity="0.75" />
        <rect x="62" y="80" width="76" height="18" />
        {rebar.map((x) => (
          <circle key={x} cx={x} cy="89" r="2.4" fill="currentColor" stroke="none" fillOpacity="0.7" />
        ))}
        <line x1="34" y1="98" x2="166" y2="98" strokeWidth="1.7" />
        {hatch.map((x) => <line key={x} x1={x} y1="98" x2={x - 8} y2="110" strokeOpacity="0.5" />)}
      </g>
    </svg>
  );
}

function GlyphRecert() {
  const floors = [50, 66, 82, 98, 114];
  return (
    <svg viewBox="0 0 200 150" className="v2-cap__svg" aria-hidden="true">
      <g stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="square">
        <rect x="38" y="34" width="58" height="98" />
        {floors.map((y) => <line key={y} x1="38" y1={y} x2="96" y2={y} strokeOpacity="0.5" />)}
        <line x1="67" y1="34" x2="67" y2="132" strokeOpacity="0.5" />
        <line x1="30" y1="132" x2="170" y2="132" strokeWidth="1.7" />
        <circle cx="130" cy="86" r="20" strokeWidth="1.6" />
        <line x1="144" y1="100" x2="157" y2="113" strokeWidth="2" strokeLinecap="round" />
        <polyline points="120,86 127,94 141,78" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function GlyphPeer() {
  const lines = [58, 70, 82];
  return (
    <svg viewBox="0 0 200 150" className="v2-cap__svg" aria-hidden="true">
      <g stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="square">
        <rect x="66" y="30" width="70" height="92" strokeOpacity="0.5" />
        <rect x="52" y="42" width="70" height="92" fill="var(--paper)" />
        {lines.map((y) => <line key={y} x1="64" y1={y} x2="106" y2={y} strokeOpacity="0.55" />)}
        <polyline points="62,108 74,120 100,92" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function GlyphBim() {
  return (
    <svg viewBox="0 0 200 150" className="v2-cap__svg" aria-hidden="true">
      <g stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="60" y="58" width="62" height="62" />
        <path d="M60 58 L82 40 L144 40 L144 102 L122 120" />
        <line x1="122" y1="58" x2="144" y2="40" />
        <path d="M82 40 L82 102 L60 120" strokeOpacity="0.4" strokeDasharray="4 4" />
        <line x1="82" y1="102" x2="144" y2="102" strokeOpacity="0.4" strokeDasharray="4 4" />
        <line x1="60" y1="89" x2="122" y2="89" strokeOpacity="0.5" />
        <path d="M122 89 L144 71" strokeOpacity="0.5" />
      </g>
    </svg>
  );
}

/* ── data ────────────────────────────────────────────────────────────── */
const CAPS = [
  { n: '01', t: 'Residential Towers', d: 'High-rise reinforced-concrete structures — gravity and lateral systems for slender residential towers.', Glyph: GlyphTower },
  { n: '02', t: 'Commercial & Mixed-Use', d: 'Mid- and high-rise commercial, retail and mixed-use frames with long spans and transfer conditions.', Glyph: GlyphCommercial },
  { n: '03', t: 'Foundations & Slabs', d: 'Mats, spread and deep foundations, grade beams, and elevated or on-grade slab systems.', Glyph: GlyphFoundation },
  { n: '04', t: 'Recertification & Safety Inspection', d: '40-Year / milestone recertification and SB-4-D structural safety inspection with stamped reporting.', Glyph: GlyphRecert },
  { n: '05', t: 'Structural Peer Review', d: 'Independent code checks, design review and constructability assessment for owners and design teams.', Glyph: GlyphPeer },
  { n: '06', t: 'BIM Coordination', d: 'Coordinated, clash-checked structural models and constructible documentation under ISO 19650.', Glyph: GlyphBim },
];

const SCOPE = [
  { n: '01', t: 'New RC Buildings', d: 'Foundations, columns, beams, two-way and post-tensioned slabs and shear walls — ACI 318 / FBC, permit-ready and P.E.-stamped.' },
  { n: '02', t: 'Lateral & Gravity Systems', d: 'Complete wind and seismic analysis to ASCE 7, with load paths detailed for constructability.' },
  { n: '03', t: 'Foundations & Slabs', d: 'Shallow and deep foundations, mats and grade beams sized to the geotechnical report and site conditions.' },
  { n: '04', t: 'Recertification & Milestone', d: '40-Year / milestone recertification and SB-4-D safety inspection across Miami-Dade & Broward.' },
  { n: '05', t: 'Peer Review & Due Diligence', d: 'Independent structural review, code check and constructability assessment for owners and design teams.' },
  { n: '06', t: 'BIM / ISO 19650 Coordination', d: 'Coordinated, clash-checked models and constructible documentation — LOD 300 / 400 / 500.' },
];

/* ── page ────────────────────────────────────────────────────────────── */
export function ProjectsV2() {
  return (
    <div className="v2-root">
      {/* ══ HERO ══ */}
      <section className="v2-sec v2-phero">
        <div className="v2-shell">
          <Reveal>
            <p className="v2-kicker"><span className="v2-kicker__dot" /> Work / Capabilities</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="v2-phero__title">
              The frame behind<br />the <span className="v2-accent">project.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.12} className="v2-phero__sub">
            Our completed work is being documented for a photographed portfolio. Until it&apos;s ready,
            this page presents the practice as capabilities — the project types we engineer, and the
            scope behind each. Every tile below is built to receive a real project photograph as it publishes.
          </Reveal>
        </div>
      </section>

      {/* ══ 01 CAPABILITIES GRID ══ */}
      <section className="v2-sec">
        <div className="v2-shell">
          <div className="v2-sec__top">
            <Reveal className="v2-sec__head"><span className="v2-num">01</span><span className="v2-sec__label">Project types</span></Reveal>
            <Reveal delay={0.05}><h2 className="v2-h2">What we engineer,<br />by structure type.</h2></Reveal>
          </div>
          <div className="v2-caps">
            {CAPS.map((c, i) => (
              <Reveal key={c.n} delay={i * 0.05}>
                <article className="v2-cap">
                  <div className="v2-cap__frame">
                    <span className="v2-cap__tag v2-mono">Photo — Forthcoming</span>
                    <c.Glyph />
                  </div>
                  <div className="v2-cap__body">
                    <span className="v2-num">{c.n}</span>
                    <h3 className="v2-cap__t">{c.t}</h3>
                    <p className="v2-cap__d">{c.d}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 02 SCOPE & STANDARDS ══ */}
      <section className="v2-sec">
        <div className="v2-shell">
          <div className="v2-sec__top">
            <Reveal className="v2-sec__head"><span className="v2-num">02</span><span className="v2-sec__label">Scope &amp; standards</span></Reveal>
            <Reveal delay={0.05}><h2 className="v2-h2">The scope behind<br />every engagement.</h2></Reveal>
          </div>
          <ul className="v2-list">
            {SCOPE.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.04}>
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

      {/* ══ 03 CTA — dark bookend ══ */}
      <section className="v2-sec v2-cta">
        <div className="v2-shell">
          <Reveal className="v2-sec__head v2-sec__head--light"><span className="v2-num">03</span><span className="v2-sec__label">Start</span></Reveal>
          <Reveal delay={0.05}>
            <h2 className="v2-cta__title">Have a project<br />in <span className="v2-accent">South Florida?</span></h2>
          </Reveal>
          <Reveal delay={0.12} className="v2-cta__row">
            <p>Send the structure, scope and timeline. We&apos;ll respond with an approach, the governing
              codes and a stamped path to permit — across Miami-Dade &amp; Broward.</p>
            <Link href="/contact" className="v2-btn v2-btn--solid v2-btn--lg"><span>Request a Consultation</span><i>→</i></Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

export default ProjectsV2;