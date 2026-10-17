import type { TrussLoad, TrussMember, TrussNode, TrussSupport } from './types';
import { MAX_MEMBERS, MAX_NODES } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TRUSS MEMBER FORCES — the templates: a whole truss from a few numbers
 * ─────────────────────────────────────────────────────────────────────────────
 * Parametric generators for the shapes a visitor starts from. Each returns a
 * complete, editable truss — nodes, members, supports and loads — in the same
 * terms the engine takes (types.ts), indices from 0; the form (model.ts) turns
 * it into rows. Pure functions, no React, no words.
 *
 * ALL OF THEM, in the length unit of the caller (feet, metres: nothing here
 * knows) and with y UP:
 *
 *   — The BOTTOM CHORD is on y = 0, from x = 0 to x = span.
 *   — NUMBERING: the nodes of the bottom chord from left to right, then the
 *     rest of the top chord from left to right (a top-chord end that stands on
 *     a support is the support's node and is not numbered twice). Members:
 *     bottom chord left to right, then top chord left to right, then
 *     verticals, then diagonals (webs) left to right.
 *   — SUPPORTS: `pin-roller` (default): a pin at the left end of the bottom
 *     chord and a roller (vertical reaction) at the right end. `roller-pin`:
 *     the other way round. `two-pins`: a pin at each end (statically
 *     indeterminate one degree outside, and the forces then depend on the
 *     members' stiffness). The cantilever is held by `wall`.
 *   — LOADS: gravity, a NEGATIVE fy, on the nodes of the top chord. `load` is
 *     the load of a node in the middle of the top chord; a node at an END of
 *     the top chord takes HALF of it (the tributary half-panel). A top-chord
 *     end on a support puts its half straight into the reaction. A Warren truss
 *     without verticals has no node at the ends of its top chord: every top
 *     node is a full one.
 *
 * GEOMETRY of each (L = span, h = height, n = panels). Node k below is
 * (x, y); "B" is a bottom node and "T" a top node.
 *
 *   triangle         B0 (0,0), B1 (L,0), T (L/2, h). Members B0B1, B0T, TB1.
 *   king-post        B0 (0,0), B1 (L/2,0), B2 (L,0), T (L/2,h). Rafters B0T and
 *                    TB2, tie B0B1 and B1B2, and the post B1T. Under symmetric
 *                    load the post carries nothing (the three-member rule).
 *   queen-post       B0 (0,0), B1 (L/4,0), B2 (3L/4,0), B3 (L,0); T1 (L/4,h),
 *                    T2 (3L/4,h). Rafters B0T1 and T2B3, the straining beam
 *                    T1T2 across the top, posts B1T1 and B2T2 and ONE diagonal
 *                    B1T2 in the central panel (without it the central panel
 *                    is a mechanism). Loads on B0 (half), T1, T2, B3 (half).
 *   pratt            Parallel chords of n panels, n EVEN. B0..Bn at x = i·L/n
 *                    on y = 0 and T0..Tn above them at y = h. A vertical at
 *                    every x. One diagonal in each panel, sloping DOWN
 *                    TOWARDS THE CENTRE: in the left half T(i) to B(i+1), in
 *                    the right half B(i) to T(i+1). (Under gravity the
 *                    diagonals are in tension and the verticals in
 *                    compression.)
 *   howe             As the Pratt, the diagonals sloping UP towards the
 *                    centre: in the left half B(i) to T(i+1), in the right
 *                    half T(i) to B(i+1). (Diagonals in compression; the
 *                    verticals in tension, but for the two end ones, which
 *                    hold the half load of the end joint and are in
 *                    compression, and the centre one, which carries nothing.)
 *   warren-verticals Parallel chords of n panels (n ≥ 2) with a vertical at
 *                    every x, and the diagonals alternating: panel i is B(i) to
 *                    T(i+1) when i is even and T(i) to B(i+1) when it is odd.
 *   warren           Parallel chords with NO verticals: B0..Bn at x = i·L/n,
 *                    and n top nodes at the middle of each bottom panel, x =
 *                    (i + ½)·L/n, on y = h. Every top node joins the two
 *                    bottom nodes on either side of it. n ≥ 2.
 *   fink             The classic Fink (W) truss: B0 (0,0), B1 (L/3,0), B2
 *                    (2L/3,0), B3 (L,0); rafters rise to the apex A (L/2, h),
 *                    with T1 (L/4, h/2) and T3 (3L/4, h/2) on them. Webs T1B1,
 *                    B1A, AB2, B2T3 (the W). 7 nodes, 11 members.
 *   cantilever       A parallel-chord truss of n panels, n ≥ 1, fixed to a wall
 *                    on its LEFT: B0 and T0 are on the wall, the free end is on
 *                    x = L. As the Pratt in its nodes and verticals; one
 *                    diagonal per panel, from T(i) to B(i+1) (sloping down away
 *                    from the wall: tension under gravity). Held by a PIN at T0
 *                    and a roller at B0 whose reaction is HORIZONTAL (angle 0):
 *                    the top chord pulls on the wall, the bottom chord pushes.
 *
 * VALIDATION. Nothing here throws. A value that cannot be used is replaced and
 * SAID, in `clamped`: the span and the height must be numbers above zero (else
 * the default for the unit system), the height is kept within [L/100, 2L]
 * (shallower is not a truss, deeper is not a drawing), the panels are brought
 * to what the shape can build (its least and most, and even for the Pratt and
 * the Howe), a shape with a fixed pattern ignores them, the load must be a
 * finite number, and a support layout the shape does not have is replaced by
 * its own. The most panels are those that keep the truss to 40 nodes.
 */

export type TemplateId = 'triangle' | 'king-post' | 'queen-post' | 'pratt' | 'howe' | 'warren' | 'warren-verticals' | 'fink' | 'cantilever';

/** In the order a menu lists them. */
export const TEMPLATE_IDS: readonly TemplateId[] = ['triangle', 'king-post', 'queen-post', 'pratt', 'howe', 'warren', 'warren-verticals', 'fink', 'cantilever'];

export type SupportLayout = 'pin-roller' | 'roller-pin' | 'two-pins' | 'wall';

export interface TemplateParams {
  span: number;
  height: number;
  panels: number;
  /** The load of a node in the middle of the top chord, as a size (positive: it acts downward). */
  load: number;
  supports: SupportLayout;
}

export interface TemplateSpec {
  id: TemplateId;
  /** The panels it can have: least, most, and whether it must be even; `fixed` shapes have one pattern and ignore the field. */
  panels: { min: number; max: number; even: boolean; fixed: boolean };
  /** The layouts it offers; the first is its default. */
  layouts: SupportLayout[];
}

const REGULAR: SupportLayout[] = ['pin-roller', 'roller-pin', 'two-pins'];

export const TEMPLATE_SPECS: Record<TemplateId, TemplateSpec> = {
  triangle: { id: 'triangle', panels: { min: 2, max: 2, even: false, fixed: true }, layouts: REGULAR },
  'king-post': { id: 'king-post', panels: { min: 2, max: 2, even: false, fixed: true }, layouts: REGULAR },
  'queen-post': { id: 'queen-post', panels: { min: 3, max: 3, even: false, fixed: true }, layouts: REGULAR },
  pratt: { id: 'pratt', panels: { min: 2, max: 18, even: true, fixed: false }, layouts: REGULAR },
  howe: { id: 'howe', panels: { min: 2, max: 18, even: true, fixed: false }, layouts: REGULAR },
  warren: { id: 'warren', panels: { min: 2, max: 19, even: false, fixed: false }, layouts: REGULAR },
  'warren-verticals': { id: 'warren-verticals', panels: { min: 2, max: 19, even: false, fixed: false }, layouts: REGULAR },
  fink: { id: 'fink', panels: { min: 4, max: 4, even: false, fixed: true }, layouts: REGULAR },
  cantilever: { id: 'cantilever', panels: { min: 1, max: 19, even: false, fixed: false }, layouts: ['wall'] },
};

/** What a template starts from, per unit system (feet and kips; metres and kilonewtons). */
export const TEMPLATE_DEFAULTS: Record<'us' | 'si', Record<TemplateId, Omit<TemplateParams, 'supports'>>> = {
  us: {
    triangle: { span: 24, height: 8, panels: 2, load: 10 },
    'king-post': { span: 24, height: 8, panels: 2, load: 10 },
    'queen-post': { span: 24, height: 6, panels: 3, load: 10 },
    pratt: { span: 32, height: 8, panels: 4, load: 10 },
    howe: { span: 32, height: 8, panels: 4, load: 10 },
    warren: { span: 32, height: 8, panels: 4, load: 10 },
    'warren-verticals': { span: 32, height: 8, panels: 4, load: 10 },
    fink: { span: 24, height: 6, panels: 4, load: 10 },
    cantilever: { span: 16, height: 4, panels: 4, load: 10 },
  },
  si: {
    triangle: { span: 7, height: 2.5, panels: 2, load: 40 },
    'king-post': { span: 7, height: 2.5, panels: 2, load: 40 },
    'queen-post': { span: 7, height: 2, panels: 3, load: 40 },
    pratt: { span: 10, height: 2.5, panels: 4, load: 40 },
    howe: { span: 10, height: 2.5, panels: 4, load: 40 },
    warren: { span: 10, height: 2.5, panels: 4, load: 40 },
    'warren-verticals': { span: 10, height: 2.5, panels: 4, load: 40 },
    fink: { span: 7, height: 2, panels: 4, load: 40 },
    cantilever: { span: 5, height: 1.25, panels: 4, load: 40 },
  },
};

/** Something the template had to change in what it was asked for. */
export interface Clamp {
  field: 'span' | 'height' | 'panels' | 'load' | 'supports';
  asked: number | string;
  used: number | string;
}

export interface TemplateResult {
  nodes: TrussNode[];
  members: TrussMember[];
  supports: TrussSupport[];
  loads: TrussLoad[];
  /** What was used, after validation. */
  used: TemplateParams;
  clamped: Clamp[];
}

/** Whether a value is a number the template can use. */
const usable = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Brings what was asked for to what the shape can build, and says what changed.
 * `units` picks the defaults an unusable span, height, panel count or load
 * falls back on.
 */
export function validateTemplate(id: TemplateId, asked: Partial<TemplateParams>, units: 'us' | 'si' = 'us'): { used: TemplateParams; clamped: Clamp[] } {
  const spec = TEMPLATE_SPECS[id];
  const base = TEMPLATE_DEFAULTS[units][id];
  const clamped: Clamp[] = [];
  const say = (field: Clamp['field'], was: unknown, now: number | string) => {
    if (was !== now) clamped.push({ field, asked: usable(was) || typeof was === 'string' ? (was as number | string) : String(was), used: now });
  };

  const span = usable(asked.span) && asked.span > 0 ? asked.span : base.span;
  say('span', asked.span ?? span, span);

  let height = usable(asked.height) && asked.height > 0 ? asked.height : base.height;
  const lowest = span / 100;
  const highest = span * 2;
  if (height < lowest) height = lowest;
  if (height > highest) height = highest;
  say('height', asked.height ?? height, height);

  let panels = spec.panels.min;
  if (!spec.panels.fixed) {
    const want = usable(asked.panels) ? Math.round(asked.panels) : base.panels;
    panels = Math.min(spec.panels.max, Math.max(spec.panels.min, want));
    if (spec.panels.even && panels % 2 === 1) panels = panels + 1 > spec.panels.max ? panels - 1 : panels + 1;
    if (asked.panels !== undefined) say('panels', asked.panels, panels);
  }

  const load = usable(asked.load) ? asked.load : base.load;
  say('load', asked.load ?? load, load);

  let supports: SupportLayout = spec.layouts[0];
  if (asked.supports !== undefined && spec.layouts.includes(asked.supports)) supports = asked.supports;
  else if (asked.supports !== undefined) say('supports', asked.supports, supports);

  return { used: { span, height, panels, load, supports }, clamped };
}

/** The pieces a shape returns before supports and loads are put on it. */
interface Shape {
  nodes: TrussNode[];
  members: [number, number][];
  /** Left and right nodes of the support line. */
  left: number;
  right: number;
  /** The nodes of the top chord, left to right, and whether the first and last are ENDS (take half). */
  top: number[];
  ends: boolean;
}

const bottomRow = (n: number, span: number): TrussNode[] => Array.from({ length: n + 1 }, (_, i) => ({ x: (i * span) / n, y: 0 }));

/** A parallel-chord frame: B0..Bn then T0..Tn (index n + 1 + i), chords and verticals. */
function frame(n: number, span: number, height: number): { nodes: TrussNode[]; bottom: [number, number][]; top: [number, number][]; verticals: [number, number][] } {
  const nodes = [...bottomRow(n, span), ...bottomRow(n, span).map((p) => ({ x: p.x, y: height }))];
  const bottom: [number, number][] = [];
  const top: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    bottom.push([i, i + 1]);
    top.push([n + 1 + i, n + 2 + i]);
  }
  const verticals: [number, number][] = Array.from({ length: n + 1 }, (_, i) => [i, n + 1 + i]);
  return { nodes, bottom, top, verticals };
}

function shapeOf(id: TemplateId, { span: L, height: h, panels: n }: TemplateParams): Shape {
  switch (id) {
    case 'triangle':
      return {
        nodes: [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L / 2, y: h }],
        members: [[0, 1], [0, 2], [2, 1]],
        left: 0,
        right: 1,
        top: [0, 2, 1],
        ends: true,
      };
    case 'king-post':
      return {
        nodes: [{ x: 0, y: 0 }, { x: L / 2, y: 0 }, { x: L, y: 0 }, { x: L / 2, y: h }],
        members: [[0, 1], [1, 2], [0, 3], [3, 2], [1, 3]],
        left: 0,
        right: 2,
        top: [0, 3, 2],
        ends: true,
      };
    case 'queen-post':
      return {
        nodes: [{ x: 0, y: 0 }, { x: L / 4, y: 0 }, { x: (3 * L) / 4, y: 0 }, { x: L, y: 0 }, { x: L / 4, y: h }, { x: (3 * L) / 4, y: h }],
        members: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 3], [1, 4], [2, 5], [1, 5]],
        left: 0,
        right: 3,
        top: [0, 4, 5, 3],
        ends: true,
      };
    case 'pratt':
    case 'howe': {
      const f = frame(n, L, h);
      const diagonals: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const leftHalf = i < n / 2;
        const down = id === 'pratt' ? leftHalf : !leftHalf;
        // "down": the diagonal falls from its top end on the left to its bottom end on the right.
        diagonals.push(down ? [n + 1 + i, i + 1] : [i, n + 2 + i]);
      }
      return { nodes: f.nodes, members: [...f.bottom, ...f.top, ...f.verticals, ...diagonals], left: 0, right: n, top: Array.from({ length: n + 1 }, (_, i) => n + 1 + i), ends: true };
    }
    case 'warren-verticals': {
      const f = frame(n, L, h);
      const diagonals: [number, number][] = [];
      for (let i = 0; i < n; i++) diagonals.push(i % 2 === 0 ? [i, n + 2 + i] : [n + 1 + i, i + 1]);
      return { nodes: f.nodes, members: [...f.bottom, ...f.top, ...f.verticals, ...diagonals], left: 0, right: n, top: Array.from({ length: n + 1 }, (_, i) => n + 1 + i), ends: true };
    }
    case 'warren': {
      const nodes = [...bottomRow(n, L), ...Array.from({ length: n }, (_, i) => ({ x: ((i + 0.5) * L) / n, y: h }))];
      const members: [number, number][] = [];
      for (let i = 0; i < n; i++) members.push([i, i + 1]);
      for (let i = 0; i < n - 1; i++) members.push([n + 1 + i, n + 2 + i]);
      for (let i = 0; i < n; i++) members.push([i, n + 1 + i], [n + 1 + i, i + 1]);
      return { nodes, members, left: 0, right: n, top: Array.from({ length: n }, (_, i) => n + 1 + i), ends: false };
    }
    case 'fink':
      return {
        nodes: [{ x: 0, y: 0 }, { x: L / 3, y: 0 }, { x: (2 * L) / 3, y: 0 }, { x: L, y: 0 }, { x: L / 4, y: h / 2 }, { x: L / 2, y: h }, { x: (3 * L) / 4, y: h / 2 }],
        members: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [6, 3], [4, 1], [1, 5], [5, 2], [2, 6]],
        left: 0,
        right: 3,
        top: [0, 4, 5, 6, 3],
        ends: true,
      };
    case 'cantilever': {
      const f = frame(n, L, h);
      const diagonals: [number, number][] = Array.from({ length: n }, (_, i) => [n + 1 + i, i + 1]);
      return { nodes: f.nodes, members: [...f.bottom, ...f.top, ...f.verticals, ...diagonals], left: 0, right: n, top: Array.from({ length: n + 1 }, (_, i) => n + 1 + i), ends: true };
    }
  }
}

/**
 * A whole truss from a template. Never throws: what cannot be built as asked is
 * built as near as it can be, and `clamped` says what changed.
 */
export function buildTemplate(id: TemplateId, asked: Partial<TemplateParams> = {}, units: 'us' | 'si' = 'us'): TemplateResult {
  const { used, clamped } = validateTemplate(id, asked, units);
  const shape = shapeOf(id, used);
  // A model past the limits cannot come out of the panel limits above; this is the belt to those braces.
  const nodes = shape.nodes.slice(0, MAX_NODES);
  const members: TrussMember[] = shape.members.slice(0, MAX_MEMBERS).map(([i, j]) => ({ i, j }));

  let supports: TrussSupport[];
  if (id === 'cantilever') supports = [{ node: shape.top[0], kind: 'pin' }, { node: shape.left, kind: 'roller', angle: 0 }];
  else if (used.supports === 'two-pins') supports = [{ node: shape.left, kind: 'pin' }, { node: shape.right, kind: 'pin' }];
  else if (used.supports === 'roller-pin') supports = [{ node: shape.left, kind: 'roller', angle: 90 }, { node: shape.right, kind: 'pin' }];
  else supports = [{ node: shape.left, kind: 'pin' }, { node: shape.right, kind: 'roller', angle: 90 }];

  const loads: TrussLoad[] = shape.top.map((node, k) => {
    const end = shape.ends && (k === 0 || k === shape.top.length - 1);
    const fy = -(end ? used.load / 2 : used.load);
    return { node, fx: 0, fy: fy === 0 ? 0 : fy };
  });
  return { nodes, members, supports, loads, used, clamped };
}
