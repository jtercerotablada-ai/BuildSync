// Foundation Design — preset textbook examples
// ----------------------------------------------------
// Wight & MacGregor 7e Ch 15 + ACI SP-17(14) common spread footings.

import type { FootingInput } from './types';

export interface FootingPreset {
  label: string;
  description: string;
  build: () => FootingInput;
}

export const FOOTING_PRESETS: FootingPreset[] = [
  {
    label: 'Light — 1.6 × 1.6 × 0.35 m, 400×400 col, PD=200 PL=150 kN',
    description: 'Small interior footing, ~150 kPa soil. Wight Ch 15 light example.',
    build: () => ({
      code: 'ACI 318-25',
      geometry: {
        B: 1600, L: 1600, T: 350, coverClear: 75,
        columnShape: 'square', cx: 400, cy: 400,
      },
      soil: { qa: 150, gammaSoil: 18, gammaConcrete: 24 },
      materials: { fc: 28, fy: 420, lambdaC: 1.0 },
      loads: { PD: 200, PL: 150 },
      reinforcement: {
        bottomX: { bar: '#5', count: 8 },
        bottomY: { bar: '#5', count: 8 },
      },
    }),
  },
  {
    label: 'Medium — 2.5 × 2.5 × 0.50 m, 500×500 col, PD=600 PL=400 kN',
    description: 'Typical interior footing, fc=28, fy=420, qa=200 kPa.',
    build: () => ({
      code: 'ACI 318-25',
      geometry: {
        B: 2500, L: 2500, T: 500, coverClear: 75,
        columnShape: 'square', cx: 500, cy: 500,
      },
      soil: { qa: 200, gammaSoil: 18, gammaConcrete: 24 },
      materials: { fc: 28, fy: 420, lambdaC: 1.0 },
      loads: { PD: 600, PL: 400 },
      reinforcement: {
        bottomX: { bar: '#7', count: 10 },
        bottomY: { bar: '#7', count: 10 },
      },
    }),
  },
  {
    label: 'Heavy — 4.0 × 4.0 × 0.85 m, 600×600 col, PD=2000 PL=1500 kN',
    description: 'Heavy column, fc=35, qa=250 kPa, large footing with thick depth.',
    build: () => ({
      code: 'ACI 318-25',
      geometry: {
        B: 4000, L: 4000, T: 850, coverClear: 75,
        columnShape: 'square', cx: 600, cy: 600,
      },
      soil: { qa: 250, gammaSoil: 18, gammaConcrete: 24 },
      materials: { fc: 35, fy: 420, lambdaC: 1.0 },
      loads: { PD: 2000, PL: 1500 },
      reinforcement: {
        bottomX: { bar: '#9', count: 14 },
        bottomY: { bar: '#9', count: 14 },
      },
    }),
  },
  {
    label: 'Rectangular — 2.0 × 3.5 × 0.55 m, 300×600 col, PD=600 PL=450 kN',
    description: 'Property-line constrained footing, rectangular column 300×600.',
    build: () => ({
      code: 'ACI 318-25',
      geometry: {
        B: 2000, L: 3500, T: 550, coverClear: 75,
        columnShape: 'rectangular', cx: 300, cy: 600,
      },
      soil: { qa: 200, gammaSoil: 18, gammaConcrete: 24 },
      materials: { fc: 28, fy: 420, lambdaC: 1.0 },
      loads: { PD: 600, PL: 450 },
      reinforcement: {
        bottomX: { bar: '#7', count: 14 },
        bottomY: { bar: '#7', count: 8 },
      },
    }),
  },
  {
    label: 'Circular column — 3.0 × 3.0 × 0.60 m, Ø500 col, PD=800 PL=600 kN',
    description: 'Round column on square footing.',
    build: () => ({
      code: 'ACI 318-25',
      geometry: {
        B: 3000, L: 3000, T: 600, coverClear: 75,
        columnShape: 'circular', cx: 500,
      },
      soil: { qa: 200, gammaSoil: 18, gammaConcrete: 24 },
      materials: { fc: 28, fy: 420, lambdaC: 1.0 },
      loads: { PD: 800, PL: 600 },
      reinforcement: {
        bottomX: { bar: '#7', count: 12 },
        bottomY: { bar: '#7', count: 12 },
      },
    }),
  },
  {
    label: 'Eccentric — 3.0 × 3.0 × 0.60 m, ex=200 mm, Mx=80 kN·m',
    description: 'Eccentric column with moment, within kern. Tests trapezoidal pressure.',
    build: () => ({
      code: 'ACI 318-25',
      geometry: {
        B: 3000, L: 3000, T: 600, coverClear: 75,
        columnShape: 'square', cx: 400, cy: 400, ex: 200,
      },
      soil: { qa: 200, gammaSoil: 18, gammaConcrete: 24 },
      materials: { fc: 28, fy: 420, lambdaC: 1.0 },
      loads: { PD: 500, PL: 350, Mx: 80 },
      H: 100, frictionMu: 0.45,
      reinforcement: {
        bottomX: { bar: '#7', count: 10 },
        bottomY: { bar: '#7', count: 10 },
      },
    }),
  },
];
