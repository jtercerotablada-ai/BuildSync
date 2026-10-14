/*
 * One formatter for each number of figures, made the first time it is asked
 * for and kept. `toLocaleString` makes a new one at every call, and a
 * calculator prints some three hundred numbers each time a key is pressed:
 * on a phone that was a third of the wait for a typed character to show.
 * The text is the same, character for character: `toLocaleString` is defined
 * as this formatter's `format`.
 */
const PLAIN = new Map<number, Intl.NumberFormat>();
function plain(significant: number): Intl.NumberFormat {
  let made = PLAIN.get(significant);
  if (!made) {
    made = new Intl.NumberFormat('en-US', { maximumSignificantDigits: significant });
    PLAIN.set(significant, made);
  }
  return made;
}

/**
 * Numbers as a calculator prints them: a few significant figures, thousands
 * set apart, never "-0", and scientific notation only where a plain number
 * would be a row of zeros.
 *
 * Always with a decimal POINT, in both languages: these are engineering
 * values read next to US codes and US drawings.
 *
 * What sets the thousands apart is the page's to say (`group`). A comma on
 * the English page: 53,670. On the Spanish page a narrow space, 53 670: a
 * reader who writes decimals with a comma took "53,670" for 53.67.
 *
 * A power of ten is "7.316 × 10^−5". The exponent's minus is a true one,
 * "−", as an engineer writes it. The value's own sign stays the hyphen every
 * negative here is printed with, the one a field reads back (`parseNumber`);
 * a power of ten is never read back.
 *
 * The spaces round its × are plain ones, which a line may end at. A page
 * that holds such a number on one line sets them so itself, and makes room
 * for it (ShaftCalculator.tsx, `num`: its cards that are a table move
 * sideways, calc.css). Set here, for every page, they held it whole in cards
 * that have no such room: on a phone the first two calculators' "Reactions"
 * ran past its card — 56 px at 320 px wide and 16 px at 360 in Spanish, for
 * a reaction of four figures — and its Moment column was cut at the edge of
 * the screen.
 *
 * Not raised, "10⁻⁵": the page has nothing to draw that with. Geist and Geist
 * Mono, as the site loads them (next/font, Google's latin subset), have a
 * raised ¹, ² and ³ and no other raised figure, and no raised minus. The
 * browser took ⁰ and ⁴ to ⁹ from Arial, at 105 % of its size beside Geist
 * and 135 % beside the drawings' mono, and the ⁻ from a third font — another
 * on every machine. In a card's 14 px the raised figures were six or seven
 * pixels tall, four or five on paper: "10⁻¹¹" was a smudge on an ordinary
 * screen, and a drawing's label set a small ¹ beside a large, heavy ⁰.
 * Windows' own speech read "7.316 × 10⁻⁵" as "seven point three one six
 * times one zero". The caret is in the type, reads "to the power" to any
 * engineer, and a line cannot end at it, nor at the minus after it. (A
 * unit's raised figure, in⁴, is set up by markup where it is printed:
 * ShaftCalculator.tsx, `raised`.)
 */
export function formatNumber(value: number, significant = 4, group = ','): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs < 1e-12) return '0';
  if (abs >= 1e7 || abs < 1e-4) {
    const [mantissa, exponent] = value.toExponential(Math.max(0, significant - 1)).split('e');
    return `${Number(mantissa)} × 10^${String(Number(exponent)).replace('-', '−')}`;
  }
  // By figures, not by decimals: six decimals cut 0.0001192 to 0.000119.
  const text = plain(significant).format(Number(value.toPrecision(significant)));
  return group === ',' ? text : text.replace(/,/g, group);
}

/** A number for an input field: enough figures to lose nothing typed, no separators. */
export function fieldNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return String(Number(value.toPrecision(8)));
}

/**
 * Whether two numbers that ought to be one number are: the same figures when
 * printed, or no further apart than a millionth of `scale`, the size of what
 * they were added up from. (The second half is for two values a hair either
 * side of a rounding step, which print differently and are the same number.)
 * A page that says "X = Y" asks this first, and prints one of them twice.
 */
export function agree(a: number, b: number, scale: number, significant = 4): boolean {
  return formatNumber(a, significant) === formatNumber(b, significant) || Math.abs(a - b) <= 1e-6 * Math.abs(scale);
}

/* The spaces a number may be grouped with: the plain one, the no-break one,
   the thin one and the narrow no-break one the Spanish page prints. */
const SPACES = /[ \u00a0\u2009\u202f]/g;
const SPACED = /^-?[1-9]\d{0,2}([ \u00a0\u2009\u202f]\d{3})+([.,]\d*)?$/;
/* One comma and exactly three digits after 1 to 999: "1,250". */
const ONE_GROUP = /^(-?)([1-9]\d{0,2}),(\d{3})$/;

/**
 * "1,250" on a page that does not print a grouping comma: 1250 to one
 * reader and 1.25 to another, and nothing in the text says which. Returned
 * as the ways to write it that this page reads one way — without the comma
 * (thousands), with a point, and with a comma and one more digit (both the
 * decimal) — or `null` when the text is not of that shape, or the page
 * prints commas and so reads one. The page says which is which: "1.250" is
 * 1.25 here, and thousands to a reader who sets them apart with points.
 */
export function ambiguousNumber(text: string, group = ','): { grouped: string; decimal: string; padded: string } | null {
  if (group === ',') return null;
  const m = text.trim().match(ONE_GROUP);
  return m ? { grouped: `${m[1]}${m[2]}${m[3]}`, decimal: `${m[1]}${m[2]}.${m[3]}`, padded: `${m[1]}${m[2]},${m[3]}0` } : null;
}

/**
 * What was typed, as a number, or `null` if it is not one yet. The WHOLE
 * text or nothing: "12 ft" is not 12.
 *
 * `group` is what the page sets thousands apart with, as in `formatNumber`:
 * a plain number a page prints can be typed back on it. So can whatever a
 * field shows (`fieldNumber`), which writes a value of 10²¹ or more with an
 * exponent and its sign, "1e+21" — a spreadsheet's spelling too. The tables'
 * "4 × 10^20" and "7.316 × 10^−5" are not read, nor the same with raised
 * figures, "7.316 × 10⁻⁵": pasted into a field they are refused, not taken
 * for another number.
 *
 * Commas. The English page prints 29,000 — so a number typed that way, with
 * commas every three digits, is that number (read as a decimal comma it was
 * 29, a modulus a thousand times too small, with no warning). Any other
 * single comma is a decimal point: "8,5" is 8.5, and so is "0,125" — a
 * grouped number does not begin with a zero.
 *
 * The Spanish page prints no comma, and its reader types one for the
 * decimal point: there "1,250" is not a number until it is written one way
 * or the other (`ambiguousNumber`). Two groups or more, "1,234,567", are
 * thousands on either page.
 *
 * Spaces every three digits are thousands on either page: "53 670".
 */
export function parseNumber(text: string, group = ','): number | null {
  let typed = text.trim();
  if (SPACED.test(typed)) typed = typed.replace(SPACES, '');
  if (ambiguousNumber(typed, group)) return null;
  const s = /^-?[1-9]\d{0,2}(,\d{3})+(\.\d*)?$/.test(typed) ? typed.replace(/,/g, '') : typed.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
