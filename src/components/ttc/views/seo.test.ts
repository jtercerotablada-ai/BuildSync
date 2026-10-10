import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import sitemap from '@/app/sitemap';
import { getContent } from '@/lib/ttc/content';
import { LANGS, hreflangFor, localePath, type Lang } from '@/lib/ttc/i18n';
import {
  DESCRIPTION_LIMIT_PX,
  TITLE_BUDGET_PX,
  TITLE_LIMIT_PX,
  descriptionPx,
  repeatedWords,
  titlePx,
  unmeasured,
} from '@/lib/ttc/serp';
import { absoluteUrl, company } from '@/lib/ttc/site';
import { cityPath } from '@/lib/ttc/cities';
import { cityPagesEn } from '@/lib/ttc/cities.en';
import { getCityPages } from '@/lib/ttc/city-content';
import { citySeo } from '@/lib/ttc/city-seo';
import { AboutView } from './AboutView';
import { calculatorsPage } from '@/lib/ttc/calculators';
import { openCalculatorPaths } from '@/lib/ttc/calculator-paths';
import { beamStrings } from '@/lib/calc/beam/strings';
import { BEAM_PATH, BeamCalculatorView } from './BeamCalculatorView';
import { CalculatorsView } from './CalculatorsView';
import { CityView } from './CityView';
import { ContactView } from './ContactView';
import { ExistingView } from './ExistingView';
import { HomeView } from './HomeView';
import { LegalView } from './LegalView';
import { ServiceDetailView } from './ServiceDetailView';
import { ServicesView } from './ServicesView';
import { WorkView } from './WorkView';
import { HomeAddress, brandedTitle, pageMeta } from './meta';
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
  /** The page's canonical (English) path and its language. */
  path: string;
  lang: Lang;
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
    // What `services/[slug]/[city]/page.tsx` hands to pageMeta.
    ...getCityPages(lang).map((p) => [cityPath(p), citySeo(lang, p)] as const),
    // The calculators catalogue, and the calculators that are open.
    ['/resources', { title: calculatorsPage[lang].title, description: calculatorsPage[lang].description }] as const,
    [BEAM_PATH, { title: beamStrings[lang].page.title, description: beamStrings[lang].page.description }] as const,
  ].map(([path, seo]) => {
    const meta = pageMeta(lang, path, seo);
    return {
      path,
      lang,
      url: absoluteUrl(localePath(path, lang)),
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
    // Sixteen pages in each language, one more for every city page, and the
    // calculators: their catalogue and each one that is open.
    expect(pages).toHaveLength(2 * (16 + cityPagesEn.length + 1 + openCalculatorPaths.length));
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
 * How each address is declared: the canonical, the hreflang set, og:url and
 * the sitemap must print one string per page.
 *
 * The second run of the owner's check (October 7, 2026) listed one internal
 * redirect: `https://ttcivilstructural.com` → `https://ttcivilstructural.com/`,
 * "linked via canonical link, alternate link". Next's metadata prints the
 * root path as the bare origin whatever it is handed, so the two home pages
 * print their own address (HomeAddress, meta.tsx) and `pageMeta` leaves it
 * out for them — and only for them.
 */
describe('addresses: one string per page, and the home page keeps its slash', () => {
  const HOME = `${company.url}/`;
  const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
  const tags = (html: string, re: RegExp) => html.match(re) ?? [];

  it('the bare origin is never an address: the home page is the origin and a slash', () => {
    expect(absoluteUrl('/')).toBe(HOME);
    expect(absoluteUrl('/es')).toBe(`${company.url}/es`);
    for (const e of sitemap()) {
      expect(e.url).not.toBe(company.url);
      for (const href of Object.values(e.alternates?.languages ?? {})) {
        expect(href).not.toBe(company.url);
      }
    }
  });

  it('the sitemap lists the home page with its slash, and points en and x-default at it', () => {
    const entries = sitemap().filter((e) => e.url === HOME || e.url === `${company.url}/es`);
    expect(entries.map((e) => e.url)).toEqual([HOME, `${company.url}/es`]);
    for (const e of entries) {
      expect(e.alternates?.languages).toEqual({
        en: HOME,
        es: `${company.url}/es`,
        'x-default': HOME,
      });
    }
  });

  for (const lang of LANGS) {
    const here = absoluteUrl(localePath('/', lang));
    const html = renderToStaticMarkup(h(HomeAddress, { lang }));

    it(`${here}: one canonical, its own address`, () => {
      const canonical = tags(html, /<link\b[^>]*rel="canonical"[^>]*>/g);
      expect(canonical.map((t) => attr(t, 'href'))).toEqual([here]);
    });

    // The same three, in the same order, as every other page (hreflangFor)
    // and as this page's sitemap entry.
    it(`${here}: one set of alternates, the ones the sitemap lists for it`, () => {
      const alternates = tags(html, /<link\b[^>]*rel="alternate"[^>]*>/g);
      const printed = Object.fromEntries(
        alternates.map((t) => [attr(t, 'hrefLang'), attr(t, 'href')]),
      );
      expect(alternates).toHaveLength(Object.keys(hreflangFor('/')).length);
      expect(printed).toEqual(sitemap().find((e) => e.url === here)?.alternates?.languages);
    });

    it(`${here}: og:url is the canonical`, () => {
      const og = tags(html, /<meta\b[^>]*property="og:url"[^>]*>/g);
      expect(og.map((t) => attr(t, 'content'))).toEqual([here]);
    });

    // Both at once would be two canonicals in one <head>.
    it(`${here}: the metadata declares none of the three`, () => {
      const meta = pageMeta(lang, '/', SEO[lang].home);
      expect(meta.alternates).toBeUndefined();
      expect(meta.openGraph).not.toHaveProperty('url');
    });
  }

  // HomeView is the only view that prints HomeAddress, and prints it once:
  // on any other page the metadata's own canonical would be there too.
  it('only the two home pages print a canonical themselves, and they print one', () => {
    for (const r of rendered) {
      const printed = r.html.match(/<link\b[^>]*rel="canonical"/g) ?? [];
      expect(printed, localePath(r.path, r.lang)).toHaveLength(r.path === '/' ? 1 : 0);
    }
  });

  it('every other page declares its address through the metadata', () => {
    for (const p of pages.filter((x) => x.path !== '/')) {
      const seo = { title: p.written, description: p.description };
      const meta = pageMeta(p.lang, p.path, seo);
      const here = localePath(p.path, p.lang);
      expect(meta.alternates, p.url).toEqual({ canonical: here, languages: hreflangFor(p.path) });
      expect(meta.openGraph, p.url).toHaveProperty('url', here);
      // What Next makes of the path — the sitemap's string.
      expect(new URL(here, company.url).href, p.url).toBe(p.url);
    }
  });

  // <link rel="author">. Next prints its url as written, and the (public)
  // layout writes the bare origin; every page that goes through pageMeta
  // replaces it.
  it('the author link on every page is the home page, with its slash', () => {
    for (const p of pages) {
      const meta = pageMeta(p.lang, p.path, { title: p.written, description: p.description });
      expect(meta.authors, p.url).toEqual([{ name: company.legalName, url: HOME }]);
    }
  });
});

/** A page's text, the way the check reads it: no tags, no scripts. */
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

/** Every page of the sitemap, as its route renders it (no header, no footer). */
function views(lang: Lang): [path: string, view: ReactElement][] {
  return [
    ['/', h(HomeView, { lang })],
    ['/services', h(ServicesView, { lang })],
    ['/existing-buildings', h(ExistingView, { lang })],
    ['/projects', h(WorkView, { lang })],
    ['/about', h(AboutView, { lang })],
    ['/contact', h(ContactView, { lang })],
    ['/privacy', h(LegalView, { lang, kind: 'privacy' })],
    ['/terms', h(LegalView, { lang, kind: 'terms' })],
    ...getContent(lang).services.map(
      (s): [string, ReactElement] => [
        `/services/${s.slug}`,
        h(ServiceDetailView, { lang, slug: s.slug }),
      ],
    ),
    ...getCityPages(lang).map(
      (p): [string, ReactElement] => [
        cityPath(p),
        h(CityView, { lang, program: p.program, slug: p.slug }),
      ],
    ),
    ['/resources', h(CalculatorsView, { lang })],
    [BEAM_PATH, h(BeamCalculatorView, { lang })],
  ];
}

type Rendered = { lang: Lang; path: string; html: string; h1s: string[]; h1Html: string; h1: string; rest: string };
const rendered: Rendered[] = LANGS.flatMap((lang) =>
  views(lang).map(([path, view]) => {
    route.pathname = localePath(path, lang);
    const html = renderToStaticMarkup(view);
    const h1s: string[] = html.match(/<h1\b.*?<\/h1>/g) ?? [];
    const h1Html = h1s[0] ?? '';
    return {
      lang,
      path,
      html,
      h1s,
      h1Html,
      h1: text(h1Html),
      rest: text(html.replace(/<h1\b.*?<\/h1>/g, ' ')),
    };
  }),
);

/**
 * The H1 of EVERY page in the sitemap, in both languages.
 *
 * The check's own test for an H1 is literal: a word of the H1 that appears
 * nowhere else on the page is a word the page is not about ("accountable",
 * "Organized"). It knows no synonyms and no plurals, and neither does this:
 * "Condos" in an H1 is not answered by "condominiums" under it, nor
 * "enviamos" by "responde". This ran on four pages until the second report
 * (October 7, 2026) named two it did not cover — the milestone page and
 * /es/contact — so it now runs on all of them. The page is rendered without
 * the header and the footer, so the test is a little stricter than the
 * check: "About" in the menu does not excuse an H1 that says "about".
 */
describe('H1: every page, in words the page uses', () => {
  /* The shortest H1 the check let pass was 22 characters ("Política de
     privacidad"); it reported 12, 14 and 15 ("Terms of Use", "Privacy
     Policy", "Términos de uso") as too short to describe a page. Its limit
     is somewhere in between, so 22 is the floor known to pass. */
  const H1_MIN = 22;

  it('reads the pages the sitemap lists, and no others', () => {
    expect(rendered.map((r) => absoluteUrl(localePath(r.path, r.lang))).sort()).toEqual(
      sitemap().map((e) => e.url).sort(),
    );
  });

  for (const r of rendered) {
    const name = localePath(r.path, r.lang);

    it(`${name}: one H1, long enough to say what the page is — ${r.h1}`, () => {
      expect(r.h1s).toHaveLength(1);
      expect(r.h1.length).toBeGreaterThanOrEqual(H1_MIN);
    });

    it(`${name}: every word of the H1 is a word of the page`, () => {
      const body = new Set(words(r.rest));
      expect(words(r.h1).filter((w) => !body.has(w))).toEqual([]);
    });
  }
});

/**
 * The four pages whose H1 was a slogan. The H1 now names the subject — and,
 * on three of them, the place — and the slogan opens the line under it.
 */
describe('H1: the subject and the place, where a slogan used to be', () => {
  const VIEWS: [path: string, key: (typeof STATIC)[number][1]][] = [
    ['/services', 'services'],
    ['/existing-buildings', 'existing'],
    ['/about', 'about'],
    ['/projects', 'work'],
  ];
  // What each page opened with before, word for word: it must still be read.
  const SLOGAN: Record<Lang, Record<string, string>> = {
    en: {
      '/services': 'Organized by what you need, not by what we do.',
      '/existing-buildings': 'The building is already standing.',
      '/about': 'Built around one accountable engineer.',
      '/projects': 'The frame behind the project.',
    },
    es: {
      '/services': 'Organizados por lo que usted necesita, no por lo que hacemos.',
      '/existing-buildings': 'El edificio ya está en pie.',
      '/about': 'Construida alrededor de un solo ingeniero responsable.',
      '/projects': 'La estructura detrás del proyecto.',
    },
  };
  const PLACE = /Miami-Dade (and|y) Broward|South Florida|Sur de Florida/;
  /* /projects names NO place, in its H1 or in its title. For half a day both
     said "…in South Florida", and the second report listed /projects and the
     home page as competing for those two words: the home page is the one
     that should be found for them. /projects says what it holds — typical
     engagements, by type of project — and keeps the place in its lede and
     its Coverage fact. So this test asks the opposite of that page. */
  const NO_PLACE = ['/projects'];
  // Capitals, dashes and the full stop are not a difference; "in" and "and"
  // are — a title is a label and an H1 is a sentence about the same thing.
  const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g, '');

  for (const lang of LANGS) {
    for (const [path, key] of VIEWS) {
      const { html, h1Html, h1 } = rendered.find((r) => r.lang === lang && r.path === path)!;
      const name = localePath(path, lang);

      if (NO_PLACE.includes(path)) {
        it(`${name}: neither the H1 nor the title names the place — ${h1}`, () => {
          expect(h1).not.toMatch(PLACE);
          expect(SEO[lang][key].title).not.toMatch(PLACE);
        });
      } else {
        it(`${name}: the H1 names the place — ${h1}`, () => {
          expect(h1).toMatch(PLACE);
        });
      }

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
