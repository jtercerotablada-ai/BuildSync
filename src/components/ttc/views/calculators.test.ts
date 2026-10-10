import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import sitemap from '@/app/sitemap';
import {
  CALCULATOR_ICON_PX,
  calculatorCount,
  calculatorFamilies,
  calculatorIcons,
  calculatorsPage,
  type CalculatorIcon,
} from '@/lib/ttc/calculators';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { DESCRIPTION_LIMIT_PX, TITLE_BUDGET_PX, descriptionPx, repeatedWords, titlePx, unmeasured } from '@/lib/ttc/serp';
import { absoluteUrl } from '@/lib/ttc/site';
import { EN_PUBLIC_PAGES, ES_PUBLIC_PAGES, PUBLIC_NOT_FOUND, PUBLIC_NOT_FOUND_ES, publicNotFoundTarget } from '@/proxy';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { CalculatorsView } from './CalculatorsView';
import { pageMeta } from './meta';

/**
 * THE CALCULATORS CATALOGUE: /resources and /es/resources.
 *
 * The owner asked for one page that lists every calculator, none of them
 * built yet, under the sixteen icons he drew. A page like that is easy to
 * get wrong in ways no build notices: an entry in one language only, a
 * calculator said to be open, a vendor's name copied in with a list, an icon
 * that is not his or that points at no file, the page indexed and linked
 * before there is anything on it. These hold it to what calculators.ts says
 * it is.
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const SRC = resolve(__dirname, '..', '..', '..');
const PUBLIC = resolve(SRC, '..', 'public');
const items = calculatorFamilies.flatMap((g) => g.items);
const iconKeys = Object.keys(calculatorIcons) as CalculatorIcon[];
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const render = (lang: Lang) => {
  route.pathname = localePath('/resources', lang);
  return renderToStaticMarkup(h(SiteChrome, null, h(CalculatorsView, { lang })));
};

describe('calculators: the list', () => {
  it('has its families, each with calculators, and counts them itself', () => {
    expect(calculatorFamilies.length).toBeGreaterThanOrEqual(12);
    for (const g of calculatorFamilies) {
      expect(g.id, g.id).toMatch(/^[a-z]+$/);
      expect(g.items.length, g.id).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(calculatorFamilies.map((g) => g.id)).size).toBe(calculatorFamilies.length);
    expect(calculatorCount).toBe(items.length);
    expect(calculatorCount).toBeGreaterThanOrEqual(90);
  });

  for (const lang of LANGS) {
    it(`${lang}: every family and every calculator has a name and one line on what it computes`, () => {
      for (const g of calculatorFamilies) expect(g.title[lang].trim().length, g.id).toBeGreaterThan(3);
      for (const item of items) {
        expect(item.name[lang].trim().length, item.name.en).toBeGreaterThan(3);
        expect(item.does[lang].trim().length, item.name.en).toBeGreaterThan(20);
        expect(item.does[lang], item.name.en).toMatch(/[.]$/);
        expect(item.does[lang].length, item.name.en).toBeLessThan(170);
      }
    });

    it(`${lang}: no two calculators share a name or a description, and no two families a title`, () => {
      expect(new Set(items.map((i) => i.name[lang])).size).toBe(items.length);
      expect(new Set(items.map((i) => i.does[lang])).size).toBe(items.length);
      expect(new Set(calculatorFamilies.map((g) => g.title[lang])).size).toBe(calculatorFamilies.length);
    });

    it(`${lang}: says nothing about a date, a price or being free`, () => {
      const said = [...Object.values(calculatorsPage[lang]), ...items.flatMap((i) => [i.name[lang], i.does[lang]])].join(' ');
      expect(said).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\bcoming soon\b|\bpróximamente\b|\b20\d\d\b|\$|\bprice\b|\bprecio\b|subscri|suscrip/i);
    });

    // The owner asked for the titles to be ours, not the starting list's,
    // where every entry is "… Calculator". A name says what is solved; the
    // page already says what kind of thing it is.
    it(`${lang}: a name says what is solved, and never "calculator"`, () => {
      for (const item of items) expect(item.name[lang], item.name.en).not.toMatch(/calculator|calculadora|\btool\b|herramienta/i);
      // A sentence is the second line's job.
      for (const item of items) expect(item.name[lang], item.name.en).not.toMatch(/[.:;]/);
    });
  }

  it('a design standard is a short designation, written once per calculator', () => {
    for (const item of items) {
      for (const code of item.codes ?? []) expect(code, item.name.en).toMatch(/^[A-Z][A-Za-z0-9 ./-]{1,14}$/);
      expect(new Set(item.codes ?? []).size, item.name.en).toBe((item.codes ?? []).length);
    }
  });

  // The list is the firm's own. No vendor's name — and no tool a vendor
  // built for one of its clients — belongs in it, here or in the view.
  it('names no other company’s product', () => {
    const VENDORS = /skyciv|quick design|clearcalcs|calcbook|enercalc|tedds|cupolex|structic|quickframes|italfaber|ennova|mpads|k-brb/i;
    expect(JSON.stringify(calculatorFamilies) + JSON.stringify(calculatorsPage) + JSON.stringify(calculatorIcons)).not.toMatch(VENDORS);
    for (const f of ['lib/ttc/calculators.ts', 'components/ttc/views/CalculatorsView.tsx']) {
      expect(readFileSync(join(SRC, f), 'utf8'), f).not.toMatch(/skyciv|quick design/i);
    }
  });

  // None is built. The day one is, its entry gets an href — and the route
  // file says what else changes that day.
  it('no calculator is open yet, and the page says so', () => {
    expect(items.filter((i) => i.href)).toEqual([]);
    expect(calculatorsPage.en.sub).toMatch(/None is open yet/);
    expect(calculatorsPage.es.sub).toMatch(/Ninguna está abierta todavía/);
  });
});

describe('calculators: the icons are the owner’s sixteen', () => {
  // He drew sixteen and said what each stands for. None of ours, none
  // missing, none left unused.
  it('there are sixteen, and every one heads a family', () => {
    expect(iconKeys).toHaveLength(16);
    const used = new Set(calculatorFamilies.flatMap((g) => g.icons));
    expect([...used].sort()).toEqual([...iconKeys].sort());
  });

  it('a family has one icon — steel connections alone has two, the bolts and the welds it is made of', () => {
    for (const g of calculatorFamilies) {
      if (g.id === 'connections') expect(g.icons).toEqual(['bolts', 'weld']);
      else expect(g.icons, g.id).toHaveLength(1);
    }
    // …and outside that pair, no icon stands for two families.
    const heads = calculatorFamilies.filter((g) => g.id !== 'connections').map((g) => g.icons[0]);
    expect(new Set(heads).size).toBe(heads.length);
  });

  // What he said each drawing stands for: the calculator he named first for
  // it sits under it. (Names are ours; the pairing is his.)
  it('each icon sits over the calculators he drew it for', () => {
    const under: Record<CalculatorIcon, string> = {
      beam: 'Single-span beam',
      truss: 'Truss member forces',
      frame: 'Plane frame analysis',
      buckling: 'Column buckling load',
      section: 'Inertia and centroid of any shape',
      steel: 'Wide-flange beam capacity',
      timber: 'Roof rafters',
      concrete: 'Punching shear at columns',
      footing: 'Wall footings',
      retainingWall: 'Retaining wall stability',
      bolts: 'Bolt tightening torque',
      weld: 'Weld group in eccentric load',
      wind: 'Gust-effect factor',
      snow: 'Snow drift at roof steps',
      seismic: 'Seismic design parameters',
      pitch: 'Roof pitch and rafter length',
    };
    for (const key of iconKeys) {
      const family = calculatorFamilies.find((g) => g.icons[0] === key && g.id !== 'connections');
      expect(family?.items.map((i) => i.name.en), key).toContain(under[key]);
    }
  });

  it('every icon is a file of the size the page declares, and a small one', () => {
    for (const key of iconKeys) {
      const { src } = calculatorIcons[key];
      expect(src, key).toMatch(/^\/ttc\/img\/calc\/[a-z-]+\.png$/);
      const file = join(PUBLIC, src);
      expect(existsSync(file), src).toBe(true);
      const bytes = readFileSync(file);
      // PNG: the signature, then IHDR with the width and the height.
      expect(bytes.subarray(1, 4).toString('latin1'), src).toBe('PNG');
      expect(bytes.readUInt32BE(16), src).toBe(CALCULATOR_ICON_PX);
      expect(bytes.readUInt32BE(20), src).toBe(CALCULATOR_ICON_PX);
      // Colour type 3 is a palette, 6 is RGBA: either way it has its
      // transparency — the drawing sits on the page's own graphite.
      expect([3, 6], src).toContain(bytes[25]);
      expect(bytes.length, src).toBeLessThan(8 * 1024);
    }
    // …and the folder holds nothing else.
    expect(readdirSync(join(PUBLIC, 'ttc', 'img', 'calc')).sort()).toEqual(
      iconKeys.map((key) => calculatorIcons[key].src.split('/').pop()!).sort(),
    );
  });

  it('every icon is described, in English and in Spanish, by what the drawing shows', () => {
    for (const key of iconKeys) {
      const { alt } = calculatorIcons[key];
      expect(alt.en.trim().length, key).toBeGreaterThan(15);
      expect(alt.es.trim().length, key).toBeGreaterThan(15);
      expect(alt.es, key).not.toBe(alt.en);
      expect(alt.en + alt.es, key).not.toMatch(/\d|calculator|calculadora/i);
    }
    expect(new Set(iconKeys.map((key) => calculatorIcons[key].alt.en)).size).toBe(16);
    expect(new Set(iconKeys.map((key) => calculatorIcons[key].alt.es)).size).toBe(16);
  });
});

describe('calculators: the page', () => {
  for (const lang of LANGS) {
    const html = render(lang);
    const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
    const t = calculatorsPage[lang];
    const nav = main.match(/<nav class="mp-calcnav[^"]*"[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? '';
    const lists = [...main.matchAll(/<ul class="mp-calc__list">([\s\S]*?)<\/ul>/g)].map((m) => m[1]);

    it(`${lang}: one h1, one h2 per family, and no calculator set as a heading`, () => {
      expect([...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]))).toEqual([t.h1]);
      expect([...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(m[1]))).toEqual(
        calculatorFamilies.map((g) => text(esc(g.title[lang]))),
      );
      expect(main).not.toMatch(/<h[3-6]\b/);
    });

    it(`${lang}: every calculator is a row — its name, what it computes, its standards`, () => {
      expect(lists).toHaveLength(calculatorFamilies.length);
      calculatorFamilies.forEach((g, i) => {
        const rows = [...lists[i].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
        expect(rows, g.id).toHaveLength(g.items.length);
        g.items.forEach((item, j) => {
          expect(rows[j].startsWith(`${text(esc(item.name[lang]))} ${text(esc(item.does[lang]))}`), rows[j]).toBe(true);
          if (item.codes?.length) expect(rows[j].endsWith(`${t.codes}: ${item.codes.join(' · ')}`), rows[j]).toBe(true);
        });
      });
    });

    it(`${lang}: the first screen says how many there are and that none is open`, () => {
      expect(text(main)).toContain(text(esc(t.sub)));
      expect(text(main)).toContain(`${calculatorCount} ${t.planned}`);
    });

    // The index: one link per family, in the order of the page, each to a
    // block that is on it — and to that block only.
    it(`${lang}: the index has one link per family, and every link lands on its block`, () => {
      expect(attr(nav.match(/<nav\b[^>]*>/)?.[0] ?? '', 'aria-label')).toBe(esc(t.index));
      const links = [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
        href: attr(m[1], 'href'),
        // What a screen reader says: the count is in the block itself.
        said: text(m[2].replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '')),
      }));
      expect(links).toEqual(calculatorFamilies.map((g) => ({ href: `#${g.id}`, said: text(esc(g.title[lang])) })));
      for (const g of calculatorFamilies) {
        expect(html.split(` id="${g.id}"`).length - 1, g.id).toBe(1);
      }
    });

    // Every drawing twice — in the index and on its family's tile — and each
    // time as the site's photographs are: described, and silent, because the
    // family's name is printed beside it.
    it(`${lang}: every icon is on the page with its description, silent, sized and lazy`, () => {
      const tags = [...main.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
      const expected = calculatorFamilies.flatMap((g) => g.icons);
      expect(tags.map((tag) => attr(tag, 'src'))).toEqual([...expected, ...expected].map((key) => calculatorIcons[key].src));
      tags.forEach((tag, i) => {
        const key = [...expected, ...expected][i];
        expect(attr(tag, 'alt'), tag).toBe(esc(calculatorIcons[key].alt[lang]));
        expect(attr(tag, 'aria-hidden'), tag).toBe('true');
        expect(attr(tag, 'width'), tag).toBe(String(CALCULATOR_ICON_PX));
        expect(attr(tag, 'height'), tag).toBe(String(CALCULATOR_ICON_PX));
        expect(attr(tag, 'loading'), tag).toBe('lazy');
      });
    });

    it(`${lang}: no calculator is a link, and the page links to nothing outside the site`, () => {
      expect(lists.join('')).not.toMatch(/<a\b/);
      expect(main).not.toMatch(/href="https?:/);
    });

    it(`${lang}: title and description fit a search result`, () => {
      const meta = pageMeta(lang, '/resources', { title: t.title, description: t.description });
      const title = (meta.title as { absolute: string }).absolute;
      expect(unmeasured(title)).toEqual([]);
      expect(titlePx(title)).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      expect(repeatedWords(title)).toEqual([]);
      expect(unmeasured(t.description)).toEqual([]);
      expect(descriptionPx(t.description)).toBeLessThanOrEqual(DESCRIPTION_LIMIT_PX);
    });
  }

  it('the two languages are the same page: same families, same anchors, same icons', () => {
    const ids = (lang: Lang) => [...render(lang).matchAll(/<div id="([a-z]+)" class="mp-calc">/g)].map((m) => m[1]);
    expect(ids('es')).toEqual(ids('en'));
    expect(ids('en')).toEqual(calculatorFamilies.map((g) => g.id));
  });
});

describe('calculators: where the page is, and where it is not yet', () => {
  it('/resources and /es/resources are pages; nothing under them is', () => {
    expect(EN_PUBLIC_PAGES).toContain('/resources');
    expect(ES_PUBLIC_PAGES).toContain('/es/resources');
    expect(publicNotFoundTarget('/resources')).toBeNull();
    expect(publicNotFoundTarget('/es/resources')).toBeNull();
    for (const path of ['/resources/beam', '/resources/steel-member', '/resources/load-gen', '/resources/a/b']) {
      expect(publicNotFoundTarget(path), path).toBe(PUBLIC_NOT_FOUND);
      expect(publicNotFoundTarget(`/es${path}`), path).toBe(PUBLIC_NOT_FOUND_ES);
    }
  });

  // A list of calculators that do not exist is not a page to be found for:
  // out of the sitemap, noindex (the two route files), linked from nowhere.
  it('is not in the sitemap', () => {
    const urls = sitemap().map((e) => e.url);
    for (const lang of LANGS) expect(urls).not.toContain(absoluteUrl(localePath('/resources', lang)));
  });

  it('both routes declare noindex', () => {
    for (const f of ['(public)/(site)/resources/page.tsx', '(public-es)/(site)/es/resources/page.tsx']) {
      expect(readFileSync(join(SRC, 'app', f), 'utf8'), f).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
    }
  });

  it('no page of the site links to it yet: not the header, not the footer, not the content', () => {
    for (const lang of LANGS) {
      const c = getContent(lang);
      const hrefs = [...c.primaryNav.map((n) => n.href), ...c.footerNav.flatMap((g) => g.items.map((n) => n.href))];
      expect(hrefs.filter((x) => x.startsWith('/resources'))).toEqual([]);
    }
    // …and no source file other than the page's own writes the address.
    // (lib/resources/ is what is left of the calculators retired earlier:
    // their old catalogue, which no page imports.)
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return files(full);
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
      });
    const own = /resources[\\/](page|\[\.\.\.rest\][\\/]page)\.tsx$|calculators\.ts$|CalculatorsView\.tsx$|proxy\.ts$|lib[\\/]resources[\\/]/;
    const linking = files(SRC)
      .filter((f) => !own.test(f))
      .filter((f) => /(href|path)[=:]\s*[{'"`]+\/resources\b/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'));
    expect(linking).toEqual([]);
  });
});
