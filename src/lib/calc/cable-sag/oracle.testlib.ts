/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ORACLES for the cable engine — they share NO code with it
 * ─────────────────────────────────────────────────────────────────────────────
 * The engine (shape.ts) integrates  dx = H·dp/λ(p)  in the slope. Nothing here does.
 *
 *   shoot            the PHYSICAL formulation, integrated by fixed-step RK4 along the cable's
 *                    UNSTRETCHED length s0 (Irvine's elastic cable): a cable element of
 *                    unstretched length ds0 and tension T has the stretched length
 *                    ds = ds0·(1 + T/EA), carries the weight w·ds0, and the horizontal run
 *                    dx = ds·H/T; the load q acts per unit of that run. Unknowns: the vertical
 *                    force V0 at A and the unstretched length Lu, found by Newton so that the
 *                    far end is at (L, h). EA = Infinity is the inextensible cable.
 *   catenaryLevel,
 *   catenaryOn       the closed forms a(cosh(x/a) − 1), and the inclined catenary by its two
 *                    boundary conditions solved directly (bisection on the vertex position).
 *   parabolaClosed   the closed forms of the parabola under q per horizontal length.
 *   rng              a seeded generator.
 */

/** A seeded generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const between = (r: () => number, a: number, b: number): number => a + (b - a) * r();
export const logBetween = (r: () => number, a: number, b: number): number => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * r());

/* ── Closed forms ─────────────────────────────────────────────────────── */

/** Level catenary under w per unit length: H = w·a; the cable z = a(cosh(x/a) − 1) from the vertex. */
export function catenaryLevel(w: number, L: number, a: number) {
  const d = 2 * a * Math.sinh(L / (4 * a)) ** 2; // a(cosh z − 1) without the cancellation of a tiny z
  return { H: w * a, sag: d, length: 2 * a * Math.sinh(L / (2 * a)), T: w * a * Math.cosh(L / (2 * a)), V: w * a * Math.sinh(L / (2 * a)) };
}

/** The a with sag d on a level span, by bisection on the closed form. */
export function aForLevelSag(L: number, d: number): number {
  let lo = 1e-6 * L;
  let hi = 1e9 * L;
  for (let i = 0; i < 300; i++) {
    const mid = Math.sqrt(lo * hi);
    const f = 2 * mid * Math.sinh(L / (4 * mid)) ** 2 - d;
    if (f > 0) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

/**
 * An inclined catenary (support B at (L, h) over A at the origin), parameter a = H/w. The
 * vertex abscissa x0 (from A) follows from the second boundary condition,
 * a[cosh((L − x0)/a) − cosh(x0/a)] = h, solved by bisection — it is monotone in x0.
 */
export function catenaryOn(w: number, L: number, h: number, a: number) {
  let lo = -50 * L - 50 * a;
  let hi = 50 * L + 50 * a;
  const g = (x0: number) => {
    // cosh(u) − cosh(v) = 2 sinh((u+v)/2) sinh((u−v)/2), stable for large arguments
    return 2 * a * Math.sinh(L / (2 * a)) * Math.sinh((L - 2 * x0) / (2 * a)) - h;
  };
  // g decreases with x0
  for (let i = 0; i < 300; i++) {
    const mid = 0.5 * (lo + hi);
    if (g(mid) > 0) lo = mid;
    else hi = mid;
  }
  const x0 = 0.5 * (lo + hi);
  const zOf = (x: number) => a * (Math.cosh((x - x0) / a) - Math.cosh(x0 / a));
  const TA = w * a * Math.cosh(x0 / a);
  const TB = w * a * Math.cosh((L - x0) / a);
  const slopeA = -Math.sinh(x0 / a);
  const slopeB = Math.sinh((L - x0) / a);
  // a(sinh u − sinh v) = 2a cosh((u+v)/2) sinh((u−v)/2): no cancellation when the vertex is outside the span
  const length = 2 * a * Math.cosh((L - 2 * x0) / (2 * a)) * Math.sinh(L / (2 * a));
  const sagMid = h / 2 - zOf(L / 2);
  const inside = x0 > 0 && x0 < L;
  const vertexZ = zOf(x0);
  return { x0, TA, TB, slopeA, slopeB, length, sagMid, inside, vertexZ, sagLow: inside ? Math.min(0, h) - vertexZ : 0, H: w * a };
}

/** The a that gives a mid-span sag d on the inclined span, by bisection on `catenaryOn` (the sag falls as a grows). */
export function aForSagMid(w: number, L: number, h: number, d: number): number {
  let lo = 1e-4 * L;
  let hi = 1e8 * L;
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);
    if (catenaryOn(w, L, h, mid).sagMid > d) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

/** The parabola under q per horizontal length, with the horizontal tension H, on a span of rise h. */
export function parabolaClosed(q: number, L: number, h: number, H: number) {
  const c = h / L;
  const slopeA = c - (q * L) / (2 * H);
  const slopeB = c + (q * L) / (2 * H);
  // ∫√(1+p²)dp from slopeA to slopeB = ½[p·r + asinh p]; its differences written without cancellation when the slopes have one sign
  const A = slopeA;
  const B = slopeB;
  const rA = Math.hypot(1, A);
  const rB = Math.hypot(1, B);
  const pr = A * B >= 0 ? ((B * B - A * A) * (1 + A * A + B * B)) / (B * rB + A * rA) : B * rB - A * rA;
  const as = A * B >= 0 ? Math.asinh((B * B - A * A) / (B * rA + A * rB)) : Math.asinh(B) - Math.asinh(A);
  const length = (H / q) * 0.5 * (pr + as);
  return {
    sagMid: (q * L * L) / (8 * H),
    slopeA,
    slopeB,
    TA: H * Math.hypot(1, slopeA),
    TB: H * Math.hypot(1, slopeB),
    length,
    x0: (-slopeA * H) / q,
  };
}

/* ── The shooting oracle ──────────────────────────────────────────────── */

export interface ShotState {
  x: number;
  z: number;
  V: number;
  /** Stretched length so far. */
  s: number;
}

/** One RK4 integration from A along the unstretched length, N steps to s0 = Lu. */
export function shoot(H: number, q: number, w: number, EA: number, V0: number, Lu: number, N: number, record?: ShotState[]): ShotState {
  const f = (V: number): [number, number, number, number] => {
    const T = Math.hypot(H, V);
    const stretch = 1 + T / EA; // ds / ds0
    const dxds0 = (H / T) * stretch; // dx / ds0
    return [dxds0, (V / T) * stretch, w + q * dxds0, stretch];
  };
  let x = 0;
  let z = 0;
  let V = V0;
  let s = 0;
  const h = Lu / N;
  if (record) record.push({ x, z, V, s });
  for (let i = 0; i < N; i++) {
    const k1 = f(V);
    const k2 = f(V + 0.5 * h * k1[2]);
    const k3 = f(V + 0.5 * h * k2[2]);
    const k4 = f(V + h * k3[2]);
    x += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    z += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    V += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    s += (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
    if (record) record.push({ x, z, V, s });
  }
  return { x, z, V, s };
}

export interface Shot {
  V0: number;
  Lu: number;
  VB: number;
  s: number;
  sagMid: number;
  pA: number;
  pB: number;
}

/**
 * The cable with horizontal tension H between A and B(L, h): Newton in (V0, Lu) with a finite-difference Jacobian,
 * from the starting guess given. `N` RK4 steps (each run).
 */
export function solveShot(H: number, q: number, w: number, EA: number, L: number, h: number, V0: number, Lu: number, N = 3000): Shot | null {
  const res = (v: number, lu: number): [number, number] => {
    const e = shoot(H, q, w, EA, v, lu, N);
    return [e.x - L, e.z - h];
  };
  for (let it = 0; it < 60; it++) {
    const [rx, rz] = res(V0, Lu);
    if (Math.hypot(rx, rz) <= 1e-12 * (L + Math.abs(h))) break;
    const dv = 1e-7 * Math.max(Math.abs(V0), H, 1e-9);
    const dl = 1e-7 * Lu;
    const [ax, az] = res(V0 + dv, Lu);
    const [bx, bz] = res(V0, Lu + dl);
    const j11 = (ax - rx) / dv;
    const j21 = (az - rz) / dv;
    const j12 = (bx - rx) / dl;
    const j22 = (bz - rz) / dl;
    const det = j11 * j22 - j12 * j21;
    if (!Number.isFinite(det) || det === 0) return null;
    const dV = (-rx * j22 + rz * j12) / det;
    const dL = (-j11 * rz + j21 * rx) / det;
    // Damped step: never let the length fall below the chord.
    let step = 1;
    while (Lu + step * dL <= Math.hypot(L, h) * 0.5 && step > 1e-6) step /= 2;
    V0 += step * dV;
    Lu += step * dL;
    if (!Number.isFinite(V0) || !Number.isFinite(Lu)) return null;
  }
  const rec: ShotState[] = [];
  const end = shoot(H, q, w, EA, V0, Lu, N, rec);
  if (Math.hypot(end.x - L, end.z - h) > 1e-7 * (L + Math.abs(h))) return null;
  // The cable at x = L/2: interpolate between the two recorded points around it (cubic Hermite on z with slope V/H).
  let k = 0;
  while (k + 1 < rec.length && rec[k + 1].x < L / 2) k++;
  const a = rec[k];
  const b = rec[Math.min(k + 1, rec.length - 1)];
  const dx = b.x - a.x;
  const t = dx === 0 ? 0 : (L / 2 - a.x) / dx;
  const m0 = (a.V / H) * dx;
  const m1 = (b.V / H) * dx;
  const t2 = t * t;
  const t3 = t2 * t;
  const zMid = (2 * t3 - 3 * t2 + 1) * a.z + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b.z + (t3 - t2) * m1;
  return { V0, Lu, VB: end.V, s: end.s, sagMid: h / 2 - zMid, pA: V0 / H, pB: end.V / H };
}

/**
 * The same cable when the UNSTRETCHED LENGTH is given and H is not: Newton in (H, V0) from the starting guess,
 * for a fixed Lu. This is the change of state of a cable seen from the physics: the length it has (after the
 * temperature has acted) is what stays fixed, and the horizontal tension is whatever lets it reach B.
 */
export function solveShotFixedLength(q: number, w: number, EA: number, L: number, h: number, Lu: number, H0: number, V00: number, N = 3000): { H: number; V0: number; VB: number; s: number; sagMid: number } | null {
  let H = H0;
  let V0 = V00;
  const res = (hh: number, v: number): [number, number] => {
    const e = shoot(hh, q, w, EA, v, Lu, N);
    return [e.x - L, e.z - h];
  };
  for (let it = 0; it < 80; it++) {
    const [rx, rz] = res(H, V0);
    if (Math.hypot(rx, rz) <= 1e-12 * (L + Math.abs(h))) break;
    const dh = 1e-7 * H;
    const dv = 1e-7 * Math.max(Math.abs(V0), H);
    const [ax, az] = res(H + dh, V0);
    const [bx, bz] = res(H, V0 + dv);
    const j11 = (ax - rx) / dh;
    const j21 = (az - rz) / dh;
    const j12 = (bx - rx) / dv;
    const j22 = (bz - rz) / dv;
    const det = j11 * j22 - j12 * j21;
    if (!Number.isFinite(det) || det === 0) return null;
    const dH = (-rx * j22 + rz * j12) / det;
    const dV = (-j11 * rz + j21 * rx) / det;
    let step = 1;
    while (H + step * dH <= 0.05 * H && step > 1e-6) step /= 2;
    H += step * dH;
    V0 += step * dV;
    if (!Number.isFinite(H) || !Number.isFinite(V0)) return null;
  }
  const rec: ShotState[] = [];
  const end = shoot(H, q, w, EA, V0, Lu, N, rec);
  if (Math.hypot(end.x - L, end.z - h) > 1e-7 * (L + Math.abs(h))) return null;
  let k = 0;
  while (k + 1 < rec.length && rec[k + 1].x < L / 2) k++;
  const a = rec[k];
  const b = rec[Math.min(k + 1, rec.length - 1)];
  const dx = b.x - a.x;
  const t = dx === 0 ? 0 : (L / 2 - a.x) / dx;
  const m0 = (a.V / H) * dx;
  const m1 = (b.V / H) * dx;
  const t2 = t * t;
  const t3 = t2 * t;
  const zMid = (2 * t3 - 3 * t2 + 1) * a.z + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b.z + (t3 - t2) * m1;
  return { H, V0, VB: end.V, s: end.s, sagMid: h / 2 - zMid };
}
