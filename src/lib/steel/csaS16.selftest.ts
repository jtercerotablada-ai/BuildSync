/**
 * CSA S16-14 I-beam solver — validation self-tests.
 * Run with: node src/lib/steel/csaS16.selftest.ts
 *
 * Targets cross-checked against CISC Handbook of Steel Construction beam
 * values, a Bentley STAAD.Pro S16-14 shear verification (W530×82, Aw=d·w),
 * and self-consistent LTB worked examples (Cl. 13.6a branches).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classify, flexure, shear, deflection, analyzeBeam, type CsaSection, type BeamInputs } from './csaS16.ts';

const jsonPath = fileURLToPath(new URL('./csa-shapes.json', import.meta.url));
const shapes = (JSON.parse(readFileSync(jsonPath, 'utf8')) as { shapes: CsaSection[] }).shapes;
const get = (imp: string): CsaSection => {
  const s = shapes.find((x) => x.imperial === imp);
  if (!s) throw new Error(`shape ${imp} not found`);
  return s;
};
const Fy = 350, Fu = 450;

let pass = 0, fail = 0;
const chk = (name: string, got: number, want: number, tolPct: number, unit = '') => {
  const ok = Math.abs(got - want) / Math.abs(want) <= tolPct / 100;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} got ${got.toFixed(1)} ${unit}  want ~${want} ${unit}  (${(Math.abs(got - want) / Math.abs(want) * 100).toFixed(1)}%)`);
  ok ? pass++ : fail++;
};
const chkEq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} got ${String(got)}  want ${String(want)}`);
  ok ? pass++ : fail++;
};

const kNm = (Nmm: number) => Nmm / 1e6;
const kN = (N: number) => N / 1e3;

// ── 1. classification ────────────────────────────────────────────────────
const c1 = classify(get('W14X43'), Fy); // W360×64
chkEq('W360×64 flange class', c1.flangeClass, 1);
chkEq('W360×64 web class', c1.webClass, 1);
chkEq('W360×64 overall class', c1.overall, 1);

// ── 2. φMp, fully supported (Cl. 13.5a) vs CISC Mr ────────────────────────
const mp = (imp: string) => kNm(flexure(get(imp), Fy, 500, 1, classify(get(imp), Fy)).Mr);
chk('W360×64 φMp (full support)', mp('W14X43'), 359, 0.6, 'kN·m');   // W360×64
chk('W310×39 φMp (full support)', mp('W12X26'), 192, 0.6, 'kN·m');   // W310×39
chk('W410×54 φMp (full support)', mp('W16X36'), 331, 0.6, 'kN·m');   // W410×54
chk('W460×74 φMp (full support)', mp('W18X50'), 520, 0.6, 'kN·m');   // W460×74
chk('W530×82 φMp (full support)', mp('W21X55'), 652, 0.6, 'kN·m');   // W530×82
chk('W610×125 φMp (full support)', mp('W24X84'), 1156, 0.6, 'kN·m'); // W610×125

// ── 3. shear Vr, stocky web (Cl. 13.4.1.1a, Aw = d·w, Fs = 0.66Fy) ────────
const vr = (imp: string) => kN(shear(get(imp), Fy, 0).Vr);
chk('W530×82 Vr (STAAD Aw=d·w)', vr('W21X55'), 1043, 1.0, 'kN');
chk('W360×64 Vr', vr('W14X43'), 559, 1.5, 'kN');
chkEq('W360×64 shear mode = yield', shear(get('W14X43'), Fy, 0).mode.startsWith('Shear yield'), true);

// ── 4. lateral-torsional buckling (Cl. 13.6a) — W460×74, ω2 = 1 ───────────
const w460 = get('W18X50');
const cl460 = classify(w460, Fy);
const ltbShort = flexure(w460, Fy, 500, 1, cl460);   // fully supported → cap at φMp
const ltbIn = flexure(w460, Fy, 3000, 1, cl460);     // Mu≈895 → inelastic
const ltbEl = flexure(w460, Fy, 6000, 1, cl460);     // Mu≈278 → elastic
chk('W460×74 Lb=0.5m → φMp cap', kNm(ltbShort.Mr), 521, 0.6, 'kN·m');
chkEq('W460×74 Lb=0.5m governs', ltbShort.governs, 'Yielding');
chk('W460×74 Lb=3.0m Mu', kNm(ltbIn.Mu), 895, 2, 'kN·m');
chk('W460×74 Lb=3.0m Mr (inelastic)', kNm(ltbIn.Mr), 491, 2, 'kN·m');
chkEq('W460×74 Lb=3.0m branch', ltbIn.ltbMode, 'inelastic');
chk('W460×74 Lb=6.0m Mu', kNm(ltbEl.Mu), 278, 2, 'kN·m');
chk('W460×74 Lb=6.0m Mr (elastic)', kNm(ltbEl.Mr), 250, 2, 'kN·m');
chkEq('W460×74 Lb=6.0m branch', ltbEl.ltbMode, 'elastic');

// Class-4 LTB uses the EFFECTIVE yield moment Se·Fy (Cl. 13.6b) — W150×22 (W6×15)
const w150 = get('W6X15');
const cl150 = classify(w150, Fy);
chkEq('W150×22 @350 overall class', cl150.overall, 4);
const ltbC4 = flexure(w150, Fy, 3200, 1, cl150);
chkEq('W150×22 basis = Se (effective)', ltbC4.basis, 'Se');
chk('W150×22 Lb=3.2m Mr (Class-4 inelastic)', kNm(ltbC4.Mr), 42.96, 1.5, 'kN·m');

// ── 5. deflection (ss-udl 5wL⁴/384EI) ────────────────────────────────────
const df = deflection({
  section: w460, material: { Fy, Fu }, Lb: 8000, omega2: 1, a: 0,
  Mf: 0, Vf: 0, deflCase: 'ss-udl', wService: 20 /*N/mm = 20 kN/m*/, Pservice: 0,
  Lspan: 8000, deflDen: 360,
} as BeamInputs);
chk('W460×74 δ (ss-udl 20kN/m, 8m)', df.delta, 16.0, 3, 'mm');
chk('W460×74 δ limit L/360', df.limit, 22.2, 1, 'mm');

// ── 6. end-to-end analyzeBeam sanity ─────────────────────────────────────
const res = analyzeBeam({
  section: get('W14X43'), material: { Fy, Fu }, Lb: 2000, omega2: 1, a: 0,
  Mf: 250e6 /*250 kN·m*/, Vf: 300e3 /*300 kN*/,
  deflCase: 'ss-udl', wService: 15, Pservice: 0, Lspan: 6000, deflDen: 360,
} as BeamInputs);
chkEq('analyzeBeam governing is a real check', ['Flexure (Mf/Mr)', 'Shear (Vf/Vr)', 'Deflection (δ/δlim)'].includes(res.governing.name), true);
console.log(`   (governing: ${res.governing.name} @ ${res.governing.ratio.toFixed(2)}, pass=${res.pass})`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
