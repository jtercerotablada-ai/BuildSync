/**
 * MATH AS IT IS WRITTEN IN A TEXTBOOK, from the library's plain alphabet.
 *
 * The library writes every formula and every symbol in a closed alphabet (engine.ts, FORMULA ALPHABET): letters and digits, `_` for a
 * subscript (`x_j`, `K_FF`, `f_FE_global`), `^T` for a transpose, the superscripts ² and ³ as characters, the true minus, and no word.
 * The page sets a subscript as a subscript and the transpose as a superscript. This file only cuts a text into the pieces; the
 * component that writes them (Notation.tsx) adds nothing of its own, so the rule is one pure function that can be tested.
 *
 * A subscript is the run of letters and digits after the underscore. Two subscripts in a row belong to one symbol (`f_FE_global` is
 * f with FE and global): they are set together as one subscript, "FE,global". Only `^T` is a superscript: a `^` before anything else
 * is the page's own way of writing a power of ten ("10^−5") and stays as it is.
 */

export type NotationPart = { kind: 'text' | 'sub' | 'sup'; text: string };

const SUBSCRIPT = /_([A-Za-z0-9]+(?:_[A-Za-z0-9]+)*)/y;

export function notation(text: string): NotationPart[] {
  const parts: NotationPart[] = [];
  let plain = '';
  const flush = () => {
    if (plain !== '') parts.push({ kind: 'text', text: plain });
    plain = '';
  };
  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (ch === '_') {
      SUBSCRIPT.lastIndex = i;
      const m = SUBSCRIPT.exec(text);
      if (m) {
        flush();
        parts.push({ kind: 'sub', text: m[1].replace(/_/g, ',') });
        i += m[0].length;
        continue;
      }
    }
    // The transpose, but not the T of a longer word ("^Total" would be a power of something): only a lone T.
    if (ch === '^' && text[i + 1] === 'T' && !/[A-Za-z0-9]/.test(text[i + 2] ?? '')) {
      flush();
      parts.push({ kind: 'sup', text: 'T' });
      i += 2;
      continue;
    }
    plain += ch;
    i++;
  }
  flush();
  return parts;
}

/** The text as plain characters for a place that cannot show a subscript (a title attribute, a copied line): the same alphabet, unchanged. */
export const plainNotation = (text: string): string => text;

/** A formula or a symbol in a sentence a screen reader reads: "K sub FF", "T transpose". */
export function spoken(text: string): string {
  return notation(text)
    .map((p) => (p.kind === 'sub' ? ` sub ${p.text.replace(/,/g, ' ')} ` : p.kind === 'sup' ? ' transpose ' : p.text))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
