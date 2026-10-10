import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { formatNumber, fieldNumber, parseNumber } from '@/lib/calc/format';
import { beamStrings } from '@/lib/calc/beam/strings';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { absoluteUrl } from '@/lib/ttc/site';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { BEAM_PATH, BeamCalculatorView } from './BeamCalculatorView';

/**
 * THE BEAM CALCULATOR'S PAGE: /resources/beam and /es/resources/beam.
 *
 * The arithmetic is tested where it lives (lib/calc/beam). This is the page
 * around it: that both languages say the same things, that the server sends
 * a solved beam and not an empty box, that every field has a name, and that
 * the calculator's script carries the calculator and not the whole site.
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const SRC = resolve(__dirname, '..', '..', '..');
const text = (html: string) =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const render = (lang: Lang) => {
  route.pathname = localePath(BEAM_PATH, lang);
  return renderToStaticMarkup(h(SiteChrome, null, h(BeamCalculatorView, { lang })));
};

/** Every string of a nested object, with the path to it. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

describe('beam calculator: the words', () => {
  const en = leaves(beamStrings.en);
  const es = leaves(beamStrings.es);

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place', () => {
    const same = en.filter(([path, s], i) => s === es[i][1] && s.split(/\s+/).length > 3).map(([path]) => path);
    expect(same).toEqual([]);
  });

  it('names no other company’s product, no price, no date', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|quick design|clearcalcs|enercalc|tedds/i);
      expect(s, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
    }
  });

  // What the page promises of the calculation, the code must do: nothing
  // typed goes anywhere. No fetch, no beacon, no form action in its files.
  it('promises that nothing is sent, and the calculator has no way to send', () => {
    expect(beamStrings.en.ui.results.privacy).toMatch(/Nothing you enter is sent/);
    expect(beamStrings.es.ui.results.privacy).toMatch(/Nada de lo que introduce se nos envía/);
    for (const f of ['components/ttc/calc/beam/BeamCalculator.tsx', 'components/ttc/calc/beam/BeamPlot.tsx', 'components/ttc/calc/beam/BeamSchematic.tsx', 'components/ttc/calc/NumField.tsx', 'lib/calc/beam/model.ts', 'lib/calc/beam/solver.ts']) {
      const code = readFileSync(join(SRC, f), 'utf8');
      expect(code, f).not.toMatch(/\bfetch\(|sendBeacon|XMLHttpRequest|new WebSocket|\baction=|localStorage|sessionStorage|document\.cookie/);
    }
  });
});

describe('beam calculator: numbers as they are printed and typed', () => {
  it('prints a few significant figures, with separators and a decimal point', () => {
    expect(formatNumber(15.2)).toBe('15.2');
    expect(formatNumber(0.186212)).toBe('0.1862');
    expect(formatNumber(1289.04)).toBe('1,289');
    expect(formatNumber(29000, 6)).toBe('29,000');
    expect(formatNumber(-16.8)).toBe('-16.8');
    expect(formatNumber(1234567)).toBe('1,235,000');
  });

  it('never prints a negative zero, a NaN or a row of zeros', () => {
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(-1e-15)).toBe('0');
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatNumber(0.0000123)).toBe('1.23 × 10^-5');
    expect(formatNumber(123456789)).toBe('1.235 × 10^8');
  });

  it('reads what an engineer types — a comma for the point included — and nothing else', () => {
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber(' 12,5 ')).toBe(12.5);
    expect(parseNumber('-3')).toBe(-3);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('1.')).toBe(1);
    expect(parseNumber('2e3')).toBe(2000);
    for (const junk of ['', '-', '.', 'abc', '1,2,3', '1.2.3', '12 ft', '0x10', 'Infinity', '1e999', '--1']) expect(parseNumber(junk), junk).toBeNull();
  });

  // The page prints 29,000. Typed back the same way it was read as 29: a
  // modulus a thousand times too small, and a deflection a thousand times
  // too large, with nothing on screen to say so.
  it('reads a number typed with thousands separators as the page prints it', () => {
    expect(parseNumber('29,000')).toBe(29000);
    expect(parseNumber('1,234,567.5')).toBe(1234567.5);
    expect(parseNumber('-12,500')).toBe(-12500);
    expect(parseNumber('200,000')).toBe(200000);
    // What formatNumber prints, parseNumber reads back.
    for (const v of [29000, 1289.04, 13824, 200000, 0.1862, 15.2]) expect(parseNumber(formatNumber(v, 6)), String(v)).toBe(Number(v.toPrecision(6)));
    // A comma that is not a thousands separator is still a decimal point.
    expect(parseNumber('8,5')).toBe(8.5);
    expect(parseNumber('12,50')).toBe(12.5);
    expect(parseNumber('0,125')).toBe(0.125);
    expect(parseNumber('1,2345')).toBe(1.2345);
  });

  it('shows a stored value back without inventing digits', () => {
    expect(fieldNumber(20)).toBe('20');
    expect(fieldNumber(0.1 + 0.2)).toBe('0.3');
    expect(fieldNumber(6.096)).toBe('6.096');
    expect(fieldNumber(Number.NaN)).toBe('');
  });
});

describe('beam calculator: the page', () => {
  for (const lang of LANGS) {
    const html = render(lang);
    const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
    const s = beamStrings[lang].page;
    const ui = beamStrings[lang].ui;
    const c = getContent(lang);

    it(`${lang}: one h1; the tool and the method are its two h2; the tables and the notes are h3`, () => {
      const heads = (n: number) => [...main.matchAll(new RegExp(`<h${n}\\b[^>]*>([\\s\\S]*?)</h${n}>`, 'g'))].map((m) => text(m[1]));
      expect(heads(1)).toEqual([s.h1]);
      expect(heads(2)).toEqual([s.toolHeading, s.method.title]);
      expect(heads(3)).toEqual([ui.results.reactions, ui.results.maxima, ui.results.spans, ui.results.point, s.assumes.title, s.limits.title, s.signs.title, s.disclaimer.title]);
      expect(main).not.toMatch(/<h[456]\b/);
    });

    it(`${lang}: the server sends a solved beam — its reactions, its moment, its four drawings`, () => {
      // The page opens on a 20 ft span with 1.2 kip/ft and 8 kip at 12 ft:
      // 15.2 and 16.8 kip, 96 kip·ft under the load.
      const body = text(main);
      for (const number of ['15.2', '16.8', '96']) expect(body, number).toContain(number);
      const drawings = [...main.matchAll(/<svg\b[^>]*role="img"[^>]*>/g)].map((m) => attr(m[0], 'aria-label') ?? '');
      expect(drawings).toHaveLength(4);
      for (const label of drawings) expect(label.length).toBeGreaterThan(20);
      expect(drawings[1]).toContain(esc(ui.results.shear));
      expect(drawings[2]).toContain(esc(ui.results.moment));
      expect(drawings[3]).toContain(esc(ui.results.deflection));
      // No problem is announced for the default beam.
      expect(main).toMatch(/<div class="mp-app__issues" role="alert" aria-live="assertive"><\/div>/);
    });

    it(`${lang}: every field has a name`, () => {
      const controls = [...main.matchAll(/<(input|select)\b[^>]*>/g)].map((m) => m[0]);
      expect(controls.length).toBeGreaterThan(14);
      const labelled = [...main.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)];
      // Each control sits in a <label> of its own, with words in it.
      expect(labelled.reduce((n, m) => n + (m[1].match(/<(input|select)\b/g) ?? []).length, 0)).toBe(controls.length);
      for (const m of labelled) expect(text(m[1].replace(/<select\b[\s\S]*?<\/select>/g, '')).length, m[0].slice(0, 80)).toBeGreaterThan(0);
      // Radios share a name within their group, and the group has a legend.
      expect((main.match(/<fieldset class="mp-seg">\s*<legend\b/g) ?? []).length).toBe(2);
      // A remove button says what it removes.
      const removes = [...main.matchAll(/<button\b[^>]*class="mp-app__remove"[^>]*>/g)].map((m) => attr(m[0], 'aria-label') ?? '');
      expect(removes.length).toBeGreaterThanOrEqual(4);
      expect(new Set(removes).size).toBe(removes.length);
      for (const label of removes) expect(label).toContain(esc(ui.row.remove));
      // …and no button submits anything.
      for (const b of main.matchAll(/<button\b[^>]*>/g)) expect(attr(b[0], 'type'), b[0]).toBe('button');
    });

    it(`${lang}: the path home is Home, Resources, this page — in the breadcrumb and for search engines`, () => {
      const crumbs = main.match(/<ol class="mp-breadcrumbs">[\s\S]*?<\/ol>/)?.[0] ?? '';
      expect([...crumbs.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => [attr(m[1], 'href'), text(m[2])])).toEqual([
        [localePath('/', lang), c.ui.home],
        [localePath('/resources', lang), navLabelOf(c, '/resources')],
      ]);
      expect(text(crumbs.match(/<span aria-current="page">([\s\S]*?)<\/span>/)?.[1] ?? '')).toBe(s.h1);
      const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const list = ld.find((x) => x['@type'] === 'BreadcrumbList');
      expect(list.itemListElement.map((i: { item: string }) => i.item)).toEqual(['/', '/resources', BEAM_PATH].map((p) => absoluteUrl(localePath(p, lang))));
    });

    it(`${lang}: says how it is solved, what it assumes, what it does not do — and on what terms`, () => {
      const body = text(main);
      for (const p of [...s.method.paragraphs, ...s.assumes.items, ...s.limits.items, ...s.signs.items, s.disclaimer.body, ui.results.privacy, ui.results.signs]) {
        expect(body, p.slice(0, 50)).toContain(text(esc(p)));
      }
      expect(html).toContain(`<noscript><p class="mp-app__noscript">${esc(s.noscript)}</p></noscript>`);
    });

    it(`${lang}: leads back to the catalogue, and nowhere outside the site`, () => {
      const hrefs = [...main.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
      expect(hrefs.filter((x) => x === localePath('/resources', lang)).length).toBe(2);
      expect(hrefs.filter((x) => /^https?:|^tel:|^mailto:/.test(x))).toEqual([]);
    });
  }

  it('the two languages are the same page', () => {
    const shape = (lang: Lang) =>
      render(lang)
        .match(/<main\b[\s\S]*<\/main>/)![0]
        .replace(/>[^<]+</g, '><')
        .replace(/ (aria-label|title|placeholder|href|lang|d|points|x|y|x1|x2|y1|y2|cx|cy|width|height|text-anchor|viewBox)="[^"]*"/g, '')
        .match(/<\/?[a-z0-9]+/g)!
        .join('');
    expect(shape('es')).toBe(shape('en'));
  });
});

describe('beam calculator: what its script carries', () => {
  // The calculator is a client component: everything it imports goes to the
  // browser. Its own words and its engine, yes; the site's whole copy
  // (site.ts, read through content.ts), the catalogue or the city pages, no.
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
      const code = readFileSync(file, 'utf8');
      // Value imports only: `import type` and `import { type X }` alone carry no code.
      for (const m of code.matchAll(/^\s*(import|export)\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
        const names = m[2];
        if (/^\{[^}]*\}$/.test(names.trim()) && names.replace(/[{}]/g, '').split(',').every((n) => /^\s*type\s/.test(n) || n.trim() === '')) continue;
        const next = resolveImport(file, m[3]);
        if (next) walk(next);
      }
      for (const m of code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const next = resolveImport(file, m[1]);
        if (next) walk(next);
      }
    };
    walk(entry);
    return [...seen].map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'));
  };

  it('its engine, its words, the shape table — and none of the site’s copy', () => {
    const files = reach(join(SRC, 'components/ttc/calc/beam/BeamCalculator.tsx'));
    expect(files).toEqual(
      expect.arrayContaining(['lib/calc/beam/solver.ts', 'lib/calc/beam/model.ts', 'lib/calc/beam/strings.ts', 'lib/calc/format.ts', 'lib/steel/aisc-shapes.json', 'components/ttc/calc/NumField.tsx']),
    );
    const forbidden = files.filter((f) => /^lib\/ttc\/(site|site\.es|content|calculators|cities|city-)/.test(f) || /lib\/beam-analysis|lib\/beam\/|lib\/advanced-beam/.test(f));
    expect(forbidden).toEqual([]);
    // Nothing of the retired calculators' interface either.
    expect(files.filter((f) => /^components\/ttc\/(beam|advanced-beam|steel)\//.test(f))).toEqual([]);
  });

  it('the shape table is fetched when asked for, not with the page', () => {
    const code = readFileSync(join(SRC, 'components/ttc/calc/beam/BeamCalculator.tsx'), 'utf8');
    expect(code).toMatch(/import\('@\/lib\/steel\/aisc-shapes\.json'\)/);
    expect(code).not.toMatch(/^import .*aisc-shapes\.json/m);
  });
});
