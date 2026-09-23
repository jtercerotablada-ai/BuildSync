'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  altPath,
  hasTranslation,
  htmlLang,
  localePath,
  stripLang,
} from '@/lib/ttc/i18n';
import { EASE } from './primitives';
import { useContent, useLang } from './lang';

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
 * Every piece of chrome carries its own `lang`. The root layout's <html
 * lang="en"> is shared with the app and only corrected by `LangHtml` after
 * hydration, and es/layout.tsx marks the page body only — so the skip link,
 * header and menu say "es" themselves, in the server HTML.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const lang = useLang();
  const c = useContent();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      lenis?.start();
      inerted.forEach((el) => el.removeAttribute('inert'));
      document.removeEventListener('keydown', onKeyDown);
      mq.removeEventListener('change', onMq);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const canonical = stripLang(pathname);
  const isActive = useCallback(
    (href: string) =>
      href === '/'
        ? canonical === '/'
        : canonical === href || canonical.startsWith(`${href}/`),
    [canonical],
  );

  const l = (href: string) => localePath(href, lang);
  const other = altPath(pathname);
  const otherLang = lang === 'en' ? 'es' : 'en';
  const langAttr = htmlLang[lang];
  const logo = c.company.logo;

  // On an English-only page there is nothing to switch TO, so the other label
  // is rendered inert rather than as a link to a route that does not exist.
  // Its accessible name STARTS with the visible code ("ES — Ver en español"),
  // so a voice-control user who says "click ES" hits it (WCAG 2.5.3); the
  // inert variant says why it is inert instead of a no-op aria-disabled on a
  // span.
  const translated = hasTranslation(pathname);
  const otherLabel = c.ui.language[otherLang];
  const otherLink = translated ? (
    <Link
      href={other}
      hrefLang={otherLang}
      lang={otherLang}
      title={c.ui.language.switchTo}
      aria-label={`${otherLabel} — ${c.ui.language.switchTo}`}
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
                256px straight resizes of the masters (a 36–54px slot, so ≥4x);
                both stay eager, because the hidden one is swapped in on
                scroll. The 1254px masters stay for JSON-LD, the app and email. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo.markDarkSm}
              alt=""
              width={logo.markSmSize.w}
              height={logo.markSmSize.h}
              className="mp-header__lockup mp-header__lockup--dark"
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo.markLightSm}
              alt=""
              width={logo.markSmSize.w}
              height={logo.markSmSize.h}
              className="mp-header__lockup mp-header__lockup--light"
              aria-hidden="true"
            />
          </Link>

          <nav className="mp-header__nav" aria-label={c.ui.primaryNavLabel}>
            {c.primaryNav.map((item) => (
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
                language, one tap from any page, for the Spanish-speaking owner
                who lands on an English page from search. CSS shows it only at
                that width, with a 44px hit area, and hides it while the menu
                (which has its own switch) is open. */}
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

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mp-mobile-menu"
            ref={menuRef}
            className="mp-menu"
            data-lenis-prevent=""
            // A named region, not a dialog: see the menu effect above.
            role="region"
            aria-label={c.ui.siteMenu}
            lang={langAttr}
            onClick={closeOnLink}
            initial={reduce ? false : { opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <nav className="mp-menu__nav" aria-label={c.ui.primaryNavLabel}>
              {c.primaryNav.map((item, i) => (
                <motion.span
                  key={item.href}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.36,
                    ease: EASE,
                    delay: 0.04 + i * 0.04,
                  }}
                  style={{ display: 'block' }}
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
                </motion.span>
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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
