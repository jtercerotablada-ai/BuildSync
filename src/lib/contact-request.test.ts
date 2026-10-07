import { describe, expect, it } from 'vitest';
import {
  SOURCE_MAX,
  descriptionRequired,
  isProgramOption,
  oneLine,
  requestSource,
} from './contact-request';
import type { SiteContent } from './ttc/content';
import { en } from './ttc/site';
import { es } from './ttc/site.es';

/**
 * The buttons that open the form for a county program say "a phone photo of
 * the letter is enough". These are the rules that make it true, and the form
 * and the contact route both read them from here — so what is pinned below is
 * the promise itself, in both languages, and not for any other service.
 */
const PROGRAMS = ['building-recertification', 'broward-bsip'];

const option = (c: SiteContent, slug: string) => {
  const title = c.services.find((s) => s.slug === slug)?.shortTitle;
  if (!title) throw new Error(`no service ${slug}`);
  return title;
};

describe('county-program options', () => {
  it('both programs are recognised by the label of either language', () => {
    for (const slug of PROGRAMS) {
      expect(isProgramOption(option(en, slug))).toBe(true);
      expect(isProgramOption(option(es, slug))).toBe(true);
    }
  });

  it('no other option of either dropdown is one', () => {
    for (const c of [en, es] as SiteContent[]) {
      const others = c.contactServiceOptions.filter(
        (o) => !PROGRAMS.some((slug) => option(c, slug) === o),
      );
      // Six design/assessment services and "Other / not sure yet".
      expect(others.length).toBe(c.contactServiceOptions.length - PROGRAMS.length);
      for (const o of others) expect(isProgramOption(o)).toBe(false);
    }
  });

  it('a slug, an empty value and a prototype key are not options', () => {
    for (const v of ['building-recertification', '', 'constructor', 'toString']) {
      expect(isProgramOption(v)).toBe(false);
    }
  });
});

describe('when the description is required', () => {
  const recert = option(en, 'building-recertification');
  const bsipEs = option(es, 'broward-bsip');
  const concrete = option(en, 'reinforced-concrete-design');

  it('a county program with a finished upload does not need one', () => {
    expect(descriptionRequired(recert, 1)).toBe(false);
    expect(descriptionRequired(bsipEs, 3)).toBe(false);
  });

  it('a county program with nothing attached still does', () => {
    // "No notice yet? Send the address and the year built" — in words.
    expect(descriptionRequired(recert, 0)).toBe(true);
    expect(descriptionRequired(bsipEs, 0)).toBe(true);
  });

  it('every other service does, attachment or not', () => {
    expect(descriptionRequired(concrete, 0)).toBe(true);
    expect(descriptionRequired(concrete, 5)).toBe(true);
    expect(descriptionRequired('', 2)).toBe(true);
  });
});

describe('where a request came from', () => {
  const ORIGIN = 'https://ttcivilstructural.com';

  it('keeps the path the visit started on and the page that linked to it', () => {
    expect(
      requestSource(`${ORIGIN}/es/services/broward-bsip`, 'https://www.google.com/', ORIGIN),
    ).toEqual({ landing: '/es/services/broward-bsip', referrer: 'https://www.google.com/' });
  });

  it('drops query strings and fragments from both', () => {
    expect(
      requestSource(
        `${ORIGIN}/contact?service=broward-bsip&gclid=abc123#form`,
        'https://search.example/results?q=my+private+search#top',
        ORIGIN,
      ),
    ).toEqual({ landing: '/contact', referrer: 'https://search.example/results' });
  });

  it('keeps an app referrer, whose origin is opaque', () => {
    expect(requestSource(`${ORIGIN}/`, 'android-app://com.google.android.gm/', ORIGIN).referrer).toBe(
      'android-app://com.google.android.gm/',
    );
  });

  it('says nothing when the browser has nothing', () => {
    expect(requestSource(undefined, '', ORIGIN)).toEqual({ landing: null, referrer: null });
    expect(requestSource(null, null, ORIGIN)).toEqual({ landing: null, referrer: null });
    expect(requestSource('not a url', 'also not one', ORIGIN)).toEqual({
      landing: null,
      referrer: null,
    });
  });

  it('does not report another origin as a page of this site', () => {
    expect(requestSource('https://elsewhere.example/contact', '', ORIGIN).landing).toBeNull();
  });

  it('caps both lines', () => {
    const long = 'a'.repeat(2000);
    const s = requestSource(`${ORIGIN}/${long}`, `https://x.example/${long}`, ORIGIN);
    expect(s.landing).toHaveLength(SOURCE_MAX);
    expect(s.referrer).toHaveLength(SOURCE_MAX);
  });
});

describe('a value stored as one line', () => {
  it('cannot start a line of its own', () => {
    expect(oneLine('4\nLanguage: xx\r\nArrived on: /fake', 80)).toBe(
      '4 Language: xx Arrived on: /fake',
    );
  });

  it('is trimmed, collapsed and capped', () => {
    expect(oneLine('  March   3,\t2026  ', 80)).toBe('March 3, 2026');
    expect(oneLine('x'.repeat(50), 20)).toHaveLength(20);
    expect(oneLine(' \n ', 20)).toBe('');
  });
});
