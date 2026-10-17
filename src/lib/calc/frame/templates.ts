import type { FrameLoadDir } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANE FRAME ANALYSIS — the templates: a whole frame from a few numbers
 * ─────────────────────────────────────────────────────────────────────────────
 * Parametric generators for the frames a visitor starts from. Each returns a complete, editable frame —
 * nodes, members, supports, nodal loads and member loads — in the terms the form takes (model.ts turns it
 * into rows), INDICES FROM 0. Pure functions, no React, no words.
 *
 * ALL OF THEM in the length unit of the caller (feet, metres: nothing here knows), y UP, the left base at the origin.
 * Loads: `gravity` is a downward line load (kip/ft, kN/m) on the beams or rafters; `lateral` a horizontal force
 * (kip, kN) to the RIGHT at each floor level of the left column line (at the eave of a pitched frame, at the tip of
 * an L-frame, at the top of a cantilever column); `axial` a downward point load on top of a column.
 *
 *   portal              bays × storeys of rectangular frame. NUMBERING: the nodes FLOOR BY FLOOR from the ground,
 *                       left to right (node (floor k, line c) is number k·(bays+1)+c+1; the ground floor is k = 0), then
 *                       the MEMBERS: the columns floor by floor (the column on line c between floor k and k+1), then
 *                       the beams floor by floor (the beam of floor k between line c and c+1). Supports: every ground
 *                       node, fixed or pinned. Loads: gravity on every beam (global-y), lateral on the left node of
 *                       every floor above the ground. Default 1 bay × 1 storey: nodes 1 (0,0), 2 (W,0), 3 (0,H), 4
 *                       (W,H); members 1 left column, 2 right column, 3 beam. At most 6 × 6 (49 nodes, 78 members).
 *   gable               the pitched portal: nodes 1 (0,0), 2 (W,0), 3 (0,H) the left eave, 4 (W,H), 5 (W/2, H+rise) the
 *                       ridge; members 1 left column, 2 right column, 3 left rafter (eave to ridge), 4 right rafter (ridge
 *                       to eave). Gravity is a load per horizontal foot on the rafters ('udl-projected'). `hinge`: a moment
 *                       hinge at the ridge, on both rafters (with pinned feet it is the three-hinged frame, determinate).
 *   l-frame             nodes 1 (0,0), 2 (0,H) the corner, 3 (W,H) the free end of the beam; members 1 the column, 2 the
 *                       beam. Fixed base: a cantilever L. Pinned base: a pin at the foot and a vertical roller at node 3
 *                       (determinate). Gravity on the beam, lateral at the corner.
 *   cantilever-column   nodes 1 (0,0), 2 (0,H); one member. Fixed foot (always: a pinned foot would be a mechanism).
 *                       Loads: `lateral` and `axial` at the top.
 *   beam-on-columns     the portal numbering with the beam HINGED at both ends: a simple beam resting on two cantilever
 *                       columns (fixed feet, always). Gravity on the beam, lateral at the left column top.
 *   two-hinged          the single-bay portal with PINNED feet and rigid corners: one degree indeterminate.
 *
 * VALIDATION. Nothing here throws. A value that cannot be used is replaced and SAID, in `clamped`:
 * counts are whole numbers in [1, 6]; widths, heights and rises are numbers above zero (else the default of the
 * unit system), the height is held to [W/200, 200·W] (except the cantilever column's, which has no width), the rise to [W/50, W]; loads are any finite numbers (else 0); a template that cannot be built
 * with the base asked for (a cantilever column or a beam on columns with pinned feet) is built with the base it can
 * have.
 */

export type TemplateId = 'portal' | 'gable' | 'l-frame' | 'cantilever-column' | 'beam-on-columns' | 'two-hinged';
export const TEMPLATE_IDS: TemplateId[] = ['portal', 'gable', 'l-frame', 'cantilever-column', 'beam-on-columns', 'two-hinged'];

export type BaseKind = 'fixed' | 'pinned';

export interface TemplateParams {
  bays: number;
  storeys: number;
  /** Bay width (portal), span (the others); the length unit. */
  width: number;
  /** Storey height (portal), column height or eave height (the others). */
  height: number;
  /** Ridge rise above the eaves (gable). */
  rise: number;
  base: BaseKind;
  /** A moment hinge at the ridge (gable). */
  hinge: boolean;
  /** Downward line load on beams and rafters. */
  gravity: number;
  /** Horizontal force to the right at each floor level of the left line / eave / tip. */
  lateral: number;
  /** Downward point load on top of a column. */
  axial: number;
}

export type ClampWhy = 'min' | 'max' | 'integer' | 'positive' | 'number' | 'base';
export interface Clamp {
  param: keyof TemplateParams;
  requested: number | string | boolean;
  used: number | string | boolean;
  why: ClampWhy;
}

export interface TemplateNode {
  x: number;
  y: number;
}
export interface TemplateMember {
  i: number;
  j: number;
  hingeStart?: boolean;
  hingeEnd?: boolean;
}
export interface TemplateSupport {
  node: number;
  kind: 'fixed' | 'pin' | 'roller';
  angle?: number;
}
export interface TemplateLoad {
  node: number;
  fx: number;
  fy: number;
  m: number;
}
export interface TemplateMemberLoad {
  member: number;
  kind: 'udl' | 'udl-projected';
  dir: FrameLoadDir;
  w: number;
}
export interface BuiltTemplate {
  nodes: TemplateNode[];
  members: TemplateMember[];
  supports: TemplateSupport[];
  loads: TemplateLoad[];
  memberLoads: TemplateMemberLoad[];
  clamped: Clamp[];
}

type Units = 'us' | 'si';

/** Defaults per unit system: the portal's are the page's example. */
export const TEMPLATE_DEFAULTS: Record<Units, Record<TemplateId, TemplateParams>> = {
  us: {
    portal: { bays: 1, storeys: 1, width: 20, height: 10, rise: 5, base: 'fixed', hinge: false, gravity: 1.2, lateral: 10, axial: 0 },
    gable: { bays: 1, storeys: 1, width: 40, height: 15, rise: 8, base: 'pinned', hinge: false, gravity: 0.8, lateral: 6, axial: 0 },
    'l-frame': { bays: 1, storeys: 1, width: 12, height: 10, rise: 5, base: 'fixed', hinge: false, gravity: 1, lateral: 0, axial: 0 },
    'cantilever-column': { bays: 1, storeys: 1, width: 20, height: 12, rise: 5, base: 'fixed', hinge: false, gravity: 0, lateral: 5, axial: 20 },
    'beam-on-columns': { bays: 1, storeys: 1, width: 24, height: 12, rise: 5, base: 'fixed', hinge: false, gravity: 1.5, lateral: 4, axial: 0 },
    'two-hinged': { bays: 1, storeys: 1, width: 24, height: 12, rise: 5, base: 'pinned', hinge: false, gravity: 1.5, lateral: 6, axial: 0 },
  },
  si: {
    portal: { bays: 1, storeys: 1, width: 6, height: 3.5, rise: 1.5, base: 'fixed', hinge: false, gravity: 15, lateral: 40, axial: 0 },
    gable: { bays: 1, storeys: 1, width: 12, height: 4.5, rise: 2.5, base: 'pinned', hinge: false, gravity: 10, lateral: 25, axial: 0 },
    'l-frame': { bays: 1, storeys: 1, width: 4, height: 3, rise: 1.5, base: 'fixed', hinge: false, gravity: 12, lateral: 0, axial: 0 },
    'cantilever-column': { bays: 1, storeys: 1, width: 6, height: 3.6, rise: 1.5, base: 'fixed', hinge: false, gravity: 0, lateral: 20, axial: 100 },
    'beam-on-columns': { bays: 1, storeys: 1, width: 7, height: 3.6, rise: 1.5, base: 'fixed', hinge: false, gravity: 20, lateral: 15, axial: 0 },
    'two-hinged': { bays: 1, storeys: 1, width: 7, height: 3.6, rise: 1.5, base: 'pinned', hinge: false, gravity: 20, lateral: 25, axial: 0 },
  },
};

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The parameters made usable, and what was changed. */
export function clampParams(id: TemplateId, input: Partial<TemplateParams>, units: Units): { params: TemplateParams; clamped: Clamp[] } {
  const d = TEMPLATE_DEFAULTS[units][id];
  const clamped: Clamp[] = [];
  const params: TemplateParams = { ...d };
  const whole = (key: 'bays' | 'storeys', min: number, max: number) => {
    const v = input[key];
    if (v === undefined) return;
    if (!finite(v)) {
      clamped.push({ param: key, requested: String(v), used: d[key], why: 'number' });
      return;
    }
    let used = Math.round(v);
    let why: ClampWhy = 'integer';
    if (used < min) {
      used = min;
      why = 'min';
    } else if (used > max) {
      used = max;
      why = 'max';
    }
    if (used !== v) clamped.push({ param: key, requested: v, used, why });
    params[key] = used;
  };
  const positive = (key: 'width' | 'height') => {
    const v = input[key];
    if (v === undefined) return;
    if (!finite(v) || v <= 0) {
      clamped.push({ param: key, requested: finite(v) ? v : String(v), used: d[key], why: finite(v) ? 'positive' : 'number' });
      return;
    }
    params[key] = v;
  };
  const any = (key: 'gravity' | 'lateral' | 'axial') => {
    const v = input[key];
    if (v === undefined) return;
    if (!finite(v)) {
      clamped.push({ param: key, requested: String(v), used: 0, why: 'number' });
      params[key] = 0;
      return;
    }
    params[key] = v;
  };
  if (id === 'portal') {
    whole('bays', 1, 6);
    whole('storeys', 1, 6);
  }
  positive('width');
  positive('height');
  // A frame 200 times higher than wide, or wider than high, is not a frame of this calculator: it would have members shorter than a hundred-thousandth of it.
  if (id !== 'cantilever-column') {
    const lo = params.width / 200;
    const hi = params.width * 200;
    const wanted = params.height;
    if (wanted < lo || wanted > hi) {
      params.height = wanted < lo ? lo : hi;
      clamped.push({ param: 'height', requested: wanted, used: params.height, why: wanted < lo ? 'min' : 'max' });
    }
  }
  any('gravity');
  any('lateral');
  any('axial');
  if (id === 'gable') {
    const r = input.rise;
    let rise = d.rise;
    if (r !== undefined) {
      if (!finite(r) || r <= 0) clamped.push({ param: 'rise', requested: finite(r) ? r : String(r), used: d.rise, why: finite(r) ? 'positive' : 'number' });
      else rise = r;
    }
    const lo = params.width / 50;
    const used = Math.min(Math.max(rise, lo), params.width);
    if (used !== rise && r !== undefined && finite(r) && r > 0) clamped.push({ param: 'rise', requested: r, used, why: rise < lo ? 'min' : 'max' });
    params.rise = used;
    if (input.hinge !== undefined) params.hinge = Boolean(input.hinge);
  }
  if (input.base !== undefined) params.base = input.base === 'fixed' ? 'fixed' : 'pinned';
  // A frame that would be a mechanism with the base asked for is built with the one it can have.
  const forced: Partial<Record<TemplateId, BaseKind>> = { 'cantilever-column': 'fixed', 'beam-on-columns': 'fixed', 'two-hinged': 'pinned' };
  const must = forced[id];
  if (must && params.base !== must) {
    if (input.base !== undefined && input.base !== must) clamped.push({ param: 'base', requested: input.base, used: must, why: 'base' });
    params.base = must;
  }
  return { params, clamped };
}

const round = (v: number): number => Number(v.toPrecision(12));

export function buildTemplate(id: TemplateId, input: Partial<TemplateParams>, units: Units): BuiltTemplate {
  const { params: p, clamped } = clampParams(id, input, units);
  const out: BuiltTemplate = { nodes: [], members: [], supports: [], loads: [], memberLoads: [], clamped };
  const foot = p.base === 'fixed' ? 'fixed' : 'pin';
  const load = (node: number, fx: number, fy: number) => {
    if (fx !== 0 || fy !== 0) out.loads.push({ node, fx, fy, m: 0 });
  };
  switch (id) {
    case 'portal':
    case 'two-hinged':
    case 'beam-on-columns': {
      const n = id === 'portal' ? p.bays : 1;
      const m = id === 'portal' ? p.storeys : 1;
      const at = (k: number, c: number) => k * (n + 1) + c;
      for (let k = 0; k <= m; k++) for (let c = 0; c <= n; c++) out.nodes.push({ x: round(c * p.width), y: round(k * p.height) });
      for (let k = 0; k < m; k++) for (let c = 0; c <= n; c++) out.members.push({ i: at(k, c), j: at(k + 1, c) });
      const firstBeam = out.members.length;
      for (let k = 1; k <= m; k++) for (let c = 0; c < n; c++) out.members.push({ i: at(k, c), j: at(k, c + 1), ...(id === 'beam-on-columns' ? { hingeStart: true, hingeEnd: true } : {}) });
      for (let c = 0; c <= n; c++) out.supports.push({ node: at(0, c), kind: foot });
      for (let b = firstBeam; b < out.members.length; b++) if (p.gravity !== 0) out.memberLoads.push({ member: b, kind: 'udl', dir: 'global-y', w: -p.gravity });
      for (let k = 1; k <= m; k++) load(at(k, 0), p.lateral, 0);
      break;
    }
    case 'gable': {
      out.nodes.push({ x: 0, y: 0 }, { x: round(p.width), y: 0 }, { x: 0, y: round(p.height) }, { x: round(p.width), y: round(p.height) }, { x: round(p.width / 2), y: round(p.height + p.rise) });
      out.members.push({ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 4, ...(p.hinge ? { hingeEnd: true } : {}) }, { i: 4, j: 3, ...(p.hinge ? { hingeStart: true } : {}) });
      out.supports.push({ node: 0, kind: foot }, { node: 1, kind: foot });
      if (p.gravity !== 0) {
        out.memberLoads.push({ member: 2, kind: 'udl-projected', dir: 'global-y', w: -p.gravity });
        out.memberLoads.push({ member: 3, kind: 'udl-projected', dir: 'global-y', w: -p.gravity });
      }
      load(2, p.lateral, 0);
      break;
    }
    case 'l-frame': {
      out.nodes.push({ x: 0, y: 0 }, { x: 0, y: round(p.height) }, { x: round(p.width), y: round(p.height) });
      out.members.push({ i: 0, j: 1 }, { i: 1, j: 2 });
      out.supports.push({ node: 0, kind: foot });
      if (p.base === 'pinned') out.supports.push({ node: 2, kind: 'roller', angle: 90 });
      if (p.gravity !== 0) out.memberLoads.push({ member: 1, kind: 'udl', dir: 'global-y', w: -p.gravity });
      load(1, p.lateral, 0);
      break;
    }
    case 'cantilever-column': {
      out.nodes.push({ x: 0, y: 0 }, { x: 0, y: round(p.height) });
      out.members.push({ i: 0, j: 1 });
      out.supports.push({ node: 0, kind: 'fixed' });
      load(1, p.lateral, -p.axial);
      break;
    }
  }
  return out;
}
