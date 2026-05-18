import database from './international-database.json';
import { computeTemplate } from './compute-template';
import type { SectionProperties, TemplateParams } from './types';

export type IntlStandard = 'EN' | 'BS';

export type IntlFamily =
  | 'IPE'
  | 'HEA'
  | 'HEB'
  | 'HEM'
  | 'UPN'
  | 'UB'
  | 'UC'
  | 'CHS-EN'
  | 'SHS-EN'
  | 'RHS-EN';

export interface IntlEntry {
  designation: string;
  family: IntlFamily;
  kind: 'i-shape' | 'channel' | 'hollow-circ' | 'hollow-rect';
  // Dimensions (mm) — presence depends on kind
  H?: number;
  B?: number;
  tw?: number;
  tf?: number;
  D?: number;
  t?: number;
  weight: number; // kg/m (catalog-official)
}

export const INTL_FAMILIES: Array<{
  id: IntlFamily;
  label: string;
  description: string;
  standard: IntlStandard;
}> = [
  { id: 'IPE',    label: 'IPE — European I',       description: 'European I-beams (EN 10365)',    standard: 'EN' },
  { id: 'HEA',    label: 'HEA — H Light',          description: 'European H-beams, light series', standard: 'EN' },
  { id: 'HEB',    label: 'HEB — H Medium',         description: 'European H-beams, std series',   standard: 'EN' },
  { id: 'HEM',    label: 'HEM — H Heavy',          description: 'European H-beams, heavy series', standard: 'EN' },
  { id: 'UPN',    label: 'UPN — Channel',          description: 'European channels (DIN 1026)',   standard: 'EN' },
  { id: 'CHS-EN', label: 'CHS — Round Hollow',     description: 'EN circular hollow sections',    standard: 'EN' },
  { id: 'SHS-EN', label: 'SHS — Square Hollow',    description: 'EN square hollow sections',      standard: 'EN' },
  { id: 'RHS-EN', label: 'RHS — Rect Hollow',      description: 'EN rectangular hollow sections', standard: 'EN' },
  { id: 'UB',     label: 'UB — Universal Beam',    description: 'British universal beams',        standard: 'BS' },
  { id: 'UC',     label: 'UC — Universal Column',  description: 'British universal columns',      standard: 'BS' },
];

const entries: IntlEntry[] = (database.shapes as IntlEntry[]).slice();

export function getAllIntl(): IntlEntry[] {
  return entries;
}

export function getIntlFamiliesForStandard(standard: IntlStandard): IntlFamily[] {
  return INTL_FAMILIES.filter((f) => f.standard === standard).map((f) => f.id);
}

export function searchIntl(
  query: string,
  family?: IntlFamily,
  standard?: IntlStandard,
  limit = 40
): IntlEntry[] {
  const q = query.trim().toUpperCase().replace(/\s+/g, '');
  const standardFamilies = standard ? new Set(getIntlFamiliesForStandard(standard)) : null;
  const filtered = entries.filter((e) => {
    if (family && e.family !== family) return false;
    if (standardFamilies && !standardFamilies.has(e.family)) return false;
    return true;
  });
  if (!q) return filtered.slice(0, limit);
  const scored = filtered.map((e) => {
    const des = e.designation.toUpperCase().replace(/\s+/g, '').replace(/×/g, 'X');
    if (des === q) return { e, rank: 0 };
    if (des.startsWith(q)) return { e, rank: 1 };
    if (des.includes(q)) return { e, rank: 2 };
    return { e, rank: 99 };
  });
  return scored
    .filter((s) => s.rank < 99)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((s) => s.e);
}

export function findIntl(designation: string): IntlEntry | null {
  const q = designation.trim().toUpperCase().replace(/\s+/g, '').replace(/×/g, 'X');
  return (
    entries.find(
      (e) => e.designation.toUpperCase().replace(/\s+/g, '').replace(/×/g, 'X') === q
    ) ?? null
  );
}

// Convert an IntlEntry to TemplateParams and dispatch to computeTemplate.
export function intlToTemplateParams(e: IntlEntry): TemplateParams {
  switch (e.kind) {
    case 'i-shape':
      return { kind: 'i-shape', H: e.H!, B: e.B!, tw: e.tw!, tf: e.tf! };
    case 'channel':
      return { kind: 'channel', H: e.H!, B: e.B!, tw: e.tw!, tf: e.tf! };
    case 'hollow-circ':
      return { kind: 'hollow-circ', D: e.D!, d: e.D! - 2 * e.t! };
    case 'hollow-rect':
      return { kind: 'hollow-rect', B: e.B!, H: e.H!, tw: e.t!, tf: e.t! };
  }
}

export function intlToSectionProperties(e: IntlEntry): SectionProperties {
  return computeTemplate(intlToTemplateParams(e));
}
