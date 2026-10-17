import { RESIDUAL, countOf, solveTruss } from './engine';
import { FROM_ENGINE, TO_ENGINE, TRUSS_UNITS, issueRow, toEngine, type TrussForm, type TrussList, type TrussRow } from './model';
import type { Determinacy, TrussIssueCode, TrussSolution, TrussWarningCode, ZeroRule } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TRUSS MEMBER FORCES — from the form to everything the page prints
 * ─────────────────────────────────────────────────────────────────────────────
 * This calculator's `analyse` (shaft/analysis.ts and continuous/analysis.ts are
 * the others', and this file is written as those are): the form as it stands
 * (model.ts) goes in; out come the faults by row, and — when the truss can be
 * solved — every number of the tables and every line of the drawing, ALREADY
 * SETTLED and IN THE UNITS SHOWN. A value that is rounding is zero here, once, so
 * the table, the drawing and the words for a screen reader cannot say different
 * things. The component lays it out and decides nothing about a number.
 *
 * LABELS. Everything in this file is numbered FROM 1, as the page numbers it:
 * node 1, member 1, support 1. (The engine counts from 0; the +1 is made here
 * and nowhere else.) A label is a row's place in its list, so it changes when a
 * row before it is deleted. `row` on an issue names the row by its id, which does
 * not; the label of that row is `at`.
 *
 * NO WORDS. Where a word is wanted — a problem, tension or compression, the
 * degree of indeterminacy — this file gives a STABLE MACHINE CODE and the numbers
 * the sentence needs; strings.ts (the page's, in both languages) writes the
 * sentence. The codes:
 *
 *   issues.code   TrussIssueCode (types.ts lists every one with its numbers)
 *                 plus 'stopped': the arithmetic threw (never expected).
 *   warnings      'no-load' | 'partial-stiffness' (types.ts).
 *   state         'tension' | 'compression' | 'zero'   (a member's force: > 0, < 0, exactly 0)
 *   rule          'two-members' | 'three-members'      (why a member is zero by inspection)
 *   determinacy.word   'determinate' | 'indeterminate' | 'unstable' | null
 *
 * WHAT COUNTS AS ZERO. The engine settles a force, a reaction, a displacement
 * under a billionth of the size of the loads (or of the largest displacement)
 * to exactly 0 (engine.ts, ZERO); this file settles what is derived from them
 * the same way and, for the equilibrium sums, against the same size. A zero is
 * never −0 and is never printed as 1e-14.
 *
 * UNITS. The engine works in feet and kips or metres and kilonewtons. Forces,
 * lengths, reactions and moments are the same numbers in the units shown. A
 * displacement and an elongation are brought to inches or millimetres, a stress
 * and a modulus to ksi or MPa and GPa (model.ts, FROM_ENGINE). Nothing in the
 * results is in a unit the form does not show.
 */

/**
 * The engine's codes, plus two this file makes out of its 'duplicate-node' pairs and 'stopped'.
 *   'duplicate-nodes'  three or more nodes at one place: ONE issue for the lot (ten nodes typed at (0, 0) are 45 pairs).
 *   'scale'            two nodes the engine took for one because the truss is vastly bigger than the gap between them
 *                      (its tolerance is relative to the truss): they are NOT at the same place, and saying so was wrong.
 *   'stopped'          the arithmetic threw (never expected).
 */
export type AnalysisIssueCode = TrussIssueCode | 'duplicate-nodes' | 'scale' | 'stopped';

export interface AnalysisIssue {
  code: AnalysisIssueCode;
  /** The row at fault, when it is one row; `at` is its label (from 1) in its list. */
  row?: TrussRow;
  at?: number;
  /** Nodes (labels from 1): the ones that can move ('mechanism'), the pair ('duplicate-node'), the node ('node-unconnected', 'duplicate-support'). */
  nodes?: number[];
  /** Members (labels from 1): the pair of 'duplicate-member'. */
  members?: number[];
  /** 'disconnected': the nodes (labels) of each separate piece. */
  groups?: number[][];
  /** 'few-nodes', 'few-supports', 'unrestrained', 'too-big': the number the sentence needs. */
  count?: number;
  /** 'scale': how far apart the two nodes are, and how big the truss is across (length unit). */
  distance?: number;
  size?: number;
  /** 'too-big': which list, and how many it may have. */
  list?: TrussList;
  max?: number;
}

export interface AnalysisWarning {
  code: TrussWarningCode;
}

export type MemberState = 'tension' | 'compression' | 'zero';

export interface MemberLine {
  /** From 1. */
  label: number;
  /** The labels of its two nodes. */
  i: number;
  j: number;
  /** In the length unit (ft, m). */
  length: number;
  /** Direction cosines of the vector from node i to node j. */
  cx: number;
  cy: number;
  /** Axial force (kip, kN), tension positive; 0 when it is rounding. */
  force: number;
  state: MemberState;
  /** |force| over the largest |force| of the truss, 0 to 1: the weight of its line. 0 for a zero member and for a truss with no force. */
  share: number;
  /** Elongation (in, mm), positive when it lengthens. Null: the member has no E or no A. */
  elongation: number | null;
  /** Axial stress N / A (ksi, MPa), positive in tension. Null: no area. NOT a verdict. */
  stress: number | null;
  /** The area (in², mm²) and modulus (ksi, GPa) it was solved with; null where there is none. */
  A: number | null;
  E: number | null;
  /** Why statics alone shows it to be zero, and at which node (label); null otherwise. */
  inspection: { rule: ZeroRule; node: number } | null;
}

export interface ReactionLine {
  /** The support's label among the supports, from 1; and its node's label. */
  label: number;
  node: number;
  kind: 'pin' | 'roller';
  /** A roller's direction in [0, 180) degrees; null for a pin. */
  angle: number | null;
  /** Components of the force on the truss (kip, kN). */
  rx: number;
  ry: number;
  magnitude: number;
  /** A roller's reaction along its direction, signed; null for a pin. */
  along: number | null;
}

export interface DisplacementLine {
  node: number;
  /** In inches or millimetres. */
  ux: number;
  uy: number;
  magnitude: number;
}

export interface TrussResults {
  members: MemberLine[];
  reactions: ReactionLine[];
  /** Null unless every member has E and A (stiffness: 'absolute'). */
  displacements: DisplacementLine[] | null;
  stiffness: 'absolute' | 'relative' | 'equal';
  /** The largest tension (the highest force above zero) and compression (the lowest below zero), by member label; null where there is none. */
  largest: { tension: { member: number; force: number } | null; compression: { member: number; force: number } | null };
  /** The largest force of either kind, as a size: what `share` is measured against. 0 when there is none. */
  maxForce: number;
  /** The loads, added up (kip, kN). */
  applied: { fx: number; fy: number };
  equilibrium: {
    about: { x: number; y: number };
    /** Loads plus reactions: zero but for rounding, and exactly 0 below the floor. */
    sumFx: number;
    sumFy: number;
    sumM: number;
    /** The largest force left at any node. */
    joint: number;
    /** Whether all four are within the engine's tolerance of zero (RESIDUAL of the loads, the forces and the reactions: they are, in every solution this returns; it is the check on show). */
    balanced: boolean;
  };
  /** The members that are zero by inspection (labels from 1). */
  inspection: { member: number; node: number; rule: ZeroRule }[];
  /** Members whose force is zero, by label, in order. */
  zeroMembers: number[];
}

/** An arrow of the drawing: a load or a reaction at a node. */
export interface DrawingArrow {
  /** The label of its row among the loads, or of its support among the supports. */
  label: number;
  /** The node's label, and its position in the length unit. */
  node: number;
  x: number;
  y: number;
  /** The force it stands for (kip, kN). */
  fx: number;
  fy: number;
  magnitude: number;
  /** The unit vector the arrow points along: the direction of the force. (0, 0) for a zero force. */
  dx: number;
  dy: number;
  /** Magnitude over the largest in its group (loads, or reactions), 0 to 1: for the length of its shaft. */
  share: number;
}

export interface DrawingMember {
  label: number;
  i: number;
  j: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Null when the truss is not solved. */
  force: number | null;
  state: MemberState | null;
  /** 0 to 1, for the line weight; 0 when not solved. */
  weight: number;
}

export interface DrawingNode {
  label: number;
  x: number;
  y: number;
  /** The support at this node, if any. */
  support: { kind: 'pin' | 'roller'; angle: number | null } | null;
  /** The node's displacement in the length unit (ft, m), for a deformed shape; null when there is none. */
  ux: number | null;
  uy: number | null;
}

/**
 * The truss for the drawing, in the length unit shown (ft, m): the drawing
 * knows nothing of the form or the engine. Built from the form even when the
 * truss cannot be solved — whatever has a place (a node with two numbers, a
 * member between two such nodes) is drawn — and then with no forces.
 */
export interface TrussDrawing {
  nodes: DrawingNode[];
  members: DrawingMember[];
  loads: DrawingArrow[];
  reactions: DrawingArrow[];
  /** The box around the nodes, and the same padded all round by `pad` (room for the arrows and the supports): where to put the viewBox. Both are zero-size boxes at the origin for a truss with no node. */
  box: { x0: number; y0: number; x1: number; y1: number; width: number; height: number };
  frame: { x0: number; y0: number; x1: number; y1: number; width: number; height: number };
  pad: number;
  /**
   * What to multiply the displacements by to draw the deformed shape so that the
   * largest one is a twelfth of the truss's larger side. Null when there are no
   * displacements, or they are all nothing.
   */
  deformScale: number | null;
}

export interface TrussAnalysis {
  units: (typeof TRUSS_UNITS)[keyof typeof TRUSS_UNITS];
  /** Faults that stop a solution, each once. Empty: solved. */
  issues: AnalysisIssue[];
  warnings: AnalysisWarning[];
  /** The counts and the plain word; also when the truss is not solved, as far as the counts can be made. */
  determinacy: Determinacy;
  /** Null when not solved. */
  results: TrussResults | null;
  drawing: TrussDrawing;
}

/* ── The settling ─────────────────────────────────────────────────────── */

/** Never −0. */
const clean = (v: number): number => (v === 0 ? 0 : v);
const settle = (v: number, floor: number): number => (Math.abs(v) <= floor ? 0 : v);
const stateOf = (v: number): MemberState => (v > 0 ? 'tension' : v < 0 ? 'compression' : 'zero');

const NUMBERS = (...v: number[]) => v.every(Number.isFinite);

/* ── The drawing ──────────────────────────────────────────────────────── */

function drawingOf(form: TrussForm, solution: TrussSolution | null): TrussDrawing {
  const label = new Map(form.nodes.map((n, k) => [n.id, k + 1]));
  const placed = form.nodes.filter((n) => NUMBERS(n.x, n.y));
  const at = new Map(form.nodes.map((n) => [n.id, n]));
  const supportAt = new Map(form.supports.map((s) => [s.node, s]));

  const nodes: DrawingNode[] = placed.map((n) => {
    const s = supportAt.get(n.id);
    const d = solution?.displacements?.[label.get(n.id)! - 1];
    return {
      label: label.get(n.id)!,
      x: n.x,
      y: n.y,
      support: s ? { kind: s.kind === 'roller' ? 'roller' : 'pin', angle: s.kind === 'roller' ? (Number.isFinite(s.angle) ? ((s.angle % 180) + 180) % 180 : null) : null } : null,
      ux: d ? d.ux : null,
      uy: d ? d.uy : null,
    };
  });

  let maxForce = 0;
  if (solution) for (const m of solution.members) maxForce = Math.max(maxForce, Math.abs(m.N));
  const members: DrawingMember[] = [];
  form.members.forEach((m, k) => {
    const a = at.get(m.i);
    const b = at.get(m.j);
    if (!a || !b || !NUMBERS(a.x, a.y, b.x, b.y)) return;
    const force = solution ? solution.members[k].N : null;
    members.push({
      label: k + 1,
      i: label.get(m.i)!,
      j: label.get(m.j)!,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      force,
      state: force === null ? null : stateOf(force),
      weight: force === null || maxForce === 0 ? 0 : Math.abs(force) / maxForce,
    });
  });

  const arrow = (node: number, labelOf: number, fx: number, fy: number): DrawingArrow | null => {
    const n = at.get(node);
    if (!n || !NUMBERS(n.x, n.y, fx, fy)) return null;
    const magnitude = Math.hypot(fx, fy);
    return { label: labelOf, node: label.get(node)!, x: n.x, y: n.y, fx, fy, magnitude, dx: magnitude === 0 ? 0 : fx / magnitude, dy: magnitude === 0 ? 0 : fy / magnitude, share: 0 };
  };
  const share = (list: DrawingArrow[]): DrawingArrow[] => {
    const top = Math.max(0, ...list.map((a) => a.magnitude));
    return list.map((a) => ({ ...a, share: top === 0 ? 0 : a.magnitude / top }));
  };
  const loads = share(
    form.loads.flatMap((l, k) => {
      const a = arrow(l.node, k + 1, l.fx, l.fy);
      return a && a.magnitude > 0 ? [a] : [];
    }),
  );
  const reactions = share(
    solution
      ? solution.reactions.flatMap((r) => {
          const a = arrow(form.nodes[r.node].id, r.support + 1, r.rx, r.ry);
          return a && a.magnitude > 0 ? [a] : [];
        })
      : [],
  );

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const x0 = xs.length ? Math.min(...xs) : 0;
  const x1 = xs.length ? Math.max(...xs) : 0;
  const y0 = ys.length ? Math.min(...ys) : 0;
  const y1 = ys.length ? Math.max(...ys) : 0;
  const side = Math.max(x1 - x0, y1 - y0);
  const pad = side > 0 ? 0.14 * side : 1;
  const box = { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 };
  const frame = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad, width: x1 - x0 + 2 * pad, height: y1 - y0 + 2 * pad };

  let deformScale: number | null = null;
  if (solution?.displacements) {
    const top = Math.max(...solution.displacements.map((d) => d.magnitude));
    if (top > 0 && side > 0 && Number.isFinite(top)) deformScale = side / 12 / top;
  }
  return { nodes, members, loads, reactions, box, frame, pad, deformScale };
}

/* ── The analysis ─────────────────────────────────────────────────────── */

const STRUCTURAL = new Set<TrussIssueCode>(['mechanism', 'unrestrained', 'few-supports']);

/**
 * The engine reports every PAIR of nodes at one place. Ten nodes typed at (0, 0) are forty-five pairs and forty-five
 * lines of the same complaint: they are merged into one issue per place. A pair that is not at one place at all, only
 * so small beside the truss that the engine's relative tolerance took it for one (a node at x = 1e20 beside two that are
 * 8 ft apart), is a different complaint and is said as one ('scale').
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
    // Closer than a billionth of the nodes' own coordinates: the same place typed twice. Otherwise only the truss's size made them one.
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

export function analyseTruss(form: TrussForm): TrussAnalysis {
  const units = TRUSS_UNITS[form.units];
  const { model, rows } = toEngine(form);
  const outcome = solveTruss(model);
  const counts = countOf(model);

  if (!outcome.ok) {
    const duplicates = mergeDuplicates(
      outcome.issues.flatMap((i) => (i.code === 'duplicate-node' && i.nodes ? [[i.nodes[0], i.nodes[1]] as [number, number]] : [])),
      model.nodes,
    );
    let merged = false;
    const issues: AnalysisIssue[] = outcome.issues.flatMap((i): AnalysisIssue[] => {
      // The merged ones stand where the first pair stood.
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
      if (i.code === 'too-big' && i.where && i.where.list !== 'model') {
        out.list = i.where.list;
        out.max = { nodes: 40, members: 120, supports: 40, loads: 80 }[i.where.list];
      }
      return [out];
    });
    const structural = outcome.issues.length > 0 && outcome.issues.every((i) => STRUCTURAL.has(i.code));
    const word: Determinacy['word'] = structural ? 'unstable' : null;
    return { units, issues, warnings: [], determinacy: { ...counts, word }, results: null, drawing: drawingOf(form, null) };
  }
  return { units, issues: [], warnings: outcome.warnings, determinacy: outcome.determinacy, results: resultsOf(form, outcome), drawing: drawingOf(form, outcome) };
}

function resultsOf(form: TrussForm, s: TrussSolution): TrussResults {
  const convert = FROM_ENGINE[form.units];
  const inspect = new Map(s.inspection.map((z) => [z.member, z]));
  let maxForce = 0;
  for (const m of s.members) maxForce = Math.max(maxForce, Math.abs(m.N));
  const elongations = s.members.map((m) => (m.elongation === null ? 0 : Math.abs(m.elongation * convert.displacement)));
  const elongationFloor = 1e-9 * Math.max(0, ...elongations);

  const members: MemberLine[] = s.members.map((m) => {
    const force = clean(m.N);
    const z = inspect.get(m.index);
    return {
      label: m.index + 1,
      i: m.i + 1,
      j: m.j + 1,
      length: m.length,
      cx: clean(m.cx),
      cy: clean(m.cy),
      force,
      state: stateOf(force),
      share: maxForce === 0 ? 0 : Math.abs(force) / maxForce,
      elongation: m.elongation === null ? null : clean(settle(m.elongation * convert.displacement, elongationFloor)),
      stress: m.stress === null ? null : clean(m.stress * convert.stress),
      // The section as it was typed: A = 1000 mm² crosses as 1e-3 m² and comes back as 1000, not 1000.0000000000001.
      A: m.A === null ? null : Number((m.A / TO_ENGINE[form.units].area).toPrecision(14)),
      E: m.E === null ? null : Number((m.E / TO_ENGINE[form.units].E).toPrecision(14)),
      inspection: z ? { rule: z.rule, node: z.node + 1 } : null,
    };
  });
  const reactions: ReactionLine[] = s.reactions.map((r) => ({
    label: r.support + 1,
    node: r.node + 1,
    kind: r.kind,
    angle: r.angle,
    rx: clean(r.rx),
    ry: clean(r.ry),
    magnitude: r.magnitude,
    along: r.along === null ? null : clean(r.along),
  }));
  const displacements: DisplacementLine[] | null = s.displacements
    ? s.displacements.map((d) => ({ node: d.node + 1, ux: clean(d.ux * convert.displacement), uy: clean(d.uy * convert.displacement), magnitude: d.magnitude * convert.displacement }))
    : null;

  const eq = s.equilibrium;
  const floor = 1e-9 * Math.max(eq.scale, maxForce);
  const xs = s.nodes.map((n) => n.x);
  const ys = s.nodes.map((n) => n.y);
  // A moment's floor is the force floor over an arm: the truss's size.
  const arm = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const sumFx = clean(settle(eq.sumFx, floor));
  const sumFy = clean(settle(eq.sumFy, floor));
  const sumM = clean(settle(eq.sumM, floor * arm));
  const joint = clean(settle(eq.joint, floor));
  // BALANCED is the engine's own test (RESIDUAL, of the larger of the loads, the forces and the reactions), not the
  // floor above: that one only decides what is PRINTED as 0. A solution the engine accepted is balanced by it, so the
  // page never shows a result beside the words 'do not use these results' (an indeterminate truss with one member
  // a hundred million times stiffer than the rest leaves a residual between the two thresholds).
  const reactionScale = Math.max(eq.scale, maxForce, ...s.reactions.map((r) => r.magnitude));
  const tolerance = RESIDUAL * reactionScale;
  const balanced = Math.abs(eq.sumFx) <= tolerance && Math.abs(eq.sumFy) <= tolerance && Math.abs(eq.sumM) <= tolerance * (arm === 0 ? 1 : arm) && eq.joint <= tolerance;
  let fx = 0;
  let fy = 0;
  const applied = (() => {
    for (const l of form.loads) {
      fx += l.fx;
      fy += l.fy;
    }
    return { fx: clean(settle(fx, 1e-9 * eq.scale)), fy: clean(settle(fy, 1e-9 * eq.scale)) };
  })();

  return {
    members,
    reactions,
    displacements,
    stiffness: s.stiffness,
    largest: {
      tension: s.largest.tension ? { member: s.largest.tension.member + 1, force: s.largest.tension.N } : null,
      compression: s.largest.compression ? { member: s.largest.compression.member + 1, force: s.largest.compression.N } : null,
    },
    maxForce,
    applied,
    equilibrium: { about: eq.about, sumFx, sumFy, sumM, joint, balanced },
    inspection: s.inspection.map((z) => ({ member: z.member + 1, node: z.node + 1, rule: z.rule })),
    zeroMembers: members.filter((m) => m.state === 'zero').map((m) => m.label),
  };
}

/**
 * `analyseTruss`, which nothing it is given can make throw. The form goes through
 * the engine (which does not throw) and through this file's arithmetic; if
 * anything in it did, the page would be a blank box — so it is caught here
 * and said as 'stopped', with the drawing the form still allows.
 */
export function analyseSafely(form: TrussForm): TrussAnalysis {
  try {
    return analyseTruss(form);
  } catch {
    let drawing: TrussDrawing;
    try {
      drawing = drawingOf(form, null);
    } catch {
      const zero = { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 };
      drawing = { nodes: [], members: [], loads: [], reactions: [], box: zero, frame: { x0: -1, y0: -1, x1: 1, y1: 1, width: 2, height: 2 }, pad: 1, deformScale: null };
    }
    return { units: TRUSS_UNITS[form.units] ?? TRUSS_UNITS.us, issues: [{ code: 'stopped' }], warnings: [], determinacy: { joints: 0, members: 0, reactions: 0, degree: 0, word: null }, results: null, drawing };
  }
}
