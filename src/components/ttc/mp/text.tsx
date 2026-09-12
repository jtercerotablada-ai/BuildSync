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

/** Apply `accent` to every line of a headline. */
export function accentLines(
  lines: readonly string[],
  word?: string,
): React.ReactNode[] {
  return lines.map((l, i) => (
    <React.Fragment key={i}>{accent(l, word)}</React.Fragment>
  ));
}
