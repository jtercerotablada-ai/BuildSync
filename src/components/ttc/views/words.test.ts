import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { ContactView } from './ContactView';
import { HomeView } from './HomeView';
import { LegalView } from './LegalView';

/**
 * The three pages the owner's on-page check listed as "pages with little
 * text" (October 7, 2026): /contact, /privacy and /terms, in both languages.
 *
 * They were lengthened with text a visitor can use — what to send and what
 * comes back; what the form really does with a request. Three things about
 * that text are rules nobody sees break:
 *
 *   • /contact must not go back to borrowing a section from the home page
 *     (it carried "Engineered for this coast" word for word), and the two
 *     legal pages must not close with the same paragraph again;
 *   • the new sentences carry no number of their own — a county's ages and
 *     deadlines are printed from its timing row and nowhere else (site.ts);
 *   • the legal pages state what the code does, never a legal position that
 *     is the owner's to take (a governing law, a retention period, a claim
 *     of compliance with a statute…).
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const KINDS = ['privacy', 'terms'] as const;

const render = (lang: Lang, path: string, view: Parameters<typeof renderToStaticMarkup>[0]) => {
  route.pathname = localePath(path, lang);
  return renderToStaticMarkup(view);
};
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
/** Every block of running text a page prints, heading or paragraph. */
const blocks = (html: string) =>
  [...html.matchAll(/<(p|li|dd|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(m[2])).filter(Boolean);
const wordCount = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
const paragraphsOf = (p: string | readonly string[]) => (typeof p === 'string' ? [p] : [...p]);

describe('/contact: the section under the form is its own', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const contact = render(lang, '/contact', h(ContactView, { lang }));
    const home = render(lang, '/', h(HomeView, { lang }));

    // The ruler of the on-page check: a block of six or more words that two
    // pages share. /contact used to print the home page's service-area band
    // ("Engineered for this coast") word for word. The H1 is left out — it
    // is the headline the closing band prints on every other page, and
    // changing an H1 is the owner's call.
    it(`${lang}: no block of six or more words is also on the home page`, () => {
      const onHome = new Set(blocks(home));
      const h1 = blocks(contact.match(/<h1\b[\s\S]*?<\/h1>/)?.[0] ?? '')[0];
      const shared = blocks(contact).filter((b) => b !== h1 && wordCount(b) >= 6 && onHome.has(b));
      expect(shared).toEqual([]);
    });

    it(`${lang}: says what to send, what comes back and how else to reach the firm`, () => {
      const b = c.contactPage.before;
      expect(b.items.length).toBe(getContent('en').contactPage.before.items.length);
      for (const it of b.items) {
        expect(text(contact)).toContain(it.k);
        expect(text(contact)).toContain(it.v);
      }
      // After the form: nothing may push the first field down a phone.
      expect(contact.indexOf('mp-before-title')).toBeGreaterThan(contact.lastIndexOf('</form>'));
    });

    // No age, no day count, no phone number, no price: the page prints the
    // number from `contact.phone`, and a county's figures from its own row.
    it(`${lang}: the section types no number`, () => {
      const b = c.contactPage.before;
      for (const s of [b.eyebrow, b.title, ...b.items.flatMap((it) => [it.k, it.v])]) {
        expect(s).not.toMatch(/\d/);
      }
    });
  }
});

describe('legal pages: each its own text, and only what the code does', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const html = Object.fromEntries(
      KINDS.map((kind) => [kind, render(lang, `/${kind}`, h(LegalView, { lang, kind }))]),
    );

    it(`${lang}: the two documents share no paragraph`, () => {
      const inTerms = new Set(blocks(html.terms));
      const shared = blocks(html.privacy).filter((b) => wordCount(b) >= 6 && inTerms.has(b));
      expect(shared).toEqual([]);
    });

    for (const kind of KINDS) {
      const doc = c.legal[kind];

      it(`${lang} /${kind}: no paragraph is printed twice`, () => {
        const ps = blocks(html[kind]);
        expect(ps.length).toBe(new Set(ps).size);
      });

      // The on-page check lists a page for too many headings as readily as
      // for too little text: a legal page stays under fourteen.
      it(`${lang} /${kind}: the headings stay reasonable`, () => {
        const heads = html[kind].match(/<h[1-6]\b/g) ?? [];
        expect(heads.length).toBe(doc.sections.length + 2);
        expect(heads.length).toBeLessThanOrEqual(14);
      });

      it(`${lang} /${kind}: closes with its own line and the firm's address`, () => {
        expect(doc.contact.trim()).not.toBe('');
        const last = blocks(html[kind]).at(-1) ?? '';
        expect(last.startsWith(doc.contact)).toBe(true);
        expect(last).toContain(c.contact.email);
        expect(last).toContain(c.company.legalName);
        expect(html[kind]).toContain(`href="mailto:${c.contact.email}"`);
      });

      /* Positions only the owner can take. None of them is on these pages
         today; a sentence that adds one has to come from him, not from a
         template. Day counts included: a retention period or a deadline to
         answer is a promise. */
      it(`${lang} /${kind}: takes no legal position the owner has not taken`, () => {
        const all = [doc.h1, doc.sub, doc.contact, ...doc.sections.flatMap((s) => [s.h, ...paragraphsOf(s.p)])].join(' ');
        expect(all).not.toMatch(/GDPR|RGPD|CCPA|HIPAA|COPPA/);
        expect(all).not.toMatch(/arbitra|governing law|venue|jurisdicción competente|ley aplicable|tribunal/i);
        expect(all).not.toMatch(/liability|responsabilidad máxima|indemn/i);
        expect(all).not.toMatch(/\d+\s*(?:business |working )?(?:days?|hours?|months?|years?|d[ií]as?|horas?|meses|años?)/i);
        expect(all).not.toMatch(/prevails|prevalece/i);
      });
    }

    it(`${lang}: the Spanish and English documents have the same sections`, () => {
      for (const kind of KINDS) {
        const en = getContent('en').legal[kind].sections;
        expect(c.legal[kind].sections.length).toBe(en.length);
        c.legal[kind].sections.forEach((s, i) => {
          expect(paragraphsOf(s.p).length, s.h).toBe(paragraphsOf(en[i].p).length);
        });
      }
    });
  }

  // The legal H1s are pinned: they were chosen to pass the check's own floor
  // for an H1 (seo.test.ts) and nothing in this package may move them.
  it('keeps the four H1s as they were', () => {
    expect(getContent('en').legal.privacy.h1).toBe('Privacy Policy for This Website');
    expect(getContent('en').legal.terms.h1).toBe('Terms of Use for This Website');
    expect(getContent('es').legal.privacy.h1).toBe('Política de privacidad de este sitio web');
    expect(getContent('es').legal.terms.h1).toBe('Términos de uso de este sitio web');
  });
});
