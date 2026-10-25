import type { Lang } from './i18n';

/**
 * A small count, said in words.
 *
 * The home page says "Nine free engineering calculators" and "Seven guides
 * for building owners". Neither number is typed anywhere: the first is
 * `openCalculatorCount`, the second `guideSlugs.length`, and each is turned
 * into its word here, so opening a tenth calculator changes the page by
 * itself (views/home.test.ts keeps the printed word equal to the count).
 *
 * One to twelve, in both languages. Past twelve the numeral is returned
 * as it is, so the page keeps rendering and says the true count in digits
 * until a word is added here; the test of the home page fails at that
 * point, which is the reminder.
 *
 * Pure functions with no imports besides a type, so they are tested in the
 * node environment (number-words.test.ts) like every other behaviour here.
 */

const WORDS: Record<Lang, readonly string[]> = {
  en: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'],
  /* "uno" for 1 as a number; before a noun the page would need "un" / "una",
     which is why the count is never 1 on the home (a gender is a decision
     for the sentence, not for this table). */
  es: ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce'],
};

/** The largest count that has a word. */
export const NUMBER_WORD_MAX = WORDS.en.length;

/**
 * `n` in words, in lower case: "nine" / "nueve". A whole number from 1 to
 * 12; anything else comes back as its numeral ("13", "0", "2.5").
 */
export function numberWord(n: number, lang: Lang): string {
  if (Number.isInteger(n) && n >= 1 && n <= NUMBER_WORD_MAX) return WORDS[lang][n - 1];
  return String(n);
}

/**
 * A sentence from a template with `{n}` where the count goes, the count
 * said in words. When `{n}` opens the string the word takes a capital
 * ("{n} free engineering calculators" → "Nine free engineering
 * calculators"); anywhere else it stays in lower case.
 */
export function withNumberWord(template: string, n: number, lang: Lang): string {
  const word = numberWord(n, lang);
  return template.replace(/\{n\}/g, (_match, offset: number) =>
    offset === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
  );
}
