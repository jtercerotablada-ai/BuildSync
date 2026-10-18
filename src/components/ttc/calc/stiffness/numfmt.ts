/**
 * HOW A NUMBER OF THE WORKED SOLUTION IS WRITTEN, once for every table.
 *
 * The visitor chooses the significant figures (3 to 8) and a style; the choice applies to every matrix, vector and value of the
 * solution at once. The tables print through `formatCell`; a spreadsheet gets `spreadsheetNumber`, which keeps twelve figures and
 * nothing the page adds (no thousands mark, no true minus, no "× 10^").
 *
 *   auto        plain from 10⁻⁴ up to 10⁷, powers of ten outside (the other calculators' rule)
 *   fixed       plain from 10⁻¹² up to 10²¹, powers of ten only beyond (a "plain always" that cannot print 300 digits)
 *   scientific  powers of ten for every number but zero
 *
 * It is TOTAL: any finite number has a text, a number that is not finite is a dash, and no zero is ever "-0" (a rounding to the
 * given figures never reaches zero from a non-zero number: figures, not decimals).
 */

export type NumStyle = 'auto' | 'fixed' | 'scientific';
export type ZeroStyle = 'light' | 'dot' | 'plain';

export interface NumFormat {
  /** Significant figures, 3 to 8. */
  sig: number;
  style: NumStyle;
  /** What the page sets thousands apart with (the numbers' `group`). */
  group: string;
}

export const SIG_MIN = 3;
export const SIG_MAX = 8;
export const DEFAULT_FORMAT: NumFormat = { sig: 4, style: 'auto', group: ',' };

const PLAIN = new Map<number, Intl.NumberFormat>();
function plainFormatter(sig: number): Intl.NumberFormat {
  let made = PLAIN.get(sig);
  if (!made) {
    made = new Intl.NumberFormat('en-US', { maximumSignificantDigits: sig, useGrouping: true });
    PLAIN.set(sig, made);
  }
  return made;
}

const clampSig = (sig: number): number => (Number.isInteger(sig) ? Math.min(SIG_MAX, Math.max(SIG_MIN, sig)) : 4);

/** The mantissa and exponent of a non-zero finite number at `sig` figures, without trailing zeros: 7.316 and -5. */
function parts(abs: number, sig: number): { mantissa: string; exponent: number } {
  const [m, e] = abs.toExponential(sig - 1).split('e');
  return { mantissa: String(Number(m)), exponent: Number(e) };
}

/** A number as the tables write it: a true minus, powers of ten as "7.316 × 10^−5". */
export function formatCell(value: number, f: NumFormat = DEFAULT_FORMAT): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const sig = clampSig(f.sig);
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const scientific = () => {
    const { mantissa, exponent } = parts(abs, sig);
    return `${sign}${mantissa} × 10^${String(exponent).replace('-', '−')}`;
  };
  if (f.style === 'scientific') return scientific();
  const plainRange = f.style === 'fixed' ? abs >= 1e-12 && abs < 1e21 : abs >= 1e-4 && abs < 1e7;
  if (!plainRange) return scientific();
  const text = plainFormatter(sig).format(Number(abs.toPrecision(sig)));
  return `${sign}${f.group === ',' ? text : text.replace(/,/g, f.group)}`;
}

/** A number for a spreadsheet: twelve figures, a hyphen, a point, no mark between thousands. Zero is "0", never "-0". */
export function spreadsheetNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? '0' : '';
  return String(Number(value.toPrecision(12)));
}

/**
 * How many characters follow the decimal point of a number as `formatCell` wrote it (the mantissa's, for a power of ten), and whether
 * it is one. Used to line the points of a column up.
 */
export function fractionOf(text: string): { fraction: number; hasPoint: boolean; power: boolean } {
  const power = text.includes('×');
  const head = power ? text.split('×')[0].trim() : text;
  const at = head.indexOf('.');
  return { fraction: at < 0 ? 0 : head.length - at - 1, hasPoint: at >= 0, power };
}

/**
 * The room, in characters of a monospaced font, to leave after each number of a column so that their decimal points stand one over
 * another: a number with fewer decimals than the column's longest is pushed left by the difference, and one with no point at all by
 * that and the width of a point. A power of ten is aligned by its right edge and gets none.
 */
export function pointPadding(texts: readonly string[]): number[] {
  const info = texts.map(fractionOf);
  const widest = Math.max(0, ...info.filter((i) => !i.power).map((i) => i.fraction));
  return info.map((i) => (i.power ? 0 : i.hasPoint ? widest - i.fraction : widest > 0 ? widest + 1 : 0));
}
