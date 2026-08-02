/**
 * MONOLITHIC PRECISION — technical drawing library.
 *
 * Every visual on the site is drawn here as inline SVG rather than sourced from
 * stock photography. Two reasons:
 *   1. The firm has no published project photography yet, and generic
 *      hard-hat stock would misrepresent the practice.
 *   2. Line-work *is* the brand language — sections, grids, dimension marks.
 *
 * These are pure, hook-free components so they can render on the server.
 * `currentColor` drives every stroke, so a diagram inherits whatever surface it
 * is placed on. Gold is applied only to measurement / emphasis marks.
 */

import React from 'react';

const GOLD = 'var(--mp-gold)';

/* ── Shared fragments ────────────────────────────────────────────────────── */

function Grid({
  id,
  size = 40,
  opacity = 0.13,
}: {
  id: string;
  size?: number;
  opacity?: number;
}) {
  return (
    <defs>
      <pattern
        id={id}
        width={size}
        height={size}
        patternUnits="userSpaceOnUse"
      >
        <path
          d={`M${size} 0H0V${size}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeOpacity={opacity}
        />
      </pattern>
    </defs>
  );
}

function Hatch({ id, opacity = 0.5 }: { id: string; opacity?: number }) {
  return (
    <defs>
      <pattern
        id={id}
        width="8"
        height="8"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="8"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeOpacity={opacity}
        />
      </pattern>
    </defs>
  );
}

/** Ground line with the standard earth hatching below it. */
function Ground({
  x1,
  x2,
  y,
  step = 16,
}: {
  x1: number;
  x2: number;
  y: number;
  step?: number;
}) {
  const ticks: number[] = [];
  for (let x = x1; x <= x2; x += step) ticks.push(x);
  return (
    <g stroke="currentColor" fill="none">
      <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth="1.6" strokeOpacity="0.7" />
      {ticks.map((x) => (
        <line
          key={x}
          x1={x}
          y1={y}
          x2={x - 10}
          y2={y + 13}
          strokeWidth="0.9"
          strokeOpacity="0.4"
        />
      ))}
    </g>
  );
}

/** Horizontal dimension line with end ticks — gold, like a highlighted dim. */
function DimH({
  x1,
  x2,
  y,
  label,
}: {
  x1: number;
  x2: number;
  y: number;
  label?: string;
}) {
  return (
    <g stroke={GOLD} fill="none" strokeWidth="1">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 5} x2={x1} y2={y + 5} />
      <line x1={x2} y1={y - 5} x2={x2} y2={y + 5} />
      {label ? (
        <text
          x={(x1 + x2) / 2}
          y={y - 9}
          textAnchor="middle"
          className="mp-art__t mp-art__t--gold"
          stroke="none"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** Vertical dimension line with end ticks. */
function DimV({
  y1,
  y2,
  x,
  label,
}: {
  y1: number;
  y2: number;
  x: number;
  label?: string;
}) {
  return (
    <g stroke={GOLD} fill="none" strokeWidth="1">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 5} y1={y1} x2={x + 5} y2={y1} />
      <line x1={x - 5} y1={y2} x2={x + 5} y2={y2} />
      {label ? (
        <text
          x={x + 9}
          y={(y1 + y2) / 2}
          className="mp-art__t mp-art__t--gold"
          stroke="none"
          dominantBaseline="middle"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HERO — building section. Drawn statically here; `Hero.tsx` wraps the same
   geometry in a self-drawing animation.
   ══════════════════════════════════════════════════════════════════════════ */

export const HERO_GEOMETRY = {
  viewBox: '0 0 620 780',
  columns: [150, 252, 354, 456],
  colW: 12,
  levels: [160, 248, 336, 424, 512, 600],
  slabX: 144,
  slabW: 330,
  groundY: 652,
  matX: 132,
  matW: 354,
  matH: 24,
  coreX: 264,
  coreW: 90,
} as const;

export function HeroSectionArt() {
  const g = HERO_GEOMETRY;
  return (
    <svg viewBox={g.viewBox} fill="none" aria-hidden="true">
      <Grid id="mp-hero-grid" size={44} opacity={0.1} />
      <Hatch id="mp-hero-hatch" opacity={0.28} />
      <rect width="620" height="780" fill="url(#mp-hero-grid)" />

      {/* shear-wall core, hatched */}
      <rect
        x={g.coreX}
        y={g.levels[0]}
        width={g.coreW}
        height={g.groundY - g.levels[0]}
        fill="url(#mp-hero-hatch)"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.42"
      />

      {/* columns */}
      <g stroke="currentColor" fill="none" strokeWidth="1.3" strokeOpacity="0.7">
        {g.columns.map((x) => (
          <rect
            key={x}
            x={x}
            y={g.levels[0]}
            width={g.colW}
            height={g.groundY - g.levels[0]}
          />
        ))}
      </g>

      {/* slabs */}
      <g stroke="currentColor" fill="none" strokeWidth="1.4" strokeOpacity="0.8">
        {g.levels.map((y) => (
          <rect key={y} x={g.slabX} y={y} width={g.slabW} height={11} />
        ))}
      </g>

      {/* foundation mat */}
      <rect
        x={g.matX}
        y={g.groundY}
        width={g.matW}
        height={g.matH}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.75"
        fill="none"
      />

      <Ground x1={60} x2={560} y={g.groundY} />

      {/* level markers */}
      <g>
        {g.levels.map((y, i) => (
          <g key={y}>
            <line
              x1={112}
              y1={y + 5}
              x2={g.slabX}
              y2={y + 5}
              stroke={GOLD}
              strokeWidth="1"
              strokeOpacity="0.8"
            />
            <circle cx={110} cy={y + 5} r="2.6" fill={GOLD} />
            <text x={70} y={y + 9} className="mp-art__t">
              {i === 0 ? 'ROOF' : `L0${g.levels.length - i}`}
            </text>
          </g>
        ))}
      </g>

      {/* node markers at column / slab intersections */}
      <g fill={GOLD}>
        {g.levels.slice(1).map((y) =>
          g.columns.map((x) => (
            <circle key={`${x}-${y}`} cx={x + g.colW / 2} cy={y + 5} r="2.4" />
          )),
        )}
      </g>

      <DimV y1={g.levels[0]} y2={g.groundY} x={530} label="H" />
      <DimH x1={g.matX} x2={g.matX + g.matW} y={720} label="GRID 1–4" />

      <text x={60} y={756} className="mp-art__t">
        SECTION A–A · TYP.
      </text>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SERVICE DIAGRAMS — one per service `art` key. All 440 × 300.
   ══════════════════════════════════════════════════════════════════════════ */

const VB = '0 0 440 300';

function RebarArt() {
  const bars = [176, 208, 240, 272];
  const ties = [92, 130, 168, 206];
  return (
    <svg viewBox={VB} fill="none" aria-hidden="true">
      {/* concrete outline */}
      <rect
        x="160"
        y="52"
        width="128"
        height="196"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.3"
        strokeDasharray="6 5"
      />
      {/* cover line */}
      <rect
        x="170"
        y="62"
        width="108"
        height="176"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.2"
      />
      {/* longitudinal bars */}
      <g stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.72">
        {bars.map((x) => (
          <line key={x} x1={x} y1="66" x2={x} y2="234" />
        ))}
      </g>
      {/* ties with 135° hooks */}
      <g stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.45" strokeLinecap="round">
        {ties.map((y) => (
          <g key={y}>
            <rect x="172" y={y} width="104" height="0.6" />
            <line x1="172" y1={y} x2="276" y2={y} />
            <path d={`M172 ${y} l8 -8 M276 ${y} l-8 -8`} />
          </g>
        ))}
      </g>
      {/* bar section nodes */}
      <g fill={GOLD}>
        {bars.map((x) => (
          <circle key={`n${x}`} cx={x} cy="66" r="3.4" />
        ))}
      </g>
      <DimH x1={160} x2={288} y={272} label="b" />
      <text x="300" y="60" className="mp-art__t">
        COLUMN
      </text>
      <text x="300" y="76" className="mp-art__t">
        LONGIT. + TIES
      </text>
    </svg>
  );
}

function FrameArt() {
  return (
    <svg viewBox={VB} fill="none" aria-hidden="true">
      {/* deflected shape */}
      <path
        d="M118 250 C 126 190, 130 132, 148 78"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.28"
        strokeDasharray="4 5"
      />
      {/* portal frame */}
      <g stroke="currentColor" strokeWidth="2.1" strokeOpacity="0.75">
        <line x1="118" y1="76" x2="326" y2="76" />
        <line x1="118" y1="76" x2="118" y2="250" />
        <line x1="326" y1="76" x2="326" y2="250" />
      </g>
      {/* haunches */}
      <path
        d="M118 102 L144 76 M326 102 L300 76"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.5"
      />
      {/* footings */}
      <g stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.6">
        <rect x="86" y="250" width="64" height="18" />
        <rect x="294" y="250" width="64" height="18" />
      </g>
      <Ground x1={54} x2={392} y={268} />
      {/* lateral load */}
      <g stroke={GOLD} strokeWidth="1.8" strokeLinecap="round">
        <line x1="58" y1="76" x2="108" y2="76" />
        <path d="M99 68 L108 76 L99 84" fill="none" />
      </g>
      <text x="52" y="60" className="mp-art__t mp-art__t--gold">
        W
      </text>
      {/* joints */}
      <g fill={GOLD}>
        <circle cx="118" cy="76" r="3.6" />
        <circle cx="326" cy="76" r="3.6" />
      </g>
      <text x="360" y="72" className="mp-art__t">
        LATERAL
      </text>
      <text x="360" y="88" className="mp-art__t">
        SYSTEM
      </text>
    </svg>
  );
}

function BimArt() {
  return (
    <svg viewBox={VB} fill="none" aria-hidden="true">
      {/* wireframe volume */}
      <g stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.58">
        <rect x="138" y="110" width="146" height="128" />
        <path d="M138 110 l46 -42 M284 110 l46 -42 M284 238 l46 -42" />
        <path d="M184 68 h146 v128" strokeOpacity="0.42" />
      </g>
      {/* internal grid */}
      <g stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.26">
        <line x1="138" y1="174" x2="284" y2="174" />
        <path d="M284 174 l46 -42" />
        <line x1="211" y1="110" x2="211" y2="238" />
      </g>
      {/* crossing members: structural beam + service run */}
      <line x1="138" y1="238" x2="330" y2="68" stroke="currentColor" strokeWidth="1.7" strokeOpacity="0.72" />
      <line
        x1="138"
        y1="120"
        x2="330"
        y2="212"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.45"
        strokeDasharray="6 4"
      />
      {/* clash marker */}
      <g stroke={GOLD} strokeWidth="1.6" fill="none">
        <circle cx="232" cy="164" r="13" />
        {[0, 45, 90, 135].map((a) => {
          const t = (a * Math.PI) / 180;
          return (
            <line
              key={a}
              x1={232 + 18 * Math.cos(t)}
              y1={164 + 18 * Math.sin(t)}
              x2={232 + 25 * Math.cos(t)}
              y2={164 + 25 * Math.sin(t)}
            />
          );
        })}
      </g>
      <circle cx="232" cy="164" r="3.4" fill={GOLD} />
      <text x="96" y="272" className="mp-art__t">
        FEDERATED MODEL · INTERFERENCE CHECK
      </text>
    </svg>
  );
}

function RecertArt() {
  const floors = [92, 122, 152, 182, 212];
  return (
    <svg viewBox={VB} fill="none" aria-hidden="true">
      {/* existing building elevation */}
      <g stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.65">
        <rect x="92" y="62" width="112" height="180" />
        {floors.map((y) => (
          <line key={y} x1="92" y1={y} x2="204" y2={y} strokeOpacity="0.4" />
        ))}
        <line x1="148" y1="62" x2="148" y2="242" strokeOpacity="0.35" />
      </g>
      <Ground x1={62} x2={234} y={242} />
      {/* report sheet */}
      <g stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.55">
        <rect x="248" y="72" width="112" height="150" />
        <line x1="264" y1="102" x2="344" y2="102" strokeOpacity="0.35" />
        <line x1="264" y1="120" x2="344" y2="120" strokeOpacity="0.35" />
        <line x1="264" y1="138" x2="318" y2="138" strokeOpacity="0.35" />
      </g>
      {/* seal ring on the report */}
      <g stroke={GOLD} fill="none">
        <circle cx="304" cy="184" r="24" strokeWidth="1.4" />
        <circle cx="304" cy="184" r="19" strokeWidth="0.9" strokeDasharray="3 4" />
        <path
          d="M293 184 l8 9 l18 -20"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      {/* transfer arrow */}
      <g stroke={GOLD} strokeWidth="1.4" strokeLinecap="round">
        <line x1="212" y1="140" x2="240" y2="140" />
        <path d="M233 134 L240 140 L233 146" fill="none" />
      </g>
      <text x="62" y="276" className="mp-art__t">
        EXISTING BUILDING → RECERTIFICATION REPORT
      </text>
    </svg>
  );
}

function InspectionArt() {
  return (
    <svg viewBox={VB} fill="none" aria-hidden="true">
      {/* facade with balconies in section */}
      <g stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.62">
        <line x1="150" y1="48" x2="150" y2="256" />
        <line x1="166" y1="48" x2="166" y2="256" />
        {[86, 134, 182, 230].map((y) => (
          <g key={y}>
            <rect x="166" y={y} width="86" height="9" />
            <line x1="252" y1={y} x2="252" y2={y - 26} strokeOpacity="0.4" />
          </g>
        ))}
      </g>
      {/* distress marks */}
      <g stroke={GOLD} strokeWidth="1.4" strokeLinecap="round">
        <path d="M196 134 l10 -7 l7 8 l11 -6" />
        <path d="M204 182 l9 -6 l8 7" />
      </g>
      {/* callout circles */}
      <g stroke={GOLD} strokeWidth="1.2" fill="none">
        <circle cx="210" cy="131" r="20" strokeOpacity="0.85" />
        <line x1="226" y1="118" x2="278" y2="92" strokeOpacity="0.55" />
        <circle cx="212" cy="180" r="17" strokeOpacity="0.6" />
      </g>
      <g stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.45">
        <rect x="278" y="70" width="76" height="44" />
        <line x1="290" y1="88" x2="342" y2="88" strokeOpacity="0.4" />
        <line x1="290" y1="100" x2="326" y2="100" strokeOpacity="0.4" />
      </g>
      <text x="278" y="64" className="mp-art__t mp-art__t--gold">
        OBS. 01
      </text>
      <text x="100" y="282" className="mp-art__t">
        BALCONY / FACADE — VISUAL INSPECTION
      </text>
    </svg>
  );
}

function AssessmentArt() {
  const bars = [186, 214, 242, 270];
  return (
    <svg viewBox={VB} fill="none" aria-hidden="true">
      <Hatch id="mp-assess-hatch" opacity={0.22} />
      {/* concrete member in section */}
      <rect
        x="150"
        y="96"
        width="156"
        height="104"
        fill="url(#mp-assess-hatch)"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.6"
      />
      {/* spall — a bite out of the soffit */}
      <path
        d="M196 200 q14 -22 32 -4 q12 12 26 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeOpacity="0.75"
        fill="none"
        strokeDasharray="5 4"
      />
      {/* reinforcement, one bar exposed */}
      <g strokeWidth="1.6">
        {bars.map((x, i) => (
          <line
            key={x}
            x1={x}
            y1="112"
            x2={x}
            y2="186"
            stroke={i === 1 ? GOLD : 'currentColor'}
            strokeOpacity={i === 1 ? 1 : 0.55}
          />
        ))}
      </g>
      {/* crack propagation */}
      <path
        d="M214 112 l-7 20 l8 18 l-6 22"
        stroke={GOLD}
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      {/* callout */}
      <g stroke={GOLD} strokeWidth="1.2" fill="none">
        <circle cx="214" cy="152" r="34" strokeOpacity="0.75" />
        <line x1="238" y1="128" x2="300" y2="86" strokeOpacity="0.5" />
      </g>
      <text x="300" y="80" className="mp-art__t mp-art__t--gold">
        SECTION LOSS
      </text>
      <DimH x1={150} x2={306} y={230} label="EVALUATED LENGTH" />
      <text x="100" y="272" className="mp-art__t">
        CONDITION ASSESSMENT — DETERIORATION MAPPING
      </text>
    </svg>
  );
}

function PeerArt() {
  return (
    <svg viewBox={VB} fill="none" aria-hidden="true">
      {/* back sheet */}
      <g stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.35">
        <rect x="150" y="52" width="130" height="168" />
        <line x1="166" y1="82" x2="264" y2="82" />
        <line x1="166" y1="100" x2="264" y2="100" />
      </g>
      {/* front sheet with a small structural plan on it */}
      <g stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.62">
        <rect x="176" y="78" width="130" height="168" fill="var(--mp-paper)" />
        <g strokeWidth="0.9" strokeOpacity="0.42">
          {[206, 236, 266].map((x) => (
            <line key={x} x1={x} y1="94" x2={x} y2="204" />
          ))}
          {[118, 152, 186].map((y) => (
            <line key={y} x1="192" y1={y} x2="290" y2={y} />
          ))}
        </g>
      </g>
      {/* review comment markers */}
      <g fill={GOLD}>
        <circle cx="206" cy="118" r="4.4" />
        <circle cx="266" cy="152" r="4.4" />
        <circle cx="236" cy="186" r="4.4" />
      </g>
      <g stroke={GOLD} strokeWidth="1" strokeOpacity="0.55">
        <line x1="210" y1="118" x2="330" y2="106" />
        <line x1="270" y1="152" x2="330" y2="146" />
        <line x1="240" y1="186" x2="330" y2="186" />
      </g>
      {/* comment log */}
      <g stroke="currentColor" strokeWidth="1" strokeOpacity="0.4">
        <line x1="332" y1="106" x2="392" y2="106" />
        <line x1="332" y1="146" x2="392" y2="146" />
        <line x1="332" y1="186" x2="392" y2="186" />
      </g>
      <text x="332" y="98" className="mp-art__t mp-art__t--gold">
        C-01
      </text>
      <text x="332" y="138" className="mp-art__t mp-art__t--gold">
        C-02
      </text>
      <text x="332" y="178" className="mp-art__t mp-art__t--gold">
        C-03
      </text>
      <text x="100" y="278" className="mp-art__t">
        INDEPENDENT REVIEW — COMMENT LOG
      </text>
    </svg>
  );
}

export type ArtKind =
  | 'rebar'
  | 'frame'
  | 'bim'
  | 'recert'
  | 'inspection'
  | 'assessment'
  | 'peer';

const ART_REGISTRY: Record<ArtKind, () => React.JSX.Element> = {
  rebar: RebarArt,
  frame: FrameArt,
  bim: BimArt,
  recert: RecertArt,
  inspection: InspectionArt,
  assessment: AssessmentArt,
  peer: PeerArt,
};

export function ServiceArt({ kind }: { kind: ArtKind }) {
  const Component = ART_REGISTRY[kind] ?? RebarArt;
  return <Component />;
}

/* ══════════════════════════════════════════════════════════════════════════
   TWO PATHS
   ══════════════════════════════════════════════════════════════════════════ */

export function PathArt({ kind }: { kind: 'new' | 'existing' }) {
  return kind === 'new' ? <PathArtNew /> : <PathArtExisting />;
}

function PathArtNew() {
  const cols = [120, 200, 280, 360];
  const levels = [78, 118, 158];
  return (
    <svg viewBox="0 0 480 270" fill="none" aria-hidden="true">
      <Grid id="mp-pathnew-grid" size={30} opacity={0.1} />
      <rect width="480" height="270" fill="url(#mp-pathnew-grid)" />
      {/* rising frame — the top level is still dashed: under construction */}
      <g stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.7">
        {cols.map((x) => (
          <line key={x} x1={x} y1="118" x2={x} y2="200" />
        ))}
        {levels.slice(1).map((y) => (
          <line key={y} x1="112" y1={y} x2="368" y2={y} />
        ))}
      </g>
      <g stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.32" strokeDasharray="6 5">
        {cols.map((x) => (
          <line key={`d${x}`} x1={x} y1="78" x2={x} y2="118" />
        ))}
        <line x1="112" y1="78" x2="368" y2="78" />
      </g>
      {/* foundation */}
      <g stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.6">
        <rect x="104" y="200" width="272" height="16" />
      </g>
      <Ground x1={64} x2={416} y={216} />
      <g fill={GOLD}>
        {cols.map((x) => (
          <circle key={`n${x}`} cx={x} cy="118" r="3" />
        ))}
      </g>
      <DimH x1={104} x2={376} y={244} label="NEW BUILD" />
    </svg>
  );
}

function PathArtExisting() {
  const floors = [70, 100, 130, 160, 190];
  return (
    <svg viewBox="0 0 480 270" fill="none" aria-hidden="true">
      <Grid id="mp-pathex-grid" size={30} opacity={0.1} />
      <rect width="480" height="270" fill="url(#mp-pathex-grid)" />
      {/* standing building */}
      <g stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.7">
        <rect x="140" y="44" width="200" height="172" />
        {floors.map((y) => (
          <line key={y} x1="140" y1={y} x2="340" y2={y} strokeOpacity="0.38" />
        ))}
        <line x1="240" y1="44" x2="240" y2="216" strokeOpacity="0.3" />
      </g>
      <Ground x1={92} x2={392} y={216} />
      {/* survey crosshairs over inspected zones */}
      <g stroke={GOLD} strokeWidth="1.1">
        {[
          [190, 85],
          [290, 145],
          [190, 175],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="12" fill="none" strokeOpacity="0.85" />
            <line x1={cx - 18} y1={cy} x2={cx + 18} y2={cy} strokeOpacity="0.55" />
            <line x1={cx} y1={cy - 18} x2={cx} y2={cy + 18} strokeOpacity="0.55" />
          </g>
        ))}
      </g>
      <DimH x1={140} x2={340} y={244} label="EXISTING" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   BIM MODEL — layered axonometric. Pure render; state lives in the viewer.
   ══════════════════════════════════════════════════════════════════════════ */

const ISO_COS = 0.866;
const ISO_SIN = 0.5;
const ISO_SCALE = 1.42;
const ISO_CX = 250;
const ISO_CY = 302;

function iso(x: number, y: number, z: number): [number, number] {
  const sx = (x - z) * ISO_COS * ISO_SCALE + ISO_CX;
  const sy = ((x + z) * ISO_SIN - y) * ISO_SCALE + ISO_CY;
  return [sx, sy];
}
const pt = (x: number, y: number, z: number) => iso(x, y, z).join(',');

/** Horizontal plate (slab / mat) as an isometric parallelogram. */
function isoPlate(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
): string {
  return [pt(x0, y, z0), pt(x1, y, z0), pt(x1, y, z1), pt(x0, y, z1)].join(' ');
}

const GRID_X = [0, 60, 120];
const GRID_Z = [0, 45, 90];
const LEVELS = [46, 92, 138, 184];

export function BimModel({
  layers,
  solid,
}: {
  layers: Record<string, boolean>;
  solid: boolean;
}) {
  const on = (id: string) => (layers[id] ? 'true' : 'false');
  const fillOp = solid ? 0.14 : 0;
  const stroke = 'currentColor';

  return (
    <svg viewBox="0 0 500 500" fill="none" aria-hidden="true">
      {/* ── Foundations ── */}
      <g className="mp-bim-layer" data-on={on('foundations')}>
        <polygon
          points={isoPlate(-12, 132, -12, 102, 0)}
          stroke={stroke}
          strokeWidth="1.3"
          strokeOpacity="0.6"
          fill={stroke}
          fillOpacity={fillOp * 0.8}
          className="mp-bim-fill"
        />
        {GRID_X.map((x) =>
          GRID_Z.map((z) => (
            <polygon
              key={`f-${x}-${z}`}
              points={isoPlate(x - 11, x + 11, z - 11, z + 11, 2)}
              stroke={stroke}
              strokeWidth="1"
              strokeOpacity="0.45"
              fill="none"
            />
          )),
        )}
      </g>

      {/* ── Columns ── */}
      <g className="mp-bim-layer" data-on={on('columns')}>
        {GRID_X.map((x) =>
          GRID_Z.map((z) => (
            <g key={`c-${x}-${z}`}>
              <line
                x1={iso(x, 0, z)[0]}
                y1={iso(x, 0, z)[1]}
                x2={iso(x, LEVELS[LEVELS.length - 1], z)[0]}
                y2={iso(x, LEVELS[LEVELS.length - 1], z)[1]}
                stroke={stroke}
                strokeWidth="2.4"
                strokeOpacity="0.78"
              />
              <line
                x1={iso(x + 7, 0, z + 7)[0]}
                y1={iso(x + 7, 0, z + 7)[1]}
                x2={iso(x + 7, LEVELS[LEVELS.length - 1], z + 7)[0]}
                y2={iso(x + 7, LEVELS[LEVELS.length - 1], z + 7)[1]}
                stroke={stroke}
                strokeWidth="0.9"
                strokeOpacity="0.3"
              />
            </g>
          )),
        )}
      </g>

      {/* ── Slabs ── */}
      <g className="mp-bim-layer" data-on={on('slabs')}>
        {LEVELS.map((y) => (
          <polygon
            key={`s-${y}`}
            points={isoPlate(-6, 126, -6, 96, y)}
            stroke={stroke}
            strokeWidth="1.2"
            strokeOpacity="0.62"
            fill={stroke}
            fillOpacity={fillOp}
            className="mp-bim-fill"
          />
        ))}
      </g>

      {/* ── Shear walls (core) ── */}
      <g className="mp-bim-layer" data-on={on('walls')}>
        {[
          { x0: 52, x1: 68, z0: 30, z1: 30 },
          { x0: 52, x1: 68, z0: 60, z1: 60 },
        ].map((w, i) => (
          <polygon
            key={`w-${i}`}
            points={[
              pt(w.x0, 0, w.z0),
              pt(w.x1, 0, w.z1),
              pt(w.x1, LEVELS[LEVELS.length - 1], w.z1),
              pt(w.x0, LEVELS[LEVELS.length - 1], w.z0),
            ].join(' ')}
            stroke={GOLD}
            strokeWidth="1.2"
            strokeOpacity="0.85"
            fill={GOLD}
            fillOpacity={solid ? 0.16 : 0.04}
            className="mp-bim-fill"
          />
        ))}
      </g>

      {/* ── Framing (beams at each level) ── */}
      <g className="mp-bim-layer" data-on={on('framing')}>
        {LEVELS.map((y) => (
          <g key={`b-${y}`} stroke={stroke} strokeWidth="1.1" strokeOpacity="0.5">
            {GRID_Z.map((z) => (
              <line
                key={`bx-${z}`}
                x1={iso(0, y, z)[0]}
                y1={iso(0, y, z)[1]}
                x2={iso(120, y, z)[0]}
                y2={iso(120, y, z)[1]}
              />
            ))}
            {GRID_X.map((x) => (
              <line
                key={`bz-${x}`}
                x1={iso(x, y, 0)[0]}
                y1={iso(x, y, 0)[1]}
                x2={iso(x, y, 90)[0]}
                y2={iso(x, y, 90)[1]}
              />
            ))}
          </g>
        ))}
      </g>

      {/* ── Coordination (services crossing the frame + clash markers) ── */}
      <g className="mp-bim-layer" data-on={on('coordination')}>
        <g stroke={GOLD} strokeWidth="1.5" strokeDasharray="7 5" strokeOpacity="0.9">
          <line
            x1={iso(-10, 116, 22)[0]}
            y1={iso(-10, 116, 22)[1]}
            x2={iso(130, 116, 22)[0]}
            y2={iso(130, 116, 22)[1]}
          />
          <line
            x1={iso(84, 70, -10)[0]}
            y1={iso(84, 70, -10)[1]}
            x2={iso(84, 70, 100)[0]}
            y2={iso(84, 70, 100)[1]}
          />
        </g>
        {[
          iso(60, 116, 22),
          iso(84, 70, 45),
        ].map(([cx, cy], i) => (
          <g key={`clash-${i}`} stroke={GOLD} strokeWidth="1.3" fill="none">
            <circle cx={cx} cy={cy} r="11" />
            <circle cx={cx} cy={cy} r="3.2" fill={GOLD} stroke="none" />
          </g>
        ))}
      </g>

      {/* ── Setting-out marks (always on) ── */}
      <g stroke={stroke} strokeWidth="0.8" strokeOpacity="0.28" strokeDasharray="3 4">
        <line
          x1={iso(-24, 0, -24)[0]}
          y1={iso(-24, 0, -24)[1]}
          x2={iso(144, 0, -24)[0]}
          y2={iso(144, 0, -24)[1]}
        />
        <line
          x1={iso(-24, 0, -24)[0]}
          y1={iso(-24, 0, -24)[1]}
          x2={iso(-24, 0, 114)[0]}
          y2={iso(-24, 0, 114)[1]}
        />
      </g>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TITLE BLOCK — the leadership composition while no portrait is published.
   A drawing title block is honest, on-brand, and does not read as a gap.
   ══════════════════════════════════════════════════════════════════════════ */

const TB_LINE = 15;
const TB_PAD = 20;
const TB_GAP = 13;

/** Stacks the rows top-down, allowing any row to be several lines tall. */
function layOutTitleBlock(rows: { k: string; v: string | string[] }[]) {
  return rows.reduce<
    {
      k: string;
      lines: string[];
      labelY: number;
      firstValueY: number;
      ruleY: number;
    }[]
  >((acc, r) => {
    const previous = acc[acc.length - 1];
    const labelY = previous ? previous.ruleY + TB_GAP + TB_LINE : 78;
    const lines = Array.isArray(r.v) ? r.v : [r.v];
    const firstValueY = labelY + TB_GAP;
    const ruleY = firstValueY + (lines.length - 1) * TB_LINE + TB_PAD;
    return [...acc, { k: r.k, lines, labelY, firstValueY, ruleY }];
  }, []);
}

export function TitleBlock({
  rows,
}: {
  /** `v` may be a single string or several lines — SVG text does not wrap. */
  rows: { k: string; v: string | string[] }[];
}) {
  const laidOut = layOutTitleBlock(rows);

  return (
    <svg viewBox="0 0 360 460" fill="none" aria-hidden="true">
      <Grid id="mp-tb-grid" size={20} opacity={0.14} />
      <rect width="360" height="460" fill="url(#mp-tb-grid)" />
      <rect
        x="24"
        y="24"
        width="312"
        height="412"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.45"
      />
      <g stroke={GOLD} strokeWidth="1.4">
        <path d="M24 52V24h28M336 52V24h-28M24 408v28h28M336 408v28h-28" fill="none" />
      </g>

      {laidOut.map((r) => (
        <g key={r.k}>
          <text x="48" y={r.labelY} className="mp-art__t mp-art__t--gold">
            {r.k}
          </text>
          <text x="48" y={r.firstValueY + 10} className="mp-art__tv">
            {r.lines.map((line, i) => (
              <tspan key={line} x="48" dy={i === 0 ? 0 : TB_LINE}>
                {line}
              </tspan>
            ))}
          </text>
          <line
            x1="48"
            y1={r.ruleY}
            x2="312"
            y2={r.ruleY}
            stroke="currentColor"
            strokeWidth="0.9"
            strokeOpacity="0.3"
          />
        </g>
      ))}

      <g stroke={GOLD} strokeWidth="1" strokeOpacity="0.6">
        <line x1="180" y1="412" x2="180" y2="424" />
        <line x1="174" y1="418" x2="186" y2="418" />
      </g>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SOUTH FLORIDA — service-area plan diagram (schematic, not cartographic)
   ══════════════════════════════════════════════════════════════════════════ */

export function SouthFloridaPlate() {
  const coast = 'M330 40 C 322 120, 316 200, 306 290 C 300 356, 296 412, 292 470';
  return (
    <svg viewBox="0 0 420 500" fill="none" aria-hidden="true">
      <Grid id="mp-geo-grid" size={28} opacity={0.16} />
      <rect width="420" height="500" fill="url(#mp-geo-grid)" />

      {/* latitude ticks */}
      <g stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.3">
        {[110, 200, 290, 380].map((y) => (
          <g key={y}>
            <line x1="28" y1={y} x2="44" y2={y} />
            <line x1="376" y1={y} x2="392" y2={y} />
          </g>
        ))}
      </g>

      {/* coastline */}
      <path d={coast} stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.7" fill="none" />
      <path
        d="M348 40 C 340 120, 334 200, 324 290 C 318 356, 314 412, 310 470"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeOpacity="0.25"
        strokeDasharray="4 5"
        fill="none"
      />

      {/* county bands */}
      <g stroke={GOLD} strokeWidth="1" strokeOpacity="0.75">
        <line x1="52" y1="120" x2="322" y2="120" strokeDasharray="8 5" />
        <line x1="52" y1="262" x2="310" y2="262" strokeDasharray="8 5" />
        <line x1="52" y1="430" x2="296" y2="430" strokeDasharray="8 5" />
      </g>

      {/* western boundary */}
      <line
        x1="52"
        y1="120"
        x2="52"
        y2="430"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.45"
      />

      {/* markers */}
      {[
        { x: 232, y: 186, code: 'BRW' },
        { x: 224, y: 336, code: 'MDC' },
      ].map((m) => (
        <g key={m.code}>
          <circle cx={m.x} cy={m.y} r="16" stroke={GOLD} strokeWidth="1.2" fill="none" />
          <line x1={m.x - 24} y1={m.y} x2={m.x + 24} y2={m.y} stroke={GOLD} strokeWidth="1" />
          <line x1={m.x} y1={m.y - 24} x2={m.x} y2={m.y + 24} stroke={GOLD} strokeWidth="1" />
          <circle cx={m.x} cy={m.y} r="3.4" fill={GOLD} />
          <text x={m.x + 30} y={m.y - 6} className="mp-geo__svgtext mp-geo__svgtext--gold">
            {m.code}
          </text>
        </g>
      ))}

      <text x="64" y="150" className="mp-geo__svgtext">
        BROWARD COUNTY
      </text>
      <text x="64" y="292" className="mp-geo__svgtext">
        MIAMI-DADE COUNTY
      </text>
      <text x="336" y="250" className="mp-geo__svgtext" transform="rotate(90 336 250)">
        ATLANTIC
      </text>

      {/* scale bar */}
      <g stroke={GOLD} strokeWidth="1">
        <line x1="52" y1="466" x2="132" y2="466" />
        <line x1="52" y1="461" x2="52" y2="471" />
        <line x1="92" y1="463" x2="92" y2="469" />
        <line x1="132" y1="461" x2="132" y2="471" />
      </g>
      <text x="52" y="484" className="mp-geo__svgtext">
        Plan diagram — not to scale
      </text>

      {/* north arrow */}
      <g stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.6" fill="none">
        <path d="M376 60 l0 -26 l8 12 z" />
        <line x1="376" y1="60" x2="376" y2="34" />
      </g>
      <text x="368" y="76" className="mp-geo__svgtext">
        N
      </text>
    </svg>
  );
}
