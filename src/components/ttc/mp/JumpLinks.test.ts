import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { ServiceDetailView } from '@/components/ttc/views/ServiceDetailView';
import { JUMP_ID, jumpLinks } from './JumpLinks';

/**
 * The jump links under a county program's hero point at sections of the page
 * they are on. A link whose target is missing is a dead tap — and nothing
 * else would notice: the id sits in ServiceDetailView, the href is built
 * here, and a section is only rendered where the service has the content.
 * So these tests render the real page, in both languages, and follow every
 * link.
 */

// The client pieces of the page (hero, closing band) read the language from
// the URL; outside Next there is none, so the test supplies the page's own.
const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const PROGRAMS = ['building-recertification', 'broward-bsip'];

function page(lang: Lang, slug: string) {
  route.pathname = localePath(`/services/${slug}`, lang);
  return renderToStaticMarkup(h(ServiceDetailView, { lang, slug }));
}

/** The strip's own markup, or '' where the page has none. */
const strip = (html: string) => html.match(/<nav class="mp-jump[^>]*>.*?<\/nav>/)?.[0] ?? '';
const hrefs = (html: string) => [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('jump links on the county program pages', () => {
  for (const lang of LANGS) {
    for (const slug of PROGRAMS) {
      const html = page(lang, slug);
      const c = getContent(lang);

      it(`${slug} (${lang}): every link lands on one section of the page`, () => {
        const targets = hrefs(strip(html));
        expect(targets).toEqual([
          JUMP_ID.applies,
          JUMP_ID.receive,
          JUMP_ID.steps,
          JUMP_ID.questions,
        ]);
        for (const id of targets) expect(count(html, ` id="${id}"`)).toBe(1);
      });

      it(`${slug} (${lang}): a link says what its section's label says`, () => {
        const u = c.ui;
        for (const label of [u.whenItApplies, u.whatYouReceive, u.howItRuns, u.faqLabel]) {
          const text = renderToStaticMarkup(h('i', null, label)).slice(3, -4);
          expect(strip(html)).toContain(`>${text}</a>`);
          // …and the page prints that label again, over the section.
          expect(count(html, text)).toBeGreaterThan(1);
        }
        expect(strip(html)).toContain(`aria-label="${u.onThisPage}"`);
      });

      it(`${slug} (${lang}): one h1, and the strip adds no heading`, () => {
        expect(count(html, '<h1')).toBe(1);
        expect(strip(html)).not.toMatch(/<h\d/);
      });

      // The whole point of the reveal rewrite, on the real page: what the
      // server sends must not hide a single block (reveal.ts).
      it(`${slug} (${lang}): the server HTML hides no block`, () => {
        expect(count(html, 'class="mp-reveal')).toBeGreaterThan(20);
        // `opacity:0`, not `opacity:0.7`: a dimmed element is not a hidden one.
        expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
        expect(html).not.toContain('data-rv');
      });
    }
  }

  it('is not on the other service pages', () => {
    for (const lang of LANGS) {
      const others = getContent(lang).services.filter((s) => !s.program);
      expect(others.length).toBeGreaterThan(0);
      for (const s of others) expect(strip(page(lang, s.slug))).toBe('');
    }
  });

  it('lists only sections the service has', () => {
    for (const lang of LANGS) {
      const c = getContent(lang);
      for (const s of c.services) {
        const ids = jumpLinks(c, s).map((l) => l.id);
        expect(ids.includes(JUMP_ID.applies)).toBe(Boolean(s.timing));
        expect(ids.includes(JUMP_ID.questions)).toBe(Boolean(s.faq?.length));
        expect(ids).toContain(JUMP_ID.receive);
        expect(ids).toContain(JUMP_ID.steps);
        // …and every one of them is an id the page really carries.
        const html = page(lang, s.slug);
        for (const id of ids) expect(count(html, ` id="${id}"`)).toBe(1);
      }
    }
  });
});
