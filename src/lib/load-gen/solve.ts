import type {
  LoadGenInput, SiteData, StructureData, SnowData, SeismicData,
  WindResult, LoadGenResult,
} from './types';
import { solveAsce722Wind } from './asce7-22-wind';
import { solveAsce722Snow, PSF_TO_PA } from './asce7-22-snow';
import { solveAsce722Seismic } from './asce7-22-seismic';
import { lookupWindSpeedMs } from './asce7-22-wind-speed-data';

/** Legacy single-return wind entry point (kept for existing callers). */
export function solveLoadGen(input: LoadGenInput): WindResult | null {
  if (input.code !== 'ASCE-7-22') return null;
  return solveAsce722Wind(input.site, input.structure);
}

/** Combined ASCE 7-22 wind + snow + seismic solve. */
export function solveLoads(input: LoadGenInput): LoadGenResult {
  if (input.code !== 'ASCE-7-22') return { wind: null, snow: null, seismic: null };
  return {
    wind: solveAsce722Wind(input.site, input.structure),
    snow: solveAsce722Snow(input.snow, input.site.riskCategory),
    seismic: solveAsce722Seismic(input.seismic, input.site.riskCategory),
  };
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
  topo: { feature: 'none', H: 50 * 304.8, Lh: 100 * 304.8, x: 0 },
  gustMode: 'default',
  n1: 1.0,     // Hz — used only in flexible mode
  beta: 0.02,  // damping ratio
};

export const DEFAULT_SNOW: SnowData = {
  pg: 30 * PSF_TO_PA,        // 30 psf ultimate ground snow (temperate default; Florida ≈ 0)
  terrain: 'C',
  roofExposure: 'partially-exposed',
  thermal: 'heated',
  roofR: 30,                 // roof R-value for Table 7.3-3 (heated-unventilated)
  roofSlope: 0,
  slippery: false,
  eaveToRidge: 20 * 304.8,   // 20 ft → mm
  W2: 0.45,                  // Winter Wind Parameter (Fig 7.6-1 / Hazard Tool)
  drift: {
    step: false,
    luUpper: 40 * 304.8,     // upper-roof fetch
    luLower: 30 * 304.8,     // lower-roof length
    stepHeight: 4 * 304.8,   // roof step
    parapet: false,
    parapetHeight: 2.5 * 304.8,
    parapetLu: 50 * 304.8,
    sliding: false,
  },
};

export const DEFAULT_SEISMIC: SeismicData = {
  SDS: 0.9,  // g — design short-period, from ASCE 7-22 Hazard Tool
  SD1: 0.4,  // g — design 1-s
  S1: 0.5,   // g — mapped 1-s (for SDC override / near-fault floor)
  TL: 8,     // s
  R: 8,      // e.g. special steel moment frame
  systemPeriod: 'steel-moment',
  hn: 45 * 304.8,   // 45 ft → mm
  W: 2000 * 4.4482216152605, // 2000 kip → kN
  stories: 4,
  source: 'manual',
};

export const DEFAULT_INPUT: LoadGenInput = {
  code: 'ASCE-7-22',
  site: DEFAULT_SITE,
  structure: DEFAULT_STRUCTURE,
  snow: DEFAULT_SNOW,
  seismic: DEFAULT_SEISMIC,
};

export { lookupWindSpeedMs, solveAsce722Wind, solveAsce722Snow, solveAsce722Seismic };
