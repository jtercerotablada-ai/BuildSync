/**
 * KEEPING THE READER'S PLACE ACROSS A PRINT. The printed sheet is a different page - every card open, the drawings at the sheet's size - and the
 * screen it goes back to is shorter than the sheet was, so the scroll position the browser keeps points somewhere else (the page came back some two
 * thousand pixels up). So before the sheet is made the element nearest the top of the screen is remembered, with how far from the top it stood, and
 * after the print it is put back there. Two pure functions; the listeners are the calculator's.
 */

/**
 * Which of the elements (their tops, in the order of the page, in pixels from the top of the screen) the screen is at: the last that has
 * reached the top (`top <= limit`: the element the reader is inside), else the first that has not. `offset` is where it stood.
 */
export function anchorFor(tops: readonly number[], limit = 8): { index: number; offset: number } | null {
  if (tops.length === 0) return null;
  let best = -1;
  for (let k = 0; k < tops.length; k++) if (tops[k] <= limit && (best < 0 || tops[k] >= tops[best])) best = k;
  if (best < 0) best = tops.reduce((m, t, k) => (t < tops[m] ? k : m), 0);
  return { index: best, offset: tops[best] };
}

/** The scroll position that puts the element back where it stood: `top` is where it is now (from the top of the screen), `offset` where it stood. */
export const scrollTarget = (scrollY: number, top: number, offset: number): number => Math.max(0, Math.round(scrollY + top - offset));
