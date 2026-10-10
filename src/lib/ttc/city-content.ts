import type { CityPage, CityProgram } from './cities';
import { cityPagesEn } from './cities.en';
import { cityPagesEs } from './cities.es';
import type { Lang } from './i18n';

/* SERVER SIDE ONLY: this module is the one door to the city pages' text
   (see the header of cities.ts). A 'use client' file that imports it, or
   anything that imports it, puts all of that text in the browser's script. */

const bundles: Record<Lang, readonly CityPage[]> = { en: cityPagesEn, es: cityPagesEs };

/** Every city page, in one language. Server-side only (see cities.ts). */
export function getCityPages(lang: Lang): readonly CityPage[] {
  return bundles[lang];
}

/** One city page, or undefined when the program has no page for that slug. */
export function findCityPage(lang: Lang, program: string, slug: string): CityPage | undefined {
  return bundles[lang].find((p) => p.program === program && p.slug === slug);
}

/** The pages of one county program, in the order of that county's office list. */
export function cityPagesOf(lang: Lang, program: CityProgram | string): readonly CityPage[] {
  return bundles[lang].filter((p) => p.program === program);
}
