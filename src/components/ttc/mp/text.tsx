import React from 'react';

/**
 * Italicise one phrase inside a headline line: the site's single typographic
 * accent. Pure function, safe in server and client components alike.
 *
 *   accent('Engineering for South Florida.', 'South Florida.')
 *   → ['Engineering for ', <span class="mp-serif">South Florida.</span>]
 */
export function accent(line: string, word?: string): React.ReactNode {
  if (!word || !line.includes(word)) return line;
  const [before, after] = line.split(word);
  return (
    <>
      {before}
      <span className="mp-serif">{word}</span>
      {after}
    </>
  );
}

/**
 * The first sentence of a paragraph, with its full stop: the text up to the
 * first full stop that is followed by a space and a capital letter. All of
 * it when there is no such stop.
 *
 *   firstSentence('Due on the date in the letter. Older guides differ.')
 *   → 'Due on the date in the letter.'
 *
 * For the county programs' filing deadline, which the service page's hero
 * prints from the timing row: the row holds the deadline and then what
 * qualifies it, the hero has room for the deadline, and printing the whole
 * value in both places was the same paragraph twice on one page. Cut here,
 * the number is still read from the row and typed nowhere else.
 *
 * It knows nothing about abbreviations ("No. 4 Main St. Suite…" would be cut
 * at "St."): pages.test.ts checks what the two heroes actually print.
 */
export function firstSentence(text: string): string {
  const stop = text.search(/\.(?=\s+[A-ZÁÉÍÓÚÜÑ¿¡])/);
  return stop === -1 ? text : text.slice(0, stop + 1);
}

/**
 * What a paragraph says after its first sentence — the other half of
 * `firstSentence`. Empty when the paragraph is one sentence.
 *
 *   afterFirstSentence('A phone photo is enough. No notice yet? Send the address.')
 *   → 'No notice yet? Send the address.'
 *
 * For the line under a county program's button. The program page prints the
 * whole line under its hero button; the home page's section prints this half
 * (what to send when there is no notice yet), because the first half is
 * already said in the home page's closing band and the whole line, printed
 * on both pages, was the same paragraph on two pages.
 */
export function afterFirstSentence(text: string): string {
  return text.slice(firstSentence(text).length).trim();
}

/** Apply `accent` to every line of a headline. */
export function accentLines(
  lines: readonly string[],
  word?: string,
): React.ReactNode[] {
  return lines.map((l, i) => (
    <React.Fragment key={i}>{accent(l, word)}</React.Fragment>
  ));
}
