/** Beam FE solver — validation vs closed-form solutions. Run: node …selftest.ts */
import { analyzeBeam, type BeamInput } from './beamAnalysis.ts';

let pass = 0, fail = 0;
const chk = (name: string, got: number, want: number, tolPct: number, unit = '') => {
  const ok = Math.abs(got - want) / Math.abs(want || 1) <= tolPct / 100;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(40)} got ${got.toFixed(3)} ${unit}  want ~${want.toFixed(3)} ${unit}`);
  ok ? pass++ : fail++;
};
const chkEq = (name: string, got: unknown, want: unknown) => { const ok = got === want; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(40)} got ${String(got)}  want ${String(want)}`); ok ? pass++ : fail++; };
const L = 240, EI = 1e6;

// 1. SS beam, full UDL w=1
const ss: BeamInput = { L, EI, supports: [{ pos: 0, type: 'pin' }, { pos: L, type: 'roller' }], points: [], moments: [], dists: [{ x1: 0, x2: L, w1: 1, w2: 1 }] };
const r1 = analyzeBeam(ss);
chk('SS-UDL R_left = wL/2', r1.reactions[0].Rv, 120, 0.5, 'k');
chk('SS-UDL Mmax = wL²/8', r1.Mmax, 7200, 0.5, 'k·in');
chk('SS-UDL Mmax at L/2', r1.MmaxAt, 120, 2, 'in');
chk('SS-UDL δmax = 5wL⁴/384EI', r1.defMax, 5 * 1 * L ** 4 / (384 * EI), 0.5, 'in');
chk('SS-UDL ΣV check ≈ 0', r1.reactSumV, 0, 0.1);

// 2. SS beam, central point P=10
const ssp: BeamInput = { L, EI, supports: [{ pos: 0, type: 'pin' }, { pos: L, type: 'roller' }], points: [{ pos: L / 2, P: 10 }], moments: [], dists: [] };
const r2 = analyzeBeam(ssp);
chk('SS-P R = P/2', r2.reactions[0].Rv, 5, 0.5, 'k');
chk('SS-P Mmax = PL/4', r2.Mmax, 600, 0.5, 'k·in');
chk('SS-P δmax = PL³/48EI', r2.defMax, 10 * L ** 3 / (48 * EI), 0.5, 'in');

// 3. Cantilever, tip point P=10 (fixed at 0)
const cant: BeamInput = { L, EI, supports: [{ pos: 0, type: 'fixed' }], points: [{ pos: L, P: 10 }], moments: [], dists: [] };
const r3 = analyzeBeam(cant);
chk('Cant-P reaction R = P', r3.reactions[0].Rv, 10, 0.5, 'k');
chk('Cant-P M_fixed = -PL', r3.Mmin, -2400, 0.5, 'k·in');
chk('Cant-P δtip = PL³/3EI', r3.defMax, 10 * L ** 3 / (3 * EI), 0.5, 'in');

// 4. Fixed-fixed, UDL w=1
const ff: BeamInput = { L, EI, supports: [{ pos: 0, type: 'fixed' }, { pos: L, type: 'fixed' }], points: [], moments: [], dists: [{ x1: 0, x2: L, w1: 1, w2: 1 }] };
const r4 = analyzeBeam(ff);
chk('FF-UDL M_end = -wL²/12', r4.Mmin, -L * L / 12, 0.5, 'k·in');
chk('FF-UDL M_mid = +wL²/24', r4.Mmax, L * L / 24, 1, 'k·in');
chk('FF-UDL δmid = wL⁴/384EI', r4.defMax, L ** 4 / (384 * EI), 1, 'in');

// 5. Propped cantilever (fixed@0, roller@L), UDL w=1
const pc: BeamInput = { L, EI, supports: [{ pos: 0, type: 'fixed' }, { pos: L, type: 'roller' }], points: [], moments: [], dists: [{ x1: 0, x2: L, w1: 1, w2: 1 }] };
const r5 = analyzeBeam(pc);
chk('PropCant R_prop = 3wL/8', r5.reactions[1].Rv, 3 * L / 8, 1, 'k');
chk('PropCant M_fixed = -wL²/8', r5.Mmin, -L * L / 8, 1, 'k·in');
chk('PropCant Mmax_span = 9wL²/128', r5.Mmax, 9 * L * L / 128, 2, 'k·in');
chk('PropCant δmax ≈ wL⁴/185EI', r5.defMax, L ** 4 / (185 * EI), 3, 'in');

// 6. SS beam, triangular load 0→w=1
const tri: BeamInput = { L, EI, supports: [{ pos: 0, type: 'pin' }, { pos: L, type: 'roller' }], points: [], moments: [], dists: [{ x1: 0, x2: L, w1: 0, w2: 1 }] };
const r6 = analyzeBeam(tri);
chk('Tri R_A = wL/6', r6.reactions[0].Rv, L / 6, 1, 'k');
chk('Tri R_B = wL/3', r6.reactions[1].Rv, L / 3, 1, 'k');
chk('Tri Mmax = wL²/(9√3)', r6.Mmax, L * L / (9 * Math.sqrt(3)), 1, 'k·in');
chk('Tri Mmax at 0.5774L', r6.MmaxAt, L / Math.sqrt(3), 2, 'in');

// 7. SS beam, applied moment M0=1000 at center
const am: BeamInput = { L, EI, supports: [{ pos: 0, type: 'pin' }, { pos: L, type: 'roller' }], points: [], moments: [{ pos: L / 2, M: 1000 }], dists: [] };
const r7 = analyzeBeam(am);
chk('AppliedM |reaction| = M0/L', Math.abs(r7.reactions[0].Rv), 1000 / L, 1, 'k');
chk('AppliedM |Mmax| = M0/2', Math.max(Math.abs(r7.Mmax), Math.abs(r7.Mmin)), 500, 1, 'k·in');

// 8. Cantilever, full UDL w=1
const cu: BeamInput = { L, EI, supports: [{ pos: 0, type: 'fixed' }], points: [], moments: [], dists: [{ x1: 0, x2: L, w1: 1, w2: 1 }] };
const r8 = analyzeBeam(cu);
chk('Cant-UDL M_fixed = -wL²/2', r8.Mmin, -L * L / 2, 0.5, 'k·in');
chk('Cant-UDL δtip = wL⁴/8EI', r8.defMax, L ** 4 / (8 * EI), 0.5, 'in');

// 9. Two-span continuous (3 supports, spans L each), full UDL w=1
const S = 240;
const two: BeamInput = { L: 2 * S, EI, supports: [{ pos: 0, type: 'pin' }, { pos: S, type: 'roller' }, { pos: 2 * S, type: 'roller' }], points: [], moments: [], dists: [{ x1: 0, x2: 2 * S, w1: 1, w2: 1 }] };
const r9 = analyzeBeam(two);
chk('2-span R_end = 3wL/8', r9.reactions[0].Rv, 3 * S / 8, 1, 'k');
chk('2-span R_mid = 10wL/8', r9.reactions[1].Rv, 10 * S / 8, 1, 'k');
chk('2-span M_mid = -wL²/8', r9.Mmin, -S * S / 8, 1.5, 'k·in');

// 10. Overhang: supports at 0 and 240, total length 300, UDL w=1
const ov: BeamInput = { L: 300, EI, supports: [{ pos: 0, type: 'pin' }, { pos: 240, type: 'roller' }], points: [], moments: [], dists: [{ x1: 0, x2: 300, w1: 1, w2: 1 }] };
const r10 = analyzeBeam(ov);
chk('Overhang R_A', r10.reactions[0].Rv, 112.5, 1, 'k');
chk('Overhang R_B', r10.reactions[1].Rv, 187.5, 1, 'k');
chk('Overhang M at support B = -wO²/2', r10.Mmin, -1800, 1.5, 'k·in');

// 11. SS beam, applied CCW+ moment M0=1000 at a=L/3 (asymmetric — signed check)
const am2: BeamInput = { L, EI, supports: [{ pos: 0, type: 'pin' }, { pos: L, type: 'roller' }], points: [], moments: [{ pos: L / 3, M: 1000 }], dists: [] };
const r11 = analyzeBeam(am2);
chk('AppliedM(CCW) R_A = +M0/L (up)', r11.reactions[0].Rv, 1000 / L, 1, 'k');   // CCW couple lifts left support
chk('AppliedM(CCW) R_B = -M0/L', r11.reactions[1].Rv, -1000 / L, 1, 'k');
// BMD: M(a-)=+ (M0/L)a = +333.3 ; M(a+) = -2M0/3 = -666.7
const cclose = (arr: number[], xarr: number[], xt: number) => { let bi = 0; for (let i = 1; i < xarr.length; i++) if (Math.abs(xarr[i] - xt) < Math.abs(xarr[bi] - xt)) bi = i; return arr[bi]; };
chk('AppliedM(CCW) Mmax = +M0·a/L', r11.Mmax, 1000 * (L / 3) / L, 2, 'k·in');
chk('AppliedM(CCW) Mmin = -2M0/3', r11.Mmin, -2 * 1000 / 3, 2, 'k·in');

// 12. Combined moment + point load (reactions must be right, not swapped)
const comb: BeamInput = { L, EI, supports: [{ pos: 0, type: 'pin' }, { pos: L, type: 'roller' }], points: [{ pos: L / 2, P: 10 }], moments: [{ pos: L / 2, M: 1000 }], dists: [] };
const r12 = analyzeBeam(comb);
chk('Combined R_A = P/2 + M0/L', r12.reactions[0].Rv, 5 + 1000 / L, 1, 'k');
chk('Combined R_B = P/2 - M0/L', r12.reactions[1].Rv, 5 - 1000 / L, 1, 'k');

// 13. Stability guard — a single pin is a mechanism
const mech = analyzeBeam({ L, EI, supports: [{ pos: 0, type: 'pin' }], points: [{ pos: L / 2, P: 10 }], moments: [], dists: [] });
chkEq('Mechanism flagged unstable', mech.stable, false);
chkEq('Cantilever flagged stable', analyzeBeam(cant).stable, true);
chkEq('SS flagged stable', analyzeBeam(ss).stable, true);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
void cclose;
