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
 * Since October 26, 2026 the guides cover the SIX services (the owner: the
 * site is built on six services): four more — threshold buildings, balcony
 * spalling and cracks, buying a building, structural peer review — each
 * leading to its own service (`service`); every guide opens with a short
 * answer (`short`); /guides lists them under their service (`index.groups`).
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
  /**
   * The service the guide leads to: its card closes the guide, its group
   * holds it on /guides, and its form preset is the hero's button when the
   * guide has no county program (assessments, peer review). A slug of
   * site.ts `services`.
   */
  service: string;
  /**
   * The program pages it leads to — none for a guide of a service that is
   * not a county program. The hero has one button per program, each
   * opening the form with its own county preselected (a Broward board must
   * not land on a form set to Miami-Dade); the closing band keeps the preset
   * only when there is one program.
   */
  programs: ProgramSlug[];
  /**
   * DATA, not text: 'address' for a guide whose reader may have no letter
   * yet. Its hero then has one button, `labels.addressCta`, to the form with
   * no program preset, and the page never says "Send the notice": Call and
   * WhatsApp, in the hero and in the closing band, are the plain ones, and
   * the chat opens without "I received a notice". Its slug is also in
   * notice-pages.ts `NO_NOTICE_GUIDES`, which the phone bar reads (it may
   * not import this text); notice-pages.test.ts keeps the two the same.
   */
  heroAction?: 'address';
  seo: { title: string; description: string };
  /** The guide's name in lists and links: short, and not its H1. */
  name: string;
  h1: string;
  heroSub: string;
  /** Its line on /guides. */
  card: string;
  /**
   * The short answer: three sentences at the top of the guide, the essentials
   * in ten seconds — its own words, not lines of the body.
   */
  short: string[];
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
  /**
   * The guides under their service, in this order: each group's name, one
   * line, and the services whose guides it holds (`Guide.service`).
   */
  groups: { label: string; lede: string; services: string[] }[];
  /**
   * Under the list, every paragraph about the reader's building, never about
   * the site: what a missed date leads to in each county, why the two are
   * never mixed, what to send (the letter — or, with no letter yet, the
   * address), and what follows. No "how to read these guides" text.
   */
  howLabel: string;
  howTitle: string;
  how: string[];
};

/** The words of the guide view that are not any one guide's. */
export type GuideLabels = {
  eyebrow: string;
  reviewed: string;
  /** The label over a guide's short answer. */
  shortLabel: string;
  /** The label over the card of the guide's service, at its foot. */
  serviceLabel: string;
  /** The hero button of a guide with no county program. */
  proposalCta: string;
  /** In front of a block of facts: "Miami-Dade County’s row". */
  rowsOf: (jurisdiction: string) => string;
  /** A fact's label in a guide, with its county: "Miami-Dade — Time to file". */
  factLabel: (county: string, label: string) => string;
  questionsLabel: string;
  more: string;
  /** The hero button of a guide with `heroAction: 'address'`. */
  addressCta: string;
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
  'threshold-building',
  'balcony-spalling-cracks',
  'buying-a-building',
  'structural-peer-review-florida',
] as const;

export const guidePath = (slug: string) => `${GUIDES_PATH}/${slug}`;

/**
 * The day the guides' text was last read against the timing rows and the
 * program pages. Not `regulatoryChecked`: the rows a guide prints carry
 * that date themselves. site.es.ts style for the Spanish one.
 */
export const guidesReviewed = { en: 'October 26, 2026', es: '26 de octubre de 2026' } as const;
export const guidesReviewedISO = '2026-10-26';
