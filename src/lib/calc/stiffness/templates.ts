import type { Mode } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STIFFNESS MATRIX, STEP BY STEP — the templates: textbook problems with known answers
 * ─────────────────────────────────────────────────────────────────────────────
 * Seven structures a student meets first, each a COMPLETE problem (nodes, members, supports, loads, member loads and the
 * section), in each unit system, with clean numbers. Loading one replaces the structure, the mode and the section (the
 * units stay): model.ts, `'template'`. INDICES FROM 0 here (model.ts turns them into rows). No words: the page names them.
 *
 * THE HAND ANSWERS (US set; the SI set is the same problem with its own clean numbers, and every answer below is
 * dimensionless in L, w, P, so it holds in both). Signs as types.ts: reactions on the structure, +x right, +y up,
 * counter-clockwise moments; N positive in tension. stiffness.test.ts checks every one against the solver.
 *
 *  truss-two-bar      Two bars 10 ft long meeting at the apex (8, 6) of a 16 ft base, pinned at both feet, E = 29,000 ksi, A = 10 in².
 *                     Loads at the apex: 20 kip to the right, 30 kip down. Joint equilibrium (bar 1 from the left foot, bar 2 from
 *                     the right, c = 0.8, s = 0.6):  −0.8·N1 + 0.8·N2 + 20 = 0,  −0.6·N1 − 0.6·N2 − 30 = 0
 *                     →  N1 = −12.5 kip, N2 = −37.5 kip (both compression). Reactions: left foot (10, 7.5), right foot (−30, 22.5).
 *                     Apex displacement: the bars shorten 12.5·10/290,000 = 4.3103e-4 ft and 37.5·10/290,000 = 1.2931e-3 ft,
 *                     so  uy = −(4.3103e-4 + 1.2931e-3)/1.2 = −1.4368e-3 ft = −0.01724 in  and  ux = (1.2931e-3 − 4.3103e-4)/1.6 = 5.388e-4 ft = 0.00647 in.
 *  truss-three-bar    STATICALLY INDETERMINATE. Three bars hang from a ceiling at y = 6 ft, at x = −8, 0, 8, to the free node (0, 0); equal EA;
 *                     a 40 kip load down at the free node. The inclined bars are 10 ft long (sin = 0.6), the vertical one 6 ft. Equilibrium:
 *                     N_v + 2·0.6·N_i = 40; compatibility: the inclined bars stretch 0.6 of the vertical one, N_i = N_v·0.6·(6/10) = 0.36·N_v.
 *                     →  N_v = 40/1.432 = 5000/179 = 27.933 kip,  N_i = 1800/179 = 10.056 kip (all tension); the free node drops
 *                     N_v·6/EA = 27.933·6/290,000 = 5.779e-4 ft; the reaction at the middle pin is 27.933 up, at the outer pins (−8.045, 6.034) on the left and (8.045, 6.034) on the right.
 *  truss-five-member  Five bars on 4 nodes (0,0), (16,0), (8,6), (24,6), pinned at node 1, a vertical roller at node 2; 12 kip to the right at
 *                     node 3 and 15 kip down at node 4: determinate (5 + 3 = 2·4). Reactions: node 1 (−12, −12), node 2 (0, 27). Joints:
 *                     N(1-2) = −4, N(1-3) = +20, N(2-3) = −20, N(3-4) = +20, N(2-4) = −25 kip.
 *  frame-propped      Propped cantilever, L = 20 ft, fixed at the left, a vertical roller at the right, w = 1.2 kip/ft down (member load −1.2):
 *                     R_right = 3wL/8 = 9 kip,  R_left = 5wL/8 = 15 kip,  M_left = wL²/8 = 60 kip·ft (counter-clockwise on the beam),
 *                     rotation of the roller end +wL³/(48EI) = +1.655e-3 rad, counter-clockwise: the beam rises towards the roller (EI = 29,000·600/144 = 120,833 kip·ft²), no axial force.
 *  frame-l            L-frame: a 12 ft column, fixed at the foot, and a 10 ft beam from its top, w = 1 kip/ft down on the beam. Statics alone give
 *                     the reactions (0, 10, 50): Rx = 0, Ry = wL = 10 kip up, M = wL²/2 = 50 kip·ft counter-clockwise. The column carries
 *                     N = −10 (compression), V = 0 and a constant M = −50 (tension on its outer face); the beam V(start) = +10, M(start) = −50, V(end) = M(end) = 0.
 *  frame-portal       Portal frame: 20 ft wide, 10 ft high, fixed feet, W14×48 (A = 14.1 in², I = 484 in⁴), 10 kip to the right at the top of the left
 *                     column. With the members taken as inextensible (slope-deflection, equal I, r = (I/L)/(I/h) = 0.5): each column carries 5 kip of
 *                     shear (Rx = −5 at each foot), M_foot = H·h·(1 + 3r)/(2·(1 + 6r)) = 31.25 kip·ft and M_top = H·h·3r/(2·(1 + 6r)) = 18.75 kip·ft;
 *                     vertical reactions −1.875 (left) and +1.875 (right) kip. The solver includes the axial deformation, so it gives these to about 2 %.
 *  frame-fixed-point  Fixed-fixed beam, L = 20 ft, one point load of 20 kip down at a = 8 ft (b = 12 ft), a member load, so all six DOFs are
 *                     restrained and the "solution" is the fixed-end forces: M_left = Pab²/L² = 57.6 kip·ft (counter-clockwise), M_right = Pa²b/L² =
 *                     38.4 kip·ft (clockwise: −38.4), R_left = Pb²(3a + b)/L³ = 12.96 kip, R_right = Pa²(a + 3b)/L³ = 7.04 kip.
 */

export type TemplateId = 'truss-two-bar' | 'truss-three-bar' | 'truss-five-member' | 'frame-propped' | 'frame-l' | 'frame-portal' | 'frame-fixed-point';
export const TEMPLATE_IDS: TemplateId[] = ['truss-two-bar', 'truss-three-bar', 'truss-five-member', 'frame-propped', 'frame-l', 'frame-portal', 'frame-fixed-point'];

export type TemplateMemberLoad = { kind: 'udl'; member: number; w: number } | { kind: 'point'; member: number; a: number; P: number } | { kind: 'axial'; member: number; q: number };

export interface BuiltTemplate {
  mode: Mode;
  nodes: { x: number; y: number }[];
  members: { i: number; j: number }[];
  supports: { node: number; ux: boolean; uy: boolean; rz: boolean }[];
  loads: { node: number; fx: number; fy: number; m: number }[];
  memberLoads: TemplateMemberLoad[];
  /** The section in the units the form shows: E in ksi or GPa, A in in² or mm², I in in⁴ or 10⁶ mm⁴. */
  E: number;
  A: number;
  I: number;
}

type Units = 'us' | 'si';

const pin = (node: number) => ({ node, ux: true, uy: true, rz: false });
const roller = (node: number) => ({ node, ux: false, uy: true, rz: false });
const fixed = (node: number) => ({ node, ux: true, uy: true, rz: true });

/** The section every truss template uses; I is carried for the day the visitor switches to frame mode. */
const SECTION: Record<Units, { E: number; A: number; I: number }> = {
  us: { E: 29000, A: 10, I: 100 },
  si: { E: 200, A: 6000, I: 40 },
};

export function buildTemplate(id: TemplateId, units: Units): BuiltTemplate {
  const us = units === 'us';
  // Lengths: a US problem in feet, an SI problem a quarter of that in metres (a foot is not a clean 0.3 m), loads four times a kip.
  const q = us ? 1 : 0.25;
  const F = us ? 1 : 4;
  const sec = SECTION[units];
  switch (id) {
    case 'truss-two-bar':
      return {
        mode: 'truss',
        nodes: [
          { x: 0, y: 0 },
          { x: 16 * q, y: 0 },
          { x: 8 * q, y: 6 * q },
        ],
        members: [
          { i: 0, j: 2 },
          { i: 1, j: 2 },
        ],
        supports: [pin(0), pin(1)],
        loads: [{ node: 2, fx: 20 * F, fy: -30 * F, m: 0 }],
        memberLoads: [],
        ...sec,
      };
    case 'truss-three-bar':
      return {
        mode: 'truss',
        nodes: [
          { x: -8 * q, y: 6 * q },
          { x: 0, y: 6 * q },
          { x: 8 * q, y: 6 * q },
          { x: 0, y: 0 },
        ],
        members: [
          { i: 0, j: 3 },
          { i: 1, j: 3 },
          { i: 2, j: 3 },
        ],
        supports: [pin(0), pin(1), pin(2)],
        loads: [{ node: 3, fx: 0, fy: -40 * F, m: 0 }],
        memberLoads: [],
        ...sec,
      };
    case 'truss-five-member':
      return {
        mode: 'truss',
        nodes: [
          { x: 0, y: 0 },
          { x: 16 * q, y: 0 },
          { x: 8 * q, y: 6 * q },
          { x: 24 * q, y: 6 * q },
        ],
        members: [
          { i: 0, j: 1 },
          { i: 0, j: 2 },
          { i: 1, j: 2 },
          { i: 2, j: 3 },
          { i: 1, j: 3 },
        ],
        supports: [pin(0), roller(1)],
        loads: [
          { node: 2, fx: 12 * F, fy: 0, m: 0 },
          { node: 3, fx: 0, fy: -15 * F, m: 0 },
        ],
        memberLoads: [],
        ...sec,
      };
    case 'frame-propped':
      return {
        mode: 'frame',
        nodes: [
          { x: 0, y: 0 },
          { x: us ? 20 : 6, y: 0 },
        ],
        members: [{ i: 0, j: 1 }],
        supports: [fixed(0), roller(1)],
        loads: [],
        memberLoads: [{ kind: 'udl', member: 0, w: us ? -1.2 : -20 }],
        E: sec.E,
        A: sec.A,
        I: us ? 600 : 250,
      };
    case 'frame-l':
      return {
        mode: 'frame',
        nodes: [
          { x: 0, y: 0 },
          { x: 0, y: us ? 12 : 3.6 },
          { x: us ? 10 : 3, y: us ? 12 : 3.6 },
        ],
        members: [
          { i: 0, j: 1 },
          { i: 1, j: 2 },
        ],
        supports: [fixed(0)],
        loads: [],
        memberLoads: [{ kind: 'udl', member: 1, w: us ? -1 : -12 }],
        E: sec.E,
        A: sec.A,
        I: us ? 400 : 160,
      };
    case 'frame-portal':
      return {
        mode: 'frame',
        nodes: [
          { x: 0, y: 0 },
          { x: us ? 20 : 6, y: 0 },
          { x: 0, y: us ? 10 : 3 },
          { x: us ? 20 : 6, y: us ? 10 : 3 },
        ],
        members: [
          { i: 0, j: 2 },
          { i: 1, j: 3 },
          { i: 2, j: 3 },
        ],
        supports: [fixed(0), fixed(1)],
        loads: [{ node: 2, fx: us ? 10 : 40, fy: 0, m: 0 }],
        memberLoads: [],
        E: sec.E,
        A: us ? 14.1 : 9000,
        I: us ? 484 : 200,
      };
    case 'frame-fixed-point':
      return {
        mode: 'frame',
        nodes: [
          { x: 0, y: 0 },
          { x: us ? 20 : 6, y: 0 },
        ],
        members: [{ i: 0, j: 1 }],
        supports: [fixed(0), fixed(1)],
        loads: [],
        memberLoads: [{ kind: 'point', member: 0, a: us ? 8 : 2.4, P: us ? -20 : -80 }],
        E: sec.E,
        A: sec.A,
        I: us ? 600 : 250,
      };
  }
}
