import { solve } from '../src/lib/beam/solver';
import { toSI, fromSI } from '../src/lib/beam/units';
import type { BeamModel } from '../src/lib/beam/types';

// Exactly what Juan showed: fixed-fixed, L=30 ft, UDL = 10 kip/ft.
// User enters in imperial; we convert to SI for the solver.
const L_imp = 30;            // ft
const w_imp = 10;            // kip/ft

const L_si = toSI(L_imp, 'length', 'imperial');
const w_si = toSI(w_imp, 'distLoad', 'imperial');

console.log(`Input (imperial): L=${L_imp} ft,  w=${w_imp} kip/ft`);
console.log(`Converted to SI:  L=${L_si.toFixed(6)} m,  w=${w_si.toFixed(6)} kN/m`);

const model: BeamModel = {
  length: L_si,
  section: { material: 'steel', E: 200000, I: 1.12e8, A: undefined, label: '' },
  supports: [
    { id: 's1', type: 'fixed', position: 0 },
    { id: 's2', type: 'fixed', position: L_si },
  ],
  loads: [
    {
      id: 'l1',
      type: 'distributed',
      startPosition: 0,
      endPosition: L_si,
      startMagnitude: w_si,
      endMagnitude: w_si,
      direction: 'down',
      loadCase: 'dead',
    },
  ],
  moments: [],
  selfWeight: false,
  density: 7850,
};

const r = solve(model);

console.log('\n--- RESULTS (SI) ---');
for (const rx of r.reactions) {
  console.log(`  ${rx.type} @ x=${rx.position.toFixed(3)} m:  V = ${rx.V.toFixed(3)} kN,  M = ${rx.M.toFixed(3)} kN·m`);
}

console.log('\n--- RESULTS (IMPERIAL display) ---');
for (const rx of r.reactions) {
  const xFt = fromSI(rx.position, 'position', 'imperial');
  const Vkip = fromSI(rx.V, 'force', 'imperial');
  const Mkipft = fromSI(rx.M, 'moment', 'imperial');
  console.log(`  ${rx.type} @ x=${xFt.toFixed(3)} ft:  V = ${Vkip.toFixed(3)} kip,  M = ${Mkipft.toFixed(3)} kip·ft`);
}

console.log('\n--- ANALYTICAL EXPECTED (fixed-fixed + UDL) ---');
console.log(`  R = wL/2 = ${w_imp}·${L_imp}/2 = ${(w_imp * L_imp) / 2} kip per support`);
console.log(`  M_end = ±wL²/12 = ±${((w_imp * L_imp * L_imp) / 12).toFixed(3)} kip·ft`);
console.log(`  M_mid = +wL²/24 = +${((w_imp * L_imp * L_imp) / 24).toFixed(3)} kip·ft`);

const maxM_kipft = fromSI(r.maxMoment.value, 'moment', 'imperial');
const minM_kipft = fromSI(r.minMoment.value, 'moment', 'imperial');
console.log(`\n--- SOLVER EXTREMES (IMPERIAL) ---`);
console.log(`  Max moment M⁺ = ${maxM_kipft.toFixed(3)} kip·ft @ x=${fromSI(r.maxMoment.position, 'position', 'imperial').toFixed(3)} ft`);
console.log(`  Min moment M⁻ = ${minM_kipft.toFixed(3)} kip·ft @ x=${fromSI(r.minMoment.position, 'position', 'imperial').toFixed(3)} ft`);
