import { describe, expect, it } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { whatsappHref } from './ReachRow';

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
