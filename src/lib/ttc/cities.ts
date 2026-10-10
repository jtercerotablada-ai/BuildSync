/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CITY PAGES — one page per city, under the county program it belongs to
 * ─────────────────────────────────────────────────────────────────────────────
 *   /services/building-recertification/hialeah
 *   /services/broward-bsip/fort-lauderdale          (+ the /es mirror)
 *
 * WHY THEY EXIST. A notice has a CITY's name on it, and an owner searches
 * with that name ("Hialeah recertification"). The two county pages list each
 * city's office in one row; a city page says how THAT office runs the
 * program — how the notice arrives, how the report is filed there, the
 * city's own forms, what it says happens next — and nothing else.
 *
 * WHAT A CITY PAGE MAY SAY. Only what the city's own website says about its
 * handling of the program, read there and recorded in `city-sources.ts`
 * (the quote and the address of every row and answer). No fact from memory,
 * from a third party or from another city.
 *
 * WHAT IT MAY NOT:
 *   • A county's ages, day counts or deadlines. They are printed from the
 *     county page's verified timing row (CityView reads `home` facts from
 *     it), never typed here — several cities' own pages still print the old
 *     ones. cities.test.ts fails on a typed one.
 *   • Fees, fines or any amount of money.
 *   • Who prepares, signs or seals which part (see the header of site.ts).
 *   • A city's web address, linked or not (site.ts, `Service.offices`: city
 *     sites answer crawlers unevenly). The addresses are in the record.
 *   • Office hours: they change, and nobody re-reads them.
 *   • Anything Miami-Dade's package has that Broward's does not, on a
 *     Broward page (thermography, the parking-lot certificates).
 *
 * EVERY PAGE IS ITS OWN TEXT. No paragraph, row or answer of six words or
 * more is printed on two city pages, or on a city page and any other page
 * (cities.test.ts renders them all and compares). What the pages share —
 * section headings, the deadline rows — is built in CityView with the
 * city's name in it, or kept under six words.
 *
 * NOT IN THE CLIENT BUNDLE. `site.ts` travels to the browser with every
 * page (lang.tsx); the city text must not. So THIS FILE HOLDS NO TEXT —
 * the type, the dates and one helper — and anything may import it. The
 * text is `cities.en.ts` and `cities.es.ts`, reached only through
 * `city-content.ts`, and those three are for server components (CityView,
 * the routes, the county page's office rows). For one build the English
 * text was re-exported from here; structured-data.ts imported this file,
 * the site-wide graph component ('use client') imports that one, and 150 KB
 * of city text rode in the script of every public page. cities.test.ts now
 * walks the imports of every 'use client' file and fails if it can reach
 * the text.
 *
 * `cities.es.ts` mirrors `cities.en.ts` row for row: same slugs, same
 * order, same rows and questions (cities.test.ts).
 */

export type CityProgram = 'building-recertification' | 'broward-bsip';

export type CityPage = {
  /** The last segment of the address: /services/<program>/<slug>. */
  slug: string;
  program: CityProgram;
  /** The city exactly as the county page's office row names it in this
      language — the key that joins the row to this page. */
  city: string;
  /** The city inside a sentence, after "in": "Hialeah", "the City of Miami". */
  place: string;
  /** The building office, by the name the city's own page gives it. The
      same string as the county page's row, and the same in both languages. */
  office: {
    name: string;
    /** Street address, one line per entry, as the city prints it. */
    address?: string[];
    phone?: string;
  };
  /** Search result description. No age, no day count. */
  description: string;
  /** Under the H1. One or two sentences, this city's own. */
  heroSub: string;
  /** Opens "In your city": two or three sentences on how this office runs
      the program. */
  lede: string;
  /** What the city's own page says, one row per subject. */
  local: { k: string; v: string }[];
  /** Questions a board in this city asks. An answer points at a deadline
      row by its label in curly quotes; it never types the number. */
  faq: { q: string; a: string }[];
  /** The one thing to do next, naming this city's office. */
  nextStep: string;
};

/** The day every city's own pages were opened and read (city-sources.ts). */
export const citiesChecked = { en: 'October 9, 2026', es: '9 de octubre de 2026' } as const;
export const citiesCheckedISO = '2026-10-09';

/** `/services/<program>/<slug>` — canonical (English) path of a city page.
    Takes a page or an entry of city-slugs.ts: the slugs are the same in
    both languages. */
export const cityPath = (p: { program: string; slug: string }) => `/services/${p.program}/${p.slug}`;
