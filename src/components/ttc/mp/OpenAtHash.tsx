'use client';

import { useEffect } from 'react';

/**
 * Opens the fold under an anchor when the page is reached at that anchor.
 *
 * The city pages link to "The package, part by part" on their county's page
 * (`#the-package`, JumpLinks `JUMP_ID.package`). The package's rows fold
 * under one line — at every width since 2026-10-27 (they were open above
 * 1180px, `mp-disclose--desk`) — so a visitor who
 * followed that link landed on a label, a sentence and a closed toggle — the
 * one thing the link promised was behind another tap. This opens the first
 * `details.mp-disclose` inside the element with that id when the address
 * carries it: on arrival (a fresh load, or Next's navigation from the city
 * page), on a hash change, and on a click of a link to it on the same page
 * (smooth-scroll.tsx takes those over, so no hashchange fires for them).
 *
 * Opening only: a reader who closes it again keeps it closed. Renders
 * nothing; the anchor and the rows are in the server's HTML either way.
 */
export function OpenAtHash({ id }: { id: string }) {
  useEffect(() => {
    const open = () => {
      document
        .getElementById(id)
        ?.querySelector<HTMLDetailsElement>('details.mp-disclose')
        ?.setAttribute('open', '');
    };
    const atHash = () => {
      try {
        if (decodeURIComponent(window.location.hash.slice(1)) === id) open();
      } catch {
        /* not an id */
      }
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]');
      const href = a?.getAttribute('href') ?? '';
      if (href === `#${id}` || href.endsWith(`#${id}`)) open();
    };
    atHash();
    window.addEventListener('hashchange', atHash);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', atHash);
      document.removeEventListener('click', onClick);
    };
  }, [id]);
  return null;
}
