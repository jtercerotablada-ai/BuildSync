import type { MaterialPreset } from '../beam/types';
import { MATERIAL_PRESETS } from '../beam/types';
import { computeComposite } from './compute-composite';
import { computePolygon } from './compute-polygon';
import { computeTemplate } from './compute-template';
import type { SectionProperties, SectionSource } from './types';

export function computeSection(source: SectionSource): SectionProperties {
  if (source.type === 'template') return computeTemplate(source.params);
  if (source.type === 'polygon') return computePolygon(source.params.vertices);
  if (source.type === 'composite') return computeComposite(source.params);
  throw new Error('Database sections must be resolved via aisc-loader');
}

export function sectionWeightPerLength(A_mm2: number, material: MaterialPreset): number {
  if (material === 'custom') return 0;
  const density = MATERIAL_PRESETS[material].density;
  // A in mm², density in kg/m³: weight/length = A·density / 1e6  (kg/m)
  return (A_mm2 * density) / 1_000_000;
}

export function sectionYoungs(material: MaterialPreset, customE?: number): number {
  if (material === 'custom') return customE ?? 0;
  return MATERIAL_PRESETS[material].E;
}
