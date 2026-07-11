import { solveAsce722Seismic } from './asce7-22-seismic';
import { solveAsce722Snow, PSF_TO_PA, snowDensityPcf, driftHeightFt } from './asce7-22-snow';
import { kz, kzt, gustEffect, solveAsce722Wind } from './asce7-22-wind';
import { combosLRFD, combosASD } from './asce7-22-combos';
import { DEFAULT_SITE, DEFAULT_STRUCTURE, DEFAULT_SNOW } from './solve';
import type { SeismicData, SnowData } from './types';

const KIP = 4.4482216152605; // kip → kN
const FT = 304.8;            // ft → mm
const NO_DRIFT = { step: false, luUpper: 40 * FT, luLower: 30 * FT, stepHeight: 4 * FT, parapet: false, parapetHeight: 2.5 * FT, parapetLu: 50 * FT, sliding: false };
let fails = 0;
const ok = (name: string, got: number, exp: number, tol: number) => {
  const pass = Math.abs(got - exp) <= tol;
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}: got ${got.toFixed(4)}  exp ${exp.toFixed(4)}  (tol ${tol})`);
};

// ── SEISMIC Example 1 (SkyCiv, upper-limit Cs governs) ──
const s1: SeismicData = { SDS: 0.708, SD1: 0.402, S1: 0.402, TL: 16, R: 8, systemPeriod: 'concrete-moment', hn: 75 * FT, W: 8949.2 * KIP, stories: 6 };
const r1 = solveAsce722Seismic(s1, 'II');
ok('Ex1 Ta', r1.Ta, 0.7792, 0.002);
ok('Ex1 Cs', r1.Cs, 0.0645, 0.0005);
ok('Ex1 V (kip)', r1.V / KIP, 577.2, 2.0);
console.log(`      Ex1 SDC ${r1.SDC} (exp D), control="${r1.CsControl}"`);
if (r1.SDC !== 'D') fails++;

// ── SEISMIC Example 2 (base Cs governs) ──
const s2: SeismicData = { SDS: 0.7773, SD1: 0.5550, S1: 0.45, TL: 8, R: 8, systemPeriod: 'steel-moment', hn: 45 * FT, W: 9000 * KIP, stories: 4 };
const r2 = solveAsce722Seismic(s2, 'II');
ok('Ex2 Ta', r2.Ta, 0.5885, 0.002);
ok('Ex2 Cs', r2.Cs, 0.09717, 0.0005);
ok('Ex2 V (kip)', r2.V / KIP, 874.5, 2.0);
console.log(`      Ex2 SDC ${r2.SDC} (exp D), control="${r2.CsControl}"`);
if (r2.SDC !== 'D') fails++;
// story-force sum must equal V
const sumF = r2.forces.reduce((a, f) => a + f.Fx, 0);
ok('Ex2 ΣFx = V', sumF, r2.V, 0.01);

// ── SNOW: pf formula (ASCE 7-22, no Is) ──
// Heated, slippery metal, terrain B partially-exposed (Ce=1.0), slope 10°, pg 25 psf
const sn1: SnowData = { pg: 25 * PSF_TO_PA, terrain: 'B', roofExposure: 'partially-exposed', thermal: 'heated', roofR: 30, roofSlope: 10, slippery: true, eaveToRidge: 20 * FT, W2: 0.45, drift: NO_DRIFT };
const rs1 = solveAsce722Snow(sn1, 'III');
ok('Snow1 Ce', rs1.Ce, 1.0, 1e-9);
ok('Snow1 Ct', rs1.Ct, 1.0, 1e-9);
ok('Snow1 pf (psf)', rs1.pf / PSF_TO_PA, 17.5, 0.05);   // 0.7·1·1·25
ok('Snow1 Cs', rs1.Cs, 0.9231, 0.001);                  // warm slippery θ=10: 1-(10-5)/65
ok('Snow1 ps (psf)', rs1.ps / PSF_TO_PA, 16.15, 0.1);   // 0.9231·17.5
ok('Snow1 pm (psf)', rs1.pm / PSF_TO_PA, 25.0, 0.05);   // min(pg25, pm,max[III]=35)=25

// ── SNOW: Detroit ventilated flat R-25 (NFBA 7-22 example), Ct=1.2, pg=37 ──
const sn2: SnowData = { pg: 37 * PSF_TO_PA, terrain: 'C', roofExposure: 'partially-exposed', thermal: 'unheated', roofR: 30, roofSlope: 0, slippery: false, eaveToRidge: 30 * FT, W2: 0.45, drift: NO_DRIFT };
const rs2 = solveAsce722Snow(sn2, 'II');
ok('Snow2 pf (psf)', rs2.pf / PSF_TO_PA, 31.08, 0.1);   // 0.7·1.0·1.2·37
ok('Snow2 pm cap (psf)', rs2.pm / PSF_TO_PA, 30.0, 0.05); // min(pg37, pm,max[II]=30)=30

// ── SNOW: Table 7.3-3 heated-unventilated, R=30, pg=30 → Ct=1.14 ──
const sn3: SnowData = { pg: 30 * PSF_TO_PA, terrain: 'C', roofExposure: 'fully-exposed', thermal: 'heated-unventilated', roofR: 30, roofSlope: 0, slippery: false, eaveToRidge: 30 * FT, W2: 0.45, drift: NO_DRIFT };
const rs3 = solveAsce722Snow(sn3, 'IV');
ok('Snow3 Ct (7.3-3)', rs3.Ct, 1.14, 1e-3);             // R=30,pg=30 cell
ok('Snow3 pf (psf)', rs3.pf / PSF_TO_PA, 0.7 * 0.9 * 1.14 * 30, 0.05); // Ce(D-full? C-full=0.9)
ok('Snow3 pm cap (psf)', rs3.pm / PSF_TO_PA, 30.0, 0.05); // min(pg30, pm,max[IV]=40)=30

// ── SNOW Cs slope-factor branches ──
const csAt = (theta: number, thermal: SnowData['thermal'], slippery: boolean) =>
  solveAsce722Snow({ pg: 20 * PSF_TO_PA, terrain: 'C', roofExposure: 'partially-exposed', thermal, roofR: 30, roofSlope: theta, slippery, eaveToRidge: 30 * FT, W2: 0.45, drift: NO_DRIFT }, 'II').Cs;
ok('Cs warm/other 50°', csAt(50, 'heated', false), 0.5, 1e-3);        // 1-(50-30)/40
ok('Cs warm/slippery 40°', csAt(40, 'heated', true), 0.4615, 1e-3);   // (70-40)/65
ok('Cs cold≥1.2/other 45°', csAt(45, 'unheated', false), 1.0, 1e-3);  // hold to 45
ok('Cs cold≥1.2/other 60°', csAt(60, 'unheated', false), 0.4, 1e-3);  // 1-(60-45)/25
ok('Cs ≥70° = 0', csAt(75, 'heated', false), 0.0, 1e-9);

// ── SNOW rain-on-snow added AFTER Cs (§7.10, not scaled by slope factor) ──
// slippery warm roof, W=300ft (W/50=6°), slope 5.5° < 6°, pg=15, Ce=1.0
const snR: SnowData = { pg: 15 * PSF_TO_PA, terrain: 'C', roofExposure: 'partially-exposed', thermal: 'heated', roofR: 30, roofSlope: 5.5, slippery: true, eaveToRidge: 300 * FT, W2: 0.45, drift: NO_DRIFT };
const rsR = solveAsce722Snow(snR, 'II');
ok('SnowROS +8', rsR.rainOnSnow / PSF_TO_PA, 8.0, 0.01);
ok('SnowROS ps = Cs·pf + 8', rsR.ps / PSF_TO_PA, 0.99231 * 10.5 + 8, 0.02); // 18.42, NOT Cs·(pf+8)

// ── SEISMIC SDC S1≥0.75 override → E (Risk I-III) ──
const rOv = solveAsce722Seismic({ SDS: 1.2, SD1: 0.7, S1: 0.8, TL: 8, R: 8, systemPeriod: 'steel-moment', hn: 60 * FT, W: 5000 * KIP, stories: 5 }, 'II');
console.log(`      SDC override S1=0.8 → ${rOv.SDC} (exp E)`);
if (rOv.SDC !== 'E') fails++;
// upper-limit governs: SD1/(Ta·R/Ie)=0.7/(0.7407·8)=0.1181 (< base 0.15); S1=0.8 floor 0.05 not binding
ok('SDC override Cs (upper limit)', rOv.Cs, 0.1181, 1e-3);

// ── SEISMIC minimum floor governs (very low SDS) ──
const rMin = solveAsce722Seismic({ SDS: 0.05, SD1: 0.02, S1: 0.05, TL: 8, R: 8, systemPeriod: 'other', hn: 20 * FT, W: 1000 * KIP, stories: 2 }, 'II');
ok('Cs floor 0.01', rMin.Cs, 0.01, 1e-6);   // max(0.044·0.05·1, 0.01)=0.01

// ══════════ DRIFT (§7.6–7.9, ASCE 7-22 Eq 7.6-1 with W2) ══════════
// Example A — windward parapet (Eng-Tips canopy, reproduced to 3 decimals)
ok('γ(52)', snowDensityPcf(52), 20.76, 0.01);
const hdA = driftHeightFt(52, 50, 0.55, snowDensityPcf(52));
ok('Ex A hd', hdA, 3.3603, 0.002);
ok('Ex A 0.75hd', 0.75 * hdA, 2.5203, 0.002);
ok('Ex A width 8·0.75hd', 8 * 0.75 * hdA, 20.16, 0.02);
ok('Ex A surcharge uncapped', 0.75 * hdA * snowDensityPcf(52), 52.32, 0.05);

// Example B — leeward roof-step, cap-controlled (SK&A, Washington DC)
const snB: SnowData = {
  pg: 63 * PSF_TO_PA, terrain: 'C', roofExposure: 'partially-exposed', thermal: 'heated',
  roofR: 30, roofSlope: 0, slippery: false, eaveToRidge: 30 * FT, W2: 0.45,
  drift: { step: true, luUpper: 40 * FT, luLower: 30 * FT, stepHeight: 4 * FT, parapet: false, parapetHeight: 2.5 * FT, parapetLu: 50 * FT, sliding: false },
};
const rB = solveAsce722Snow(snB, 'II');
ok('Ex B pf (psf)', rB.pf / PSF_TO_PA, 44.1, 0.05);
ok('Ex B γ', rB.drift!.gamma_pcf, 22.19, 0.01);
ok('Ex B hb (ft)', rB.drift!.hb / FT, 1.987, 0.005);
ok('Ex B hc (ft)', rB.drift!.hc / FT, 2.013, 0.005);
ok('Ex B hd (ft)', rB.drift!.leeward!.hd / FT, 2.721, 0.005);
ok('Ex B h capped (ft)', rB.drift!.leeward!.h / FT, 2.013, 0.005);
ok('Ex B pd (psf)', rB.drift!.leeward!.pd / PSF_TO_PA, 44.7, 0.1);
ok('Ex B peak (psf)', rB.drift!.leeward!.peak / PSF_TO_PA, 88.8, 0.15);
ok('Ex B w (ft)', rB.drift!.leeward!.w / FT, 14.71, 0.02);
if (!rB.drift!.leeward!.capped) { fails++; console.log('FAIL  Ex B capped flag'); }

// Unbalanced gable general case (derived from confirmed formulas)
const snU: SnowData = { ...snB, pg: 30 * PSF_TO_PA, roofSlope: Math.atan(4 / 12) * 180 / Math.PI, eaveToRidge: 50 * FT, W2: 0.55, drift: { ...snB.drift, step: false } };
const rU = solveAsce722Snow(snU, 'II');
ok('Unbal ps (psf)', rU.ps / PSF_TO_PA, 21.0, 0.05);
ok('Unbal windward 0.3ps', rU.drift!.unbalanced!.windward / PSF_TO_PA, 6.3, 0.02);
ok('Unbal surcharge γhd/√S', rU.drift!.unbalanced!.surcharge / PSF_TO_PA, 30.51, 0.1);
ok('Unbal extent (ft)', rU.drift!.unbalanced!.extent / FT, 13.64, 0.05);

// ══════════ WIND 7-22 constants: Kz (2.41), Kzt, gust ══════════
ok('Kz C @30ft (7-22)', kz(30 * 0.3048, 'C'), 0.9805, 0.001);
ok('Kzt escarp C crest (H/Lh=0.5)', kzt('escarpment', 'C', 50, 100, 0, 0), 2.0306, 0.002);
ok('Kzt Note2 (H/Lh=1→2H)', kzt('escarpment', 'C', 100, 100, 0, 50), 1.5068, 0.002);
ok('G default', gustEffect('default', 'C', 9.14, 12.2, 18.3, 76, 1, 0.02).G, 0.85, 1e-9);
const gCalc = gustEffect('calculated', 'C', 9.14, 12.2, 18.3, 76, 1, 0.02).G;
if (gCalc < 0.8 || gCalc > 0.92) { fails++; console.log(`FAIL  G calculated out of range: ${gCalc}`); } else console.log(`PASS  G calculated = ${gCalc.toFixed(3)} (rigid range)`);
// default-structure wind regression: windward ≈ 53.0 psf with 7-22 Kz + Kd relocation
const rw = solveAsce722Wind(DEFAULT_SITE, DEFAULT_STRUCTURE);
ok('Wind windward design (psf)', rw.mwfrs.walls.windwardDesign / PSF_TO_PA, 53.0, 0.3);
ok('Wind qh excl. Kd (psf)', rw.breakdown.qh / PSF_TO_PA, 72.5, 0.4);

// ══════════ COMBOS (7-22 snow factors: 1.0S / 0.3S LRFD, 0.7S ASD) ══════════
const ci = { D: 20 * PSF_TO_PA, L: 50 * PSF_TO_PA, Lr: 20 * PSF_TO_PA, R: 0, S: 30 * PSF_TO_PA, SDS: 0.9, rho: 1.0 };
const lr = combosLRFD(ci);
ok('LRFD-2 (0.5Lr governs)', lr[1].value! / PSF_TO_PA, 114, 0.05);       // 24+80+10
ok('LRFD-3a (1.6Lr governs over 1.0S)', lr[2].value! / PSF_TO_PA, 106, 0.05); // 24+32+50
const ad = combosASD(ci);
ok('ASD-3 (0.7S governs)', ad[2].value! / PSF_TO_PA, 41, 0.05);          // 20+21
ok('ASD-4', ad[3].value! / PSF_TO_PA, 73.25, 0.05);                      // 20+37.5+15.75
if (!lr[6].expr.includes('1.380D')) { fails++; console.log('FAIL  LRFD seismic (1.2+0.2·0.9)D resolve'); } else console.log('PASS  LRFD-6 resolves (1.2+0.2·SDS)D = 1.380D');

// ══════════ Adversarial-review regressions ══════════
// Gf finite for degenerate n1 (clamped to 0.01 Hz)
const gTiny = gustEffect('flexible', 'C', 30.48, 18.3, 30.5, 76, 0.0001, 0.02).G;
if (!isFinite(gTiny)) { fails++; console.log(`FAIL  Gf tiny n1 not finite: ${gTiny}`); } else console.log(`PASS  Gf(n1=1e-4) finite = ${gTiny.toFixed(3)}`);
// Sliding totalPerLength reduced proportionally for narrow lower roof
const snS: SnowData = { ...snB, pg: 30 * PSF_TO_PA, roofSlope: 5, slippery: true, eaveToRidge: 25 * FT, drift: { ...snB.drift, step: false, sliding: true, luLower: 10 * FT } };
const rS = solveAsce722Snow(snS, 'II');
// pf = 0.7·30 = 21 → total = 0.4·21·25 = 210 lb/ft; reduced ×10/15 = 140 lb/ft = 2043.1 N/m
ok('Sliding total reduced (N/m)', rS.drift!.sliding!.totalPerLength, 140 * 14.5939, 1.0);
ok('Sliding width 10 ft', rS.drift!.sliding!.width / FT, 10, 0.01);
// Roof positive-Cp zone takes the downward (max) case: gable 30°, h/L=0.25
const rwP = solveAsce722Wind(DEFAULT_SITE, { ...DEFAULT_STRUCTURE, roofType: 'gable', roofSlope: 30 });
const posZone = rwP.mwfrs.roof.find((r) => r.Cp > 0);
if (!posZone || posZone.p <= 0) { fails++; console.log(`FAIL  positive-Cp roof zone should report downward pressure, got ${posZone?.p}`); }
else console.log(`PASS  roof +Cp zone downward: Cp ${posZone.Cp.toFixed(2)} → ${(posZone.p / PSF_TO_PA).toFixed(1)} psf`);
// Combos label formatting: 1.0S not 1S
const lrBig = combosLRFD({ D: 20 * PSF_TO_PA, L: 0, Lr: 0, R: 0, S: 80 * PSF_TO_PA, SDS: 0.5, rho: 1 });
if (!lrBig[2].expr.includes('1.0S')) { fails++; console.log(`FAIL  combo label: ${lrBig[2].expr}`); } else console.log('PASS  combo label 1.0S');

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
