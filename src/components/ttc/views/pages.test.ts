import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { photo, video } from '@/lib/ttc/media';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { AboutView } from './AboutView';
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
    ...getContent(lang).services.map(
      (s): [string, ReactElement] => [
        `/services/${s.slug}`,
        h(ServiceDetailView, { lang, slug: s.slug }),
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
const paragraphs = (html: string) =>
  [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1])).filter(Boolean);

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

describe('county program pages: nothing is printed twice without a reason', () => {
  for (const lang of LANGS) {
    for (const slug of PROGRAMS) {
      const { html } = pages.get(`${lang} /services/${slug}`)!;
      const c = getContent(lang);
      const service = c.services.find((s) => s.slug === slug)!;
      const main = html.match(/<main\b[\s\S]*<\/main>/)![0];
      const count = (needle: string) => main.split(esc(needle)).length - 1;

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

      /* What IS repeated, and why it stays:
           • Call + WhatsApp: links, not prose — one pair beside each of the
             three buttons, so the phone is never more than a screen away.
           • "The proposal is free…": beside the button under the deadline,
             and again in the closing band several screens down, which is
             the same band on every page of the site.
         Anything else that turns up twice is a paragraph somebody pasted. */
      it(`${slug} (${lang}): no other paragraph repeats`, () => {
        const seen = new Map<string, number>();
        for (const p of paragraphs(main)) seen.set(p, (seen.get(p) ?? 0) + 1);
        const repeated = [...seen].filter(([, n]) => n > 1).map(([p]) => p);
        const r = c.reach;
        expect(repeated.sort()).toEqual(
          [
            text(esc(`${r.call} ${c.contact.phone!.display} ${r.whatsappNotice}`)),
            text(esc(`${r.free} ${r.reply}`)),
          ].sort(),
        );
      });
    }
  }
});
