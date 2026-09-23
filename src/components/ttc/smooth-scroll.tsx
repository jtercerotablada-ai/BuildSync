'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Lenis smooth scroll — scoped to the public marketing layout only.
 * Lenis drives the native scroll position, so the existing scroll-progress
 * bar and parallax in FxElements (which read window.scrollY) keep working.
 * Disabled entirely for users who prefer reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

    // Exposed so UI that must freeze the page (the mobile menu) can pause it.
    (window as unknown as { __ttcLenis?: Lenis }).__ttcLenis = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    // In-page anchor links (e.g. hero → #services) scroll smoothly too.
    //
    // Taking over a click means taking over everything the browser would have
    // done with it, not just the scroll: the target gets focus (so the next
    // Tab continues from THERE, not from the top of the header) and the URL
    // gets the hash. The skip link is not ours — SiteHeader handles it (an
    // instant jump is the point for a keyboard user). This handler used to
    // swallow it: preventDefault, a smooth scroll, focus still on the link,
    // no hash, and the next Tab back on the logo.
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const a = (e.target as HTMLElement)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a || a.classList.contains('mp-skip')) return;
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      // getElementById, not querySelector: a fragment like "#2024" is a valid
      // id but an invalid selector, and querySelector would throw.
      let el: HTMLElement | null = null;
      try {
        el = document.getElementById(decodeURIComponent(id.slice(1)));
      } catch {
        return;
      }
      if (!el) return;
      e.preventDefault();
      // No offset here: mp.css sets `scroll-padding-top` on <html> to the
      // header height (+12px) at every breakpoint, and Lenis 1.3 subtracts the
      // container's scroll-padding (and the target's scroll-margin) itself
      // when handed an element. Passing the header height again would land
      // every anchor one header too low.
      lenis.scrollTo(el);
      if (!el.matches('a[href], button, input, select, textarea, [tabindex]')) {
        el.setAttribute('tabindex', '-1');
      }
      el.focus({ preventScroll: true });
      // history.state is passed through untouched so the entry keeps the App
      // Router's state: a native hash jump would push a state-less entry, and
      // Next ignores a popstate without state, so Back onto it would change
      // the URL and leave the previous page on screen. Replace, not push.
      history.replaceState(history.state, '', id);
    };
    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('click', onClick);
      cancelAnimationFrame(rafId);
      lenis.destroy();
      delete (window as unknown as { __ttcLenis?: Lenis }).__ttcLenis;
    };
  }, []);

  return null;
}
