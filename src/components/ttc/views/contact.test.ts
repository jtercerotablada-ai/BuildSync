import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { ContactView } from './ContactView';

/**
 * /contact as the server sends it, for the three ways a visitor arrives:
 * a bare /contact (the header button), a county program's button
 * (?service=building-recertification / broward-bsip) and a new-building
 * service's button (?service=peer-review…).
 *
 *   • A county program's form puts the upload first and, on a phone, hides
 *     the hero's direct lines (mp.css). Call and WhatsApp must then still be
 *     on the page, under the form, opening the chat with the notice line —
 *     the guide tells that visitor to send the letter by WhatsApp.
 *   • A new-building visitor holds no notice: the hero's sub, like the
 *     WhatsApp text, asks for the project, never the letter.
 *   • Nothing under the Send button (the owner, October 20, 2026).
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const PROGRAMS = ['building-recertification', 'broward-bsip'];

const render = (lang: Lang, presetService?: string) => {
  route.pathname = localePath('/contact', lang);
  return renderToStaticMarkup(h(ContactView, { lang, presetService }));
};
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const sub = (html: string) => text(html.match(/<p class="mp-phero__sub[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? '');
const hero = (html: string) => html.slice(0, html.indexOf('mp-contact-title'));
const after = (html: string) =>
  html.match(/<div class="mp-reach mp-contact__reach-after">([\s\S]*?)<\/div><\/div>/)?.[1] ?? null;
const hrefs = (html: string) => [...html.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);

describe('/contact: the direct lines and the sub follow the visitor', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const p = c.contactPage;
    const r = c.reach;
    const waNotice = `&amp;text=${encodeURIComponent(r.whatsappText).replace(/'/g, '%27')}`;

    for (const slug of PROGRAMS) {
      it(`${lang} ?service=${slug}: Call and "Send the notice by WhatsApp" are also under the form`, () => {
        const html = render(lang, slug);
        const block = after(html);
        expect(block).not.toBeNull();
        const links = hrefs(block!);
        expect(links).toEqual([esc(c.contact.phone!.href), expect.stringContaining('api.whatsapp.com')]);
        expect(links[1]).toContain(waNotice);
        expect(text(block!)).toBe(`${r.call} ${c.contact.phone!.display} ${r.whatsappNotice}`);
        // Under the form, before the guide that says "send it by WhatsApp".
        const at = html.indexOf('mp-contact__reach-after');
        expect(at).toBeGreaterThan(html.lastIndexOf('</form>'));
        expect(at).toBeLessThan(html.indexOf('mp-before-title'));
        // The hero keeps its own pair (shown from 641px; mp.css decides).
        expect(hrefs(hero(html))).toContain(esc(c.contact.phone!.href));
        expect(sub(html)).toBe(p.sub);
      });
    }

    for (const s of c.services.filter((x) => x.track === 'new')) {
      it(`${lang} ?service=${s.slug}: the sub asks for the project, never a notice`, () => {
        const html = render(lang, s.slug);
        expect(sub(html)).toBe(p.subNew);
        expect(sub(html)).not.toMatch(lang === 'en' ? /notice|letter|late/i : /notificación|carta|tarde/i);
        // Never opened notice-first, so no second pair is printed.
        expect(after(html)).toBeNull();
        expect(html).not.toContain(esc(r.whatsappNotice));
      });
    }

    // The assessments page is an existing building with no county letter
    // (site.ts `holdsNotice`): the chat it leads to does not open with "I
    // received a building inspection notice", and no notice pair is printed.
    it(`${lang} ?service=structural-condition-assessments: the chat asks for a proposal, not about a notice`, () => {
      const html = render(lang, 'structural-condition-assessments');
      const plain = `&amp;text=${encodeURIComponent(r.whatsappTextPlain).replace(/'/g, '%27')}`;
      const wa = hrefs(html).filter((x) => x.includes('api.whatsapp.com'));
      expect(wa.length).toBeGreaterThan(0);
      for (const x of wa) {
        expect(x).toContain(plain);
        expect(x).not.toContain(waNotice);
      }
      expect(after(html)).toBeNull();
      expect(html).not.toContain(esc(r.whatsappNotice));
    });

    it(`${lang} ?service=milestone-inspections: the chat opens with the notice line`, () => {
      const html = render(lang, 'milestone-inspections');
      const wa = hrefs(html).filter((x) => x.includes('api.whatsapp.com'));
      expect(wa.length).toBeGreaterThan(0);
      for (const x of wa) expect(x).toContain(waNotice);
    });

    it(`${lang} bare /contact: the notice sub, the hero's lines, nothing under Send`, () => {
      const html = render(lang);
      expect(sub(html)).toBe(p.sub);
      expect(hrefs(hero(html))).toContain(esc(c.contact.phone!.href));
      const form = html.match(/<form\b[\s\S]*?<\/form>/)![0];
      // The form ends with the button row: no note, no fine print after it.
      expect(form).not.toContain('mp-form__note');
      expect(form.slice(form.lastIndexOf('</button>'))).toMatch(/^<\/button><\/div><\/form>$/);
    });

    it(`${lang}: the guide's rows do not restate the hero's direct lines`, () => {
      for (const row of p.before.items) expect(row.k).not.toMatch(/WhatsApp/);
    });
  }

  it('es: "Building Official" is glossed at its first use on the page, and only there', () => {
    const t = text(render('es'));
    const first = t.indexOf('Building Official');
    expect(first).toBeGreaterThan(-1);
    expect(t.slice(first)).toMatch(/^Building Official \(el funcionario de construcción\)/);
    expect(t.split('(el funcionario de construcción)')).toHaveLength(2);
  });
});
