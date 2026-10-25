import { describe, expect, it } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { whatsappHomeHref, whatsappHref } from './ReachRow';

/**
 * The WhatsApp link. It is on every page (the reach rows, the bar on phones,
 * the contact page), so a wrong address is wrong on all of them at once.
 *
 * It used to be `https://wa.me/<number>?text=…`, which works — by answering
 * with a redirect to api.whatsapp.com. The link now goes there directly, and
 * the number and the first line of the message ride in the query.
 */
const LANGS: Lang[] = ['en', 'es'];

describe('whatsappHref', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const href = whatsappHref(c);

    it(`${lang}: opens WhatsApp's own address, not the short one that redirects`, () => {
      expect(href).not.toBeNull();
      const url = new URL(href!);
      expect(`${url.origin}${url.pathname}`).toBe('https://api.whatsapp.com/send');
      expect(href).not.toContain('wa.me');
    });

    it(`${lang}: carries the firm's number and nothing else as the phone`, () => {
      // The same line as the Call link: `tel:+1772…` without the `tel:+`.
      const digits = c.contact.phone!.href.replace(/\D/g, '');
      expect(new URL(href!).searchParams.get('phone')).toBe(digits);
    });

    it(`${lang}: prefills the first line of the message, in the page's language`, () => {
      const url = new URL(href!);
      expect(url.searchParams.get('text')).toBe(c.reach.whatsappText);
      // Two parameters, joined once: a second "?" would put the message
      // inside the phone number.
      expect(href!.split('?')).toHaveLength(2);
      expect([...url.searchParams.keys()]).toEqual(['phone', 'text']);
    });
  }

  it('is the same number in both languages', () => {
    const phone = (lang: Lang) => new URL(whatsappHref(getContent(lang))!).searchParams.get('phone');
    expect(phone('es')).toBe(phone('en'));
  });
});

/* Where the reader holds no notice — the new-building pages, /about,
   /projects, /services — the chat opens with a proposal request and the
   link says "Message us", never "Send the notice". */
describe('whatsappHref, plain', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    it(`${lang}: prefills the proposal request, not the notice`, () => {
      const url = new URL(whatsappHref(c, true)!);
      expect(url.searchParams.get('text')).toBe(c.reach.whatsappTextPlain);
      expect(c.reach.whatsappTextPlain).not.toBe(c.reach.whatsappText);
      expect([...url.searchParams.keys()]).toEqual(['phone', 'text']);
    });
  }
});

/* The home page is a presentation of the firm, not an answer to a notice or
   a request for a proposal: its chat opens with a line that says neither
   (the phone bar and the phone menu of the home). */
describe('whatsappHomeHref', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    it(`${lang}: prefills the home's own first line, on the firm's number`, () => {
      const url = new URL(whatsappHomeHref(c)!);
      expect(url.searchParams.get('text')).toBe(c.reach.whatsappTextHome);
      expect(c.reach.whatsappTextHome).not.toBe(c.reach.whatsappText);
      expect(c.reach.whatsappTextHome).not.toBe(c.reach.whatsappTextPlain);
      expect([...url.searchParams.keys()]).toEqual(['phone', 'text']);
      expect(url.searchParams.get('phone')).toBe(new URL(whatsappHref(c)!).searchParams.get('phone'));
    });
  }
});
