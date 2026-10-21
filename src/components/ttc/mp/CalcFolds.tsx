'use client';

import { useEffect } from 'react';

/**
 * The calculators catalogue on a phone or a narrow tablet (900px and less):
 * the subjects with no open calculator start folded to their header — the
 * owner's icon, the name and the count — so the reader meets the open ones
 * and seventeen short headers, not ninety rows nobody can use yet.
 *
 * The server sends every block OPEN (CalculatorsView): a crawler, a reader
 * without script and every desktop see all the rows, and the text is in the
 * HTML either way. This only closes, after the first paint, the blocks that
 * are BELOW the screen — closing one above it, or on it, would move the page
 * under the reader, and a #subject landing would lose its place.
 *
 * Wider than 900px the two-column ledger never folds (mp.css makes the count
 * a plain label there): a block closing inside CSS columns re-balances both,
 * and the families would jump across. So the summary leaves the Tab order,
 * and a block a screen reader closes opens again.
 *
 * Reads no catalogue text — it lives in the server's HTML only
 * (calculators.ts). Renders nothing.
 */
const NARROW = '(max-width: 900px)';

export function CalcFolds() {
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const all = () => [...document.querySelectorAll<HTMLDetailsElement>('.mp-calc > details.mp-calc__fold')];
    const target = () => {
      try {
        return decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return '';
      }
    };
    const openFor = (id: string) => {
      if (!id) return;
      const d = document.getElementById(id)?.querySelector<HTMLDetailsElement>(':scope > details.mp-calc__fold');
      if (d) d.open = true;
    };
    const setMode = () => {
      for (const d of all()) {
        const summary = d.querySelector<HTMLElement>(':scope > summary');
        if (mq.matches) summary?.removeAttribute('tabindex');
        else {
          if (summary) summary.tabIndex = -1;
          d.open = true;
        }
      }
    };

    if (mq.matches) {
      const landing = target();
      for (const d of all()) {
        const block = d.parentElement;
        if (d.dataset.calcFold !== 'planned' || !block || block.id === landing) continue;
        if (block.getBoundingClientRect().top > window.innerHeight) d.open = false;
      }
    }
    setMode();

    // Wide, every block stays open, whoever closed it.
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (!mq.matches && d.matches?.('.mp-calc__fold') && !d.open) d.open = true;
    };
    const onHash = () => openFor(target());
    // smooth-scroll.tsx takes over in-page links (preventDefault and
    // replaceState), so no hashchange fires for them: a link to a family
    // opens it here.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]');
      const href = a?.getAttribute('href');
      if (!href || href === '#') return;
      try {
        openFor(decodeURIComponent(href.slice(1)));
      } catch {
        /* not an id */
      }
    };
    document.addEventListener('toggle', onToggle, true);
    window.addEventListener('hashchange', onHash);
    document.addEventListener('click', onClick);
    mq.addEventListener('change', setMode);
    return () => {
      document.removeEventListener('toggle', onToggle, true);
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('click', onClick);
      mq.removeEventListener('change', setMode);
    };
  }, []);
  return null;
}
