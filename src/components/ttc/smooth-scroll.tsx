'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type Lenis from 'lenis';

/**
 * Lenis smooth scroll — scoped to the public marketing layout only.
 * Lenis drives the native scroll position, so the existing scroll-progress
 * bar and parallax in FxElements (which read window.scrollY) keep working.
 * Disabled entirely for users who prefer reduced motion.
 *
 * THE LIBRARY IS FETCHED AFTER THE PAGE HAS LOADED, in an idle moment — the
 * way the hero's video is (media.tsx). Nobody scrolls smoothly before the
 * page is on screen, and a script that arrives before the first paint is
 * counted against it. Until it arrives the wheel scrolls natively and an
 * in-page link is still ours: the click handler below is installed at once
 * and uses the browser's own scroll in the meantime, so the focus and the
 * history rules it exists for hold from the first click.
 *
 * A NEW PAGE OPENS AT ITS TOP (2026-10-27, the owner: "cuando entro a una
 * página aparezco abajo… debe aparecer en la parte de arriba siempre").
 * Lenis animates toward the position it was last sent to, frame after
 * frame. A link clicked while the page was still gliding — a trackpad, a
 * flick on a phone — left that animation running: Next scrolled the new
 * page to its top and the next frame of the glide put it back down, at
 * the old page's depth (measured: 5,000–6,500px down). So a click on a link
 * to another page stops the glide first (`halt`), and when the page has
 * changed by a link (not by Back or Forward, which put the reader back
 * where they were, and not to a #place, which the browser lands on) the
 * page is put at its top, Lenis with it.
 */
/* Stop a glide where the page is: the public form of Lenis's own reset (an
   immediate scroll to the current position halts the animation). */
const halt = (lenis: Lenis) => lenis.scrollTo(window.scrollY, { immediate: true, force: true });

export function SmoothScroll() {
  const pathname = usePathname();
  // The instance, for the route effect below; null until it has loaded.
  const lenisRef = useRef<Lenis | null>(null);
  // Set by Back/Forward: that page keeps the place the browser restores.
  const traversing = useRef(false);
  const firstPath = useRef(true);

  useEffect(() => {
    const onPop = () => {
      traversing.current = true;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    // Back/Forward and a #place are the browser's and the router's to land:
    // touching Lenis here, while they were still placing the page, left a
    // link to "#the-package" 540px short of it. The glide was stopped at the
    // click already.
    if (traversing.current) {
      traversing.current = false;
      return;
    }
    if (window.location.hash.length > 1) return;
    const lenis = lenisRef.current;
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let lenis: Lenis | null = null;
    let rafId = 0;
    let cancelled = false;
    let idleId: number | undefined;
    let timer: number | undefined;

    const start = () => {
      void import('lenis')
        .then(({ default: LenisClass }) => {
          if (cancelled) return;
          lenis = new LenisClass({
            duration: 1.1,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            touchMultiplier: 1.6,
          });

          // Exposed so UI that must freeze the page (the mobile menu) can
          // pause it — and if that menu is already open, start out paused:
          // SiteHeader resumes whatever is there when the menu closes.
          (window as unknown as { __ttcLenis?: Lenis }).__ttcLenis = lenis;
          lenisRef.current = lenis;
          if (document.querySelector('.mp-header.is-menu-open')) lenis.stop();

          const raf = (time: number) => {
            lenis?.raf(time);
            rafId = requestAnimationFrame(raf);
          };
          rafId = requestAnimationFrame(raf);
        })
        // No library, no smooth scroll: the page scrolls natively.
        .catch(() => {});
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(start, { timeout: 2000 });
      } else {
        timer = window.setTimeout(start, 300);
      }
    };
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });

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
      // A link to another page of the site: the glide stops here, before
      // the router scrolls the new page to its top (see above).
      const link = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (
        lenis &&
        link &&
        !link.target &&
        !link.hasAttribute('download') &&
        link.origin === window.location.origin &&
        link.pathname !== window.location.pathname
      ) {
        halt(lenis);
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
      // every anchor one header too low. Before the library has arrived, the
      // browser's own scroll honours the same padding.
      //
      // Lenis measures the target from the position it last heard of, which a
      // scroll event brings it. A link that was brought into view and
      // activated in the same frame — a screen reader does both at once —
      // was measured from a stale position and landed short by exactly that
      // scroll (a phone at 390px: 560–650px short of "Questions"). So when
      // Lenis is not mid-animation and is behind the page, it is told where
      // the page is first.
      if (lenis) {
        if (lenis.isScrolling !== 'smooth' && Math.abs(lenis.animatedScroll - window.scrollY) >= 1) {
          lenis.scrollTo(window.scrollY, { immediate: true });
        }
        lenis.scrollTo(el);
      } else el.scrollIntoView({ block: 'start' });
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
      cancelled = true;
      window.removeEventListener('load', whenIdle);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('click', onClick);
      cancelAnimationFrame(rafId);
      lenis?.destroy();
      lenisRef.current = null;
      delete (window as unknown as { __ttcLenis?: Lenis }).__ttcLenis;
    };
  }, []);

  return null;
}
