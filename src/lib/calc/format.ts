/**
 * Numbers as a calculator prints them: a few significant figures, thousands
 * separated, never "-0", and scientific notation only where a plain number
 * would be a row of zeros.
 *
 * Always with a decimal POINT, in both languages: these are engineering
 * values read next to US codes and US drawings, and the inputs take a point
 * (a comma typed in a field is read as one — see NumField).
 */
export function formatNumber(value: number, significant = 4): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs < 1e-12) return '0';
  if (abs >= 1e7 || abs < 1e-4) {
    const [mantissa, exponent] = value.toExponential(Math.max(0, significant - 1)).split('e');
    return `${Number(mantissa)} × 10^${Number(exponent)}`;
  }
  const rounded = Number(value.toPrecision(significant));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** A number for an input field: enough figures to lose nothing typed, no separators. */
export function fieldNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return String(Number(value.toPrecision(8)));
}

/**
 * What was typed, as a number, or `null` if it is not one yet.
 *
 * Commas: the page prints 29,000 — so a number typed that way, with commas
 * every three digits, is that number (read as a decimal comma it was 29, a
 * modulus a thousand times too small, with no warning). Any other single
 * comma is a decimal point: "8,5" is 8.5, and so is "0,125" — a grouped
 * number does not begin with a zero.
 */
export function parseNumber(text: string): number | null {
  const typed = text.trim();
  const s = /^-?[1-9]\d{0,2}(,\d{3})+(\.\d*)?$/.test(typed) ? typed.replace(/,/g, '') : typed.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
