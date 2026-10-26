import React from 'react';

/**
 * The two ornaments of the upper half of the home page. Both are glyphs, not
 * drawings: one stroke, `aria-hidden`, never the link itself.
 *
 *   Diamond  the gold ◆ between the two counties,
 *            the ribbon's sides and the track tag of a service card. Drawn
 *            in CSS (a rotated square, `.h-dia`), not typed: Geist Mono has
 *            no U+25C6, so a typed one came from whichever fallback font the
 *            visitor's system picked, at whatever size and weight.
 *   Arrow    the right arrow of the hero button and the text links, and the
 *            up-right one in the ring at the end of a service card (turns −45°
 *            and takes the gold on hover, home.css).
 */
export function Diamond() {
  return <i className="h-dia" aria-hidden="true" />;
}

export function Arrow({ up = false }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path
        d={up ? 'M7 17 17 7M8 7h9v9' : 'M5 12h14M13 6l6 6-6 6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
