/**
 * ─────────────────────────────────────────────────────────────────
 * PLANE FRAME ANALYSIS — what the engine is given and what it returns
 * ─────────────────────────────────────────────────────────────────
 * The eighth calculator of the catalogue ("Plane frame analysis",
 * /resources/plane-frame-analysis; Spanish "Análisis de pórticos planos"): "Moments, shears,
 * axial forces and reactions of a 2D frame." Straight prismatic members joined at nodes,
 * rigidly or with a moment hinge at either end, held by fixed, pinned, roller,
 * guided or elastic supports, under nodal loads, member loads and temperature.
 *
 * THE METHOD (engine.ts): the direct stiffness method, three degrees of
 * freedom per node (ux, uy, θ), static condensation of the member-end moment
 * hinges. A member is an Euler–Bernoulli beam-column: axial deformation and
 * bending, NO shear deformation, small displacements, linear elastic, FIRST
 * ORDER: equilibrium is written on the undeformed geometry, so there is no P–Δ
 * and no buckling, and the axial force does not change the bending stiffness.
 * The diagrams and the deflected shape of a member are NOT interpolated: they
 * are the closed-form polynomials that follow from the member's end forces and
 * its loads (element.ts).
 *
 * PURE STATICS. There is no design code, no load factor, no combination and
 * no verdict in any of it: forces, moments, reactions and displacements. Whether
 * a member or a section is adequate is the engineer's.
 *
 * UNITS: any consistent set. Lengths in one unit (L), forces in one unit (F):
 * moments in F·L, a line load in F/L, E in F/L², A in L², I in L⁴, a support's
 * spring in F/L or F·L/rad. (The form works in feet and kips or metres and
 * kilonewtons, brings the section's inches or millimetres across in one place
 * and shows displacements in inches or millimetres: model.ts.) A temperature
 * is a number of degrees and α the strain per degree: only α·ΔT enters.
 *
 * INDICES. In this file and in the engine every list is read by INDEX FROM 0.
 * The page numbers things from 1 ("node 1", "member 1"); analysis.ts does the
 * +1, once, and its results are in LABELS from 1.
 *
 * ── SIGNS ────────────────────────────────────────────────────────────────────
 * Global axes: x to the right, y UP. Loads and reactions are positive along +x
 * and +y: a gravity load is a NEGATIVE fy (and a negative `w` along 'global-y').
 * A moment is positive COUNTER-CLOCKWISE (an applied couple, a reaction moment,
 * a rotation).
 *
 * A member has LOCAL axes: x̄ along the member from node i to node j, ȳ to the
 * LEFT of that direction (x̄ rotated 90° counter-clockwise). For a horizontal
 * member drawn from left to right, ȳ is UP.
 *
 *   N  axial force, positive in TENSION.
 *   V  shear force, positive when the part of the member to the LEFT of a cut
 *      is pushed UP (towards +ȳ) by the loads and reactions on it. The same
 *      sign as the beam calculator (lib/calc/beam): dV/dx̄ = q_ȳ (an
 *      upward load raises V), and across a point load P along +ȳ, V jumps by +P.
 *   M  bending moment, positive when it causes TENSION on the −ȳ side of the
 *      member (the BOTTOM fibre of a horizontal member drawn left to right):
 *      SAGGING. The same sign as the beam calculator: dM/dx̄ = V. Across an
 *      applied couple C (counter-clockwise), M jumps by −C.
 *
 *   WORKED EXAMPLE (the same beam the beam calculator gives): a horizontal
 *   member from node 0 at (0,0) to node 1 at (10,0), pinned at both ends, with
 *   a UDL of 2 kip/ft DOWN (w = −2 along 'global-y'; = −2 along 'local-y').
 *   Reactions 10 kip up at each end. Then N = 0, V(0) = +10, V(5) = 0,
 *   V(10) = −10, and M(0) = 0, M(5) = +25 kip·ft (SAGGING, tension at the
 *   bottom), M(10) = 0. Drawn on the TENSION side, the moment diagram of that
 *   member hangs BELOW it. Define the same member from node 1 to node 0 (right
 *   to left) and the local axes turn with it: ȳ points DOWN, so the −ȳ side
 *   (where M > 0 puts the tension) is the TOP. The same sagging beam then has
 *   M = −25 at midspan. V keeps its value at every PLACE (V′(x) = V(L − x), M′(x) =
 *   −M(L − x)): only the start and end columns swap, V = −10 at the new start and
 *   +10 at the new end. The sign of M depends on the direction the member was
 *   drawn; the DRAWING of M (on the tension side) does not.
 *
 * Node displacements (ux, uy) are positive along +x and +y; the rotation θ is
 * positive counter-clockwise. The deflection v of a member is positive along
 * +ȳ (its local u along x̄); the slope v' is positive counter-clockwise.
 *
 * ── MEMBER-END FORCES AS THE ENGINE KEEPS THEM ───────────────────────────────
 * `forces` of a member: the force and moment the NODE exerts ON THE MEMBER at
 * each end, in the member's local axes: [Fx_i, Fy_i, M_i, Fx_j, Fy_j, M_j]
 * (counter-clockwise moment positive). They include the member's loads (they
 * are k·u − p, with p the equivalent nodal loads). From them:
 *     N(0⁺) = −Fx_i − Px_0,   V(0⁺) = +Fy_i + Py_0,   M(0⁺) = −M_i − C_0,       (just inside the start)
 *     N(L⁻) = +Fx_j + Px_L,   V(L⁻) = −Fy_j − Py_L,   M(L⁻) = +M_j + C_L         (just inside the end)
 * where (Px, Py, C)_0 and (Px, Py, C)_L are the point loads and couples of the member placed exactly AT x̄ = 0 and x̄ = L:
 * they go straight into the node and are not in the diagram that starts just inside. At a hinge the moment is exactly 0
 * (unless a couple is placed AT the hinge: then it is −C_0 or C_L, the member's own).
 * and the polynomials in between (`pieces`) are exact. A load AT an end of a
 * member (a = 0 or a = L) goes straight into that node: the diagrams of the
 * member start just inside it.
 *
 * ── SUPPORTS ─────────────────────────────────────────────────────────────────
 * ONE support per node (a second at the same node is refused).
 *   'fixed'   holds ux, uy and θ.
 *   'pin'     holds ux and uy; θ free.
 *   'roller'  holds the translation ALONG ONE LINE and leaves the node free to
 *             slide across it, and free to turn. `angle` is that line's direction in DEGREES
 *             counter-clockwise from +x: the line the reaction acts along (the
 *             normal to the surface the roller runs on). 90 (the default) is the
 *             usual roller on a horizontal surface; 0 a roller against a
 *             vertical wall; any other angle an INCLINED roller, handled
 *             exactly (the node's displacement is expressed in the direction
 *             that is free: no penalty stiffness).
 *   'guide'   (a sliding fixity) as the roller, and θ held as well.
 *   'spring'  holds nothing rigidly; see below.
 * SPRINGS: any support may carry elastic springs kx, ky (F/L, along the GLOBAL
 * axes) and kr (F·L per radian) on the node's degrees of freedom. A 'spring'
 * support is just one that has nothing rigid. A spring on a degree of freedom
 * that a rigid restraint already holds does nothing to it. kx = ky = kr = 0 (or
 * absent) is no spring. The spring force on the structure is −k·(u − s), s the
 * spring's own settlement (below).
 * SETTLEMENTS dx, dy, dr (global x, y; counter-clockwise): the support moves.
 *   fixed: all three prescribed;  pin: dx, dy;  roller: the component of (dx,
 *   dy) ALONG the roller's line (dx·cos + dy·sin) is imposed;  guide: that and
 *   dr;  springs: the far end of the spring moves by (dx, dy, dr).
 *
 * ── MEMBER LOADS ─────────────────────────────────────────────────────────────
 * Positions `a`, `b` are distances along the member from node i (length unit),
 * 0 ≤ a ≤ b ≤ L. `dir`: 'local-y' (perpendicular, along +ȳ), 'local-x'
 * (axial, along +x̄), 'global-x', 'global-y'. A value is positive along the
 * positive axis of its `dir`.
 *   'udl'            w per unit of MEMBER length over the whole member.
 *   'udl-projected'  w per unit of the PROJECTED length, over the whole member:
 *                    dir 'global-y' is a vertical load per unit of HORIZONTAL
 *                    length (snow, roof dead load: total w·|Δx|); dir 'global-x'
 *                    a horizontal load per unit of VERTICAL length (wind on the
 *                    projection of a sloping roof: total w·|Δy|).
 *   'trapezoid'      w1 at a to w2 at b, linear, partial span, dir as udl.
 *   'point'          P at a, dir as udl.
 *   'moment'         M at a, counter-clockwise positive.
 *   'temperature'    dT: the uniform temperature change (strain α·dT, free
 *                    elongation α·dT·L); dTg: the temperature of the +ȳ face
 *                    minus that of the −ȳ face (gradient; needs the member's
 *                    depth h; free curvature −α·dTg/h); α per degree.
 *                    A member that cannot move freely (the usual case) develops
 *                    the forces; a determinate frame develops none.
 *
 * ── HINGES ───────────────────────────────────────────────────────────────────
 * `releases.start` / `.end`: a moment hinge at node i / node j of the member:
 * the member does not transmit moment into that node (M = 0 there) and rotates
 * freely relative to it. Hinges at both ends make a member that carries axial
 * force and (under its own loads) simple-beam shear. If every member that
 * meets at a node has a hinge there (and nothing holds the node's rotation: no
 * fixed or guided support, no rotational spring) the node's rotation does not
 * matter to anything: it is 'free' (`rotation: null` in the displacements) and
 * a moment applied to it cannot be carried ('hinged-joint-moment').
 *
 * LIMITS the whole calculator holds: 50 NODES, 100 MEMBERS, 40 SUPPORTS, 120
 * MEMBER LOADS and 60 NODAL LOADS. The engine refuses a model above any of them
 * ('too-big').
 *
 * THE ONE TOLERANCE. `FRAME_ZERO` (1e-9) is the relative size under which a
 * force, a moment, a displacement or a position is rounding: of the problem's
 * force scale `scale` (and, for a moment, scale × the frame's size; for a
 * displacement, the largest displacement). The engine, analysis.ts and the page
 * all use this one number.
 */

export const MAX_NODES = 50;
export const MAX_MEMBERS = 100;
export const MAX_SUPPORTS = 40;
export const MAX_MEMBER_LOADS = 120;
export const MAX_NODAL_LOADS = 60;

/** Under this fraction of the problem's size a result is rounding and is 0. The only such tolerance. */
export const FRAME_ZERO = 1e-9;

export interface FrameNode {
  x: number;
  y: number;
}

export interface FrameMember {
  /** Index of the node at the start (i) and at the end (j). */
  i: number;
  j: number;
  /** Area (L²), moment of inertia (L⁴) and modulus (F/L²) of THIS member, overriding the model's. */
  A?: number;
  I?: number;
  E?: number;
  /** A moment hinge at the member's start (node i) / end (node j). */
  releases?: { start?: boolean; end?: boolean };
  /** Section depth (L): only used to turn a temperature gradient into a curvature. */
  h?: number;
}

export type FrameSupportKind = 'fixed' | 'pin' | 'roller' | 'guide' | 'spring';

export interface FrameSupport {
  node: number;
  kind: FrameSupportKind;
  /** Roller / guide: the restrained line, degrees counter-clockwise from +x. Missing: 90. Ignored otherwise. */
  angle?: number;
  /** Springs on the node, global axes: F/L, F/L, F·L/rad. Missing or 0: none. */
  kx?: number;
  ky?: number;
  kr?: number;
  /** Settlement / prescribed movement (see SUPPORTS above). Missing: 0. */
  dx?: number;
  dy?: number;
  dr?: number;
}

/** Loads on a node, along +x and +y, and a counter-clockwise moment. Several loads on one node add up. */
export interface FrameNodalLoad {
  node: number;
  fx: number;
  fy: number;
  m: number;
}

export type FrameLoadDir = 'local-y' | 'local-x' | 'global-x' | 'global-y';

export type FrameMemberLoad =
  | { kind: 'udl'; member: number; dir: FrameLoadDir; w: number }
  | { kind: 'udl-projected'; member: number; dir: 'global-x' | 'global-y'; w: number }
  | { kind: 'trapezoid'; member: number; dir: FrameLoadDir; a: number; b: number; w1: number; w2: number }
  | { kind: 'point'; member: number; dir: FrameLoadDir; a: number; P: number }
  | { kind: 'moment'; member: number; a: number; M: number }
  | { kind: 'temperature'; member: number; dT: number; dTg: number; alpha: number };

export interface FrameModel {
  nodes: FrameNode[];
  members: FrameMember[];
  supports: FrameSupport[];
  loads: FrameNodalLoad[];
  memberLoads: FrameMemberLoad[];
  /** Used by every member that has none of its own. */
  E?: number;
  A?: number;
  I?: number;
}

/* ── What goes wrong ──────────────────────────────────────────────────── */

/**
 * Every reason the engine returns no solution. Each is a STABLE MACHINE CODE: the
 * page writes one sentence per code, in both languages. The fields are the
 * numbers the sentence needs; all INDICES FROM 0 here (analysis.ts turns them into
 * labels from 1).
 *
 *  'few-nodes'          fewer than 2 nodes.                                          count
 *  'no-members'         not one member.
 *  'too-big'            more than 50 nodes, 100 members, 40 supports, 120 member     where.list; count = how many
 *                       loads or 60 nodal loads.
 *  'number'             a coordinate, a load, a position, a spring, a settlement,   where {list, index, field}
 *                       an angle or α is not a finite number, or one past 1e30.
 *  'section'            an E, A, I or h (the model's or a member's) given and not   where {list: 'model'|'members', index, field: 'E'|'A'|'I'|'h'}
 *                       a finite number above zero (or past 1e30 / below 1e-30).
 *  'member-node'        a member's i or j is not the index of a node.               where {list: 'members', index, field: 'i'|'j'}
 *  'zero-length'        a member from a node to itself.                              where members
 *  'duplicate-node'     two nodes at one place (closer than 1e-9 of the frame's      nodes = [a, b], a < b
 *                       size).
 *  'short-member'       a member shorter than 1e-5 of the frame's size: a solution   where members
 *                       would not be right to the figures printed.
 *  'duplicate-member'   two members on the same pair of nodes.                       where members (the second); members = [first, second]
 *  'node-unconnected'   a node with no member.                                       nodes = [node]
 *  'disconnected'       the members form two or more separate pieces.                groups = the nodes of each piece (indices, ascending)
 *  'support-node'       a support's node is not the index of a node.                 where supports
 *  'support-kind'       a support whose kind is none of the five.                    where supports
 *  'duplicate-support'  a second support at a node that has one.                     where supports (the second); nodes = [node]
 *  'spring'             a spring stiffness below zero.                               where {list: 'supports', index, field: 'kx'|'ky'|'kr'}
 *  'load-node'          a nodal load's node is not the index of a node.              where loads
 *  'load-member'        a member load's member is not the index of a member.         where memberLoads
 *  'load-kind'          a member load whose kind or direction is not one of the      where memberLoads
 *                       listed (or a 'moment'/'temperature'/'udl-projected' with a
 *                       direction it cannot have).
 *  'load-position'      a position outside the member (a < 0, b > L, a > b, or a      where {list: 'memberLoads', index, field: 'a'|'b'}; length = the member's L
 *                       trapezoid of no length). A position past an end by less than
 *                       a ten-millionth of the member (a length typed to eight figures) is the end.
 *  'depth'              a temperature gradient (dTg ≠ 0) on a member that has no     where {list: 'memberLoads', index}; members = [member]
 *                       depth h.
 *  'few-supports'       fewer than 3 reaction components (fixed 3, pin 2, roller 1,  count = components
 *                       guide 2, plus each independent spring): a rigid body in a
 *                       plane needs 3.
 *  'unrestrained'       the frame as a whole is not held: it can translate or turn    count = how many independent rigid motions are free
 *                       (three reaction lines concurrent or parallel…).
 *  'mechanism'          the frame is unstable INSIDE itself: a part can move with no  nodes = those that move (ascending; at least a quarter as
 *                       member deforming (to first order): too many hinges.             much as the one that moves most); kind = 'sway' | 'rotation';
 *                                                                                      count = how many independent mechanisms
 *  'hinged-joint-moment' a moment applied to a node where every member is hinged      nodes = [node]
 *                       and nothing holds its rotation: it cannot be carried.
 *  'sections'           the frame is statically INDETERMINATE and some member has no   count = members missing E, A or I
 *                       E, A or I: its forces depend on the stiffness. (A determinate
 *                       frame is solved without them: forces and reactions only.)
 *  'ill-conditioned'    the solution does not satisfy equilibrium to the figures
 *                       printed (stiffness differing by 1e12 or more).
 *  'size'               a number in the results (a displacement, a deflection) is past 1e150.
 *  'stopped'            the arithmetic threw (never expected).
 */
export type FrameIssueCode =
  | 'few-nodes'
  | 'no-members'
  | 'too-big'
  | 'number'
  | 'section'
  | 'member-node'
  | 'zero-length'
  | 'duplicate-node'
  | 'short-member'
  | 'duplicate-member'
  | 'node-unconnected'
  | 'disconnected'
  | 'support-node'
  | 'support-kind'
  | 'duplicate-support'
  | 'spring'
  | 'load-node'
  | 'load-member'
  | 'load-kind'
  | 'load-position'
  | 'depth'
  | 'few-supports'
  | 'unrestrained'
  | 'mechanism'
  | 'hinged-joint-moment'
  | 'sections'
  | 'ill-conditioned'
  | 'size'
  | 'stopped';

export interface FrameIssue {
  code: FrameIssueCode;
  /** The entry at fault, by its index in its list. */
  where?: { list: 'nodes' | 'members' | 'supports' | 'loads' | 'memberLoads' | 'model'; index: number; field?: string };
  nodes?: number[];
  members?: number[];
  groups?: number[][];
  count?: number;
  kind?: 'sway' | 'rotation';
  /** 'load-position': the member's length. */
  length?: number;
}

/**
 * What the engine says without refusing: the solution is there.
 *  'no-load'         every load, temperature and settlement is zero (or there is none): every force is zero.
 *  'no-stiffness'    the frame is determinate and some member has no E, A or I: forces,
 *                    moments and reactions are exact, displacements are not computed.
 *  'bar'             a member with a hinge at both ends (members = those): it carries axial force, and shear only from its own loads.
 *  'free-rotation'   nodes whose rotation is undetermined (every member hinged there).      nodes
 *  'no-expansion'    a temperature change on these members (members) has an expansion coefficient α of 0: it has no effect.
 */
export type FrameWarningCode = 'no-load' | 'no-stiffness' | 'bar' | 'free-rotation' | 'no-expansion';
export interface FrameWarning {
  code: FrameWarningCode;
  members?: number[];
  nodes?: number[];
}

/* ── What comes back ──────────────────────────────────────────────────── */

/** A polynomial in t (ascending coefficients): c[0] + c[1]·t + c[2]·t² … */
export type Poly = number[];

/**
 * One stretch of a member between two neighbouring events (an end, a load's
 * start or end, a point load, a couple). `x0`, `x1` are distances from node i; every
 * polynomial is in t = x̄ − x0. All EXACT for the member's loads.
 *   N, V, M   the internal forces (signs above);
 *   u, v      the axial and transverse displacement of the member's own axis (local), null when the member has no stiffness.
 */
export interface MemberPiece {
  x0: number;
  x1: number;
  N: Poly;
  V: Poly;
  M: Poly;
  u: Poly | null;
  v: Poly | null;
}

export type StationKind = 'end' | 'load' | 'zero-shear' | 'zero-moment' | 'zero-axial';

/**
 * A key station of a member: every end of a piece (both sides of a jump: two
 * stations at one x), each point where V = 0 inside a piece (a moment extreme),
 * each zero of M inside a piece (an inflection of the moment diagram) and each
 * zero of N. x is the distance from node i.
 */
export interface MemberStation {
  x: number;
  kind: StationKind;
  /** Which side of a jump this station is on ('left' = just before x, 'right' = just after); null inside a piece. */
  side: 'left' | 'right' | null;
  N: number;
  V: number;
  M: number;
}

export interface EndForce {
  N: number;
  V: number;
  M: number;
}

export interface ExtremeAt {
  /** Distance along the member from node i. */
  x: number;
  value: number;
}

export interface MemberResult {
  /** Index of the member, from 0. */
  index: number;
  i: number;
  j: number;
  length: number;
  /** Direction cosines of the vector from node i to node j. */
  cx: number;
  cy: number;
  /** The E, A, I it was solved with: null where there is none. */
  E: number | null;
  A: number | null;
  I: number | null;
  releases: { start: boolean; end: boolean };
  /** What the NODE exerts on the member, local axes: [Fx_i, Fy_i, M_i, Fx_j, Fy_j, M_j] (see above). */
  forces: [number, number, number, number, number, number];
  /** Internal forces just inside each end (N tension, V and M as in SIGNS). */
  start: EndForce;
  end: EndForce;
  /**
   * The member-end displacements in local axes: [u_i, v_i, θ_i, u_j, v_j, θ_j] with the member's OWN end rotation
   * (at a hinge it is not the node's). Null when the frame has no stiffness.
   */
  displacements: [number, number, number, number, number, number] | null;
  pieces: MemberPiece[];
  stations: MemberStation[];
  /** The largest and smallest value of each internal force along the member (a piece's ends included, a jump's both sides). */
  maxima: {
    N: { max: ExtremeAt; min: ExtremeAt };
    V: { max: ExtremeAt; min: ExtremeAt };
    M: { max: ExtremeAt; min: ExtremeAt };
  };
  /** The resultant of the member's loads, global components (without the temperature, which has none). */
  loadResultant: { fx: number; fy: number };
}

export interface ReactionResult {
  /** Index of the support in `supports`. */
  support: number;
  node: number;
  kind: FrameSupportKind;
  /** Roller / guide line in [0, 180); null otherwise. */
  angle: number | null;
  /** The force and moment the support exerts ON THE FRAME (springs included), global axes, counter-clockwise moment. */
  rx: number;
  ry: number;
  rm: number;
  /** Size of the force, ≥ 0 (the moment apart). */
  magnitude: number;
  /** Roller / guide: the force along its line (cos angle, sin angle), signed; and across it (−sin, cos), signed (zero unless a spring acts); null otherwise. */
  along: number | null;
  across: number | null;
  /** The part of the reaction that the springs exert: the spring forces on the structure. Null if the support has no spring. */
  spring: { fx: number; fy: number; m: number } | null;
}

export interface DisplacementResult {
  node: number;
  ux: number;
  uy: number;
  /** Counter-clockwise, radians. Null for a node whose rotation does not matter (every member hinged there). */
  rotation: number | null;
  magnitude: number;
}

/**
 * Whether the frame is statically determinate, by counting:
 *     degree = 3·m + r − Σ(equations at the joints) − releases
 * where m = members, r = reaction components (fixed 3, pin 2, roller 1, guide 2 and each independent spring), the
 * equations at a joint are 3 (force x, force y, moment) except 2 at a joint whose rotation is free (every member hinged
 * there and nothing holds it), and `releases` the number of member-end hinges. (A truss: pin-ended bars; each bar 3 + 0 −
 * 2 = 1 axial unknown per bar, 2 equations per joint: m + r − 2j.)
 *   degree = 0 'determinate': the forces follow from equilibrium alone;
 *   degree > 0 'indeterminate': `degree` = k, the degree of indeterminacy;
 *   word 'unstable': degree < 0, or a mechanism / unrestrained motion (a count of 0 or more does not prove stability);
 *   word null: the model has an error that comes before any count.
 */
export interface Determinacy {
  joints: number;
  members: number;
  reactions: number;
  releases: number;
  /** Joints whose rotation is free (every member hinged there, nothing holds it). */
  freeJoints: number;
  /** The equations: 3 per joint, less one per free joint. */
  equations: number;
  degree: number;
  word: 'determinate' | 'indeterminate' | 'unstable' | null;
}

export interface Equilibrium {
  /** The point the moments are taken about: the centre of the box around the nodes. */
  about: { x: number; y: number };
  /** Applied loads (nodal and the member loads' resultants) plus the reactions, added up. Zero but for rounding. */
  sumFx: number;
  sumFy: number;
  sumM: number;
  /** Joint equilibrium: the largest force (or moment, over the frame's size) left over at any node once its members, its loads and its support are in. Zero but for rounding. */
  joint: number;
  /** The force scale: every load's size added up (or, with no load, the largest end force or reaction). What rounding is measured against. */
  scale: number;
  /** The frame's size (diagonal of the box around the nodes). */
  size: number;
  /** The applied loads added up (so the page can say "ΣFy = applied + reactions"). */
  applied: { fx: number; fy: number; m: number };
}

export interface ExtremeOf {
  member: number;
  /** Distance along that member from node i. */
  x: number;
  value: number;
}
export interface FrameExtremes {
  M: { max: ExtremeOf | null; min: ExtremeOf | null };
  V: { max: ExtremeOf | null; min: ExtremeOf | null };
  N: { max: ExtremeOf | null; min: ExtremeOf | null };
}

export interface FrameSolution {
  ok: true;
  nodes: FrameNode[];
  members: MemberResult[];
  reactions: ReactionResult[];
  /** Null when the frame has no stiffness (stiffness 'none'). */
  displacements: DisplacementResult[] | null;
  determinacy: Determinacy;
  /** 'absolute': every member has E, A and I. 'none': determinate, some member lacks one: forces only. */
  stiffness: 'absolute' | 'none';
  equilibrium: Equilibrium;
  extremes: FrameExtremes;
  warnings: FrameWarning[];
}

export interface FrameFailure {
  ok: false;
  issues: FrameIssue[];
}

export type FrameOutcome = FrameSolution | FrameFailure;
