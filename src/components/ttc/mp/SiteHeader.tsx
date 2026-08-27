'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { company, contact, primaryNav, primaryCta } from '@/lib/ttc/site';
import { EASE } from './primitives';

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
  const pathname = usePathname();
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

    // The sentinel marks the BOTTOM edge of the dark hero, and the test is
    // "has that edge risen above the header?" — not `isIntersecting`.
    // isIntersecting is false in two opposite situations: the hero bottom is
    // still below the fold (header should be transparent) and the hero has
    // scrolled away entirely (header should be solid). On a viewport shorter
    // than the hero — every phone — the first case is the one at page load,
    // which made the header go solid over the dark hero. Reading the edge
    // position tells the two apart.
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

    // IntersectionObserver only fires on threshold crossings; the floating
    // state changes on the very first pixel of scroll, so it needs the
    // listener regardless.
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
    // Lenis drives the window scroll; pause it so the overlay cannot scroll
    // the page underneath on wheel or touch.
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

  const isActive = useCallback(
    (href: string) =>
      href === '/'
        ? pathname === '/'
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );

  return (
    <>
      <header className="mp-header" ref={headerRef}>
        <div className="mp-header__inner">
          <Link
            href="/"
            className="mp-header__logo"
            aria-label={`${company.name} — home`}
          >
            {/* Compact square monogram (no wordmark) — the two are swapped by
                header state: the dark mark on the light/stuck header, the white
                mark on the dark hero. (.mp-header__lockup keeps its name; it
                now carries the mark, not the horizontal lockup.) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={company.logo.dark}
              alt=""
              width={company.logo.markSize.w}
              height={company.logo.markSize.h}
              className="mp-header__lockup mp-header__lockup--dark"
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={company.logo.light}
              alt=""
              width={company.logo.markSize.w}
              height={company.logo.markSize.h}
              className="mp-header__lockup mp-header__lockup--light"
              aria-hidden="true"
            />
          </Link>

          <nav className="mp-header__nav" aria-label="Primary">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mp-header__actions">
            <Link
              href={primaryCta.href}
              className="mp-btn mp-btn--solid mp-header__cta"
            >
              <span>{primaryCta.label}</span>
            </Link>
            <button
              ref={burgerRef}
              type="button"
              className="mp-burger"
              aria-expanded={open}
              aria-controls="mp-mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
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
            aria-label="Site menu"
            initial={reduce ? false : { opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <nav className="mp-menu__nav" aria-label="Primary">
              {primaryNav.map((item, i) => (
                <motion.span
                  key={item.href}
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.42,
                    ease: EASE,
                    delay: 0.06 + i * 0.045,
                  }}
                  style={{ display: 'block' }}
                >
                  <Link
                    href={item.href}
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
              <Link href={primaryCta.href} className="mp-btn mp-btn--solid">
                <span>{primaryCta.label}</span>
                <span className="mp-btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
              <a className="mp-menu__mail" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
              <span className="mp-menu__mail" style={{ opacity: 0.7 }}>
                {contact.serviceAreaLabel}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
