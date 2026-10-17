import { writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 120_000 });
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { cablePage } from '@/lib/calc/cable/page-strings';
import { cableUi } from '@/lib/calc/cable/strings';
import { cableSagPage } from '@/lib/calc/cable-sag/page-strings';
import { cableSagUi } from '@/lib/calc/cable-sag/strings';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { frameUi } from '@/lib/calc/frame/strings';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { shaftUi } from '@/lib/calc/shaft/strings';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { trussUi } from '@/lib/calc/truss/strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import type { Lang } from '@/lib/ttc/i18n';
import * as framePageModule from '@/lib/calc/frame/page-strings';

const LANGS: Lang[] = ['en', 'es'];
const leaves = (value: unknown, path = ''): [string, string][] => {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
};
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const sharedRuns = (a: string, b: string) => {
  const there = ` ${words(b).join(' ')} `;
  const mine = words(a);
  return mine.map((_, i) => mine.slice(i, i + 6)).filter((run) => run.length === 6 && there.includes(` ${run.join(' ')} `)).map((run) => run.join(' '));
};

describe('the frame form’s words say nothing another text of the site already says, six words running', () => {
  const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href);
  it('against the other calculators, their pages and the catalogue', () => {
    const clashes: string[] = [];
    for (const lang of LANGS) {
      const sets: unknown[] = [beamStrings[lang], spanUi[lang], spanPage[lang], continuousUi[lang], continuousPage[lang], shaftUi[lang], shaftPage[lang], trussUi[lang], trussPage[lang], cableUi[lang], cablePage[lang], cableSagUi[lang], cableSagPage[lang]];
      const theirs = sets.flatMap((set) => leaves(set).map(([, s]) => s)).concat(rows.map((r) => r.does[lang])).join(' . ');
      for (const [path, s] of leaves(frameUi[lang])) {
        const runs = sharedRuns(s, theirs);
        if (runs.length) clashes.push(`${lang} ${path}: “${runs[0]}” (${runs.length})`);
      }
    }
    if (process.env.DUMP) writeFileSync(process.env.DUMP, clashes.join(String.fromCharCode(10)));
    expect(clashes).toEqual([]);
  });
  it('and against the frame’s own page, when it is there', () => {
    const page = (framePageModule as Record<string, unknown>).framePage as Record<Lang, unknown> | undefined;
    if (!page) return;
    const clashes: string[] = [];
    for (const lang of LANGS) {
      const theirs = leaves(page[lang]).map(([, s]) => s).join(' . ');
      for (const [path, s] of leaves(frameUi[lang])) {
        const runs = sharedRuns(s, theirs);
        if (runs.length) clashes.push(`${lang} ${path}: “${runs[0]}” (${runs.length})`);
      }
    }
    expect(clashes).toEqual([]);
  });
  it('names no vendor and no design code, and says once that there is no design check', () => {
    const vendors = /\b(AISC|ASCE|ACI|Eurocode|SAP|RISA|STAAD|ETABS|SkyCiv|Robot|Autodesk|Revit|LRFD|ASD)\b/i;
    for (const lang of LANGS) for (const [path, s] of leaves(frameUi[lang])) expect(s, `${lang} ${path}`).not.toMatch(vendors);
    expect(frameUi.en.results.method).toContain('no design check');
    expect(frameUi.es.results.method).toContain('ninguna comprobación de diseño');
  });
  it('uses a true minus in Spanish and English sentences about signs, and no “1 turns”-style plural slips', () => {
    for (const lang of LANGS) for (const [path, s] of leaves(frameUi[lang])) expect(s, `${lang} ${path}`).not.toMatch(/\b1 (nodes|members|supports|loads|nudos|barras|apoyos|cargas)\b/);
  });
});
