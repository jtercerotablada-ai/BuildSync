import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { solveTruss } from '@/lib/calc/truss/engine';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { trussUi } from '@/lib/calc/truss/strings';
import { buildTemplate } from '@/lib/calc/truss/templates';
import { MAX_LOADS, MAX_MEMBERS, MAX_NODES, MAX_SUPPORTS, type TrussModel } from '@/lib/calc/truss/types';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { openCalculatorPaths } from '@/lib/ttc/calculator-paths';
import type { Lang } from '@/lib/ttc/i18n';
import { DESCRIPTION_LIMIT_PX, TITLE_BUDGET_PX, descriptionPx, titlePx } from '@/lib/ttc/serp';

/**
 * The truss calculator's PAGE words (lib/calc/truss/page-strings.ts), held to
 * the engine and to the other calculators' pages. The tool's own behaviour is
 * tested where it lives (lib/calc/truss, calc/truss); this file does not
 * render the form.
 */

const LANGS: Lang[] = ['en', 'es'];

/** The page's address; TrussView.tsx exports the same constant (read as text, so that this file does not need the form). */
const TRUSS_PATH = '/resources/truss-member-forces';

function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
const wordsOf = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const runsOf = (t: string) => {
  const w = wordsOf(t);
  return w.length < 6 ? [] : Array.from({ length: w.length - 5 }, (_, i) => w.slice(i, i + 6).join(' '));
};
const sharedRuns = (ours: string[], theirs: string[]) => {
  const known = new Set(theirs.flatMap(runsOf));
  return [...new Set(ours.flatMap(runsOf).filter((run) => known.has(run)))];
};
const LEGAL = /^(disclaimer\.|sheet\.)/;

const solved = (m: TrussModel) => {
  const out = solveTruss(m);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
};

describe('truss page: the two cases it gives to check by hand', () => {
  it('the triangle: reactions P/2, rafters Ps/(2h) in compression, tie PL/(4h) in tension', () => {
    const L = 24;
    const h = 8;
    const P = 10;
    const out = solved({
      nodes: [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L / 2, y: h }],
      members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 2, j: 1 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 90 }],
      loads: [{ node: 2, fx: 0, fy: -P }],
    });
    const s = Math.hypot(L / 2, h);
    expect(out.determinacy.word).toBe('determinate');
    expect(out.reactions[0].ry).toBeCloseTo(P / 2, 9);
    expect(out.reactions[1].ry).toBeCloseTo(P / 2, 9);
    expect(out.members[0].N).toBeCloseTo((P * L) / (4 * h), 9);
    expect(out.members[1].N).toBeCloseTo(-(P * s) / (2 * h), 9);
    expect(out.members[2].N).toBeCloseTo(-(P * s) / (2 * h), 9);
  });

  it('three bars of one EA to one loaded joint: P/(1 + 2cos³θ) in the vertical, Pcos²θ/(1 + 2cos³θ) in each inclined', () => {
    const H = 6;
    const P = 10;
    const a = 4;
    const cos = H / Math.hypot(a, H);
    const model = (A: number): TrussModel => ({
      nodes: [{ x: 0, y: 0 }, { x: -a, y: H }, { x: 0, y: H }, { x: a, y: H }],
      members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 0, j: 3 }],
      supports: [{ node: 1, kind: 'pin' }, { node: 2, kind: 'pin' }, { node: 3, kind: 'pin' }],
      loads: [{ node: 0, fx: 0, fy: -P }],
      E: 29000,
      A,
    });
    const out = solved(model(4));
    expect(out.determinacy.word).toBe('indeterminate');
    const d = 1 + 2 * cos ** 3;
    expect(out.members[1].N).toBeCloseTo(P / d, 9);
    expect(out.members[0].N).toBeCloseTo((P * cos ** 2) / d, 9);
    expect(out.members[2].N).toBeCloseTo((P * cos ** 2) / d, 9);
    expect(out.members[1].N).toBeGreaterThan(out.members[0].N);
    // Raising every EA by one factor changes no force.
    const again = solved(model(40));
    again.members.forEach((m, k) => expect(m.N).toBeCloseTo(out.members[k].N, 9));
  });
});

describe('truss page: what the notes say of the engine, the engine does', () => {
  const base = (): TrussModel => ({
    nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 4 }],
    members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 2, j: 1 }],
    supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 90 }],
    loads: [{ node: 2, fx: 0, fy: -8 }],
  });

  it('a determinate truss’s forces do not depend on E and A', () => {
    const a = solved(base());
    const b = solved({ ...base(), members: base().members.map((m, k) => ({ ...m, A: 1 + k * 7, E: 100 + k * 900 })) });
    b.members.forEach((m, k) => expect(m.N).toBeCloseTo(a.members[k].N, 9));
  });

  it('a reaction is the force on the truss: upward under gravity', () => {
    const out = solved(base());
    for (const r of out.reactions) expect(r.ry).toBeGreaterThan(0);
  });

  it('a roller at 90 degrees reacts vertically; at 0, horizontally; `along` is signed along its angle', () => {
    const wall = solved({
      nodes: [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 6, y: 0 }],
      members: [{ i: 0, j: 2 }, { i: 1, j: 2 }, { i: 0, j: 1 }],
      supports: [{ node: 0, kind: 'roller', angle: 0 }, { node: 1, kind: 'pin' }],
      loads: [{ node: 2, fx: 0, fy: -6 }],
    });
    const roller = wall.reactions[0];
    expect(roller.ry).toBeCloseTo(0, 9);
    expect(roller.rx).toBeCloseTo(roller.along as number, 9);
    const vertical = solved(base()).reactions[1];
    expect(vertical.rx).toBeCloseTo(0, 9);
    expect(vertical.along).toBeCloseTo(vertical.ry, 9);
  });

  it('tension is positive and elongation is NL/(EA)', () => {
    const out = solved({ ...base(), members: base().members.map((m) => ({ ...m, A: 2, E: 1000 })) });
    expect(out.members[0].N).toBeGreaterThan(0);
    for (const m of out.members) expect(m.elongation).toBeCloseTo((m.N * m.length) / (1000 * 2), 12);
    expect(out.members[0].stress).toBeCloseTo(out.members[0].N / 2, 12);
  });

  it('a joint of two members on one line, with nothing else, is refused as a mechanism, whatever the load', () => {
    for (const fy of [0, -5]) {
      const out = solveTruss({
        nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 3 }],
        members: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 0, j: 3 }, { i: 3, j: 2 }],
        supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'roller', angle: 90 }],
        loads: [{ node: 1, fx: 0, fy }],
      });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.issues.map((i) => i.code)).toContain('mechanism');
    }
  });

  it('the zero-force rules: two members at an unloaded joint, and the third of three with two in line', () => {
    const two = solved({
      nodes: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 4, y: 3 }, { x: 4, y: -3 }],
      members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 2, j: 1 }, { i: 0, j: 3 }, { i: 3, j: 1 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 90 }],
      loads: [{ node: 2, fx: 0, fy: -4 }],
    });
    expect(two.inspection.length).toBeGreaterThan(0);
    for (const z of two.inspection) expect(Math.abs(two.members[z.member].N)).toBeLessThan(1e-9);
    // The king post under a symmetric load: three members at its foot, two of them in line, the post is zero.
    const king = buildTemplate('king-post', { span: 24, height: 8, panels: 2, load: 10, supports: 'pin-roller' }, 'us');
    const out = solved({ nodes: king.nodes, members: king.members, supports: king.supports, loads: king.loads });
    expect(out.inspection.some((z) => z.rule === 'three-members')).toBe(true);
    for (const z of out.inspection) expect(Math.abs(out.members[z.member].N)).toBeLessThan(1e-9);
  });

  it('the limits it states are the engine’s', () => {
    expect([MAX_NODES, MAX_MEMBERS, MAX_SUPPORTS, MAX_LOADS]).toEqual([40, 120, 40, 80]);
    for (const [lang, re] of [
      ['en', /Up to 40 joints, 120 members, 40 supports and 80 loads\./],
      ['es', /Hasta 40 nudos, 120 barras, 40 apoyos y 80 cargas\./],
    ] as const) {
      expect(trussPage[lang].limits.items.filter((x) => re.test(x))).toHaveLength(1);
    }
  });

  it('the templates: a value a shape cannot take is replaced (an odd Pratt), the bottom chord is on y = 0, half the load at the ends, Pratt diagonals in tension', () => {
    const t = buildTemplate('pratt', { span: 32, height: 8, panels: 5, load: 10, supports: 'pin-roller' }, 'us');
    expect(t.used.panels % 2).toBe(0);
    expect(t.clamped.map((c) => c.field)).toContain('panels');
    expect(Math.min(...t.nodes.map((n) => n.y))).toBe(0);
    const loads = t.loads.map((l) => -l.fy).sort((a, b) => a - b);
    expect(loads[0]).toBe(5);
    expect(loads.at(-1)).toBe(10);
    const out = solved({ nodes: t.nodes, members: t.members, supports: t.supports, loads: t.loads });
    const diagonals = out.members.filter((m) => Math.abs(m.cx) > 1e-9 && Math.abs(m.cy) > 1e-9);
    expect(diagonals.length).toBeGreaterThan(0);
    for (const d of diagonals) expect(d.N).toBeGreaterThanOrEqual(-1e-9);
  });
});

describe('truss page: the words', () => {
  const en = leaves(trussPage.en);
  const es = leaves(trussPage.es);
  const OTHERS = (lang: Lang) => [beamStrings[lang].page, spanPage[lang], continuousPage[lang], shaftPage[lang]];

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    const parts = (page: unknown) => leaves(page).map(([p]) => p.replace(/\[\d+\]/g, '[]'));
    expect([...new Set(parts(trussPage.en))]).toEqual([...new Set(parts(beamStrings.en.page))]);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place, no grouping comma, “usted”', () => {
    const same = en.filter(([, s], i) => s === es[i][1] && s.split(/\s+/).length > 3).map(([path]) => path);
    expect(same).toEqual([]);
    for (const [path, s] of es) {
      expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
      expect(s, path).not.toMatch(/\b(introduces|escribes|eliges|incluyes|pides|puedes|tienes|quieres|tu|tus|ti|te)\b/);
    }
    // The formulas are the same in both: a case's symbols are not translated.
    const formulas = (s: string) => s.match(/N = \(EA\/L\)δ|NL\/\(EA\)|Ps\/\(2h\)|PL\/\(4h\)|P\/\(1 \+ 2cos³θ\)|Pcos²θ\/\(1 \+ 2cos³θ\)|P\/2/g) ?? [];
    en.forEach(([path, s], i) => expect(formulas(es[i][1]), path).toEqual(formulas(s)));
    expect(en.flatMap(([, s]) => formulas(s)).length).toBeGreaterThanOrEqual(7);
  });

  it('names no other company’s product, no price, no date, no standard, no verdict', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|ftool|sap2000|etabs|robot|risa|staad|autodesk|enercalc|clearcalcs/i);
      expect(s, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
      expect(s, path).not.toMatch(/Civil\s*&\s*Structural/i);
      expect(s, path).not.toMatch(/\b(ACI|AISC|ASCE|ASME|ANSI|ISO|DIN|IBC|Eurocode|Eurocódigo|LRFD|ASD|NDS|AWS)\b/);
      if (LEGAL.test(path)) continue;
      expect(s, path).not.toMatch(/\b(ok|okay|pass|passes|passed|fail|fails|failed|adequate|inadequate|sufficient|insufficient|enough|acceptable|complies|satisf\w*|safe|safely|unsafe|allowable|permissible|recommended|verified)\b/i);
      expect(s, path).not.toMatch(/\b(cumple|cumplen|no cumple|falla|fallan|aprobad\w*|suficiente|insuficiente|adecuad\w*|inadecuad\w*|aceptable|basta|segur[oa]|satisf\w*|verifica|admisible|permisible|recomendad\w*)\b/i);
    }
  });

  it('writes no figure but those of its formulas, its limits and its roller angles', () => {
    const written = (lang: Lang) =>
      leaves(trussPage[lang])
        .filter(([path]) => !LEGAL.test(path))
        .map(([, s]) => s)
        .join(' ');
    for (const lang of LANGS) {
      const numbers = written(lang).match(/\d+(\.\d+)?/g) ?? [];
      expect([...new Set(numbers)].sort()).toEqual(['0', '1', '120', '2', '4', '40', '80', '90']);
    }
  });

  it('a truss page says truss: it does not speak of beams', () => {
    for (const [path, s] of en) expect(s, path).not.toMatch(/\bbeams?\b/i);
    for (const [path, s] of es) expect(s, path).not.toMatch(/\bvigas?\b/i);
    expect(en.filter(([, s]) => /\btruss(es)?\b/i.test(s)).length).toBeGreaterThan(10);
    expect(es.filter(([, s]) => /\bcerchas?\b/i.test(s)).length).toBeGreaterThan(10);
  });

  it('says what it leaves out, each by name: buckling, connections, first order, temperature, mechanisms', () => {
    const limits = (lang: Lang) => trussPage[lang].limits.items;
    const NOT: [RegExp, RegExp][] = [
      [/^No buckling\./, /^Sin pandeo\./],
      [/^No member and no connection is sized/, /^No se dimensiona ninguna barra ni ninguna conexión/],
      [/^First order only\./, /^Solo primer orden\./],
      [/^No temperature change/, /^Sin cambio de temperatura/],
      [/two members on one line, with no third member and no support, is a mechanism/, /dos barras en una misma recta, sin una tercera barra y sin apoyo, es un mecanismo/],
    ];
    for (const [inEnglish, inSpanish] of NOT) {
      expect(limits('en').filter((x) => inEnglish.test(x)), String(inEnglish)).toHaveLength(1);
      expect(limits('es').filter((x) => inSpanish.test(x)), String(inSpanish)).toHaveLength(1);
    }
    expect(limits('en')).toHaveLength(limits('es').length);
  });

  it('the legal words are the first calculator’s own, and the credit names this calculator', () => {
    for (const lang of LANGS) {
      const ours = trussPage[lang];
      const first = beamStrings[lang].page;
      expect(ours.disclaimer).toBe(first.disclaimer);
      expect(ours.sheet.kind).toBe(first.sheet.kind);
      expect(ours.sheet.margin).toBe(first.sheet.margin);
      for (const key of ['{firm}', '{address}']) expect(ours.sheet.credit, `${lang} ${key}`).toContain(key);
      for (const other of OTHERS(lang)) expect(ours.sheet.credit).not.toBe(other.sheet.credit);
      expect(ours.sheet.credit).toMatch(lang === 'en' ? /truss calculator/ : /calculadora de cerchas/);
    }
  });

  it('no sentence of the other calculators’ pages, nor a line of the catalogue, is said again here, beyond the legal words', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items);
    for (const lang of LANGS) {
      const ours = leaves(trussPage[lang]).filter(([path]) => !LEGAL.test(path));
      const theirs = [...OTHERS(lang).flatMap((page) => leaves(page)), ...leaves(beamStrings[lang].ui), ...leaves(spanUi[lang]), ...leaves(continuousUi[lang])].map(([, s]) => s);
      // The form's own words (strings.ts) are another hand's: a sentence said in both is said twice on one page.
      const form = leaves(trussUi[lang]).map(([, s]) => s);
      for (const [path, s] of ours) {
        expect(sharedRuns([s], theirs), `${lang} ${path}`).toEqual([]);
        // The signs and the facts are the form's own conventions, written in the notes on purpose: they may agree word for word.
        if (!/^(signs|facts)/.test(path)) expect(sharedRuns([s], form), `${lang} ${path} (form)`).toEqual([]);
        expect(sharedRuns([s], rows.map((r) => r.does[lang])), `${lang} ${path}`).toEqual([]);
      }
      expect(sharedRuns([trussPage[lang].disclaimer.body], theirs).length).toBeGreaterThan(20);
    }
  });

  it('the view declares the same address', () => {
    expect(readFileSync(join(__dirname, 'TrussView.tsx'), 'utf8')).toContain(`TRUSS_PATH = '${TRUSS_PATH}'`);
  });

  it('the h1 begins with the catalogue’s name for the row, which links here', () => {
    const row = calculatorFamilies.flatMap((f) => f.items).find((i) => i.href === TRUSS_PATH)!;
    expect(row).toBeDefined();
    expect(openCalculatorPaths).toContain(TRUSS_PATH);
    for (const lang of LANGS) expect(trussPage[lang].h1.startsWith(row.name[lang]), lang).toBe(true);
  });

  it('a search result fits: the title and the description are within their pixel budgets', () => {
    for (const lang of LANGS) {
      expect(titlePx(trussPage[lang].title), lang).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      expect(descriptionPx(trussPage[lang].description), lang).toBeLessThanOrEqual(DESCRIPTION_LIMIT_PX);
    }
  });
});
