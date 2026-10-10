import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { photo, video } from '@/lib/ttc/media';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { firstSentence } from '@/components/ttc/mp/text';
import { cityPath } from '@/lib/ttc/cities';
import { getCityPages } from '@/lib/ttc/city-content';
import { AboutView } from './AboutView';
import { CalculatorsView } from './CalculatorsView';
import { CityView } from './CityView';
import { ContactView } from './ContactView';
import { ExistingView } from './ExistingView';
import { HomeView } from './HomeView';
import { LegalView } from './LegalView';
import { NotFoundView } from './NotFoundView';
import { ServiceDetailView } from './ServiceDetailView';
import { ServicesView } from './ServicesView';
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
    // The calculators catalogue: a page, though not one to be found yet
    // (noindex, out of the sitemap — calculators.test.ts has its own rules).
    ['/resources', h(CalculatorsView, { lang })],
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
      expect(spoken).toEqual([getContent(lang).company.logo.lockupLightSm]);
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
    'www.leg.state.fl.us', // the milestone page's timing row: the statute
    'www.miamidade.gov', // Miami-Dade's forms: the county's recertification page
    'www.myfloridalicense.com', // "Verify with the Florida DBPR"
  ];
  const out = (html: string) =>
    links(html)
      .map((a) => a.href.replace(/&amp;/g, '&'))
      .filter((href) => /^https?:/.test(href))
      .map((href) => new URL(href))
      .filter((u) => !getContent('en').company.url.includes(u.hostname));

  it('every outbound link on every page, in both languages, goes to one of six hosts', () => {
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
        expect(questions.map((x) => x.text)).toEqual((s.faq ?? []).map((f) => text(esc(f.q))));
        for (const q of questions) expect(q.level).toBe(3);
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

      // The hero prints it under the button. The row under "When it applies"
      // used to print it again, a section below "Next step" saying the same.
      it(`${slug} (${lang}): the line about what to send is under one button`, () => {
        expect(count(service.program!.ctaNote)).toBe(1);
      });

      // Under the rows it belongs to. It also closed the questions, one
      // section down, whose answers point back up at those rows.
      it(`${slug} (${lang}): the authority is named once, with its rows`, () => {
        expect(count(service.timing!.rows[0].source)).toBe(1);
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

      // 2. "The proposal is free…": beside the button under the deadline.
      //    The closing band says it on every other page of the site, and
      //    said it here a second time.
      it(`${slug} (${lang}): the free-proposal line is said once, under the deadline`, () => {
        expect(count(`${r.free} ${r.reply}`)).toBe(1);
        const close = main.match(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/)![0];
        expect(close).not.toContain(esc(r.free));
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

      // 4. The engineer's credential. Whole under the hero: name, license
      //    number, the link that verifies it, the firm's registration.
      //    "Next step" printed the same two lines again; it now prints who
      //    reads the notice — the name and the number — and nothing else.
      it(`${slug} (${lang}): the engineer's credential is whole under the hero and brief in "Next step"`, () => {
        const e = c.leadership;
        const number = esc(`${c.ui.engineer.licensePrefix} ${e.license!.number}`);
        const blocks = main.match(/<dl class="mp-cred[^"]*">[\s\S]*?<\/dl>/g) ?? [];
        expect(blocks).toHaveLength(2);
        const whole = blocks[0] ?? '';
        const brief = blocks[1] ?? '';
        for (const block of blocks) {
          expect(block).toContain(esc(e.name));
          expect(block).toContain(number);
        }
        expect(links(whole).map((a) => a.href)).toEqual([esc(e.license!.url)]);
        expect(whole).toContain(esc(c.company.registry!));
        expect(links(brief)).toEqual([]);
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

  // The band that closes every OTHER page still says it: there it is the
  // only place the page does.
  it('the closing band keeps the free-proposal line where the page has not said it', () => {
    const closed: string[] = [];
    for (const { lang, path, html } of pages.values()) {
      if (PROGRAMS.some((slug) => path === `/services/${slug}`)) continue;
      const close = html.match(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/)?.[0];
      // /contact, the legal pages, the 404 and the calculators catalogue
      // have no closing band.
      if (!close) continue;
      closed.push(`${lang} ${path}`);
      const r = getContent(lang).reach;
      expect(close, `${lang} ${path}`).toContain(esc(`${r.free} ${r.reply}`));
    }
    // Home, Services, Existing Buildings, About, Typical Engagements and the
    // six other services, in each language — and every city page, which
    // leaves the line to its closing band.
    expect(closed).toHaveLength(22 + LANGS.reduce((n, lang) => n + getCityPages(lang).length, 0));
  });
});
