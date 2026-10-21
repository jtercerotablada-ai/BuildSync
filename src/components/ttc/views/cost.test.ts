import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { COST_PATH, costPage } from '@/lib/ttc/cost-page';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { CostView } from './CostView';

/**
 * THE COST PAGE (/services/recertification-cost and its Spanish twin), as a
 * visitor gets it.
 *
 * It was compacted on October 20, 2026: the two county cards became the
 * home page's one table, "Outside the fee" moved beside "In the fixed fee",
 * the five ways to pay less moved into the factors they lower, and the
 * questions became disclosures. Nothing of that shows in a build if it
 * slips back — a tip printed twice, an answer mounted late, a class the
 * home page's cleanup deleted — so it is read here:
 *   • every price of `pricing.programs` is in the table, once per tier, and
 *     the structured data's low and high are those prices;
 *   • each way to pay less is printed once;
 *   • every answer is in the HTML, inside its disclosure, and in FAQPage;
 *   • few headings, and enough words to be a page of its own;
 *   • no class the page uses is missing from mp.css;
 *   • the hero's two figures are each county's starting price;
 *   • the signing sentence is printed once, word for word;
 *   • the row on late penalties still speaks to an owner who is late.
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const CSS = readFileSync(resolve(__dirname, '../../../app/(public)/mp.css'), 'utf8');

/** A string as React prints it in text. */
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const words = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const dollars = (s: string) => [...s.matchAll(/\$([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
const ld = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const data = JSON.parse(m[1]);
    return data['@graph'] ?? [data];
  });

const render = (lang: Lang) => {
  route.pathname = localePath(COST_PATH, lang);
  return renderToStaticMarkup(h(SiteChrome, null, h(CostView, { lang })));
};

describe('the cost page', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const k = costPage(lang);
    const html = render(lang);
    const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
    const body = main.replace(/<script\b[\s\S]*?<\/script>/g, '');

    it(`${lang}: every price is in the one table, once per tier, and the offers' low and high are those prices`, () => {
      const table = body.match(/<table class="mp-cost__table"[\s\S]*?<\/table>/)?.[0] ?? '';
      expect(table).not.toBe('');
      const prices = c.pricing.programs.flatMap((p) => p.tiers.map((t) => t.price));
      for (const price of new Set(prices)) {
        expect(count(table, `>${esc(price)}<`), price).toBe(prices.filter((x) => x === price).length);
      }
      const offers = ld(html).filter((n) => n['@type'] === 'AggregateOffer');
      expect(offers).toHaveLength(c.pricing.programs.length);
      c.pricing.programs.forEach((p, i) => {
        const all = p.tiers.flatMap((t) => dollars(t.price));
        expect(offers[i].lowPrice).toBe(Math.min(...all));
        expect(offers[i].highPrice).toBe(Math.max(...all));
      });
    });

    it(`${lang}: each way to pay less is printed once`, () => {
      const tips = [k.save.first, ...k.factors.items.flatMap((f) => (f.save ? [f.save] : []))];
      expect(tips.length).toBeGreaterThanOrEqual(5);
      for (const t of tips) expect(count(body, esc(t)), t).toBe(1);
    });

    it(`${lang}: every answer is in the HTML, inside its disclosure, and in the FAQPage data`, () => {
      const disclosures = [...body.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)].map((m) => m[1]);
      expect(disclosures).toHaveLength(k.faq.items.length);
      k.faq.items.forEach((item, i) => {
        expect(disclosures[i]).toContain(esc(item.q));
        expect(disclosures[i]).toContain(esc(item.a));
      });
      const faq = ld(html).find((n) => n['@type'] === 'FAQPage');
      expect(faq?.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [q.name, q.acceptedAnswer.text])).toEqual(
        k.faq.items.map((item) => [item.q, item.a]),
      );
    });

    it(`${lang}: at most 23 headings on the page, and enough words to be a page of its own`, () => {
      expect((html.match(/<h[1-6]\b/g) ?? []).length).toBeLessThanOrEqual(23);
      const own = text(body.replace(/<section class="[^"]*mp-close[^"]*"[\s\S]*?<\/section>/g, ''));
      expect(words(own)).toBeGreaterThanOrEqual(500);
    });

    it(`${lang}: every class it borrows from the home page or keeps for itself has a rule in mp.css`, () => {
      // The home page's sections share mp.css with this page; a cleanup
      // there must not leave this page with a class that styles nothing.
      // `.mp-hsec__aside` is a grid cell with no style of its own.
      const used = new Set(
        [...body.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((x) => /^mp-(cost|costp|hsec)(__|$)/.test(x)),
      );
      used.delete('mp-hsec__aside');
      expect(used.size).toBeGreaterThan(10);
      const missing = [...used].filter((cls) => !new RegExp(`\\.${cls}(?![\\w-])`).test(CSS));
      expect(missing).toEqual([]);
    });

    it(`${lang}: the hero's two figures are each county's starting price`, () => {
      const hero = body.match(/<section class="mp-phero"[\s\S]*?<\/section>/)?.[0] ?? '';
      const dd = [...hero.matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map((m) => text(m[1]));
      expect(dd).toEqual(c.pricing.programs.map((p) => p.tiers[0].price));
      for (const v of dd) expect(v).toMatch(/^(From|Desde) \$/);
    });

    it(`${lang}: the signing sentence is printed once, word for word`, () => {
      expect(count(body, `>${esc(c.pricing.includes[1])}<`)).toBe(1);
    });

    it(`${lang}: the row on late penalties still speaks to an owner who is already late`, () => {
      const late = k.outside.items[k.outside.items.length - 1];
      expect(late.v).toMatch(lang === 'es' ? /¿Ya va tarde\? Todavía tiene solución\./ : /Already late\? It can still be resolved\./);
      expect(body).toContain(esc(late.v));
    });

    it(`${lang}: links each county's page and the cost of waiting`, () => {
      const hrefs = [...body.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
      for (const p of c.pricing.programs) expect(hrefs).toContain(localePath(`/services/${p.slug}`, lang));
      expect(hrefs).toContain(`${localePath('/', lang)}#miami-dade`);
    });
  }
});
