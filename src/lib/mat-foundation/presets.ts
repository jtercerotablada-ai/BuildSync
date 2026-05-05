// Mat Foundation — preset library

import type { MatFoundationInput } from './types';

export interface MatFoundationPreset {
  label: string;
  description: string;
  build: () => MatFoundationInput;
}

export const MAT_FOUNDATION_PRESETS: MatFoundationPreset[] = [
  {
    label: '4-column symmetric (12 × 12 m)',
    description: 'Square mat, 4 equal columns at corners of 8 m grid — uniform pressure',
    build: () => ({
      code: 'ACI 318-25',
      columns: [
        { id: 'C1', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x:  2000, y:  2000 },
        { id: 'C2', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x: 10000, y:  2000 },
        { id: 'C3', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x:  2000, y: 10000 },
        { id: 'C4', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x: 10000, y: 10000 },
      ],
      geometry: { B: 12000, L: 12000, T: 800, coverClear: 75, embedment: 500 },
      soil: { qa: 200, gammaSoil: 18, gammaConcrete: 24 },
      materials: { fc: 25, fy: 420, lambdaC: 1.0 },
      reinforcement: {
        topX:    { bar: '#5', spacing: 200 },
        topY:    { bar: '#5', spacing: 200 },
        bottomX: { bar: '#5', spacing: 200 },
        bottomY: { bar: '#5', spacing: 200 },
      },
    }),
  },
  {
    label: '6-column tower (15 × 10 m)',
    description: 'Rectangular mat, 6 columns in 3×2 grid, heavy interior loads',
    build: () => ({
      code: 'ACI 318-25',
      columns: [
        { id: 'A1', cx: 600, cy: 600, shape: 'square', PD: 2000, PL: 1500, x: 2500,  y: 2000 },
        { id: 'A2', cx: 600, cy: 600, shape: 'square', PD: 2500, PL: 2000, x: 7500,  y: 2000 },
        { id: 'A3', cx: 600, cy: 600, shape: 'square', PD: 2000, PL: 1500, x: 12500, y: 2000 },
        { id: 'B1', cx: 600, cy: 600, shape: 'square', PD: 2000, PL: 1500, x: 2500,  y: 8000 },
        { id: 'B2', cx: 600, cy: 600, shape: 'square', PD: 2500, PL: 2000, x: 7500,  y: 8000 },
        { id: 'B3', cx: 600, cy: 600, shape: 'square', PD: 2000, PL: 1500, x: 12500, y: 8000 },
      ],
      geometry: { B: 15000, L: 10000, T: 1000, coverClear: 75, embedment: 800 },
      soil: { qa: 250, gammaSoil: 19, gammaConcrete: 24 },
      materials: { fc: 28, fy: 420, lambdaC: 1.0 },
      reinforcement: {
        topX:    { bar: '#7', spacing: 150 },
        topY:    { bar: '#7', spacing: 150 },
        bottomX: { bar: '#7', spacing: 150 },
        bottomY: { bar: '#7', spacing: 150 },
      },
    }),
  },
  {
    label: 'Soft-soil mat (low qa = 100 kPa)',
    description: '4-column mat on weak soil — sized for low bearing capacity',
    build: () => ({
      code: 'ACI 318-25',
      columns: [
        { id: 'C1', cx: 400, cy: 400, shape: 'square', PD: 800, PL: 600, x:  3000, y:  3000 },
        { id: 'C2', cx: 400, cy: 400, shape: 'square', PD: 800, PL: 600, x: 11000, y:  3000 },
        { id: 'C3', cx: 400, cy: 400, shape: 'square', PD: 800, PL: 600, x:  3000, y: 11000 },
        { id: 'C4', cx: 400, cy: 400, shape: 'square', PD: 800, PL: 600, x: 11000, y: 11000 },
      ],
      geometry: { B: 14000, L: 14000, T: 700, coverClear: 75, embedment: 600 },
      soil: { qa: 100, gammaSoil: 17, gammaConcrete: 24 },
      materials: { fc: 25, fy: 420, lambdaC: 1.0 },
      reinforcement: {
        topX:    { bar: '#5', spacing: 200 },
        topY:    { bar: '#5', spacing: 200 },
        bottomX: { bar: '#5', spacing: 200 },
        bottomY: { bar: '#5', spacing: 200 },
      },
    }),
  },
];
