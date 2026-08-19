// Validation of the AISC 360-16 channel design (Fy = 36 ksi, A36) against AISC
// Design Example F.2 (C15×33.9), the STAAD 360-16 channel verifications, and
// hand calculations reproduced to 3 significant figures.
import channelDb from './channel-shapes.json';
import {
  flexureChannelMajor, flexureChannelMinor, shearChannel, classifyChannel, compressionChannel, channelDeflection, analyzeChannel,
  type ChannelSection,
} from './aisc360-channel';

const ALL = (channelDb as { shapes: ChannelSection[] }).shapes;
const S = (n: string) => ALL.find((x) => x.designation === n)!;
let fails = 0;
const ok = (name: string, got: number, exp: number, tol: number) => {
  const pass = Math.abs(got - exp) <= tol;
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}: got ${got.toFixed(3)}  exp ${exp.toFixed(3)}  (tol ${tol})`);
};
console.log(`DB: ${ALL.length} channels (${ALL.filter((x) => x.family === 'C').length} C, ${ALL.filter((x) => x.family === 'MC').length} MC)`);

// ── AISC Design Example F.2 — C15×33.9, Fy = 36 ──
const c15 = S('C15X33.9');
const f15 = flexureChannelMajor(c15, 36, 24, 1); // Lb = 2 ft (plateau)
ok('C15×33.9 c (F2-8b)', f15.c, 1.077, 0.006);
ok('C15×33.9 φMp (k·ft)', f15.phiMn / 12, 137, 1.0);
ok('C15×33.9 Lp (ft)', f15.Lp / 12, 3.75, 0.05);
ok('C15×33.9 Lr (ft)', f15.Lr / 12, 14.5, 0.2);
ok('C15×33.9 φVn (k, φv=0.90)', shearChannel(c15, 36).phiVn, 117, 1.0);
// Inelastic LTB @ Lb = 5 ft (Example F.2B) → φMn 130 k·ft
ok('C15×33.9 φMn @5ft Cb1', flexureChannelMajor(c15, 36, 60, 1).phiMn / 12, 130, 1.5);
// Elastic LTB @ Lb = 20 ft (beyond Lr) → φMn 54.3 k·ft
ok('C15×33.9 φMn @20ft Cb1', flexureChannelMajor(c15, 36, 240, 1).phiMn / 12, 54.3, 1.0);

// ── Other channels: φMp, Lr, φVn (Fy = 36) ──
const c12 = S('C12X20.7');
ok('C12×20.7 φMp (k·ft)', flexureChannelMajor(c12, 36, 24, 1).phiMn / 12, 69.1, 0.5);
ok('C12×20.7 Lr (ft)', flexureChannelMajor(c12, 36, 24, 1).Lr / 12, 12.1, 0.2);
ok('C12×20.7 φVn (k)', shearChannel(c12, 36).phiVn, 65.8, 0.5);
const c10 = S('C10X15.3');
ok('C10×15.3 φMp (k·ft)', flexureChannelMajor(c10, 36, 24, 1).phiMn / 12, 42.7, 0.6);
ok('C10×15.3 φVn (k)', shearChannel(c10, 36).phiVn, 46.7, 0.5);

// ── Compression E3/E4 @ KL = 10 ft, Fy = 36 (weak-axis flexural governs) ──
const p12 = compressionChannel(c12, 36, 120, 120, 120);
ok('C12×20.7 φcPn @10ft (k)', p12.phiPn, 60.6, 1.0);
if (!p12.mode.includes('about y')) { fails++; console.log(`FAIL  C12 compression mode: ${p12.mode} (expect weak-axis flexural)`); }
const p10 = compressionChannel(c10, 36, 120, 120, 120);
ok('C10×15.3 φcPn @10ft (k)', p10.phiPn, 35.5, 1.0);
// FTB must be a non-governing (higher) Fe here
if (p12.FeFTB <= p12.Fey) { fails++; console.log('FAIL  C12 FTB should exceed weak-axis Fe here'); }

// ── classification: all compact for flexure at Fy = 36 ──
for (const n of ['C15X33.9', 'C12X20.7', 'C10X15.3', 'C8X11.5']) {
  const cls = classifyChannel(S(n), 36);
  if (cls.flangeClassFlex !== 'compact' || cls.webClassFlex !== 'compact') { fails++; console.log(`FAIL  ${n} not compact: flange ${cls.flangeClassFlex}, web ${cls.webClassFlex}`); }
}

// ── deflection (E = 29000) ──
ok('δ ss-udl (in)', channelDeflection('ss-udl', 1 / 12, 0, 240, 129).delta, (5 * (1 / 12) * 240 ** 4) / (384 * 29000 * 129), 1e-6);

// ── minor-axis flexure uses the smaller tabulated Sy ──
const fm = flexureChannelMinor(c15, 36);
if (fm.phiMn <= 0) { fails++; console.log('FAIL  minor flexure zero'); }

// ── E7 slender-web reduction (adversarial-review fix): a web-slender MC at Fy=36 ──
const slenderMC = ALL.filter((x) => classifyChannel(x, 36).webSlenderComp);
console.log(`  web-slender @Fy36: ${slenderMC.map((x) => x.designation).join(', ') || 'none'}`);
if (slenderMC.length > 0) {
  const s = slenderMC[0];
  // SHORT column (KL = 2 ft): Fcr ≈ Fy so E7 local buckling reduces Ae.
  const cpShort = compressionChannel(s, 36, 24, 24, 24);
  if (cpShort.Ae >= s.A - 1e-6) { fails++; console.log(`FAIL  ${s.designation} short-column Ae not reduced (E7): Ae=${cpShort.Ae} A=${s.A}`); }
  else console.log(`PASS  ${s.designation} E7 @2ft: Ae ${cpShort.Ae.toFixed(2)} < A ${s.A} · Fcr ${cpShort.Fcr.toFixed(1)}ksi · φPn ${cpShort.phiPn.toFixed(1)}k`);
  // Long column (low Fcr) → full effective width per E7-2 (correct, no reduction)
  const cpLong = compressionChannel(s, 36, 240, 240, 240);
  ok(`${s.designation} Ae = A when Fcr low (E7-2)`, cpLong.Ae, s.A, 1e-6);
  // Nonslender web (C15×33.9) → Ae = A at any length
  ok('C15×33.9 Ae = A (nonslender)', compressionChannel(c15, 36, 24, 24, 24).Ae, c15.A, 1e-6);
}

// ── H1-1 combined interaction: beam-column governs over any single ratio ──
const bc = analyzeChannel({
  section: c12, Fy: 36, Lb: 60, Cb: 1, Mux: 30 * 12, Muy: 0, Vu: 10, Pu: 40,
  Lcx: 120, Lcy: 120, Lcz: 120, deflCase: 'ss-udl', wService: 0, Pservice: 0, Lspan: 180, deflDen: 360,
});
const h1expect = bc.comprUtil >= 0.2 ? bc.comprUtil + (8 / 9) * bc.flexUtil : bc.comprUtil / 2 + bc.flexUtil;
ok('H1-1 interaction value', bc.h1Util, h1expect, 1e-6);
if (bc.h1Util <= Math.max(bc.flexUtil, bc.comprUtil)) { fails++; console.log('FAIL  H1 should exceed the individual ratios'); }
else console.log(`PASS  H1 ${bc.h1Eq} = ${bc.h1Util.toFixed(2)} > max(flex ${bc.flexUtil.toFixed(2)}, compr ${bc.comprUtil.toFixed(2)})`);

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
