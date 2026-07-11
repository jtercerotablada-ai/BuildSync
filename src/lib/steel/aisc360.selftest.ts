/**
 * Self-validation of the AISC 360-22 solver against published AISC Manual
 * (15th ed.) values.  Run:  node src/lib/steel/aisc360.selftest.ts
 */
import { analyzeMember, tension, type SteelSection, type MemberInputs } from './aisc360.ts';

const A992 = { Fy: 50, Fu: 65 };

const W14x90: SteelSection = {
  designation: 'W14X90', family: 'W', A: 26.5, d: 14.0, bf: 14.5, tf: 0.710, tw: 0.440,
  Ix: 999, Sx: 143, Zx: 157, rx: 6.14, Iy: 362, Sy: 49.9, Zy: 75.6, ry: 3.70, J: 4.06, Cw: 16000,
};
const W18x50: SteelSection = {
  designation: 'W18X50', family: 'W', A: 14.7, d: 18.0, bf: 7.50, tf: 0.570, tw: 0.355,
  Ix: 800, Sx: 88.9, Zx: 101, rx: 7.38, Iy: 40.1, Sy: 10.7, Zy: 16.6, ry: 1.65, J: 1.24, Cw: 3040,
};

const base = (s: SteelSection): MemberInputs => ({
  section: s, material: A992, Lcx: 0, Lcy: 0, Lcz: 0, Lb: 0, Cb: 1, An: s.A, U: 1,
  Pu: 0, Mux: 0, Muy: 0, Vu: 0,
});

let pass = 0, fail = 0;
function check(name: string, got: number, want: number, tolPct: number, unit = '') {
  const err = Math.abs(got - want) / Math.abs(want) * 100;
  const ok = err <= tolPct;
  (ok ? pass++ : fail++);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(42)} got ${got.toFixed(1)}${unit}  want ~${want}${unit}  (${err.toFixed(1)}%)`);
}

// 1) W14×90 A992 column, Lc = 14 ft (both axes). AISC Table 4-1a: φcPn ≈ 1030 kips
{
  const L = 14 * 12;
  const r = analyzeMember({ ...base(W14x90), Lcx: L, Lcy: L, Lcz: L, Pu: -1 });
  check('W14×90 col Lc=14ft  φcPn', r.compression.phiRn, 1030, 3, ' k');
}

// 2) W14×90 A992 tension yielding: φPn = 0.9·50·26.5 = 1192.5 k
{
  const t = tension(W14x90, A992, W14x90.A, 1);
  check('W14×90 tension yield  φPn', t.phiRn, 1192.5, 1, ' k');
}

// 3) W18×50 A992 beam fully braced: φMp = 0.9·50·101 = 4545 k·in = 378.75 k·ft. AISC 3-2: 379
{
  const r = analyzeMember({ ...base(W18x50), Lb: 1 });
  check('W18×50 φMp (fully braced)', r.flexureMajor.phiRn / 12, 379, 2, ' k·ft');
}

// 4) W18×50 Lp / Lr (AISC Table 3-2: Lp = 5.83 ft, Lr = 16.9 ft)
{
  const r = analyzeMember({ ...base(W18x50), Lb: 100 });
  check('W18×50 Lp', (r.flexureMajor.Lp ?? 0) / 12, 5.83, 3, ' ft');
  check('W18×50 Lr', (r.flexureMajor.Lr ?? 0) / 12, 16.9, 4, ' ft');
}

// 5) W18×50 shear: AISC Table 3-2 φVn = 192 kips (φv = 1.0)
{
  const r = analyzeMember({ ...base(W18x50), Vu: 1 });
  check('W18×50 φVn', r.shear.phiRn, 192, 2, ' k');
}

// 6) W18×50 at Lb = 30 ft (> Lr): elastic LTB, Cb=1. AISC 3-10 ≈ 143 k·ft
{
  const r = analyzeMember({ ...base(W18x50), Lb: 30 * 12, Cb: 1 });
  const kft = r.flexureMajor.phiRn / 12;
  const ok = kft > 100 && kft < 180 && r.flexureMajor.governs.includes('Elastic');
  (ok ? pass++ : fail++);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${'W18×50 elastic LTB @30ft'.padEnd(42)} φMn ${kft.toFixed(0)} k·ft  (${r.flexureMajor.governs})`);
}

// 7) Combined H1: W14×90, Lc=14ft, Pu=-600k, Mux=200 k·ft → ratio in (0,1)
{
  const r = analyzeMember({ ...base(W14x90), Lcx: 14 * 12, Lcy: 14 * 12, Lcz: 14 * 12, Lb: 14 * 12, Pu: -600, Mux: 200 * 12 });
  const c = r.combined!;
  const ok = c.equation === 'H1-1a' && c.ratio > 0.5 && c.ratio < 1.2;
  (ok ? pass++ : fail++);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${'W14×90 combined H1-1a'.padEnd(42)} ratio ${c.ratio.toFixed(3)} (${c.equation})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
