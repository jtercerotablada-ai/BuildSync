import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { convertUnits, defaultBeam, sectionProps, type BeamForm, type SteelShape } from '@/lib/calc/beam/model';
import { defaultSpan } from '@/lib/calc/beam/span';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import type { Lang } from '@/lib/ttc/i18n';
import { BeamCalculator } from '../beam/BeamCalculator';
import { Actions } from './Actions';
import { off, select } from './fields';
import { PAPER_PLOT, PAPER_WIDTH } from './layout';
import { arrow, larger, peak, settle, two } from './results';
import { SectionGroup } from './SectionGroup';
import { SheetStamp } from './sheet';
import type { SteelShapes } from './steel';

/**
 * THE CALCULATORS' SHELL — what every calculator of the catalogue does
 * around its own form (index.ts). It came out of the first calculator's
 * component as moves that change nothing, and what they must not change is
 * held where it always was: the two calculators' own tests, read cell by
 * cell, and the two browser scripts (beam-check.mjs, span-check.mjs) for
 * what only a browser shows — the address following the form, the shape
 * table arriving, the printed sheet.
 *
 * Here: the pieces standing alone, as the next calculator will use them.
 * The small arithmetic of a results table; the "Section and material" group
 * given a section and nothing else — which must be, to the character, the
 * group the first calculator shows for that section — and, with the shape
 * table handed to it, the half of that group a server never renders; the
 * row of actions; and what the shell must never carry: words, the site's
 * copy, a way to send anything.
 */

const LANGS: Lang[] = ['en', 'es'];
const SRC = resolve(__dirname, '..', '..', '..', '..');
const HERE = join(SRC, 'components/ttc/calc/shell');
const shapes: SteelShape[] = JSON.parse(readFileSync(join(SRC, 'lib/steel/aisc-shapes.json'), 'utf8')).shapes;

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

describe('calculator shell: what a results table asks of a value', () => {
  it('a value at or under the floor is zero — a plain zero, whatever its sign; above it, the value untouched', () => {
    expect(settle(1e-12, 1e-9)).toBe(0);
    expect(Object.is(settle(-1e-12, 1e-9), 0)).toBe(true);
    expect(settle(1e-9, 1e-9)).toBe(0);
    expect(settle(-1e-9, 1e-9)).toBe(0);
    expect(settle(1.0000001e-9, 1e-9)).toBe(1.0000001e-9);
    expect(settle(-13.6, 1e-9)).toBe(-13.6);
    // With no floor nothing but zero is zero.
    expect(settle(5e-324, 0)).toBe(5e-324);
    expect(settle(0, 0)).toBe(0);
  });

  it('a largest value that is rounding is zero and has no place; one that is not keeps both', () => {
    expect(peak({ value: 3e-13, x: 7 }, 1e-9)).toEqual({ value: 0, x: null });
    expect(peak({ value: -3e-13, x: 7 }, 1e-9)).toEqual({ value: 0, x: null });
    const real = { value: -84.1, x: 9.5 };
    expect(peak(real, 1e-9)).toBe(real);
  });

  it('of two peaks the one further from zero, whichever its sign — and the first when they are as far', () => {
    const hi = { value: 84.1, x: 9.5 };
    const lo = { value: -96, x: 0 };
    expect(larger(hi, lo)).toBe(lo);
    expect(larger(lo, hi)).toBe(lo);
    const twin = { value: -84.1, x: 14.5 };
    expect(larger(hi, twin)).toBe(hi);
    expect(larger(twin, hi)).toBe(twin);
    // Two that are rounding: the first, which has no place either.
    expect(larger({ value: 0, x: null }, { value: 0, x: null })).toEqual({ value: 0, x: null });
  });

  it('the word for which way: the second below zero, the first otherwise', () => {
    expect(arrow(2, 'upward', 'downward')).toBe('upward');
    expect(arrow(-2, 'upward', 'downward')).toBe('downward');
    // A zero is given the first word; a table prints none for it (it asks first).
    expect(arrow(0, 'upward', 'downward')).toBe('upward');
  });

  it('left and right of a point are two values only where they differ by more than their rounding', () => {
    expect(two(13.6, 7.6)).toBe(true);
    expect(two(7.6, 7.6)).toBe(false);
    // A billionth of the larger of them — or of one, where both are small — is rounding.
    expect(two(1e6, 1e6 + 5e-4)).toBe(false);
    expect(two(1e6, 1e6 + 5e-3)).toBe(true);
    expect(two(0, 5e-10)).toBe(false);
    expect(two(0, 5e-9)).toBe(true);
    expect(two(-4, 4)).toBe(true);
  });

  it('a value that cannot be one: not a number, or below zero — zero itself is "not given"', () => {
    for (const bad of [-1, -1e-300, Number.NaN, Infinity, -Infinity]) expect(off(bad), String(bad)).toBe(true);
    for (const good of [0, 1e-300, 29000]) expect(off(good), String(good)).toBe(false);
  });

  it('on paper a diagram is 96 px tall and the drawings 724 px wide: 191 mm of a Letter page', () => {
    expect(PAPER_PLOT).toBe(96);
    // 191 mm at 96 px to the inch is 721.9 px; the sheet draws for a whole 724.
    expect(PAPER_WIDTH).toBe(724);
    expect(Math.abs((191 / 25.4) * 96 - PAPER_WIDTH)).toBeLessThan(3);
  });
});

/* ── The "Section and material" group ─────────────────────────────────── */

/** The shape table as a calculator holds it before it has arrived — which is all a server ever has. */
const noTable = (wanted: boolean): SteelShapes => ({ wanted, shapes: null, failed: false, shape: null, unknown: false, filter: '', setFilter: () => {}, filtered: [] });
/** …and once it has: what `useSteelShapes` returns for a name and a filter (steel.ts, line for line). */
const table = (name: string, filter = ''): SteelShapes => {
  const shape = shapes.find((s) => s.designation === name) ?? shapes.find((s) => s.designation.toUpperCase() === name.toUpperCase()) ?? null;
  const q = filter.trim().toUpperCase().replace(/\s+/g, '');
  const filtered = (q ? shapes.filter((s) => s.designation.toUpperCase().includes(q)) : shapes).slice(0, 120);
  return { wanted: true, shapes, failed: false, shape, unknown: !shape, filter, setFilter: () => {}, filtered };
};

/** The group alone, for a form: given what the first calculator gives it. */
const group = (lang: Lang, form: Pick<BeamForm, 'units' | 'section'>, steel: SteelShapes, fault = false) => {
  const t = beamStrings[lang].ui;
  return renderToStaticMarkup(
    h(SectionGroup, {
      t: t.section,
      numbers: t.numbers,
      units: form.units,
      section: form.section,
      worked: sectionProps(form, steel.shape),
      steel,
      uid: 'u-',
      describedBy: fault ? 'u-section' : undefined,
      unknownText: steel.unknown ? t.section.unknownShape.replace('{shape}', form.section.shape) : '',
      onSection: () => {},
      onMaterial: () => {},
      flush: () => {},
    }),
  );
};
/** The same group as the first calculator's form has it: its last group, up to the row of actions. */
const inForm = (html: string) => html.slice(html.lastIndexOf('<fieldset class="mp-app__group">'), html.indexOf('<div class="mp-app__actions">'));

const B = defaultBeam();
const sec = (over: Partial<BeamForm['section']>): BeamForm['section'] => ({ ...B.section, ...over });

describe('calculator shell: the "Section and material" group, standing alone', () => {
  const SECTIONS: Record<string, BeamForm> = {
    'the example': B,
    'the example in SI': convertUnits(B, 'si'),
    'the single-span example': defaultSpan(),
    'a wooden rectangle': { ...B, section: sec({ mode: 'rect', material: 'wood', E: 1600, b: 3.5, h: 11.25 }) },
    'concrete at its listed modulus, in SI': convertUnits({ ...B, section: sec({ material: 'concrete', E: 3605 }) }, 'si'),
    'a modulus of the visitor’s own': { ...B, section: sec({ material: 'custom', E: 12345.6 }) },
    'no I, S or shear area': { ...B, section: sec({ I: 0, S: 0, Av: 0 }) },
    'a steel shape, the table not here yet': { ...B, section: sec({ mode: 'shape', shape: 'W18X50', selfWeight: true }) },
  };
  const FAULTY: Record<string, BeamForm> = {
    'values that cannot be ones': { ...B, section: sec({ E: -1, I: Number.NaN, S: -3, Av: Infinity }) },
    'a rectangle with a side below zero': { ...B, section: sec({ mode: 'rect', b: -2, h: Number.NaN }) },
  };

  // The move that made it a component changed nothing: for the same section
  // it is the very markup the first calculator's form ends with. (That whole
  // form, before and after the move, was compared byte for byte for four
  // hundred beams; this keeps the two from drifting apart afterwards.)
  for (const lang of LANGS) {
    const t = beamStrings[lang].ui;
    for (const [name, form] of Object.entries(SECTIONS)) {
      it(`${lang}, ${name}: to the character, the group in the first calculator's form — and in the second's`, () => {
        const alone = group(lang, form, noTable(form.section.mode === 'shape'));
        expect(alone.length).toBeGreaterThan(600);
        expect(alone).toBe(inForm(renderToStaticMarkup(h(BeamCalculator, { t, initial: form }))));
        // The single-span page is the same component in another mode: the same group.
        expect(alone).toBe(inForm(renderToStaticMarkup(h(BeamCalculator, { t, span: spanUi[lang], initial: form }))));
      });
    }
    // The ids a fault is tied to begin as the calculator's own do (a server render of it alone: _R_0_).
    for (const [name, form] of Object.entries(FAULTY)) {
      it(`${lang}, ${name}: the same group, marks and ties included`, () => {
        const alone = group(lang, form, noTable(false), true);
        expect(alone).toContain('aria-describedby="u-section"');
        expect(alone.replace(/u-section/g, '_R_0_section')).toBe(inForm(renderToStaticMarkup(h(BeamCalculator, { t, initial: form }))));
      });
    }
  }

  it('it begins with its title and its three tabs, under one name', () => {
    for (const lang of LANGS) {
      const t = beamStrings[lang].ui.section;
      const html = group(lang, B, noTable(false));
      expect(html.startsWith(`<fieldset class="mp-app__group"><legend>${esc(t.title)}</legend><p class="mp-app__note">${esc(t.intro)}</p>`)).toBe(true);
      expect(html.endsWith('</fieldset>')).toBe(true);
      const radios = [...html.matchAll(/<input type="radio"[^>]*>/g)].map((m) => m[0]);
      expect(radios).toHaveLength(3);
      for (const r of radios) expect(attr(r, 'name')).toBe('beam-section');
      expect(radios.map((r) => / checked=""/.test(r))).toEqual([true, false, false]);
      expect([...html.matchAll(/<label class="mp-seg__item">[\s\S]*?<span>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]))).toEqual([t.modes.props, t.modes.rect, t.modes.shape]);
    }
  });

  it('a value that cannot be one marks its field and ties it to the calculator’s line — only that field, and only while the line is there', () => {
    const form = { ...B, section: sec({ E: 29000, I: -5, S: 88.9, Av: Number.NaN }) };
    const fields = (html: string) => [...html.matchAll(/<input class="mp-num__input"[^>]*>/g)].map((m) => [attr(m[0], 'value'), attr(m[0], 'aria-invalid'), attr(m[0], 'aria-describedby')]);
    // E, I, S, shear area: the second and the fourth are at fault.
    expect(fields(group('en', form, noTable(false), true))).toEqual([['29000', undefined, undefined], ['-5', 'true', 'u-section'], ['88.9', undefined, undefined], ['', 'true', 'u-section']]);
    // With no line on screen to point at, the mark alone.
    expect(fields(group('en', form, noTable(false), false))).toEqual([['29000', undefined, undefined], ['-5', 'true', undefined], ['88.9', undefined, undefined], ['', 'true', undefined]]);
  });

  // What a server never shows, and so no test of the calculators could read:
  // the group once the shape table has arrived. (In a browser: beam-check.mjs.)
  it('a steel shape: its properties from the table, its weight in the form’s units, the filter and the list', () => {
    // W18X50: 50 lb/ft, I = 800 in⁴, S = 88.9 in³. In SI: 50 × 1.48816 = 74.41 kg/m,
    // 800 × 0.416231 = 332.985 × 10⁶ mm⁴, 88.9 × 16.3871 = 1,456.81 × 10³ mm³.
    const us = { ...B, section: sec({ mode: 'shape', shape: 'W18X50', selfWeight: true }) };
    const html = group('en', us, table('W18X50'));
    expect(text(html.match(/<p class="mp-app__computed">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe('W18X50: E = 29,000 ksi, I = 800 in⁴, S = 88.9 in³');
    expect(text(html.match(/<label class="mp-app__check">([\s\S]*?)<\/label>/)?.[1] ?? '')).toBe(`${beamStrings.en.ui.section.selfWeight} (50 lb/ft)`);
    expect(html).toMatch(/<input type="checkbox" checked=""\/>/);
    const si = group('en', convertUnits(us, 'si'), table('W18X50'));
    expect(text(si.match(/<p class="mp-app__computed">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe('W18X50: E = 200,000 MPa, I = 332.985 10⁶ mm⁴, S = 1,456.81 10³ mm³');
    expect(text(si.match(/<label class="mp-app__check">([\s\S]*?)<\/label>/)?.[1] ?? '')).toBe(`${beamStrings.en.ui.section.selfWeight} (74.41 kg/m)`);
    // In Spanish the thousands are set apart by a narrow space, never a comma.
    expect(text(group('es', convertUnits(us, 'si'), table('W18X50')).match(/<p class="mp-app__computed">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe('W18X50: E = 200 000 MPa, I = 332.985 10⁶ mm⁴, S = 1 456.81 10³ mm³');
    // No material and no modulus to type: a shape brings its own. The filter is the one text field.
    expect(html).not.toContain(`<span class="mp-num__label">${esc(beamStrings.en.ui.section.material)}</span>`);
    expect([...html.matchAll(/<input class="mp-num__input"[^>]*>/g)]).toHaveLength(1);
    expect(html).toContain(`<label class="mp-num mp-num--filter"><span class="mp-num__label">${esc(beamStrings.en.ui.section.filter)}</span>`);
    // The list: the first 120 shapes of the table, the one in use among them and chosen.
    const options = [...html.matchAll(/<option value="([^"]*)"( selected="")?>/g)].map((m) => [m[1], Boolean(m[2])]);
    expect(options).toHaveLength(120);
    expect(options.map((o) => o[0])).toEqual(shapes.slice(0, 120).map((s) => s.designation));
    expect(options.filter((o) => o[1]).map((o) => o[0])).toEqual(['W18X50']);
    // Not ticked for a shape whose weight is not asked for.
    expect(group('en', { ...us, section: sec({ mode: 'shape', shape: 'W18X50', selfWeight: false }) }, table('W18X50'))).toMatch(/<input type="checkbox"\/>/);
  });

  it('the shape in use stays listed while the filter narrows the rest; a filter that leaves nothing says so', () => {
    const form = { ...B, section: sec({ mode: 'shape', shape: 'W18X50', selfWeight: false }) };
    const narrowed = group('en', form, table('W18X50', ' w21x4 '));
    expect([...narrowed.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1])).toEqual(['W18X50', 'W21X44', 'W21X48']);
    expect(attr(narrowed.match(/<input class="mp-num__input" type="text"[^>]*>/)![0], 'value')).toBe(' w21x4 ');
    expect(narrowed).not.toContain(esc(beamStrings.en.ui.section.noMatch));
    const none = group('en', form, table('W18X50', 'nothing like this'));
    expect([...none.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1])).toEqual(['W18X50']);
    expect(none).toContain(`<p class="mp-app__none">${esc(beamStrings.en.ui.section.noMatch)}</p>`);
  });

  it('a name the table does not have: shown as it came and not to be chosen, said under the list, and no weight to tick', () => {
    for (const lang of LANGS) {
      const t = beamStrings[lang].ui.section;
      const form = { ...B, section: sec({ mode: 'shape', shape: 'W99X1', selfWeight: true }) };
      const html = group(lang, form, table('W99X1'));
      const said = t.unknownShape.replace('{shape}', 'W99X1');
      expect(html).toContain(`<p class="mp-app__row-error" id="u-shape">${esc(said)}</p>`);
      expect(html).toContain('<option value="W99X1" disabled="" selected="">W99X1</option>');
      const list = html.match(/<select class="mp-num__input"[^>]*>/)![0];
      expect([attr(list, 'aria-invalid'), attr(list, 'aria-describedby')]).toEqual(['true', 'u-shape']);
      expect(html).toContain('<label class="mp-num mp-num--select" data-invalid="true">');
      // No shape, no properties line, and the box neither ticked nor to be ticked — whatever the form holds.
      expect(html).not.toContain('mp-app__computed');
      expect(html).toMatch(/<input type="checkbox" disabled=""\/>/);
      expect(text(html.match(/<label class="mp-app__check">([\s\S]*?)<\/label>/)?.[1] ?? '')).toBe(t.selfWeight);
    }
  });

  it('while the table is on its way it says so; once it is lost it says that, and offers the page again', () => {
    for (const lang of LANGS) {
      const t = beamStrings[lang].ui.section;
      const form = { ...B, section: sec({ mode: 'shape', shape: 'W18X50', selfWeight: true }) };
      const waiting = group(lang, form, noTable(true));
      expect(waiting).toContain(`<p class="mp-app__none" role="status">${esc(t.loading)}</p>`);
      expect(waiting).not.toMatch(/<button\b/);
      const lost = group(lang, form, { ...noTable(true), failed: true });
      expect(lost).toContain(`<p class="mp-app__none" role="status">${esc(t.loadFailed)}</p>`);
      expect(lost).toContain(`<button type="button" class="mp-app__btn">${esc(t.reload)}</button>`);
      expect(lost).not.toContain(esc(t.loading));
    }
  });
});

describe('calculator shell: the row of actions, the list field, the sheet’s line', () => {
  it('three buttons that submit nothing, in the page’s words, and an empty line for what was copied', () => {
    for (const lang of LANGS) {
      const t = beamStrings[lang].ui;
      const html = renderToStaticMarkup(h(Actions, { t: t.toolbar, copy: () => '', reset: () => {} }));
      expect(html).toBe(
        `<div class="mp-app__actions"><button type="button" class="mp-app__btn">${esc(t.toolbar.copy)}</button><button type="button" class="mp-app__btn">${esc(t.toolbar.print)}</button><button type="button" class="mp-app__btn mp-app__btn--quiet">${esc(t.toolbar.reset)}</button><p class="mp-app__copied" role="status" aria-live="polite"></p></div>`,
      );
      // …which is the row the first calculator's form ends with.
      expect(renderToStaticMarkup(h(BeamCalculator, { t }))).toContain(`${html}</form>`);
    }
  });

  it('a field that is a list: its label over it, the value in use chosen, a class of its own when asked', () => {
    const html = renderToStaticMarkup(select('Direction', 'up', [['down', 'Down'], ['up', 'Up']], () => {}, 'mp-num--dir'));
    expect(html).toBe('<label class="mp-num mp-num--select mp-num--dir"><span class="mp-num__label">Direction</span><span class="mp-num__box"><select class="mp-num__input"><option value="down">Down</option><option value="up" selected="">Up</option></select></span></label>');
    expect(renderToStaticMarkup(select('Kind', 'pin', [['pin', 'Pin']], () => {}))).toContain('<label class="mp-num mp-num--select">');
  });

  it('the sheet’s line: nothing until the sheet is printed, then when and the address, in the page’s words', () => {
    for (const lang of LANGS) {
      const t = beamStrings[lang].ui.sheet;
      expect(renderToStaticMarkup(h(SheetStamp, { stamp: null, t }))).toBe('');
      const html = renderToStaticMarkup(h(SheetStamp, { stamp: { when: 'WHEN', url: 'https://example.test/resources/beam#b=x' }, t }));
      expect(html).toBe(`<p class="mp-sheet mp-sheet__stamp">${esc(t.printed.replace('{when}', 'WHEN'))} · ${esc(t.link.replace('{url}', 'https://example.test/resources/beam#b=x'))}</p>`);
      expect(t.printed).toContain('{when}');
      expect(t.link).toContain('{url}');
    }
    // The server sends none: the first calculator's markup ends with its privacy line.
    expect(renderToStaticMarkup(h(BeamCalculator, { t: beamStrings.en.ui }))).toMatch(/<p class="mp-app__privacy">[^<]*<\/p><\/div>$/);
  });
});

describe('calculator shell: what it carries, and what it cannot do', () => {
  const files = readdirSync(HERE).filter((f) => /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f));
  const source = (f: string) => readFileSync(join(HERE, f), 'utf8');
  const code = (f: string) => source(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('is these files, each exported once from its front door', () => {
    expect(files.sort()).toEqual(['Actions.tsx', 'SectionGroup.tsx', 'address.ts', 'fields.tsx', 'index.ts', 'layout.ts', 'results.ts', 'sheet.tsx', 'steel.ts']);
    const door = code('index.ts');
    for (const f of files.filter((x) => x !== 'index.ts')) expect(door.match(new RegExp(`from './${f.replace(/\.tsx?$/, '')}'`, 'g')), f).toHaveLength(1);
  });

  // The same walk as beam-calculator.test.ts: every value import, and every import() that is asked for later.
  const resolveImport = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? join(dirname(from), spec) : null;
    if (!base) return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
      if (existsSync(candidate) && /\.(tsx?|json)$/.test(candidate)) return candidate;
    }
    return null;
  };
  const reach = (entry: string): string[] => {
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file) || file.endsWith('.json')) {
        seen.add(file);
        return;
      }
      seen.add(file);
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/^\s*(import|export)\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
        const names = m[2];
        if (/^\{[^}]*\}$/.test(names.trim()) && names.replace(/[{}]/g, '').split(',').every((n) => /^\s*type\s/.test(n) || n.trim() === '')) continue;
        const next = resolveImport(file, m[3]);
        if (next) walk(next);
      }
      for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const next = resolveImport(file, m[1]);
        if (next) walk(next);
      }
    };
    walk(entry);
    return [...seen].map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'));
  };

  // A calculator's words are a prop from its server view. A file of words
  // holds both languages: imported here for its value, it would travel with
  // the script of every calculator.
  it('no words, none of the site’s copy, no calculator: the number field, the units, the shape table — and that last one only when asked for', () => {
    const outside = reach(join(HERE, 'index.ts')).filter((f) => !f.startsWith('components/ttc/calc/shell/'));
    // Arithmetic (lib/calc: the section's units and listed moduli, how a number is written), the number field, the table.
    expect(outside).toEqual(expect.arrayContaining(['lib/calc/beam/model.ts', 'lib/calc/format.ts']));
    expect(outside.filter((f) => !f.startsWith('lib/calc/')).sort()).toEqual(['components/ttc/calc/NumField.tsx', 'lib/steel/aisc-shapes.json']);
    expect(outside.filter((f) => /strings/.test(f))).toEqual([]);
    for (const f of files) {
      expect(source(f), f).not.toMatch(/from '@\/lib\/ttc\//);
      expect(source(f), f).not.toMatch(/from '@\/components\/ttc\/(mp|views)\//);
      expect(source(f), f).not.toMatch(/from '\.\.\/beam\//);
      // The type of the words, never the words.
      for (const m of source(f).matchAll(/^import (.*) from '@\/lib\/calc\/[^']*strings';$/gm)) expect(m[1], f).toMatch(/^type /);
    }
    // The table is asked for in one place, when a section is a steel shape — never with the page.
    for (const f of files) expect(source(f), f).not.toMatch(/^import .*aisc-shapes\.json/m);
    expect(files.filter((f) => /import\('@\/lib\/steel\/aisc-shapes\.json'\)/.test(source(f)))).toEqual(['steel.ts']);
  });

  it('nothing typed can go anywhere: no request, no store, no cookie in any of it', () => {
    for (const f of files) expect(source(f), f).not.toMatch(/\bfetch\(|sendBeacon|XMLHttpRequest|new WebSocket|\baction=|localStorage|sessionStorage|document\.cookie/);
    // The address is rewritten in place — the part after the #, which a browser sends to no server — and never navigated to.
    const address = code('address.ts');
    expect(address.match(/window\.history\.\w+/g)).toEqual(['window.history.replaceState', 'window.history.state']);
    expect(address).toContain("window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + want);");
    for (const f of files) expect(code(f), f).not.toMatch(/location\.(assign|replace|href\s*=)|window\.open\(/);
    // The one page load it can ask for is the page itself, again (the shape table lost).
    expect(files.filter((f) => /location\.reload\(\)/.test(code(f)))).toEqual(['SectionGroup.tsx']);
  });

  // The copied link and the printed sheet's line are the page and the case,
  // and nothing else: not the query string the visitor arrived with (an ad's
  // click identifier), which would travel to everyone the link is sent to.
  it('a link to a case is the page and the case: the query string is in neither the copied link nor the sheet’s line', () => {
    const address = code('address.ts');
    expect(address.match(/link: \(code\) => `\$\{window\.location\.origin\}\$\{window\.location\.pathname\}\$\{prefix\}\$\{code\}`,/g)).toHaveLength(1);
    // The search is read once: to leave it as it is when the address is rewritten in place.
    expect(address.match(/location\.search/g)).toHaveLength(1);
    for (const f of ['sheet.tsx', 'Actions.tsx']) expect(code(f), f).not.toMatch(/location\.(search|href|hash)/);
  });

  // The header's language link is built from the address, and nothing but
  // this event tells it the address has changed (mp/lang.tsx listens for it
  // by name: this script must not import that file).
  it('each time it rewrites the address it tells the window, under the name the header listens for', () => {
    const address = source('address.ts');
    const event = address.match(/const ADDRESS_EVENT = '([^']+)';/)?.[1];
    expect(event).toBe('mp:address');
    expect(source('address.ts').match(/window\.dispatchEvent\(new Event\(ADDRESS_EVENT\)\);/g)).toHaveLength(1);
    expect(readFileSync(join(SRC, 'components/ttc/mp/lang.tsx'), 'utf8')).toContain(`const ADDRESS_EVENT = '${event}';`);
  });

  // What the address hook does is held in a browser (beam-check.mjs,
  // span-check.mjs). Its shape is held here, as the calculators' tests hold
  // theirs: these are pins of the source, to be moved with it.
  it('the address: read once and when it changes under the page, written after 300 ms, brought up to date when the visitor reaches for something else', () => {
    const address = code('address.ts');
    // Set up once: an effect that ran again with each render would read the address again, and undo what was typed since it was last written.
    // …and again when the address changes under the page: at `popstate`, which comes in the task that changes it,
    // before the delayed write can fire and put the case of before over a link being opened; and at `hashchange`.
    expect(address).toMatch(/look\(\);\s*window\.addEventListener\('popstate', look\);\s*window\.addEventListener\('hashchange', look\);\s*return \(\) => \{\s*window\.removeEventListener\('popstate', look\);\s*window\.removeEventListener\('hashchange', look\);\s*\};\s*\}, \[\]\);/);
    expect(address.match(/addEventListener\('(popstate|hashchange)'/g)).toHaveLength(2);
    // `popstate` tells of every entry of the site's history: Back to ANOTHER page arrives too, while this calculator
    // is still on screen. That address is not read — it would show the example on the way out, or open another
    // calculator's case here. The page is the one the hook was set up on, and the first thing asked.
    expect(address).toMatch(/const here = window\.location\.pathname;\s*const look = \(changed\?: Event\) => \{\s*if \(window\.location\.pathname !== here\) return;\s*seen\.current = window\.location\.hash;/);
    // A bare address is the example only when the address CHANGED to it; any other fragment that is not this calculator's is a place on the page.
    expect(address).toContain("if (changed && window.location.hash === '') show(latest.current.blank(), false);");
    expect(address).toContain('show(found === null ? latest.current.blank() : found, found === null);');
    // The example leaves the address bare; a link that could not be read stays in it while the case is still the example.
    expect(address).toContain('const want = code === example ? \'\' : `${prefix}${code}`;');
    expect(address).toContain('if (have === want || (!want && unread.current)) return;');
    // Only a fragment that is this calculator's is rewritten or removed.
    expect(address).toContain('const mine = latest.current.owns ? latest.current.owns(window.location.hash) : window.location.hash.startsWith(prefix);');
    expect(address).toContain("const have = mine ? window.location.hash : '';");
    // 300 ms, and only if nothing has written or opened a case meanwhile.
    expect(address).toMatch(/const id = window\.setTimeout\(\(\) => \{\s*if \(pending\.current === now\) now\(\);\s*\}, 300\);\s*return \(\) => window\.clearTimeout\(id\);\s*\}, \[current, put, prefix\]\);/);
    // …nor over an address that changed under the case. The fragment this hook last read or wrote is kept, in the two
    // places it does either; a case of this calculator's, or a bare address, found in its place when the write comes
    // due is on its way to being opened, and the write is dropped.
    expect(address.match(/seen\.current = window\.location\.hash;/g)).toHaveLength(2);
    expect(address).toMatch(/window\.dispatchEvent\(new Event\(ADDRESS_EVENT\)\);\s*seen\.current = window\.location\.hash;\s*\}, \[example, prefix\]\);/);
    expect(address).toMatch(
      /const now = \(\) => \{\s*pending\.current = null;\s*const at = window\.location\.hash;\s*if \(at !== seen\.current\) \{\s*seen\.current = at;\s*if \(at === '' \|\| \(latest\.current\.owns \? latest\.current\.owns\(at\) : at\.startsWith\(prefix\)\)\) return;\s*\}\s*put\(current\(\)\);\s*\};/,
    );
    for (const event of ['pointerdown', 'focusin', 'click']) expect(address, event).toContain(`window.addEventListener('${event}', flush, true);`);
    expect(address).toContain("document.addEventListener('visibilitychange', hidden);");
    expect(address).toContain("if (document.visibilityState === 'hidden') flush();");
  });

  // A page may stand its calculator in a frame that its own first script marks when the address holds a case, so
  // that the example the server sent is not shown as that case while the scripts are on their way. The mark is
  // the frame's; taking it off is this hook's, in the commit that puts on screen what the address held. Where no
  // frame is marked nothing is asked of the calculator: no state, no render.
  it('a mark on the frame around the tool comes off in the commit that shows what the address held, and costs nothing where there is none', () => {
    const address = code('address.ts');
    expect(address).toContain("const OPENING = 'data-opening';");
    // Looked at on load and at every change of the address; said in state, so that it is a render — only where a frame is marked.
    expect(address).toMatch(/seen\.current = window\.location\.hash;\s*if \(document\.querySelector\(`\[\$\{OPENING\}\]`\)\) setLooked\(true\);\s*const found = latest\.current\.read\(window\.location\.hash\);/);
    expect(address.match(/setLooked\(/g)).toHaveLength(1);
    // …and the mark is taken off in that render's own commit, before the browser paints it.
    expect(address).toMatch(/useIsoLayoutEffect\(\(\) => \{\s*if \(looked\) document\.querySelector\(`\[\$\{OPENING\}\]`\)\?\.removeAttribute\(OPENING\);\s*\}, \[looked\]\);/);
    // The shape of a case's fragment, for whoever writes the frame's script: a key of one lower-case letter (mp/lang.tsx, CARRIED).
    expect(readFileSync(join(SRC, 'components/ttc/mp/lang.tsx'), 'utf8')).toMatch(/const CARRIED = \/\^#\[a-z\]=/);
  });

  it('the printed sheet: stamped and set "on paper" in one synchronous step, before the browser lays the page out', () => {
    const sheet = code('sheet.tsx');
    expect(sheet).toMatch(/flushSync\(\(\) => \{\s*setStamp\(\{ when, url: address \}\);\s*setOnPaper\(true\);\s*\}\);/);
    expect(sheet).toContain("window.addEventListener('beforeprint', mark);");
    expect(sheet).toContain("window.addEventListener('afterprint', back);");
    expect(sheet).toContain('const back = () => setOnPaper(false);');
    expect(sheet).toContain("new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date())");
  });

  it('every file with a hook says it runs in a browser', () => {
    for (const f of files) {
      const hooks = /\buse(State|Effect|LayoutEffect|Ref|Memo|Callback|Reducer|Id)\(/.test(code(f));
      if (hooks) expect(source(f).startsWith("'use client';"), f).toBe(true);
    }
    expect(files.filter((f) => source(f).startsWith("'use client';")).sort()).toEqual(['Actions.tsx', 'SectionGroup.tsx', 'address.ts', 'layout.ts', 'sheet.tsx', 'steel.ts']);
  });
});
