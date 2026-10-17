/**
 * An INDEPENDENT reference for the cable equation, for the tests only: adaptive RK4 (step doubling) in the stretched arc length,
 * shooting on the slope at A. It shares nothing with the engine (no Gauss-Legendre, no asinh quadrature, no nested solves). The adversarial
 * review of the calculator wrote it; the tests that compare the engine with it are in review-fixes.test.ts.
 */
// Independent reference solver for the cable ODE: adaptive RK4 (step doubling) in the stretched arc length s,
// shooting on the slope at A. Nothing shared with the engine (no Gauss-Legendre, no asinh quadrature).
export interface Set {
  L: number;
  h: number;
  q: number;
  w: number;
  EA: number | null;
}

export interface Ref {
  H: number;
  pA: number;
  pB: number;
  S: number;
  S0: number;
  sagMid: number;
  vx: number | null; // x of the lowest point if inside
  vz: number | null;
  sagLow: number;
  TA: number;
  TB: number;
  inside: boolean;
}

type Y = [number, number, number, number];

function mk(set: Set, H: number) {
  const e = set.EA === null ? 0 : H / set.EA;
  const f = (y: Y): Y => {
    const c = Math.cos(y[2]);
    const r = 1 / c;
    const lam = set.q + (set.w * r) / (1 + e * r);
    return [c, Math.sin(y[2]), (lam * c * c * c) / H, 1 / (1 + e * r)];
  };
  const rk4 = (y: Y, h: number): Y => {
    const k1 = f(y);
    const k2 = f([y[0] + 0.5 * h * k1[0], y[1] + 0.5 * h * k1[1], y[2] + 0.5 * h * k1[2], y[3] + 0.5 * h * k1[3]]);
    const k3 = f([y[0] + 0.5 * h * k2[0], y[1] + 0.5 * h * k2[1], y[2] + 0.5 * h * k2[2], y[3] + 0.5 * h * k2[3]]);
    const k4 = f([y[0] + h * k3[0], y[1] + h * k3[1], y[2] + h * k3[2], y[3] + h * k3[3]]);
    return [0, 1, 2, 3].map((i) => y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as Y;
  };
  return { f, rk4 };
}

interface Event {
  g: (y: Y, s: number) => number;
}

/** integrate from A with slope pA until x = L; returns final state + stretched length + event states */
function shoot(set: Set, H: number, pA: number, events: Event[] = [], rtol = 1e-12): { y: Y; s: number; ev: (Y | null)[] } | null {
  const { rk4 } = mk(set, H);
  let y: Y = [0, 0, Math.atan(pA), 0];
  let s = 0;
  let h = set.L * 1e-4;
  const atol = 1e-14 * Math.max(set.L, 1);
  const ev: (Y | null)[] = events.map(() => null);
  const gPrev = events.map((e) => e.g(y, s));
  for (let it = 0; it < 5_000_000; it++) {
    const y1 = rk4(y, h);
    const yh = rk4(y, h / 2);
    const y2 = rk4(yh, h / 2);
    let err = 0;
    for (let i = 0; i < 4; i++) err = Math.max(err, Math.abs(y1[i] - y2[i]) / (atol + rtol * Math.abs(y2[i])));
    if (!Number.isFinite(err)) return null;
    if (err > 1) {
      h *= Math.max(0.2, 0.9 * Math.pow(err, -0.2));
      if (h < 1e-300) return null;
      continue;
    }
    // accepted (use the better y2)
    if (y2[0] >= set.L) {
      // find step h' with x = L
      let lo = 0;
      let hi = h;
      for (let k = 0; k < 200; k++) {
        const mid = 0.5 * (lo + hi);
        const ym = rk4(y, mid);
        if (ym[0] < set.L) lo = mid;
        else hi = mid;
        if (hi - lo < 1e-16 * h) break;
      }
      // events inside the last piece
      const hs = 0.5 * (lo + hi);
      const yEnd = rk4(y, hs);
      events.forEach((e, i) => {
        if (ev[i]) return;
        const g0 = gPrev[i];
        const g1 = e.g(yEnd, s + hs);
        if (g0 * g1 < 0) ev[i] = findEv(rk4, e, y, s, hs, g0);
      });
      return { y: yEnd, s: s + hs, ev };
    }
    events.forEach((e, i) => {
      const g1 = e.g(y2, s + h);
      if (!ev[i] && gPrev[i] * g1 < 0) ev[i] = findEv(rk4, e, y, s, h, gPrev[i]);
      gPrev[i] = g1;
    });
    y = y2;
    s += h;
    h *= Math.min(3, 0.9 * Math.pow(Math.max(err, 1e-10), -0.2));
  }
  return null;
}

function findEv(rk4: (y: Y, h: number) => Y, e: Event, y: Y, s: number, h: number, g0: number): Y {
  let lo = 0;
  let hi = h;
  for (let k = 0; k < 200; k++) {
    const mid = 0.5 * (lo + hi);
    const gm = e.g(rk4(y, mid), s + mid);
    if (gm * g0 > 0) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-16 * h) break;
  }
  return rk4(y, 0.5 * (lo + hi));
}

/** Reference cable for a given H, or null. */
export function refForward(set: Set, H: number): Ref | null {
  const c = set.h / set.L;
  const zAt = (t: number): number => {
    const pA = c - Math.exp(t);
    const r = shoot(set, H, pA, [], 1e-11);
    return r ? r.y[1] - set.h : Number.NaN;
  };
  // z(L) - h decreases with delta (t). bracket
  let lo = -30;
  let hi = 25;
  const flo = zAt(lo);
  const fhi = zAt(hi);
  if (!(flo > 0 && fhi < 0)) {
    return null;
  }
  for (let i = 0; i < 100; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = zAt(mid);
    if (Number.isNaN(fm)) return null;
    if (fm > 0) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-14 * Math.max(1, Math.abs(lo))) break;
  }
  const t = 0.5 * (lo + hi);
  const pA = c - Math.exp(t);
  const evs: Event[] = [
    { g: (y) => y[0] - set.L / 2 },
    { g: (y) => y[2] },
  ];
  const r = shoot(set, H, pA, evs, 1e-13);
  if (!r) return null;
  const mid = r.ev[0];
  const vtx = r.ev[1];
  const sagMid = mid ? c * (set.L / 2) - mid[1] : Number.NaN;
  const pB = Math.tan(r.y[2]);
  const inside = pA < 0 && pB > 0;
  const lowLevel = Math.min(0, set.h);
  const TA = H * Math.hypot(1, pA);
  const TB = H * Math.hypot(1, pB);
  return {
    H,
    pA,
    pB,
    S: r.s,
    S0: r.y[3],
    sagMid,
    vx: vtx ? vtx[0] : null,
    vz: vtx ? vtx[1] : null,
    sagLow: inside && vtx ? Math.max(0, lowLevel - vtx[1]) : 0,
    TA,
    TB,
    inside,
  };
}

/** bisect a decreasing-in-H quantity (sag, length...) in log H */
export function refSolve(set: Set, pick: (r: Ref) => number, target: number, decreasing: boolean, lo: number, hi: number, tol = 1e-12): Ref | null {
  let a = Math.log(lo);
  let b = Math.log(hi);
  let ra: Ref | null = null;
  for (let i = 0; i < 80; i++) {
    const m = 0.5 * (a + b);
    const r = refForward(set, Math.exp(m));
    if (!r) return null;
    const v = pick(r) - target;
    ra = r;
    if (Math.abs(v) <= tol * Math.abs(target)) return r;
    if (decreasing === v > 0) a = m;
    else b = m;
    if (b - a < 1e-15) break;
  }
  return ra;
}

/* ── closed forms ───────────────────────────────────────────────────── */

/** rigid catenary w only (q = 0), supports (0,0), (L,h), given a = H/w. */
export function catenaryClosed(L: number, h: number, a: number) {
  const xi = L / (2 * a);
  const eta = Math.asinh(h / (2 * a * Math.sinh(xi)));
  const x0 = L / 2 - a * eta; // x of the lowest point (may be outside)
  const z = (x: number) => a * Math.cosh((x - x0) / a) - a * Math.cosh(x0 / a);
  const S = 2 * a * Math.sinh(xi) * Math.cosh(eta);
  const sagMid = (h / 2) - z(L / 2);
  return { x0, S, sagMid, z, zv: z(x0), TA: a * Math.cosh(x0 / a), TB: a * Math.cosh((L - x0) / a) };
}
