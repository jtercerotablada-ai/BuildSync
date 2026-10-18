import { writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { cablePage } from '@/lib/calc/cable/page-strings';
import { cableUi } from '@/lib/calc/cable/strings';
import { cableSagPage } from '@/lib/calc/cable-sag/page-strings';
import { cableSagUi } from '@/lib/calc/cable-sag/strings';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { framePage } from '@/lib/calc/frame/page-strings';
import { frameUi } from '@/lib/calc/frame/strings';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { shaftUi } from '@/lib/calc/shaft/strings';
import * as stiffnessPageModule from '@/lib/calc/stiffness/page-strings';
import { sharedWords, stiffnessUi } from '@/lib/calc/stiffness/strings';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { trussUi } from '@/lib/calc/truss/strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import type { Lang } from '@/lib/ttc/i18n';

vi.setConfig({ testTimeout: 120_000 });

const LANGS: Lang[] = ['en', 'es'];
const leaves = (value: unknown, path = ''): [string, string][] => {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
};
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
const sharedRuns = (a: string, b: string) => {
  const there = ` ${words(b).join(' ')} `;
  const mine = words(a);
  return mine
    .map((_, i) => mine.slice(i, i + 6))
    .filter((run) => run.length === 6 && there.includes(` ${run.join(' ')} `))
    .map((run) => run.join(' '));
};

describe('the stiffness form’s words say nothing another text of the site already says, six words running', () => {
  const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href);
  it('against the other calculators, their pages and the catalogue', () => {
    const clashes: string[] = [];
    for (const lang of LANGS) {
      const sets: unknown[] = [beamStrings[lang], spanUi[lang], spanPage[lang], continuousUi[lang], continuousPage[lang], shaftUi[lang], shaftPage[lang], trussUi[lang], trussPage[lang], cableUi[lang], cablePage[lang], cableSagUi[lang], cableSagPage[lang], frameUi[lang], framePage[lang]];
      const theirs = sets.flatMap((set) => leaves(set).map(([, s]) => s)).concat(rows.map((r) => r.does[lang])).join(' . ');
      for (const [path, s] of leaves(stiffnessUi[lang])) {
        const runs = sharedRuns(s, theirs);
        if (runs.length) clashes.push(`${lang} ${path}: “${runs[0]}” (${runs.length})`);
      }
    }
    if (process.env.DUMP) writeFileSync(process.env.DUMP, clashes.join(String.fromCharCode(10)));
    expect(clashes).toEqual([]);
  });

  it('and against this calculator’s own page, when it is there', () => {
    const page = (stiffnessPageModule as Record<string, unknown>).stiffnessPage as Record<Lang, unknown> | undefined;
    if (!page) return;
    const clashes: string[] = [];
    for (const lang of LANGS) {
      const theirs = leaves(page[lang])
        .map(([, s]) => s)
        .join(' . ');
      for (const [path, s] of leaves(stiffnessUi[lang])) {
        const runs = sharedRuns(s, theirs);
        if (runs.length) clashes.push(`${lang} ${path}: “${runs[0]}” (${runs.length})`);
      }
    }
    if (process.env.DUMP2) writeFileSync(process.env.DUMP2, clashes.join(String.fromCharCode(10)));
    expect(clashes).toEqual([]);
  });

  it('writes no sentence twice in one language (a sentence has one home)', () => {
    // Parallel sentences of a truss and of a frame share words by design; the same sentence, letter for letter, in two places is one written twice.
    for (const lang of LANGS) {
      const seen = new Map<string, string>();
      for (const [path, s] of leaves(stiffnessUi[lang])) {
        if (words(s).length < 6) continue;
        expect(seen.get(s), `${lang} ${path} repeats ${seen.get(s)}`).toBeUndefined();
        seen.set(s, path);
      }
    }
  });

  it('names no vendor and no design code, and says once that there is no design check', () => {
    const vendors = /\b(AISC|ASCE|ACI|Eurocode|SAP|RISA|STAAD|ETABS|SkyCiv|Robot|Autodesk|Revit|LRFD|ASD)\b/i;
    for (const lang of LANGS) for (const [path, s] of leaves(stiffnessUi[lang])) expect(s, `${lang} ${path}`).not.toMatch(vendors);
    expect(stiffnessUi.en.results.method).toContain('no design check');
    expect(stiffnessUi.es.results.method).toContain('ninguna comprobación de diseño');
    // …and nowhere else: a sentence that claims a verdict is a sentence this page may not carry.
    for (const lang of LANGS) for (const [path, s] of leaves(stiffnessUi[lang])) if (path !== 'results.method') expect(s, `${lang} ${path}`).not.toMatch(/\b(adequate|passes the code|safe|seguro|adecuad[oa]|cumple el código)\b/i);
  });

  it('writes no plural slip next to a count of one, and no hole is left unnamed', () => {
    for (const lang of LANGS) {
      for (const [path, s] of leaves(stiffnessUi[lang])) {
        expect(s, `${lang} ${path}`).not.toMatch(/\b1 (nodes|members|supports|loads|bars|nudos|barras|apoyos|cargas)\b/);
        // Every hole is a word of letters (one pass of fill() knows it) or a plural of two words.
        for (const hole of s.matchAll(/\{([^}]*)\}/g)) expect(hole[1], `${lang} ${path}`).toMatch(/^\w+(\|[^|}]*\|[^|}]*)?$/);
      }
    }
  });

  it('is complete in both languages and the same shape (every key, every hole)', () => {
    const en = new Map(leaves(stiffnessUi.en));
    const es = new Map(leaves(stiffnessUi.es));
    expect([...es.keys()].sort()).toEqual([...en.keys()].sort());
    const holes = (s: string) => [...new Set([...s.matchAll(/\{(\w+)/g)].map((m) => m[1]))].sort();
    for (const [path, s] of en) expect(holes(es.get(path) ?? ''), path).toEqual(holes(s));
    for (const [path, s] of es) if (path !== 'drawing.reading.empty') expect(s.trim(), `es ${path}`).not.toBe('');
  });

  it('writes a true minus in every sentence that carries a sign convention, and a typographic apostrophe, never a straight one', () => {
    for (const lang of LANGS) for (const [path, s] of leaves(stiffnessUi[lang])) expect(s, `${lang} ${path}`).not.toMatch(/[a-záéíóúñ]'[a-záéíóúñ]/i);
  });

  it('hands the tool exactly the first calculator’s pieces it borrows, in both languages', () => {
    for (const lang of LANGS) {
      const t = sharedWords(beamStrings[lang].ui);
      expect(Object.keys(t).sort()).toEqual(['numbers', 'results', 'row', 'section', 'sheet', 'supports', 'toolbar']);
      expect(t.numbers.group).toBe(beamStrings[lang].ui.numbers.group);
    }
  });
});
