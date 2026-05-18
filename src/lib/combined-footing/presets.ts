// Combined Footing — preset library

import type { CombinedFootingInput } from './types';

export interface CombinedFootingPreset {
  label: string;
  description: string;
  build: () => CombinedFootingInput;
}

export const COMBINED_FOOTING_PRESETS: CombinedFootingPreset[] = [
  {
    label: 'Wight Ex 15-5 (textbook)',
    description: '24×16-in exterior + 24×24-in interior columns, 20-ft spacing, qa = 5 ksf',
    build: () => ({
      code: 'ACI 318-25',
      column1: {
        cl: 610, ct: 406, shape: 'rectangular',
        PD: 889.6, PL: 667.2,
        position: 203,                         // 8 in from exterior face
        columnLocation: 'edge',
      },
      column2: {
        cl: 610, ct: 610, shape: 'square',
        PD: 1334.5, PL: 1000.8,
        position: 6299,                        // 8 + 240 in
        columnLocation: 'interior',
      },
      geometry: { L: 7722, B: 2438, T: 914, coverClear: 76, embedment: 305 },
      soil: { qa: 239, gammaSoil: 19, gammaConcrete: 24 },
      materials: { fc: 20.68, fy: 413.7, lambdaC: 1.0 },
      reinforcement: {
        bottomLong: { bar: '#9', count: 14 },
        topLong: { bar: '#9', count: 14 },
        bottomTrans: { bar: '#7', count: 18 },
      },
    }),
  },
  {
    label: 'Light — two equal columns',
    description: 'Two 400×400 mm columns, 4-m spacing, light loads',
    build: () => ({
      code: 'ACI 318-25',
      column1: {
        cl: 400, ct: 400, shape: 'square',
        PD: 400, PL: 200,
        position: 200,
        columnLocation: 'edge',
      },
      column2: {
        cl: 400, ct: 400, shape: 'square',
        PD: 500, PL: 300,
        position: 4200,
        columnLocation: 'interior',
      },
      geometry: { L: 4400, B: 2000, T: 600, coverClear: 75, embedment: 300 },
      soil: { qa: 200, gammaSoil: 18, gammaConcrete: 24 },
      materials: { fc: 25, fy: 420, lambdaC: 1.0 },
      reinforcement: {
        bottomLong: { bar: '#7', count: 10 },
        topLong: { bar: '#7', count: 8 },
        bottomTrans: { bar: '#5', count: 14 },
      },
    }),
  },
  {
    label: 'Heavy — property-line case',
    description: 'Exterior column flush with property line, large interior, qa = 250 kPa',
    build: () => ({
      code: 'ACI 318-25',
      column1: {
        cl: 500, ct: 500, shape: 'square',
        PD: 1500, PL: 1000,
        position: 250,                          // column face at 0
        columnLocation: 'edge',
      },
      column2: {
        cl: 600, ct: 600, shape: 'square',
        PD: 2500, PL: 1800,
        position: 7250,                         // 7 m c-c + ext offset
        columnLocation: 'interior',
      },
      geometry: { L: 9000, B: 3000, T: 900, coverClear: 75, embedment: 400 },
      soil: { qa: 250, gammaSoil: 19, gammaConcrete: 24 },
      materials: { fc: 28, fy: 420, lambdaC: 1.0 },
      reinforcement: {
        bottomLong: { bar: '#10', count: 16 },
        topLong: { bar: '#10', count: 14 },
        bottomTrans: { bar: '#8', count: 22 },
      },
    }),
  },
];
