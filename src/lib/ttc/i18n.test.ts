import { describe, expect, it } from 'vitest';
import {
  altPath,
  hasTranslation,
  hreflangFor,
  langFromPathname,
  localePath,
  stripLang,
} from './i18n';

describe('langFromPathname', () => {
  it('detects the Spanish prefix and nothing that merely starts with es', () => {
    expect(langFromPathname('/es')).toBe('es');
    expect(langFromPathname('/es/services/peer-review')).toBe('es');
    expect(langFromPathname('/')).toBe('en');
    expect(langFromPathname('/escalate')).toBe('en');
    expect(langFromPathname(null)).toBe('en');
  });
});

describe('stripLang / localePath', () => {
  it('round-trips a path between languages', () => {
    expect(stripLang('/es')).toBe('/');
    expect(stripLang('/es/about')).toBe('/about');
    expect(stripLang('/about')).toBe('/about');
    expect(localePath('/', 'es')).toBe('/es');
    expect(localePath('/about#engineer', 'es')).toBe('/es/about#engineer');
    expect(localePath('/es/about', 'en')).toBe('/about');
    expect(localePath('/contact?service=x', 'es')).toBe('/es/contact?service=x');
  });

  it('altPath flips the language of a full pathname', () => {
    expect(altPath('/es/services')).toBe('/services');
    expect(altPath('/services')).toBe('/es/services');
    expect(altPath('/')).toBe('/es');
    expect(altPath('/es')).toBe('/');
  });

  // The switch used to be built from the pathname alone, so a form opened
  // for one service came back empty in the other language.
  it('altPath carries the query string to the twin page', () => {
    expect(altPath('/es/contact', '?service=building-recertification')).toBe(
      '/contact?service=building-recertification',
    );
    expect(altPath('/contact', '?service=broward-bsip')).toBe(
      '/es/contact?service=broward-bsip',
    );
    expect(altPath('/', '?a=1&b=2')).toBe('/es?a=1&b=2');
    expect(altPath('/es', '?a=1')).toBe('/?a=1');
    expect(altPath('/about', '')).toBe('/es/about');
  });

  it('hreflangFor lists en, es and x-default', () => {
    expect(hreflangFor('/about')).toEqual({
      en: '/about',
      es: '/es/about',
      'x-default': '/about',
    });
  });
});

describe('hasTranslation', () => {
  it('treats the English-only pages as untranslated in both languages', () => {
    expect(hasTranslation('/credits')).toBe(false);
    expect(hasTranslation('/credits/')).toBe(false);
    expect(hasTranslation('/es/credits')).toBe(false);
    expect(hasTranslation('/logo-styles')).toBe(false);
  });

  it('treats every mirrored page as translated', () => {
    expect(hasTranslation('/')).toBe(true);
    expect(hasTranslation('/es')).toBe(true);
    expect(hasTranslation('/about')).toBe(true);
    expect(hasTranslation('/es/services/building-recertification')).toBe(true);
    // Not a prefix match: this is a different page that merely starts the same.
    expect(hasTranslation('/credits-policy')).toBe(true);
  });
});
