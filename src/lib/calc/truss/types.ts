/**
 * ─────────────────────────────────────────────────────────────────
 * TRUSS MEMBER FORCES — what the engine is given and what it returns
 * ─────────────────────────────────────────────────────────────────
 * The fifth calculator of the catalogue ("Truss member forces",
 * /resources/truss): "Axial force in every member, tension or compression,
 * and the reactions of a 2D truss." A plane pin-jointed truss — straight
 * members joined at nodes by frictionless pins, loads and supports at the
 * nodes only — solved by the direct stiffness method (engine.ts).
 *
 * This file is the agreement between the engine (engine.ts), the form
 * (model.ts), the templates (templates.ts), the analysis (analysis.ts) and the
 * page. It holds types, and the few limits that all of them share.
 *
 * PURE STATICS. There is no design code, no factor and no verdict in any of
 * it: forces, reactions, displacements and — only where an area is given — the
 * axial stress N / A. Whether a member is adequate is the engineer's.
 *
 * UNITS: any consistent set. Lengths in one unit (L): coordinates, member
 * lengths, displacements. Forces in one unit (F). Then an area is in L², a
 * modulus of elasticity in F/L², a stress in F/L². (The form works in feet and
 * kips or metres and kilonewtons, brings the section's inches or millimetres
 * across in one place, and shows displacements in inches or millimetres:
 * model.ts.)
 *
 * INDICES. In this file and in the engine every list is read by INDEX FROM 0:
 * node 0 is the first node of `nodes`, `Member.i` is the index of a node, and
 * an issue names a node by its index. The page numbers nodes and members from 1
 * ("node 1", "member 1"); analysis.ts does the +1, once, and its results are
 * in LABELS from 1.
 *
 * SIGNS.
 *   - Coordinates: x to the right, y UP. A load or a reaction is positive
 *     along +x and +y: a gravity load is a NEGATIVE fy.
 *   - A member's axial force N is positive in TENSION and negative in
 *     COMPRESSION. A tension pulls the two nodes of the member towards each
 *     other.
 *   - A reaction is the force the support exerts ON THE TRUSS.
 *   - A moment is positive counter-clockwise: M = Σ (x − x₀)·Fy − (y − y₀)·Fx.
 *   - A member's direction is from node i to node j: its direction cosines
 *     (cx, cy) are those of the vector from i to j, and its elongation is
 *     positive when it gets longer.
 *
 * SUPPORTS. A node may have ONE support (a second at the same node is
 * refused: two rollers there are a pin, and a pin and a roller are a pin).
 *   - 'pin' holds the node against moving at all: two reaction components.
 *   - 'roller' holds the node against moving ALONG ONE DIRECTION and leaves it
 *     free to move across it: one reaction component, along that same line.
 *     `angle` is that direction in DEGREES counter-clockwise from +x: the line
 *     the reaction acts along (the normal to the surface the roller runs on).
 *       90   a roller on a horizontal surface: resists vertical movement
 *            (the usual roller);
 *       0    resists horizontal movement (a roller against a vertical wall);
 *       any other angle: an inclined roller, e.g. 45 or 120. Angle and angle
 *            + 180 are the same line; the engine reads it modulo 180, and
 *            returns it in [0, 180).
 *
 * LIMITS the whole calculator holds (and the form enforces): 40 NODES, 120
 * MEMBERS, 40 supports and 80 loads. The engine refuses a model above any of
 * them ('too-big'), so that a link or a hand-made model cannot ask for an
 * unbounded amount of work.
 */

export const MAX_NODES = 40;
export const MAX_MEMBERS = 120;
export const MAX_SUPPORTS = 40;
export const MAX_LOADS = 80;

export interface TrussNode {
  x: number;
  y: number;
}

export interface TrussMember {
  /** Index of the node at one end, and of the node at the other. */
  i: number;
  j: number;
  /** Cross-sectional area (L²) of THIS member, overriding the model's `A`. */
  A?: number;
  /** Modulus of elasticity (F/L²) of THIS member, overriding the model's `E`. */
  E?: number;
}

export interface TrussSupport {
  /** Index of the node it holds. */
  node: number;
  kind: 'pin' | 'roller';
  /**
   * A roller's direction, degrees counter-clockwise from +x (see SUPPORTS
   * above). Missing: 90, the roller on a horizontal surface. Ignored for a pin.
   */
  angle?: number;
}

/** A force on a node, along +x and +y. Several loads on one node add up. */
export interface TrussLoad {
  node: number;
  fx: number;
  fy: number;
}

export interface TrussModel {
  nodes: TrussNode[];
  members: TrussMember[];
  supports: TrussSupport[];
  loads: TrussLoad[];
  /** Modulus of elasticity (F/L²) of every member that has no `E` of its own. */
  E?: number;
  /** Area (L²) of every member that has no `A` of its own. */
  A?: number;
}

/* ── What goes wrong ──────────────────────────────────────────────────── */

/**
 * Every reason the engine returns no solution. Each is a STABLE MACHINE CODE:
 * the page writes one sentence per code, in both languages. `where` / `nodes` /
 * `members` / `groups` / `count` are the numbers the sentence needs; all
 * INDICES FROM 0 here (analysis.ts turns them into labels).
 *
 *  'few-nodes'        fewer than 2 nodes.                                    count = how many
 *  'no-members'       there is not one member.
 *  'too-big'          more than 40 nodes, 120 members, 40 supports or 80      where.list; count = how many
 *                     loads.
 *  'number'           a coordinate, a load component or a roller angle is     where {list, index, field}
 *                     not a finite number, or one past 1e30 in size.
 *  'section'          an E or an A (the model's or a member's) given and      where {list: 'model'|'members', index, field: 'E'|'A'}
 *                     not a finite number above zero (or past 1e30).
 *  'member-node'      a member's i or j is not the index of a node.           where {list: 'members', index, field: 'i'|'j'}
 *  'zero-length'      a member from a node to itself.                         where members
 *  'duplicate-node'   two nodes at one place (closer than 1e-9 of the         nodes = [a, b], a < b
 *                     truss's size).
 *  'short-member'     a member shorter than 1e-6 of the truss's size: a       where members
 *                     solution would not be right to the figures printed.
 *  'duplicate-member' two members on the same pair of nodes.                  where members (the second); members = [first, second]
 *  'node-unconnected' a node with no member.                                  nodes = [node]
 *  'disconnected'     the members form two or more separate pieces            groups = the nodes of each piece (indices, ascending)
 *                     (nodes with no member are 'node-unconnected', not a
 *                     piece).
 *  'support-node'     a support's node is not the index of a node.            where supports
 *  'duplicate-support' a second support at a node that has one.               where supports (the second); nodes = [node]
 *  'load-node'        a load's node is not the index of a node.               where loads
 *  'few-supports'     fewer than 3 reaction components (a pin is 2, a         count = components
 *                     roller 1): a rigid body in a plane needs 3.
 *  'mechanism'        the truss is unstable INSIDE itself: a set of nodes     nodes = those that can move (ascending). When
 *                     can move with no member changing length (to first        'unrestrained' is ALSO reported, the nodes that
 *                     order). m + r < 2j always shows as one.                 swing most (at least half as much as the one
 *                     A joint of two members on one line, with nothing         that swings most): the rest move only as the
 *                     else, is one.                                            whole truss does.
 *  'unrestrained'     the truss as a whole is not held: it can translate or   count = how many independent rigid motions are free
 *                     turn (three supports on one line of action; a pin and
 *                     a roller whose line of action passes through the pin).
 *  'ill-conditioned'  the solution does not satisfy equilibrium to the        (a stable truss whose stiffness is too lopsided: the members' EA/L differing by 1e12 or more,
 *                     figures printed.                                         e.g. areas that differ by many orders of magnitude)
 *  'size'             a number in the results is past what a double holds.
 */
export type TrussIssueCode =
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
  | 'duplicate-support'
  | 'load-node'
  | 'few-supports'
  | 'mechanism'
  | 'unrestrained'
  | 'ill-conditioned'
  | 'size';

export interface TrussIssue {
  code: TrussIssueCode;
  /** The entry at fault, by its index in its list. */
  where?: { list: 'nodes' | 'members' | 'supports' | 'loads' | 'model'; index: number; field?: string };
  nodes?: number[];
  members?: number[];
  groups?: number[][];
  count?: number;
}

/**
 * What the engine says without refusing: the solution is there.
 *  'no-load'            every load is zero (or there is none): every force is zero.
 *  'partial-stiffness'  the truss is statically INDETERMINATE and some members
 *                       have a section (E and A) and others do not. The forces
 *                       then depend on how stiff the members are relative to
 *                       one another, and cannot be told: all members are taken
 *                       as equally stiff (EA the same). Complete the sections.
 */
export type TrussWarningCode = 'no-load' | 'partial-stiffness';
export interface TrussWarning {
  code: TrussWarningCode;
}

/* ── What comes back ──────────────────────────────────────────────────── */

export interface MemberResult {
  /** Index of the member, from 0. */
  index: number;
  i: number;
  j: number;
  /** Length. */
  length: number;
  /** Direction cosines of the vector from node i to node j. */
  cx: number;
  cy: number;
  /**
   * Axial force: positive in TENSION, negative in COMPRESSION. A force that is
   * rounding — under a billionth of the loads' size — is exactly 0 (never −0).
   */
  N: number;
  /** N is 0: the member carries nothing under these loads. */
  zero: boolean;
  /** Elongation N·L / (E·A), positive when it lengthens. Null if the member has no E or no A (the engine needs both). */
  elongation: number | null;
  /** Axial stress N / A, positive in tension. Null if the member has no A. Stress is NOT a verdict. */
  stress: number | null;
  /** The area and the modulus the member was solved with (its own, or the model's): null where there is none. */
  A: number | null;
  E: number | null;
}

/**
 * Members that are zero by INSPECTION — statics alone shows it, without solving
 * anything — and why. A member that is zero by inspection is always also `zero`
 * in its result (a test holds this on every generated truss); the converse is
 * not true (a member can come out zero for a reason that needs the whole
 * solution, e.g. symmetry in an indeterminate truss).
 *
 *  'two-members'    the node has exactly two members, not on one line, and no
 *                   load, no support: both are zero.
 *  'three-members'  the node has exactly three members, two of them on one
 *                   line, and no load, no support: the third is zero.
 *
 * Once a member is shown to be zero it is taken away, and the nodes at its ends
 * are looked at again (a chain of them is found). Each member is listed once,
 * with the node and the rule that showed it first.
 */
export type ZeroRule = 'two-members' | 'three-members';
export interface ZeroByInspection {
  member: number;
  node: number;
  rule: ZeroRule;
}

export interface ReactionResult {
  /** Index of the support in `supports`. */
  support: number;
  node: number;
  kind: 'pin' | 'roller';
  /** A roller's direction in [0, 180) degrees; null for a pin. */
  angle: number | null;
  /** Components of the force on the truss. Rounding is exactly 0. */
  rx: number;
  ry: number;
  /** Size of the reaction, ≥ 0. */
  magnitude: number;
  /** A roller's reaction along its direction (cos angle, sin angle), signed; null for a pin. */
  along: number | null;
}

export interface DisplacementResult {
  node: number;
  /** Displacement of the node, in the model's length unit (the page shows inches or millimetres), along +x and +y. */
  ux: number;
  uy: number;
  magnitude: number;
}

/**
 * Whether the truss is statically determinate: m + r − 2j.
 *   degree = 0  → 'determinate'     the forces follow from equilibrium alone;
 *   degree > 0  → 'indeterminate'   `degree` = the degree of indeterminacy k;
 *   'unstable'  m + r < 2j, or a mechanism / unrestrained motion (a count of 0 or more does not prove stability);
 *   null        the model has an error that comes before any count (a missing node…).
 * `joints` j, `members` m, `reactions` r (components: a pin 2, a roller 1).
 */
export interface Determinacy {
  joints: number;
  members: number;
  reactions: number;
  degree: number;
  word: 'determinate' | 'indeterminate' | 'unstable' | null;
}

export interface Equilibrium {
  /** The point the moments are taken about: the centre of the box around the nodes. */
  about: { x: number; y: number };
  /**
   * The applied loads plus the reactions, added up. Zero but for rounding; no
   * truss is returned with one of more than a millionth of `scale`.
   */
  sumFx: number;
  sumFy: number;
  sumM: number;
  /** The largest force left over at any node once its members, its load and its reaction are in. Zero but for rounding. */
  joint: number;
  /** The size of the problem, as a force: every load's size added up. What rounding is measured against. */
  scale: number;
}

export interface Extreme {
  /** Index of the member. */
  member: number;
  /** The force, signed: positive for the largest tension, negative for the largest compression. */
  N: number;
}

export interface TrussSolution {
  ok: true;
  nodes: TrussNode[];
  members: MemberResult[];
  reactions: ReactionResult[];
  /** One per node. Null unless every member has E and A (the displacements of a truss are in the stiffness). */
  displacements: DisplacementResult[] | null;
  determinacy: Determinacy;
  /**
   * 'absolute': every member has E and A, so elongations and displacements are
   * real. 'equal': not — the members are taken as equally stiff (EA the same).
   * That changes the forces only in a truss that is statically indeterminate.
   */
  stiffness: 'absolute' | 'equal';
  equilibrium: Equilibrium;
  /** The largest tension (the highest N above zero) and the largest compression (the lowest N below zero): null where there is none. */
  largest: { tension: Extreme | null; compression: Extreme | null };
  /** The members that are zero by inspection. */
  inspection: ZeroByInspection[];
  warnings: TrussWarning[];
}

export interface TrussFailure {
  ok: false;
  issues: TrussIssue[];
}

export type TrussOutcome = TrussSolution | TrussFailure;
