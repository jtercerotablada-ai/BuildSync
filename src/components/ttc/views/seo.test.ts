import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import sitemap from '@/app/sitemap';
import { getContent } from '@/lib/ttc/content';
import { LANGS, localePath, type Lang } from '@/lib/ttc/i18n';
import {
  DESCRIPTION_LIMIT_PX,
  TITLE_BUDGET_PX,
  TITLE_LIMIT_PX,
  descriptionPx,
  repeatedWords,
  titlePx,
  unmeasured,
} from '@/lib/ttc/serp';
import { company } from '@/lib/ttc/site';
import { AboutView } from './AboutView';
import { ExistingView } from './ExistingView';
import { ServicesView } from './ServicesView';
import { WorkView } from './WorkView';
import { brandedTitle, pageMeta } from './meta';
import { SEO } from './seo';

/**
 * What a search result shows of each page — its title and its description —
 * and the H1 the page opens with.
 *
 * On October 7, 2026 the owner's on-page check found all 32 titles too long
 * to be shown whole, because every one of them ended in the firm's full
 * name, and several H1s that were a slogan with no word of the page's
 * subject. Nothing in the build notices either: a title is a string. These
 * tests build the metadata of every page in the sitemap exactly as the
 * routes do (`pageMeta`) and measure it on the check's own ruler (serp.ts).
 */

// The client pieces of a page (hero, closing band) read the language from
// the URL; outside Next there is none, so the test supplies the page's own.
const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const STATIC = [
  ['/', 'home'],
  ['/services', 'services'],
  ['/existing-buildings', 'existing'],
  ['/projects', 'work'],
  ['/about', 'about'],
  ['/contact', 'contact'],
  ['/privacy', 'privacy'],
  ['/terms', 'terms'],
] as const;

type Page = {
  /** The address, as the sitemap prints it. */
  url: string;
  /** The title as written in seo.ts / site.ts — no firm in it. */
  written: string;
  /** The <title> the page is served with. */
  title: string;
  ogTitle: string;
  description: string;
};

const pages: Page[] = LANGS.flatMap((lang) =>
  [
    ...STATIC.map(([path, key]) => [path, SEO[lang][key]] as const),
    // What `services/[slug]/page.tsx` hands to pageMeta.
    ...getContent(lang).services.map(
      (s) => [`/services/${s.slug}`, { title: s.seo.title, description: s.seo.description }] as const,
    ),
  ].map(([path, seo]) => {
    const meta = pageMeta(lang, path, seo);
    const here = localePath(path, lang);
    return {
      url: `${company.url}${here === '/' ? '' : here}`,
      written: seo.title,
      title: (meta.title as { absolute: string }).absolute,
      ogTitle: String(meta.openGraph?.title),
      description: String(meta.description),
    };
  }),
);

describe('the ruler: Arial, as the check measures it', () => {
  // The ten titles the report lists, with the widths IT printed. They are
  // the old titles on purpose: they are the only numbers that come from the
  // check itself. Its figures run up to 7 px over ours (never 1 %), which
  // is the drift TITLE_BUDGET_PX keeps back.
  const FIRM = 'Tercero Tablada Civil and Structural Engineering Inc.';
  const REPORTED: [title: string, px: number][] = [
    [`Structural Engineering for South Florida | ${FIRM}`, 840],
    [`Structural Engineering Services — Miami-Dade & Broward · ${FIRM}`, 1010],
    [`Request a Structural Engineering Proposal · ${FIRM}`, 869],
    [`Existing Buildings — Recertification, BSIP & Repairs · ${FIRM}`, 957],
    [`About — Juan Tercero, PE., M.Sc. · ${FIRM}`, 795],
    [`Ingeniería estructural para el Sur de Florida | ${FIRM}`, 874],
    [`Structural Assessments & Repair Design — Miami-Dade & Broward · ${FIRM}`, 1092],
    [`Miami-Dade Building Recertification (formerly 40-Year) — Structural Engineer · ${FIRM}`, 1178],
    [`Broward BSIP (formerly 40-Year Recertification) — Structural Engineer · ${FIRM}`, 1119],
    [`Reinforced Concrete Design — Miami-Dade & Broward · ${FIRM}`, 981],
  ];

  it('agrees with the widths the report printed, within 1 %', () => {
    for (const [title, px] of REPORTED) {
      expect(Math.abs(titlePx(title) - px) / px, title).toBeLessThan(0.01);
      expect(px - titlePx(title), title).toBeLessThanOrEqual(TITLE_LIMIT_PX - TITLE_BUDGET_PX);
    }
  });

  it('measures the one description the report measured', () => {
    const milestone =
      'Florida milestone inspections for condos and co-ops in Miami-Dade and Broward: how the county program meets them, phase two, and structural safety inspections.';
    expect(descriptionPx(milestone)).toBe(1012);
  });

  it('knows what the firm costs a title: the full name, and the short one', () => {
    expect(titlePx(company.name)).toBe(469);
    expect(titlePx(brandedTitle(''))).toBe(165);
  });

  it('counts a word twice only when it is the same word', () => {
    expect(repeatedWords('About — Juan Tercero, PE., M.Sc. · Tercero Tablada')).toEqual(['tercero']);
    expect(repeatedWords('Miami-Dade Building Recertification (formerly 40-Year)')).toEqual([]);
    // Three letters do not count, capitals do not matter, and "engineer"
    // is not "engineering".
    expect(repeatedWords('BIM for BIM: structural engineer, Structural Engineering')).toEqual([
      'structural',
    ]);
  });
});

describe('titles and descriptions: every page in the sitemap', () => {
  it('measures the pages the sitemap lists, and no others', () => {
    expect(pages.map((p) => p.url).sort()).toEqual(sitemap().map((e) => e.url).sort());
    expect(pages).toHaveLength(32);
  });

  for (const p of pages) {
    describe(p.url, () => {
      it('title: every character has a width', () => {
        expect(unmeasured(p.title), 'add these to the ARIAL table in serp.ts').toEqual([]);
      });

      it(`title fits a search result (${titlePx(p.title)} px): ${p.title}`, () => {
        expect(titlePx(p.title)).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      });

      it('title repeats no word', () => {
        expect(repeatedWords(p.title)).toEqual([]);
      });

      // The short name, and only through pageTitle: typed into a title, the
      // firm would be there twice wherever the brand also fits.
      it('title is written without the firm', () => {
        expect(p.written).not.toContain(company.shortName);
        expect(p.title).not.toContain(company.name);
      });

      it('title ends in the short name where it fits, and only there', () => {
        const branded = brandedTitle(p.written);
        const fits = titlePx(branded) <= TITLE_BUDGET_PX && repeatedWords(branded).length === 0;
        expect(p.title).toBe(fits ? branded : p.written);
      });

      // A share card is not cut at 580 px: it keeps the full name.
      it('share card names the firm in full, once', () => {
        expect(p.ogTitle.split(company.name)).toHaveLength(2);
        expect(p.ogTitle.startsWith(p.written)).toBe(true);
      });

      it(`description fits a search result (${descriptionPx(p.description)} px)`, () => {
        expect(unmeasured(p.description), 'add these to the ARIAL table in serp.ts').toEqual([]);
        expect(descriptionPx(p.description)).toBeLessThanOrEqual(DESCRIPTION_LIMIT_PX);
      });
    });
  }

  it('no two pages share a title or a description', () => {
    expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length);
    expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length);
  });

  it('the home page keeps the approved tagline, with the brand after it', () => {
    const titles = pages.map((p) => p.title);
    expect(titles).toContain('Structural Engineering for South Florida · Tercero Tablada');
    expect(titles).toContain('Ingeniería estructural para el Sur de Florida · Tercero Tablada');
  });

  // The name people still type, as a former name — never dropped to save room.
  it('the two county programs keep "formerly 40-Year" in their titles', () => {
    for (const slug of ['building-recertification', 'broward-bsip']) {
      const en = pages.find((p) => p.url === `${company.url}/services/${slug}`)?.title;
      const es = pages.find((p) => p.url === `${company.url}/es/services/${slug}`)?.title;
      expect(en).toMatch(/formerly 40-Year/);
      expect(es).toMatch(/antes (recertificación |“)de 40 años/);
    }
  });

  it('the routes outside pageMeta fit through the layout template too', () => {
    for (const lang of LANGS) {
      const ui = getContent(lang).ui;
      for (const title of [ui.notFound.metaTitle, ui.footer.imageCredits]) {
        expect(titlePx(brandedTitle(title))).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      }
    }
  });
});

/**
 * The four pages whose H1 was a slogan. The H1 now names the subject and the
 * place, and the slogan opens the line under it.
 *
 * The check's own test for an H1 is literal: a word of the H1 that appears
 * nowhere else on the page is a word the page is not about ("accountable",
 * "Organized"). It knows no synonyms and no plurals, and neither does this.
 * The page is rendered without the header and the footer, so the test is a
 * little stricter than the check.
 */
describe('H1: the subject and the place, in words the page uses', () => {
  const VIEWS: [path: string, key: (typeof STATIC)[number][1], view: (lang: Lang) => ReactElement][] = [
    ['/services', 'services', (lang) => h(ServicesView, { lang })],
    ['/existing-buildings', 'existing', (lang) => h(ExistingView, { lang })],
    ['/about', 'about', (lang) => h(AboutView, { lang })],
    ['/projects', 'work', (lang) => h(WorkView, { lang })],
  ];
  // What each page opened with before, word for word: it must still be read.
  const SLOGAN: Record<Lang, Record<string, string>> = {
    en: {
      '/services': 'Organized by what you need, not by what we do.',
      '/existing-buildings': 'The building is already standing.',
      '/about': 'A structural practice built around one accountable engineer.',
      '/projects': 'The frame behind the project.',
    },
    es: {
      '/services': 'Organizados por lo que usted necesita, no por lo que hacemos.',
      '/existing-buildings': 'El edificio ya está en pie.',
      '/about': 'Una firma de ingeniería estructural con un solo ingeniero responsable.',
      '/projects': 'La estructura detrás del proyecto.',
    },
  };
  const PLACE = /Miami-Dade (and|y) Broward|South Florida|Sur de Florida/;

  const text = (html: string) =>
    html
      .replace(/<(script|style)\b.*?<\/\1>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  const words = (s: string) =>
    (s.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,}/g) ?? []).map((w) => w.toLowerCase());
  // Capitals, dashes and the full stop are not a difference; "in" and "and"
  // are — a title is a label and an H1 is a sentence about the same thing.
  const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g, '');

  for (const lang of LANGS) {
    for (const [path, key, view] of VIEWS) {
      route.pathname = localePath(path, lang);
      const html = renderToStaticMarkup(view(lang));
      const h1s: string[] = html.match(/<h1\b.*?<\/h1>/g) ?? [];
      const h1Html = h1s[0] ?? '';
      const h1 = text(h1Html);
      const rest = text(html.replace(/<h1\b.*?<\/h1>/g, ' '));
      const name = localePath(path, lang);

      it(`${name}: one H1, and it names the place — ${h1}`, () => {
        expect(h1s).toHaveLength(1);
        expect(h1).toMatch(PLACE);
      });

      it(`${name}: every word of the H1 is a word of the page`, () => {
        const body = new Set(words(rest));
        expect(words(h1).filter((w) => !body.has(w))).toEqual([]);
      });

      it(`${name}: the H1 is not the page title over again`, () => {
        expect(letters(h1)).not.toBe(letters(SEO[lang][key].title));
      });

      it(`${name}: the line it replaced opens the lede`, () => {
        const sub = html.match(/<p class="mp-phero__sub[^>]*>(.*?)<\/p>/)?.[1] ?? '';
        expect(text(sub).startsWith(SLOGAN[lang][path])).toBe(true);
      });

      // The accent is set not to wrap (mp.css): one short phrase, or it runs
      // off a phone screen.
      it(`${name}: the accent is one short phrase`, () => {
        const accents = [...h1Html.matchAll(/<span class="mp-serif">(.*?)<\/span>/g)].map(
          (m) => m[1] ?? '',
        );
        expect(accents).toHaveLength(1);
        expect(accents.join('').length).toBeLessThanOrEqual(16);
      });
    }
  }
});
