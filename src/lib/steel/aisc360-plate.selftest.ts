// Validation of the AISC 360-22 plate/bar design (F11 flexure, J4.2 shear)
// against AISC Design Examples Ch. F, Example F.12 and hand calculations that
// reproduce the F11.2 LTB regions and J4.2 φ factors.
import { plateProps, plateFlexure, plateShear, analyzePlate } from './aisc360-plate';

let fails = 0;
const ok = (name: string, got: number, exp: number, tol: number) => {
  const pass = Math.abs(got - exp) <= tol;
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}: got ${got.toFixed(3)}  exp ${exp.toFixed(3)}  (tol ${tol})`);
};
const Fy = 36, Fu = 58;

// ── Example A — AISC Design Example F.12: 5-deep × 3-wide bar, MAJOR axis, A36 ──
// In our convention b = the larger dim (depth on edge) = 5, t = 3.
const A = plateFlexure(5, 3, Fy, 'major', 72, 1);   // Lb = 72 in
ok('F.12 Sx (in³)', A.S, 12.5, 1e-6);
ok('F.12 Zx (in³)', A.Z, 18.75, 1e-6);
ok('F.12 Lb·d/t²', A.ltbParam ?? 0, 40, 1e-6);       // 72·5/9
ok('F.12 φMn (kip·ft)', A.phiMn / 12, 50.6, 0.1);    // region 1 (40 < 64.4) → yielding
if (!A.governs.includes('Yielding')) { fails++; console.log('FAIL  F.12 should be yielding (region 1)'); }

// ── Example B — same 5×3 bar, MINOR axis (no LTB) ──
const B = plateFlexure(5, 3, Fy, 'minor', 72, 1);
ok('minor Sy (in³)', B.S, 7.5, 1e-6);
ok('minor Zy (in³)', B.Z, 11.25, 1e-6);
ok('minor φMn (kip·ft)', B.phiMn / 12, 30.4, 0.05);  // 0.9·36·11.25 = 364.5 kip·in

// ── Example C — PL ½ × 8 shear, A36 ──
const C0 = plateShear(8, 0.5, Fy, Fu, 0);
ok('shear φVn yield', C0.phiVnYield, 86.4, 1e-6);    // 1.0·0.6·36·4
ok('shear φVn rupture', C0.phiVnRupture, 104.4, 1e-6); // 0.75·0.6·58·4
ok('shear φVn governing', C0.phiVn, 86.4, 1e-6);
const Ch = plateShear(8, 0.5, Fy, Fu, 2 * 0.8125 * 0.5); // two 13/16" holes on the shear plane
ok('shear φVn w/ holes (rupture governs)', Ch.phiVn, 83.2, 0.1);
if (!Ch.governs.includes('rupture')) { fails++; console.log('FAIL  should be rupture with holes'); }

// ── Example D — 6×0.5 bar, MAJOR axis, Lb=60 → inelastic LTB (region 2, F11-3) ──
const D = plateFlexure(6, 0.5, Fy, 'major', 60, 1);
ok('D Lb·d/t²', D.ltbParam ?? 0, 1440, 1e-6);        // 60·6/0.25
ok('D φMn (kip·in)', D.phiMn, 100.1, 0.2);           // 0.9·111.3
if (!D.governs.includes('Inelastic LTB (F11-3)')) { fails++; console.log(`FAIL  D region: ${D.governs}`); }

// ── Example E — 6×0.5 bar, MAJOR axis, Lb=72 → elastic LTB (region 3, F11-4/5) ──
const Emaj = plateFlexure(6, 0.5, Fy, 'major', 72, 1);
ok('E Lb·d/t²', Emaj.ltbParam ?? 0, 1728, 1e-6);
ok('E φMn (kip·in)', Emaj.phiMn, 86.1, 0.2);         // Fcr=31.89, Mn=95.7
if (!Emaj.governs.includes('Elastic LTB (F11-4)')) { fails++; console.log(`FAIL  E region: ${Emaj.governs}`); }

// ── cap 1.6My never governs for a rectangle (Z/S=1.5) ──
const p = plateProps(5, 3);
ok('rectangle Z/S = 1.5 (major)', p.Zxmaj / p.Sxmaj, 1.5, 1e-9);
ok('rectangle Z/S = 1.5 (minor)', p.Zymin / p.Symin, 1.5, 1e-9);

// ── robustness: b < t (thickness > width) must NOT invert strong/weak axis ──
// entering 3×5 (b<t) must match 5×3 for both axes (weak=flatwise, strong=on-edge)
const inv = plateFlexure(3, 5, Fy, 'major', 72, 1);
ok('b<t major matches 5×3 (φMn)', inv.phiMn, A.phiMn, 1e-6);
ok('b<t major LTB param', inv.ltbParam ?? 0, 40, 1e-6); // Lb·max/min² = 72·5/9, NOT 72·3/25
const invMin = plateFlexure(3, 5, Fy, 'minor', 72, 1);
ok('b<t minor matches 5×3 (φMn)', invMin.phiMn, B.phiMn, 1e-6);

// ── governing selection ──
const r = analyzePlate({ b: 8, t: 0.5, Fy, Fu, axis: 'minor', Lb: 48, Cb: 1, holeArea: 0, Mu: 1 * 12, Vu: 30 });
console.log(`  governing: ${r.governing.name} @ ${(r.governing.ratio * 100).toFixed(0)}%`);

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
