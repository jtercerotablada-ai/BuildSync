/**
 * ACI 318-19 shear wall solver — validation self-tests.
 * Run: node src/lib/concrete/aciShearWall.selftest.ts
 * Targets: ACI 318-19 clause arithmetic (exact), PCA Notes / StructurePoint
 * methodology, and a hand-computed P-M point.
 */
import {
  inplaneShear, alphaC, beta1, phiFromEps, interaction, momentCapacityAt,
  simplifiedAxial, minReinforcement, boundaryElement,
} from './aciShearWall.ts';

let pass = 0, fail = 0;
const chk = (name: string, got: number, want: number, tolPct: number, unit = '') => {
  const ok = Math.abs(got - want) / Math.abs(want || 1) <= tolPct / 100;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} got ${got.toFixed(2)} ${unit}  want ~${want} ${unit}`);
  ok ? pass++ : fail++;
};
const chkEq = (name: string, got: unknown, want: unknown) => { const ok = got === want; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} got ${String(got)}  want ${String(want)}`); ok ? pass++ : fail++; };
const kip = (lb: number) => lb / 1000;
const kipft = (lbin: number) => lbin / 12000;

// ── 1. in-plane shear (§11.5.4) ───────────────────────────────────────────
const slender = inplaneShear({ lw: 240, h: 12, fc: 4000, fy: 60000, rho_t: 0.0025, hw_lw: 2.0, lambda: 1, special: false });
chk('αc @ hw/lw=2.0', slender.alpha_c, 2.0, 0.1);
chk('Vn slender (αc=2.0)', kip(slender.Vn), 796, 1, 'k');
chk('φVn slender', kip(slender.phiVn), 597, 1, 'k');
const squat = inplaneShear({ lw: 240, h: 12, fc: 4000, fy: 60000, rho_t: 0.0025, hw_lw: 1.0, lambda: 1, special: false });
chk('Vn squat (αc=3.0)', kip(squat.Vn), 978, 1, 'k');
chk('φVn squat', kip(squat.phiVn), 734, 1, 'k');
chk('αc interp @ hw/lw=1.75', alphaC(1.75), 2.5, 0.1);
chk('shear cap 10√f′c·Acv', kip(slender.Vn_cap), 1822, 1, 'k');
const special = inplaneShear({ lw: 240, h: 12, fc: 5000, fy: 60000, rho_t: 0.0025, hw_lw: 6, lambda: 1, special: true });
chk('special Vn (§18.10.4)', kip(special.Vn), 839, 1, 'k');
chk('special cap 8√f′c·Acv', kip(special.Vn_cap), 1629, 1, 'k');

// ── 2. β1 & φ transitions ─────────────────────────────────────────────────
chk('β1 @ f′c=5000', beta1(5000), 0.80, 0.5);
chk('φ @ εt=εty (0.00207)', phiFromEps(0.00207, 60000), 0.65, 0.5);
chk('φ @ εt=0.00507 (TC onset)', phiFromEps(0.00507, 60000), 0.90, 0.5);
chk('φ @ εt=0.00357 (mid)', phiFromEps(0.00357, 60000), 0.775, 1);
// c/dt anchors
const ety = 60000 / 29e6;
chk('cb/dt balanced', 0.003 / (0.003 + ety), 0.592, 1);
chk('c/dt @ φ=0.90 onset', 0.003 / (0.003 + ety + 0.003), 0.372, 1);

// ── 3. P-M interaction — pure axial cap ────────────────────────────────────
const iAx = interaction(240, 12, 4000, 60000, { rho_l: 0.0025, nLayers: 20, AsBoundary: 0, dBoundary: 0 });
chk('Ast (ρl=0.0025)', iAx.Ast, 7.2, 0.5, 'in²');
chk('Po', kip(iAx.Po), 10199.5, 0.5, 'k');
chk('φPn,max (0.65·0.80·Po)', kip(iAx.phiPnMax), 5304, 0.5, 'k');

// ── 4. P-M point — hand-computed (boundary-only steel, c=60 in) ────────────
const iBnd = interaction(240, 12, 4000, 60000, { rho_l: 0, nLayers: 2, AsBoundary: 5.0, dBoundary: 6 });
const p60 = iBnd.points.find((p) => Math.abs(p.c - 60) < 0.6)!;
chk('P-M @ c=60 Pn', kip(p60.Pn), 2063.8, 1, 'k');
chk('P-M @ c=60 Mn', kipft(p60.Mn), 21924.8, 1, 'k·ft');
chk('P-M @ c=60 φ (tension-ctrl)', p60.phi, 0.90, 1);

// ── 4b. momentCapacityAt accuracy (adversarial-review regression) ─────────
const iReg = interaction(240, 12, 4000, 60000, { rho_l: 0.0025, nLayers: 20, AsBoundary: 4, dBoundary: 6 });
chk('φMn at axial-cap corner (Pu≈φPnMax)', kipft(momentCapacityAt(iReg, 5538 * 1000)), 11244, 2, 'k·ft'); // was ~10% low pre-fix
chk('φMn near φ-transition kink', kipft(momentCapacityAt(iReg, 3156 * 1000)), 19813, 1, 'k·ft'); // was ~1.8% high pre-fix

// ── 5. simplified axial (§11.5.3) ─────────────────────────────────────────
const sa = simplifiedAxial(144, 8, 4000, 144, 0.8);
chk('simplified Pn', kip(sa.Pn), 2022, 1, 'k');
chk('simplified φPn', kip(sa.phiPn), 1314, 1, 'k');

// ── 6. min reinforcement & detailing (§11.6/§11.7) ────────────────────────
const mr = minReinforcement({ lw: 120, h: 12, fc: 4000, fy: 60000, lambda: 1, Vu: 300000, phiVc: 100000, hw_lw: 1.0, rho_t: 0.0030, barNo5OrSmaller: true, special: false });
chk('min ρl (Eq.11.6.2 squat, ρt=0.0030)', mr.rho_l_min, 0.002875, 1);
chkEq('two curtains (h=12 > 10)', mr.twoCurtains, true);
const twoCurtainThresh = 2 * 1 * Math.sqrt(4000) * (12 * 120);
chk('two-curtain threshold 2λ√f′c·Acv', kip(twoCurtainThresh), 182, 1, 'k');
chk('max spacing min(3h,18)', mr.spacingMax, 18, 0.1, 'in');

// ── 7. special boundary elements (§18.10.6) ───────────────────────────────
const be = boundaryElement({ lw: 240, h: 12, fc: 5000, c: 40, Pu: 400000, Mu: 102_000_000, deltaU: 12, hw: 1440 });
chk('SBE c-limit (δu/hw=0.00833)', be.cLimit, 32.0, 1, 'in');
chk('SBE σ (gross elastic)', be.sigma, 1024, 1, 'psi');
chkEq('SBE required by stress (>0.2f′c)', be.requiredByStress, true);
chk('SBE extent max(c-0.1lw, c/2)', be.extent!, 20, 1, 'in');
const beFloor = boundaryElement({ lw: 240, h: 12, fc: 5000, c: 40, Pu: 400000, Mu: 102_000_000, deltaU: 4.32, hw: 1440 });
chk('SBE c-limit floored (δu/hw<0.005)', beFloor.cLimit, 53.3, 1, 'in');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
