import { describe, expect, it } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { programMode, serviceOptions } from './contact-form-logic';

const LANGS: Lang[] = ['en', 'es'];

describe('the home’s form never speaks of a notice', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const programs = ['building-recertification', 'broward-bsip'].map(
      (slug) => c.services.find((s) => s.slug === slug)!.shortTitle,
    );

    it(`${lang}: choosing a county program switches the page form to program mode, and never the home's`, () => {
      for (const option of programs) {
        expect(programMode(false, option), option).toBe(true);
        expect(programMode(true, option), option).toBe(false);
      }
      for (const option of c.contactServiceOptions.filter((o) => !programs.includes(o))) {
        expect(programMode(false, option), option).toBe(false);
        expect(programMode(true, option), option).toBe(false);
      }
      expect(programMode(true, '')).toBe(false);
    });

    it(`${lang}: the home’s dropdown lists the services in home.order, the programs 3rd and 5th, "other" last`, () => {
      const options = serviceOptions(c, true);
      // The same options as the page form, none lost, none added.
      expect([...options].sort()).toEqual([...c.contactServiceOptions].sort());
      expect(options).toHaveLength(7);
      const title = (slug: string) => c.services.find((s) => s.slug === slug)!.shortTitle;
      expect(options.slice(0, 6)).toEqual(c.home.order.map(title));
      expect(options.indexOf(programs[0])).toBe(2);
      expect(options.indexOf(programs[1])).toBe(4);
      expect(options[6]).toBe(c.contactServiceOptions[c.contactServiceOptions.length - 1]);
    });

    it(`${lang}: every other page keeps the site’s own list`, () => {
      expect(serviceOptions(c, false)).toEqual(c.contactServiceOptions);
    });
  }
});
