import React from 'react';

/**
 * A heading's words, each in its own clipping mask, rendered by REACT on the
 * server. Nothing rewrites the DOM afterwards (the prototype's script split
 * the words after load, which breaks hydration): the markup is final in the
 * first byte of HTML.
 *
 *   <Words text="Eight services. One discipline." accent="discipline." />
 *   → <span class="h-w"><span style="--wi:0">Eight</span></span> <span class="h-w">…
 *     … <span class="mp-serif"><span class="h-w"><span style="--wi:3">discipline.</span></span></span>
 *
 * AT REST THE WORDS SIT IN PLACE. Nothing here is hidden and nothing moves:
 * the static page, a visitor with no JavaScript and a visitor who asked for
 * less motion all read the heading as a heading. The rise of each word out
 * of its mask (spec E8: 1.25 s, 55 ms per word, from 118 %) belongs to the
 * motion slice and is driven only by `data-rv` on an element `reveal.ts`
 * watches, exactly like the other below-the-fold reveals:
 *
 *   MOTION HOOK: [data-rv='wait'] .h-w > span { transform: translateY(125%) }
 *   MOTION HOOK: [data-rv='in']   .h-w > span { animation: …
 *                                  calc(var(--wi) * 55ms) backwards }
 *
 * `--wi` is the word's index in the whole heading (the accent included), so
 * the stagger runs left to right, line after line.
 *
 * WHITESPACE IS REAL. Between two masks there is a plain space text node, so
 * `textContent` — what crawlers, link previews, screen readers and the
 * tests read — is the sentence, not a run of words. The accent phrase is one
 * `.mp-serif` span around its masks and never breaks across lines
 * (`.mp :is(h1, h2) .mp-serif { white-space: nowrap }` in mp.css).
 *
 * `start` offsets `--wi`, for a heading made of several `Words` (the
 * statement's three lines run on from each other).
 */
export function Words({
  text,
  accent,
  start = 0,
}: {
  text: string;
  /** The one phrase set in the italic serif; a phrase of `text`, once. */
  accent?: string;
  start?: number;
}) {
  const at = accent ? text.indexOf(accent) : -1;
  const segments =
    at === -1 || !accent
      ? [{ text, accent: false }]
      : [
          { text: text.slice(0, at), accent: false },
          { text: accent, accent: true },
          { text: text.slice(at + accent.length), accent: false },
        ];

  let n = start;
  return (
    <>
      {segments.map((seg, s) => {
        const parts = seg.text.split(/(\s+)/).filter((p) => p !== '');
        const nodes = parts.map((part, i) => {
          if (/^\s+$/.test(part)) return part;
          const wi = n++;
          return (
            <span key={i} className="h-w">
              <span style={{ '--wi': wi } as React.CSSProperties}>{part}</span>
            </span>
          );
        });
        return seg.accent ? (
          <span key={s} className="mp-serif">
            {nodes}
          </span>
        ) : (
          <React.Fragment key={s}>{nodes}</React.Fragment>
        );
      })}
    </>
  );
}
