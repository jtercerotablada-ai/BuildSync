/**
 * AISC 360-16 angle solver — validation self-tests.
 * Run: node src/lib/steel/aiscAngle.selftest.ts
 * Targets from AISC Design Examples v15 (D.2, E.5, F.11A/B/C, F9) + hand-verified
 * E3 branches.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  tension, compressionSingle, compressionDouble, flexureSingle, flexureDouble,
  fcrE3, betaW, type AngleSingle, type AngleDouble, type Material,
} from './aiscAngle.ts';

const path = fileURLToPath(new URL('./angle-shapes.json', import.meta.url));
const db = JSON.parse(readFileSync(path, 'utf8')) as { single: AngleSingle[]; double: AngleDouble[] };
const L = (n: string) => { const s = db.single.find((x) => x.designation === n); if (!s) throw new Error(n); return s; };
const D = (n: string) => { const s = db.double.find((x) => x.designation === n); if (!s) throw new Error(n); return s; };

let pass = 0, fail = 0;
const chk = (name: string, got: number, want: number, tolPct: number, unit = '') => {
  const ok = Math.abs(got - want) / Math.abs(want) <= tolPct / 100;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(48)} got ${got.toFixed(2)} ${unit}  want ~${want} ${unit}`);
  ok ? pass++ : fail++;
};
const chkEq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(48)} got ${String(got)}  want ${String(want)}`); ok ? pass++ : fail++;
};
const A36: Material = { Fy: 36, Fu: 58 }, A50: Material = { Fy: 50, Fu: 65 };
const kft = (kipin: number) => kipin / 12;

// ── 1. TENSION — Example D.2 (L4×4×1/2, A36, 4× ¾" bolts one line, 3" pitch) ─
const tn = tension(L('L4X4X1/2'), A36, { conn: 'bolted', boltDia: 0.75, nPerLine: 4, connLength: 9, connectedLegLong: true });
chk('D.2 tension φPy (yielding)', tn.phiPy, 121.5, 1, 'k');
chk('D.2 tension φPr (rupture)', tn.phiPr, 125, 1.5, 'k');
chk('D.2 tension U (Case 2)', tn.U, 0.869, 2);
chk('D.2 tension An', tn.An, 3.31, 2, 'in²');
chkEq('D.2 governing', tn.governs, 'Yielding');

// ── 2. COMPRESSION E3 branches (hand-verified) ───────────────────────────
const e3a = fcrE3(120, 50); chk('E3 elastic Fcr @(Lc/r)=120,Fy50', e3a.Fcr, 17.43, 1, 'ksi');
const e3b = fcrE3(80, 36); chk('E3 inelastic Fcr @(Lc/r)=80,Fy36', e3b.Fcr, 25.70, 1, 'ksi');
chk('E3 elastic φPn (Ag=2.86)', 0.9 * e3a.Fcr * 2.86, 44.9, 1.5, 'k');
chk('E3 inelastic φPn (Ag=2.86)', 0.9 * e3b.Fcr * 2.86, 66.2, 1.5, 'k');

// ── 3. COMPRESSION single via E5 (L4×4×3/8, A36, L=96, planar) ────────────
const cs = compressionSingle(L('L4X4X3/8'), A36, { L: 96, truss: 'planar', connectedLegLong: true });
chk('E5 (Lc/r)eff', cs.KLreff, 130.5, 1);
chk('E5 Fcr', cs.Fcr, 14.68, 1.5, 'ksi');
chk('E5 φPn', cs.phiPn, 37.8, 2, 'k');
chkEq('E5 valid scope', cs.valid, true);

// ── 4. FLEXURE single — Example F.11A/B/C (L4×4×1/4, A36) ─────────────────
const a = L('L4X4X1/4');
const f11a = flexureSingle(a, A36, { axis: 'geometric', Lb: 72, Cb: 1.14, restrained: false, shortLegCompression: false });
chk('F.11A geometric Mcr', f11a.Mcr!, 107, 2, 'k·in');
chk('F.11A geometric φMn (LTB)', kft(f11a.phiMn), 2.90, 3, 'k·ft');
chkEq('F.11A governs = LTB', f11a.governs, 'LTB');

const f11b = flexureSingle(a, A36, { axis: 'geometric', Lb: 36, Cb: 1.30, restrained: true, shortLegCompression: false });
chk('F.11B geometric φMn (LLB)', kft(f11b.phiMn), 3.25, 3, 'k·ft');
chkEq('F.11B governs = Leg LB', f11b.governs, 'Leg local buckling');

const f11cw = flexureSingle(a, A36, { axis: 'principal-w', Lb: 72, Cb: 1.14, restrained: false, shortLegCompression: false });
chk('F.11C major-w Mcr (β_w=0)', f11cw.Mcr!, 195, 2, 'k·in');
chk('F.11C major-w φMnw (LTB)', kft(f11cw.phiMn), 5.96, 3, 'k·ft');

const f11cz = flexureSingle(a, A36, { axis: 'principal-z', Lb: 72, Cb: 1.14, restrained: false, shortLegCompression: false });
chk('F.11C minor-z φMnz (yielding)', kft(f11cz.phiMn), 3.15, 3, 'k·ft');
chkEq('F.11C minor-z governs = Yielding', f11cz.governs, 'Yielding');

// ── 5. β_w — F10-4 major-axis for an unequal-leg angle (L8×6×1, β_w=3.31) ──
chk('β_w L8×6 (short-leg comp)', betaW(L('L8X6X1'), true), 3.31, 1);
const f84 = flexureSingle(L('L8X6X1'), A36, { axis: 'principal-w', Lb: 120, Cb: 1.0, restrained: false, shortLegCompression: true });
chk('L8×6×1 major-w Mcr (β_w form)', f84.Mcr!, 5280, 4, 'k·in');

// ── 6. FLEXURE double — F9 (2L4×4×1/2 0-gap, A36, Lb ≤ Lp, web legs in tension) ──
const fd = flexureDouble(D('2L4X4X1/2'), A36, { Lb: 40, Cb: 1.0, webLegsInCompression: false });
chk('F9 2L4×4×1/2 Mp (1.6My cap)', fd.Mp, 225.8, 1, 'k·in');
chk('F9 2L4×4×1/2 φMn', fd.phiMn, 203.2, 1.5, 'k·in');
chk('F9 2L4×4×1/2 Lp', fd.Lp, 84.4, 2, 'in');

// ── 7. COMPRESSION double machinery (2L5×3×1/4 LLBB) self-consistency ─────
const dd = compressionDouble(D('2L5X3X1/4X3/8LLBB'), A50, { Lcx: 96, Lcy: 96, connSpacing: 0, connWelded: true });
chkEq('2L x-axis Fcr matches fcrE3', Math.abs(dd.xAxis.Fcr - fcrE3(96 / D('2L5X3X1/4X3/8LLBB').rx, 50).Fcr) < 1e-6, true);
chkEq('2L governing = y-FTB', dd.governing, 'y-flexural-torsional');
chkEq('2L slender leg detected (5in leg)', dd.slender, true);

// ── 8. UNEQUAL-leg long/short handling (adversarial-review regression) ─────
const l86 = L('L8X6X1'); // d=6 (short), b=8 (long), x=1.65, y=2.65, rx=2.49, ry=1.72
const tShort = tension(l86, A36, { conn: 'bolted', boltDia: 0.875, nPerLine: 4, connLength: 9, connectedLegLong: false });
chk('L8×6×1 short-leg tension U (=1-y/l)', tShort.U, 0.706, 1);
chk('L8×6×1 short-leg tension φPn', tShort.phiPn, 371, 1.5, 'k');
chkEq('L8×6×1 short-leg governs = Rupture', tShort.governs, 'Rupture');
const cLong = compressionSingle(l86, A36, { L: 120, truss: 'planar', connectedLegLong: true });
chk('L8×6×1 long-leg comp (Lc/r)eff (ry)', cLong.KLreff, 124.3, 1);
chk('L8×6×1 long-leg comp φPn', cLong.phiPn, 188, 1.5, 'k');
const cShort = compressionSingle(l86, A36, { L: 120, truss: 'planar', connectedLegLong: false });
chk('L8×6×1 short-leg comp φPn (penalty)', cShort.phiPn, 221, 1.5, 'k');
// double-angle F9 with web legs in compression (depth = sec.d, comp leg = sec.d)
const fdC = flexureDouble(D('2L5X3X1/4X3/8LLBB'), A50, { Lb: 60, Cb: 1, webLegsInCompression: true });
chk('2L5×3×1/4 LLBB web-comp φMn (LLB)', fdC.phiMn, 136.1, 2, 'k·in');
chkEq('2L5×3×1/4 LLBB web-comp governs = Leg LB', fdC.governs, 'Leg local buckling');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
