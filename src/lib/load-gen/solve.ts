import type { LoadGenInput, SiteData, StructureData, WindResult } from './types';
import { solveAsce722Wind } from './asce7-22-wind';
import { lookupWindSpeedMs } from './asce7-22-wind-speed-data';

export function solveLoadGen(input: LoadGenInput): WindResult | null {
  if (input.code !== 'ASCE-7-22') return null; // MVP only ASCE 7-22
  return solveAsce722Wind(input.site, input.structure);
}

export const DEFAULT_SITE: SiteData = {
  location: null,
  riskCategory: 'II',
  exposure: 'C',
  siteClass: 'Default',
  V: 170 * 0.44704, // mph → m/s, Miami / South-Florida ASCE 7-22 default
  V_source: 'manual',
};

export const DEFAULT_STRUCTURE: StructureData = {
  H: 30 * 304.8,   // 30 ft → mm
  L: 60 * 304.8,   // 60 ft → mm
  B: 40 * 304.8,   // 40 ft → mm
  roofType: 'flat',
  roofSlope: 0,
  enclosure: 'enclosed',
  Kd: 0.85,
  Kzt: 1.0,
};

export const DEFAULT_INPUT: LoadGenInput = {
  code: 'ASCE-7-22',
  site: DEFAULT_SITE,
  structure: DEFAULT_STRUCTURE,
};

export { lookupWindSpeedMs, solveAsce722Wind };
