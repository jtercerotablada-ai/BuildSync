import { solveAsce722Seismic } from './asce7-22-seismic';
import { solveAsce722Snow, PSF_TO_PA } from './asce7-22-snow';
import type { SeismicData, SnowData } from './types';

const KIP = 4.4482216152605; // kip → kN
const FT = 304.8;            // ft → mm
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
const sn1: SnowData = { pg: 25 * PSF_TO_PA, terrain: 'B', roofExposure: 'partially-exposed', thermal: 'heated', roofR: 30, roofSlope: 10, slippery: true, eaveToRidge: 20 * FT };
const rs1 = solveAsce722Snow(sn1, 'III');
ok('Snow1 Ce', rs1.Ce, 1.0, 1e-9);
ok('Snow1 Ct', rs1.Ct, 1.0, 1e-9);
ok('Snow1 pf (psf)', rs1.pf / PSF_TO_PA, 17.5, 0.05);   // 0.7·1·1·25
ok('Snow1 Cs', rs1.Cs, 0.9231, 0.001);                  // warm slippery θ=10: 1-(10-5)/65
ok('Snow1 ps (psf)', rs1.ps / PSF_TO_PA, 16.15, 0.1);   // 0.9231·17.5
ok('Snow1 pm (psf)', rs1.pm / PSF_TO_PA, 25.0, 0.05);   // min(pg25, pm,max[III]=35)=25

// ── SNOW: Detroit ventilated flat R-25 (NFBA 7-22 example), Ct=1.2, pg=37 ──
const sn2: SnowData = { pg: 37 * PSF_TO_PA, terrain: 'C', roofExposure: 'partially-exposed', thermal: 'unheated', roofR: 30, roofSlope: 0, slippery: false, eaveToRidge: 30 * FT };
const rs2 = solveAsce722Snow(sn2, 'II');
ok('Snow2 pf (psf)', rs2.pf / PSF_TO_PA, 31.08, 0.1);   // 0.7·1.0·1.2·37
ok('Snow2 pm cap (psf)', rs2.pm / PSF_TO_PA, 30.0, 0.05); // min(pg37, pm,max[II]=30)=30

// ── SNOW: Table 7.3-3 heated-unventilated, R=30, pg=30 → Ct=1.14 ──
const sn3: SnowData = { pg: 30 * PSF_TO_PA, terrain: 'C', roofExposure: 'fully-exposed', thermal: 'heated-unventilated', roofR: 30, roofSlope: 0, slippery: false, eaveToRidge: 30 * FT };
const rs3 = solveAsce722Snow(sn3, 'IV');
ok('Snow3 Ct (7.3-3)', rs3.Ct, 1.14, 1e-3);             // R=30,pg=30 cell
ok('Snow3 pf (psf)', rs3.pf / PSF_TO_PA, 0.7 * 0.9 * 1.14 * 30, 0.05); // Ce(D-full? C-full=0.9)
ok('Snow3 pm cap (psf)', rs3.pm / PSF_TO_PA, 30.0, 0.05); // min(pg30, pm,max[IV]=40)=30

// ── SNOW Cs slope-factor branches ──
const csAt = (theta: number, thermal: SnowData['thermal'], slippery: boolean) =>
  solveAsce722Snow({ pg: 20 * PSF_TO_PA, terrain: 'C', roofExposure: 'partially-exposed', thermal, roofR: 30, roofSlope: theta, slippery, eaveToRidge: 30 * FT }, 'II').Cs;
ok('Cs warm/other 50°', csAt(50, 'heated', false), 0.5, 1e-3);        // 1-(50-30)/40
ok('Cs warm/slippery 40°', csAt(40, 'heated', true), 0.4615, 1e-3);   // (70-40)/65
ok('Cs cold≥1.2/other 45°', csAt(45, 'unheated', false), 1.0, 1e-3);  // hold to 45
ok('Cs cold≥1.2/other 60°', csAt(60, 'unheated', false), 0.4, 1e-3);  // 1-(60-45)/25
ok('Cs ≥70° = 0', csAt(75, 'heated', false), 0.0, 1e-9);

// ── SNOW rain-on-snow added AFTER Cs (§7.10, not scaled by slope factor) ──
// slippery warm roof, W=300ft (W/50=6°), slope 5.5° < 6°, pg=15, Ce=1.0
const snR: SnowData = { pg: 15 * PSF_TO_PA, terrain: 'C', roofExposure: 'partially-exposed', thermal: 'heated', roofR: 30, roofSlope: 5.5, slippery: true, eaveToRidge: 300 * FT };
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

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
