// ASCE 7-22 Load Combinations — §2.3 (strength / LRFD) and §2.4 (ASD).
// 7-22 moved snow to strength level: principal 1.0S / companion 0.3S (LRFD),
// 0.7S (ASD), seismic companion 0.15S LRFD / 0.1S ASD (was 0.2S / 0.75S).
// Ev = 0.2·SDS·D and Eh = ρ·QE (§12.4.2), so the seismic combinations are
// presented with the dead-load factor resolved: (1.2 + 0.2·SDS)·D + ρ·QE ...
//
// Gravity terms (D, L, Lr, S, R) are uniform area loads the user supplies /
// the generator produced, so those combinations evaluate numerically.
// W and QE act on surfaces / as system shears — they stay symbolic.

export interface ComboInputs {
  D: number;   // dead (Pa)
  L: number;   // floor live (Pa)
  Lr: number;  // roof live (Pa)
  R: number;   // rain (Pa)
  S: number;   // governing balanced roof snow (Pa) — from the Snow tab
  SDS: number; // design short-period accel (g) — from the Seismic tab
  rho: number; // redundancy factor ρ (1.0 or 1.3)
}

export interface ComboLine {
  id: string;
  expr: string;          // human-readable combination with resolved factors
  value: number | null;  // Pa — evaluated when fully numeric (gravity), else null
  kind: 'gravity' | 'wind' | 'seismic';
}

const max3 = (a: number, b: number, c: number) => Math.max(a, b, c);

const fmtF = (f: number) => (Number.isInteger(f) ? f.toFixed(1) : String(f));

/** Pick the governing companion/principal roof-load term and describe it. */
function roofTerm(fLr: number, fS: number, fR: number, i: ComboInputs): { v: number; txt: string } {
  const vals: [number, string][] = [
    [fLr * i.Lr, `${fmtF(fLr)}Lr`],
    [fS * i.S, `${fmtF(fS)}S`],
    [fR * i.R, `${fmtF(fR)}R`],
  ];
  vals.sort((a, b) => b[0] - a[0]);
  return { v: vals[0][0], txt: vals[0][1] };
}

export function combosLRFD(i: ComboInputs): ComboLine[] {
  const evD = 0.2 * i.SDS; // Ev as a dead-load factor increment
  const c2 = roofTerm(0.5, 0.3, 0.5, i);
  const c3p = roofTerm(1.6, 1.0, 1.6, i);
  const c4 = roofTerm(0.5, 0.3, 0.5, i);
  return [
    { id: '2.3.1-1', kind: 'gravity', expr: '1.4D', value: 1.4 * i.D },
    { id: '2.3.1-2', kind: 'gravity', expr: `1.2D + 1.6L + ${c2.txt}`, value: 1.2 * i.D + 1.6 * i.L + c2.v },
    { id: '2.3.1-3a', kind: 'gravity', expr: `1.2D + ${c3p.txt} + L`, value: 1.2 * i.D + c3p.v + i.L },
    { id: '2.3.1-3b', kind: 'wind', expr: `1.2D + ${c3p.txt} + 0.5W`, value: null },
    { id: '2.3.1-4', kind: 'wind', expr: `1.2D + 1.0W + L + ${c4.txt}`, value: null },
    { id: '2.3.1-5', kind: 'wind', expr: '0.9D + 1.0W', value: null },
    { id: '2.3.6-6', kind: 'seismic', expr: `(1.2 + 0.2·SDS)D + ρQE + L + 0.15S = ${(1.2 + evD).toFixed(3)}D + ${i.rho.toFixed(1)}QE + L + 0.15S`, value: null },
    { id: '2.3.6-7', kind: 'seismic', expr: `(0.9 − 0.2·SDS)D + ρQE = ${(0.9 - evD).toFixed(3)}D + ${i.rho.toFixed(1)}QE`, value: null },
  ];
}

export function combosASD(i: ComboInputs): ComboLine[] {
  const evD = 0.2 * i.SDS;
  const c3 = { v: max3(i.Lr, 0.7 * i.S, i.R), txt: [ [i.Lr, 'Lr'], [0.7 * i.S, '0.7S'], [i.R, 'R'] ].sort((a, b) => (b[0] as number) - (a[0] as number))[0][1] as string };
  return [
    { id: '2.4.1-1', kind: 'gravity', expr: 'D', value: i.D },
    { id: '2.4.1-2', kind: 'gravity', expr: 'D + L', value: i.D + i.L },
    { id: '2.4.1-3', kind: 'gravity', expr: `D + ${c3.txt}`, value: i.D + c3.v },
    { id: '2.4.1-4', kind: 'gravity', expr: `D + 0.75L + 0.75(${c3.txt})`, value: i.D + 0.75 * i.L + 0.75 * c3.v },
    { id: '2.4.1-5', kind: 'wind', expr: 'D + 0.6W', value: null },
    { id: '2.4.1-6', kind: 'wind', expr: `D + 0.75L + 0.75(0.6W) + 0.75(${c3.txt})`, value: null },
    { id: '2.4.1-7', kind: 'wind', expr: '0.6D + 0.6W', value: null },
    { id: '2.4.5-8', kind: 'seismic', expr: `(1.0 + 0.14·SDS)D + 0.7ρQE = ${(1 + 0.7 * evD).toFixed(3)}D + ${(0.7 * i.rho).toFixed(2)}QE`, value: null },
    { id: '2.4.5-9', kind: 'seismic', expr: `(1.0 + 0.105·SDS)D + 0.525ρQE + 0.75L + 0.1S = ${(1 + 0.525 * evD).toFixed(3)}D + ${(0.525 * i.rho).toFixed(3)}QE + 0.75L + 0.1S`, value: null },
    { id: '2.4.5-10', kind: 'seismic', expr: `(0.6 − 0.14·SDS)D + 0.7ρQE = ${(0.6 - 0.7 * evD).toFixed(3)}D + ${(0.7 * i.rho).toFixed(2)}QE`, value: null },
  ];
}
