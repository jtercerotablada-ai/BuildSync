/**
 * ACI 318-19 column solver — validation self-tests.
 * Run: node src/lib/concrete/aciColumn.selftest.ts
 * Targets: ACI 318-19 hand calcs + StructurePoint biaxial example.
 */
import {
  interactionAxis, momentCapacityAt, axialAtMoment, biaxial, slenderness, detailing,
  rectBars, circBars, grossArea, grossI, Ec, phiCol, circSegment,
  type ColSection, type BarPt,
} from './aciColumn.ts';

let pass = 0, fail = 0;
const chk = (name: string, got: number, want: number, tolPct: number, unit = '') => {
  const ok = Math.abs(got - want) / Math.abs(want || 1) <= tolPct / 100;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} got ${got.toFixed(2)} ${unit}  want ~${want} ${unit}`);
  ok ? pass++ : fail++;
};
const chkEq = (name: string, got: unknown, want: unknown) => { const ok = got === want; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} got ${String(got)}  want ${String(want)}`); ok ? pass++ : fail++; };
const kipft = (kipin: number) => kipin / 12;

// ── Column A: 20×20 tied, f'c=5, fy=60, 8-#9 (3/2/3 @ 2.5/10/17.5) ─────────
const secA: ColSection = { kind: 'rect', b: 20, h: 20 };
const barsA = rectBars(20, 20, 2.5, 1.0, 3, 3);
chkEq('Column A bar count', barsA.length, 8);
const iA = interactionAxis(secA, barsA, 5, 60, 'x', false);
chk('A Po', iA.Po, 2146, 0.3, 'k');
chk('A Pn,max (0.80Po)', iA.PnMax, 1716.8, 0.3, 'k');
chk('A φPn,max (0.65·0.80·Po)', iA.phiPnMax, 1116, 0.5, 'k');
// balanced point (εt = εty)
const ety = 60 / 29000;
const balA = iA.points.reduce((a, b) => (Math.abs(b.epsT - ety) < Math.abs(a.epsT - ety) ? b : a));
chk('A balanced Pn', balA.Pn, 698, 1, 'k');
chk('A balanced Mn', kipft(balA.Mn), 560.7, 1, 'k·ft');
// compression-controlled point c=15
const ccA = iA.points.reduce((a, b) => (Math.abs(b.c - 15) < Math.abs(a.c - 15) ? b : a));
chk('A comp-ctrl (c=15) Pn', ccA.Pn, 1193, 1, 'k');
chk('A comp-ctrl (c=15) Mn', kipft(ccA.Mn), 471.7, 1, 'k·ft');
chk('A comp-ctrl (c=15) φ', ccA.phi, 0.65, 1);

// ── Column B biaxial: Bresler reciprocal arithmetic ───────────────────────
const PnBres = 1 / (1 / 2241 + 1 / 2579.5 - 1 / 2795.9);
chk('B Bresler Pn (recip)', PnBres, 2099.8, 0.5, 'k');
chk('B Bresler φPn', 0.65 * PnBres, 1365, 0.5, 'k');

// ── Column B end-to-end biaxial (StructurePoint 24×24, 4-#11, f'c=5) ───────
const secB: ColSection = { kind: 'rect', b: 24, h: 24 };
const barsB = rectBars(24, 24, 2.5, 1.56, 2, 2); // 4-#11 corners
const iBx = interactionAxis(secB, barsB, 5, 60, 'x', false);
const iBy = interactionAxis(secB, barsB, 5, 60, 'y', false);
chk('B Po (uncapped)', iBx.Po, 2795.9, 0.5, 'k');
chk('B Pnx0 = axialAtMoment(Mnx=461.5)', axialAtMoment(iBx, 461.5 * 12), 2241, 2, 'k'); // uncapped; exceeds 0.8Po=2236.7
const bxB = biaxial(iBx, iBy, 5, 576, 1300, 461.5 * 0.65 * 12, 192.3 * 0.65 * 12, false);
chkEq('B method = Bresler', bxB.method, 'Bresler reciprocal');
chk('B end-to-end Bresler φPn', bxB.phiPn!, 1365, 3, 'k');

// ── Column C slenderness: 16×16, f'c=4, k=1, lu=240, Pu=300, M1=70,M2=100 ──
const secC: ColSection = { kind: 'rect', b: 16, h: 16 };
const sl = slenderness({ section: secC, axis: 'x', k: 1.0, lu: 240, Pu: 300, M1: 70 * 12, M2: 100 * 12, fc: 4, betaDns: 0.6, transverseLoad: false });
chk('C r (0.30h)', sl.r, 4.8, 0.5, 'in');
chk('C klu/r', sl.klu_r, 50.0, 0.5);
chk('C neglect limit 34-12(M1/M2)', sl.neglectLimit, 25.6, 1);
chkEq('C is slender', sl.slender, true);
chk('C Pc', sl.Pc, 843, 1.5, 'k');
chk('C Cm', sl.Cm, 0.88, 1);
chk('C δns', sl.deltaNs, 1.674, 1.5);
chk('C M2,min', kipft(sl.M2min), 27.0, 1, 'k·ft');
chk('C Mc (magnified)', kipft(sl.Mc), 167.4, 1.5, 'k·ft');

// ── materials & geometry ──────────────────────────────────────────────────
chk('Ec (f′c=4)', Ec(4), 3605, 0.5, 'ksi');
chk('Ec (f′c=5)', Ec(5), 4031, 0.5, 'ksi');
chk('Ig 24×24', grossI({ kind: 'rect', b: 24, h: 24 }, 'x'), 27648, 0.5, 'in⁴');
chk('r 24×24 (√(Ig/Ag))', Math.sqrt(grossI({ kind: 'rect', b: 24, h: 24 }, 'x') / grossArea({ kind: 'rect', b: 24, h: 24 })), 6.928, 0.5, 'in');

// ── detailing: 20×20 Ast limits; circular spiral ρs,min; tie spacing ──────
const det = detailing({ section: secA, Ast: 8.0, nBars: 8, spiral: false, longBarDia: 1.128, tieBarDia: 0.375, cover: 1.5, fc: 5, fyt: 60 });
chk('detail Ast,min (0.01Ag)', det.AstMin, 4.0, 0.5, 'in²');
chk('detail Ast,max (0.08Ag)', det.AstMax, 32.0, 0.5, 'in²');
chkEq('detail min bars (tied)', det.minBars, 4);
const detSp = detailing({ section: { kind: 'circ', D: 24 }, Ast: 8.0, nBars: 8, spiral: true, longBarDia: 1.0, tieBarDia: 0.375, cover: 1.5, fc: 4, fyt: 60 });
chk('spiral ρs,min (§25.7.3.3)', detSp.spiralRhoMin!, 0.00918, 1);
const detTie = detailing({ section: secA, Ast: 8.0, nBars: 8, spiral: false, longBarDia: 1.0, tieBarDia: 0.375, cover: 1.5, fc: 5, fyt: 60 });
chk('tie spacing min(16db,48dt,dim)', detTie.tieSpacing, 16, 0.5, 'in');

// ── circular column: Whitney segment + spiral interaction ─────────────────
const seg = circSegment(24, 10);
chk('circular segment area (D=24,a=10)', seg.area, 178.42, 0.5, 'in²');
chk('circular segment centroid from fiber', seg.centroidFromFiber, 5.811, 0.5, 'in');
const segHalf = circSegment(24, 12); // a = R → exact semicircle
chk('circular segment = semicircle at a=R', segHalf.area, Math.PI * 12 * 12 / 2, 0.5, 'in²');
const secCirc: ColSection = { kind: 'circ', D: 24 };
const barsCirc = circBars(24, 2.5, 1.0, 8); // 8-#9 ring
const iCirc = interactionAxis(secCirc, barsCirc, 5, 60, 'x', true);
chk('circ Po', iCirc.Po, 0.85 * 5 * (grossArea(secCirc) - 8) + 60 * 8, 0.5, 'k');
chk('circ Pn,max (0.85Po spiral)', iCirc.PnMax, 0.85 * iCirc.Po, 0.5, 'k');
chk('circ φPn,max (0.75·0.85·Po)', iCirc.phiPnMax, 0.75 * 0.85 * iCirc.Po, 0.5, 'k');
chkEq('circ moment capacity positive', momentCapacityAt(iCirc, 500) > 0, true);
chkEq('circ diagram no NaN', iCirc.points.every((p) => Number.isFinite(p.Pn) && Number.isFinite(p.Mn)), true);

// spiral vs tied φ transition
chk('φ spiral comp-controlled', phiCol(0.001, 60, true), 0.75, 1);
chk('φ tied comp-controlled', phiCol(0.001, 60, false), 0.65, 1);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
