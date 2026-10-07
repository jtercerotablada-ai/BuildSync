import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { JUMP_ID } from '@/components/ttc/mp/JumpLinks';
import { afterFirstSentence, firstSentence } from '@/components/ttc/mp/text';
import { AboutView } from './AboutView';
import { ContactView } from './ContactView';
import { ExistingView } from './ExistingView';
import { HomeView } from './HomeView';
import { LegalView } from './LegalView';
import { ServiceDetailView } from './ServiceDetailView';
import { ServicesView } from './ServicesView';
import { WorkView } from './WorkView';

/**
 * The owner's on-page report (October 7, 2026) counted 196 "content/text
 * blocks present on more than one page". A good share of them sat between
 * four pages: the two county programs printed the same questions, scope
 * lines, duties and caveats as each other, and the home page's two program
 * sections printed the program pages' timing rows whole.
 *
 * This file renders every page the way pages.test.ts does and measures the
 * same thing the report does, for those four pages: a block of text of six
 * words or more that is printed on two or more of them, and on no other
 * page. (Text the whole site repeats on purpose — the closing band, the
 * free-proposal line — is on other pages too, and is not this file's.)
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const RECERT = '/services/building-recertification';
const BSIP = '/services/broward-bsip';
const MILESTONE = '/services/milestone-inspections';
/** The pages whose shared text this file answers for. */
const OURS = ['/', RECERT, BSIP, MILESTONE];

function views(lang: Lang): [path: string, view: ReactElement][] {
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

const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
/* The text of an element as a browser gives it (`textContent`): the tags go
   and nothing takes their place, so a section label reads '06How the work
   runs' — one word shorter than with a space, which is how the report's own
   count comes out. Where two inline elements need a space between them, the
   markup has one. */
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
/** The report's comparison: case and punctuation do not make a text new. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const words = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
/** Every paragraph, list item, table cell and heading of a page's <main>. */
const blocks = (html: string) => {
  const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? html;
  return [...main.matchAll(/<(p|dd|dt|li|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((m) => text(m[2]))
    .filter(Boolean);
};

/** `${lang}` → path → HTML, as the layout serves it. */
const html = new Map<Lang, Map<string, string>>();
for (const lang of LANGS) {
  const byPath = new Map<string, string>();
  for (const [path, view] of views(lang)) {
    route.pathname = localePath(path, lang);
    byPath.set(path, renderToStaticMarkup(h(SiteChrome, null, view)));
  }
  html.set(lang, byPath);
}

/** Blocks of six words or more, each with the pages that print it. */
function shared(lang: Lang): { text: string; pages: string[] }[] {
  const where = new Map<string, { text: string; pages: Set<string> }>();
  for (const [path, page] of html.get(lang)!) {
    for (const block of blocks(page)) {
      if (words(block) < 6) continue;
      const key = norm(block);
      if (!where.has(key)) where.set(key, { text: block, pages: new Set() });
      where.get(key)!.pages.add(path);
    }
  }
  return [...where.values()]
    .filter((v) => v.pages.size >= 2)
    .map((v) => ({ text: v.text, pages: [...v.pages] }));
}

describe('home page and county program pages: no block of text on two of them', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const u = c.ui;
    const e = c.leadership;
    /* What these pages still share, and why each is left:
         · the engineer's name and license — a credential is the same line
           wherever it is shown, and it is on both program pages on purpose;
         · the heading of the board's duties, six words in Spanish — a label,
           cited by name from the answers; its tag is another package's;
         · the day the office names were last checked — one date, one line,
           under "Who sent your notice?" on both pages. */
    const left = (t: string) =>
      t.includes(e.name) ||
      norm(t) === norm(u.boardDuties) ||
      norm(t).startsWith(norm(u.linksChecked));

    it(`${lang}: nothing but the credential and two labels is on more than one of the four pages`, () => {
      const ours = shared(lang).filter((b) => b.pages.every((p) => OURS.includes(p)));
      expect(ours.filter((b) => !left(b.text)).map((b) => `${b.pages.join(' | ')} :: ${b.text}`)).toEqual([]);
    });

    // The questions, whatever their length ("How long do we have?" is five
    // words and was on both pages): each is printed on its own page, and on
    // that page only — in the list and in the FAQPage markup alike.
    it(`${lang}: the two program pages ask no question in the same words`, () => {
      const faq = (slug: string) => c.services.find((s) => s.slug === slug)!.faq ?? [];
      const pageOf = { 'building-recertification': RECERT, 'broward-bsip': BSIP } as const;
      for (const [slug, other] of [
        ['building-recertification', 'broward-bsip'],
        ['broward-bsip', 'building-recertification'],
      ] as const) {
        expect(faq(slug).length).toBeGreaterThan(0);
        for (const { q } of faq(slug)) {
          expect(html.get(lang)!.get(pageOf[slug])!, q).toContain(esc(q));
          expect(html.get(lang)!.get(pageOf[other])!, q).not.toContain(esc(q));
        }
      }
    });
  }
});

describe('home page: each program section is a summary of its page', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const home = html.get(lang)!.get('/')!;

    for (const slug of ['building-recertification', 'broward-bsip']) {
      const service = c.services.find((s) => s.slug === slug)!;
      const program = service.program!;
      const row = service.timing!.rows[0];
      const section = home.match(new RegExp(`<section id="${program.id}"[\\s\\S]*?</section>`))![0];
      const page = html.get(lang)!.get(`/services/${slug}`)!;

      // Label and first sentence, one item: cut from the row, never retyped.
      it(`${slug} (${lang}): prints the flagged rows, each as its label and first sentence`, () => {
        const items = [...section.matchAll(/<ul class="mp-prog__facts">([\s\S]*?)<\/ul>/g)].flatMap((m) =>
          [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((li) => text(li[1])),
        );
        const want = row.facts
          .filter((f) => f.home)
          .map((f) => text(esc(`${f.k}: ${f.homeWhole ? f.v : firstSentence(f.v)}`)));
        expect(items).toEqual(want);
        expect(items.length).toBeLessThan(row.facts.length);
      });

      // The whole value of a row is the program page's to print.
      it(`${slug} (${lang}): prints no row whole that has more to say`, () => {
        for (const f of row.facts.filter((x) => !x.homeWhole && firstSentence(x.v) !== x.v)) {
          expect(section, f.k).not.toContain(esc(f.v));
          expect(page, f.k).toContain(esc(f.v));
        }
      });

      it(`${slug} (${lang}): under its button, the half of the line the program page does not open with`, () => {
        const note = section.match(/<p class="mp-prog__ctanote">([\s\S]*?)<\/p>/)![1];
        expect(note).toBe(esc(`${c.ui.photoTheLetter} ${afterFirstSentence(program.ctaNote)}`));
        expect(section).not.toContain(esc(program.ctaNote));
        // …and the program page still prints the line whole, once.
        expect(page.split(esc(program.ctaNote)).length - 1).toBe(1);
      });

      it(`${slug} (${lang}): one link to the whole table, on the program's page`, () => {
        const href = esc(localePath(`/services/${slug}#${JUMP_ID.applies}`, lang));
        const links = [...section.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].filter((m) => m[1] === href);
        expect(links).toHaveLength(1);
        expect(text(links[0][2])).toContain(text(esc(program.timingLink)));
        // The anchor exists on the page it points at.
        expect(page).toContain(`id="${JUMP_ID.applies}"`);
      });

      // Every number in the section answers to this line, as before.
      it(`${slug} (${lang}): still names the authority and the date beside its rows`, () => {
        expect(section).toContain(esc(row.source));
        expect(section).toContain(esc(service.timing!.checked));
      });
    }

    it(`${lang}: the two sections print no paragraph in common`, () => {
      const sections = ['miami-dade', 'broward'].map(
        (id) => new Set(blocks(`<main>${home.match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`))![0]}</main>`).filter((b) => words(b) >= 6).map(norm)),
      );
      expect([...sections[0]].filter((b) => sections[1].has(b))).toEqual([]);
    });
  }
});

describe('regulated service pages: the date of the rows is printed with their source', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    for (const service of c.services.filter((s) => s.timing?.rows.length === 1)) {
      it(`${service.slug} (${lang}): one line, the authority and the date`, () => {
        const page = html.get(lang)!.get(`/services/${service.slug}`)!;
        const row = service.timing!.rows[0];
        const lines = blocks(page).filter((b) => b.startsWith(text(esc(row.source))));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain(text(esc(`${c.ui.lastChecked}: ${service.timing!.checked}`)));
        // …and the date is not a paragraph of its own any more.
        expect(blocks(page)).not.toContain(text(esc(`${c.ui.lastChecked}: ${service.timing!.checked}`)));
      });
    }
  }
});
