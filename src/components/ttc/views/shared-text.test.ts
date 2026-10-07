import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { AboutView } from './AboutView';
import { ExistingView } from './ExistingView';
import { HomeView } from './HomeView';
import { ServiceDetailView } from './ServiceDetailView';
import { ServicesView } from './ServicesView';
import { WorkView } from './WorkView';

/**
 * ONE HOME FOR EACH PIECE OF TEXT.
 *
 * The owner's on-page check (October 7, 2026) counted 196 text blocks that
 * were printed on more than one page. Most of them were here: the four
 * existing-building services were the same cards on /services and on
 * /existing-buildings; every card repeated the first lines of the page it
 * opens; "who we work with" was one block on three pages; the home page's
 * engineer teaser repeated three rows of /about; and the six ordinary
 * service pages shared a headline. None of that breaks a build or shows in
 * a browser, so the pages are rendered here and compared.
 *
 * What these tests cover is the listing pages and the six ordinary service
 * pages. The two county-program pages are compared with each other and with
 * the home page elsewhere; here they appear only as the page a card opens.
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const PROGRAMS = ['building-recertification', 'broward-bsip'];

/** A string as React prints it in text. */
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function render(lang: Lang, path: string, view: ReactElement): string {
  route.pathname = localePath(path, lang);
  return renderToStaticMarkup(view);
}

type Page = { lang: Lang; path: string; html: string };
const pages: Page[] = LANGS.flatMap((lang) => {
  const views: [string, ReactElement][] = [
    ['/', h(HomeView, { lang })],
    ['/about', h(AboutView, { lang })],
    ['/services', h(ServicesView, { lang })],
    ['/existing-buildings', h(ExistingView, { lang })],
    ['/projects', h(WorkView, { lang })],
    ...getContent(lang).services.map(
      (s): [string, ReactElement] => [`/services/${s.slug}`, h(ServiceDetailView, { lang, slug: s.slug })],
    ),
  ];
  return views.map(([path, view]) => ({ lang, path, html: render(lang, path, view) }));
});
const page = (lang: Lang, path: string) => pages.find((p) => p.lang === lang && p.path === path)!.html;
/** How many times a page prints a string. */
const count = (html: string, needle: string) => html.split(esc(needle)).length - 1;

describe('a service card and the page it opens', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const index = page(lang, '/services');

    for (const s of c.services) {
      const own = page(lang, `/services/${s.slug}`);

      it(`${s.slug} (${lang}): the card's lines are on /services, once, and not on the service's page`, () => {
        for (const line of [s.summary, s.card.when, s.card.receive, s.card.next]) {
          expect(count(index, line), line).toBe(1);
          expect(count(own, line), line).toBe(0);
        }
      });

      it(`${s.slug} (${lang}): the page's lines are not on the card`, () => {
        expect(s.heroSub, 'a page without `heroSub` falls back to the card’s summary').toBeTruthy();
        for (const line of [s.heroSub!, s.when[0], s.deliverables[0], s.nextStep, s.problem]) {
          expect(count(own, line), line).toBe(1);
          expect(count(index, line), line).toBe(0);
        }
      });
    }

    it(`${lang}: no two services share a card line or a first line`, () => {
      const lines = c.services.flatMap((s) => [s.summary, s.heroSub, s.card.when, s.card.receive, s.card.next]);
      expect(new Set(lines).size).toBe(lines.length);
    });
  }

  // A card line is a shorter telling of the service's own page, so it obeys
  // the page's rules: a county's ages and day counts are printed from its
  // timing row and nowhere else, and the site does not say who signs.
  it('a card line carries no number and names no signature', () => {
    for (const lang of LANGS) {
      for (const s of getContent(lang).services) {
        for (const line of [s.card.when, s.card.receive, s.card.next, ...(PROGRAMS.includes(s.slug) ? [] : [s.heroSub ?? ''])]) {
          expect(line, `${s.slug} (${lang})`).not.toMatch(/\d/);
          expect(line, `${s.slug} (${lang})`).not.toMatch(/\bsigns?\b|\bseal(?:s|ed)?\b|\bfirma(?:r|n|do|da)?\b(?! de)|\bsell(?:a|o|ado|ada)\b/i);
        }
      }
    }
  });
});

describe('/existing-buildings is a hub, not a second /services', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const hub = page(lang, '/existing-buildings');
    const existing = c.services.filter((s) => s.track === 'existing');
    const items = c.existingPage.triggers.items;

    it(`${lang}: one situation per existing-building service, in the services' order`, () => {
      expect(items.map((i) => i.slug)).toEqual(existing.map((s) => s.slug));
    });

    it(`${lang}: each situation prints its own line and one link, the service by its short name`, () => {
      const cards = [...hub.matchAll(/<div class="[^"]*mp-svc--sit[^"]*"[^>]*>([\s\S]*?)<\/div><\/div>/g)].map((m) => m[1]);
      expect(cards).toHaveLength(items.length);
      cards.forEach((card, i) => {
        const s = existing[i];
        expect(card).toContain(esc(items[i].k));
        expect(card).toContain(esc(items[i].v));
        const links = [...card.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);
        expect(links).toEqual([[localePath(`/services/${s.slug}`, lang), text(esc(`${s.shortTitle} →`))]]);
      });
    });

    it(`${lang}: it prints none of the service cards' lines`, () => {
      for (const s of existing) {
        for (const line of [s.summary, s.card.when, s.card.receive, s.card.next, s.capabilities.join(' · '), s.when[0], s.deliverables[0], s.nextStep]) {
          expect(count(hub, line), line).toBe(0);
        }
      }
    });

    it(`${lang}: its lines are printed nowhere else`, () => {
      for (const p of pages.filter((x) => x.lang === lang && x.path !== '/existing-buildings')) {
        for (const item of items) {
          expect(count(p.html, item.k), `${p.path}: ${item.k}`).toBe(0);
          expect(count(p.html, item.v), `${p.path}: ${item.v}`).toBe(0);
        }
      }
    });

    // The site's rule for every county number: printed from the timing row
    // of that county's own page. A hub line points there instead.
    it(`${lang}: a situation types no age, no day count and no deadline`, () => {
      for (const item of items) expect(`${item.k} ${item.v}`).not.toMatch(/\d/);
    });
  }
});

describe('who we work with: whole on the home page, short on the other two', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const p = c.partner;
    const home = page(lang, '/');
    const about = page(lang, '/about');
    const hub = page(lang, '/existing-buildings');
    const dbpr = esc(c.leadership.license!.url);
    const licenses = [c.leadership.license!.number, ...p.construction.licenses.map((l) => l.number)];
    /** The license numbers a page prints as links to the state's search. */
    const linked = (html: string) =>
      [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
        .filter((m) => m[1] === dbpr)
        .map((m) => text(m[2]));

    it(`${lang}: the lede, the cards' headline and the registry note are the home page's alone`, () => {
      for (const line of [p.lede, p.title, p.verifyLead]) {
        expect(count(home, line), line).toBe(1);
        expect(count(about, line), line).toBe(0);
        expect(count(hub, line), line).toBe(0);
      }
    });

    it(`${lang}: each short form is on its own page and nowhere else`, () => {
      for (const [own, short] of [[about, p.about], [hub, p.brief]] as const) {
        for (const line of [short.title, short.body]) {
          expect(count(own, line), line).toBe(1);
          for (const other of [home, about, hub].filter((x) => x !== own)) expect(count(other, line), line).toBe(0);
        }
      }
    });

    // The owner's condition: the three licenses stay checkable on the home
    // page and on /about. The hub links to /about for them.
    it(`${lang}: the three license numbers are links to the DBPR search on the home page and on /about`, () => {
      const verify = text(esc(c.ui.engineer.verify));
      for (const html of [home, about]) {
        const found = linked(html);
        for (const number of licenses) {
          expect(found.filter((t) => t === `${number} — ${verify}`), number).toHaveLength(1);
        }
      }
      expect(linked(hub)).toEqual([]);
      expect(hub).toContain(`href="${localePath(p.brief.link.href, lang)}"`);
      expect(about).toContain('id="contractor"');
    });

    // The owner's sentence stays where he approved it.
    it(`${lang}: the home page keeps the sentence with the combined experience`, () => {
      expect(p.lede).toMatch(/30/);
      expect(count(home, p.lede)).toBe(1);
    });

    // One team, two separate firms: no short form may say who does what on
    // a job, that Precision Source repairs, or who signs. Verb forms only —
    // "la firma" is simply "the firm" in Spanish.
    it(`${lang}: no short form splits the work or names a signature`, () => {
      const said = [p.about.title, p.about.body, p.brief.title, p.brief.body, p.brief.link.label].join(' ');
      expect(said).not.toMatch(/\bsign|\bseal|firmad[oa]|sellad[oa]|\bfirman?\b(?! [A-Z])|\bsella[n]?\b/i);
      expect(said).not.toMatch(/repairs?|reparaci|construction arm|subcontract|partner\b|socio/i);
    });
  }
});

describe('the engineer: a teaser on the home page, the full account on /about', () => {
  for (const lang of LANGS) {
    const e = getContent(lang).leadership;
    const home = page(lang, '/');
    const about = page(lang, '/about');

    it(`${lang}: the three rows are explained on /about; the home page prints their names`, () => {
      for (const row of e.forYou) {
        expect(count(about, row.v), row.v).toBe(1);
        expect(count(home, row.v), row.v).toBe(0);
        expect(count(home, row.k), row.k).toBe(1);
      }
    });

    it(`${lang}: the line over each headline is its own`, () => {
      const over = (html: string) => text(html.match(/<p class="mp-eng__role">([\s\S]*?)<\/p>/)![1]);
      expect(over(home)).not.toBe(over(about));
      // The home page's is the license: the number a board can check.
      expect(over(home)).toContain(text(esc(e.license!.number)));
    });
  }
});

/**
 * The net under the four blocks above: every paragraph, list item, table
 * cell and heading of these pages, compared across them. Six words is where
 * the ruler built for the on-page check draws the line — under that are
 * labels ("What that means for you", "Miami-Dade & Broward").
 *
 * Left out, on purpose:
 *   • The band that closes every page (`mp-close`). It is the same band on
 *     thirteen of the sixteen pages of each language, and the check itself
 *     sets aside what "appears on a large number of your pages".
 *   • The firm's name and a service's name: a name is the same wherever it
 *     is printed, and a card is titled with the name of the page it opens.
 */
describe('listing pages and ordinary service pages: no block of text on two pages', () => {
  // Words, not numbers: "03 — How the work runs" is a five-word label with
  // its section number in front, on every service page.
  const words = (s: string) => (s.match(/\p{L}[\p{L}\p{N}'’-]*/gu) ?? []).length;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  const blocks = (html: string) =>
    [...html.replace(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/g, '').matchAll(/<(p|li|dd|dt|h[1-6]|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/g)]
      .map((m) => text(m[2]))
      .filter((t) => words(t) >= 6);

  for (const lang of LANGS) {
    const c = getContent(lang);
    const names = new Set([c.company.name, ...c.services.map((s) => s.title)].map((n) => norm(text(esc(n)))));
    const mine = pages.filter((p) => p.lang === lang && !PROGRAMS.some((slug) => p.path === `/services/${slug}`));

    it(`${lang}: reads the five listing pages and the six ordinary services`, () => {
      expect(mine).toHaveLength(11);
    });

    it(`${lang}: every block of six words or more is on one page`, () => {
      const where = new Map<string, Set<string>>();
      for (const p of mine) {
        for (const b of blocks(p.html)) {
          const k = norm(b);
          if (names.has(k)) continue;
          if (!where.has(k)) where.set(k, new Set());
          where.get(k)!.add(p.path);
        }
      }
      const shared = [...where].filter(([, on]) => on.size > 1).map(([k, on]) => `${[...on].join(' + ')}: ${k}`);
      expect(shared).toEqual([]);
    });
  }
});
