/**
 * How wide a page title or a meta description is in a search result.
 *
 * A result shows a title up to about 580 px and a description up to about
 * 1000 px, and cuts the rest. Those are the limits of the on-page check the
 * owner runs on the site (report of October 7, 2026), which measures in
 * Arial — 20 px for a title, 14 px for a description. That day all 32 titles
 * were over: each one obeyed a budget counted in CHARACTERS, and characters
 * are not a width ("Miami-Dade" and "MMMMMMMMMM" are ten each, 107 px and
 * 170 px).
 *
 * So the site measures the way the check does. `pageMeta` (views/meta.tsx)
 * uses it to decide whether the firm's short name still fits after a title,
 * and views/seo.test.ts fails when a title or a description goes over.
 */

/** The check's own limits. */
export const TITLE_LIMIT_PX = 580;
export const DESCRIPTION_LIMIT_PX = 1000;

/**
 * What a title may measure HERE. The table below is Arial's, but the check
 * shapes text a little differently: for the ten titles its report lists, its
 * numbers run up to 7 px over this file's (seo.test.ts keeps them). A title
 * at 579 px here is over there, so the budget keeps that drift back.
 */
export const TITLE_BUDGET_PX = TITLE_LIMIT_PX - 8;

/**
 * Arial's advance widths, in thousandths of an em — every character the
 * site's titles and descriptions use, in both languages, and the rest of
 * ASCII. A character missing from this table is measured as a full em (see
 * `advance`), and `unmeasured` names it so the test can ask for it.
 */
const ARIAL: readonly (readonly [width: number, glyphs: string])[] = [
  [191, "'"],
  [222, 'ijl‘’'],
  [260, '|'],
  [278, ' !,./:;I[\\]ftÍí'],
  [333, '()-`r¡·“”'],
  [334, '{}'],
  [355, '"'],
  [365, 'º'],
  [370, 'ª'],
  [389, '*'],
  [400, '°'],
  [469, '^'],
  [500, 'Jcksvxyz'],
  [556, '#$0123456789?L_abdeghnopqu«»áéóúüñ–'],
  [584, '+<=>~'],
  [611, 'FTZ¿'],
  [667, '&ABEKPSVXYÁÉ'],
  [722, 'CDHNRUwÚÜÑ'],
  [778, 'GOQÓ'],
  [833, 'Mm'],
  [889, '%'],
  [944, 'W'],
  [1000, '—…'],
  [1015, '@'],
];

const ADVANCE = new Map<string, number>(
  ARIAL.flatMap(([width, glyphs]) => Array.from(glyphs, (g) => [g, width] as const)),
);

/** An unknown character counts as the widest: an unmeasured title can only
    look longer than it is, never shorter. */
const advance = (ch: string) => ADVANCE.get(ch) ?? 1000;

/** Each glyph lands on a whole pixel, as it does on screen: summing the
    fractional widths instead comes out 2 % short at 14 px. */
const width = (text: string, size: number) =>
  Array.from(text).reduce((px, ch) => px + Math.round((advance(ch) * size) / 1000), 0);

/** A title's width in the check's terms: Arial, 20 px. */
export const titlePx = (text: string) => width(text, 20);

/**
 * A description's width in the check's terms: Arial 14 px, times the factor
 * that brings this file to the one description the report measured (1012 px,
 * the milestone page's, over the limit that day).
 */
export const descriptionPx = (text: string) => Math.round(width(text, 14) * 0.972);

/** The characters of `text` the table has no width for. */
export const unmeasured = (text: string) =>
  [...new Set(Array.from(text).filter((ch) => !ADVANCE.has(ch)))];

/**
 * Words of four letters or more that appear twice — what the check reports
 * as "word repetition" (it reads as keyword stuffing). Hyphens split words,
 * so "Miami-Dade" is "miami" and "dade".
 */
export function repeatedWords(text: string): string[] {
  const words = (text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,}/g) ?? []).map((w) => w.toLowerCase());
  return [...new Set(words.filter((w, i) => words.indexOf(w) !== i))].sort();
}
