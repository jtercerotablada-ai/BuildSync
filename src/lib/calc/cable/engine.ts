import {
  CURVE_POINTS,
  CURVE_STEP,
  MAX_MAGNITUDE,
  type CableLine,
  type CableLineInput,
  type CableSection,
  type CurvePoint,
  type Displacement,
  type DrumInput,
  type DrumIssue,
  type DrumOutcome,
  type DrumUnknown,
  type DrumWarningCode,
  type LegInput,
  type LegResult,
  type LoadInput,
  type LoadOutcome,
  type LoadWarning,
  type PullBest,
  type PullHold,
  type PullInput,
  type PullIssue,
  type PullOptimum,
  type PullOutcome,
  type PullRegime,
  type PullRegimeId,
  type PullRole,
  type PullStatus,
  type PullWarning,
  type SecondOrder,
  type Side,
  type Travel,
} from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CABLE TENSION AND ELONGATION — the engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure functions, one per mode (types.ts is the agreement and lists every
 * code). NOTHING HERE THROWS and NOTHING RETURNS NaN OR INFINITY: a value that
 * cannot be told is a diagnostic code with the numbers it needs. No words.
 * Any consistent units (types.ts); angles in degrees at the boundary.
 */

/* ── Small helpers ─────────────────────────────────────────────────────── */

const DEG = Math.PI / 180;
/** Cosine and sine of an angle in degrees, exact at the multiples of 90. */
export function cosd(a: number): number {
  const r = ((a % 360) + 360) % 360;
  if (r === 0) return 1;
  if (r === 90 || r === 270) return 0;
  if (r === 180) return -1;
  return Math.cos(a * DEG);
}
export function sind(a: number): number {
  const r = ((a % 360) + 360) % 360;
  if (r === 0 || r === 180) return 0;
  if (r === 90) return 1;
  if (r === 270) return -1;
  return Math.sin(a * DEG);
}
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_MAGNITUDE;
/** Never −0. */
const clean = (v: number): number => (v === 0 ? 0 : v);
const big = (...v: number[]): boolean => v.some((x) => !Number.isFinite(x) || Math.abs(x) > MAX_MAGNITUDE);

/* ── The cable under one tension ───────────────────────────────────────── */

/**
 * σ, ε, the stretches, the force if restrained, the ratios and the sizes asked
 * for, of ONE cable under ONE tension (types.ts, CableLine, has every formula).
 * Assumes a valid section (A > 0, E > 0): the callers validate. Never throws;
 * a value that would not be finite is 0 (the callers check sizes first).
 */
export function cableLine(input: CableLineInput): CableLine {
  const { T, section } = input;
  const A = section.A;
  const E = section.E;
  const alpha = section.alpha;
  const dT = input.dT ?? 0;
  const L = input.length;
  const stress = T / A;
  const strain = stress / E;
  const elastic = L === null ? null : (T * L) / (A * E);
  const thermal = L === null ? null : alpha * L * dT;
  const stretch = elastic === null || thermal === null ? null : elastic + thermal;
  const restrainedForce = clean(-E * A * alpha * dT);
  const combinedTension = T + restrainedForce;
  const mbf = section.mbf != null && section.mbf > 0 ? section.mbf : null;
  const n = input.n != null && input.n > 0 ? input.n : null;
  const allow = input.allowable != null && input.allowable > 0 ? input.allowable : null;
  const factor = section.factor != null && section.factor > 0 ? section.factor : Math.PI / 4;
  const requiredArea = allow !== null && T > 0 ? T / allow : null;
  return {
    T,
    A,
    E,
    alpha,
    length: L,
    dT,
    stress: clean(stress),
    strain: clean(strain),
    elastic: elastic === null ? null : clean(elastic),
    thermal: thermal === null ? null : clean(thermal),
    stretch: stretch === null ? null : clean(stretch),
    newLength: L === null || stretch === null ? null : L + stretch,
    restrainedForce,
    restrainedStress: clean(-E * alpha * dT),
    combinedTension: clean(combinedTension),
    combinedStress: clean(combinedTension / A),
    combinedSlack: combinedTension < 0,
    mbf,
    mbfRatio: mbf !== null && T > 0 ? mbf / T : null,
    mbfRatioCombined: mbf !== null && combinedTension > 0 ? mbf / combinedTension : null,
    requiredMbf: n !== null ? n * T : null,
    requiredArea,
    requiredDiameter: requiredArea === null ? null : Math.sqrt((4 * requiredArea) / Math.PI),
    requiredNominalDiameter: requiredArea === null ? null : Math.sqrt(requiredArea / factor),
  };
}

/** The area of a round (or rope) section of nominal diameter d: A = factor·d², the factor π/4 for a solid round. */
export function areaOfDiameter(d: number, factor: number | null = null): number {
  return (factor ?? Math.PI / 4) * d * d;
}

/* ── Validation ────────────────────────────────────────────────────────── */

type Bad = { code: 'number' | 'range'; field: string; leg?: 1 | 2; min?: number; max?: number; minOpen?: boolean };

function checkNumber(issues: Bad[], v: unknown, field: string, o: { min?: number; max?: number; minOpen?: boolean; leg?: 1 | 2; optional?: boolean } = {}): void {
  if (o.optional && (v === null || v === undefined)) return;
  const at = o.leg ? { leg: o.leg } : {};
  if (!fin(v)) {
    issues.push({ code: 'number', field, ...at });
    return;
  }
  const lo = o.min !== undefined && (o.minOpen ? v <= o.min : v < o.min);
  const hi = o.max !== undefined && v > o.max;
  if (lo || hi) issues.push({ code: 'range', field, ...at, ...(o.min !== undefined ? { min: o.min } : {}), ...(o.max !== undefined ? { max: o.max } : {}), ...(o.minOpen ? { minOpen: true } : {}) });
}

function checkSection(issues: Bad[], s: CableSection | undefined, leg?: 1 | 2): void {
  if (!s || typeof s !== 'object') {
    issues.push({ code: 'number', field: 'A', ...(leg ? { leg } : {}) });
    return;
  }
  checkNumber(issues, s.A, 'A', { min: 0, minOpen: true, leg });
  checkNumber(issues, s.E, 'E', { min: 0, minOpen: true, leg });
  checkNumber(issues, s.alpha, 'alpha', { min: 0, leg });
  checkNumber(issues, s.mbf, 'mbf', { min: 0, minOpen: true, leg, optional: true });
  checkNumber(issues, s.factor, 'factor', { min: 0, minOpen: true, leg, optional: true });
}

/**
 * What is wrong with a cable that is not part of the mode's own statics (modes
 * 'pull' and 'drum' carry a tension into a cable): its section, its length
 * (null: none, no stretch), ΔT, n and the allowable stress. Same issues as the
 * modes' own ('number', 'range'; fields 'A', 'E', 'alpha', 'mbf', 'factor',
 * 'length', 'dT', 'n', 'allowable').
 */
export function validateCable(section: CableSection, length: number | null, dT: number, n: number | null | undefined, allowable: number | null | undefined): { code: 'number' | 'range'; field: string; min?: number; max?: number; minOpen?: boolean }[] {
  const bad: Bad[] = [];
  checkSection(bad, section);
  checkNumber(bad, length, 'length', { min: 0, minOpen: true, optional: true });
  checkNumber(bad, dT, 'dT');
  checkNumber(bad, n, 'n', { min: 0, minOpen: true, optional: true });
  checkNumber(bad, allowable, 'allowable', { min: 0, minOpen: true, optional: true });
  return bad;
}

/* ── Mode 1: a load on a cable or a sling ──────────────────────────────── */

const PARALLEL = 1e-9;

function unit(angle: number, side: Side): { ux: number; uy: number } {
  return { ux: (side === 'left' ? -1 : 1) * cosd(angle), uy: sind(angle) };
}

/** The point where two circles (centres a1, a2; radii r1, r2) meet that is nearest the origin, polished by Newton; null if they do not meet. */
function circles(a1: [number, number], r1: number, a2: [number, number], r2: number): [number, number] | null {
  const dx = a2[0] - a1[0];
  const dy = a2[1] - a1[1];
  const d = Math.hypot(dx, dy);
  if (!(d > 0)) return null;
  const ex = dx / d;
  const ey = dy / d;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < -1e-12 * (r1 * r1 + r2 * r2)) return null;
  const h = Math.sqrt(Math.max(0, h2));
  const px = a1[0] + a * ex;
  const py = a1[1] + a * ey;
  const c1: [number, number] = [px - h * ey, py + h * ex];
  const c2: [number, number] = [px + h * ey, py - h * ex];
  let p = Math.hypot(c1[0], c1[1]) <= Math.hypot(c2[0], c2[1]) ? c1 : c2;
  // Polish on the two circle equations |P − A_i| = r_i.
  for (let k = 0; k < 4; k++) {
    const v1 = [p[0] - a1[0], p[1] - a1[1]];
    const v2 = [p[0] - a2[0], p[1] - a2[1]];
    const l1 = Math.hypot(v1[0], v1[1]);
    const l2 = Math.hypot(v2[0], v2[1]);
    if (!(l1 > 0) || !(l2 > 0)) break;
    const f1 = l1 - r1;
    const f2 = l2 - r2;
    const j11 = v1[0] / l1;
    const j12 = v1[1] / l1;
    const j21 = v2[0] / l2;
    const j22 = v2[1] / l2;
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-14) break;
    const sx = (f1 * j22 - f2 * j12) / det;
    const sy = (j11 * f2 - j21 * f1) / det;
    p = [p[0] - sx, p[1] - sy];
  }
  return Number.isFinite(p[0]) && Number.isFinite(p[1]) ? p : null;
}

const disp = (dx: number, dy: number): Displacement => ({ dx: clean(dx), dy: clean(dy), magnitude: Math.hypot(dx, dy) });

/**
 * The equilibrium of the loaded point in the DEFORMED geometry (types.ts,
 * SecondOrder): damped Newton on F(P) = Σ T_i·e_i + (H, −W), T_i = k_i·(ℓ_i − Lu_i)
 * (a slack cable carries 0). Null if it does not converge.
 */
function secondOrder(W: number, H: number, legs: LegResult[], inputs: LegInput[], dT: number, first: [number, number]): SecondOrder | null {
  // Two starts: the first-order move (the right neighbourhood whenever the legs are taut), then the loaded point's own place. Each step is capped at a tenth of the shortest leg, so a hot sling whose legs start slack settles by falling, not by a leap of a hundred leg lengths.
  return secondOrderFrom(W, H, legs, inputs, dT, first) ?? secondOrderFrom(W, H, legs, inputs, dT, [0, 0]);
}

function secondOrderFrom(W: number, H: number, legs: LegResult[], inputs: LegInput[], dT: number, start: [number, number]): SecondOrder | null {
  const scale = Math.abs(W) + Math.abs(H);
  if (!(scale > 0)) return null;
  const anchors = legs.map((l) => [l.anchorX, l.anchorY] as [number, number]);
  const Lu = inputs.map((l) => l.length * (1 + l.section.alpha * dT));
  if (Lu.some((v) => !(v > 0))) return null;
  const k = inputs.map((l, i) => (l.section.E * l.section.A) / Lu[i]);
  const lam = (1e-2 * scale) / ((inputs[0].length + inputs[1].length) / 2);
  const alphaTerm = inputs.map((l) => l.length * l.section.alpha * dT);
  const evalAt = (p: [number, number]) => {
    let fx = H;
    let fy = -W;
    const parts = anchors.map((a, i) => {
      const vx = a[0] - p[0];
      const vy = a[1] - p[1];
      const l = Math.hypot(vx, vy);
      // ℓ − Lu without the cancellation of two large numbers: ℓ − L = (|A − d|² − |A|²) / (ℓ + L) = (d·d − 2 A·d) / (ℓ + L).
      const ext = (p[0] * p[0] + p[1] * p[1] - 2 * (a[0] * p[0] + a[1] * p[1])) / (l + inputs[i].length) - alphaTerm[i];
      const T = ext > 0 ? k[i] * ext : 0;
      const ex = l > 0 ? vx / l : 0;
      const ey = l > 0 ? vy / l : 1;
      fx += T * ex;
      fy += T * ey;
      return { T, ex, ey, l, taut: ext >= 0 };
    });
    return { fx, fy, parts };
  };
  const reach = 0.1 * Math.min(inputs[0].length, inputs[1].length);
  let p: [number, number] = [start[0], start[1]];
  let cur = evalAt(p);
  let iterations = 0;
  for (; iterations < 600; iterations++) {
    const norm = Math.hypot(cur.fx, cur.fy);
    if (norm <= 1e-13 * scale) break;
    let j11 = 0;
    let j12 = 0;
    let j22 = 0;
    for (const q of cur.parts) {
      const stiff = q.taut ? k[cur.parts.indexOf(q)] : 0;
      const bend = q.l > 0 ? q.T / q.l : 0;
      // dF/dP of T·e: −k·e·eᵀ − T/ℓ·(I − e·eᵀ)
      j11 += -stiff * q.ex * q.ex - bend * (1 - q.ex * q.ex);
      j12 += -stiff * q.ex * q.ey + bend * q.ex * q.ey;
      j22 += -stiff * q.ey * q.ey - bend * (1 - q.ey * q.ey);
    }
    // A small fictitious spring keeps the step defined while both cables are still slack (J = 0): it dies away as soon as one is taut.
    j11 -= lam;
    j22 -= lam;
    const det = j11 * j22 - j12 * j12;
    if (!Number.isFinite(det) || det === 0) return null;
    let sx = (-cur.fx * j22 + cur.fy * j12) / det;
    let sy = (-cur.fy * j11 + cur.fx * j12) / det;
    const step = Math.hypot(sx, sy);
    if (step > reach) {
      sx *= reach / step;
      sy *= reach / step;
    }
    let t = 1;
    let next = cur;
    let q: [number, number] = p;
    for (let b = 0; b < 40; b++) {
      q = [p[0] + t * sx, p[1] + t * sy];
      next = evalAt(q);
      if (Math.hypot(next.fx, next.fy) < norm || b === 39) break;
      t /= 2;
    }
    if (!Number.isFinite(next.fx) || !Number.isFinite(next.fy)) return null;
    p = q;
    cur = next;
  }
  if (Math.hypot(cur.fx, cur.fy) > 1e-9 * scale) return null;
  const T1 = cur.parts[0].T;
  const T2 = cur.parts[1].T;
  const first1 = legs[0].line.T;
  const first2 = legs[1].line.T;
  const ang = (i: number) => Math.atan2(cur.parts[i].ey, Math.abs(cur.parts[i].ex)) / DEG;
  return {
    T1,
    T2,
    angle1: ang(0),
    angle2: ang(1),
    displacement: disp(p[0], p[1]),
    change1: first1 > 0 ? (T1 - first1) / first1 : 0,
    change2: first2 > 0 ? (T2 - first2) / first2 : 0,
    iterations,
  };
}

export function solveLoad(input: LoadInput): LoadOutcome {
  try {
    return solveLoadUnsafe(input);
  } catch {
    return { ok: false, mode: 'load', issues: [{ code: 'size' }] };
  }
}

function solveLoadUnsafe(input: LoadInput): LoadOutcome {
  const bad: Bad[] = [];
  checkNumber(bad, input?.W, 'W', { min: 0 });
  checkNumber(bad, input?.H, 'H');
  checkNumber(bad, input?.dT ?? 0, 'dT');
  checkNumber(bad, input?.n, 'n', { min: 0, minOpen: true, optional: true });
  checkNumber(bad, input?.allowable, 'allowable', { min: 0, minOpen: true, optional: true });
  const legsIn = Array.isArray(input?.legs) ? input.legs : [];
  if (legsIn.length !== 1 && legsIn.length !== 2) bad.push({ code: 'range', field: 'legs', min: 1, max: 2 });
  else {
    legsIn.forEach((l, i) => {
      const leg = (i + 1) as 1 | 2;
      checkNumber(bad, l?.length, 'length', { min: 0, minOpen: true, leg });
      // The angle and the side of a single leg are an output.
      if (legsIn.length === 2) {
        checkNumber(bad, l?.angle, 'angle', { min: 0, max: 90, leg });
        if (l?.side !== 'left' && l?.side !== 'right') bad.push({ code: 'range', field: 'side', leg });
      }
      checkSection(bad, l?.section, leg);
    });
  }
  if (bad.length > 0) return { ok: false, mode: 'load', issues: bad };

  const W = input.W;
  const H = input.H;
  const dT = input.dT ?? 0;
  const scale = Math.abs(W) + Math.abs(H);
  const warnings: LoadWarning[] = [];
  if (scale === 0) warnings.push({ code: 'no-load' });

  // Statics.
  const dirs: { ux: number; uy: number; angle: number; side: Side }[] = [];
  const tensions: number[] = [];
  if (legsIn.length === 1) {
    const R = Math.hypot(H, W);
    if (R === 0) {
      dirs.push({ ux: 0, uy: 1, angle: 90, side: 'left' });
    } else {
      const ux = -H / R;
      const uy = W / R;
      // Exact angle: atan2(W, |H|) (90 when H = 0).
      const angle = H === 0 ? 90 : Math.atan2(W, Math.abs(H)) / DEG;
      dirs.push({ ux: clean(ux), uy, angle, side: H > 0 ? 'left' : H < 0 ? 'right' : 'left' });
    }
    tensions.push(R);
  } else {
    const u1 = unit(legsIn[0].angle, legsIn[0].side);
    const u2 = unit(legsIn[1].angle, legsIn[1].side);
    const det = u1.ux * u2.uy - u1.uy * u2.ux;
    if (Math.abs(det) < PARALLEL) return { ok: false, mode: 'load', issues: [{ code: 'parallel-legs', numbers: [det] }] };
    const Rx = -H;
    const Ry = W;
    const T1 = (Rx * u2.uy - Ry * u2.ux) / det;
    const T2 = (u1.ux * Ry - u1.uy * Rx) / det;
    if (big(T1, T2)) return { ok: false, mode: 'load', issues: [{ code: 'size' }] };
    const tol = 1e-12 * scale;
    for (const [i, T] of [T1, T2].entries()) if (T < -tol) return { ok: false, mode: 'load', issues: [{ code: 'slack-leg', leg: (i + 1) as 1 | 2, numbers: [T1, T2] }] };
    dirs.push({ ...u1, angle: legsIn[0].angle, side: legsIn[0].side }, { ...u2, angle: legsIn[1].angle, side: legsIn[1].side });
    tensions.push(Math.max(0, T1), Math.max(0, T2));
  }

  const legs: LegResult[] = dirs.map((d, i) => {
    const L = legsIn[i].length;
    return {
      leg: (i + 1) as 1 | 2,
      angle: d.angle,
      side: d.side,
      ux: d.ux,
      uy: d.uy,
      anchorX: clean(L * d.ux),
      anchorY: L * d.uy,
      line: cableLine({ T: tensions[i], section: legsIn[i].section, length: L, dT, n: input.n, allowable: input.allowable }),
    };
  });
  const numbers = legs.flatMap((l) => [l.line.stress, l.line.stretch ?? 0, l.line.restrainedForce, l.line.combinedTension, l.line.requiredArea ?? 0]);
  if (big(...numbers)) return { ok: false, mode: 'load', issues: [{ code: 'size' }] };

  // The move of the load point.
  const d1 = legs[0].line.stretch ?? 0;
  let linear: Displacement;
  let exact: Displacement | null;
  let second: SecondOrder | null = null;
  if (legs.length === 1) {
    linear = disp(-d1 * legs[0].ux, -d1 * legs[0].uy);
    exact = linear;
  } else {
    const d2 = legs[1].line.stretch ?? 0;
    const [l1, l2] = legs;
    const det = l1.ux * l2.uy - l1.uy * l2.ux;
    linear = disp((-d1 * l2.uy + d2 * l1.uy) / det, (-l1.ux * d2 + l2.ux * d1) / det);
    const p = legsIn[0].length + d1 > 0 && legsIn[1].length + d2 > 0 ? circles([l1.anchorX, l1.anchorY], legsIn[0].length + d1, [l2.anchorX, l2.anchorY], legsIn[1].length + d2) : null;
    exact = p ? disp(p[0], p[1]) : null;
    if (!exact) warnings.push({ code: 'no-exact-position' });
    if (scale > 0) {
      second = secondOrder(W, H, legs, legsIn, dT, [linear.dx, linear.dy]);
      if (!second) warnings.push({ code: 'no-second-order' });
    }
  }

  legs.forEach((l) => {
    if (l.line.combinedSlack) warnings.push({ code: 'restrained-slack', leg: l.leg });
  });
  legs.forEach((l, i) => {
    const after = l.line.newLength;
    if (after !== null && after <= 0) warnings.push({ code: 'shrinks-past-zero', leg: l.leg, numbers: [after / legsIn[i].length] });
  });
  const maxStrain = Math.max(...legs.map((l) => Math.abs(l.line.strain)));
  if (maxStrain > 0.01) warnings.push({ code: 'large-strain', numbers: [maxStrain] });

  let rx = H;
  let ry = -W;
  legs.forEach((l) => {
    rx += l.line.T * l.ux;
    ry += l.line.T * l.uy;
  });
  return {
    ok: true,
    mode: 'load',
    legs,
    displacement: { linear, exact, exactMinusLinear: exact ? Math.hypot(exact.dx - linear.dx, exact.dy - linear.dy) : null },
    secondOrder: second,
    residual: Math.hypot(rx, ry),
    scale,
    warnings,
  };
}

/* ── Mode 2: pulling a load against friction ───────────────────────────── */

const ZERO = 1e-12;

interface Core {
  c: number;
  den: number;
  rawT: number | null;
  T: number | null;
  N: number | null;
  status: PullStatus;
  role: PullRole | null;
}

/**
 * The formula of types.ts, T = W·c / Den, with its statuses, for one (θ, μ, φ, a/g, σ).
 * `c` and `den` are dimensionless. Exported for the tests and the analysis.
 *
 * WHAT THE CABLE DOES, from the force along the travel g(T) = σ·(T·Den − W·c) (types.ts):
 *   g(0) = −σ·W·c is what the block does with no cable at all, and Den says whether more tension
 *   pushes g up (Den·σ > 0) or down.
 *   along   (σ = +1): Den > 0 & c > 0 the cable DRIVES it, T = W·c/Den; Den > 0 & c < 0, or Den ≤ 0 & c < 0
 *           (a cable that presses the block into the surface: it STOPS a block that already slides) it
 *           moves by itself; Den ≤ 0 & c > 0 more tension only grips harder (self-locking).
 *   against (σ = −1): Den > 0 & c > 0 it slides by itself, the cable RESTRAINS it with T = W·c/Den;
 *           Den > 0 & c < 0 it stays put; Den ≤ 0 & c ≥ 0 it slides whatever the cable does (friction
 *           falls as the cable lifts): 'cannot-hold'; Den < 0 & c < 0 the cable RELEASES it (lifts it off
 *           the friction that held it) at T = W·c/Den.
 *   c = 0 with Den > 0: nothing opposes the motion, T = 0 ('no-pull-needed').
 */
export function pullCore(W: number, theta: number, mu: number, phi: number, aOverG: number, sigma: 1 | -1): Core {
  let c = sind(theta) + sigma * (mu * cosd(theta) + aOverG);
  let den = cosd(phi) + sigma * mu * sind(phi);
  if (Math.abs(c) <= ZERO) c = 0;
  if (Math.abs(den) <= ZERO) den = 0;
  const along = sigma === 1;
  const unaided: PullStatus = along ? 'slides-on-its-own' : 'stays-put';
  const rawT = den === 0 ? null : (W * c) / den;
  const none = (status: PullStatus): Core => ({ c, den, rawT, T: null, N: null, status, role: null });
  if (den > 0) {
    if (c > 0) return pulled(W, theta, phi, c, den, rawT as number, along ? 'drive' : 'restrain');
    if (c === 0) return { c, den, rawT: 0, T: null, N: W * cosd(theta), status: 'no-pull-needed', role: null };
    return none(unaided);
  }
  if (along) return none(c < 0 ? 'slides-on-its-own' : den === 0 && c === 0 ? 'slides-on-its-own' : 'self-locking');
  if (den === 0) return none(c > 0 ? 'cannot-hold' : 'stays-put');
  // against, den < 0
  if (c < 0) return pulled(W, theta, phi, c, den, rawT as number, 'release');
  return none('cannot-hold');
}

function pulled(W: number, theta: number, phi: number, c: number, den: number, rawT: number, role: PullRole): Core {
  const T = rawT;
  let N = W * cosd(theta) - T * sind(phi);
  if (N < -1e-12 * W) return { c, den, rawT, T: null, N, status: 'leaves-surface', role };
  if (N < 0) N = 0;
  return { c, den, rawT, T, N, status: 'pull', role };
}

/** φ_lift of types.ts, degrees, or null past 90°. */
export function liftAngle(theta: number, aOverG: number, sigma: 1 | -1): number | null {
  const x = sind(theta) + sigma * aOverG;
  if (x < 0) return null;
  if (x === 0) return 90;
  return Math.atan2(cosd(theta), x) / DEG;
}

function regime(W: number, theta: number, mu: number, phi: number, aOverG: number, sigma: 1 | -1, id: PullRegimeId): PullRegime {
  const core = pullCore(W, theta, mu, phi, aOverG, sigma);
  const T = core.T;
  const sp = sind(phi);
  const cp = cosd(phi);
  const pl = liftAngle(theta, aOverG, sigma);
  const liftTension = pl === null || !(sind(pl) > 0) ? null : (W * cosd(theta)) / sind(pl);
  // The optimum cable angle and the regime there.
  const phiOpt = sigma * Math.atan(mu) / DEG;
  const at = pullCore(W, theta, mu, phiOpt, aOverG, sigma);
  // The least tension a block that stays on the surface allows: at φ* when the block stays down there; when φ* would lift it off,
  // the least valid tension is at the lift-off angle itself (N = 0), where T = W·cosθ / sinφ_lift.
  let best: PullBest | null = null;
  if (at.status === 'pull' && at.T !== null && at.N !== null) best = { phi: phiOpt, T: at.T, N: at.N, atLiftOff: false };
  else if (at.status === 'leaves-surface' && pl !== null && liftTension !== null) {
    const lp = pullCore(W, theta, mu, pl, aOverG, sigma);
    if (lp.status === 'pull' && lp.role === at.role) best = { phi: pl, T: liftTension, N: 0, atLiftOff: true };
  }
  const optimum: PullOptimum = {
    phi: phiOpt,
    T: at.T,
    N: at.N,
    closedForm: (W * (sind(theta) + sigma * (mu * cosd(theta) + aOverG))) / Math.sqrt(1 + mu * mu),
    valid: at.status === 'pull',
    status: at.status,
    best,
  };
  let hold: PullHold | null = null;
  if (core.status === 'slides-on-its-own') {
    const h = pullCore(W, -theta, mu, phi, aOverG, -1);
    if (h.status === 'pull' && h.role === 'restrain' && h.T !== null && h.N !== null) hold = { T: h.T, N: h.N };
  }
  return {
    id,
    status: core.status,
    role: core.role,
    mu,
    aOverG,
    T,
    rawT: core.rawT,
    N: core.N,
    F: core.N !== null && core.N >= 0 && (T !== null || core.status === 'no-pull-needed') ? mu * core.N : null,
    lift: T === null ? null : clean(T * sp),
    drag: T === null ? null : clean(T * cp),
    weightAlong: clean(W * sind(theta)),
    weightNormal: W * cosd(theta),
    inertia: clean(W * aOverG),
    optimum,
    phiLift: pl,
    liftTension,
    hold,
  };
}

/** The tension and normal force at one cable angle for one regime: what the curve is made of. */
export function pullAt(W: number, theta: number, mu: number, phi: number, aOverG: number, travel: Travel): CurvePoint {
  const sigma = travel === 'along' ? 1 : -1;
  const core = pullCore(W, theta, mu, phi, aOverG, sigma);
  // A cable that only RELEASES the block (it lifts the block off the friction that held it) is not a pull the curve is about: it is in the table, not on the curve.
  return { phi, T: core.T, N: core.N, valid: core.status === 'pull' && core.role !== 'release', status: core.status };
}

export function solvePull(input: PullInput): PullOutcome {
  try {
    return solvePullUnsafe(input);
  } catch {
    return { ok: false, mode: 'pull', issues: [{ code: 'size' }] };
  }
}

function solvePullUnsafe(input: PullInput): PullOutcome {
  const bad: Bad[] = [];
  checkNumber(bad, input?.W, 'W', { min: 0, minOpen: true });
  checkNumber(bad, input?.theta, 'theta', { min: -30, max: 60 });
  checkNumber(bad, input?.muS, 'muS', { min: 0, max: 5 });
  checkNumber(bad, input?.muK, 'muK', { min: 0, max: 5 });
  checkNumber(bad, input?.phi, 'phi', { min: -90, max: 90 });
  if (input?.aOverG !== null && input?.aOverG !== undefined) {
    checkNumber(bad, input.aOverG, 'aOverG', { min: -10, max: 10 });
  }
  if (input?.travel !== 'along' && input?.travel !== 'against') bad.push({ code: 'range', field: 'travel' });
  if (bad.length > 0) return { ok: false, mode: 'pull', issues: bad as PullIssue[] };

  const { W, theta, muS, muK, phi } = input;
  const sigma: 1 | -1 = input.travel === 'along' ? 1 : -1;
  const a = input.aOverG ?? 0;
  const regimes: PullRegime[] = [regime(W, theta, muS, phi, 0, sigma, 'start'), regime(W, theta, muK, phi, 0, sigma, 'run')];
  if (a !== 0) regimes.push(regime(W, theta, muK, phi, a, sigma, 'accel'));
  const nums = regimes.flatMap((r) => [r.T ?? 0, r.N ?? 0, r.rawT ?? 0, r.liftTension ?? 0, r.optimum.closedForm, r.hold?.T ?? 0]);
  if (big(...nums)) return { ok: false, mode: 'pull', issues: [{ code: 'size' }] };

  const curves = regimes.map((r) => {
    const points: CurvePoint[] = [];
    for (let k = 0; k < CURVE_POINTS; k++) points.push(pullAt(W, theta, r.mu, -90 + k * CURVE_STEP, r.aOverG, input.travel));
    let minIndex: number | null = null;
    points.forEach((p, k) => {
      if (p.valid && p.T !== null && (minIndex === null || p.T < (points[minIndex].T as number))) minIndex = k;
    });
    return { regime: r.id, points, minIndex };
  });

  let governing: PullRegimeId | null = null;
  let top = 0;
  for (const r of regimes) if (r.status === 'pull' && r.T !== null && r.T > top) {
    top = r.T;
    governing = r.id;
  }
  const warnings: PullWarning[] = [];
  if (muK > muS) warnings.push({ code: 'kinetic-above-static', numbers: [muS, muK] });
  if (governing === null) warnings.push({ code: 'no-governing' });
  const s = sind(theta);
  const co = cosd(theta);
  return { ok: true, mode: 'pull', regimes, curves, governing, surface: { sx: co, sy: s, nx: -s, ny: co }, warnings };
}

/* ── Mode 3: a cable round a drum or bollard ───────────────────────────── */

const MAX_EXPONENT = 700;
const MAX_MU = 100;
const MAX_BETA = 200 * Math.PI;

export function solveDrum(input: DrumInput): DrumOutcome {
  try {
    return solveDrumUnsafe(input);
  } catch {
    return { ok: false, mode: 'drum', issues: [{ code: 'overflow' }] };
  }
}

function solveDrumUnsafe(input: DrumInput): DrumOutcome {
  const given: Record<DrumUnknown, number | null> = {
    Tbig: input?.Tbig ?? null,
    Tsmall: input?.Tsmall ?? null,
    mu: input?.mu ?? null,
    beta: input?.beta ?? null,
  };
  const bad: Bad[] = [];
  checkNumber(bad, given.Tbig, 'Tbig', { min: 0, minOpen: true, optional: true });
  checkNumber(bad, given.Tsmall, 'Tsmall', { min: 0, minOpen: true, optional: true });
  checkNumber(bad, given.mu, 'mu', { min: 0, max: MAX_MU, optional: true });
  checkNumber(bad, given.beta, 'beta', { min: 0, max: MAX_BETA, optional: true });
  if (bad.length > 0) return { ok: false, mode: 'drum', issues: bad as DrumIssue[] };
  const blanks = (Object.keys(given) as DrumUnknown[]).filter((k) => given[k] === null);
  if (blanks.length === 0) return { ok: false, mode: 'drum', issues: [{ code: 'overdetermined' }] };
  if (blanks.length > 1) return { ok: false, mode: 'drum', issues: [{ code: 'underdetermined', count: blanks.length }] };
  const solved = blanks[0];
  let { Tbig, Tsmall, mu, beta } = given;
  let ratio: number;
  let exponent: number;
  const fail = (issue: DrumIssue): DrumOutcome => ({ ok: false, mode: 'drum', issues: [issue] });

  if (solved === 'Tbig' || solved === 'Tsmall') {
    exponent = (mu as number) * (beta as number);
    if (exponent > MAX_EXPONENT) return fail({ code: 'overflow', numbers: [exponent] });
    ratio = Math.exp(exponent);
    if (solved === 'Tbig') Tbig = (Tsmall as number) * ratio;
    else Tsmall = (Tbig as number) / ratio;
    if (big(Tbig as number, Tsmall as number) || (Tsmall as number) === 0) return fail({ code: 'overflow', numbers: [exponent] });
  } else {
    const Tb = Tbig as number;
    const Ts = Tsmall as number;
    if (Tb < Ts) return fail({ code: 'order', numbers: [Tb, Ts] });
    ratio = Tb / Ts;
    // The logarithm of the ratio, from the ratio when it is a number and from the two logarithms when it is not.
    const lnr = ratio === 1 ? 0 : Number.isFinite(ratio) && ratio > 0 ? Math.log(ratio) : Math.log(Tb) - Math.log(Ts);
    if (solved === 'mu') {
      if (beta === 0) return fail({ code: 'degenerate', field: 'mu', numbers: [Tb, Ts] });
      mu = lnr / (beta as number);
    } else {
      if (mu === 0) return fail({ code: 'degenerate', field: 'beta', numbers: [Tb, Ts] });
      beta = lnr / (mu as number);
    }
    exponent = lnr;
    if (exponent > MAX_EXPONENT) return fail({ code: 'overflow', numbers: [exponent] });
  }
  const Tb = Tbig as number;
  const Ts = Tsmall as number;
  const b = beta as number;
  const rx = -Ts * sind(b / DEG);
  const ry = -Tb + Ts * cosd(b / DEG);
  const warnings: { code: DrumWarningCode; field?: DrumUnknown; max?: number }[] = [];
  if (mu === 0) warnings.push({ code: 'no-friction' });
  if (b === 0) warnings.push({ code: 'no-wrap' });
  // A μ or a wrap that is FOUND can be past what the form takes as an entry: typed back, it would be refused.
  if (solved === 'mu' && (mu as number) > MAX_MU) warnings.push({ code: 'beyond-limit', field: 'mu', max: MAX_MU });
  if (solved === 'beta' && b > MAX_BETA) warnings.push({ code: 'beyond-limit', field: 'beta', max: MAX_BETA });
  return {
    ok: true,
    mode: 'drum',
    solved,
    Tbig: Tb,
    Tsmall: Ts,
    mu: mu as number,
    beta: b,
    ratio,
    exponent,
    resultant: Math.hypot(rx, ry),
    resultantX: clean(rx),
    resultantY: clean(ry),
    resultantAngle: Math.atan2(ry, rx) / DEG,
    warnings,
  };
}
