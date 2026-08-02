'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

/* ── motion helper ───────────────────────────────────────────────────── */
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
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

/* ── line-art diagrams (inline SVG — no photos) ──────────────────────── */
const SVG = 'v2-svc__svg';

const RebarArt: React.FC = () => (
  <svg viewBox="0 0 440 320" fill="none" stroke="currentColor" className={SVG} aria-hidden="true">
    {/* concrete outline */}
    <rect x="150" y="34" width="140" height="252" strokeWidth="1.2" strokeOpacity="0.28" strokeDasharray="5 5" />
    {/* longitudinal bars */}
    {[168, 205, 235, 272].map((x) => (
      <line key={x} x1={x} y1="46" x2={x} y2="274" strokeWidth="1.4" strokeOpacity="0.65" />
    ))}
    {/* ties with hooks */}
    {[70, 112, 154, 196, 238].map((y) => (
      <g key={y} strokeWidth="1.2" strokeOpacity="0.42" strokeLinecap="round">
        <line x1="160" y1={y} x2="280" y2={y} />
        <path d={`M160 ${y} l7 -7 M280 ${y} l-7 -7`} />
      </g>
    ))}
    {/* bar section nodes (gold) */}
    {[168, 205, 235, 272].map((x) => (
      <circle key={`n${x}`} cx={x} cy="46" r="3.4" fill="var(--gold)" stroke="none" />
    ))}
    {/* dimension line (gold) */}
    <g stroke="var(--gold)" strokeWidth="1" strokeOpacity="0.9">
      <line x1="150" y1="300" x2="290" y2="300" />
      <line x1="150" y1="294" x2="150" y2="306" />
      <line x1="290" y1="294" x2="290" y2="306" />
    </g>
  </svg>
);

const FrameArt: React.FC = () => (
  <svg viewBox="0 0 440 320" fill="none" stroke="currentColor" className={SVG} aria-hidden="true">
    {/* deflected shape (sway) */}
    <path d="M120 278 C 128 210, 132 150, 148 92" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="4 5" />
    {/* portal frame */}
    <g strokeWidth="2" strokeOpacity="0.7">
      <line x1="120" y1="90" x2="320" y2="90" />
      <line x1="120" y1="90" x2="120" y2="278" />
      <line x1="320" y1="90" x2="320" y2="278" />
    </g>
    {/* moment haunches */}
    <path d="M120 116 L146 90 M320 116 L294 90" strokeWidth="1.2" strokeOpacity="0.5" />
    {/* fixed bases */}
    {[120, 320].map((x) => (
      <g key={x} strokeWidth="1.2" strokeOpacity="0.5">
        <line x1={x - 24} y1="278" x2={x + 24} y2="278" />
        {[-18, -9, 0, 9, 18].map((o) => (
          <line key={o} x1={x + o} y1="278" x2={x + o - 9} y2="291" />
        ))}
      </g>
    ))}
    {/* lateral load arrow (gold) */}
    <g stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round">
      <line x1="64" y1="90" x2="110" y2="90" />
      <path d="M101 83 L110 90 L101 97" fill="none" />
    </g>
    {/* joint nodes (gold) */}
    <circle cx="120" cy="90" r="3.6" fill="var(--gold)" stroke="none" />
    <circle cx="320" cy="90" r="3.6" fill="var(--gold)" stroke="none" />
  </svg>
);

const BimArt: React.FC = () => (
  <svg viewBox="0 0 440 320" fill="none" stroke="currentColor" className={SVG} aria-hidden="true">
    {/* wireframe volume */}
    <g strokeWidth="1.3" strokeOpacity="0.55">
      <rect x="140" y="120" width="150" height="150" />
      <path d="M140 120 l44 -40 M290 120 l44 -40 M290 270 l44 -40" />
      <path d="M184 80 h150 v150" strokeOpacity="0.4" />
    </g>
    {/* crossing members (beam + duct) */}
    <line x1="140" y1="270" x2="334" y2="80" strokeWidth="1.5" strokeOpacity="0.7" />
    <line x1="140" y1="120" x2="334" y2="230" strokeWidth="1.4" strokeOpacity="0.5" strokeDasharray="5 4" />
    {/* clash node (gold) */}
    <g stroke="var(--gold)" strokeWidth="1.6">
      <circle cx="237" cy="175" r="11" fill="none" />
      {[0, 45, 90, 135].map((a) => {
        const t = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={237 + 15 * Math.cos(t)}
            y1={175 + 15 * Math.sin(t)}
            x2={237 + 21 * Math.cos(t)}
            y2={175 + 21 * Math.sin(t)}
          />
        );
      })}
    </g>
    <circle cx="237" cy="175" r="3.2" fill="var(--gold)" stroke="none" />
  </svg>
);

const StampArt: React.FC = () => (
  <svg viewBox="0 0 440 320" fill="none" stroke="currentColor" className={SVG} aria-hidden="true">
    <g stroke="currentColor">
      <circle cx="220" cy="160" r="118" strokeWidth="1.6" strokeOpacity="0.5" />
      <circle cx="220" cy="160" r="96" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="3 5" />
      {Array.from({ length: 30 }).map((_, i) => {
        const t = (i / 30) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={220 + 110 * Math.cos(t)}
            y1={160 + 110 * Math.sin(t)}
            x2={220 + 102 * Math.cos(t)}
            y2={160 + 102 * Math.sin(t)}
            strokeWidth="1"
            strokeOpacity="0.4"
          />
        );
      })}
    </g>
    <text x="220" y="116" textAnchor="middle" className="v2-svc__stamp-t">STRUCTURAL</text>
    <text x="220" y="216" textAnchor="middle" className="v2-svc__stamp-t">40-YEAR RECERT</text>
    {/* verified check (gold) */}
    <path d="M198 160 l14 16 l32 -38" stroke="var(--gold)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClipboardArt: React.FC = () => (
  <svg viewBox="0 0 440 320" fill="none" stroke="currentColor" className={SVG} aria-hidden="true">
    {/* board + clip */}
    <g strokeWidth="1.4" strokeOpacity="0.55">
      <rect x="150" y="44" width="140" height="232" />
      <rect x="196" y="34" width="48" height="22" />
    </g>
    {/* checklist */}
    {[92, 126, 160, 194, 228].map((y, i) => {
      const done = i % 2 === 0;
      return (
        <g key={y}>
          <rect x="168" y={y} width="14" height="14" strokeWidth="1.2" strokeOpacity="0.5" />
          {done && (
            <path d={`M170 ${y + 7} l3.5 4 l7.5 -8.5`} stroke="var(--gold)" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
          <line x1="196" y1={y + 7} x2="272" y2={y + 7} strokeWidth="1.2" strokeOpacity={done ? 0.5 : 0.26} />
        </g>
      );
    })}
  </svg>
);

const LensArt: React.FC = () => (
  <svg viewBox="0 0 440 320" fill="none" stroke="currentColor" className={SVG} aria-hidden="true">
    {/* structural plan beneath */}
    <g strokeWidth="1" strokeOpacity="0.3">
      <rect x="110" y="64" width="220" height="184" />
      {[150, 190, 230, 270, 310].map((x) => (
        <line key={`v${x}`} x1={x} y1="64" x2={x} y2="248" />
      ))}
      {[104, 144, 184, 224].map((y) => (
        <line key={`h${y}`} x1="110" y1={y} x2="330" y2={y} />
      ))}
      <line x1="110" y1="64" x2="330" y2="248" strokeOpacity="0.4" />
    </g>
    {/* highlighted detail inside the lens (a beam–column joint) */}
    <g strokeWidth="1.5" strokeOpacity="0.85">
      <line x1="234" y1="150" x2="234" y2="196" />
      <line x1="214" y1="172" x2="286" y2="172" />
      {[[224, 162], [244, 162], [224, 184], [244, 184]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" fill="var(--gold)" stroke="none" />
      ))}
    </g>
    {/* magnifier (gold) */}
    <circle cx="250" cy="170" r="52" fill="var(--gold)" fillOpacity="0.05" stroke="none" />
    <g stroke="var(--gold)" strokeWidth="2" fill="none" strokeLinecap="round">
      <circle cx="250" cy="170" r="52" />
      <line x1="288" y1="208" x2="322" y2="242" strokeWidth="4" />
    </g>
  </svg>
);

/* ── content ─────────────────────────────────────────────────────────── */
type Service = { n: string; t: string; d: string; std: string; Art: React.FC };

const SERVICES: Service[] = [
  {
    n: '01',
    t: 'Reinforced Concrete Design',
    d: 'Foundations, columns, beams, slabs and shear walls — engineered to ACI 318 and the Florida Building Code. Permit-ready drawings, P.E.-stamped.',
    std: 'ACI 318 · FBC',
    Art: RebarArt,
  },
  {
    n: '02',
    t: 'Structural Design & Analysis',
    d: 'Complete gravity and lateral systems — seismic and wind per ASCE 7 — modelled with ETABS / SAP2000-class analysis and detailed for constructability.',
    std: 'ASCE 7 · ETABS / SAP2000',
    Art: FrameArt,
  },
  {
    n: '03',
    t: 'BIM / ISO 19650 Coordination',
    d: 'A federated model with interdisciplinary clash detection at LOD 300–500 — coordinated, traceable, constructible documentation.',
    std: 'ISO 19650 · LOD 300–500',
    Art: BimArt,
  },
  {
    n: '04',
    t: 'Building Recertification',
    d: '40-Year and Milestone structural assessment across Miami-Dade and Broward — field evaluation and a stamped recertification report.',
    std: '40-YEAR · MILESTONE',
    Art: StampArt,
  },
  {
    n: '05',
    t: 'Building Safety Inspection',
    d: 'SB-4-D milestone inspection — structural condition evaluation, documented findings and clear remediation guidance.',
    std: 'SB-4-D · CONDITION',
    Art: ClipboardArt,
  },
  {
    n: '06',
    t: 'Peer Review & Due Diligence',
    d: 'Independent, line-by-line review of design and calculations — code check and constructability for owners and design teams.',
    std: 'INDEPENDENT · CODE CHECK',
    Art: LensArt,
  },
];

const STEPS = [
  { n: '01', t: 'Assess', d: 'Scope, loads, site and code path defined up front — no surprises downstream.' },
  { n: '02', t: 'Model', d: 'Gravity and lateral systems analysed against ASCE 7 demand.' },
  { n: '03', t: 'Detail', d: 'Constructible, permit-ready documentation to ACI 318 / FBC.' },
  { n: '04', t: 'Review', d: 'Independent QA and a P.E. stamp before anything leaves the office.' },
];

/* ── page ────────────────────────────────────────────────────────────── */
export default function ServicesV2() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const toggle = (i: number) => {
    setActive(i);
    setOpen((o) => (o === i ? null : i));
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(i);
    }
  };

  const ActiveArt = SERVICES[active].Art;

  return (
    <>
      {/* ══ HERO ══ */}
      <section className="v2-sec v2-svchero">
        <div className="v2-shell">
          <Reveal>
            <p className="v2-kicker"><span className="v2-kicker__dot" />SERVICES — ASCE 7 · ACI 318 · FBC · ISO 19650</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="v2-h2 v2-svchero__title">Structural solutions for <em>extraordinary</em> projects.</h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="v2-svchero__sub">
              Reinforced-concrete design, full structural analysis, BIM coordination, recertification and independent
              review — engineered to ACI 318 and the Florida Building Code, and stamped by a Registered Professional
              Engineer. One practice, from the first load path to the final signature.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══ 01 · SIGNATURE — list + sticky line-art preview ══ */}
      <section className="v2-sec v2-svc" data-ghost="01">
        <div className="v2-shell">
          <div className="v2-sec__top">
            <Reveal className="v2-sec__head"><span className="v2-num">01</span><span className="v2-sec__label">Capabilities</span></Reveal>
            <Reveal delay={0.05}><h2 className="v2-h2 v2-h2--tight">Six disciplines. One&nbsp;P.E.&nbsp;stamp.</h2></Reveal>
            <Reveal delay={0.1}>
              <p className="v2-svc__intro">
                From new reinforced-concrete design to milestone recertification and independent peer review —
                engineered, coordinated and stamped in-house.
              </p>
            </Reveal>
          </div>

          <div className="v2-svc__grid">
            {/* LEFT — hairline rows */}
            <div className="v2-svc__list">
              <ul className="v2-list">
                {SERVICES.map((s, i) => {
                  const Art = s.Art;
                  return (
                    <motion.li
                      key={s.n}
                      className={`v2-row v2-svc__row${active === i ? ' is-active' : ''}${open === i ? ' is-open' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-expanded={open === i}
                      aria-controls={`svc-acc-${i}`}
                      onMouseEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onClick={() => toggle(i)}
                      onKeyDown={(e) => onKey(e, i)}
                      initial={reduce ? false : { opacity: 0, y: 18 }}
                      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-60px' }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
                    >
                      <span className="v2-row__n v2-mono">{s.n}</span>
                      <span className="v2-row__t">{s.t}</span>
                      <span className="v2-row__d">{s.d}</span>
                      <span className="v2-row__a" aria-hidden="true">→</span>
                      <div className="v2-svc__acc" id={`svc-acc-${i}`}>
                        <div className="v2-svc__acc-inner">
                          <p className="v2-svc__acc-d">{s.d}</p>
                          <div className="v2-svc__panel">
                            <div className="v2-svc__stage"><div className="v2-svc__art"><Art /></div></div>
                            <div className="v2-svc__panel-foot">
                              <span className="v2-svc__foot-name">{s.t}</span>
                              <span className="v2-mono v2-svc__foot-std">{s.std}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </div>

            {/* RIGHT — sticky preview (decorative; hidden on mobile) */}
            <div className="v2-svc__preview" aria-hidden="true">
              <div className="v2-svc__sticky">
                <div className="v2-svc__panel-top">
                  <span className="v2-mono">Detail Preview</span>
                  <span className="v2-mono">{SERVICES[active].n} / 06</span>
                </div>
                <div className="v2-svc__stage">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={active}
                      className="v2-svc__art"
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
                      transition={{ duration: reduce ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <ActiveArt />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="v2-svc__panel-foot">
                  <span className="v2-svc__foot-name">{SERVICES[active].t}</span>
                  <span className="v2-mono v2-svc__foot-std">{SERVICES[active].std}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 02 · PROCESS ══ */}
      <section className="v2-sec v2-procsec" data-ghost="02">
        <div className="v2-shell">
          <div className="v2-sec__top">
            <Reveal className="v2-sec__head"><span className="v2-num">02</span><span className="v2-sec__label">Method</span></Reveal>
            <Reveal delay={0.05}><h2 className="v2-h2 v2-h2--tight">How a project moves through the office.</h2></Reveal>
            <Reveal delay={0.1}><p className="v2-mono v2-procsec__flow">Assess → Model → Detail → Review</p></Reveal>
          </div>
          <Reveal delay={0.05}>
            <div className="v2-proc__grid">
              {STEPS.map((s) => (
                <div className="v2-proc__step" key={s.n}>
                  <span className="v2-proc__n">{s.n}</span>
                  <h3 className="v2-proc__t">{s.t}</h3>
                  <p className="v2-proc__d">{s.d}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ 03 · CTA BOOKEND ══ */}
      <section className="v2-sec v2-cta">
        <div className="v2-shell">
          <Reveal className="v2-sec__head v2-sec__head--light"><span className="v2-num">03</span><span className="v2-sec__label">Engagement</span></Reveal>
          <Reveal delay={0.05}>
            <h2 className="v2-cta__title">Bring us in early.<br /><span className="v2-accent">Stamp with confidence.</span></h2>
          </Reveal>
          <Reveal delay={0.12} className="v2-cta__row">
            <p>
              Tell us the structure, the site and the code path. We&apos;ll scope the engineering and return
              permit-ready, P.E.-stamped documentation — reinforced concrete, recertification or independent review.
              Miami-Dade &amp; Broward, FL · info@tercerotablada.com
            </p>
            <Link href="/v2/contact" className="v2-btn v2-btn--solid v2-btn--lg"><span>Request a Consultation</span><i>→</i></Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}