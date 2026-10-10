'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  altPath,
  hasTranslation,
  htmlLang,
  localePath,
  stripLang,
} from '@/lib/ttc/i18n';
import { refreshSearch, useCarriedHash, useContent, useLang, useSearch } from './lang';

/** How long the menu's entrance has to have been on screen for a close to
 *  be worth an exit (the panel is about nine tenths in by then). */
const ENTRANCE_SHOWN_MS = 100;

/** The burger shows at ≤1180px (mp.css); the menu has no reason to exist past it. */
const MENU_MQ = '(max-width: 1180px)';

/**
 * Header state is deliberately NOT React state.
 *
 * Whether the header is transparent (over a dark hero) or solid is answered in
 * CSS — `body:has([data-mp-dark-hero]) .mp-header:not(.is-stuck)`. That means
 * the correct appearance is present on the very first paint, survives a
 * JS-disabled visit, and needs no per-route allow-list.
 *
 * JavaScript contributes exactly three class toggles, all written straight to
 * the DOM through a ref:
 *   .is-floating   — the page has moved at all, so something is now sliding
 *                    under the header and it needs a backing
 *   .is-stuck      — we have scrolled past the dark hero
 *   .is-menu-open  — the mobile menu is covering the page
 *
 * The three states swap in ONE frame — the bar colour, the text colour and
 * the logo (which flips via `display`, and cannot fade) — so there is no
 * moment where a dark mark sits on a still-dark bar, or page content shows
 * through a half-faded backing. That is a CSS decision (no background/color
 * transition on .mp-header); nothing here times it.
 *
 * The menu's entrance and exit are CSS as well (mp.css, "Mobile menu"). They
 * were Motion's `AnimatePresence`, which put the whole animation library in
 * the script every page loads before it can paint — for a panel most visits
 * never open. The one thing CSS cannot do alone is keep an element in the
 * DOM while it animates OUT, so `closing` holds the panel there until its
 * exit has played.
 *
 * Every piece of chrome carries its own `lang`. That dates from when one
 * root layout printed <html lang="en"> for every page and es/layout.tsx
 * marked the page body only, so the skip link, header and menu had to say
 * "es" themselves in the server HTML. The Spanish root layout says it for
 * the whole document now; these stay, and agree with it.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const lang = useLang();
  const c = useContent();
  const search = useSearch();
  const carried = useCarriedHash();
  const [open, setOpen] = useState(false);
  /* The panel is leaving: still in the DOM, playing `mp-menu-out`. Set and
     cleared during render from `open`, like the route rule below, so every
     way of closing — the burger, a link, Escape, a wider window, a route
     change — gets the exit without having to ask for it. */
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (wasOpen !== open) {
    setWasOpen(open);
    setClosing(!open);
  }
  const headerRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /* When a frame first showed the open panel; null until one has. */
  const shownAt = useRef<number | null>(null);

  /* Close the menu when the route changes — adjusted during render rather than
     in an effect, so there is no extra commit. */
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (open) setOpen(false);
  }

  /* …and on ANY link activation inside the header or the menu. The route
     rule above cannot see a link to the page already on screen (the menu's
     "About" on /about, its CTA on /contact, the logo on /): the pathname does
     not change, so the menu used to stay open with scrolling locked and the
     tap looked dead. One delegated handler covers every link, present and
     future — nav, CTA, language switch, mail.
     A same-page link closes the menu without navigating, so the link that
     held focus disappears with it and focus would fall to <body>; it goes
     back to the burger instead, as Escape does. */
  const closeOnLink = useCallback(
    (e: React.MouseEvent) => {
      const a = (e.target as Element).closest('a');
      if (!a) return;
      if (open && a.origin === window.location.origin && a.pathname === window.location.pathname) {
        requestAnimationFrame(() => burgerRef.current?.focus());
      }
      setOpen(false);
    },
    [open],
  );

  /* Skip link. Handled here rather than left to the browser: a native "#main"
     jump pushes a history entry that carries no App Router state, and Back
     from the next page then lands on it — Next ignores a null-state popstate,
     so the address bar says /privacy#main while the page still shows /terms.
     Focus moves into <main> (tabIndex -1, SiteChrome), so the next Tab
     continues from the content; no history entry is written. Without
     JavaScript the plain href still works. smooth-scroll.tsx leaves this
     link alone. */
  const skipToMain = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById('main');
    if (!main) return;
    e.preventDefault();
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: 'start' });
  }, []);

  /* ── observe the dark hero and mark the header stuck once it is gone ───── */
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const sentinel = document.querySelector('[data-mp-dark-hero]');
    if (!sentinel) {
      header.classList.remove('is-stuck');
      return;
    }
    // The sentinel marks the BOTTOM edge of the dark hero; the test is "has
    // that edge risen above the header?", not `isIntersecting`.
    const update = (rect: DOMRectReadOnly | DOMRect) => {
      header.classList.toggle('is-stuck', rect.top <= header.offsetHeight);
      header.classList.toggle('is-floating', window.scrollY > 4);
    };
    const io = new IntersectionObserver(
      ([entry]) => update(entry.boundingClientRect),
      { threshold: 0 },
    );
    io.observe(sentinel);
    update(sentinel.getBoundingClientRect());
    const onScroll = () => update(sentinel.getBoundingClientRect());
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      header.classList.remove('is-floating');
    };
  }, [pathname]);

  /* ── menu: appearance, scroll lock, inert page, focus cycle ───────────────
     The menu is a DISCLOSURE, not a modal dialog. It used to be
     role=dialog + aria-modal, but its only close control — the burger — lives
     in <header>, outside the dialog: aria-modal hid it from VoiceOver/NVDA
     and the Tab trap never reached it. Now the page behind is blocked the
     modern way, by `inert` on <main> and <footer>, while the header (with
     its close button) stays live. */
  useEffect(() => {
    const header = headerRef.current;
    header?.classList.toggle('is-menu-open', open);
    if (!open) return;

    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    const lenis = (
      window as unknown as {
        __ttcLenis?: { stop: () => void; start: () => void };
      }
    ).__ttcLenis;
    lenis?.stop();

    // Only elements this effect inerted are released again, so an element
    // that was already inert for some other reason stays that way.
    const inerted: HTMLElement[] = [];
    document
      .querySelectorAll<HTMLElement>('#main, .mp-footer')
      .forEach((el) => {
        if (el.hasAttribute('inert')) return;
        el.setAttribute('inert', '');
        inerted.push(el);
      });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        burgerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !menuRef.current) return;
      // The cycle is the close button, then the menu. DOM order already runs
      // burger → menu (the menu is the header's next sibling), so only the
      // two ends need wrapping.
      const focusables = [
        burgerRef.current,
        ...menuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ),
      ].filter((el): el is HTMLElement => !!el);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      // Focus outside the cycle (a click on bare menu background drops it on
      // <body>) re-enters at the nearest end.
      const active = document.activeElement as HTMLElement | null;
      const outside = !active || !focusables.includes(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    }, 60);

    // Rotating a tablet or widening the window past the breakpoint hides the
    // burger; a menu left open there would cover the page with no visible way
    // out and the scroll still locked.
    const mq = window.matchMedia(MENU_MQ);
    const onMq = () => {
      if (!mq.matches) setOpen(false);
    };
    mq.addEventListener('change', onMq);
    onMq();

    return () => {
      root.style.overflow = prevOverflow;
      // Read again, not the one captured above: the smooth-scroll library
      // loads after the page does, and may have arrived (and stopped itself,
      // seeing the menu open) since.
      (
        window as unknown as { __ttcLenis?: { start: () => void } }
      ).__ttcLenis?.start();
      inerted.forEach((el) => el.removeAttribute('inert'));
      document.removeEventListener('keydown', onKeyDown);
      mq.removeEventListener('change', onMq);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    shownAt.current = null;
    const frame = requestAnimationFrame(() => {
      shownAt.current = performance.now();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  /* A close that lands before the entrance has really shown — a double tap,
     a slow phone that had not drawn the panel yet — gets no exit.
     `mp-menu-out` starts from the fully open panel, so playing it then would
     flash the whole menu in just to fade it away; Motion faded from wherever
     the entrance had got to, which that early is next to nothing. Decided
     before the browser paints, so the closing panel is never seen. */
  useLayoutEffect(() => {
    if (!closing) return;
    const shown = shownAt.current;
    if (shown === null || performance.now() - shown < ENTRANCE_SHOWN_MS) {
      setClosing(false);
    }
  }, [closing]);

  /* The exit normally ends on `animationend` (below). This is for the day it
     does not fire — a tab in the background, an animation switched off by a
     rule this file does not know about: the panel must not stay in the DOM,
     invisible, over the page. */
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setClosing(false), 400);
    return () => window.clearTimeout(timer);
  }, [closing]);

  const canonical = stripLang(pathname);
  const isActive = useCallback(
    (href: string) =>
      href === '/'
        ? canonical === '/'
        : canonical === href || canonical.startsWith(`${href}/`),
    [canonical],
  );

  const l = (href: string) => localePath(href, lang);
  // The twin page WITH the query string of the page on screen: the pathname
  // alone dropped `?service=`, so a form opened for a county's notice came
  // back empty after the switch. `search` is '' on the server and while
  // hydrating, so the static HTML carries the plain twin path (see
  // useSearch).
  // …and with the case a calculator keeps after the `#` (useCarriedHash): the
  // switch used to open the twin calculator on the example beam.
  const other = altPath(pathname, search) + carried;
  const otherLang = lang === 'en' ? 'es' : 'en';
  const langAttr = htmlLang[lang];
  const logo = c.company.logo;

  // The header and the phone menu list the pages a visitor is looking for.
  // An item flagged `inHeader: false` in site.ts stays in `primaryNav` (the
  // views read that list by position) and in the footer, and is left out
  // here.
  const headerNav = c.primaryNav.filter((item) => item.inHeader !== false);

  // The switch is the NAME of the other language, in that language
  // ("Español" on an English page), not a two-letter code: "ES" at 12px was
  // the only way to the Spanish site from an English page, and a reader who
  // did not take it for a language switch had none. The visible word is the
  // whole accessible name, so "click Español" works for voice control (WCAG
  // 2.5.3) and no tooltip has to explain it; `lang` makes a screen reader
  // pronounce it in its own language.
  // On an English-only page there is nothing to switch TO, so the other label
  // is rendered inert rather than as a link to a route that does not exist;
  // the inert variant says why it is inert instead of a no-op aria-disabled
  // on a span.
  const translated = hasTranslation(pathname);
  const otherLabel = c.ui.language[otherLang];
  const otherLink = translated ? (
    <Link
      href={other}
      hrefLang={otherLang}
      lang={otherLang}
      // The query may have changed without the pathname (see refreshSearch).
      onPointerDown={refreshSearch}
      onFocus={refreshSearch}
    >
      {otherLabel}
    </Link>
  ) : (
    <span className="mp-lang__off">
      {otherLabel}
      <span className="mp-sr-only"> — {c.ui.language.unavailable}</span>
    </span>
  );
  const langSwitch = (
    <div className="mp-lang" role="group" aria-label={c.ui.language.label}>
      <span aria-current="true">{c.ui.language[lang]}</span>
      <span className="mp-lang__sep" aria-hidden="true">
        /
      </span>
      {otherLink}
    </div>
  );

  return (
    <>
      <a
        className="mp-skip"
        href="#main"
        lang={langAttr}
        onClick={skipToMain}
      >
        {c.ui.skipToContent}
      </a>
      <header
        className="mp-header"
        ref={headerRef}
        lang={langAttr}
        onClick={closeOnLink}
      >
        <div className="mp-header__inner">
          <Link
            href={l('/')}
            className="mp-header__logo"
            aria-label={`${c.company.name} — ${c.ui.home}`}
          >
            {/* The real square monogram, swapped by header state: dark mark on
                the light header, white mark over a dark hero. Both are the
                masters resized to 144px and stored as lossless WebP (a
                32–54px slot, so ≥2.6x) — 10 + 7 kB where the 256px PNGs were
                32 + 21 kB. Both stay eager, because the hidden one is swapped
                in on scroll; but the dark mark is the hidden one at the top
                of every page (they all open on a dark hero), and React
                preloads any eager image that is not `fetchPriority="low"`:
                the two used to share the connection with the hero photo. Low
                priority drops that preload and lets it load behind the page.
                The PNG masters stay for JSON-LD, the app and email.

                Both carry the firm's name as their alt: a crawler reads an
                image link by its alt, and with two empty ones the link home
                had no text at all. Both stay `aria-hidden` — the link is
                already named by its `aria-label`, and one of the two marks is
                always the hidden copy — so a screen reader still hears the
                name once. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo.markDarkXs}
              alt={c.company.name}
              width={logo.markXsSize.w}
              height={logo.markXsSize.h}
              fetchPriority="low"
              className="mp-header__lockup mp-header__lockup--dark"
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo.markLightXs}
              alt={c.company.name}
              width={logo.markXsSize.w}
              height={logo.markXsSize.h}
              className="mp-header__lockup mp-header__lockup--light"
              aria-hidden="true"
            />
          </Link>

          <nav className="mp-header__nav" aria-label={c.ui.primaryNavLabel}>
            {headerNav.map((item) => (
              <Link
                key={item.href}
                href={l(item.href)}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mp-header__actions">
            <div className="mp-header__lang">{langSwitch}</div>
            {/* ≤1180px, where the full switch above is hidden: just the other
                language by name, one tap from any page, for the
                Spanish-speaking owner who lands on an English page from
                search. CSS shows it only at that width, with a 44px hit area,
                and hides it while the menu (which has its own switch) is
                open. */}
            <div className="mp-lang mp-header__lang-compact">{otherLink}</div>
            <Link
              href={l(c.primaryCta.href)}
              className="mp-btn mp-btn--solid mp-header__cta"
            >
              <span>{c.primaryCta.label}</span>
            </Link>
            <button
              ref={burgerRef}
              type="button"
              className="mp-burger"
              aria-expanded={open}
              // Only while the menu exists, so the IDREF always resolves.
              aria-controls={open ? 'mp-mobile-menu' : undefined}
              aria-label={open ? c.ui.closeMenu : c.ui.openMenu}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="mp-burger__box" aria-hidden="true">
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
      </header>

      {open || closing ? (
        <div
          id="mp-mobile-menu"
          ref={menuRef}
          className={open ? 'mp-menu' : 'mp-menu is-closing'}
          data-lenis-prevent=""
          // A named region, not a dialog: see the menu effect above.
          role="region"
          aria-label={c.ui.siteMenu}
          lang={langAttr}
          // On its way out it is no longer the menu: nothing in it can be
          // reached, and the burger no longer points at it.
          inert={open ? undefined : true}
          onClick={closeOnLink}
          onAnimationEnd={(e) => {
            // The panel's own exit, not a link's entrance bubbling up.
            if (e.target === e.currentTarget && !open) setClosing(false);
          }}
        >
          <nav className="mp-menu__nav" aria-label={c.ui.primaryNavLabel}>
            {headerNav.map((item, i) => (
              <span
                key={item.href}
                className="mp-menu__item"
                // 40 ms apart, the first after 40 ms (mp.css has the rest).
                style={{ animationDelay: `${40 + i * 40}ms` }}
              >
                <Link
                  href={l(item.href)}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  <span className="mp-menu__n" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>

          <div className="mp-menu__foot">
            <Link href={l(c.primaryCta.href)} className="mp-btn mp-btn--solid">
              <span>{c.primaryCta.label}</span>
              <span className="mp-btn__arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <div className="mp-menu__lang">{langSwitch}</div>
            <a className="mp-menu__mail" href={`mailto:${c.contact.email}`}>
              {c.contact.email}
            </a>
            <span className="mp-menu__mail" style={{ opacity: 0.7 }}>
              {c.contact.serviceAreaLabel}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
