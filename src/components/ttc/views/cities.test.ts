import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import sitemap from '@/app/sitemap';
import { getContent } from '@/lib/ttc/content';
import { cityPath, citiesCheckedISO, type CityPage } from '@/lib/ttc/cities';
import { cityPagesEn } from '@/lib/ttc/cities.en';
import { getCityPages } from '@/lib/ttc/city-content';
import { citySeo } from '@/lib/ttc/city-seo';
import { citySlugs } from '@/lib/ttc/city-slugs';
import { cityPagesRead, citySources } from '@/lib/ttc/city-sources';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { officePages } from '@/lib/ttc/office-pages';
import { DESCRIPTION_LIMIT_PX, TITLE_BUDGET_PX, descriptionPx, repeatedWords, titlePx, unmeasured } from '@/lib/ttc/serp';
import { absoluteUrl, company, contact } from '@/lib/ttc/site';
import { EN_PUBLIC_PAGES, ES_PUBLIC_PAGES, PUBLIC_NOT_FOUND, PUBLIC_NOT_FOUND_ES, publicNotFoundTarget } from '@/proxy';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { firstSentence } from '@/components/ttc/mp/text';
import { AboutView } from './AboutView';
import { CityView, cityH1 } from './CityView';
import { ContactView } from './ContactView';
import { ExistingView } from './ExistingView';
import { HomeView } from './HomeView';
import { LegalView } from './LegalView';
import { ServiceDetailView } from './ServiceDetailView';
import { ServicesView } from './ServicesView';
import { WorkView } from './WorkView';
import { pageMeta } from './meta';

/**
 * CITY PAGES: /services/<program>/<city>, in both languages (cities.ts).
 *
 * A page per city is the easiest kind of page to get wrong in bulk: the same
 * paragraph on twenty of them, a county's deadline typed by hand on one and
 * gone stale, a fee copied from a city's site, a line nobody can trace to
 * where it was read. None of that breaks a build. So the content is checked
 * here against the rules in the header of cities.ts, and every page is
 * rendered and compared with every other page of the site.
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const PROGRAMS = ['building-recertification', 'broward-bsip'] as const;
const key = (p: { program: string; slug: string }) => `${p.program}/${p.slug}`;

/** Every sentence a city page says in its own words. */
const prose = (p: CityPage) => [
  p.description,
  p.heroSub,
  p.lede,
  ...p.local.flatMap((x) => [x.k, x.v]),
  ...p.faq.flatMap((x) => [x.q, x.a]),
  p.nextStep,
];
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/);

describe('city pages: the list', () => {
  it('there is at least one, and every slug is its own', () => {
    expect(cityPagesEn.length).toBeGreaterThan(0);
    expect(new Set(cityPagesEn.map(key)).size).toBe(cityPagesEn.length);
    for (const p of cityPagesEn) {
      expect(p.slug, p.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(PROGRAMS, p.slug).toContain(p.program);
    }
  });

  it('the proxy’s list of slugs is this list', () => {
    expect(citySlugs.map(key)).toEqual(cityPagesEn.map(key));
  });

  it('the Spanish pages mirror the English ones: same slugs, same order, same office, same rows and questions', () => {
    const es = getCityPages('es');
    expect(es.map(key)).toEqual(cityPagesEn.map(key));
    es.forEach((p, i) => {
      const en = cityPagesEn[i];
      expect(p.office, p.slug).toEqual(en.office);
      expect(p.local.length, `${p.slug}: rows`).toBe(en.local.length);
      expect(p.faq.length, `${p.slug}: questions`).toBe(en.faq.length);
    });
  });

  for (const lang of LANGS) {
    it(`${lang}: each city is a row of its county page’s office list, under the same name and office`, () => {
      const services = getContent(lang).services;
      for (const p of getCityPages(lang)) {
        const rows = services.find((s) => s.slug === p.program)!.offices!.rows;
        const row = rows.find((r) => r.city === p.city);
        expect(row, `${p.slug}: “${p.city}” is not a row of ${p.program}`).toBeTruthy();
        expect(p.office.name, p.slug).toBe(row!.office);
      }
    });

    it(`${lang}: the pages of a program follow the order of that list`, () => {
      const services = getContent(lang).services;
      for (const program of PROGRAMS) {
        const order = services.find((s) => s.slug === program)!.offices!.rows.map((r) => r.city);
        const mine = getCityPages(lang).filter((p) => p.program === program).map((p) => p.city);
        expect(mine).toEqual(order.filter((city) => mine.includes(city)));
      }
    });
  }
});

describe('city pages: what the text may not say', () => {
  for (const lang of LANGS) {
    for (const p of getCityPages(lang)) {
      const name = `${lang} ${key(p)}`;
      const said = prose(p);

      // A county's ages and day counts are printed from its timing row, and
      // a city's own "six weeks" is the kind of number nobody re-reads. The
      // one number left is the name people still type.
      it(`${name}: types no number — "40-year" apart, as the program’s former name`, () => {
        for (const line of said) {
          const rest = line.replace(/\b40[- ]year\b/gi, '').replace(/\b(de )?40 años\b/gi, '');
          expect(rest, line).not.toMatch(/\d/);
        }
      });

      it(`${name}: "40-year" only as a name still in use, never as the rule`, () => {
        for (const line of said) {
          for (const s of sentences(line)) {
            if (!/\b40[- ]year\b|\b40 años\b/i.test(s)) continue;
            // A word that makes it a NAME ("still calls it", "the former name",
            // "known as"). "Still" alone does not: "a 40-year building still
            // has to be recertified" states the old rule as the rule.
            expect(s, s).toMatch(/former|formerly|\bnames?\b|\bcall(s|ed)?\b|titled|label|known|the same as|anterior|antigu[oa]|nombre|llama|titul|conoc|la misma/i);
          }
        }
      });

      it(`${name}: no money, no web address, no e-mail, no office hours`, () => {
        for (const line of said) {
          expect(line, line).not.toMatch(/[$€]|\bdollars?\b|\bdólares\b|\bfees?\b|\btarifas?\b|\bfines?\b|\bmultas?\b|\brecargos?\b|\bsurcharges?\b/i);
          expect(line, line).not.toMatch(/https?:|www\.|\.(gov|com|org|net)\b|@/i);
          // Every day of the week, not two of them. ("a.m." needs its dots:
          // without them the pattern read "I am on the board" as an hour, and
          // an hour needs a digit, which no line may have anyway.)
          expect(line, line).not.toMatch(
            /\b[ap]\.m\.|\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)days?\b|\b(lunes|martes|miércoles|jueves|viernes|sábados?|domingos?)\b|\b(office |business )?hours of operation\b|\b(office|business|counter) hours\b|\bhorarios?\b|\bhoras de (atención|oficina)\b/i,
          );
        }
      });

      // The site does not say who prepares, signs or seals which part. A
      // city asking for "signed and sealed" files is a fact about the files;
      // "we sign" is a claim about the firm.
      it(`${name}: assigns no signature, promises no outcome, claims no history with the office`, () => {
        for (const line of said) {
          // By clause, and however the firm is named: "our structural
          // engineer signs", "Tercero Tablada seals", "signed by our engineer"
          // all say it. The names are matched with their capitals — "un
          // tercero" is a third party.
          for (const clause of sentences(line).flatMap((s) => s.split(/;\s+/))) {
            const signs = /\b(signs?|seals?|stamps?|signed|sealed|stamped|signature)\b/i.test(clause) || /\b(firma[nrs]?|firmamos|sell[ao][nrs]?|sellamos|firmad[oa]s?|sellad[oa]s?)\b/i.test(clause);
            const firm = /\b(we|our|ours|us)\b/i.test(clause) || /\b(nuestr[oa]s?|nosotros)\b/i.test(clause) || /\b(Tercero|Tablada|Juan)\b/.test(clause);
            expect(signs && firm, clause).toBe(false);
          }
          expect(line, line).not.toMatch(/\bguarantee|\bwe (will )?get (you|it|your building) (re)?certified|\bgarantiza/i);
          expect(line, line).not.toMatch(
            /\bwe(’|')ve\b|\bwe have (filed|worked|recertified|handled|submitted|done|helped|inspected)|\byears of experience\b|\baños de experiencia\b|\bhemos (presentado|trabajado|recertificado|tramitado|gestionado|inspeccionado|hecho)/i,
          );
        }
      });

      it(`${name}: the firm’s part is the complete package, never the structural report alone`, () => {
        for (const line of said) {
          expect(line, line).not.toMatch(
            /\b(only|just) the structural\b|\bstructural (side|part|report) (only|alone)\b|\b(solo|sólo|únicamente|solamente) (el|la|lo) (informe |parte )?estructural\b/i,
          );
        }
      });

      if (p.program === 'broward-bsip') {
        // The Board's policy in force asks for neither (site.ts, the Broward
        // package): no Miami-Dade certificate is printed on a Broward page.
        it(`${name}: prints nothing of Miami-Dade’s package`, () => {
          for (const line of said) {
            expect(line, line).not.toMatch(/thermograph|termograf|parking|estacionamiento|guardrail|baranda|illuminat|iluminaci/i);
          }
        });
      } else {
        // "Required" is not a condition: "thermography is required for every
        // building" is the claim this is here to stop.
        const CONDITION = /\bwhere\b|\bif\b|\bwhen\b|\bdonde\b|\bcuando\b|\bsi\b|applicable|aplica|correspond/i;
        it(`${name}: thermography is never named without its condition`, () => {
          for (const line of said) {
            for (const s of sentences(line)) {
              if (/thermograph|termograf/i.test(s)) expect(s, s).toMatch(CONDITION);
            }
          }
        });

        // A parking-lot document is named as something the city's own page
        // lists or says (or with its condition, or in a question) — never as
        // our statement of what a report carries.
        it(`${name}: a parking-lot document is named as what the city’s page lists, or with its condition`, () => {
          const CITY_SAYS = /\b(city|town|village)(’s)?\b|\b(page|list|sheet|forms?)\b|\b(ciudad|municipio|villa|página|lista|hoja|formularios?)\b/i;
          for (const line of said) {
            for (const s of sentences(line)) {
              if (!/parking|estacionamiento|illuminat|iluminaci|guardrail|baranda/i.test(s) || /\?$/.test(s)) continue;
              expect(CONDITION.test(s) || CITY_SAYS.test(s), s).toBe(true);
            }
          }
        });
      }

      it(`${name}: every block is long enough to be a sentence, and short enough to read`, () => {
        expect(p.local.length, 'rows').toBeGreaterThanOrEqual(4);
        expect(p.faq.length, 'questions').toBeGreaterThanOrEqual(3);
        expect(p.faq.length, 'questions').toBeLessThanOrEqual(6);
        for (const x of p.local) {
          expect(x.k.split(/\s+/).length, x.k).toBeLessThanOrEqual(5);
          expect(x.v.length, x.k).toBeGreaterThan(60);
        }
        for (const x of p.faq) {
          expect(x.q, x.q).toMatch(lang === 'es' ? /^¿.+\?$/ : /\?$/);
          expect(x.q, 'a question names the city').toContain(p.place.replace(/^(the|la) /, ''));
          expect(x.a.length, x.q).toBeGreaterThan(80);
        }
      });
    }
  }
});

/** A city's own systems that are not on its website's domain: the host, and
 *  the city whose pages send owners there. */
const CITY_SYSTEMS: Record<string, string[]> = {
  surfside: ['library.municode.com'],
  'key-biscayne': ['aca-prod.accela.com'],
  'hallandale-beach': ['hallandalefl-energovpub.tylerhost.net', 'cohb.org'],
  'deerfield-beach': ['deerfieldbeach.geocivix.com'],
  miramar: ['miramarfl-energovweb.tylerhost.net'],
};

describe('city pages: where each line was read', () => {
  // The record follows the English page; the Spanish page says the same.
  for (const p of cityPagesEn) {
    const rec = citySources[key(p)];

    it(`${key(p)}: has a record`, () => {
      expect(rec, 'city-sources.ts').toBeTruthy();
    });

    it(`${key(p)}: every row and every answer rests on at least one quote`, () => {
      p.local.forEach((x, i) => {
        expect(rec.rows[`local ${i + 1}: ${x.k}`]?.length ?? 0, `row ${i + 1}: ${x.k}`).toBeGreaterThan(0);
      });
      p.faq.forEach((x, i) => {
        expect(rec.rows[`faq ${i + 1}`]?.length ?? 0, x.q).toBeGreaterThan(0);
      });
      expect(rec.rows.lede.length, 'lede').toBeGreaterThan(0);
    });

    it(`${key(p)}: the office’s address and phone were read too`, () => {
      if (p.office.address?.length || p.office.phone) expect(rec.office.length).toBeGreaterThan(0);
      const read = rec.office.map((q) => q.quote).join(' ');
      if (p.office.phone) expect(read.replace(/\D/g, ''), 'phone').toContain(p.office.phone.replace(/\D/g, ''));
      // The address, part by part: the street, the floor, the city and the
      // ZIP code are each in the city's own words ("FL" is the one thing a
      // page may write its own way — some print "Florida").
      const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      for (const line of p.office.address ?? []) {
        for (const part of line.split(/,\s*/)) {
          const piece = part.replace(/^FL\s+/, '');
          expect(plain(read), `"${part}" of "${line}"`).toContain(plain(piece));
        }
      }
    });

    it(`${key(p)}: every quote was read on an outside https page — the city’s own, or its county’s`, () => {
      const known = new URL(officePages[p.program].find((o) => o.city === p.city)!.page).hostname.replace(/^www\./, '');
      for (const q of [...rec.office, ...Object.values(rec.rows).flat()]) {
        const u = new URL(q.page);
        expect(u.protocol, q.page).toBe('https:');
        expect(u.hostname, q.page).not.toContain(new URL(company.url).hostname);
        expect(q.quote.length, q.page).toBeGreaterThan(3);
      }
      // EVERY quote, not one of them: on the site the office's name was read
      // on (office-pages.ts), or on a system that city itself sends owners
      // to — its code library, its permit portal. Never another city's site,
      // never a third party's.
      const own = (host: string) => host === known || host.endsWith(`.${known}`) || known.endsWith(`.${host}`);
      for (const q of [...rec.office, ...Object.values(rec.rows).flat()]) {
        const host = new URL(q.page).hostname.replace(/^www\./, '');
        expect(own(host) || (CITY_SYSTEMS[p.slug] ?? []).includes(host), `${host} for ${p.slug}`).toBe(true);
      }
    });
  }

  it('the record covers the city pages and nothing else', () => {
    expect(Object.keys(citySources).sort()).toEqual(cityPagesEn.map(key).sort());
  });

  it('the record was read on the day the pages say', () => {
    expect(cityPagesRead).toBe(citiesCheckedISO);
  });

  it('no website a quote was read on is anywhere in the pages’ text', () => {
    const hosts = new Set(
      Object.values(citySources).flatMap((r) => [...r.office, ...Object.values(r.rows).flat()].map((q) => new URL(q.page).hostname.replace(/^www\./, ''))),
    );
    for (const lang of LANGS) {
      const all = JSON.stringify(getCityPages(lang));
      for (const host of hosts) expect(all, host).not.toContain(host);
    }
  });
});

describe('city pages: title and description, on the search result’s ruler', () => {
  const metas = LANGS.flatMap((lang) =>
    getCityPages(lang).map((p) => {
      const seo = citySeo(lang, p);
      const meta = pageMeta(lang, cityPath(p), seo);
      return { lang, p, seo, title: (meta.title as { absolute: string }).absolute, description: String(meta.description) };
    }),
  );

  for (const m of metas) {
    const name = `${m.lang} ${key(m.p)}`;
    it(`${name}: title fits (${titlePx(m.title)} px), repeats no word and names the city — ${m.title}`, () => {
      expect(unmeasured(m.title)).toEqual([]);
      expect(titlePx(m.title)).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      expect(repeatedWords(m.title)).toEqual([]);
      expect(m.seo.title).toContain(m.p.city);
      expect(m.seo.title).not.toContain(company.shortName);
    });

    it(`${name}: description fits (${descriptionPx(m.description)} px) and names the city`, () => {
      expect(unmeasured(m.description)).toEqual([]);
      expect(descriptionPx(m.description)).toBeLessThanOrEqual(DESCRIPTION_LIMIT_PX);
      expect(m.description).toContain(m.p.place.replace(/^(the|la) /, ''));
    });
  }

  // A title is a label and an H1 is a sentence about the same thing: the
  // on-page check reports the two when they are one string.
  it('no title is its page’s H1 over again', () => {
    const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g, '');
    for (const m of metas) {
      expect(letters(m.seo.title), `${m.lang} ${key(m.p)}`).not.toBe(letters(cityH1(m.lang, m.p)));
    }
  });

  it('no two city pages share a title or a description', () => {
    expect(new Set(metas.map((m) => m.title)).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.description)).size).toBe(metas.length);
  });
});

describe('city pages: addresses', () => {
  it('each one is a known public page in both languages, and a lookalike is a 404', () => {
    for (const p of cityPagesEn) {
      const en = cityPath(p);
      const es = localePath(en, 'es');
      expect(EN_PUBLIC_PAGES, en).toContain(en);
      expect(ES_PUBLIC_PAGES, es).toContain(es);
      expect(publicNotFoundTarget(en), en).toBeNull();
      expect(publicNotFoundTarget(es), es).toBeNull();
      expect(publicNotFoundTarget(`${en}/x`), `${en}/x`).toBe(PUBLIC_NOT_FOUND);
      expect(publicNotFoundTarget(`${es}/x`), `${es}/x`).toBe(PUBLIC_NOT_FOUND_ES);
    }
    expect(publicNotFoundTarget('/services/building-recertification/atlantis')).toBe(PUBLIC_NOT_FOUND);
    expect(publicNotFoundTarget('/es/services/broward-bsip/atlantis')).toBe(PUBLIC_NOT_FOUND_ES);
  });

  it('a city is never served under the other county’s program', () => {
    for (const p of cityPagesEn) {
      const other = p.program === 'broward-bsip' ? 'building-recertification' : 'broward-bsip';
      expect(publicNotFoundTarget(`/services/${other}/${p.slug}`), p.slug).toBe(PUBLIC_NOT_FOUND);
    }
  });

  it('the sitemap lists every one of them, in both languages', () => {
    const urls = sitemap().map((e) => e.url);
    for (const p of cityPagesEn) {
      for (const lang of LANGS) expect(urls).toContain(absoluteUrl(localePath(cityPath(p), lang)));
    }
  });
});

/* ── The rendered pages ───────────────────────────────────────────────── */

const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const spaced = (html: string) => text(html.replace(/<[^>]+>/g, ' '));
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const words = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
const mainOf = (html: string) => html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? html;
/** Every paragraph, list item, table cell and heading of a page's <main>,
    the closing band apart (it is the same band on every page, on purpose). */
const blocks = (html: string) =>
  [...mainOf(html).replace(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/g, '').matchAll(/<(p|dd|dt|li|h[1-6]|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((m) => text(m[2]))
    .filter(Boolean);

function others(lang: Lang): [path: string, view: ReactElement][] {
  return [
    ['/', h(HomeView, { lang })],
    ['/services', h(ServicesView, { lang })],
    ['/existing-buildings', h(ExistingView, { lang })],
    ['/about', h(AboutView, { lang })],
    ['/contact', h(ContactView, { lang })],
    ['/projects', h(WorkView, { lang })],
    ['/privacy', h(LegalView, { lang, kind: 'privacy' })],
    ['/terms', h(LegalView, { lang, kind: 'terms' })],
    ...getContent(lang).services.map(
      (s): [string, ReactElement] => [`/services/${s.slug}`, h(ServiceDetailView, { lang, slug: s.slug })],
    ),
  ];
}
const render = (lang: Lang, path: string, view: ReactElement) => {
  route.pathname = localePath(path, lang);
  return renderToStaticMarkup(h(SiteChrome, null, view));
};
const site = new Map<Lang, Map<string, string>>();
const cities = new Map<Lang, Map<string, string>>();
for (const lang of LANGS) {
  site.set(lang, new Map(others(lang).map(([path, view]) => [path, render(lang, path, view)])));
  cities.set(
    lang,
    new Map(getCityPages(lang).map((p) => [cityPath(p), render(lang, cityPath(p), h(CityView, { lang, program: p.program, slug: p.slug }))])),
  );
}

describe('city pages: the page a visitor gets', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    for (const p of getCityPages(lang)) {
      const html = cities.get(lang)!.get(cityPath(p))!;
      const main = mainOf(html);
      const name = `${lang} ${cityPath(p)}`;
      const service = c.services.find((s) => s.slug === p.program)!;

      it(`${name}: one h1 that names the program and the city, four h2, one h3 per question`, () => {
        const h1 = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => spaced(m[1]));
        expect(h1).toEqual([cityH1(lang, p)]);
        // cityH1 is the view's own function: what it returns is checked too.
        expect(h1[0]).toContain(p.place.replace(/^(the|la) /, ''));
        expect(h1[0].length).toBeGreaterThanOrEqual(22);
        expect((main.replace(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/g, '').match(/<h2\b/g) ?? []).length).toBe(4);
        const h3 = [...main.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]));
        expect(h3).toEqual(p.faq.map((x) => text(esc(x.q))));
        expect(main).not.toMatch(/<h[456]\b/);
      });

      it(`${name}: every word of the h1 is a word of the page`, () => {
        const rest = spaced(main.replace(/<h1\b[\s\S]*?<\/h1>/g, ' ')).toLowerCase();
        for (const w of cityH1(lang, p).match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,}/g) ?? []) {
          expect(rest, w).toContain(w.toLowerCase());
        }
      });

      it(`${name}: prints its own text whole — the lede, every row, every answer, the next step`, () => {
        // Without the scripts: the questions' markup carries each answer too.
        const seen = main.replace(/<script\b[\s\S]*?<\/script>/g, '');
        for (const line of [p.heroSub, p.lede, ...p.local.map((x) => x.v), ...p.faq.map((x) => x.a), p.nextStep]) {
          expect(seen.split(esc(line)).length - 1, line).toBe(1);
        }
        for (const x of p.local) expect(seen, x.k).toContain(`<dt>${esc(x.k)}</dt>`);
      });

      // The office, its address and its phone are one paragraph of lines.
      // Read as plain text — the tags simply gone, which is how a crawler
      // reads it — every line must still stand apart from the next.
      it(`${name}: the office block reads as lines, with the city's phone as text`, () => {
        const block = main.match(/<p class="mp-city__office">([\s\S]*?)<\/p>/)?.[1] ?? '';
        // "… <label> <office> <street> <city, state> <label>: <phone>", a
        // single space between each: nothing runs into its neighbour.
        const joined = [p.office.name, ...(p.office.address ?? [])].map((x) => text(esc(x))).join(' ');
        expect(text(block), text(block)).toContain(` ${joined}`);
        expect(text(block).startsWith(joined), 'the label comes first').toBe(false);
        if (p.office.phone) expect(text(block).endsWith(`: ${p.office.phone}`), text(block)).toBe(true);
        else expect(text(block).endsWith(joined)).toBe(true);
        expect(block).not.toMatch(/<a\b/);
        expect(main).not.toMatch(/<address\b/);
      });

      // The ads script counts a tap on ANY tel: link as a call to the firm
      // (ads.ts). The only number a visitor can tap is the firm's own.
      it(`${name}: the only phone link on the page is the firm's`, () => {
        const tels = [...html.matchAll(/href="(tel:[^"]*)"/g)].map((m) => m[1]);
        expect(tels.length).toBeGreaterThan(0);
        for (const tel of tels) expect(tel).toBe(contact.phone!.href);
      });

      // The county's rows, read from the row — label and first sentence, as
      // on the home page — each with the city in its label.
      it(`${name}: the deadlines are the county row’s flagged facts, not text of its own`, () => {
        const rows = [...main.matchAll(/<ul class="mp-city__rows">([\s\S]*?)<\/ul>/g)].flatMap((m) => [...m[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((x) => spaced(x[1])));
        const flagged = service.timing!.rows[0].facts.filter((f) => f.home);
        expect(flagged.length).toBeGreaterThan(2);
        expect(rows).toHaveLength(flagged.length);
        flagged.forEach((f, i) => {
          const value = f.homeWhole ? f.v : firstSentence(f.v);
          expect(rows[i]).toContain(spaced(esc(f.k)));
          expect(rows[i]).toContain(p.place);
          // The label and the value read as two things without the markup.
          expect(rows[i], rows[i]).toContain(`${p.place} : `);
          expect(rows[i].endsWith(spaced(esc(value))), `${f.k}: ${rows[i]}`).toBe(true);
        });
        expect(main).toContain(esc(service.timing!.rows[0].source));
      });

      it(`${name}: it leads to the form with the program selected, to the county page and to the other cities`, () => {
        const hrefs = [...main.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
        expect(hrefs).toContain(localePath(`/contact?service=${p.program}`, lang));
        expect(hrefs.some((x) => x.startsWith(localePath(`/services/${p.program}`, lang) + '#'))).toBe(true);
        // Of the page's own language: a Spanish page whose button opened the
        // English form passed while either list would do.
        const known = new Set<string>(lang === 'es' ? ES_PUBLIC_PAGES : EN_PUBLIC_PAGES);
        for (const href of hrefs.filter((x) => x.startsWith('/'))) {
          expect(known.has(href.replace(/[?#].*$/, '')), href).toBe(true);
        }
        for (const o of getCityPages(lang).filter((x) => x.program === p.program && x.slug !== p.slug)) {
          expect(hrefs, o.slug).toContain(localePath(cityPath(o), lang));
        }
        // Outside the site: the county row's source, the engineer's license
        // search, phone and WhatsApp. Never a city's website.
        for (const href of hrefs.filter((x) => /^https?:/.test(x))) {
          expect(['library.municode.com', 'www.broward.org', 'www.myfloridalicense.com', 'api.whatsapp.com'], href).toContain(new URL(href).hostname);
        }
      });

      it(`${name}: says enough to be a page of its own`, () => {
        expect(words(spaced(main.replace(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/g, '')))).toBeGreaterThanOrEqual(520);
      });

      it(`${name}: its structured data names the city inside its county, and the questions it prints`, () => {
        const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
        const svc = ld.find((x) => x['@type'] === 'Service');
        expect(svc.areaServed['@type']).toBe('City');
        expect(svc.areaServed.name).toContain(p.city.replace(/^(City of|Ciudad de) /, ''));
        expect(svc.areaServed.containedInPlace.name).toMatch(p.program === 'broward-bsip' ? /^Broward/ : /^Miami-Dade/);
        expect(svc.url).toBe(absoluteUrl(localePath(cityPath(p), lang)));
        const faq = ld.find((x) => x['@type'] === 'FAQPage');
        expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(p.faq.map((x) => x.q));
        const crumbs = ld.find((x) => x['@type'] === 'BreadcrumbList');
        expect(crumbs.itemListElement).toHaveLength(4);
        expect(ld.find((x) => x['@type'] === 'WebPage').lastReviewed).toBe(citiesCheckedISO);
      });
    }
  }
});

/**
 * ONE HOME FOR EACH PIECE OF TEXT — the rule of shared-text.test.ts, for the
 * city pages: a block of six words or more that a city page prints is on no
 * other city page and on no other page of the site. The one block every
 * page repeats on purpose — the engineer's name and license line — is set
 * aside by name.
 *
 * WHOLE BLOCKS: a paragraph with one word changed is a different block. So a
 * second test reads the pages' own sentences with the city's names taken
 * out: the questions are the same question asked of each city, on purpose
 * (it is what an owner types); any other sentence may turn up on two pages
 * — "the program page does not say" — and on no more.
 */
describe('city pages: no block of text is printed on two pages', () => {
  for (const lang of LANGS) {
    it(`${lang}: nothing of six words or more is shared between two cities, or between a city and the rest of the site`, () => {
      const where = new Map<string, { text: string; pages: Set<string> }>();
      const add = (path: string, html: string) => {
        for (const b of blocks(html)) {
          if (words(b) < 6) continue;
          const k = norm(b);
          if (!where.has(k)) where.set(k, { text: b, pages: new Set() });
          where.get(k)!.pages.add(path);
        }
      };
      for (const [path, html] of site.get(lang)!) add(path, html);
      // The one block every page repeats on purpose, BY NAME: the engineer's
      // credential line. (It used to be measured — "whatever two other pages
      // already share" — which also let through everything the two county
      // pages have in common, the free-proposal line among it.)
      const c = getContent(lang);
      const already = new Set([norm(`${c.leadership.name} ${c.ui.engineer.licensePrefix} ${c.leadership.license!.number}`)]);
      for (const [path, html] of cities.get(lang)!) add(path, html);
      const cityPaths = new Set(cities.get(lang)!.keys());
      const shared = [...where]
        .filter(([k, v]) => v.pages.size > 1 && !already.has(k) && [...v.pages].some((x) => cityPaths.has(x)))
        .map(([, v]) => `${[...v.pages].join(' + ')}: ${v.text}`);
      expect(shared).toEqual([]);
    });

    it(`${lang}: with the city's names taken out, no sentence but a question is on more than two city pages`, () => {
      const where = new Map<string, { text: string; slugs: Set<string> }>();
      for (const p of getCityPages(lang)) {
        const names = [p.office.name, p.place, p.city, p.place.replace(/^(the|la) /i, ''), p.city.replace(/^(City of|Ciudad de|Town of|Village of) /i, '')].sort((a, b) => b.length - a.length);
        const own = [p.description, p.heroSub, p.lede, ...p.local.map((x) => x.v), ...p.faq.map((x) => x.a), p.nextStep];
        for (const s of own.flatMap(sentences)) {
          const masked = names.reduce((t, n) => t.split(n).join('§'), s);
          if (words(masked) < 6) continue;
          const k = norm(masked);
          if (!where.has(k)) where.set(k, { text: masked, slugs: new Set() });
          where.get(k)!.slugs.add(p.slug);
        }
      }
      expect([...where.values()].filter((v) => v.slugs.size > 2).map((v) => `${[...v.slugs].join(', ')}: ${v.text}`)).toEqual([]);
    });
  }
});

/**
 * THE CITY TEXT STAYS OUT OF THE BROWSER'S SCRIPTS.
 *
 * site.ts travels with every page; the 46 city pages' text must not. For one
 * build it did: cities.ts re-exported the English pages, structured-data.ts
 * imported cities.ts for a date, and the site-wide graph component, which is
 * 'use client', imports structured-data.ts — 150 KB of city text in the script
 * of every public page, with every test green. So this walks the imports of
 * every 'use client' file in src and fails if one can reach the text.
 */
describe('city pages: their text is in no client bundle', () => {
  const SRC = resolve(__dirname, '..', '..', '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : files(full);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name) ? [full] : [];
    });
  const read = (file: string) => readFileSync(file, 'utf8');
  const resolveImport = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
    if (!base) return null; // a package
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
  };
  /** What a file imports at run time: `import type` and `export type` are
      erased; everything else — re-exports and import() too — is kept. */
  const imports = (file: string): string[] => {
    const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const found: string[] = [];
    for (const m of code.matchAll(/\b(?:import|export)\s+(type\s+)?(?:[\w*\s{},$]+?\s+from\s+)?['"]([^'"]+)['"]/g)) if (!m[1]) found.push(m[2]);
    for (const m of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(m[1]);
    return found.map((spec) => resolveImport(file, spec)).filter((x): x is string => Boolean(x));
  };
  const all = files(SRC);
  const clients = all.filter((f) => /^\s*(?:\/\*[\s\S]*?\*\/\s*)?['"]use client['"]/.test(read(f)));
  const TEXT = ['cities.en.ts', 'cities.es.ts', 'city-content.ts', 'city-sources.ts'].map((name) => join(SRC, 'lib', 'ttc', name));

  it('sees the client files and the text files it is about', () => {
    expect(clients.length).toBeGreaterThan(50);
    expect(clients.map((f) => f.replace(/\\/g, '/'))).toEqual(expect.arrayContaining([expect.stringMatching(/components\/ttc\/mp\/SiteGraph\.tsx$/)]));
    for (const f of TEXT) expect(existsSync(f), f).toBe(true);
  });

  it('the walk follows imports: the site-wide graph reaches structured-data.ts, and city-content.ts reaches the text', () => {
    const graph = clients.find((f) => /SiteGraph\.tsx$/.test(f))!;
    expect(imports(graph)).toContain(join(SRC, 'lib', 'ttc', 'structured-data.ts'));
    expect(imports(join(SRC, 'lib', 'ttc', 'city-content.ts'))).toEqual(expect.arrayContaining([TEXT[0], TEXT[1]]));
  });

  it("no 'use client' file can reach the city text, directly or through what it imports", () => {
    const reach = new Map<string, string>(); // file → the file that led to it
    const queue = [...clients];
    for (const c of clients) reach.set(c, c);
    while (queue.length) {
      const file = queue.pop()!;
      for (const next of imports(file)) {
        if (reach.has(next)) continue;
        reach.set(next, file);
        queue.push(next);
      }
    }
    const trail = (file: string) => {
      const out = [file];
      while (reach.get(out[0]) !== out[0]) out.unshift(reach.get(out[0])!);
      return out.map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/')).join(' → ');
    };
    expect(TEXT.filter((f) => reach.has(f)).map(trail)).toEqual([]);
  });
});

describe('county pages: a city with a page of its own is linked from its row, and only there', () => {
  for (const lang of LANGS) {
    for (const program of PROGRAMS) {
      it(`${program} (${lang}): the row’s city is the link; rows without a page stay text; none leaves the site`, () => {
        const html = site.get(lang)!.get(`/services/${program}`)!;
        const list = html.match(/<ul class="mp-offices">([\s\S]*?)<\/ul>/)?.[1] ?? '';
        const found = [...list.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);
        const mine = getCityPages(lang).filter((p) => p.program === program);
        expect(found).toEqual(mine.map((p) => [localePath(cityPath(p), lang), text(esc(p.city))]));
      });
    }
  }
});
