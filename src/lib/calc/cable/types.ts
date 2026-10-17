/**
 * ─────────────────────────────────────────────────────────────────
 * CABLE TENSION AND ELONGATION — what the engine is given and what it returns
 * ─────────────────────────────────────────────────────────────────
 * The sixth calculator of the catalogue ("Cable tension and elongation",
 * /resources/cable): "Tension, stress and elastic and thermal stretch of a
 * cable; pulling a load against friction." Three modes share one cable section:
 *
 *   'load'  a weight W (and a horizontal force H on the same point) held by ONE
 *           cable or by a TWO-LEG sling (statically determinate): tension in each
 *           leg, stress, elastic and thermal stretch, the displacement of the load
 *           point, and the force a leg would carry if its ends could not move.
 *   'pull'  a block of weight W on a surface inclined θ, pulled by a cable at an
 *           angle φ to the surface, with friction: the tension to START the
 *           motion, to KEEP it going, and with an acceleration; the best cable
 *           angle; the curve T(φ); then the cable's stress and stretch.
 *   'drum'  a cable round a drum or bollard (capstan, belt friction):
 *           T_big = T_small · e^(μβ). Exactly one of the four quantities is left
 *           blank and is solved.
 *
 * This file is the agreement between the engine (engine.ts), the form (model.ts),
 * the analysis (analysis.ts), the page strings and the drawings. It holds types,
 * the tables (materials, rope factors) and the few limits all of them share.
 *
 * PURE STATICS AND ELASTICITY. NO DESIGN CODE, NO FACTOR OF SAFETY RULE, NO
 * VERDICT. The calculator returns numbers: tensions, stresses, stretches, the
 * ratio MBF / T, the MBF that n × T asks for. Whether a cable, a sling, a rope
 * or a fitting is adequate is the engineer's (and the manufacturer's: working
 * load limits, bending over sheaves, D/d ratios, end terminations and the
 * strength of the connections are all outside this calculator).
 *
 * UNITS INSIDE THE ENGINE: any CONSISTENT set — a force F, a length L; then an
 * area is L², a modulus and a stress F/L², a temperature change in degrees of
 * ONE scale, and a coefficient of thermal expansion per degree of that scale.
 * The form works in lbf/kip, ft and in (US) or N/kN, m and mm (SI) and brings
 * everything across in ONE place (model.ts, `TO_ENGINE` / `FROM_ENGINE`):
 * US → lbf, inches, psi, °F;  SI → N, millimetres, MPa (N/mm²), °C.
 * A temperature CHANGE is a difference: it converts with no offset (×9/5, ×5/9).
 *
 * ANGLES are degrees at the boundary of the engine (they are what the visitor
 * types); the arithmetic is in radians inside.
 *
 * ─── THE TYPICAL NUMBERS ARE TYPICAL ────────────────────────────────────────
 * The material presets and the rope metallic-area factors below are TYPICAL
 * values for a first estimate. The manufacturer's catalogue gives the metallic
 * area, the minimum breaking force and the modulus of THE rope bought; the
 * visitor must use those. In particular:
 *
 *   A WIRE ROPE'S EFFECTIVE (APPARENT) MODULUS IS NOT STEEL'S. Wires lie helically
 *   in strands and strands in the rope; under load the rope straightens
 *   (geometric elongation) and the wires bed against each other, so the
 *   stretch per unit load is about twice what the steel of the wires alone gives.
 *   A 6×19 IWRC rope stretches like a material with E ≈ 13,000 ksi (90 GPa),
 *   not 29,000 ksi (200 GPa); a fibre-core rope is softer still, a spiral strand
 *   or locked-coil rope stiffer. Using 29,000 ksi for a rope under-predicts its
 *   stretch by more than half. A new rope also has a permanent CONSTRUCTIONAL
 *   stretch on first loading that no modulus describes (removed by pre-stretching);
 *   this calculator gives the elastic stretch only. The modulus of a rope
 *   depends on its construction, lay, core, the load range and how long it was
 *   pre-stretched: the values are typical, within about ±15 %.
 *
 * ─── CODES ─────────────────────────────────────────────────────────────────
 * Everything that goes wrong, or is worth saying, is a STABLE MACHINE CODE with
 * the numbers its sentence needs. The page writes one sentence per code in both
 * languages. The engine and the analysis contain no words. Codes are listed
 * where their types are declared.
 */

/* ── Limits ─────────────────────────────────────────────────────────────── */

/** The largest magnitude the engine accepts as an input or returns as a result. */
export const MAX_MAGNITUDE = 1e30;
/** Points of the curve T(φ): φ = −90°, −89°, … +90°. */
export const CURVE_STEP = 1;
export const CURVE_POINTS = 181;

/* ── The section and the material ───────────────────────────────────────── */

/**
 * A cable's section as the engine takes it. `A` is the area that carries load
 * (the METALLIC area of a rope); `E` the modulus (the EFFECTIVE modulus of a
 * rope); `alpha` the coefficient of thermal expansion per degree.
 *   mbf     minimum breaking force, F (optional; the manufacturer's, never ours).
 *   factor  A = factor · d² for the nominal diameter d: π/4 for a solid round,
 *           the rope factor for a rope. Only used to turn a required area back
 *           into a nominal diameter (`requiredNominalDiameter`). Null: solid round.
 */
export interface CableSection {
  A: number;
  E: number;
  alpha: number;
  mbf?: number | null;
  factor?: number | null;
}

/** What the engine is told about a cable under one tension (see `cableLine`). */
export interface CableLineInput {
  /** The tension carried, F (≥ 0; the cable cannot carry compression). */
  T: number;
  section: CableSection;
  /** Length L of the cable. Null: not given — then no stretch is returned. */
  length: number | null;
  /** Temperature change, in degrees (a difference). Default 0. */
  dT?: number;
  /** Design factor n (> 0): the MBF that n × T asks for. Null: not given. */
  n?: number | null;
  /** Allowable stress, F/L² (> 0): the area and the solid round diameter T asks for. Null: not given. */
  allowable?: number | null;
}

/**
 * One cable under one tension. Every quantity is exact arithmetic on T; nothing
 * here is rounded. TENSION IS POSITIVE; the restrained thermal force is signed
 * (tension positive).
 *
 *   stress     σ = T / A
 *   strain     ε = σ / E  (= T / (A·E))
 *   elastic    δe = T·L / (A·E)                 null without a length
 *   thermal    δt = α·L·ΔT   (the cable FREE to expand)   null without a length
 *   stretch    δe + δt                          null without a length
 *   newLength  L + δe + δt                      null without a length
 *   restrainedForce   the force when the ends cannot move at all and the
 *                     temperature changes by ΔT: F = −E·A·α·ΔT. A rise (ΔT > 0)
 *                     gives COMPRESSION (negative: a real cable goes slack); a
 *                     fall (ΔT < 0) gives TENSION  E·A·α·|ΔT|.
 *   restrainedStress  −E·α·ΔT
 *   combinedTension   T + restrainedForce  (the load's tension plus the thermal one)
 *   combinedStress    combinedTension / A
 *   combinedSlack     combinedTension < 0: a cable cannot carry that — it goes slack
 *   mbfRatio          MBF / T  (null without an MBF or when T = 0). A ratio, NOT a verdict.
 *   mbfRatioCombined  MBF / combinedTension (null unless the combined tension is > 0)
 *   requiredMbf       n × T                              null without n
 *   requiredArea      T / allowable                      null without an allowable stress or at T = 0
 *   requiredDiameter  √(4·requiredArea / π): the smallest SOLID ROUND   null as above
 *   requiredNominalDiameter  √(requiredArea / factor) for the section's own factor
 *                     (a rope's nominal diameter); equals requiredDiameter for a solid round.
 */
export interface CableLine {
  T: number;
  A: number;
  E: number;
  alpha: number;
  length: number | null;
  dT: number;
  stress: number;
  strain: number;
  elastic: number | null;
  thermal: number | null;
  stretch: number | null;
  newLength: number | null;
  restrainedForce: number;
  restrainedStress: number;
  combinedTension: number;
  combinedStress: number;
  combinedSlack: boolean;
  mbf: number | null;
  mbfRatio: number | null;
  mbfRatioCombined: number | null;
  requiredMbf: number | null;
  requiredArea: number | null;
  requiredDiameter: number | null;
  requiredNominalDiameter: number | null;
}

/* ── Materials and ropes (the tables) ───────────────────────────────────── */

export type MaterialId = 'steel' | 'stainless' | 'aluminum' | 'strand7' | 'rope' | 'rope-fibre' | 'rope-spiral' | 'custom';
export const MATERIAL_IDS: MaterialId[] = ['steel', 'stainless', 'aluminum', 'strand7', 'rope', 'rope-fibre', 'rope-spiral', 'custom'];

/** The ropes and strands that have a typical metallic-area factor; 'solid' is a round bar (π/4); 'custom' is a factor the visitor types. */
export type RopeId = 'solid' | 'rope-6x19' | 'rope-6x36' | 'strand7' | 'locked' | 'spiral' | 'custom';
export const ROPE_IDS: RopeId[] = ['solid', 'rope-6x19', 'rope-6x36', 'strand7', 'locked', 'spiral', 'custom'];

/** The modes, in the order the page offers them. */
export type CableMode = 'load' | 'pull' | 'drum';
export const MODES: CableMode[] = ['load', 'pull', 'drum'];

export type Travel = 'along' | 'against';
export type Side = 'left' | 'right';

/* ── Mode 1: a load on a cable or a sling ───────────────────────────────── */

/**
 * COORDINATES: x to the right, y UP, origin at the load point as the visitor
 * describes it (the unstretched, unloaded geometry). A leg runs from the load
 * point UP to its anchor, at `angle` degrees from the horizontal (0 = horizontal,
 * 90 = vertical) towards `side`: the anchor is at L·(±cos angle, sin angle).
 * W acts down (−y). H acts along +x (a positive H pushes the load point to the
 * right; the legs then pull it back to the left).
 *
 * ONE LEG. A single cable with a weight and a horizontal force: equilibrium puts
 * the cable ALONG the resultant of W and H, so its angle is an OUTPUT:
 * tan = W / |H|; `angle` and `side` of the input are ignored and T = √(W² + H²).
 * (H > 0 puts the anchor up and to the LEFT.)
 *
 * TWO LEGS. T1·u1 + T2·u2 + (H, −W) = 0 with u the unit vector to the anchor.
 */
export interface LegInput {
  /** Degrees from the horizontal, 0 to 90. */
  angle: number;
  side: Side;
  /** Length of the leg, L > 0. */
  length: number;
  section: CableSection;
}

export interface LoadInput {
  /** The weight, W ≥ 0 (acts down). */
  W: number;
  /** The horizontal force on the same point, any sign (positive along +x). */
  H: number;
  /** One leg or two. */
  legs: LegInput[];
  /** Temperature change, degrees (a difference): applied to every leg. Default 0. */
  dT?: number;
  n?: number | null;
  allowable?: number | null;
}

export interface LegResult {
  /** 1 or 2. */
  leg: 1 | 2;
  /**
   * The angle from the horizontal actually used, degrees 0–90 (for one leg it is
   * the OUTPUT of equilibrium) and the side.
   */
  angle: number;
  side: Side;
  /** Unit vector from the load point to the anchor. */
  ux: number;
  uy: number;
  /** The anchor, relative to the load point's original position. */
  anchorX: number;
  anchorY: number;
  line: CableLine;
}

/** A position of the load point relative to where it started, and the move itself. */
export interface Displacement {
  dx: number;
  dy: number;
  /** √(dx² + dy²). */
  magnitude: number;
}

/**
 * How the load point moves when the legs stretch by δ1 and δ2.
 *   linear  first order, the standard hand method: u_i · d = −δ_i.
 *   exact   the intersection of two circles about the anchors with the stretched
 *           leg lengths L_i + δ_i; of the two intersections the one nearest the
 *           original position. Null when the circles do not meet
 *           (warning 'no-exact-position').
 * `exactMinusLinear` is |exact − linear|, the second-order error of the standard method.
 */
export interface LoadDisplacement {
  linear: Displacement;
  exact: Displacement | null;
  exactMinusLinear: number | null;
}

/**
 * The tensions recomputed in the DISPLACED geometry (a second-order,
 * geometrically nonlinear equilibrium, solved by a damped Newton iteration):
 * the unloaded cables (length L(1 + α·ΔT), stiffness E·A/that) are hung from the
 * anchors, the load is applied, and the point settles where the forces balance in
 * the deformed shape. First order (the baseline) uses the angles as typed;
 * this uses the angles after the stretch. Two legs only (one leg is exact already:
 * the cable lies along the resultant before and after). Null when it did not
 * converge (warning 'no-second-order').
 */
export interface SecondOrder {
  /** Tensions after the geometry change. */
  T1: number;
  T2: number;
  /** Angles from the horizontal after the change, degrees. */
  angle1: number;
  angle2: number;
  /** Position of the load point relative to the start. */
  displacement: Displacement;
  /** (T − T_first_order) / T_first_order for each leg, as a fraction (0.01 = 1 %); 0 when T is 0. */
  change1: number;
  change2: number;
  iterations: number;
}

export type LoadIssueCode = 'number' | 'range' | 'parallel-legs' | 'slack-leg' | 'size';
export type LoadWarningCode = 'no-load' | 'no-exact-position' | 'no-second-order' | 'restrained-slack' | 'large-strain';

/**
 * Codes (mode 'load'). `field` names an input in the engine's vocabulary:
 * 'W', 'H', 'dT', 'n', 'allowable', 'legs', 'angle', 'length', 'A', 'E', 'alpha', 'mbf', 'factor'; `leg` is 1 or 2.
 *
 *  'number'         a value is not a finite number (or past 1e30)          field, leg?
 *  'range'          a value outside what it can be                        field, leg?, min?, max?, minOpen? (min itself is NOT allowed when true)
 *  'parallel-legs'  the two legs lie on one line: equilibrium cannot be    numbers = [det] (the determinant u1 × u2, |det| < 1e-9)
 *                   told from their directions (e.g. both vertical, or
 *                   both horizontal on opposite sides)
 *  'slack-leg'      equilibrium needs a leg to push: a cable cannot.      leg = the one, numbers = [T1, T2] (raw, signed, in F)
 *  'size'           a result is past 1e30 (legs almost on one line).
 *
 * Warnings (the solution is there):
 *  'no-load'            W and H are both zero: every force is zero.
 *  'no-exact-position'  the stretched legs cannot meet (circles apart).
 *  'no-second-order'    the displaced-geometry equilibrium did not converge.
 *  'restrained-slack'   a leg: the load tension plus the restrained thermal force is
 *                       negative (the cable would go slack)           leg
 *  'large-strain'       the largest strain exceeds 1 %: first-order results (and the
 *                       linearised displacement) are least reliable    numbers = [largest strain]
 */
export interface LoadIssue {
  code: LoadIssueCode;
  field?: string;
  leg?: 1 | 2;
  min?: number;
  max?: number;
  minOpen?: boolean;
  numbers?: number[];
}
export interface LoadWarning {
  code: LoadWarningCode;
  leg?: 1 | 2;
  numbers?: number[];
}

export interface LoadSolution {
  ok: true;
  mode: 'load';
  legs: LegResult[];
  displacement: LoadDisplacement;
  /** Null for one leg. */
  secondOrder: SecondOrder | null;
  /** |T1·u1 + T2·u2 + (H, −W)|: zero but for rounding (floors in analysis.ts). */
  residual: number;
  /** |W| + |H|, the size of the problem as a force: what rounding is measured against. */
  scale: number;
  warnings: LoadWarning[];
}
export interface LoadFailure {
  ok: false;
  mode: 'load';
  issues: LoadIssue[];
}
export type LoadOutcome = LoadSolution | LoadFailure;

/* ── Mode 2: pulling a load against friction ────────────────────────────── */

/**
 * GEOMETRY AND SIGNS. The cable pulls along the surface direction s with an angle
 * φ ABOVE it (measured from the SURFACE, not from the horizontal; the angle to
 * the horizontal is θ + φ). The surface rises at θ degrees along s: θ > 0 the
 * cable pulls UP the slope, θ < 0 DOWN it, θ = 0 level. φ > 0 lifts the load
 * (lessens the normal force), φ < 0 pulls it into the surface.
 *
 *   travel 'along'    the block moves WITH the pull (up the slope when θ > 0);
 *                     friction acts against the pull (−s).
 *   travel 'against'  the block moves OPPOSITE to the pull (down the slope when
 *                     θ > 0): the cable is a brake that lowers it / holds it
 *                     back; friction acts along +s.
 * With σ = +1 for 'along' and σ = −1 for 'against', and a/g the acceleration in
 * the direction of travel over g (a = 0 at constant speed):
 *
 *   N = W·cosθ − T·sinφ
 *   T·cosφ − W·sinθ − σ·μ·N = σ·(W/g)·a
 *   T = W·(sinθ + σ·(μ·cosθ + a/g)) / (cosφ + σ·μ·sinφ)       (= Num / Den)
 *
 * THE OPTIMUM ANGLE. Num does not depend on φ, so T is least where Den is
 * greatest: tanφ = σ·μ, i.e.  φ* = σ·atan(μ)  (measured from the SURFACE: it does
 * not depend on θ or on a; from the horizontal it is θ + φ*). There Den = √(1+μ²):
 *   T_min = W·(sinθ + σ·(μ·cosθ + a/g)) / √(1 + μ²).
 * For a cable that restrains a block going down ('against') the best cable
 * direction is below the surface (φ* < 0): it presses the block down to raise
 * the friction. The optimum is reported with its own N and status: if the best
 * angle would lift the block off the surface it is `valid: false`.
 *
 * LIFT-OFF. N = 0 where tanφ = cosθ / (sinθ + σ·a/g): φ_lift = atan2(cosθ,
 * sinθ + σ·a/g). It does not depend on μ (friction vanishes with N); at θ = 0,
 * a = 0 it is 90° (a vertical pull of T = W). It is reported only when ≤ 90°.
 */
export interface PullInput {
  /** The weight, W > 0, force units. */
  W: number;
  /** The surface angle, degrees, −30 to +60. */
  theta: number;
  /** Static and kinetic coefficients of friction, ≥ 0 (≤ 5). */
  muS: number;
  muK: number;
  /** Cable angle above the surface direction, degrees, −90 to +90. */
  phi: number;
  /** The acceleration over g, in the direction of travel (a/g, dimensionless, |a/g| ≤ 10). Null or 0: none (no 'accel' regime). */
  aOverG: number | null;
  travel: Travel;
}

/**
 * THE THREE REGIMES. 'start' is the tension at which motion is about to begin (μs,
 * no acceleration); 'run' keeps it moving at constant speed (μk); 'accel' gives it
 * the acceleration a (μk). Statuses:
 *
 *  'pull'               T > 0 and N ≥ 0: the tension in `T` does it.
 *  'slides-on-its-own'  ('along' only) gravity beats friction in the direction of the
 *                       pull: it moves with no pull at all (T ≤ 0 needed).
 *                       `hold` then gives the tension of a cable pulling the OTHER way at the
 *                       same φ above the surface that restrains it (start: just holds it;
 *                       run: lets it go at constant speed); null when no such tension exists.
 *  'stays-put'          ('against' only) it does not move that way by itself: a PUSH would be
 *                       needed (T ≤ 0). Nothing a cable can do.
 *  'self-locking'       T > 0 would be infinite or negative: the denominator
 *                       cosφ + σμ·sinφ ≤ 0 — the harder the cable pulls, the harder friction
 *                       grips. No tension moves it at this φ.
 *  'leaves-surface'     the tension that the formula asks for makes N < 0: the block would
 *                       lift off, and the friction formula does not apply. `T` and `N` are the
 *                       formula's (N < 0); the regime is REFUSED: it does not govern, is not
 *                       in the curve as valid, and the page says so. `phiLift` says where the lift begins.
 */
export type PullStatus = 'pull' | 'slides-on-its-own' | 'stays-put' | 'self-locking' | 'leaves-surface';
export type PullRegimeId = 'start' | 'run' | 'accel';

export interface PullRegime {
  id: PullRegimeId;
  status: PullStatus;
  /** The coefficient used and the acceleration over g. */
  mu: number;
  aOverG: number;
  /** The tension the cable must carry: > 0 when status is 'pull'; null otherwise (including 'leaves-surface'). */
  T: number | null;
  /** The raw Num/Den of the formula (null when Den = 0): signed, for the page's explanation. */
  rawT: number | null;
  /** Normal force N = W·cosθ − T·sinφ (null when T is null; may be < 0 for 'leaves-surface'). */
  N: number | null;
  /** Friction force F = μ·N ≥ 0, acting against the travel. Null when N is null or negative. */
  F: number | null;
  /** The share of T that lifts (T·sinφ) and that drags along the surface (T·cosφ). Null with T. */
  lift: number | null;
  drag: number | null;
  /** Of the weight: the component along the surface (W·sinθ, positive = along +s, against the pull when θ > 0) and across it (W·cosθ). */
  weightAlong: number;
  weightNormal: number;
  /** The inertia force (W/g)·a, in the direction of travel. */
  inertia: number;
  /** The cable angle that makes T least, σ·atan(μ), degrees, and the regime at that angle. */
  optimum: PullOptimum;
  /** φ_lift in degrees (see LIFT-OFF above), null when it would be past 90° (the block cannot be lifted by any pull of this kind). */
  phiLift: number | null;
  /** The tension at lift-off, W·cosθ / sinφ_lift (null with phiLift). */
  liftTension: number | null;
  /** See PullStatus 'slides-on-its-own'. Null in every other status. */
  hold: PullHold | null;
}

export interface PullOptimum {
  phi: number;
  /** T at φ*: positive when `valid`. */
  T: number | null;
  N: number | null;
  /** The closed form W·Num/√(1+μ²); equals T when valid. Signed. */
  closedForm: number;
  /** status 'pull' at φ*. */
  valid: boolean;
  status: PullStatus;
}

export interface PullHold {
  /** The tension of the restraining cable pulling the other way, and the normal force there. */
  T: number;
  N: number;
}

/** A point of the curve T(φ). T is null where the regime is not 'pull' at that φ. */
export interface CurvePoint {
  phi: number;
  T: number | null;
  N: number | null;
  /** status === 'pull'. */
  valid: boolean;
  status: PullStatus;
}

/**
 * The curve of one regime over φ = −90° … +90° in 1° steps (CURVE_POINTS points),
 * and where its least VALID tension is (index into `points`, null if none is valid).
 */
export interface PullCurve {
  regime: PullRegimeId;
  points: CurvePoint[];
  minIndex: number | null;
}

export type PullIssueCode = 'number' | 'range' | 'size';
export type PullWarningCode = 'kinetic-above-static' | 'no-governing';
/**
 *  'number' / 'range'    as in mode 'load'; fields 'W', 'theta', 'muS', 'muK', 'phi', 'aOverG', 'travel'
 *  'size'                a result is past 1e30
 *  warning 'kinetic-above-static'  μk > μs (unusual)                            numbers = [muS, muK]
 *  warning 'no-governing'          no regime has status 'pull': nothing to carry into the cable
 */
export interface PullIssue {
  code: PullIssueCode;
  field?: string;
  min?: number;
  max?: number;
  minOpen?: boolean;
}
export interface PullWarning {
  code: PullWarningCode;
  numbers?: number[];
}

export interface PullSolution {
  ok: true;
  mode: 'pull';
  /** 'start' and 'run' always; 'accel' only when aOverG is given and not 0. */
  regimes: PullRegime[];
  curves: PullCurve[];
  /** The regime whose tension is the greatest of those with status 'pull'; null if none. */
  governing: PullRegimeId | null;
  /** Mass-style numbers: the unit vectors of the surface (s) and its normal (n). */
  surface: { sx: number; sy: number; nx: number; ny: number };
  warnings: PullWarning[];
}
export interface PullFailure {
  ok: false;
  mode: 'pull';
  issues: PullIssue[];
}
export type PullOutcome = PullSolution | PullFailure;

/* ── Mode 3: a cable round a drum or bollard ────────────────────────────── */

/**
 * T_big = T_small · e^(μβ), β the wrap angle in RADIANS in the engine (the form
 * takes degrees or turns). Each of the four is a number or null; EXACTLY ONE is
 * null and is solved. The quantities are all ≥ 0 and the forces are > 0.
 */
export interface DrumInput {
  Tbig: number | null;
  Tsmall: number | null;
  mu: number | null;
  /** Wrap angle, radians (0 ≤ β ≤ 200π, i.e. 100 turns). */
  beta: number | null;
}

export type DrumUnknown = 'Tbig' | 'Tsmall' | 'mu' | 'beta';

export interface DrumSolution {
  ok: true;
  mode: 'drum';
  /** Which one was blank. */
  solved: DrumUnknown;
  Tbig: number;
  Tsmall: number;
  mu: number;
  /** Radians; the page shows degrees and turns (turns = β / 2π). */
  beta: number;
  /** e^(μβ) = Tbig / Tsmall. */
  ratio: number;
  /** μβ, the exponent. */
  exponent: number;
  /**
   * The force the drum feels: the resultant of the two tensions, whose directions
   * are the tangents at the ends of the wrap. |R| = √(Tb² + Ts² − 2·Tb·Ts·cosβ):
   * Tb + Ts at β = 180°, |Tb − Ts| at a whole turn. Its direction is `angle`
   * degrees counter-clockwise from the +x axis in the drawing frame (drumFrame in types).
   */
  resultant: number;
  resultantX: number;
  resultantY: number;
  resultantAngle: number;
  warnings: { code: 'no-friction' | 'no-wrap' }[];
}
/**
 * DRUM FRAME (for the drawing; the engine fixes it so tests can check it): the drum's centre
 * is the origin; the wrap runs counter-clockwise from angle 0 (point (1, 0), where Tbig leaves
 * the drum, along (0, −1) — the force of the cable ON the drum is along (0, −1)) to angle β
 * (where Tsmall leaves, along (−sinβ, cosβ)). So resultant = Tbig·(0, −1) + Tsmall·(−sinβ, cosβ).
 * 'no-friction': μ = 0 (the ratio is 1). 'no-wrap': β = 0 (the ratio is 1).
 */

export type DrumIssueCode = 'number' | 'range' | 'underdetermined' | 'overdetermined' | 'order' | 'degenerate' | 'overflow';
/**
 *  'number' / 'range'  field in 'Tbig' | 'Tsmall' | 'mu' | 'beta'; a force must be > 0 (min 0, minOpen), μ ≥ 0, β ≥ 0
 *  'underdetermined'   two or more of the four are blank          count = how many are blank
 *  'overdetermined'    none is blank: nothing to solve
 *  'order'             solving μ or β (or checking) needs Tbig ≥ Tsmall        numbers = [Tbig, Tsmall]
 *  'degenerate'        the unknown cannot be told: μ with β = 0 and Tbig = Tsmall (any μ fits), or β with
 *                      μ = 0 and Tbig = Tsmall (any β fits); or the ratio is not 1 and the other factor is 0
 *                      (no μ or β can make a ratio of  Tb/Ts ≠ 1  from a zero)   field = the unknown, numbers = [Tbig, Tsmall]
 *  'overflow'          μβ is past 700 (e^700 is the largest a double holds): the result is not a number   numbers = [μβ]
 */
export interface DrumIssue {
  code: DrumIssueCode;
  field?: DrumUnknown;
  count?: number;
  min?: number;
  max?: number;
  minOpen?: boolean;
  numbers?: number[];
}
export interface DrumFailure {
  ok: false;
  mode: 'drum';
  issues: DrumIssue[];
}
export type DrumOutcome = DrumSolution | DrumFailure;

/* ── The tables ─────────────────────────────────────────────────────────── */

/**
 * A material preset: the modulus in the unit each system shows (ksi, GPa) and
 * the coefficient of thermal expansion in 10⁻⁶ per °F or per °C. The two
 * systems' numbers are written out (not converted): 29,000 ksi is 199.95 GPa and
 * steel is 200 GPa. `source` and `confidence` are for the owner; the page may print
 * `note`: 'typical' for a rope.
 */
export interface MaterialPreset {
  id: Exclude<MaterialId, 'custom'>;
  E: { us: number; si: number };
  /** 10⁻⁶ per °F (us) and per °C (si). */
  alpha: { us: number; si: number };
  /** The rope or strand a material usually goes with (the page may preselect the factor). */
  rope: RopeId;
  typical: boolean;
}

export interface RopePreset {
  id: Exclude<RopeId, 'custom'>;
  /** A = factor · d² (d the NOMINAL diameter). Solid round: π/4. TYPICAL for the others. */
  factor: number;
  typical: boolean;
  /** The material that usually goes with it. */
  material: Exclude<MaterialId, 'custom'>;
}
