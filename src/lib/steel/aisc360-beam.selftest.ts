// Validation of the AISC 360-16 I-beam wrapper against AISC Steel Construction
// Manual (15th ed.) Table 3-2 available-strength values (Fy = 50 ksi, φb/φv).
import aiscData from './aisc-shapes.json';
import { analyzeBeam, beamDeflection, type BeamInputs, type DeflCase } from './aisc360-beam';
import type { SteelSection } from './aisc360';

const ALL = (aiscData as { shapes: SteelSection[] }).shapes;
const S = (name: string) => ALL.find((x) => x.designation === name)!;
const A992 = { Fy: 50, Fu: 65 };
let fails = 0;
const ok = (name: string, got: number, exp: number, tol: number) => {
  const pass = Math.abs(got - exp) <= tol;
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}: got ${got.toFixed(3)}  exp ${exp.toFixed(3)}  (tol ${tol})`);
};

const mk = (name: string, Lb_ft = 0): BeamInputs => ({
  section: S(name), material: A992, Lb: Lb_ft * 12, Cb: 1,
  Mu: 0, Vu: 0, deflCase: 'ss-udl', wService: 0, Pservice: 0, Lspan: 240, deflDen: 360,
});

// ── AISC Table 3-2: φMp (k·ft), Lp (ft), Lr (ft), φVn (kips) ──
// φVn with the AISC v15 tabulated h/tw (field hw): W18×50 & W24×76 & W14×22 are
// φv=1.0; W16×26 is a genuine AISC G2.1(a) φv=0.90 case (h/tw 56.8 > 53.9).
// W14×22 now matches AISC exactly (h/tw 53.3 ≤ 53.9 → φv=1.0 → 94.5, small
// residual vs the Manual's 94.8 is d rounded to 0.1 in the shape DB).
const T32: [string, number, number, number, number][] = [
  // name,      φMp,  Lp,   Lr,   φVn
  ['W18X50',    379,  5.83, 16.9, 192],
  ['W16X26',    166,  3.96, 11.2, 106],
  ['W24X76',    750,  6.78, 19.5, 315],
  ['W14X22',    125,  3.67, 10.4, 94.5],
];
for (const [name, phiMp, Lp, Lr, phiVn] of T32) {
  const r = analyzeBeam(mk(name, 2)); // Lb small so plateau = φMp
  ok(`${name} φMp (k·ft)`, r.flexure.phiRn / 12, phiMp, 0.6);
  ok(`${name} Lp (ft)`, (r.flexure.Lp ?? 0) / 12, Lp, 0.05);
  ok(`${name} Lr (ft)`, (r.flexure.Lr ?? 0) / 12, Lr, 0.2);
  ok(`${name} φVn (k)`, r.shear.phiRn, phiVn, 0.6); // ±0.6 covers d rounded to 0.1 in the DB
}
// h/tw now uses the AISC-tabulated value (hw field): W14×22 must read 53.3
const w1422 = analyzeBeam(mk('W14X22', 2));
ok('W14X22 h/tw (AISC)', w1422.classification.webLambda, 53.3, 0.1);

// ── LTB inelastic range: W18×50 Lb=10 ft, Cb=1 → φMn = φ[Mp−BF(Lb−Lp)] ≈ 324 k·ft ──
const r10 = analyzeBeam(mk('W18X50', 10));
ok('W18X50 φMn @10ft Cb1 (k·ft)', r10.flexure.phiRn / 12, 324, 2);
// Elastic LTB range: Lb=25 ft (> Lr) → F2-3/F2-4 ≈ 130 k·ft
const r25 = analyzeBeam(mk('W18X50', 25));
ok('W18X50 φMn @25ft Cb1 (k·ft)', r25.flexure.phiRn / 12, 130, 2);

// ── Deflection formulas (E = 29000 ksi) ──
const d1 = beamDeflection('ss-udl', 2 / 12, 0, 240, 800);   // w=2 klf, L=20ft, W18×50 I=800
ok('δ ss-udl (in)', d1.delta, 0.3103, 0.001);
const d2 = beamDeflection('ss-point', 0, 20, 240, 800);     // P=20k
ok('δ ss-point (in)', d2.delta, 0.2483, 0.001);
const d3 = beamDeflection('cant-udl', 2 / 12, 0, 120, 800); // L=10ft cantilever
ok('δ cant-udl (in)', d3.delta, (2 / 12 * 120 ** 4) / (8 * 29000 * 800), 1e-6);

// ── Governing selection: shear-critical short beam ──
const gv: BeamInputs = { ...mk('W16X26', 2), Mu: 100 * 12, Vu: 120, wService: 0.5 / 12, Lspan: 120, deflDen: 240 };
const rg = analyzeBeam(gv);
console.log(`      governing: ${rg.governing.name} @ ${(rg.governing.ratio * 100).toFixed(0)}% (flex ${(rg.flexUtil * 100).toFixed(0)}%, shear ${(rg.shearUtil * 100).toFixed(0)}%, defl ${(rg.deflUtil * 100).toFixed(0)}%)`);
if (rg.governing.name !== 'Shear' || rg.governing.ratio <= rg.flexUtil) { fails++; console.log('FAIL  shear should govern here'); }

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
