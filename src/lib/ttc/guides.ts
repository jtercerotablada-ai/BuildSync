/**
 * THE GUIDES — /guides and /guides/<slug>, with their Spanish twins.
 *
 * Built on October 17, 2026 from a 33-query Google sweep: the firms that
 * outrank this site for "recertification" and "BSIP" searches publish a
 * cluster of plain answers — what to do with a notice, 30 vs 40 vs 50-year,
 * milestone vs recertification — each one linking to their service page.
 * Each guide here answers ONE question an owner types, and leads to the
 * county program's page and to the cost page.
 *
 * NO TEXT IN THIS FILE: the proxy and the sitemap import it, and anything
 * may. The words are in guides.en.ts / guides.es.ts, reached only through
 * guide-content.ts, from server components (guides.test.ts walks the
 * imports of every 'use client' file, as cities.test.ts does).
 *
 * The rules of the text, all tested in guides.test.ts:
 *   • No county age, day count or deadline is typed. A guide prints the
 *     facts it needs from the county's verified timing row (`facts` below:
 *     which row, which labels) with the row's authority and date, and its
 *     prose points at those rows by label in curly quotes.
 *   • No digits at all, but the names owners still type — "40-year" and,
 *     in the one guide about the names, "30-year" and "50-year" — each in a
 *     sentence that says it is a name.
 *   • Nothing about who signs; no fee, no fine amount, no promise about an
 *     office; no client, case or review. The firm's part is the complete
 *     package each county asks for.
 *   • Nothing of six words or more printed on another page of the site.
 */
export type ProgramSlug = 'building-recertification' | 'broward-bsip';
/** The services whose timing row a guide may print facts from. */
export type RowSlug = ProgramSlug | 'milestone-inspections';

/**
 * Facts read from a service's timing row (`rows[0]`), named by their
 * ENGLISH labels: the Spanish row has the same facts in the same order
 * (programs.test.ts), so the view finds the index in English and prints
 * the fact of the page's own language.
 */
export type GuideFacts = { service: RowSlug; keys: string[] };

export type GuideSection = {
  /** The section's h2. */
  title: string;
  paras: string[];
  /** A short list after the paragraphs. */
  list?: string[];
  /** Verified facts printed after the list, each block with its source. */
  facts?: GuideFacts[];
};

export type Guide = {
  slug: string;
  /** The program pages it leads to; the first is its own (the button). */
  programs: ProgramSlug[];
  seo: { title: string; description: string };
  /** The guide's name in lists and links: short, and not its H1. */
  name: string;
  h1: string;
  heroSub: string;
  /** Its line on /guides. */
  card: string;
  sections: GuideSection[];
  /** The h2 over the questions: each guide's own. */
  faqTitle: string;
  faq: { q: string; a: string }[];
};

/** The index page's own words. */
export type GuidesIndex = {
  seo: { title: string; description: string };
  crumb: string;
  eyebrow: string;
  titleLines: string[];
  accentWord: string;
  sub: string;
  listLabel: string;
  listTitle: string;
  /** Under the list: how to use the guides. */
  howTitle: string;
  how: string[];
};

/** The words of the guide view that are not any one guide's. */
export type GuideLabels = {
  eyebrow: string;
  reviewed: string;
  /** In front of a block of facts: "Miami-Dade County’s row". */
  rowsOf: (jurisdiction: string) => string;
  /** A fact's label in a guide, with its county: "Miami-Dade — Time to file". */
  factLabel: (county: string, label: string) => string;
  questionsLabel: string;
  more: string;
  moreLabel: string;
  costLink: string;
  allGuides: string;
  /** Above the list of guides on a county program's page. */
  forProgram: string;
};

export const GUIDES_PATH = '/guides';

/** Order = the order on /guides and in each guide's "keep reading". */
export const guideSlugs = [
  'recertification-notice',
  'broward-bsip-notice',
  'is-my-building-due',
  'recertification-30-40-50-year',
  'milestone-recertification-sirs',
  'failed-recertification',
  'parking-lot-illumination-guardrail',
] as const;

export const guidePath = (slug: string) => `${GUIDES_PATH}/${slug}`;

/**
 * The day the guides' text was last read against the timing rows and the
 * program pages. Not `regulatoryChecked`: the rows a guide prints carry
 * that date themselves. site.es.ts style for the Spanish one.
 */
export const guidesReviewed = { en: 'October 17, 2026', es: '17 de octubre de 2026' } as const;
export const guidesReviewedISO = '2026-10-17';
