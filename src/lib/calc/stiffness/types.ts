/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STIFFNESS MATRIX, STEP BY STEP — what the engine is given and what it returns
 * ─────────────────────────────────────────────────────────────────────────────
 * The ninth calculator of the catalogue ("Stiffness matrix, step by step"; Spanish "Matriz de
 * rigidez, paso a paso"): "Local and global stiffness matrices, displacements and reactions of 2D
 * members, with every step shown." A TEACHING tool for the direct stiffness method. The visitor
 * enters a small 2D structure; the engine solves it and RECORDS EVERY STEP AS DATA, so that the
 * interface can show the worked solution a student or an engineer would write by hand.
 *
 * TWO MODES.
 *   'truss'  pin-jointed bars: two degrees of freedom per node (ux, uy). Node n has the DOFs
 *            2n − 1 (x) and 2n (y). A bar carries axial force only.
 *   'frame'  rigid-jointed beam-columns: three degrees of freedom per node (ux, uy, rotation).
 *            Node n has the DOFs 3n − 2 (x), 3n − 1 (y) and 3n (θ). A member is an Euler–Bernoulli
 *            beam-column: axial deformation and bending, NO shear deformation, small displacements,
 *            linear elastic, FIRST ORDER. There are no member-end hinges, no springs and no inclined
 *            supports in this tool: a restraint is on a GLOBAL degree of freedom.
 *
 * PURE ANALYSIS. There is no design code, no load factor, no combination and no verdict in any of
 * it: stiffnesses, displacements, reactions and member forces. Whether a member is adequate is the
 * engineer's. The library has NO WORDS: everything is a stable machine code plus numbers, and the
 * page writes the sentences, in English and in Spanish.
 *
 * UNITS. Any consistent set. Lengths in one unit (L), forces in one unit (F): E in F/L², A in L²,
 * I in L⁴, w in F/L, moments in F·L. The form works in feet and kips or metres and kilonewtons and
 * brings the section's inches or millimetres across in one place (model.ts); the engine, and every
 * number in every step, is in FEET AND KIPS (or METRES AND KILONEWTONS), radians. The unit of one
 * entry of a vector or a matrix follows from the KINDS of the degrees of freedom of its row and
 * column (`dofKind(label)`): a 'x' or 'y' DOF is a length (or the force along it), a 'θ' DOF is an
 * angle (or the moment about it). A stiffness entry of two translations is F/L, of a translation
 * and a rotation F (per radian), of two rotations F·L (per radian).
 *
 * INDICES AND LABELS. The MODEL (what is given) is read by INDEX FROM 0: `Member.i` is the index of a
 * node in `nodes`. EVERYTHING THAT COMES BACK is in LABELS FROM 1: node 1, member 1, DOF 1, the way
 * the page says them. The one exception is `where.index` of an issue: it is the 0-based index of the
 * entry in the model's list (so that the form can find the row).
 *
 * ── SIGNS ────────────────────────────────────────────────────────────────────
 * Global axes: x to the right, y UP. Loads and reactions are positive along +x and +y: a gravity
 * load is a NEGATIVE fy. A moment, a rotation, a couple is positive COUNTER-CLOCKWISE.
 *
 * A member has LOCAL axes: x̄ along the member from node i to node j, ȳ to the LEFT of that
 * direction (x̄ turned 90° counter-clockwise). For a horizontal member drawn from left to right, ȳ is
 * UP. The local degrees of freedom are, in this order, [u_i, v_i, θ_i, u_j, v_j, θ_j] (a bar: [u_i,
 * u_j]); u along x̄, v along ȳ, θ counter-clockwise. The same as the plane frame calculator.
 *
 *   MEMBER LOADS (frame mode) are positive along the positive local axis: a UDL `w` and a point
 *   load `P` act along +ȳ (a gravity load on a member drawn from left to right is NEGATIVE), an axial
 *   load `q` along +x̄. A point load acts at `a`, the distance from node i, strictly inside the member.
 *
 *   `f`, the MEMBER END FORCES, is what the NODES EXERT ON THE MEMBER, in the member's local axes, as
 *   [Fx_i, Fy_i, M_i, Fx_j, Fy_j, M_j] (counter-clockwise moment positive): f = k·u_local + f_FE,
 *   with f_FE the FIXED-END FORCES (what the clamps would exert on the member with its ends held,
 *   the member's loads included; zero for a member with no load). From them, the INTERNAL FORCES just
 *   inside each end (the same as the plane frame calculator):
 *
 *       N(i) = −Fx_i    V(i) = +Fy_i    M(i) = −M_i          (just inside the start)
 *       N(j) = +Fx_j    V(j) = −Fy_j    M(j) = +M_j          (just inside the end)
 *
 *   N is positive in TENSION. V is positive when the part of the member to the LEFT of a cut is
 *   pushed UP (towards +ȳ). M is positive when it puts TENSION on the −ȳ side (the bottom of a
 *   horizontal member drawn left to right): SAGGING. WORKED EXAMPLE: a horizontal member from node 1
 *   (0, 0) to node 2 (10, 0), both ends fully fixed, a UDL of 2 kip/ft DOWN (w = −2). f_FE =
 *   [0, +10, +16.667, 0, +10, −16.667] (the clamps push up with 10 kip and turn the left end counter-
 *   clockwise by 16.667 kip·ft). Then N = 0; at the start V = +10, M = −16.667 (hogging); at the end
 *   V = −10, M = −16.667 (hogging). A bar's force is N = (EA/L)(u_j − u_i) in local axes: positive when
 *   it lengthens.
 *
 *   EQUIVALENT NODAL LOADS of a member's loads are −Tᵀ·f_FE (global axes): they are added to the load
 *   vector P, so that K·u = P + R holds with R the support reactions at the restrained DOFs.
 *   A REACTION is the force (or moment) the support exerts ON THE STRUCTURE, along a global axis.
 *
 * ── LIMITS ───────────────────────────────────────────────────────────────────
 * 12 nodes, 20 members (so at most 36 DOFs and the matrices stay displayable), 12 supports (one per
 * node), 40 nodal loads, 24 member loads. The engine refuses a model above any of them ('too-big').
 * The elimination of step 10 is recorded pass by pass when there are at most RECORD_LIMIT = 12
 * free DOFs; above that only its result is.
 *
 * ── THE ARITHMETIC'S OWN ROUNDING ────────────────────────────────────────────
 * A pivot is judged against ROUNDING, not against the stiffness its DOF started with: a stiff member beside soft ones makes a stable pivot that is a
 * millionth of its starting diagonal (a very large A, a very small I, a very short member), and nothing is wrong with it. The elimination carries,
 * beside every entry, the largest error the arithmetic could have put in it (a running forward-error bound: the rounding of the terms that made the
 * entry, and the errors of the entries it was made from, grown by every multiplier). A pivot is a zero for the arithmetic when that error reaches
 * RESOLVE of the pivot itself; whether the structure is then a mechanism or only too badly scaled to solve is told by the movement it allows
 * (STRAIN, below). Measured on 383 random mechanisms the pivot is never more than a twentieth of its error bound (0.042); on 634 random stable structures
 * never under a million times it (3.9 million). (The bound is a worst case: the error really made is a hundred times smaller or so, so a figure count taken from it is a floor.)
 *   EPSILON   2⁻⁵²   The relative size of one rounding of a double.
 *   ASSEMBLY  8      Units of EPSILON assumed in one entry of a member's matrix K_e (the arithmetic of c, s, EA/L and Tᵀ·k·T) and of each equivalent load.
 *
 * ── THE TOLERANCES (each written once, used by the engine, the analysis and the copy) ─────────
 *   RESOLVE   0.1    A pivot whose rounding reaches this share of its size is zero for the arithmetic (not one good figure in it): the structure is refused,
 *                    as a 'mechanism' when the movement it allows strains no member, as a 'stiffness-range' otherwise.
 *   WEAK      1e-6   A pivot whose rounding is between this share of it and RESOLVE is a WARNING ('near-mechanism'): solved, but the displacements are
 *                    guaranteed to fewer than six figures. The warning says how many.
 *   STRAIN    1e-6   A member whose deformation in the movement of a zero pivot (its elongation over its length, and the turn of each end beyond the turn
 *                    of its chord) is under this share of the movement it takes part in (its largest translation over its length, or its largest turn) is
 *                    not strained by it; so is a member that moves by under this share of the largest movement of all. A mechanism strains no member.
 *   RESIDUAL  1e-8   After the solve every equation is satisfied to this fraction of its own size
 *                    (|rhs| + Σ|K·u|); past it the answer is not trusted ('ill-conditioned'). The
 *                    equilibrium checks of step 14 use the same fraction of the problem's force scale.
 *                    (A safety net: a structure that passes the pivot test is solved to about 1e-15 of
 *                    this, so it is reached only by arithmetic that went wrong, never by a model.)
 *   ZERO      1e-9   The analysis prints as 0 a value under this fraction of the largest of its block
 *                    (its scale for a force, a moment, a displacement): rounding, never −0. A member's end forces are measured against the
 *                    force scale of the whole structure, so a bar that carries nothing is 'no force' and not a tension of 1e-15.
 *   AGREE     1e-12  Two numbers that are the same one are the same to this share of the largest of their kind: the closed form of a bar against
 *                    the product, K against its transpose, a rigid-body basis that is not independent, the eigenvalues of a mechanism.
 *   NEAR      1e-9   Two nodes closer than this fraction of the structure's size are one node typed twice.
 *   SHORT     1e-5   A member shorter than this fraction of the structure's size is refused.
 *   RIGID     1e-6   The share of a null mode that is not a rigid-body motion for it to be called one.
 *   LARGE     0.1    A member whose chord turns by more than this (radians) in the solution is past what small-displacement theory holds
 *                    ('large-displacements'): the result is first order and is no longer a description of the structure.
 *   LIMIT     1e30   Every input number must be finite and at most this in size; sections in [1e-30, 1e30].
 */

export const MAX_NODES = 12;
export const MAX_MEMBERS = 20;
export const MAX_SUPPORTS = 12;
export const MAX_LOADS = 40;
export const MAX_MEMBER_LOADS = 24;
/** The most DOFs there can be: 3 per node. */
export const MAX_DOFS = 36;
/** The elimination is recorded pass by pass up to this many free DOFs. */
export const RECORD_LIMIT = 12;

export const EPSILON = 2.220446049250313e-16;
export const ASSEMBLY = 8;
export const RESOLVE = 0.1;
export const WEAK = 1e-6;
export const STRAIN = 1e-6;
export const RESIDUAL = 1e-8;
export const ZERO = 1e-9;
export const AGREE = 1e-12;
export const NEAR = 1e-9;
export const SHORT = 1e-5;
export const RIGID = 1e-6;
export const LARGE = 0.1;
export const LIMIT = 1e30;
const SECTION_LOW = 1e-30;
export { SECTION_LOW };

/* ── What the engine is given ─────────────────────────────────────────── */

export type Mode = 'truss' | 'frame';

export interface StiffnessNode {
  x: number;
  y: number;
}

export interface StiffnessMember {
  /** Index (from 0) of the node at the start (i) and at the end (j). */
  i: number;
  j: number;
  /** This member's own modulus (F/L²), area (L²) and moment of inertia (L⁴), overriding the model's. I is only used in frame mode. */
  E?: number;
  A?: number;
  I?: number;
}

/**
 * A support: the restrained GLOBAL degrees of freedom of a node, with an optional prescribed displacement
 * (a settlement) on each. `rz` is only used in frame mode. A prescribed value on a DOF that is not restrained is
 * ignored (a warning says so).
 */
export interface StiffnessSupport {
  node: number;
  ux: boolean;
  uy: boolean;
  rz: boolean;
  /** Prescribed displacement along x and y (L) and rotation (radians). Missing: 0. */
  dx?: number;
  dy?: number;
  dr?: number;
}

/** A load on a node, along +x and +y (F) and a counter-clockwise moment (F·L; frame mode only). Several loads on a node add up. */
export interface StiffnessLoad {
  node: number;
  fx: number;
  fy: number;
  m: number;
}

/**
 * The loads on a member, frame mode only (a truss has loads at its nodes), in the member's local axes.
 *   'udl'    w (F/L) along +ȳ, over the whole member.
 *   'point'  P (F) along +ȳ at the distance a (L) from node i, strictly between the ends.
 *   'axial'  q (F/L) along +x̄, over the whole member.
 */
export type StiffnessMemberLoad =
  | { kind: 'udl'; member: number; w: number }
  | { kind: 'point'; member: number; a: number; P: number }
  | { kind: 'axial'; member: number; q: number };

export interface StiffnessModel {
  mode: Mode;
  nodes: StiffnessNode[];
  members: StiffnessMember[];
  supports: StiffnessSupport[];
  loads: StiffnessLoad[];
  memberLoads: StiffnessMemberLoad[];
  /** Used by every member that has none of its own. */
  E?: number;
  A?: number;
  I?: number;
}

/* ── What goes wrong ──────────────────────────────────────────────────── */

/**
 * Every reason the engine returns no solution. Each is a STABLE MACHINE CODE: the page writes one sentence per code, in both
 * languages. The fields are the numbers the sentence needs. Labels from 1 for nodes, members and DOFs (see INDICES AND LABELS);
 * `where.index` is the 0-based index in the model's list.
 *
 *  'mode'               the mode is neither 'truss' nor 'frame'.
 *  'few-nodes'          fewer than 2 nodes.                                            count
 *  'no-members'         not one member.
 *  'too-big'            more than 12 nodes, 20 members, 12 supports, 40 loads or 24     list; count = how many; max = the cap
 *                       member loads.
 *  'number'             a coordinate, a load, a position, a settlement is not a finite  where {list, index, field}
 *                       number, or is past 1e30 in size.
 *  'section'            an E, A or I (the model's or a member's) given and not a       where {list: 'model'|'members', index, field: 'E'|'A'|'I'}
 *                       finite number in [1e-30, 1e30].
 *  'section-missing'    a member has no E, no A, or (frame mode) no I: its own and the   where {list: 'members', index, field}; members = [label]
 *                       model's are both blank. (In truss mode I is never needed.)
 *  'member-node'        a member's i or j is not the index of a node.                   where {list: 'members', index, field: 'i'|'j'}
 *  'zero-length'        a member from a node to itself.                                 where members; members = [label]
 *  'duplicate-node'     nodes closer than NEAR of the structure's size (one place typed   nodes = the labels, ascending; distance, size
 *                       twice, or a structure so large beside them that the arithmetic
 *                       cannot tell them apart: distance and size say which).
 *  'short-member'       a member shorter than SHORT of the structure's size.            where members; members = [label]; length, size
 *  'duplicate-member'   two members on the same pair of nodes.                          where members (the second); members = [first, second]
 *  'node-unconnected'   a node with no member.                                          nodes = [label]
 *  'disconnected'       the members form two or more separate pieces.                   groups = the node labels of each piece (ascending)
 *  'support-node'       a support's node is not the index of a node.                    where supports
 *  'duplicate-support'  a second support at a node that has one.                        where supports (the second); nodes = [label]
 *  'load-node'          a nodal load's node is not the index of a node.                 where loads
 *  'load-member'        a member load's member is not the index of a member.            where memberLoads
 *  'load-kind'          a member load whose kind is none of the three.                  where memberLoads
 *  'load-position'      a point load at a distance not strictly inside the member.      where {list: 'memberLoads', index, field: 'a'}; length
 *  'few-supports'       fewer than 3 restrained DOFs: a rigid body in a plane needs 3.  count = how many
 *                       (Reported alone: the elimination is not tried.)
 *  'mechanism'          the structure can move with no member deforming (to first        dof = the DOF number whose pivot vanished, node = its node;
 *                       order): a pivot of the elimination that rounding cannot tell      kind 'sway' | 'rigid-body'; nodes = those that move in the
 *                       from zero (RESOLVE) AND a movement, the pivot's DOF set to 1,     null mode (at least a quarter as much as the one that moves
 *                       that strains no member (STRAIN). 'sway': parts move relative      most, ascending); shape = the null mode (one entry per DOF,
 *                       to each other (too few members, a joint of two bars on one        the largest translation 1); ratio = the rounding of the pivot
 *                       line…). 'rigid-body': the whole structure can translate or        over the pivot (absent when the pivot is not above zero);
 *                       turn (restraints that do not hold it: three roller reactions      count = independent motions (eigenvalues of the unit-diagonal
 *                       on parallel lines…).                                              K_FF under AGREE)
 *  'stiffness-range'    a pivot that rounding cannot tell from zero, and a movement     dof, node, nodes = [node]; ratio as above. A structure whose
 *                       that does strain a member (to STRAIN): not a mechanism as far    stiffnesses differ so much (a very large A or I beside ordinary
 *                       as the arithmetic can find, but it cannot say how far the        members, or members almost in line, or very short) that its
 *                       softest movement goes. (The copy does not swear it is not one.)  softest movement is lost in the rounding of the rest.
 *  'ill-conditioned'    the answer does not satisfy the equations to the figures      residual (relative, the largest departure); limit = RESIDUAL
 *                       printed: the solved equations leave a residual above RESIDUAL
 *                       of their own size, or a check of step 14 fails by more than
 *                       RESIDUAL of its scale (a safety net: a structure that is stable
 *                       by the pivots is solved to about 10⁻¹⁰ of its size, so this is
 *                       reached by arithmetic that went wrong, never by a model).
 *  'size'               a number in the results is not finite or is past what a double holds.
 *  'stopped'            the arithmetic threw (never expected).
 */
export type IssueCode =
  | 'mode'
  | 'few-nodes'
  | 'no-members'
  | 'too-big'
  | 'number'
  | 'section'
  | 'section-missing'
  | 'member-node'
  | 'zero-length'
  | 'duplicate-node'
  | 'short-member'
  | 'duplicate-member'
  | 'node-unconnected'
  | 'disconnected'
  | 'support-node'
  | 'duplicate-support'
  | 'load-node'
  | 'load-member'
  | 'load-kind'
  | 'load-position'
  | 'few-supports'
  | 'mechanism'
  | 'stiffness-range'
  | 'ill-conditioned'
  | 'size'
  | 'stopped';

export type ListName = 'nodes' | 'members' | 'supports' | 'loads' | 'memberLoads';

export interface Issue {
  code: IssueCode;
  /** The entry at fault, by its 0-based index in its list. */
  where?: { list: ListName | 'model'; index: number; field?: string };
  nodes?: number[];
  members?: number[];
  groups?: number[][];
  count?: number;
  list?: ListName;
  max?: number;
  length?: number;
  distance?: number;
  size?: number;
  dof?: number;
  node?: number;
  kind?: 'sway' | 'rigid-body';
  shape?: number[];
  ratio?: number;
  residual?: number;
  limit?: number;
}

/**
 * What the engine says without refusing: the solution is there.
 *  'no-load'               every load, member load and prescribed displacement is zero (or there is none): every result is zero.
 *  'member-loads-ignored'  truss mode with member loads in the model (count): a bar has loads at its nodes only; they are not used.
 *  'settlement-ignored'    a prescribed displacement typed on a DOF that is not restrained (dofs = the DOF numbers): it has no effect.
 *  'empty-support'         a support that restrains nothing (nodes = the labels).
 *  'near-mechanism'        solved, but one pivot (dofs = [its DOF number]) is guaranteed to fewer than six figures: the rounding the arithmetic could have put in it is
 *                          `ratio` of it, over WEAK = 1e-6 and under RESOLVE = 0.1; `count` = the figures the displacements are guaranteed to (⌊−log10 ratio⌋, from 1 to 5).
 *                          The cause is a large range of stiffness (a very large A or I beside ordinary members, a very short member) or members almost in line:
 *                          the structure is NOT called a mechanism.
 *  'large-displacements'   solved to first order, but the chord of a member turns by more than LARGE = 0.1 rad in the solution (ratio = the largest turn in radians;
 *                          count = that member's label; nodes = its two nodes): small-displacement theory no longer describes the structure, and the numbers are those of
 *                          the theory, not of the structure.
 */
export type WarningCode = 'no-load' | 'member-loads-ignored' | 'settlement-ignored' | 'empty-support' | 'near-mechanism' | 'large-displacements';
export interface Warning {
  code: WarningCode;
  count?: number;
  dofs?: number[];
  nodes?: number[];
  ratio?: number;
}

/* ── What comes back: the degrees of freedom ──────────────────────────── */

/** 'x' and 'y' are translations, 'θ' the rotation. The last character of a DOF label. */
export type DofKind = 'x' | 'y' | 'θ';

export interface Dof {
  /** The global DOF number, from 1: 2n − 1, 2n (truss) or 3n − 2, 3n − 1, 3n (frame). */
  number: number;
  /** Label of the node it belongs to. */
  node: number;
  kind: DofKind;
  /** '1x', '1y', '1θ': the node label then the kind. */
  label: string;
  restrained: boolean;
  /** The prescribed displacement (a restrained DOF; 0 if none), 0 for a free DOF. In L or radians. */
  prescribed: number;
  /** Position among the free DOFs, from 1; null for a restrained DOF. */
  free: number | null;
}

/** The kind of DOF a label is about: its last character. */
export function dofKind(label: string): DofKind {
  const last = label.charAt(label.length - 1);
  return last === 'x' ? 'x' : last === 'y' ? 'y' : 'θ';
}

export interface SolvedNode {
  label: number;
  x: number;
  y: number;
  /** The DOF numbers of the node: [2n − 1, 2n] or [3n − 2, 3n − 1, 3n]. */
  dofs: number[];
}

export interface SolvedMember {
  label: number;
  /** Labels of its two nodes. */
  i: number;
  j: number;
  length: number;
  /** Direction cosines of the vector from node i to node j: c = cos θ, s = sin θ. */
  c: number;
  s: number;
  /** The direction in degrees, counter-clockwise from +x, in (−180, 180]. */
  angle: number;
  E: number;
  A: number;
  /** Null in truss mode. */
  I: number | null;
  /** The member's code vector: the global DOF number of each of its local DOFs ([u_i, v_i, θ_i, u_j, v_j, θ_j]; a bar [x_i, y_i, x_j, y_j]). */
  code: number[];
  /** The member's global DOF labels, in code order. */
  codeLabels: string[];
  /** The labels of the member's local DOFs: ['u1','v1','θ1','u2','v2','θ2'] (frame) or ['u1','u2'] (bar), by node label. */
  localLabels: string[];
}

/* ── What comes back: the steps ───────────────────────────────────────── */

/**
 * The ids of the steps, in the order the worked solution gives them, with the STAGE (1–14) each belongs to. A step's `id` is also
 * the CODE OF ITS TITLE. Per-member steps appear once for each member, in member order, all of one id together.
 *
 *  stage  id                  scope      what it holds
 *   1     structure           structure  the nodes, the connectivity, the sections, the DOF numbering, the restraints and the prescribed values
 *   2     geometry            member     dx, dy, L, c, s, the angle, E, A, (I), EA, (EI)
 *   3     local-stiffness     member     k (symbolic and numeric), its named terms
 *   4     transformation      member     T (symbolic and numeric)
 *   5     global-member       member     K_e = Tᵀ k T (and, in a truss, the closed form (EA/L)[c², cs, …] as a second route), the code vector
 *   6     assembly            member     the member's contribution to K, placed by its code vector, and the RUNNING K after it
 *   6     assembled           structure  the final K, with who contributed to every cell
 *   7     nodal-loads         structure  the loads at the nodes
 *   7     member-loads        member     (frame mode, members that carry loads) the fixed-end forces, local and global, the equivalent nodal loads
 *   7     load-vector         structure  the total load vector P
 *   8     partition           structure  K_FF, K_FR, K_RF, K_RR, P_F, P_R, u_R
 *   9     reduced             structure  K_FF u_F = P_F − K_FR u_R
 *  10     augmented           structure  [K_FF | rhs] before the elimination (recorded when free DOFs ≤ 12)
 *  10     forward-pass        structure  one pass of the forward elimination (sub = pass number)
 *  10     back-substitution   structure  one unknown (sub = how many are solved, 1 first), last unknown first
 *  10     solution            structure  u_F and the residual; `recorded: false` above 12 free DOFs (nothing before it)
 *  11     displacements       structure  the full vector u
 *  12     reactions           structure  R = K_RF u_F + K_RR u_R − P_R
 *  13     end-forces          member     u_e, u_local = T u_e, f = k u_local (+ f_FE), N, V, M at both ends (a bar: N, stress, elongation)
 *  14     checks              structure  global equilibrium, joint equilibrium, the energy identity, the residual of K u = P + R
 *
 * WHAT EACH STEP CARRIES (`facts` are numbers, booleans or short codes; `blocks` by type:name[tag]; matrices marked (sym) have `symbolic`):
 *
 *  structure          facts mode ('truss'|'frame'), nodes, members, dofsPerNode, dofs, free, restrained, loadedMembers
 *                     blocks matrix:coordinates (nodes × x,y) | matrix:connectivity (members × i,j: node labels) | matrix:sections (members × E,A[,I], calculation units)
 *                            | matrix:dof-numbers (nodes × x,y[,θ]) | matrix:restraints (1 restrained, 0 free) | vector:prescribed (all DOFs; highlights 'restrained' / 'prescribed')
 *  geometry           facts member, i, j      blocks scalar:dx, dy, L, c, s, θ (degrees), E, A, EA [, I, EI]
 *  local-stiffness    facts member, size      blocks matrix:k (sym; highlights 'axial' | 'bending') | scalar:EA/L [, 12EI/L³, 6EI/L², 4EI/L, 2EI/L]
 *  transformation     facts member            blocks matrix:T (sym; rows local DOFs, columns the member's global DOFs) | scalar:c, s
 *  global-member      facts member [, difference, agree: truss only]
 *                     blocks matrix:kT | matrix:K_e (labels: the member's global DOFs) | vector:code (the DOF numbers) | truss: matrix:K_e_closed (sym, with factor 'EA/L')
 *  assembly           facts member, cells     blocks matrix:contribution (N × N, highlights 'position') | matrix:running (N × N after this member, highlights 'contributed' on EVERY cell the members added so far have written into, with those `members`)
 *  assembled          facts dofs, symmetric, asymmetry      blocks matrix:K (highlights 'contributed' | 'shared' with `members` for every cell some member touches)
 *  nodal-loads        facts loads             blocks vector:P_nodal
 *  member-loads       facts member, loads     blocks scalar:L | per load, scalar:w | P, a, b | q [tag 'udl#n' | 'point#n' | 'axial#n', n the row of the load in the model's list]
 *                            | vector:f_FE [same tag] (sym) | vector:f_FE [tag 'total'] | vector:f_FE_global | vector:equivalent
 *  load-vector        facts loadedMembers     blocks [frame: vector:P_nodal, vector:P_equivalent] | vector:P
 *  partition          facts free, restrained  blocks matrix:K_FF, K_FR, K_RF, K_RR | vector:P_F, P_R, u_R (highlights 'prescribed')
 *  reduced            facts free, settles (some prescribed displacement is not zero)     blocks vector:P_F | vector:K_FR·u_R | vector:rhs
 *  augmented          facts size              blocks matrix:augmented ([K_FF | rhs]; the last column is labelled 'rhs')
 *  forward-pass       facts pass, pivotDof, pivot, rows [, singular: true, error (the rounding in the pivot), cause: 'mechanism' | 'range']
 *                     blocks scalar:pivot [tag 'pass#n'] | vector:multipliers [same tag; labels the rows below the pivot] | matrix:augmented [same tag; highlights 'pivot' | 'eliminated' (the entries under the pivot that were not zero) | 'updated' (entries whose value changed), or 'zero-pivot']
 *                            | a singular pass also scalar:rounding [same tag]
 *  back-substitution  facts unknown (position among the free DOFs), dof, value      blocks scalar:pivot [tag 'unknown#n'] | vector:u [same tag; the unknowns solved so far, this one first]
 *  solution           facts recorded, [why: 'too-many-free-dofs', limit], free, residual (the largest of any equation), relativeResidual, equationScale
 *                     blocks vector:u_F | vector:residual | scalar:max|residual|
 *  displacements      facts dofs              blocks vector:u (highlights 'restrained' | 'prescribed')
 *  reactions          facts restrained        blocks vector:K_RF·u_F | vector:K_RR·u_R | vector:P_R | vector:R
 *  end-forces         facts member
 *                     blocks vector:u_e | vector:u_local | vector:k·u_local | [frame, loaded member: vector:f_FE] | vector:f
 *                            | frame: matrix:ends (rows N, V, M; columns i, j) | truss: scalar:N, scalar:σ (N/A), scalar:δ (u_j − u_i)
 *  checks             facts scale, size, aboutX, aboutY, allOk
 *                     blocks scalar:ΣFx, ΣFy, ΣM | vector:joint | scalar:U, W | vector:K·u − P − R   (the Check records are in `Solution.checks`)
 */
export type StepId =
  | 'structure'
  | 'geometry'
  | 'local-stiffness'
  | 'transformation'
  | 'global-member'
  | 'assembly'
  | 'assembled'
  | 'nodal-loads'
  | 'member-loads'
  | 'load-vector'
  | 'partition'
  | 'reduced'
  | 'augmented'
  | 'forward-pass'
  | 'back-substitution'
  | 'solution'
  | 'displacements'
  | 'reactions'
  | 'end-forces'
  | 'checks';

export type StepScope = { kind: 'structure' } | { kind: 'member'; member: number };

/** Why a cell is marked (a machine code; the page says what each means and chooses the colour or the pattern). */
export type HighlightReason =
  /** local-stiffness: the terms that come from axial deformation (EA/L) and from bending (12EI/L³, 6EI/L², 4EI/L, 2EI/L). */
  | 'axial'
  | 'bending'
  /** assembly: the cells the member's code vector places an entry in (`position`: on the member's own contribution), and the same cells in the running K (`contributed`). */
  | 'position'
  | 'contributed'
  /** assembled: a cell that two or more members contributed to. `members` says which. */
  | 'shared'
  /** elimination: the pivot, the cells the pass reduces to zero, the cells the pass changed; a pivot that vanished. */
  | 'pivot'
  | 'eliminated'
  | 'updated'
  | 'zero-pivot'
  /** vectors: a restrained DOF whose prescribed value is not zero; a DOF that is restrained. */
  | 'prescribed'
  | 'restrained';

export interface Highlight {
  row: number;
  col: number;
  reason: HighlightReason;
  /** assembled / running K: the member labels that contributed to the cell. */
  members?: number[];
}

/** A matrix with row and column labels. `values[row][col]`; `symbolic[row][col]` is the entry as an expression in the symbols of the step. */
export interface MatrixBlock {
  type: 'matrix';
  /** The matrix's symbol: 'k', 'T', 'K_e', 'K', 'K_FF', … Unique within the step except where `tag` tells them apart. */
  name: string;
  rowLabels: string[];
  colLabels: string[];
  values: number[][];
  symbolic?: string[][];
  /** When present, every entry equals `factorValue` times its `symbolic` expression (the closed form (EA/L)[c², cs, …]). */
  factor?: string;
  factorValue?: number;
  highlights?: Highlight[];
  /** Tells apart blocks of one name in a step: 'udl#2' (the second member load, a UDL), 'pass#3'. */
  tag?: string;
}

export interface VectorBlock {
  type: 'vector';
  name: string;
  labels: string[];
  values: number[];
  symbolic?: string[];
  highlights?: { index: number; reason: HighlightReason }[];
  tag?: string;
}

export interface ScalarBlock {
  type: 'scalar';
  /** The symbol: 'L', 'c', 's', 'EA', 'EA/L', 'pivot', 'N', … */
  name: string;
  value: number;
  /** The expression the value is of, in the symbols of the step ('a_kk', 'EA/L'). */
  symbolic?: string;
  tag?: string;
}

export type Block = MatrixBlock | VectorBlock | ScalarBlock;

export interface Step {
  id: StepId;
  /** Unique within the solution: 'structure', 'geometry#2' (member 2), 'forward-pass#3'. */
  key: string;
  /** The stage of the worked solution, 1–14. The same for every step of one id; assembly and assembled share 6, nodal-loads, member-loads and load-vector 7, the four of the elimination 10. */
  number: number;
  /** Within a stage: the member label, the pass or the unknown (1 first); null for a step that is alone. */
  sub: number | null;
  scope: StepScope;
  /** The keys of the earlier steps whose data this step is computed from. */
  from: string[];
  /** The numbers the title and the lead sentence need (counts, the pivot, a flag). Documented per id in model of steps (engine.ts). */
  facts: Record<string, number | boolean | string>;
  /** The formulas of the step, as language-independent math notation (see FORMULA ALPHABET in engine.ts). */
  formulas: string[];
  blocks: Block[];
}

/* ── What comes back: the solution ────────────────────────────────────── */

/** The internal forces just inside an end of a member (the SIGNS above). */
export interface EndLine {
  N: number;
  V: number;
  M: number;
}

export interface MemberForces {
  member: number;
  /** The member's end displacements: global (in code order) and local ([u_i, v_i, θ_i, u_j, v_j, θ_j]; a bar [u_i, u_j]). */
  uGlobal: number[];
  uLocal: number[];
  /** What the nodes exert on the member, local axes: k·u_local + f_FE ([Fx_i, Fy_i, M_i, Fx_j, Fy_j, M_j]; a bar [f_i, f_j]). */
  f: number[];
  /** The fixed-end forces of the member's loads (local): zeros for a member with no load; null in truss mode. */
  fixedEnd: number[] | null;
  /** Frame mode: the internal forces at the start (i) and the end (j). Truss mode: start = {N: −f_i, V: 0, M: 0}, end = {N: f_j, V: 0, M: 0}. */
  start: EndLine;
  end: EndLine;
  /** Truss mode: the axial force N (tension +), the stress N/A (F/L²) and the elongation N·L/(E·A) (L). Null in frame mode. */
  bar: { N: number; stress: number; elongation: number } | null;
  /**
   * What rounding could have put into each component of `f` (same order and units): 8 × the machine epsilon × (the terms k·u_local added up in it + the
   * fixed-end force). A component no larger than this is a rounding and is printed as 0; one larger is a force, however small it is beside the rest of the
   * structure (a member a million times stiffer than another carries forces that are small only beside its own terms).
   */
  floor: number[];
}

export interface ReactionEntry {
  /** The restrained DOF. */
  dof: number;
  label: string;
  node: number;
  kind: DofKind;
  /** The force (or moment) the support exerts on the structure along this DOF. */
  value: number;
}

export type CheckId = 'sum-fx' | 'sum-fy' | 'sum-moment' | 'joints' | 'energy' | 'system' | 'solve';

/**
 * One check of step 14. `value` is the quantity that must be zero (a sum of loads and reactions, the largest joint imbalance, the
 * difference of the two energies, the largest of K·u − P − R, the largest residual of the reduced equations); `scale` is what rounding is
 * measured against (a force scale; for the moment about a point, the force scale times the structure's size; for the energy, the sizes of the
 * terms of the two sums added up: ½Σ|u·K·u| + ½Σ|u·P| + ½Σ|u_R·R|);
 * `ok` is |value| ≤ RESIDUAL × scale. With a scale of 0 (nothing loaded, nothing moves) the value is 0 and ok.
 */
export interface Check {
  id: CheckId;
  value: number;
  scale: number;
  ok: boolean;
}

export interface Solution {
  ok: true;
  mode: Mode;
  dofs: Dof[];
  nodes: SolvedNode[];
  members: SolvedMember[];
  /** The worked solution, in order. */
  steps: Step[];
  /** The DOF numbers of the free DOFs and of the restrained ones, ascending. */
  free: number[];
  restrained: number[];
  /** The results, the very numbers of the steps: u (one entry per DOF), P (the load vector), R (the reactions), the member forces. */
  u: number[];
  P: number[];
  K: number[][];
  reactions: ReactionEntry[];
  forces: MemberForces[];
  checks: Check[];
  /**
   * The size of the structure (diagonal of the box around the nodes), the point the moments are taken about (its centre) and the force scale:
   * the loads added up (every |load| and member load, a moment over the size), or the largest reaction or end force, or — where larger — the largest sum of
   * the sizes of the terms of an equation, Σ|K·u| + |P| at a DOF (a moment over the size): what rounding is measured against.
   */
  size: number;
  about: { x: number; y: number };
  scale: number;
  warnings: Warning[];
}

export interface Failure {
  ok: false;
  issues: Issue[];
  /**
   * The steps worked out before the failure (a mechanism comes with steps 1 to 9 and the passes of the elimination up to the zero pivot,
   * the last of them marked `singular: true`); empty for a model the engine could not read or that is not whole.
   */
  steps: Step[];
}

export type Outcome = Solution | Failure;
