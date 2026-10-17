/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CABLE SAG AND PRETENSION — the two numerical tools the engine stands on
 * ─────────────────────────────────────────────────────────────────────────────
 * Nothing here knows what a cable is.
 *
 *   GL_X, GL_W   the 8-point Gauss–Legendre rule (positive half). On a panel
 *                the engine keeps narrower than half a unit of asinh(slope)
 *                its integrands are analytic at least π/2 away from the real
 *                axis, so the rule is exact to rounding for the cables met in
 *                practice; measured against an independent solver the worst
 *                single-panel case (half-slope ~0.37, sag/span ~0.09) is off by
 *                3e-13 of the integral, which is still far below any figure shown.
 *   illinois     a bracketed root finder (false position with the Illinois
 *                halving, and a bisection every eighth step so that the
 *                bracket always closes). It never leaves its bracket, so it
 *                cannot diverge; on a smooth function it takes 6 to 12 steps.
 *   bracketFrom  walks from a first guess, in steps that double, until a
 *                monotone function changes sign (or the walk reaches a wall).
 *   argminLog    golden-section search for the minimum of a unimodal function.
 *
 * Tolerances are RELATIVE (1e-14 of the root) so that a root of 1e-9 and a
 * root of 1e9 are both found to 14 figures.
 */

export const GL_X = [0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363] as const;
export const GL_W = [0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763] as const;

/**
 * The root of `f` between `a` and `b`, given `fa = f(a)` and `fb = f(b)` of opposite
 * signs (or one of them zero). Returns NaN if `f` ever returns a number that is not
 * finite — the callers turn that into a diagnostic, never into a result.
 */
export function illinois(f: (x: number) => number, a: number, b: number, fa: number, fb: number, relTol = 1e-14, maxIter = 140, absTol = 0, fTol = 0): number {
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Number.isNaN(fa) || Number.isNaN(fb)) return Number.NaN;
  for (let i = 0; i < maxIter; i++) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    let x = b - (fb * (b - a)) / (fb - fa);
    if (!(x > lo && x < hi) || i % 8 === 7) x = 0.5 * (a + b);
    const fx = f(x);
    if (Number.isNaN(fx)) return Number.NaN;
    if (fx === 0 || Math.abs(fx) <= fTol) return x;
    if (fx * fb < 0) {
      a = b;
      fa = fb;
    } else {
      fa /= 2;
    }
    b = x;
    fb = fx;
    if (Math.abs(b - a) <= absTol + relTol * Math.max(Math.abs(a), Math.abs(b), 1e-300)) return b;
  }
  return b;
}

/**
 * A root of a smooth `f` inside a bracket [a, b] with f(a), f(b) of opposite signs, by Newton's method kept inside
 * the bracket (a step that leaves it, or a derivative that is not positive, is replaced by a bisection). `fn` returns
 * [f(x), f'(x)] and may return a NaN, which ends the search with NaN. It starts at the false-position point and takes
 * 3 to 6 steps on a smooth function — where Illinois needs 10 to 40 when the root is at one end of the bracket.
 */
export function safeNewton(fn: (x: number) => [number, number], a: number, b: number, fa: number, fb: number, relTol = 1e-14, absTol = 0, fTol = 0, maxIter = 100): number {
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Number.isNaN(fa) || Number.isNaN(fb)) return Number.NaN;
  let lo = fa < 0 ? a : b;
  let hi = fa < 0 ? b : a;
  let x = Number.isFinite(fa) && Number.isFinite(fb) ? a - (fa * (b - a)) / (fb - fa) : 0.5 * (a + b);
  if (!(x > Math.min(a, b) && x < Math.max(a, b))) x = 0.5 * (a + b);
  for (let i = 0; i < maxIter; i++) {
    const [f, df] = fn(x);
    if (Number.isNaN(f) || Number.isNaN(df)) return Number.NaN;
    if (f === 0 || Math.abs(f) <= fTol) return x;
    if (f < 0) lo = x;
    else hi = x;
    let next = df > 0 && Number.isFinite(df) ? x - f / df : Number.NaN;
    const inside = next > Math.min(lo, hi) && next < Math.max(lo, hi);
    if (!inside) next = 0.5 * (lo + hi);
    if (Math.abs(next - x) <= absTol + relTol * Math.abs(next)) return next;
    x = next;
  }
  return x;
}

export interface Bracket {
  a: number;
  b: number;
  fa: number;
  fb: number;
}

/**
 * Walks from `x0` until `f` changes sign (an infinite value is a value with a sign: "too slack to compute"). `increasing` says which way `f` goes with x,
 * so the walk knows which way to turn. Steps start at `step` and double; the walk stops
 * at `min` / `max`. Returns null where there is no sign change inside [min, max].
 */
export function bracketFrom(f: (x: number) => number, x0: number, step: number, min: number, max: number, increasing: boolean): Bracket | null {
  x0 = Math.min(max, Math.max(min, x0));
  const f0 = f(x0);
  if (Number.isNaN(f0)) return null;
  if (f0 === 0) return { a: x0, b: x0, fa: 0, fb: 0 };
  // The direction in which |f| must shrink: up if f is negative and increasing, or positive and decreasing.
  const up = (f0 < 0) === increasing;
  let prev = x0;
  let fprev = f0;
  let s = step;
  for (let i = 0; i < 80; i++) {
    let x = up ? prev + s : prev - s;
    const atWall = up ? x >= max : x <= min;
    if (atWall) x = up ? max : min;
    const fx = f(x);
    if (Number.isNaN(fx)) return null;
    if (fx === 0 || fx * fprev < 0) return { a: prev, b: x, fa: fprev, fb: fx };
    if (atWall) return null;
    prev = x;
    fprev = fx;
    s *= 2;
  }
  return null;
}

/** The x in [lo, hi] where a unimodal `f` is smallest, by golden-section search (to a relative width of ~1e-9). */
export function argmin(f: (x: number) => number, lo: number, hi: number): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < 90 && b - a > 1e-10 * Math.max(1, Math.abs(a), Math.abs(b)); i++) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - g * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + g * (b - a);
      fd = f(d);
    }
  }
  return 0.5 * (a + b);
}
