import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import sitemap from '@/app/sitemap';
import { getContent } from '@/lib/ttc/content';
import { cityPath } from '@/lib/ttc/cities';
import { getCityPages } from '@/lib/ttc/city-content';
import { COST_PATH } from '@/lib/ttc/cost-path';
import { GUIDES_PATH, guidePath, guideSlugs, guidesReviewed, guidesReviewedISO, type Guide } from '@/lib/ttc/guides';
import { findGuide, getGuides, guideLabels, guidesIndex } from '@/lib/ttc/guide-content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { absoluteUrl, company } from '@/lib/ttc/site';
import { EN_PUBLIC_PAGES, ES_PUBLIC_PAGES, isMarketingRoute, isPublicRoute, PUBLIC_NOT_FOUND, publicNotFoundTarget } from '@/proxy';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { keepHyphens } from '@/components/ttc/mp/text';
import { AboutView } from './AboutView';
import { CityView } from './CityView';
import { ContactView } from './ContactView';
import { CostView } from './CostView';
import { ExistingView } from './ExistingView';
import { GuideView, GuidesView, guideFacts } from './GuideView';
import { HomeView } from './HomeView';
import { LegalView } from './LegalView';
import { ServiceDetailView } from './ServiceDetailView';
import { ServicesView } from './ServicesView';
import { WorkView } from './WorkView';

/**
 * THE GUIDES (guides.ts) — seven answers to the questions owners type, each
 * leading to its county program's page and to the cost page.
 *
 * They sit next to the most guarded text on the site — the counties' ages
 * and deadlines — and they are prose, where a number slips in easily. So:
 *   • no digit in a guide's own words but the names owners still type, each
 *     in a sentence that says it is a name; the ages and deadlines a guide
 *     needs are the county rows', printed whole with their source;
 *   • a label in curly quotes is a real row label;
 *   • nothing about who signs, no money, no promise, no claimed history;
 *   • nothing of six words or more that another page of the site prints;
 *   • the text stays out of every client bundle.
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const PROGRAMS = ['building-recertification', 'broward-bsip'];

const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(strings)
        : [];
/** Everything a guide says in its own words: not its slug, its programs or its fact keys. */
const said = (g: Guide) => strings({ seo: g.seo.description, faqTitle: g.faqTitle, name: g.name, h1: g.h1, heroSub: g.heroSub, card: g.card, sections: g.sections.map((s) => ({ t: s.title, p: s.paras, l: s.list })), faq: g.faq });
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/);
const NAME = /\b(?:[345]0, ){0,2}(?:[345]0 (?:or|and|y|o) )?[345]0[- ](?:year|años)\b/gi;

describe('guides: the list', () => {
  it('the slugs are the list in both languages, in its order', () => {
    for (const lang of LANGS) expect(getGuides(lang).map((g) => g.slug)).toEqual([...guideSlugs]);
  });

  it('the Spanish guides mirror the English ones: programs, facts, sections, lists and questions', () => {
    const en = getGuides('en');
    const es = getGuides('es');
    en.forEach((g, i) => {
      const t = es[i];
      expect(t.programs).toEqual(g.programs);
      expect(t.heroAction).toBe(g.heroAction);
      expect(t.sections.map((s) => [s.paras.length, s.list?.length ?? 0, s.facts ?? null])).toEqual(
        g.sections.map((s) => [s.paras.length, s.list?.length ?? 0, s.facts ?? null]),
      );
      expect(t.faq).toHaveLength(g.faq.length);
    });
  });

  it('every fact a guide names is a fact of that row, in both languages', () => {
    for (const lang of LANGS) {
      for (const g of getGuides(lang)) {
        for (const block of g.sections.flatMap((s) => s.facts ?? [])) {
          expect(() => guideFacts(lang, block), `${g.slug} ${block.service}`).not.toThrow();
        }
      }
    }
  });
});

describe('guides: what the text may not say', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const labels = new Set([
      c.ui.boardDuties,
      ...c.services.flatMap((s) => s.timing?.rows.flatMap((r) => r.facts.map((f) => f.k)) ?? []),
    ]);
    const all = [...getGuides(lang).map((g) => [g.slug, said(g)] as const), ['index', strings(guidesIndex(lang))] as const, ['labels', strings({ ...guideLabels(lang), rowsOf: '', factLabel: '' })] as const];

    for (const [slug, lines] of all) {
      const name = `${lang} ${slug}`;

      it(`${name}: types no number — the names owners still type apart`, () => {
        for (const line of lines) expect(line.replace(NAME, ''), line).not.toMatch(/\d/);
      });

      it(`${name}: a name with a number is said to be a name`, () => {
        for (const line of lines) {
          for (const s of sentences(line)) {
            if (!NAME.test(s)) continue;
            NAME.lastIndex = 0;
            expect(s, s).toMatch(/former|\bnames?\b|\bnamed\b|\bcall(s|ed)?\b|search|known|anterior|antigu[oa]|nombres?|llama|conoc|busca|“/i);
          }
          NAME.lastIndex = 0;
        }
      });

      it(`${name}: a label in curly quotes is a row label, or a name`, () => {
        for (const line of lines) {
          for (const m of line.matchAll(/“([^”]+)”/g)) {
            const q = m[1];
            if (/\d/.test(q) || /fail|reprob|fall[aó]|aprueb|aprob/i.test(q)) continue;
            expect(labels.has(q), `${q} — in: ${line}`).toBe(true);
          }
        }
      });

      it(`${name}: no money, no fines, no web address`, () => {
        for (const line of lines) {
          expect(line, line).not.toMatch(/[$€]|\bdollars?\b|\bdólares\b|\bfines?\b|\bmultas?\b/i);
          expect(line, line).not.toMatch(/https?:|www\.|\.(gov|com|org|net)\b|@/i);
        }
      });

      it(`${name}: assigns no signature, promises no outcome, claims no history`, () => {
        for (const line of lines) {
          for (const clause of sentences(line).flatMap((s) => s.split(/;\s+/))) {
            const signs = /\b(signs?|seals?|stamps?|signed|sealed|stamped|signature)\b/i.test(clause) || /\b(firma[nrs]?|firmamos|sell[ao][nrs]?|sellamos|firmad[oa]s?|sellad[oa]s?)\b/i.test(clause);
            const firm = /\b(we|our|ours|us)\b/i.test(clause) || /\b(nuestr[oa]s?|nosotros)\b/i.test(clause) || /\b(Tercero|Tablada|Juan)\b/.test(clause);
            expect(signs && firm, clause).toBe(false);
          }
          expect(line, line).not.toMatch(/\bguarantee|\bgarantiz|\bwe (will )?get (you|it|your building) (re)?certified/i);
          expect(line, line).not.toMatch(/\bwe(’|')ve\b|\bwe have (filed|worked|recertified|handled|submitted|done|helped|inspected)|\byears of experience\b|\baños de experiencia\b|\bhemos (presentado|trabajado|recertificado|tramitado|inspeccionado|hecho)/i);
        }
      });

      it(`${name}: the firm’s part is never the structural report alone`, () => {
        for (const line of lines) {
          expect(line, line).not.toMatch(/\b(we|our team) (prepare|deliver|do|write)s? (only )?the structural (report|side)\b|structural side|\bsolo el informe estructural\b|\bla parte estructural\b/i);
        }
      });
    }
  }
});

/* ── The pages ──────────────────────────────────────────────────────────── */

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
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const words = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
const mainOf = (html: string) => html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? html;
/** Every block of a page's <main>, the closing band apart (the same on every page, on purpose). */
const blocks = (html: string) =>
  [...mainOf(html).replace(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/g, '').matchAll(/<(p|dd|dt|li|h[1-6]|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((m) => text(m[2]))
    .filter(Boolean);
const ld = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const data = JSON.parse(m[1]);
    return data['@graph'] ?? [data];
  });

const render = (lang: Lang, path: string, view: ReactElement) => {
  route.pathname = localePath(path, lang);
  return renderToStaticMarkup(h(SiteChrome, null, view));
};
function rest(lang: Lang): [string, ReactElement][] {
  return [
    ['/', h(HomeView, { lang })],
    ['/services', h(ServicesView, { lang })],
    ['/existing-buildings', h(ExistingView, { lang })],
    ['/about', h(AboutView, { lang })],
    ['/contact', h(ContactView, { lang })],
    ['/projects', h(WorkView, { lang })],
    ['/privacy', h(LegalView, { lang, kind: 'privacy' })],
    ['/terms', h(LegalView, { lang, kind: 'terms' })],
    [COST_PATH, h(CostView, { lang })],
    ...getContent(lang).services.map((s): [string, ReactElement] => [`/services/${s.slug}`, h(ServiceDetailView, { lang, slug: s.slug })]),
    ...getCityPages(lang).map((p): [string, ReactElement] => [cityPath(p), h(CityView, { lang, program: p.program, slug: p.slug })]),
  ];
}
const site = new Map<Lang, Map<string, string>>();
const guides = new Map<Lang, Map<string, string>>();
for (const lang of LANGS) {
  site.set(lang, new Map(rest(lang).map(([path, view]) => [path, render(lang, path, view)])));
  guides.set(
    lang,
    new Map([
      [GUIDES_PATH, render(lang, GUIDES_PATH, h(GuidesView, { lang }))],
      ...guideSlugs.map((slug) => [guidePath(slug), render(lang, guidePath(slug), h(GuideView, { lang, slug }))] as [string, string]),
    ]),
  );
}

describe('guides: titles', () => {
  // A title is a search phrase, not a sentence: the one number it may hold
  // is in the names owners type ("30, 40 or 50-Year").
  it('a title types no number but those names', () => {
    for (const lang of LANGS) {
      for (const g of getGuides(lang)) {
        expect(g.seo.title.replace(NAME, ''), g.seo.title).not.toMatch(/\d/);
      }
    }
  });
});

describe('guides: the page a visitor gets', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    for (const g of getGuides(lang)) {
      const html = guides.get(lang)!.get(guidePath(g.slug))!;
      const main = mainOf(html).replace(/<script\b[\s\S]*?<\/script>/g, '');
      const name = `${lang} ${g.slug}`;
      const url = absoluteUrl(localePath(guidePath(g.slug), lang));

      it(`${name}: one h1, an h2 per section plus two, an h3 per question, and few headings in all`, () => {
        const count = (tag: string) => (main.match(new RegExp(`<${tag}\\b`, 'g')) ?? []).length;
        expect(count('h1')).toBe(1);
        expect(count('h2')).toBe(g.sections.length + 2 + 1); // + questions, keep reading, closing band
        expect(count('h3')).toBe(g.faq.length);
        expect(count('h1') + count('h2') + count('h3') + count('h4')).toBeLessThanOrEqual(23);
      });

      it(`${name}: prints its own text whole, once`, () => {
        expect(main).toContain(esc(g.h1));
        // A section's title is its h2 and its line in the contents beside it.
        for (const s of g.sections) expect(main.split(esc(s.title)).length - 1, s.title).toBe(2);
        for (const line of [g.heroSub, g.faqTitle, ...g.sections.flatMap((s) => [...s.paras, ...(s.list ?? [])]), ...g.faq.flatMap((f) => [f.q, f.a])]) {
          expect(main.split(esc(line)).length - 1, line).toBe(1);
        }
      });

      it(`${name}: every fact it names is printed whole, with the row’s source and date`, () => {
        for (const block of g.sections.flatMap((s) => s.facts ?? [])) {
          const { row, facts } = guideFacts(lang, block);
          for (const f of facts) expect(main).toContain(esc(f.v));
          // As Source prints it: a hyphenated part kept whole (`keepHyphens`).
          expect(main).toContain(renderToStaticMarkup(h('i', null, keepHyphens(row.source))).slice(3, -4));
        }
        expect(main).toContain(`<time dateTime="${guidesReviewedISO}">${guidesReviewed[lang]}</time>`);
      });

      it(`${name}: leads to its program pages, to the cost page, to the other guides and to the form`, () => {
        const hrefs = [...main.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
        for (const p of g.programs) expect(hrefs).toContain(localePath(`/services/${p}`, lang));
        expect(hrefs).toContain(localePath(COST_PATH, lang));
        for (const s of guideSlugs.filter((s) => s !== g.slug)) expect(hrefs).toContain(localePath(guidePath(s), lang));
        // The form: once per program, with that county preselected — a
        // Broward board must not land on a form set to Miami-Dade — or, for
        // the reader with no letter yet (`heroAction`), with no preset.
        const form = localePath('/contact', lang);
        if (g.heroAction === 'address') expect(hrefs).toContain(form);
        else for (const p of g.programs) expect(hrefs).toContain(`${form}?service=${p}`);
      });

      it(`${name}: says enough to be a page of its own`, () => {
        const body = text(main.replace(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/g, ''));
        expect(words(body)).toBeGreaterThanOrEqual(500);
      });

      it(`${name}: Article, FAQPage and BreadcrumbList data, matching the page`, () => {
        const nodes = ld(html);
        const article = nodes.find((n) => n['@type'] === 'Article');
        expect(article?.headline).toBe(g.h1);
        expect(article?.dateModified).toBe(guidesReviewedISO);
        expect(article?.url).toBe(url);
        const faq = nodes.find((n) => n['@type'] === 'FAQPage');
        expect(faq?.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [q.name, q.acceptedAnswer.text])).toEqual(g.faq.map((f) => [f.q, f.a]));
        const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList');
        expect(crumbs?.itemListElement.map((i: { item: string }) => i.item)).toEqual([
          `${company.url}${localePath('/', lang)}`,
          `${company.url}${localePath(GUIDES_PATH, lang)}`,
          url,
        ]);
        expect(c.ui.home).toBeTruthy();
      });
    }

    it(`${lang} /guides: lists every guide, by name, with its own line`, () => {
      const main = mainOf(guides.get(lang)!.get(GUIDES_PATH)!);
      for (const g of getGuides(lang)) {
        expect(main).toContain(`href="${localePath(guidePath(g.slug), lang)}"`);
        expect(main).toContain(esc(g.card));
      }
    });

    // The hub is a page of its own too: the same floor as a guide, counted
    // the same way (its <main>, the closing band apart). It was 385 words.
    it(`${lang} /guides: says enough to be a page of its own`, () => {
      const main = mainOf(guides.get(lang)!.get(GUIDES_PATH)!);
      const body = text(main.replace(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/g, ''));
      expect(words(body)).toBeGreaterThanOrEqual(500);
    });

    for (const program of PROGRAMS) {
      it(`${lang} ${program}: the program page links each of its guides`, () => {
        const main = mainOf(site.get(lang)!.get(`/services/${program}`)!);
        for (const g of getGuides(lang).filter((x) => (x.programs as string[]).includes(program))) {
          expect(main).toContain(`href="${localePath(guidePath(g.slug), lang)}"`);
        }
      });
    }
  }
});

/* The reader with no letter yet (`heroAction: 'address'`) is never asked to
   send a notice: under "Send the Address", the hero and the closing band say
   "Message us on WhatsApp", and the chat opens without "I received a notice".
   Every other guide is read by someone holding the letter, and keeps the
   notice wording. (The phone bar is outside <main>: it reads notice-pages.ts,
   whose own test keeps its list equal to the guides' `heroAction`.) */
describe('guides: no "Send the notice" where the reader may have no letter', () => {
  for (const lang of LANGS) {
    const r = getContent(lang).reach;
    const count = (html: string, s: string) => html.split(s).length - 1;
    const noticeText = encodeURIComponent(r.whatsappText).replace(/'/g, '%27');
    for (const g of getGuides(lang)) {
      const html = guides.get(lang)!.get(guidePath(g.slug))!;
      const main = mainOf(html);
      const bar = html.match(/<nav class="mp-bar[\s\S]*?<\/nav>/)?.[0] ?? '';
      if (g.heroAction === 'address') {
        it(`${lang} ${g.slug}: WhatsApp without the notice, in the hero, the closing band and the phone bar`, () => {
          expect(count(main, esc(r.whatsappPlain))).toBe(2);
          expect(main).not.toContain(esc(r.whatsappNotice));
          expect(main).not.toContain(noticeText);
          expect(main).toContain(encodeURIComponent(r.whatsappTextPlain).replace(/'/g, '%27'));
          expect(bar).not.toBe('');
          expect(bar).not.toContain(`>${esc(r.form)}</a>`);
          expect(bar).not.toContain(noticeText);
        });
      } else {
        it(`${lang} ${g.slug}: the notice, in the hero, the closing band and the phone bar`, () => {
          expect(count(main, esc(r.whatsappNotice))).toBe(2);
          expect(main).not.toContain(esc(r.whatsappPlain));
          expect(bar).toContain(`>${esc(r.form)}</a>`);
        });
      }
    }
  }
});

describe('guides: no block of text is printed on two pages', () => {
  for (const lang of LANGS) {
    it(`${lang}: nothing of six words or more is shared between two guides, or between a guide and the rest of the site`, () => {
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
      for (const [path, html] of guides.get(lang)!) add(path, html);
      const c = getContent(lang);
      const already = new Set([norm(c.leadership.name)]);
      const ours = new Set(guides.get(lang)!.keys());
      const shared = [...where]
        .filter(([k, v]) => v.pages.size > 1 && !already.has(k) && [...v.pages].some((x) => ours.has(x)))
        .map(([, v]) => `${[...v.pages].join(' + ')}: ${v.text}`);
      expect(shared).toEqual([]);
    });
  }
});

describe('guides: addresses', () => {
  const paths = [GUIDES_PATH, ...guideSlugs.map(guidePath)];
  it('each one is a known public page in both languages, on the marketing site, and a lookalike is a 404', () => {
    for (const p of paths) {
      expect(EN_PUBLIC_PAGES).toContain(p);
      expect(ES_PUBLIC_PAGES).toContain(localePath(p, 'es'));
      expect(isPublicRoute(p)).toBe(true);
      expect(isMarketingRoute(p)).toBe(true);
      expect(publicNotFoundTarget(p)).toBeNull();
    }
    expect(publicNotFoundTarget('/guides/nope')).toBe(PUBLIC_NOT_FOUND);
  });

  it('the sitemap lists every one of them, in both languages', () => {
    const urls = sitemap().map((e) => e.url);
    for (const p of paths) for (const lang of LANGS) expect(urls).toContain(absoluteUrl(localePath(p, lang)));
  });

  it('the header and the footer link the index, in both languages', () => {
    for (const lang of LANGS) {
      const c = getContent(lang);
      expect(c.primaryNav.map((n) => n.href)).toContain(GUIDES_PATH);
      expect(c.footerNav.flatMap((col) => col.items.map((n) => n.href))).toContain(GUIDES_PATH);
    }
  });

  it('a slug that is not a guide finds nothing', () => {
    expect(findGuide('en', 'nope')).toBeUndefined();
  });
});

/** The same walk as cities.test.ts: no 'use client' file may reach the guides' text. */
describe('guides: their text is in no client bundle', () => {
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
    if (!base) return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
  };
  const imports = (file: string): string[] => {
    const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const found: string[] = [];
    for (const m of code.matchAll(/\b(?:import|export)\s+(type\s+)?(?:[\w*\s{},$]+?\s+from\s+)?['"]([^'"]+)['"]/g)) if (!m[1]) found.push(m[2]);
    for (const m of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(m[1]);
    return found.map((spec) => resolveImport(file, spec)).filter((x): x is string => Boolean(x));
  };
  const TEXT = ['guides.en.ts', 'guides.es.ts', 'guide-content.ts'].map((name) => join(SRC, 'lib', 'ttc', name));

  it("no 'use client' file can reach the guides' text", () => {
    for (const f of TEXT) expect(existsSync(f), f).toBe(true);
    const clients = files(SRC).filter((f) => /^\s*(?:\/\*[\s\S]*?\*\/\s*)?['"]use client['"]/.test(read(f)));
    const seen = new Set<string>(clients);
    const queue = [...clients];
    while (queue.length) {
      for (const next of imports(queue.pop()!)) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    expect(TEXT.filter((f) => seen.has(f))).toEqual([]);
  }, 30_000);
});
