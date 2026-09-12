'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { altPath, hasTranslation, localePath, stripLang } from '@/lib/ttc/i18n';
import { EASE } from './primitives';
import { useContent, useLang } from './lang';

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

  /* ── menu: appearance, scroll lock, focus trap ────────────────────────── */
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        burgerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !menuRef.current) return;
      const focusables = menuRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    }, 60);

    return () => {
      root.style.overflow = prevOverflow;
      lenis?.start();
      document.removeEventListener('keydown', onKeyDown);
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

  // On an English-only page there is nothing to switch TO, so the other label
  // is rendered inert rather than as a link to a route that does not exist.
  const translated = hasTranslation(pathname);
  const langSwitch = (
    <div className="mp-lang" role="group" aria-label={c.ui.language.label}>
      <span aria-current="true">{c.ui.language[lang]}</span>
      <span className="mp-lang__sep" aria-hidden="true">
        /
      </span>
      {translated ? (
        <Link
          href={other}
          hrefLang={otherLang}
          lang={otherLang}
          title={c.ui.language.switchTo}
          aria-label={c.ui.language.switchTo}
        >
          {c.ui.language[otherLang]}
        </Link>
      ) : (
        <span className="mp-lang__off" aria-disabled="true">
          {c.ui.language[otherLang]}
        </span>
      )}
    </div>
  );

  return (
    <>
      <a className="mp-skip" href="#main">
        {c.ui.skipToContent}
      </a>
      <header className="mp-header" ref={headerRef}>
        <div className="mp-header__inner">
          <Link
            href={l('/')}
            className="mp-header__logo"
            aria-label={`${c.company.name} — ${c.ui.home}`}
          >
            {/* The real square monogram, swapped by header state: dark mark on
                the light header, white mark over a dark hero. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.company.logo.dark}
              alt=""
              width={c.company.logo.markSize.w}
              height={c.company.logo.markSize.h}
              className="mp-header__lockup mp-header__lockup--dark"
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.company.logo.light}
              alt=""
              width={c.company.logo.markSize.w}
              height={c.company.logo.markSize.h}
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
              aria-controls="mp-mobile-menu"
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
            role="dialog"
            aria-modal="true"
            aria-label={c.ui.siteMenu}
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
