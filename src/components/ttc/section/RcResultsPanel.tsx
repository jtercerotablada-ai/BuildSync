'use client';

import React, { useMemo, useState } from 'react';
import type { RcResults } from '@/lib/section/rc-types';
import { fromSI, unitLabel, type UnitSystem } from '@/lib/beam/units';

interface Props {
  results: RcResults;
  unitSystem: UnitSystem;
}

type View = 'summary' | 'mphi' | 'pm';

export function RcResultsPanel({ results, unitSystem }: Props) {
  const [view, setView] = useState<View>('summary');

  return (
    <div className="rc-results">
      <div className="seg rc-results__tabs" role="group" aria-label="RC view">
        <button
          type="button"
          className={view === 'summary' ? 'is-active' : ''}
          onClick={() => setView('summary')}
        >
          Summary
        </button>
        <button
          type="button"
          className={view === 'mphi' ? 'is-active' : ''}
          onClick={() => setView('mphi')}
        >
          M–φ
        </button>
        <button
          type="button"
          className={view === 'pm' ? 'is-active' : ''}
          onClick={() => setView('pm')}
        >
          P–M
        </button>
      </div>

      {view === 'summary' && <SummaryView results={results} unitSystem={unitSystem} />}
      {view === 'mphi' && <MomentCurvatureChart results={results} unitSystem={unitSystem} />}
      {view === 'pm' && <PMChart results={results} unitSystem={unitSystem} />}
    </div>
  );
}

/* ========================================================================= */
/* Summary                                                                   */
/* ========================================================================= */

function SummaryView({ results, unitSystem }: { results: RcResults; unitSystem: UnitSystem }) {
  const dimU = unitLabel('dimension', unitSystem);
  const areaU = unitLabel('A', unitSystem);
  const momU = unitLabel('moment', unitSystem);
  const forceU = unitLabel('force', unitSystem);
  const stressU = unitLabel('stress', unitSystem);
  const IU = unitLabel('I', unitSystem);

  const { gross, cracked, flexural, interaction } = results;

  return (
    <div className="rc-results__content">
      <Section title="Gross section">
        <Row label="Ag" value={gross.Ag} quantity="A" unit={areaU} unitSystem={unitSystem} />
        <Row label="Ig" value={gross.Ig} quantity="I" unit={IU} unitSystem={unitSystem} />
        <Row label="Mcr" value={gross.Mcr} quantity="moment" unit={momU} unitSystem={unitSystem} sci />
        <Row label="yt" value={gross.yt} quantity="dimension" unit={dimU} unitSystem={unitSystem} />
        <Row label="yb" value={gross.yb} quantity="dimension" unit={dimU} unitSystem={unitSystem} />
      </Section>

      {cracked && cracked.valid && (
        <Section title="Cracked (service)">
          <Row label="kd" value={cracked.kd} quantity="dimension" unit={dimU} unitSystem={unitSystem} />
          <Row label="Icr" value={cracked.Icr} quantity="I" unit={IU} unitSystem={unitSystem} />
          <PlainRow label="n = Es/Ec" value={cracked.n.toFixed(2)} />
        </Section>
      )}

      <Section title="Flexural capacity (ACI)">
        <Row label="c" value={flexural.c} quantity="dimension" unit={dimU} unitSystem={unitSystem} />
        <Row label="a" value={flexural.a} quantity="dimension" unit={dimU} unitSystem={unitSystem} />
        <Row label="Mn" value={flexural.Mn} quantity="moment" unit={momU} unitSystem={unitSystem} sci />
        <PlainRow label="φ" value={flexural.phi.toFixed(3)} />
        <Row label="φMn" value={flexural.phiMn} quantity="moment" unit={momU} unitSystem={unitSystem} sci />
        <PlainRow label="εt" value={flexural.epsT.toExponential(3)} />
        <PlainRow label="Control" value={flexural.tensionControlled ? 'Tension' : 'Compression/Transition'} />
      </Section>

      <Section title="Interaction diagram">
        <Row label="P0" value={interaction.P0} quantity="force" unit={forceU} unitSystem={unitSystem} sci />
        <Row
          label="φPmax"
          value={interaction.phiPmax}
          quantity="force"
          unit={forceU}
          unitSystem={unitSystem}
          sci
        />
        <Row
          label="Pure tension"
          value={interaction.pureTension}
          quantity="force"
          unit={forceU}
          unitSystem={unitSystem}
          sci
        />
        <Row
          label="Balance c"
          value={interaction.balancePoint.c}
          quantity="dimension"
          unit={dimU}
          unitSystem={unitSystem}
        />
        <Row
          label="Balance M"
          value={interaction.balancePoint.M}
          quantity="moment"
          unit={momU}
          unitSystem={unitSystem}
          sci
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rc-results__section">
      <div className="rc-results__section-title">{title}</div>
      <div className="rc-results__table">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  quantity,
  unit,
  unitSystem,
  sci = false,
}: {
  label: string;
  value: number;
  quantity: Parameters<typeof fromSI>[1];
  unit: string;
  unitSystem: UnitSystem;
  sci?: boolean;
}) {
  const converted = fromSI(value, quantity, unitSystem);
  const text = !isFinite(converted)
    ? '—'
    : sci
    ? converted.toExponential(3)
    : Math.abs(converted) > 9999 || (Math.abs(converted) < 0.01 && converted !== 0)
    ? converted.toExponential(3)
    : converted.toFixed(converted >= 100 ? 1 : 3);
  return (
    <div className="rc-results__row">
      <span className="rc-results__row-label">{label}</span>
      <span className="rc-results__row-value">
        {text} <span className="rc-results__row-unit">{unit}</span>
      </span>
    </div>
  );
}

function PlainRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rc-results__row">
      <span className="rc-results__row-label">{label}</span>
      <span className="rc-results__row-value">{value}</span>
    </div>
  );
}

/* ========================================================================= */
/* Moment-Curvature chart                                                    */
/* ========================================================================= */

function MomentCurvatureChart({
  results,
  unitSystem,
}: {
  results: RcResults;
  unitSystem: UnitSystem;
}) {
  const { momentCurvature, flexural } = results;
  const momU = unitLabel('moment', unitSystem);

  const { points, yieldPoint, ultimatePoint } = momentCurvature;

  const chart = useMemo(() => {
    if (points.length === 0) return null;
    const phiMax = Math.max(...points.map((p) => p.phi));
    const MMax = Math.max(...points.map((p) => p.M), flexural.Mn);
    const W = 400;
    const H = 260;
    const ml = 50;
    const mr = 16;
    const mt = 14;
    const mb = 36;
    const plotW = W - ml - mr;
    const plotH = H - mt - mb;

    const xs = (phi: number) => ml + (phi / phiMax) * plotW;
    const ys = (M: number) => mt + plotH - (M / MMax) * plotH;

    const path = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(p.phi).toFixed(2)} ${ys(p.M).toFixed(2)}`)
      .join(' ');

    const gridX = 4;
    const gridY = 4;

    return {
      W, H, ml, mr, mt, mb, plotW, plotH, xs, ys, path, phiMax, MMax, gridX, gridY,
    };
  }, [points, flexural.Mn]);

  if (!chart) {
    return <div className="rc-results__empty">M-φ not computed.</div>;
  }

  const { W, H, ml, mt, mb, plotW, plotH, xs, ys, path, phiMax, MMax, gridX, gridY } = chart;

  const momentScale = (MNmm: number) => fromSI(MNmm, 'moment', unitSystem);

  return (
    <div className="rc-results__content rc-results__chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="rc-results__chart"
        role="img"
        aria-label="Moment-curvature curve"
      >
        {/* Grid */}
        {Array.from({ length: gridX + 1 }).map((_, i) => {
          const x = ml + (i / gridX) * plotW;
          return <line key={`gx${i}`} x1={x} x2={x} y1={mt} y2={mt + plotH} stroke="rgba(255,255,255,0.06)" />;
        })}
        {Array.from({ length: gridY + 1 }).map((_, i) => {
          const y = mt + (i / gridY) * plotH;
          return <line key={`gy${i}`} x1={ml} x2={ml + plotW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />;
        })}

        {/* Axes */}
        <line x1={ml} x2={ml + plotW} y1={mt + plotH} y2={mt + plotH} stroke="rgba(242,239,228,0.55)" strokeWidth={1} />
        <line x1={ml} x2={ml} y1={mt} y2={mt + plotH} stroke="rgba(242,239,228,0.55)" strokeWidth={1} />

        {/* Axis labels */}
        {Array.from({ length: gridX + 1 }).map((_, i) => {
          const phi = (i / gridX) * phiMax;
          const x = ml + (i / gridX) * plotW;
          return (
            <text key={`xl${i}`} x={x} y={mt + plotH + 14} fontSize={10} textAnchor="middle" fill="rgba(242,239,228,0.65)">
              {phi.toExponential(1)}
            </text>
          );
        })}
        {Array.from({ length: gridY + 1 }).map((_, i) => {
          const M = (1 - i / gridY) * MMax;
          const y = mt + (i / gridY) * plotH;
          return (
            <text key={`yl${i}`} x={ml - 4} y={y + 3} fontSize={10} textAnchor="end" fill="rgba(242,239,228,0.65)">
              {momentScale(M).toExponential(1)}
            </text>
          );
        })}

        {/* Mn reference line */}
        <line
          x1={ml}
          x2={ml + plotW}
          y1={ys(flexural.Mn)}
          y2={ys(flexural.Mn)}
          stroke="#58a9ff"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        <text x={ml + plotW - 4} y={ys(flexural.Mn) - 3} fontSize={10} textAnchor="end" fill="#58a9ff">
          Mn
        </text>

        {/* Curve */}
        <path d={path} fill="none" stroke="#ff6b6b" strokeWidth={1.8} />

        {/* Yield point */}
        {yieldPoint && (
          <>
            <circle cx={xs(yieldPoint.phi)} cy={ys(yieldPoint.M)} r={4} fill="#3dd78d" />
            <text
              x={xs(yieldPoint.phi) + 6}
              y={ys(yieldPoint.M) - 6}
              fontSize={10}
              fill="#3dd78d"
            >
              Yield
            </text>
          </>
        )}

        {/* Ultimate point */}
        {ultimatePoint && (
          <>
            <circle cx={xs(ultimatePoint.phi)} cy={ys(ultimatePoint.M)} r={4} fill="#ff6b6b" />
            <text
              x={xs(ultimatePoint.phi) + 6}
              y={ys(ultimatePoint.M) - 6}
              fontSize={10}
              fill="#ff6b6b"
            >
              Ultimate
            </text>
          </>
        )}

        {/* Axis titles */}
        <text x={ml + plotW / 2} y={H - 6} fontSize={11} textAnchor="middle" fill="rgba(242,239,228,0.9)">
          φ (1/mm)
        </text>
        <text
          x={12}
          y={mt + plotH / 2}
          fontSize={11}
          textAnchor="middle"
          fill="rgba(242,239,228,0.9)"
          transform={`rotate(-90 12 ${mt + plotH / 2})`}
        >
          M ({momU})
        </text>
      </svg>
    </div>
  );
}

/* ========================================================================= */
/* P-M interaction chart                                                     */
/* ========================================================================= */

function PMChart({ results, unitSystem }: { results: RcResults; unitSystem: UnitSystem }) {
  const { interaction } = results;
  const momU = unitLabel('moment', unitSystem);
  const forceU = unitLabel('force', unitSystem);

  const chart = useMemo(() => {
    const { points, P0, pureTension, phiPmax, balancePoint, pureFlexion } = interaction;
    if (points.length < 3) return null;

    const allM = [0, ...points.map((p) => p.M), balancePoint.M, pureFlexion.M];
    const allP = [
      ...points.map((p) => p.P),
      P0,
      pureTension,
      balancePoint.P,
      pureFlexion.P,
    ];
    const Mmax = Math.max(...allM) * 1.05;
    const Pmax = Math.max(...allP) * 1.05;
    const Pmin = Math.min(...allP, 0) * 1.05;

    const W = 400;
    const H = 320;
    const ml = 54;
    const mr = 16;
    const mt = 14;
    const mb = 36;
    const plotW = W - ml - mr;
    const plotH = H - mt - mb;

    const xs = (M: number) => ml + (M / Mmax) * plotW;
    const ys = (P: number) => mt + plotH - ((P - Pmin) / (Pmax - Pmin)) * plotH;

    // Points come already ordered by c descending (pure compression first, pure
    // tension last) — DO NOT re-sort by P, the envelope is multi-valued in P
    // around the balance point and sorting by P creates a zigzag artifact.
    // Filter out any anchor points with c = ±Infinity (those are wired in by
    // computeInteraction and would collapse the path).
    const swept = points.filter((p) => isFinite(p.c));
    const envPath =
      `M ${xs(0).toFixed(2)} ${ys(P0).toFixed(2)} ` +
      swept.map((p) => `L ${xs(p.M).toFixed(2)} ${ys(p.P).toFixed(2)}`).join(' ') +
      ` L ${xs(0).toFixed(2)} ${ys(pureTension).toFixed(2)} Z`;

    const phiPath =
      `M ${xs(0).toFixed(2)} ${ys(phiPmax).toFixed(2)} ` +
      swept.map((p) => `L ${xs(p.phiM).toFixed(2)} ${ys(p.phiP).toFixed(2)}`).join(' ') +
      ` L ${xs(0).toFixed(2)} ${ys(0.9 * pureTension).toFixed(2)} Z`;

    return {
      W, H, ml, mr, mt, mb, plotW, plotH, xs, ys, envPath, phiPath,
      Mmax, Pmax, Pmin, P0, pureTension, phiPmax, balancePoint, pureFlexion,
    };
  }, [interaction]);

  if (!chart) {
    return <div className="rc-results__empty">Interaction diagram not computed.</div>;
  }

  const {
    W, H, ml, mt, mb, plotW, plotH, xs, ys, envPath, phiPath,
    Mmax, Pmax, Pmin, P0, pureTension, phiPmax, balancePoint, pureFlexion,
  } = chart;

  const mScale = (v: number) => fromSI(v, 'moment', unitSystem);
  const pScale = (v: number) => fromSI(v, 'force', unitSystem);

  const gridX = 4;
  const gridY = 5;

  return (
    <div className="rc-results__content rc-results__chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="rc-results__chart"
        role="img"
        aria-label="P-M interaction diagram"
      >
        {/* Grid */}
        {Array.from({ length: gridX + 1 }).map((_, i) => {
          const x = ml + (i / gridX) * plotW;
          return <line key={`gx${i}`} x1={x} x2={x} y1={mt} y2={mt + plotH} stroke="rgba(255,255,255,0.06)" />;
        })}
        {Array.from({ length: gridY + 1 }).map((_, i) => {
          const y = mt + (i / gridY) * plotH;
          return <line key={`gy${i}`} x1={ml} x2={ml + plotW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />;
        })}

        {/* P=0 axis (flexion line) */}
        <line
          x1={ml}
          x2={ml + plotW}
          y1={ys(0)}
          y2={ys(0)}
          stroke="rgba(242,239,228,0.35)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />

        {/* Nominal envelope */}
        <path d={envPath} fill="rgba(255,107,107,0.18)" stroke="#ff6b6b" strokeWidth={1.6} />

        {/* φ envelope */}
        <path d={phiPath} fill="rgba(88,169,255,0.15)" stroke="#58a9ff" strokeWidth={1.4} strokeDasharray="4 3" />

        {/* Key points */}
        <circle cx={xs(0)} cy={ys(P0)} r={4} fill="#ff6b6b" />
        <text x={xs(0) + 6} y={ys(P0) + 3} fontSize={10} fill="#ff6b6b">P0</text>

        <circle cx={xs(0)} cy={ys(pureTension)} r={4} fill="#ff6b6b" />
        <text x={xs(0) + 6} y={ys(pureTension) - 4} fontSize={10} fill="#ff6b6b">Pnt</text>

        <circle cx={xs(balancePoint.M)} cy={ys(balancePoint.P)} r={4} fill="#3dd78d" />
        <text x={xs(balancePoint.M) + 6} y={ys(balancePoint.P)} fontSize={10} fill="#3dd78d">
          Balance
        </text>

        <circle cx={xs(pureFlexion.M)} cy={ys(pureFlexion.P)} r={4} fill="#c9a84c" />
        <text x={xs(pureFlexion.M) + 6} y={ys(pureFlexion.P) + 10} fontSize={10} fill="#c9a84c">
          Pure flex
        </text>

        {/* Axes */}
        <line x1={ml} x2={ml + plotW} y1={mt + plotH} y2={mt + plotH} stroke="rgba(242,239,228,0.55)" strokeWidth={1} />
        <line x1={ml} x2={ml} y1={mt} y2={mt + plotH} stroke="rgba(242,239,228,0.55)" strokeWidth={1} />

        {/* Axis tick labels */}
        {Array.from({ length: gridX + 1 }).map((_, i) => {
          const M = (i / gridX) * Mmax;
          const x = ml + (i / gridX) * plotW;
          return (
            <text key={`xl${i}`} x={x} y={mt + plotH + 14} fontSize={10} textAnchor="middle" fill="rgba(242,239,228,0.65)">
              {mScale(M).toExponential(1)}
            </text>
          );
        })}
        {Array.from({ length: gridY + 1 }).map((_, i) => {
          const P = Pmax - (i / gridY) * (Pmax - Pmin);
          const y = mt + (i / gridY) * plotH;
          return (
            <text key={`yl${i}`} x={ml - 4} y={y + 3} fontSize={10} textAnchor="end" fill="rgba(242,239,228,0.65)">
              {pScale(P).toExponential(1)}
            </text>
          );
        })}

        {/* Axis titles */}
        <text x={ml + plotW / 2} y={H - 6} fontSize={11} textAnchor="middle" fill="rgba(242,239,228,0.9)">
          M ({momU})
        </text>
        <text
          x={12}
          y={mt + plotH / 2}
          fontSize={11}
          textAnchor="middle"
          fill="rgba(242,239,228,0.9)"
          transform={`rotate(-90 12 ${mt + plotH / 2})`}
        >
          P ({forceU})
        </text>

        {/* Legend */}
        <g transform={`translate(${ml + plotW - 100} ${mt + 4})`}>
          <rect
            x={0}
            y={0}
            width={94}
            height={30}
            fill="rgba(20,20,24,0.88)"
            stroke="rgba(255,255,255,0.1)"
            rx={4}
          />
          <line x1={6} x2={22} y1={10} y2={10} stroke="#ff6b6b" strokeWidth={2} />
          <text x={26} y={13} fontSize={10} fill="rgba(242,239,228,0.9)">Nominal</text>
          <line x1={6} x2={22} y1={22} y2={22} stroke="#58a9ff" strokeWidth={2} strokeDasharray="3 2" />
          <text x={26} y={25} fontSize={10} fill="rgba(242,239,228,0.9)">φ-reduced</text>
        </g>
      </svg>
    </div>
  );
}
