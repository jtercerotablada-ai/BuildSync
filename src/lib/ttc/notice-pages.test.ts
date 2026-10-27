import { describe, expect, it } from 'vitest';
import { getContent } from './content';
import { COST_PATH } from './cost-path';
import { getGuides } from './guide-content';
import { guidePath } from './guides';
import type { Lang } from './i18n';
import { guideHoldsNotice, pageHoldsNotice, NO_NOTICE_GUIDES, NO_NOTICE_SERVICES, NOTICE_SERVICES } from './notice-pages';
import { holdsNotice } from './site';

/**
 * The rule for "Send the notice" by address (notice-pages.ts). The lists are
 * typed by hand so the phone bar never imports the guides' text; these tests
 * keep them equal to the text they stand for and to the views' own rule, so
 * a new guide or service cannot fall between them.
 */
const LANGS: Lang[] = ['en', 'es'];

describe('pageHoldsNotice: the lists agree with the pages', () => {
  for (const lang of LANGS) {
    // Since 2026-10-26: the no-letter guide, and the guides of the services
    // whose reader holds no notice (assessments, peer review).
    it(`${lang}: the no-notice guides are the guides whose reader holds no notice`, () => {
      const none = getGuides(lang)
        .filter((g) => !guideHoldsNotice(g))
        .map((g) => g.slug);
      expect([...NO_NOTICE_GUIDES].sort()).toEqual(none.sort());
    });

    it(`${lang}: every existing-building service is decided, and no new-building one holds a notice`, () => {
      const services = getContent(lang).services;
      const existing = services.filter((s) => s.track === 'existing').map((s) => s.slug);
      expect([...NOTICE_SERVICES, ...NO_NOTICE_SERVICES].sort()).toEqual(existing.sort());
      for (const s of services.filter((x) => x.track === 'new')) {
        expect(pageHoldsNotice(`/services/${s.slug}`), s.slug).toBe(false);
      }
    });

    // ServiceDetailView words its own band from site.ts `holdsNotice` (per
    // service); the bar reads this file (per address). They must agree.
    it(`${lang}: every service page agrees with site.ts holdsNotice`, () => {
      for (const s of getContent(lang).services) {
        expect(pageHoldsNotice(`/services/${s.slug}`), s.slug).toBe(holdsNotice(s));
      }
    });

    it(`${lang}: every guide page agrees with its own reader`, () => {
      for (const g of getGuides(lang)) {
        expect(pageHoldsNotice(guidePath(g.slug)), g.slug).toBe(guideHoldsNotice(g));
      }
    });
  }
});

describe('pageHoldsNotice: by address', () => {
  it('/existing-buildings and the cost page hold one', () => {
    for (const p of ['/existing-buildings', '/existing-buildings/', COST_PATH]) {
      expect(pageHoldsNotice(p), p).toBe(true);
    }
  });

  // The home is a presentation of the firm (the owner, 2026-10-24): no notice,
  // so the phone bar does not say "Send the notice" there and its WhatsApp chat
  // does not open with one. "" is the home as the phone bar sees it after it
  // has cut the slash.
  it('the home page does not hold one, with or without its slash', () => {
    for (const p of ['', '/']) {
      expect(pageHoldsNotice(p), JSON.stringify(p)).toBe(false);
    }
  });

  it('the guides do, except the one for the reader with no letter', () => {
    expect(pageHoldsNotice('/guides')).toBe(true);
    expect(pageHoldsNotice(guidePath('recertification-notice'))).toBe(true);
    expect(pageHoldsNotice(guidePath('is-my-building-due'))).toBe(false);
    expect(pageHoldsNotice(`${guidePath('is-my-building-due')}/`)).toBe(false);
  });

  it('the county programs, the milestone page and their city pages do', () => {
    expect(pageHoldsNotice('/services/building-recertification')).toBe(true);
    expect(pageHoldsNotice('/services/broward-bsip/fort-lauderdale')).toBe(true);
    expect(pageHoldsNotice('/services/milestone-inspections')).toBe(true);
  });

  it('the assessments page, /about, /projects, /services and /contact do not', () => {
    for (const p of ['/services/structural-condition-assessments', '/about', '/projects', '/services', '/contact']) {
      expect(pageHoldsNotice(p), p).toBe(false);
    }
  });

  it('a prefix of a slug is not the slug', () => {
    expect(pageHoldsNotice('/services/broward-bsip-extra')).toBe(false);
    expect(pageHoldsNotice('/guidesx')).toBe(false);
  });
});
