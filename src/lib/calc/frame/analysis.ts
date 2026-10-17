import { RESIDUAL, countOf, directionOf, solveFrame } from './engine';
import { derivPoly, evalPoly, rootsOn } from './element';
import { FRAME_UNITS, FROM_ENGINE, issueRow, settlementOf, toEngine, type FrameForm, type FrameList, type FrameRow, type FrameUnitNames } from './model';
import { FRAME_ZERO, type Determinacy, type FrameIssueCode, type FrameSolution, type FrameSupportKind, type FrameWarningCode, type MemberResult, type StationKind } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANE FRAME ANALYSIS — from the form to everything the page prints and draws
 * ─────────────────────────────────────────────────────────────────────────────
 * This calculator's `analyse`: the form as it stands (model.ts) goes in; out come the faults by row, and — when the
 * frame can be solved — every number of the tables and every line of the drawings, ALREADY SETTLED and IN THE UNITS SHOWN. A
 * value that is rounding is zero here, once, so the table, the drawing and the words for a screen reader cannot say
 * different things. The component lays it out and decides nothing about a number.
 *
 * LABELS. Everything in this file is numbered FROM 1, as the page numbers it: node 1, member 1, support 1, load 1. (The
 * engine counts from 0; the +1 is made here and nowhere else.) A label is a row's place in its list, so it changes when a
 * row before it is deleted. `row` on an issue names the row by its id, which does not; the label of that row is `at`.
 *
 * NO WORDS. Where a word is wanted — a problem, a warning, a kind of support — this file gives a STABLE MACHINE CODE and the
 * numbers the sentence needs; strings.ts (the page's, in both languages) writes the sentence. The codes:
 *
 *   issues.code     FrameIssueCode (types.ts lists every one with its numbers) plus 'duplicate-nodes' (three or more nodes at one
 *                   place: one issue for the lot) and 'scale' (two nodes the engine took for one because the frame is vastly
 *                   bigger than the gap between them: they are NOT at one place).
 *   warnings.code   'no-load' | 'no-stiffness' | 'bar' | 'free-rotation' | 'no-expansion' (types.ts)
 *   determinacy.word   'determinate' | 'indeterminate' | 'unstable' | null
 *   station.kind    'end' | 'load' | 'zero-shear' | 'zero-moment' | 'zero-axial'
 *   support.kind    'fixed' | 'pin' | 'roller' | 'guide' | 'spring'
 *
 * THE ONE TOLERANCE (types.ts, FRAME_ZERO = 1e-9). A force, a moment, a displacement under that fraction of the problem's size is
 * rounding and is exactly 0 (never −0): forces and reactions against `scale` (the loads added up, or the largest end force or
 * reaction where the loads are zero or self-balancing, as a temperature change or a settlement is); moments against scale × the
 * frame's size; displacements against the largest displacement; a rotation against the largest rotation. The equilibrium
 * sums are settled against the same floors. `balanced` is the engine's own test (RESIDUAL = 1e-6 of the scale).
 *
 * UNITS. The engine works in feet and kips or metres and kilonewtons. Forces, lengths, reactions and moments are the same numbers
 * in the units shown. A displacement is brought to inches or millimetres; a rotation is in radians (and degrees beside it); a
 * stress is never computed. Nothing in the results is in a unit the form does not show.
 *
 * ── THE DRAWINGS ─────────────────────────────────────────────────────────────
 * All in the length unit shown, y UP (the page flips for the screen).
 *   drawing.frame      the frame with its supports, hinges, loads and reactions: nodes, members, supports, hinges, nodal loads, member
 *                      loads, reactions, `box` (around the nodes) and `frame` (the box padded by `pad` all round, room for the
 *                      arrows and the supports).
 *   drawing.moment / .shear / .axial   one diagram each, at ONE SCALE for the whole frame. `scale.perUnit` is the value per unit of drawing
 *                      length (kip·ft per ft, kN per m), a clean number (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ) chosen so
 *                      that the largest value is drawn 13 % to 17 % of the frame's larger side (`scale.share`). CONVENTION: the BENDING
 *                      MOMENT is drawn on the TENSION side of the member (a sagging moment hangs below a horizontal member, a
 *                      hogging one stands above it: the shape follows the deflection); SHEAR and AXIAL force are drawn on the +ȳ side
 *                      (the left of the direction i→j) when positive, on the other when negative; the sign is in `polygons[].sign`,
 *                      which is also what a viewer needs for hatching or a "+"/"−". Each member's `outline` has a point at every key
 *                      station (both sides of a jump) and 24 along every curved piece; `polygons` are the shaded areas between the member
 *                      and the outline, split exactly where the sign changes. `labels` are the values worth writing (ends, extremes).
 *   drawing.deflected  the deflected shape, EXAGGERATED by `factor` (a clean number, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ) so that the
 *                      largest displacement is 5 % to 8 % of the frame's larger side. Closed-form, not a cubic: it follows the member's loads.
 *                      `factor` is null when nothing moves, or when the frame has no stiffness (no E, A or I).
 */

export type AnalysisIssueCode = FrameIssueCode | 'duplicate-nodes' | 'scale';

export interface AnalysisIssue {
  code: AnalysisIssueCode;
  /** The row at fault, when it is one row; `at` is its label (from 1) in its list. */
  row?: FrameRow;
  at?: number;
  /** Nodes (labels from 1): the ones that can move ('mechanism'), the pair ('duplicate-node'), the node ('node-unconnected', 'duplicate-support', 'hinged-joint-moment'). */
  nodes?: number[];
  /** Members (labels from 1): the pair of 'duplicate-member'; the member of a load that needs a depth. */
  members?: number[];
  /** 'disconnected': the nodes (labels) of each separate piece. */
  groups?: number[][];
  /** 'few-nodes', 'few-supports', 'unrestrained', 'mechanism', 'sections', 'too-big': the number the sentence needs. */
  count?: number;
  kind?: 'sway' | 'rotation';
  /** 'mechanism' of kind 'rotation': the nodes (labels) at which a hinge lets the part swing: the hinge to take out. */
  hinges?: number[];
  /** 'load-position': the member's length. 'scale': how far apart the two nodes are, and how big the frame is across (length unit). */
  length?: number;
  distance?: number;
  size?: number;
  /** 'too-big': which list, and how many it may have. */
  list?: FrameList;
  max?: number;
}

export interface AnalysisWarning {
  code: FrameWarningCode;
  /** Labels from 1. */
  members?: number[];
  nodes?: number[];
}

export interface EndLine {
  N: number;
  V: number;
  M: number;
}
export interface StationLine {
  /** Distance from node i (ft, m). */
  x: number;
  kind: StationKind;
  side: 'left' | 'right' | null;
  N: number;
  V: number;
  M: number;
}
export interface ValueAt {
  value: number;
  /** Distance from node i. */
  x: number;
}

export interface MemberLine {
  label: number;
  /** The labels of its two nodes. */
  i: number;
  j: number;
  length: number;
  /** Direction of i→j in degrees counter-clockwise from +x, in (−180, 180]. */
  angle: number;
  hingeStart: boolean;
  hingeEnd: boolean;
  /** The section it was solved with (in², in⁴, ksi / mm², 10⁶ mm⁴, GPa): null where there is none. */
  A: number | null;
  I: number | null;
  E: number | null;
  /** Internal forces just inside each end. */
  start: EndLine;
  end: EndLine;
  /** The largest and smallest of each along the member. */
  maxima: { N: { max: ValueAt; min: ValueAt }; V: { max: ValueAt; min: ValueAt }; M: { max: ValueAt; min: ValueAt } };
  stations: StationLine[];
  /** The exact N, V, M of the member as polynomials in t = x − x0 over each stretch (kip, kip·ft; ft): what `memberValuesAt` evaluates, for a pointer moving over a diagram. */
  pieces: { x0: number; x1: number; N: number[]; V: number[]; M: number[] }[];
  /** Largest end displacement of the member's axis relative to its chord (the deflection), signed along +ȳ, at the largest |v|: null with no stiffness. */
  deflection: ValueAt | null;
}

export interface ReactionLine {
  /** The support's label among the supports, from 1; and its node's label. */
  label: number;
  node: number;
  kind: FrameSupportKind;
  angle: number | null;
  /** The force and the (counter-clockwise) moment the support exerts on the frame. */
  rx: number;
  ry: number;
  rm: number;
  magnitude: number;
  along: number | null;
  across: number | null;
  spring: { fx: number; fy: number; m: number } | null;
}

export interface DisplacementLine {
  node: number;
  /** In inches or millimetres. */
  ux: number;
  uy: number;
  magnitude: number;
  /** Radians, counter-clockwise; null where it does not matter (every member hinged there). */
  rotation: number | null;
  rotationDegrees: number | null;
}

export interface ExtremeLine {
  /** Member label, from 1. */
  member: number;
  /** Distance from the member's start. */
  x: number;
  value: number;
}

export interface FrameResults {
  members: MemberLine[];
  reactions: ReactionLine[];
  /** Null unless every member has E, A and I (stiffness 'absolute'). */
  displacements: DisplacementLine[] | null;
  stiffness: 'absolute' | 'none';
  extremes: { M: { max: ExtremeLine | null; min: ExtremeLine | null }; V: { max: ExtremeLine | null; min: ExtremeLine | null }; N: { max: ExtremeLine | null; min: ExtremeLine | null } };
  /** The largest size of each, for the share of a bar or a colour. */
  maxAbs: { M: number; V: number; N: number };
  /** The largest displacement (inches, mm), null with no stiffness. */
  maxDisplacement: number | null;
  equilibrium: {
    about: { x: number; y: number };
    /** Loads (nodal, member loads) plus reactions: zero but for rounding, and exactly 0 below the floor. */
    sumFx: number;
    sumFy: number;
    sumM: number;
    /** The largest force (or moment over the frame's size) left at any joint. */
    joint: number;
    /** The loads added up (kip, kN, kip·ft, kN·m about `about`). */
    applied: { fx: number; fy: number; m: number };
    /** The reactions added up, same terms. */
    reacted: { fx: number; fy: number; m: number };
    balanced: boolean;
    /** The floors: what is 0 below (force; moment). */
    floor: { force: number; moment: number };
    scale: number;
  };
}

/* ── The drawings ─────────────────────────────────────────────────────── */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
}
export interface Pt {
  x: number;
  y: number;
}

export interface DrawingNode {
  label: number;
  x: number;
  y: number;
  /** Every member that meets here has a hinge here and nothing holds the rotation. */
  rotationFree: boolean;
}
export interface DrawingMember {
  label: number;
  i: number;
  j: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hingeStart: boolean;
  hingeEnd: boolean;
}
export interface DrawingSupport {
  /** Label of the support among the supports, and of its node. */
  label: number;
  node: number;
  x: number;
  y: number;
  kind: FrameSupportKind;
  /** Roller / guide: the restrained line in [0, 180). */
  angle: number | null;
  /** Which springs the support has (kx, ky, kr > 0). */
  springs: { x: boolean; y: boolean; r: boolean };
  /** It settles (any of dx, dy, dr ≠ 0). */
  settles: boolean;
  /** The settlement that counts (a pin and a roller have no rotation to settle), in the units shown (in, mm; radians), or null. */
  settle: { dx: number; dy: number; dr: number } | null;
}
export interface DrawingHinge {
  member: number;
  end: 'start' | 'end';
  node: number;
  /** The place of the hinge: the end of the member. */
  x: number;
  y: number;
  /** Unit vector pointing from the hinge into the member. */
  dx: number;
  dy: number;
}
export interface DrawingNodalLoad {
  label: number;
  node: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
  m: number;
  magnitude: number;
  /** Unit vector the force acts along ((0, 0) when there is no force). */
  dx: number;
  dy: number;
  /** Magnitude over the largest nodal force, 0 to 1. */
  share: number;
}
export interface DrawingMemberLoad {
  label: number;
  member: number;
  kind: 'udl' | 'udl-projected' | 'trapezoid' | 'point' | 'moment' | 'temperature';
  /** The loaded stretch along the member axis, global (a point load / couple: both ends are its place). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Distances from the member's start. */
  a: number;
  b: number;
  /** The direction the load pushes (unit vector, global), (0, 0) for a couple, a temperature change or zero. */
  dx: number;
  dy: number;
  /** Intensity at a and b (kip/ft, kN/m; a point load: its size at both; a couple: M at both), as sizes ≥ 0 with the direction in (dx, dy); `signed` keeps the sign the form has. */
  v1: number;
  v2: number;
  signed: { w1: number; w2: number };
  /** Counter-clockwise couple (+1) or clockwise (−1); 0 otherwise. */
  turn: -1 | 0 | 1;
  /** Temperature: the changes (°F, °C) as entered. */
  temperature: { dT: number; dTg: number } | null;
  /** v1, v2 over the largest of the member loads of the same kind class (lines; points; couples), 0 to 1. */
  share: number;
}
export interface DrawingReaction {
  label: number;
  node: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  rm: number;
  magnitude: number;
  dx: number;
  dy: number;
  share: number;
}

export interface FrameDrawing {
  nodes: DrawingNode[];
  members: DrawingMember[];
  supports: DrawingSupport[];
  hinges: DrawingHinge[];
  loads: DrawingNodalLoad[];
  memberLoads: DrawingMemberLoad[];
  reactions: DrawingReaction[];
  /** The box around the nodes, and the same padded all round by `pad`. Zero-size boxes at the origin for a frame with no node. */
  box: Box;
  frame: Box;
  pad: number;
  /** The larger side of `box`. */
  side: number;
  moment: Diagram | null;
  shear: Diagram | null;
  axial: Diagram | null;
  deflected: Deflected | null;
}

export interface DiagramPoint {
  /** Global position of the outline point. */
  x: number;
  y: number;
  /** Distance from the member's start. */
  s: number;
  value: number;
}
export interface DiagramPolygon {
  sign: 1 | -1;
  /** The closed polygon between the member and the outline, global. */
  points: Pt[];
}
export interface DiagramLabel {
  /** Where to write it: the outline point; and the member axis point it belongs to. */
  x: number;
  y: number;
  ax: number;
  ay: number;
  s: number;
  value: number;
  kind: 'start' | 'end' | 'max' | 'min';
  /** |value| over the diagram's largest, 0 to 1: a label under a few per cent is not worth writing. */
  share: number;
}
export interface DiagramMember {
  member: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  outline: DiagramPoint[];
  polygons: DiagramPolygon[];
  labels: DiagramLabel[];
}
export interface Diagram {
  kind: 'M' | 'V' | 'N';
  /** Unit of the values (kip·ft, kN·m, kip, kN). */
  unit: string;
  /** The largest |value| of the whole frame. 0: the diagram is empty and has no scale. */
  max: number;
  /** Null when `max` is 0. */
  scale: { perUnit: number; height: number; share: number } | null;
  /** 'tension' (moment: drawn on the tension side) or 'left' (positive on the left of i→j). */
  side: 'tension' | 'left';
  members: DiagramMember[];
  /** The diagram's drawing extent: nodes, outlines. Padded. */
  frame: Box;
}
export interface Deflected {
  /** The exaggeration. Null: nothing moves. */
  factor: number | null;
  /** The largest displacement of any point (inches, mm), and what it is drawn as a share of the larger side (0.05 to 0.08). */
  maxDisplacement: number;
  share: number | null;
  members: { member: number; points: Pt[] }[];
  nodes: { node: number; x: number; y: number }[];
  frame: Box;
}

export interface FrameAnalysis {
  units: FrameUnitNames;
  /** Faults that stop a solution, each once. Empty: solved. */
  issues: AnalysisIssue[];
  warnings: AnalysisWarning[];
  /** The counts and the plain word; also when the frame is not solved, as far as the counts can be made. */
  determinacy: Determinacy;
  /** Null when not solved. */
  results: FrameResults | null;
  drawing: FrameDrawing;
}

/* ── The settling ─────────────────────────────────────────────────────── */

const clean = (v: number): number => (v === 0 ? 0 : v);
const settle = (v: number, floor: number): number => (Math.abs(v) <= floor ? 0 : clean(v));
const numbers = (...v: number[]): boolean => v.every(Number.isFinite);
const round9 = (v: number): number => clean(Math.round(v * 1e9) / 1e9);

/** The clean numbers a scale is chosen from, within one decade (the next is 10 times the first). */
const NICE_SCALE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
const NICE_FACTOR = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
export function nice(target: number, series: readonly number[]): number {
  if (!(target > 0) || !Number.isFinite(target)) return 1;
  const decade = Math.floor(Math.log10(target));
  let best = 1;
  let bestDistance = Infinity;
  for (const d of [decade - 1, decade, decade + 1]) {
    for (const s of [...series, 10]) {
      const v = s * 10 ** d;
      const dist = Math.abs(Math.log(v / target));
      if (dist < bestDistance) {
        bestDistance = dist;
        best = v;
      }
    }
  }
  return Number(best.toPrecision(6));
}

/* ── Drawing without a solution ───────────────────────────────────────── */

function emptyBox(): Box {
  return { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 };
}
function boxOf(points: Pt[], pad = 0): Box {
  if (points.length === 0) return emptyBox();
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs) - pad;
  const x1 = Math.max(...xs) + pad;
  const y0 = Math.min(...ys) - pad;
  const y1 = Math.max(...ys) + pad;
  return { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 };
}

function drawingOf(form: FrameForm, solution: FrameSolution | null, scale: Scales | null): FrameDrawing {
  const label = new Map(form.nodes.map((n, k) => [n.id, k + 1]));
  const at = new Map(form.nodes.map((n) => [n.id, n]));
  const memberLabel = new Map(form.members.map((m, k) => [m.id, k + 1]));
  const placed = form.nodes.filter((n) => numbers(n.x, n.y));
  const counts = countOf(toEngine(form).model);
  const inert = new Set(counts.inert);
  const nodeIndex = new Map(form.nodes.map((n, k) => [n.id, k]));

  const nodes: DrawingNode[] = placed.map((n) => ({ label: label.get(n.id)!, x: n.x, y: n.y, rotationFree: inert.has(nodeIndex.get(n.id)!) }));

  const members: DrawingMember[] = [];
  const hinges: DrawingHinge[] = [];
  form.members.forEach((m, k) => {
    const a = at.get(m.i);
    const b = at.get(m.j);
    if (!a || !b || !numbers(a.x, a.y, b.x, b.y)) return;
    members.push({ label: k + 1, i: label.get(m.i)!, j: label.get(m.j)!, x1: a.x, y1: a.y, x2: b.x, y2: b.y, hingeStart: m.hingeStart, hingeEnd: m.hingeEnd });
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L > 0) {
      const dx = (b.x - a.x) / L;
      const dy = (b.y - a.y) / L;
      if (m.hingeStart) hinges.push({ member: k + 1, end: 'start', node: label.get(m.i)!, x: a.x, y: a.y, dx, dy });
      if (m.hingeEnd) hinges.push({ member: k + 1, end: 'end', node: label.get(m.j)!, x: b.x, y: b.y, dx: clean(-dx), dy: clean(-dy) });
    }
  });

  const supports: DrawingSupport[] = [];
  form.supports.forEach((s, k) => {
    const n = at.get(s.node);
    if (!n || !numbers(n.x, n.y)) return;
    const directional = s.kind === 'roller' || s.kind === 'guide';
    supports.push({
      label: k + 1,
      node: label.get(s.node)!,
      x: n.x,
      y: n.y,
      kind: s.kind,
      angle: directional && Number.isFinite(s.angle) ? directionOf(s.angle).angle : null,
      springs: { x: s.kx > 0, y: s.ky > 0, r: s.kr > 0 },
      settles: (({ dx, dy, dr }) => dx !== 0 || dy !== 0 || dr !== 0)(settlementOf(s)),
      settle: (({ dx, dy, dr }) => (dx !== 0 || dy !== 0 || dr !== 0 ? { dx, dy, dr } : null))(settlementOf(s)),
    });
  });

  const arrow = (node: number, fx: number, fy: number) => {
    const n = at.get(node);
    if (!n || !numbers(n.x, n.y, fx, fy)) return null;
    const magnitude = Math.hypot(fx, fy);
    return { node: label.get(node)!, x: n.x, y: n.y, magnitude, dx: magnitude === 0 ? 0 : fx / magnitude, dy: magnitude === 0 ? 0 : fy / magnitude };
  };
  const loads: DrawingNodalLoad[] = [];
  form.loads.forEach((l, k) => {
    const a = arrow(l.node, l.fx, l.fy);
    if (!a || !Number.isFinite(l.m) || (a.magnitude === 0 && l.m === 0)) return;
    loads.push({ label: k + 1, ...a, fx: l.fx, fy: l.fy, m: l.m, share: 0 });
  });
  const topLoad = Math.max(0, ...loads.map((l) => l.magnitude));
  for (const l of loads) l.share = topLoad === 0 ? 0 : l.magnitude / topLoad;

  const memberLoads: DrawingMemberLoad[] = [];
  form.memberLoads.forEach((l, k) => {
    const mk = memberLabel.get(l.member);
    const m = mk === undefined ? undefined : form.members[mk - 1];
    const a = m && at.get(m.i);
    const b = m && at.get(m.j);
    if (!m || !a || !b || !numbers(a.x, a.y, b.x, b.y)) return;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(L > 0)) return;
    const c = (b.x - a.x) / L;
    const s = (b.y - a.y) / L;
    const wholeLength = l.kind === 'udl' || l.kind === 'udl-projected' || l.kind === 'temperature';
    const from = wholeLength ? 0 : l.a;
    const to = l.kind === 'trapezoid' ? l.b : wholeLength ? L : l.a;
    if (!numbers(from, to, l.w, l.w2, l.P, l.M)) return;
    const place = (t: number): Pt => ({ x: a.x + c * t, y: a.y + s * t });
    // The direction of the force for a positive value.
    const dirVector = (dir: string): [number, number] => (dir === 'local-x' ? [c, s] : dir === 'local-y' ? [-s, c] : dir === 'global-x' ? [1, 0] : [0, 1]);
    const [ux, uy] = dirVector(l.kind === 'udl-projected' ? (l.dir === 'global-x' ? 'global-x' : 'global-y') : l.dir);
    let signed1 = 0;
    let signed2 = 0;
    let turn: -1 | 0 | 1 = 0;
    switch (l.kind) {
      case 'udl':
      case 'udl-projected':
        signed1 = signed2 = l.w;
        break;
      case 'trapezoid':
        signed1 = l.w;
        signed2 = l.w2;
        break;
      case 'point':
        signed1 = signed2 = l.P;
        break;
      case 'moment':
        signed1 = signed2 = l.M;
        turn = l.M > 0 ? 1 : l.M < 0 ? -1 : 0;
        break;
    }
    const force = l.kind !== 'moment' && l.kind !== 'temperature';
    // A negative trapezoid end pushes the other way: the arrow follows the sign of the larger end.
    const sign = Math.abs(signed1) >= Math.abs(signed2) ? Math.sign(signed1) : Math.sign(signed2);
    const p1 = place(from);
    const p2 = place(to);
    memberLoads.push({
      label: k + 1,
      member: mk!,
      kind: l.kind,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      a: from,
      b: to,
      dx: force && sign !== 0 ? clean(sign * ux) : 0,
      dy: force && sign !== 0 ? clean(sign * uy) : 0,
      v1: Math.abs(signed1),
      v2: Math.abs(signed2),
      signed: { w1: signed1, w2: signed2 },
      turn,
      temperature: l.kind === 'temperature' ? { dT: l.dT, dTg: l.dTg } : null,
      share: 0,
    });
  });
  const classOf = (k: DrawingMemberLoad['kind']) => (k === 'point' ? 'point' : k === 'moment' ? 'moment' : k === 'temperature' ? 'temperature' : 'line');
  const top = new Map<string, number>();
  for (const l of memberLoads) top.set(classOf(l.kind), Math.max(top.get(classOf(l.kind)) ?? 0, l.v1, l.v2));
  for (const l of memberLoads) {
    const t = top.get(classOf(l.kind)) ?? 0;
    l.share = t === 0 ? 0 : Math.max(l.v1, l.v2) / t;
  }

  const reactions: DrawingReaction[] = [];
  if (solution) {
    for (const r of solution.reactions) {
      const n = form.nodes[r.node];
      if (!n || !numbers(n.x, n.y)) continue;
      const rx = scale ? scale.force(r.rx) : r.rx;
      const ry = scale ? scale.force(r.ry) : r.ry;
      const rm = scale ? scale.moment(r.rm) : r.rm;
      const magnitude = Math.hypot(rx, ry);
      if (magnitude === 0 && rm === 0) continue;
      reactions.push({ label: r.support + 1, node: r.node + 1, x: n.x, y: n.y, rx, ry, rm, magnitude, dx: magnitude === 0 ? 0 : rx / magnitude, dy: magnitude === 0 ? 0 : ry / magnitude, share: 0 });
    }
    const topReaction = Math.max(0, ...reactions.map((r) => r.magnitude));
    for (const r of reactions) r.share = topReaction === 0 ? 0 : r.magnitude / topReaction;
  }

  const box = boxOf(nodes);
  const side = Math.max(box.width, box.height);
  const pad = side > 0 ? 0.14 * side : 1;
  const frame = nodes.length === 0 ? emptyBox() : boxOf(nodes, pad);
  return { nodes, members, supports, hinges, loads, memberLoads, reactions, box, frame, pad, side, moment: null, shear: null, axial: null, deflected: null };
}

/* ── The diagrams ─────────────────────────────────────────────────────── */

interface Scales {
  force: (v: number) => number;
  moment: (v: number) => number;
  displacement: number;
  rotation: (v: number) => number;
  forceFloor: number;
  momentFloor: number;
}

/** How many points a curved piece is drawn with. */
const CURVED = 24;

type PieceKey = 'N' | 'V' | 'M';

function diagramOf(kind: 'M' | 'V' | 'N', sol: FrameSolution, s: Scales, drawing: FrameDrawing, unit: string): Diagram {
  const key: PieceKey = kind;
  const floor = kind === 'M' ? s.momentFloor : s.forceFloor;
  const settleValue = (v: number) => settle(v, floor);
  let max = 0;
  for (const m of sol.members) for (const p of m.pieces) for (const x of [0, p.x1 - p.x0]) max = Math.max(max, Math.abs(settleValue(evalPoly(p[key], x))));
  // The stationary points too (an extreme inside a piece is not at its ends).
  for (const m of sol.members) for (const st of m.stations) max = Math.max(max, Math.abs(settleValue(st[key])));
  for (const m of sol.members) max = Math.max(max, Math.abs(settleValue(m.maxima[key].max.value)), Math.abs(settleValue(m.maxima[key].min.value)));
  const side = drawing.side;
  let scale: Diagram['scale'] = null;
  if (max > 0 && side > 0) {
    const perUnit = nice(max / (0.15 * side), NICE_SCALE);
    scale = { perUnit, height: max / perUnit, share: max / perUnit / side };
  }
  const k = scale ? 1 / scale.perUnit : 0;
  const sign = kind === 'M' ? -1 : 1;
  const members: DiagramMember[] = sol.members.map((m) => {
    const a = sol.nodes[m.i];
    const L = m.length;
    const ex = m.cx;
    const ey = m.cy;
    // Normal to the member, to its left (+ȳ).
    const nx = -ey;
    const ny = ex;
    const base = (t: number): Pt => ({ x: a.x + ex * t, y: a.y + ey * t });
    const outline: DiagramPoint[] = [];
    const push = (t: number, v: number) => {
      const o = scale ? sign * v * k : 0;
      const b = base(t);
      const last = outline[outline.length - 1];
      if (last && last.s === t && last.value === v) return;
      outline.push({ x: b.x + nx * o, y: b.y + ny * o, s: t, value: v });
    };
    m.pieces.forEach((p) => {
      const ell = p.x1 - p.x0;
      const c = p[key];
      let degree = 0;
      for (let d = c.length - 1; d >= 1; d--) {
        if (Math.abs(c[d]) * Math.pow(ell, d) > floor) {
          degree = d;
          break;
        }
      }
      const n = degree >= 2 ? CURVED : 1;
      for (let q = 0; q <= n; q++) {
        const t = q === n ? ell : (ell * q) / n;
        push(p.x0 + t, settleValue(evalPoly(c, t)));
      }
      // The zeros inside the piece, exactly zero, so that the shading is split where the sign changes.
      for (const st of m.stations) {
        if (st.x > p.x0 && st.x < p.x1 && (st.kind === (kind === 'M' ? 'zero-moment' : kind === 'V' ? 'zero-shear' : 'zero-axial'))) {
          const at = outline.findIndex((o) => o.s > st.x);
          const o = base(st.x);
          const entry: DiagramPoint = { x: o.x, y: o.y, s: st.x, value: 0 };
          if (at < 0) outline.push(entry);
          else outline.splice(at, 0, entry);
        }
      }
    });
    // The shading: runs of one sign between the member and the outline.
    const polygons: DiagramPolygon[] = [];
    let run: DiagramPoint[] = [];
    let runSign: 1 | -1 | 0 = 0;
    const close = (end: number) => {
      if (run.length > 0 && runSign !== 0) {
        const first = run[0];
        polygons.push({ sign: runSign, points: [base(first.s), ...run.map((p) => ({ x: p.x, y: p.y })), base(end)] });
      }
      run = [];
      runSign = 0;
    };
    outline.forEach((p, idx) => {
      const sg = p.value > 0 ? 1 : p.value < 0 ? -1 : 0;
      if (sg !== 0 && runSign !== 0 && sg !== runSign) {
        // A jump through zero at one place.
        close(outline[idx - 1].s);
      }
      if (sg === 0) {
        if (run.length > 0) {
          run.push(p);
          close(p.s);
        }
        return;
      }
      if (runSign === 0) runSign = sg;
      if (run.length === 0 && idx > 0 && outline[idx - 1].value === 0) run.push(outline[idx - 1]);
      run.push(p);
    });
    close(outline.length > 0 ? outline[outline.length - 1].s : L);
    const labels: DiagramLabel[] = [];
    const point = (t: number, v: number, kindOf: DiagramLabel['kind']) => {
      const b = base(t);
      const o = scale ? sign * v * k : 0;
      labels.push({ x: b.x + nx * o, y: b.y + ny * o, ax: b.x, ay: b.y, s: t, value: v, kind: kindOf, share: max === 0 ? 0 : Math.abs(v) / max });
    };
    if (max > 0) {
      point(0, settleValue(evalPoly(m.pieces[0][key], 0)), 'start');
      const lastPiece = m.pieces[m.pieces.length - 1];
      point(L, settleValue(evalPoly(lastPiece[key], lastPiece.x1 - lastPiece.x0)), 'end');
      const mx = m.maxima[key].max;
      const mn = m.maxima[key].min;
      if (mx.x > 1e-9 * L && mx.x < L * (1 - 1e-9) && settleValue(mx.value) !== 0) point(mx.x, settleValue(mx.value), 'max');
      if (mn.x > 1e-9 * L && mn.x < L * (1 - 1e-9) && settleValue(mn.value) !== 0) point(mn.x, settleValue(mn.value), 'min');
    }
    return { member: m.index + 1, x1: a.x, y1: a.y, x2: a.x + ex * L, y2: a.y + ey * L, outline, polygons, labels };
  });
  const pts: Pt[] = [...drawing.nodes];
  for (const m of members) for (const p of m.outline) pts.push(p);
  const frame = boxOf(pts, drawing.side > 0 ? 0.08 * drawing.side : 1);
  return { kind, unit, max, scale, side: kind === 'M' ? 'tension' : 'left', members, frame };
}

function deflectedOf(sol: FrameSolution, drawing: FrameDrawing, convert: number): Deflected | null {
  if (!sol.displacements) return null;
  const n = sol.nodes;
  interface Sample {
    member: number;
    pts: { x: number; y: number; dx: number; dy: number }[];
  }
  const samples: Sample[] = [];
  let maxDisp = 0;
  for (const m of sol.members) {
    const a = n[m.i];
    const pts: Sample['pts'] = [];
    for (const p of m.pieces) {
      if (!p.u || !p.v) continue;
      const ell = p.x1 - p.x0;
      const steps = Math.max(4, Math.ceil(CURVED / 2));
      // Local displacement (u along the member, v to its left) in global axes.
      const size = (t: number): number => {
        const u = evalPoly(p.u!, t);
        const v = evalPoly(p.v!, t);
        return Math.hypot(u * m.cx - v * m.cy, u * m.cy + v * m.cx);
      };
      let bestT = 0;
      let best = -1;
      for (let q = pts.length === 0 ? 0 : 1; q <= steps; q++) {
        const t = (ell * q) / steps;
        const u = evalPoly(p.u, t);
        const v = evalPoly(p.v, t);
        const dx = u * m.cx - v * m.cy;
        const dy = u * m.cy + v * m.cx;
        const x = p.x0 + t;
        pts.push({ x: a.x + m.cx * x, y: a.y + m.cy * x, dx, dy });
        if (Math.hypot(dx, dy) > best) {
          best = Math.hypot(dx, dy);
          bestT = t;
        }
      }
      // The largest sample is not the largest displacement: the true maximum lies between its neighbours (a golden-section search
      // there), so the largest displacement printed under the deformed shape is the table's and not 0.5 % under it.
      let lo = Math.max(0, bestT - ell / steps);
      let hi = Math.min(ell, bestT + ell / steps);
      const phi = (Math.sqrt(5) - 1) / 2;
      for (let it = 0; it < 60 && hi - lo > 1e-14 * ell; it++) {
        const c = hi - phi * (hi - lo);
        const d = lo + phi * (hi - lo);
        if (size(c) < size(d)) lo = c;
        else hi = d;
      }
      maxDisp = Math.max(maxDisp, best, size(0.5 * (lo + hi)));
    }
    samples.push({ member: m.index + 1, pts });
  }
  for (const d of sol.displacements) maxDisp = Math.max(maxDisp, d.magnitude);
  const side = drawing.side;
  const real = maxDisp * convert;
  const rounding = FRAME_ZERO * side * convert;
  let factor: number | null = null;
  if (side > 0 && maxDisp > 0 && real > rounding && Number.isFinite(maxDisp)) factor = nice((0.065 * side) / maxDisp, NICE_FACTOR);
  const f = factor ?? 0;
  const members = samples.map((s) => ({ member: s.member, points: s.pts.map((p) => ({ x: p.x + f * p.dx, y: p.y + f * p.dy })) }));
  const nodes = sol.displacements.map((d) => ({ node: d.node + 1, x: n[d.node].x + f * d.ux, y: n[d.node].y + f * d.uy }));
  const all = [...members.flatMap((m) => m.points), ...nodes, ...drawing.nodes];
  return {
    factor,
    maxDisplacement: real,
    share: factor === null ? null : (factor * maxDisp) / side,
    members,
    nodes,
    frame: boxOf(all, side > 0 ? 0.08 * side : 1),
  };
}

/**
 * N, V and M of member `member` (label, from 1) at distance x from its start, exact, settled with the results' own floors. At a jump (a point
 * load, a couple) the side asked for: 'right' by default (the value just after x), 'left' at the member's end. For a pointer over a diagram.
 */
export function memberValuesAt(results: FrameResults, member: number, x: number, side?: 'left' | 'right'): { N: number; V: number; M: number } | null {
  const m = results.members[member - 1];
  if (!m || !Number.isFinite(x)) return null;
  const end = m.pieces[m.pieces.length - 1].x1;
  const want = side ?? (x >= end ? 'left' : 'right');
  let k = m.pieces.findIndex((p) => (want === 'right' ? x >= p.x0 && x < p.x1 : x > p.x0 && x <= p.x1));
  if (k < 0) k = x >= end ? m.pieces.length - 1 : x <= m.pieces[0].x0 ? 0 : want === 'right' ? m.pieces.length - 1 : 0;
  const p = m.pieces[k];
  const t = Math.min(Math.max(x, p.x0), p.x1) - p.x0;
  const floor = results.equilibrium.floor;
  return { N: settle(evalPoly(p.N, t), floor.force), V: settle(evalPoly(p.V, t), floor.force), M: settle(evalPoly(p.M, t), floor.moment) };
}

/* ── The analysis ─────────────────────────────────────────────────────── */

/** The issues that say the frame does not stand: the determinacy word is then 'unstable'. (A moment on a free hinge says nothing of the frame; sections missing say nothing of it either.) */
const STRUCTURAL = new Set<FrameIssueCode>(['mechanism', 'unrestrained', 'few-supports']);

/**
 * The engine reports every PAIR of nodes at one place. Ten nodes typed at (0, 0) are forty-five pairs and forty-five lines of
 * the same complaint: they are merged into one issue per place. A pair that is not at one place at all, only so small beside the
 * frame that the engine's relative tolerance took it for one (a node at x = 1e20 beside two that are 8 ft apart), is a different
 * complaint and is said as one ('scale').
 */
export function mergeDuplicates(pairs: [number, number][], nodes: readonly { x: number; y: number }[]): AnalysisIssue[] {
  const parent = nodes.map((_, i) => i);
  const root = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x);
    x1 = Math.max(x1, n.x);
    y0 = Math.min(y0, n.y);
    y1 = Math.max(y1, n.y);
  }
  const size = Math.hypot(x1 - x0, y1 - y0);
  const apart: AnalysisIssue[] = [];
  const seen = new Set<number>();
  for (const [a, b] of pairs) {
    const distance = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
    const own = Math.max(Math.abs(nodes[a].x), Math.abs(nodes[a].y), Math.abs(nodes[b].x), Math.abs(nodes[b].y));
    if (distance > 1e-9 * own && distance > 0) {
      if (apart.length < 3) apart.push({ code: 'scale', nodes: [a + 1, b + 1], distance, size });
    } else parent[root(a)] = root(b);
    seen.add(a);
    seen.add(b);
  }
  const groups = new Map<number, number[]>();
  for (const k of [...seen].sort((p, q) => p - q)) {
    const r = root(k);
    groups.set(r, [...(groups.get(r) ?? []), k + 1]);
  }
  const out: AnalysisIssue[] = [];
  for (const g of groups.values()) if (g.length >= 2) out.push(g.length === 2 ? { code: 'duplicate-node', nodes: g } : { code: 'duplicate-nodes', nodes: g });
  return [...out, ...apart];
}

export function analyseFrame(form: FrameForm): FrameAnalysis {
  const units = FRAME_UNITS[form.units];
  const { model, rows } = toEngine(form);
  const outcome = solveFrame(model);
  const counts = countOf(model);
  const { inert: _inert, ...count } = counts;
  void _inert;

  if (!outcome.ok) {
    const duplicates = mergeDuplicates(
      outcome.issues.flatMap((i) => (i.code === 'duplicate-node' && i.nodes ? [[i.nodes[0], i.nodes[1]] as [number, number]] : [])),
      model.nodes,
    );
    let merged = false;
    const issues: AnalysisIssue[] = outcome.issues.flatMap((i): AnalysisIssue[] => {
      if (i.code === 'duplicate-node') {
        if (merged) return [];
        merged = true;
        return duplicates;
      }
      const row = issueRow(i, rows);
      const out: AnalysisIssue = { code: i.code };
      if (row) {
        out.row = row;
        if (row.list !== 'model') out.at = form[row.list].findIndex((r) => r.id === row.id) + 1;
      }
      if (i.nodes) out.nodes = i.nodes.map((n) => n + 1);
      if (i.members) out.members = i.members.map((m) => m + 1);
      if (i.groups) out.groups = i.groups.map((g) => g.map((n) => n + 1));
      if (i.count !== undefined) out.count = i.count;
      if (i.kind) out.kind = i.kind;
      // A member with no length (both ends on one node) is not drawn: its node is ringed in its place.
      if (i.code === 'zero-length' && i.where?.list === 'members') {
        const m = model.members[i.where.index];
        if (m) out.nodes = [...new Set([m.i + 1, m.j + 1])].filter((n) => n >= 1);
      }
      // The part that swings swings about a hinge: the node where one sits on a member that reaches a node that moves.
      if (i.code === 'mechanism' && i.kind === 'rotation' && i.nodes) {
        const moving = new Set(i.nodes);
        const at = new Set<number>();
        model.members.forEach((m) => {
          if (m.releases?.start && (moving.has(m.i) || moving.has(m.j))) at.add(m.i);
          if (m.releases?.end && (moving.has(m.i) || moving.has(m.j))) at.add(m.j);
        });
        if (at.size > 0) out.hinges = [...at].sort((p, q) => p - q).map((n) => n + 1);
      }
      if (i.length !== undefined) out.length = i.length;
      if (i.code === 'too-big' && i.where && i.where.list !== 'model') {
        out.list = i.where.list;
        out.max = { nodes: 50, members: 100, supports: 40, loads: 60, memberLoads: 120 }[i.where.list];
      }
      return [out];
    });
    const structural = outcome.issues.length > 0 && outcome.issues.every((i) => STRUCTURAL.has(i.code));
    const word: Determinacy['word'] = structural ? 'unstable' : null;
    return { units, issues, warnings: [], determinacy: { ...count, word }, results: null, drawing: drawingOf(form, null, null) };
  }
  const { results, scales } = resultsOf(form, outcome);
  const drawing = drawingOf(form, outcome, scales);
  const sc = scales;
  drawing.moment = diagramOf('M', outcome, sc, drawing, units.moment);
  drawing.shear = diagramOf('V', outcome, sc, drawing, units.force);
  drawing.axial = diagramOf('N', outcome, sc, drawing, units.force);
  drawing.deflected = deflectedOf(outcome, drawing, FROM_ENGINE[form.units].displacement);
  const warnings: AnalysisWarning[] = outcome.warnings.map((w) => ({
    code: w.code,
    ...(w.members ? { members: w.members.map((m) => m + 1) } : {}),
    ...(w.nodes ? { nodes: w.nodes.map((n) => n + 1) } : {}),
  }));
  return { units, issues: [], warnings, determinacy: outcome.determinacy, results, drawing };
}

function resultsOf(form: FrameForm, s: FrameSolution): { results: FrameResults; scales: Scales } {
  const convert = FROM_ENGINE[form.units].displacement;
  const eq = s.equilibrium;
  const forceFloor = FRAME_ZERO * eq.scale;
  const momentFloor = FRAME_ZERO * eq.scale * Math.max(eq.size, 1e-300);
  const f = (v: number) => settle(v, forceFloor);
  const mo = (v: number) => settle(v, momentFloor);

  let maxDisp = 0;
  let maxRot = 0;
  if (s.displacements) {
    for (const d of s.displacements) {
      maxDisp = Math.max(maxDisp, d.magnitude);
      if (d.rotation !== null) maxRot = Math.max(maxRot, Math.abs(d.rotation));
    }
    for (const m of s.members) for (const p of m.pieces) if (p.v) for (const t of [0, p.x1 - p.x0]) maxDisp = Math.max(maxDisp, Math.abs(evalPoly(p.v, t)), Math.abs(evalPoly(p.u!, t)));
  }
  const dispFloor = FRAME_ZERO * maxDisp;
  const rotFloor = FRAME_ZERO * maxRot;
  const disp = (v: number) => clean(settle(v, dispFloor) * convert);
  const scales: Scales = { force: f, moment: mo, displacement: convert, rotation: (v) => settle(v, rotFloor), forceFloor, momentFloor };

  const at = (e: { x: number; value: number }, floor: number): ValueAt => ({ value: settle(e.value, floor), x: clean(e.x) });
  const members: MemberLine[] = s.members.map((m: MemberResult) => {
    const row = form.members[m.index];
    const end = (e: { N: number; V: number; M: number }): EndLine => ({ N: f(e.N), V: f(e.V), M: mo(e.M) });
    let deflection: ValueAt | null = null;
    if (!m.displacements) deflection = null;
    else {
      // The deflection relative to the chord: v(x) − (v_i + (v_j − v_i)·x/L), the largest in size: at the ends of the pieces and where its slope is zero.
      const vi = m.displacements[1];
      const vj = m.displacements[4];
      let best = { value: 0, x: 0 };
      for (const p of m.pieces) {
        const ell = p.x1 - p.x0;
        const c = p.v!.slice();
        c[0] -= vi + ((vj - vi) * p.x0) / m.length;
        c[1] -= (vj - vi) / m.length;
        const tiny = 1e-15 * Math.max(...c.map((v, q) => Math.abs(v) * Math.pow(ell, q)), 0) / Math.max(ell, 1e-300);
        for (const t of [0, ell, ...rootsOn(derivPoly(c), ell, tiny)]) {
          const rel = evalPoly(c, t);
          if (Math.abs(rel) > Math.abs(best.value)) best = { value: rel, x: p.x0 + t };
        }
      }
      deflection = { value: settle(best.value, dispFloor) * convert, x: best.x };
      deflection.value = clean(deflection.value);
    }
    const pk = (key: 'N' | 'V' | 'M') => {
      const floor = key === 'M' ? momentFloor : forceFloor;
      return { max: at(m.maxima[key].max, floor), min: at(m.maxima[key].min, floor) };
    };
    return {
      label: m.index + 1,
      i: m.i + 1,
      j: m.j + 1,
      length: m.length,
      angle: round9(clean((Math.atan2(m.cy, m.cx) * 180) / Math.PI)),
      hingeStart: m.releases.start,
      hingeEnd: m.releases.end,
      A: row.A ?? form.A,
      I: row.I ?? form.I,
      E: row.E ?? form.E,
      start: end(m.start),
      end: end(m.end),
      maxima: { N: pk('N'), V: pk('V'), M: pk('M') },
      stations: m.stations.map((st) => ({ x: clean(st.x), kind: st.kind, side: st.side, N: f(st.N), V: f(st.V), M: mo(st.M) })),
      pieces: m.pieces.map((p) => ({ x0: p.x0, x1: p.x1, N: p.N.map(clean), V: p.V.map(clean), M: p.M.map(clean) })),
      deflection,
    };
  });
  // The model lacking stiffness has no section to show.
  const reactions: ReactionLine[] = s.reactions.map((r) => ({
    label: r.support + 1,
    node: r.node + 1,
    kind: r.kind,
    angle: r.angle,
    rx: f(r.rx),
    ry: f(r.ry),
    rm: mo(r.rm),
    magnitude: Math.hypot(f(r.rx), f(r.ry)),
    along: r.along === null ? null : f(r.along),
    across: r.across === null ? null : f(r.across),
    spring: r.spring ? { fx: f(r.spring.fx), fy: f(r.spring.fy), m: mo(r.spring.m) } : null,
  }));
  const displacements: DisplacementLine[] | null = s.displacements
    ? s.displacements.map((d) => ({
        node: d.node + 1,
        ux: disp(d.ux),
        uy: disp(d.uy),
        magnitude: Math.hypot(disp(d.ux), disp(d.uy)),
        rotation: d.rotation === null ? null : clean(settle(d.rotation, rotFloor)),
        rotationDegrees: d.rotation === null ? null : clean(settle(d.rotation, rotFloor) * (180 / Math.PI)),
      }))
    : null;

  const extreme = (e: { member: number; x: number; value: number } | null, floor: number): ExtremeLine | null => (e ? { member: e.member + 1, x: clean(e.x), value: settle(e.value, floor) } : null);
  const extremes = {
    M: { max: extreme(s.extremes.M.max, momentFloor), min: extreme(s.extremes.M.min, momentFloor) },
    V: { max: extreme(s.extremes.V.max, forceFloor), min: extreme(s.extremes.V.min, forceFloor) },
    N: { max: extreme(s.extremes.N.max, forceFloor), min: extreme(s.extremes.N.min, forceFloor) },
  };
  const abs = (a: ExtremeLine | null, b: ExtremeLine | null) => Math.max(a ? Math.abs(a.value) : 0, b ? Math.abs(b.value) : 0);
  const reacted = { fx: 0, fy: 0, m: 0 };
  for (const r of s.reactions) {
    reacted.fx += r.rx;
    reacted.fy += r.ry;
    reacted.m += (s.nodes[r.node].x - eq.about.x) * r.ry - (s.nodes[r.node].y - eq.about.y) * r.rx + r.rm;
  }
  const tolerance = RESIDUAL * eq.scale;
  const balanced = Math.abs(eq.sumFx) <= tolerance && Math.abs(eq.sumFy) <= tolerance && Math.abs(eq.sumM) <= tolerance * Math.max(eq.size, 1e-300) && eq.joint <= tolerance;
  const results: FrameResults = {
    members,
    reactions,
    displacements,
    stiffness: s.stiffness,
    extremes,
    maxAbs: { M: abs(extremes.M.max, extremes.M.min), V: abs(extremes.V.max, extremes.V.min), N: abs(extremes.N.max, extremes.N.min) },
    maxDisplacement: displacements ? clean(maxDisp * convert) : null,
    equilibrium: {
      about: eq.about,
      sumFx: f(eq.sumFx),
      sumFy: f(eq.sumFy),
      sumM: mo(eq.sumM),
      joint: f(eq.joint),
      applied: { fx: f(eq.applied.fx), fy: f(eq.applied.fy), m: mo(eq.applied.m) },
      reacted: { fx: f(reacted.fx), fy: f(reacted.fy), m: mo(reacted.m) },
      balanced,
      floor: { force: forceFloor, moment: momentFloor },
      scale: eq.scale,
    },
  };
  return { results, scales };
}

/**
 * `analyseFrame`, which nothing it is given can make throw. The form goes through the engine (which does not throw) and
 * through this file's arithmetic; if anything in it did, the page would be a blank box — so it is caught here and said as
 * 'stopped', with the drawing the form still allows.
 */
export function analyseSafely(form: FrameForm): FrameAnalysis {
  try {
    return analyseFrame(form);
  } catch {
    let drawing: FrameDrawing;
    try {
      drawing = drawingOf(form, null, null);
    } catch {
      const zero = emptyBox();
      drawing = { nodes: [], members: [], supports: [], hinges: [], loads: [], memberLoads: [], reactions: [], box: zero, frame: { x0: -1, y0: -1, x1: 1, y1: 1, width: 2, height: 2 }, pad: 1, side: 0, moment: null, shear: null, axial: null, deflected: null };
    }
    return {
      units: FRAME_UNITS[form.units] ?? FRAME_UNITS.us,
      issues: [{ code: 'stopped' }],
      warnings: [],
      determinacy: { joints: 0, members: 0, reactions: 0, releases: 0, freeJoints: 0, equations: 0, degree: 0, word: null },
      results: null,
      drawing,
    };
  }
}
