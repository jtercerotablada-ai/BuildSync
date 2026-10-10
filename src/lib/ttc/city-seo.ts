import type { CityPage } from './cities';
import type { Lang } from './i18n';
import { TITLE_BUDGET_PX, repeatedWords, titlePx } from './serp';

/**
 * The <title> of a city page, written without the firm (see views/seo.ts):
 * the city first — it is the word that tells this page from the county's —
 * then the program by its name.
 *
 * The first wording that FITS a search result is the one used: a city with a
 * long name ("North Miami Beach", "Sunny Isles Beach") drops the former name
 * before it drops anything else. "40-year" is there as the name people still
 * type, never as a rule, exactly as on the two county pages.
 *
 * A TITLE IS NEVER THE PAGE'S H1 OVER AGAIN (cities.test.ts): the H1 reads
 * "<program> in <city>", so every wording here opens with the city or with
 * the program's short name instead.
 */
const TITLES: Record<Lang, Record<CityPage['program'], ((city: string) => string)[]>> = {
  en: {
    'building-recertification': [
      (city) => `${city} Building Recertification (formerly 40-Year)`,
      (city) => `${city} Building Recertification`,
    ],
    'broward-bsip': [
      (city) => `${city} Building Safety Inspection Program (BSIP)`,
      (city) => `${city} Building Safety Inspection (BSIP)`,
    ],
  },
  es: {
    'building-recertification': [
      (city) => `Recertificación de edificios en ${city} (antes 40 años)`,
      (city) => `${city}: recertificación de edificios`,
    ],
    'broward-bsip': [
      (city) => `BSIP en ${city}: inspección de seguridad de edificios`,
      (city) => `BSIP en ${city}: inspección de seguridad`,
    ],
  },
};

const KEYWORDS: Record<Lang, Record<CityPage['program'], (city: string) => string[]>> = {
  en: {
    'building-recertification': (city) => [
      `${city} building recertification`,
      `${city} 40 year recertification`,
      `recertification engineer ${city}`,
      `${city} recertification notice`,
    ],
    'broward-bsip': (city) => [
      `${city} building safety inspection program`,
      `${city} BSIP`,
      `${city} 40 year inspection`,
      `building safety inspection engineer ${city}`,
    ],
  },
  es: {
    'building-recertification': (city) => [
      `recertificación de edificios ${city}`,
      `recertificación de 40 años ${city}`,
      `ingeniero recertificación ${city}`,
    ],
    'broward-bsip': (city) => [
      `inspección de seguridad de edificios ${city}`,
      `BSIP ${city}`,
      `inspección de 40 años ${city}`,
    ],
  },
};

const fits = (title: string) => titlePx(title) <= TITLE_BUDGET_PX && repeatedWords(title).length === 0;

/** What a city page hands to `pageMeta`. */
export function citySeo(lang: Lang, page: CityPage): { title: string; description: string; keywords: string[] } {
  const candidates = TITLES[lang][page.program].map((make) => make(page.city));
  return {
    title: candidates.find(fits) ?? candidates[candidates.length - 1],
    description: page.description,
    keywords: KEYWORDS[lang][page.program](page.city),
  };
}
