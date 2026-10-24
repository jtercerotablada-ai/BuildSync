import { createElement as h, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { photo, video } from '@/lib/ttc/media';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { firstSentence, keepHyphens } from '@/components/ttc/mp/text';
import { cityPath } from '@/lib/ttc/cities';
import { getCityPages } from '@/lib/ttc/city-content';
import { pageHoldsNotice } from '@/lib/ttc/notice-pages';
import { whatsappHref } from '@/components/ttc/mp/ReachRow';
import { GuideView } from './GuideView';
import { AboutView } from './AboutView';
import { BEAM_PATH, BeamCalculatorView } from './BeamCalculatorView';
import { SPAN_PATH, SingleSpanView } from './SingleSpanView';
import { CalculatorsView } from './CalculatorsView';
import { CONTINUOUS_PATH, ContinuousBeamView } from './ContinuousBeamView';
import { CityView } from './CityView';
import { ContactView } from './ContactView';
import { ExistingView } from './ExistingView';
import { HomeView } from './HomeView';
import { LegalView } from './LegalView';
import { NotFoundView } from './NotFoundView';
import { ServiceDetailView } from './ServiceDetailView';
import { ServicesView } from './ServicesView';
import { SHAFT_PATH, ShaftView } from './ShaftView';
import { TRUSS_PATH, TrussView } from './TrussView';
import { CABLE_PATH, CableView } from './CableView';
import { CABLE_SAG_PATH, CableSagView } from './CableSagView';
import { FRAME_PATH, FrameView } from './FrameView';
import { STIFFNESS_PATH, StiffnessView } from './StiffnessView';
import { WorkView } from './WorkView';

/**
 * What the SERVER sends for every public page, read the way a crawler and a
 * screen reader read it: the images, the links, and — on the two county
 * program pages — the paragraphs.
 *
 * An on-page check of the live site (October 7, 2026) found an empty alt on
 * nearly every image, cards that were one link with two hundred characters of
 * text, image links with no text at all, and sentences printed twice on the
 * program pages. None of it shows in a browser, and none of it breaks a
 * build — so the real pages are rendered here, header and footer included,
 * in both languages.
 */

// The header, the footer and every client section read the language from the
// URL; outside Next there is none, so each render supplies the page's own.
const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const PROGRAMS = ['building-recertification', 'broward-bsip'];

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
    ['/public-not-found', h(NotFoundView, { lang })],
    // The calculators catalogue and the calculators that are open
    // (calculators.test.ts and each calculator's own test have their own rules).
    ['/resources', h(CalculatorsView, { lang })],
    [BEAM_PATH, h(BeamCalculatorView, { lang })],
    [SPAN_PATH, h(SingleSpanView, { lang })],
    [CONTINUOUS_PATH, h(ContinuousBeamView, { lang })],
    [SHAFT_PATH, h(ShaftView, { lang })],
    [TRUSS_PATH, h(TrussView, { lang })],
    [CABLE_PATH, h(CableView, { lang })],
    [CABLE_SAG_PATH, h(CableSagView, { lang })],
    [FRAME_PATH, h(FrameView, { lang })],
    [STIFFNESS_PATH, h(StiffnessView, { lang })],
    ...getContent(lang).services.map(
      (s): [string, ReactElement] => [
        `/services/${s.slug}`,
        h(ServiceDetailView, { lang, slug: s.slug }),
      ],
    ),
    // One page per city, under its county program (cities.ts).
    ...getCityPages(lang).map(
      (p): [string, ReactElement] => [
        cityPath(p),
        h(CityView, { lang, program: p.program, slug: p.slug }),
      ],
    ),
  ];
}

/** Every page of the site, as the layout serves it: `${lang} ${path}` → HTML. */
const pages = new Map<string, { lang: Lang; path: string; html: string }>();
for (const lang of LANGS) {
  for (const [path, view] of views(lang)) {
    route.pathname = localePath(path, lang);
    pages.set(`${lang} ${path}`, {
      lang,
      path,
      html: renderToStaticMarkup(h(SiteChrome, null, view)),
    });
  }
}

/** A string as React prints it in an attribute or in text. */
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
/** Inline markup (a string or the nodes of a helper like `keepHyphens`) as React prints it. */
const inline = (node: ReactNode) => renderToStaticMarkup(h('i', null, node)).slice(3, -4);
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const imgs = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const links = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    href: attr(m[1], 'href') ?? '',
    inner: m[2],
    text: text(m[2]),
  }));
/* A paragraph, for the purpose of "printed twice": every <p>, and every <dd>
   and <li> — on these pages the timing rows, the scope lists and the board's
   duties are sentences that happen to sit in a list. */
const paragraphs = (html: string) =>
  [...html.matchAll(/<(p|dd|li)\b[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((m) => text(m[2]))
    .filter(Boolean);

/* The description written beside each photograph and each clip in media.ts,
   by the file an <img> actually points at. */
const written = new Map<string, { alt: string; altEs: string }>();
for (const p of Object.values(photo)) written.set(p.src, p);
for (const clip of Object.values(video)) written.set(clip.poster, clip);

describe('media catalogue: what each picture is said to show', () => {
  const all = [...Object.entries(photo), ...Object.entries(video)];

  it('every photograph and clip is described in English and in Spanish', () => {
    for (const [key, m] of all) {
      expect(m.alt.trim(), key).not.toBe('');
      expect(m.altEs.trim(), key).not.toBe('');
      expect(m.altEs, key).not.toBe(m.alt);
    }
  });

  // A county's ages and deadlines are printed from its timing row and nowhere
  // else (site.ts). No description needs a figure at all today, so the
  // simplest guard is the strict one: a number in an alt is a number retyped.
  it('no description carries a figure', () => {
    for (const [key, m] of all) {
      expect(m.alt, key).not.toMatch(/\d/);
      expect(m.altEs, key).not.toMatch(/\d/);
    }
  });

  // The two program photographs illustrate the kind of building a program
  // reaches. Naming a county or a city under either would caption a stock
  // photograph as a building that received a notice.
  it('the two program photographs name no county and no city', () => {
    for (const m of [photo.recertMiamiDade, photo.bsipBroward]) {
      for (const alt of [m.alt, m.altEs]) {
        expect(alt).not.toMatch(/Miami|Dade|Broward|Lauderdale|Hollywood/i);
      }
    }
  });
});

describe('images: every <img> the public pages send', () => {
  for (const { lang, path, html } of pages.values()) {
    it(`${lang} ${path}: each one says what it is`, () => {
      const tags = imgs(html);
      // The header's two marks and the footer lockup, at the very least.
      expect(tags.length).toBeGreaterThanOrEqual(3);
      for (const tag of tags) expect(attr(tag, 'alt')?.trim(), tag).toBeTruthy();
    });

    it(`${lang} ${path}: a photograph carries its written description, in the page's language`, () => {
      for (const tag of imgs(html)) {
        const m = written.get(attr(tag, 'src') ?? '');
        if (m) expect(attr(tag, 'alt'), tag).toBe(esc(lang === 'es' ? m.altEs : m.alt));
      }
    });

    // The alts were added for whoever reads the image and not the page. For a
    // screen reader nothing may have changed: every image that used to be
    // silent (`alt=""`) is still silent, now through `aria-hidden`. The one
    // image that speaks is the footer lockup, which always did. When a
    // photograph becomes content (`decorative={false}`), it joins that list.
    it(`${lang} ${path}: only the footer lockup is read out`, () => {
      const spoken = imgs(html)
        .filter((tag) => attr(tag, 'aria-hidden') !== 'true')
        .map((tag) => attr(tag, 'src'));
      // The team's portraits are content too: they are read out where
      // TeamGrid renders them — /about, their only page.
      const c = getContent(lang);
      const portrait = path === '/about' ? c.aboutPage.team.members.map((m) => m.photo.src) : [];
      expect(spoken).toEqual([...portrait, c.company.logo.lockupLightSm]);
    });
  }

  it('a logo is named for the firm it belongs to', () => {
    for (const lang of LANGS) {
      const c = getContent(lang);
      const home = pages.get(`${lang} /`)!.html;
      const altOf = (src: string) =>
        imgs(home)
          .filter((tag) => attr(tag, 'src') === src)
          .map((tag) => attr(tag, 'alt'));
      const firm = esc(c.company.name);
      expect(altOf(c.company.logo.markDarkXs)).toEqual([firm]);
      expect(altOf(c.company.logo.markLightXs)).toEqual([firm]);
      expect(altOf(c.company.logo.markDarkSm)).toEqual([firm]);
      expect(altOf(c.partner.construction.logo.src)).toEqual([esc(c.partner.construction.name)]);
    }
  });
});

describe('links: the text of a link is the name of where it goes', () => {
  /* Where the on-page check draws the line. Every page name, button and nav
     label on the site is well under it; what went over was a whole card —
     photograph, title and its paragraph — wrapped in one <a>. Internal links
     only: a link out to an authority is named by that authority's own title,
     and Broward's runs longer than this. */
  const LINK_TEXT_MAX = 120;
  const internal = (href: string) => href.startsWith('/') || href.startsWith('#');

  for (const { lang, path, html } of pages.values()) {
    it(`${lang} ${path}: no internal link reads out a paragraph`, () => {
      for (const a of links(html).filter((x) => internal(x.href))) {
        expect(a.text.length, `${a.href}: ${a.text}`).toBeLessThanOrEqual(LINK_TEXT_MAX);
      }
    });

    it(`${lang} ${path}: a link with no text of its own is an image that has an alt`, () => {
      for (const a of links(html).filter((x) => x.text === '')) {
        const inside = imgs(a.inner);
        expect(inside.length, a.href).toBeGreaterThan(0);
        for (const tag of inside) expect(attr(tag, 'alt')?.trim(), a.href).toBeTruthy();
      }
    });

    it(`${lang} ${path}: no link sits inside another`, () => {
      for (const a of links(html)) expect(a.inner, a.href).not.toMatch(/<a\b/);
    });
  }

  for (const lang of LANGS) {
    const c = getContent(lang);
    const html = pages.get(`${lang} /services`)!.html;

    // Typologies.tsx: the <a> is the title; its ::after covers the card.
    it(`${lang}: a typology card is linked by its title alone`, () => {
      const cards = [
        ...html.matchAll(/<li class="[^"]*mp-typo__card[^"]*"[^>]*>([\s\S]*?)<\/li>/g),
      ].map((m) => links(m[1]));
      expect(cards).toHaveLength(c.typologies.length);
      cards.forEach((inCard, i) => {
        const t = c.typologies[i];
        expect(inCard.map((a) => [a.href, a.text])).toEqual([
          [localePath(t.href, lang), text(esc(t.title))],
        ]);
        expect(inCard[0].inner).not.toMatch(/<img\b/);
      });
    });

    // ServiceCard.tsx: the photograph is reached through the title's link,
    // not through an <a> of its own with nothing but an image in it.
    it(`${lang}: a service card's photograph is not a second link`, () => {
      expect(html).not.toMatch(/<a\b[^>]*class="[^"]*mp-svc__media/);
      // …and the link that reaches over it is the card's title, by name.
      const titles = [...html.matchAll(/<h3 class="mp-svc__title">([\s\S]*?)<\/h3>/g)].flatMap(
        (m) => links(m[1]).map((a) => `${a.href} ${a.text}`),
      );
      expect(titles.sort()).toEqual(
        c.services
          .map((s) => `${localePath(`/services/${s.slug}`, lang)} ${text(esc(s.title))}`)
          .sort(),
      );
    });
  }
});

/**
 * WHERE THE SITE LINKS OUT, as a list of hosts.
 *
 * The two county-program pages linked each city's building office under "Who
 * sent your notice?" — twenty-four city and town websites. Those sites turn
 * crawlers away (a 403, or no answer), differently on every crawl: the
 * on-page check reported six of the links as broken, then thirteen, while
 * all of them opened in a browser. The rows are text now, and the site
 * links only what answers every visitor the same way: the two counties, the
 * State, the publisher of the county code, and WhatsApp.
 *
 * Adding a host here is a decision, not a fix for a red test: a new
 * outbound link is a new page somebody has to keep opening, and a city's or
 * a town's website is never one of them.
 */
describe('links out: the hosts the site may link', () => {
  const MAY_LINK = [
    'api.whatsapp.com', // "Send the notice by WhatsApp" (ReachRow)
    'library.municode.com', // Miami-Dade's timing row: the county code
    'www.broward.org', // Broward's timing row and forms: the Board of Rules and Appeals
    'www.facebook.com', // the footer: the firm's Facebook page
    'www.instagram.com', // the footer: the firm's Instagram
    'www.leg.state.fl.us', // the milestone page's timing row: the statute
    'www.linkedin.com', // the footer: the firm's LinkedIn page
    'www.miamidade.gov', // Miami-Dade's forms: the county's recertification page
    'www.myfloridalicense.com', // "Verify with the Florida DBPR"
  ];
  const out = (html: string) =>
    links(html)
      .map((a) => a.href.replace(/&amp;/g, '&'))
      .filter((href) => /^https?:/.test(href))
      .map((href) => new URL(href))
      .filter((u) => !getContent('en').company.url.includes(u.hostname));

  it('every outbound link on every page, in both languages, goes to one of nine hosts', () => {
    const hosts = new Set<string>();
    for (const { html } of pages.values()) for (const u of out(html)) hosts.add(u.hostname);
    expect([...hosts].sort()).toEqual(MAY_LINK);
  });

  it('every one of them is https', () => {
    for (const { lang, path, html } of pages.values()) {
      for (const u of out(html)) expect(u.protocol, `${lang} ${path}: ${u.href}`).toBe('https:');
    }
  });

  for (const lang of LANGS) {
    for (const slug of PROGRAMS) {
      const { html } = pages.get(`${lang} /services/${slug}`)!;
      const o = getContent(lang).services.find((s) => s.slug === slug)!.offices!;
      const list = html.match(/<ul class="mp-offices">([\s\S]*?)<\/ul>/)?.[1] ?? '';

      it(`${slug} (${lang}): each office is a row — the city, then its office — and no row leaves the site`, () => {
        const rows = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
        expect(rows).toEqual(o.rows.map((r) => text(esc(`${r.city} ${r.office}`))));
        // A row never links OUT: a city's website is not linked again (see
        // `Service.offices` in site.ts). Where the city has a page of its
        // own on this site, its NAME is the link to it — cities.test.ts
        // checks which rows, and where each leads.
        for (const a of links(list)) {
          expect(a.href, a.href).toMatch(/^\/(es\/)?services\/[a-z-]+\/[a-z-]+$/);
        }
      });

      // What is left to tap under the list: the way to send the letter the
      // note asks for (this site's own form, the program preselected), and
      // ONE page outside the site — the county-level page the forms are
      // published on, named by the authority and what is on it.
      it(`${slug} (${lang}): under the list, the way to send the letter and one outside link, the forms page`, () => {
        const foot = html.match(/<div class="mp-offices__foot">([\s\S]*?)<\/div>/)?.[1] ?? '';
        const found = links(foot);
        const outside = found.filter((a) => /^https?:/.test(a.href));
        expect(outside.map((a) => [a.href, a.text])).toEqual([[esc(o.forms.url), text(esc(o.forms.label))]]);
        const inside = found.filter((a) => !/^https?:/.test(a.href));
        const program = getContent(lang).services.find((s) => s.slug === slug)!.program!;
        expect(inside).toHaveLength(1);
        expect(inside[0].href).toBe(esc(localePath(`/contact?service=${slug}`, lang)));
        expect(inside[0].text).toContain(text(esc(program.cta)));
      });
    }
  }
});

/**
 * HOW MANY HEADINGS, AND IN WHAT ORDER.
 *
 * The same on-page check flagged the two county-program pages, in both
 * languages, for "too many headings": 32 each. Nine of the 32 were labels
 * set in a heading tag — six step names, the "Next step" box, the
 * jurisdiction on its card, a hidden h2 over three links. They are plain
 * elements now (ServiceDetailView says which), and every service page went
 * down with them, since the template is shared.
 *
 * The page that passed the check carried 23, so that is the ceiling here. A
 * new question is a new h3: when this fails, fold a question into another
 * or take a label out of a heading tag — do not raise the number.
 */
describe('service pages: headings are sections, and there are few enough of them', () => {
  const MOST = 23;
  const heads = (html: string) =>
    [...html.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/g)].map((m) => ({
      level: Number(m[1]),
      cls: attr(m[2], 'class') ?? '',
      text: text(m[3]),
    }));

  for (const lang of LANGS) {
    for (const s of getContent(lang).services) {
      const { html } = pages.get(`${lang} /services/${s.slug}`)!;
      const main = html.match(/<main\b[\s\S]*<\/main>/)![0];
      const all = heads(html);

      it(`${s.slug} (${lang}): no more than ${MOST} headings on the whole page`, () => {
        expect(all.length, all.map((x) => `h${x.level} ${x.text}`).join('\n')).toBeLessThanOrEqual(MOST);
      });

      // One h1; an h2 opens every section; an h3 only ever follows an h2 or
      // another h3. No level is skipped and nothing deeper is used.
      it(`${s.slug} (${lang}): one h1, then h2 sections, with h3 only inside one`, () => {
        const levels = heads(main).map((x) => x.level);
        expect(levels.filter((n) => n === 1)).toHaveLength(1);
        expect(levels[0]).toBe(1);
        expect(Math.max(...levels)).toBeLessThanOrEqual(3);
        levels.forEach((n, i) => {
          if (i > 0) expect(n - levels[i - 1], `heading ${i + 1} of ${levels.join(' ')}`).toBeLessThanOrEqual(1);
        });
        for (const x of heads(main)) expect(x.text, `empty h${x.level}`).not.toBe('');
      });

      it(`${s.slug} (${lang}): a label is not a heading — steps, "Next step", the jurisdiction, related services`, () => {
        const u = getContent(lang).ui;
        // Each is still printed, in the element its class draws…
        for (const p of s.process) expect(main).toContain(`<p class="mp-step__title">${esc(p.step)}</p>`);
        expect(main).toContain(`<p class="mp-callout__label">${esc(u.nextStep)}</p>`);
        for (const row of s.timing?.rows ?? []) {
          expect(main).toContain(`<p class="mp-juris__title">${esc(row.jurisdiction)}</p>`);
        }
        expect(main).toContain(`<nav class="mp-more" aria-label="${esc(u.relatedServices)}">`);
        // …and none of them is in the outline.
        const outline = heads(main).map((x) => x.text);
        for (const label of [
          ...s.process.map((p) => p.step),
          u.nextStep,
          u.relatedServices,
          ...(s.timing?.rows ?? []).map((r) => r.jurisdiction),
        ]) {
          expect(outline, label).not.toContain(text(esc(label)));
        }
      });

      // The questions are what people type into a search box: each one
      // stays a heading, under the section's own h2.
      it(`${s.slug} (${lang}): every question is still an h3`, () => {
        const questions = all.filter((x) => x.cls === 'mp-faq__q');
        expect(questions.map((x) => x.text)).toEqual((s.faq ?? []).map((f) => text(inline(keepHyphens(f.q)))));
        for (const q of questions) expect(q.level).toBe(3);
      });
    }
  }
});

/* No thin page. Every service page says at least 500 words of its OWN — the
   main content without the closing band, which is the same on every page,
   tags read as spaces (the way cities.test.ts counts). Five of the eight ran
   370–510 in English (peer review the thinnest) until each got four
   questions of its own (site.ts, `faq`). */
describe('service pages: enough words of their own to be a page', () => {
  const words = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
  for (const lang of LANGS) {
    for (const s of getContent(lang).services) {
      it(`${s.slug} (${lang}): at least 500 words without the closing band`, () => {
        const { html } = pages.get(`${lang} /services/${s.slug}`)!;
        const main = html
          .match(/<main\b[\s\S]*<\/main>/)![0]
          .replace(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/g, '');
        expect(words(text(main))).toBeGreaterThanOrEqual(500);
      });
    }
  }
});

describe('county program pages: no paragraph is printed twice', () => {
  for (const lang of LANGS) {
    for (const slug of PROGRAMS) {
      const { html } = pages.get(`${lang} /services/${slug}`)!;
      const c = getContent(lang);
      const service = c.services.find((s) => s.slug === slug)!;
      const main = html.match(/<main\b[\s\S]*<\/main>/)![0];
      const count = (needle: string) => main.split(esc(needle)).length - 1;
      const filing = service.timing!.rows[0].facts.find((f) => f.filing)!;
      const r = c.reach;

      // The owner, 2026-10-20: no helper lines under buttons. The hero
      // printed what to send under its button; "Next step" says it, in its
      // own words, and nothing is printed under the hero's button.
      it(`${slug} (${lang}): nothing is printed under the hero's button; "Next step" says what to send`, () => {
        expect(main).not.toContain('mp-phero__note');
        expect(count(service.nextStep)).toBe(1);
      });

      // Compact by layout, and nothing taken out of the page: the twelve
      // answers, the offices, the notes and the package fold under one line
      // each — a native <details>, every word of it in the server HTML.
      // A hyphenated name in a question ("Miami-Dade") is kept whole on its
      // line (`keepHyphens`, a no-wrap span); its text is unchanged.
      it(`${slug} (${lang}): every answer is in the HTML, in the question's own <details>`, () => {
        for (const f of service.faq ?? []) {
          expect(main).toContain(
            `<details class="mp-faq__d"><summary class="mp-faq__sum"><h3 class="mp-faq__q">${inline(keepHyphens(f.q))}</h3><span class="mp-faq__icon" aria-hidden="true"></span></summary><p class="mp-faq__a">${esc(f.a)}</p></details>`,
          );
        }
      });

      it(`${slug} (${lang}): the offices, the notes and the package fold under a line that counts them`, () => {
        const folds = [...main.matchAll(/<details class="mp-disclose[^"]*"[^>]*><summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map((m) => ({ label: text(m[1]), body: m[2] }));
        const o = service.offices!;
        const p = service.packet!;
        const want: [string, string, number][] = [
          ['<dl class="mp-packet__list">', p.toggle, p.parts.length],
          ['<ul class="mp-offices">', o.toggle, o.rows.length],
          ['<ul class="mp-notes">', service.notesToggle!, service.considerations.length],
        ];
        expect(folds).toHaveLength(want.length);
        want.forEach(([open, label, n], i) => {
          expect(folds[i].body.startsWith(open), open).toBe(true);
          expect(folds[i].label).toBe(text(esc(label.replace('{n}', String(n)))));
          expect(label).toContain('{n}');
        });
        for (const x of service.considerations) expect(folds[2].body).toContain(`<li>${esc(x)}</li>`);
      });

      // Under the rows it belongs to. It also closed the questions, one
      // section down, whose answers point back up at those rows.
      it(`${slug} (${lang}): the authority is named once, with its rows`, () => {
        // Source keeps a hyphenated part whole (`keepHyphens`, a no-wrap
        // span): counted with those spans taken out, so a plain copy
        // printed anywhere else is counted too.
        const flat = main.replace(/<span class="mp-nobr">([^<]*)<\/span>/g, '$1');
        expect(flat.split(esc(service.timing!.rows[0].source)).length - 1).toBe(1);
        expect(main).toContain(inline(keepHyphens(service.timing!.rows[0].source)));
      });

      /* The second report (October 7, 2026) still counted two duplicate
         paragraphs on each of these four pages, without saying which. Four
         texts were printed more than once; each now has one place. */

      // 1. The filing deadline. The row under "When it applies" holds the
      //    whole value, and the hero printed all of it again. The hero now
      //    prints its first sentence — the deadline — cut from the row in
      //    code, so the number is still typed once (site.ts).
      it(`${slug} (${lang}): the deadline's row is printed whole once; the hero prints its first sentence`, () => {
        const hero = main.match(/<dl class="mp-phero__facts[^"]*">([\s\S]*?)<\/dl>/)![1];
        const [, k, v] = hero.match(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/)!;
        expect(k).toBe(esc(filing.k));
        expect(v).toBe(esc(firstSentence(filing.v)));
        expect(count(filing.v)).toBe(1);
      });

      //    …and that sentence is the deadline: it carries the program's day
      //    count, ends where a sentence ends, and leaves the rest behind.
      it(`${slug} (${lang}): the sentence the hero keeps is the deadline itself`, () => {
        const kept = firstSentence(filing.v);
        const left = filing.v.slice(kept.length);
        expect(kept).toContain(service.program!.accentWord);
        expect(kept.endsWith('.')).toBe(true);
        expect(left).toMatch(/^ [A-ZÁÉÍÓÚÜÑ]/);
      });

      // 2. "The proposal is free…": it was a small grey line beside the
      //    button under the deadline, and the closing band printed it too.
      //    The owner, 2026-10-20: no small print under a button. The two
      //    facts end the closing band's text, once, and nothing is printed
      //    under the deadline's button but Call and WhatsApp.
      // The closing band's button is the page's button: "Send the Miami-Dade
      // Notice", the label of the hero's and the timing table's, not a
      // generic "Request a Proposal" for the same form.
      it(`${slug} (${lang}): the closing band's button names the county's notice`, () => {
        const close = main.match(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/)![0];
        const button = close.match(/<a class="mp-btn[^"]*"[^>]*><span>([\s\S]*?)<\/span>/)!;
        expect(text(button[1])).toBe(text(esc(service.program!.cta)));
        expect(button[0]).toContain(`href="${esc(localePath(`/contact?service=${slug}`, lang))}"`);
        expect(close).not.toContain(`>${esc(c.closingCta.primary.label)}<`);
      });

      it(`${slug} (${lang}): the free-proposal facts are said once, in the closing band's text`, () => {
        expect(main).not.toContain('mp-reach__assure');
        expect(count(r.reply)).toBe(0);
        expect(count(c.closingCta.body)).toBe(1);
        const close = main.match(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/)![0];
        expect(close).toContain(`<p class="mp-close__body">${esc(c.closingCta.body)}</p>`);
      });

      // 3. Call + WhatsApp: one pair beside each of the three buttons, so
      //    the phone is never more than a screen away. They stay — as a
      //    pair of links, which is what they are, not as a <p> (ReachRow).
      it(`${slug} (${lang}): Call and WhatsApp are beside each button, as links and not as a paragraph`, () => {
        const pairs = [...main.matchAll(/<(\w+) class="mp-reach__links">([\s\S]*?)<\/\1>/g)];
        expect(pairs).toHaveLength(3);
        for (const [, tag, inner] of pairs) {
          expect(tag).toBe('div');
          expect(links(inner).map((a) => a.text)).toEqual([
            text(esc(`${r.call} ${c.contact.phone!.display}`)),
            text(esc(r.whatsappNotice)),
          ]);
        }
      });

      // 4. The engineer's credential. Whole under the hero: name, the
      //    credential in letters and the firm's registration — no number
      //    and no link since 2026-10-24 (the owner: as the large firms do).
      //    "Next step" printed the same two lines again; it now prints who
      //    reads the notice — the name — and nothing else.
      it(`${slug} (${lang}): the engineer's credential is whole under the hero and brief in "Next step"`, () => {
        const e = c.leadership;
        const blocks = main.match(/<dl class="mp-cred[^"]*">[\s\S]*?<\/dl>/g) ?? [];
        expect(blocks).toHaveLength(2);
        const whole = blocks[0] ?? '';
        const brief = blocks[1] ?? '';
        for (const block of blocks) {
          expect(block).toContain(esc(e.name));
          expect(text(block)).not.toMatch(/\d{4,}/);
          expect(links(block)).toEqual([]);
        }
        expect(whole).toContain(esc(e.credential));
        expect(whole).toContain(esc(c.company.registry!));
        expect(brief).not.toContain(esc(e.credential));
        expect(brief).not.toContain(esc(c.company.registry!));
        // The brief one is the one in the box, after the hero's.
        expect(main.indexOf(brief)).toBeGreaterThan(main.indexOf('mp-callout--next'));
        expect(main.indexOf(whole)).toBeLessThan(main.indexOf('mp-callout--next'));
      });

      /* ZERO, with nothing set aside: counted over every <p>, <dd> and <li>
         of the page. Anything that turns up here is a paragraph somebody
         pasted, or a block that needs a `brief` form of its own. */
      it(`${slug} (${lang}): no paragraph repeats`, () => {
        const seen = new Map<string, number>();
        for (const p of paragraphs(main)) seen.set(p, (seen.get(p) ?? 0) + 1);
        expect([...seen].filter(([, n]) => n > 1).map(([p]) => p)).toEqual([]);
      });
    }
  }

  // Every closing band says the two facts in its text, at reading size, and
  // no page prints them as a small line under a button.
  it('the closing band says the free proposal and the reply time in its text, on every page', () => {
    const closed: string[] = [];
    for (const { lang, path, html } of pages.values()) {
      const c = getContent(lang);
      expect(html, `${lang} ${path}`).not.toContain('mp-reach__assure');
      const close = html.match(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/)?.[0];
      // /contact, the legal pages, the 404, the calculators catalogue and
      // the calculators have no closing band.
      if (!close) continue;
      closed.push(`${lang} ${path}`);
      const body = close.match(/<p class="mp-close__body">([\s\S]*?)<\/p>/)?.[1] ?? '';
      expect(body, `${lang} ${path}`).toBe(esc(c.closingCta.body));
    }
    for (const [lang, free, reply] of [
      ['en', 'free written proposal', 'usually within two hours'],
      ['es', 'propuesta gratis', 'normalmente en menos de dos horas'],
    ] as const) {
      expect(getContent(lang).closingCta.body).toContain(free);
      expect(getContent(lang).closingCta.body).toContain(reply);
    }
    // Home, Services, Existing Buildings, About, Typical Engagements and the
    // eight services, in each language — and every city page.
    expect(closed).toHaveLength(26 + LANGS.reduce((n, lang) => n + getCityPages(lang).length, 0));
  });
});

/* Where the reader holds no notice there is no "Send the notice". One rule
   by address, pageHoldsNotice (notice-pages.ts), for the phone bar and the
   closing band (the views' own rules agree with it: notice-pages.test.ts):
   off the notice pages the bar offers the free proposal (with the service
   chosen on a service page) and its WhatsApp chat opens with a proposal
   request; the band says "Message us on WhatsApp". */
describe('no "Send the notice" where there is no notice', () => {
  const barOf = (html: string) => html.match(/<nav class="mp-bar[\s\S]*?<\/nav>/)?.[0];

  // The bar's own label, never the header's: "Request a Proposal" took two
  // lines in a third of a 360–390px screen, and repeated the header's
  // button (which mp.css now hides while the bar is up).
  for (const { lang, path, html } of pages.values()) {
    const bar = barOf(html);
    // /contact, /resources and the calculators have no bar.
    if (!bar) continue;
    const c = getContent(lang);
    const r = c.reach;
    const notice = pageHoldsNotice(path);
    it(`${lang} ${path}: the phone bar ${notice ? 'sends the notice' : 'offers the free proposal'}`, () => {
      expect(bar).toContain(`>${esc(notice ? r.form : r.formPlain)}</a>`);
      expect(bar).not.toContain(`>${esc(notice ? r.formPlain : r.form)}</a>`);
      expect(bar).not.toContain(`>${esc(c.primaryCta.label)}</a>`);
      expect(bar).toContain(esc(whatsappHref(c, !notice)!));
    });
  }

  for (const lang of LANGS) {
    const c = getContent(lang);
    const r = c.reach;
    for (const s of c.services) {
      const html = pages.get(`${lang} /services/${s.slug}`)!.html;
      const bar = barOf(html) ?? '';
      if (!pageHoldsNotice(`/services/${s.slug}`)) {
        // The new-building services, and the assessments page: cracks, a
        // report, a purchase — no letter.
        it(`${lang} /services/${s.slug}: a proposal, never the notice`, () => {
          expect(html).toContain(esc(r.whatsappPlain));
          expect(html).not.toContain(esc(r.whatsappNotice));
          expect(html).not.toContain(encodeURIComponent(r.whatsappText).replace(/'/g, '%27'));
          expect(bar).toContain(`>${esc(r.formPlain)}</a>`);
          expect(bar).toContain(`service=${s.slug}`);
        });
      } else {
        it(`${lang} /services/${s.slug}: the notice`, () => {
          expect(html).toContain(esc(r.whatsappNotice));
          expect(bar).toContain(`>${esc(r.form)}</a>`);
        });
      }
    }

    // The guide for the reader with no letter yet ("No letter yet?", one
    // button that sends the address): nothing on it asks for a notice.
    it(`${lang} /guides/is-my-building-due: the hero, the closing band and the bar never ask for the notice`, () => {
      const path = '/guides/is-my-building-due';
      route.pathname = localePath(path, lang);
      const html = renderToStaticMarkup(h(SiteChrome, null, h(GuideView, { lang, slug: 'is-my-building-due' })));
      const close = html.match(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/)![0];
      expect(close).toContain(esc(r.whatsappPlain));
      expect(html).not.toContain(esc(r.whatsappNotice));
      expect(html).not.toContain(encodeURIComponent(r.whatsappText).replace(/'/g, '%27'));
      expect(barOf(html)).toContain(`>${esc(r.formPlain)}</a>`);
    });
  }
});

// The privacy policy changed on October 20, 2026 ("What we collect": the
// form no longer asks for a company) and carries that date; the terms did
// not change, and keep the shared date.
describe('legal pages: each is dated by its own last change', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    it(`${lang}: the privacy policy prints its own date, the terms the shared one`, () => {
      const privacy = pages.get(`${lang} /privacy`)!.html;
      const terms = pages.get(`${lang} /terms`)!.html;
      expect(privacy).toContain(esc(c.legal.privacy.updated));
      expect(privacy).not.toContain(esc(c.legal.updated));
      expect(terms).toContain(esc(c.legal.updated));
      expect(c.legal.privacy.updated).toMatch(lang === 'en' ? /October 20, 2026/ : /20 de octubre de 2026/);
    });
  }
});
