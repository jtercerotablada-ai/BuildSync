'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { htmlLang } from '@/lib/ttc/i18n';
import { useContent, useL, useLang } from './lang';

/**
 * The year the HTML was rendered in. The public pages are prerendered, so on
 * the server this is the BUILD year; in the browser it is the visitor's.
 * Module scope keeps the clock read out of render.
 */
const RENDER_YEAR = new Date().getFullYear();

/**
 * "© 2026" without a hydration mismatch.
 *
 * The static HTML freezes the build year. The first visit after 1 January
 * without a redeploy (or a UTC build on New Year's Eve, Miami time) would
 * render a different number on the client, and React 19 answers a text
 * mismatch by re-rendering the tree on the client — restarting the hero
 * video and every entrance. So the server's year is kept as-is
 * (suppressHydrationWarning, one level deep: this span only), and the
 * browser's year is written in after mount. Written to the node directly
 * because React does not patch suppressed text and a state update to the
 * value it already rendered would not touch the DOM.
 */
function CopyrightYear() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const now = String(new Date().getFullYear());
    if (ref.current && ref.current.textContent !== now) {
      ref.current.textContent = now;
    }
  }, []);
  return (
    <span ref={ref} suppressHydrationWarning>
      {RENDER_YEAR}
    </span>
  );
}

export function SiteFooter() {
  const c = useContent();
  const l = useL();
  const lang = useLang();

  return (
    // Its own `lang`: the footer renders outside es/layout.tsx's <div
    // lang="es">, and <html lang> is only corrected after hydration.
    <footer className="mp-footer" lang={htmlLang[lang]}>
      <div className="mp-shell">
        <div className="mp-footer__top">
          <div>
            <div className="mp-footer__brand-logo">
              {/* The 640px straight resize of the real white lockup (shown
                  44–60px tall ≈ 158px wide, so ≥4x), lazy because it sits at
                  the very bottom of every page and would otherwise be
                  preloaded ahead of the hero. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.company.logo.lockupLightSm}
                alt={c.company.legalName}
                width={c.company.logo.lockupSmSize.w}
                height={c.company.logo.lockupSmSize.h}
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="mp-footer__tag">{c.company.description}</p>
            <p className="mp-footer__pe">
              <span className="mp-footer__pe-mark" aria-hidden="true">
                P.E.
              </span>
              <span>
                {c.leadership.credential}
                {c.company.registry ? (
                  <>
                    <br />
                    <span className="mp-footer__reg">{c.company.registry}</span>
                  </>
                ) : null}
              </span>
            </p>
          </div>

          {/* Column titles are labels, not headings: as h2s they added
              "Navigate", "Services" and "Contact" to the outline of every
              page — /privacy ended up with two h2s named "Contact". */}
          <div className="mp-footer__cols">
            {c.footerNav.map((group) => (
              <div className="mp-footer__col" key={group.title}>
                <p className="mp-footer__title">{group.title}</p>
                {group.items.map((item) => (
                  <Link key={item.href} href={l(item.href)}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}

            <div className="mp-footer__col">
              <p className="mp-footer__title">{c.ui.footer.services}</p>
              {c.services.map((s) => (
                <Link key={s.slug} href={l(`/services/${s.slug}`)}>
                  {s.shortTitle}
                </Link>
              ))}
            </div>

            <div className="mp-footer__col">
              <p className="mp-footer__title">{c.ui.footer.contact}</p>
              <a href={`mailto:${c.contact.email}`}>{c.contact.email}</a>
              {c.contact.phone ? (
                <a href={c.contact.phone.href}>{c.contact.phone.display}</a>
              ) : null}
              {c.contact.address ? (
                <span>
                  {c.contact.address.line1}
                  {c.contact.address.line2 ? `, ${c.contact.address.line2}` : ''}
                  {`, ${c.contact.address.city}, ${c.contact.address.state} ${c.contact.address.zip}`}
                </span>
              ) : null}
              <span>{c.contact.serviceAreaLabel}</span>
              {c.contact.social.linkedin ? (
                <a
                  href={c.contact.social.linkedin}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {c.ui.footer.linkedin}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mp-footer__notice">{c.legal.notice}</p>

        <div className="mp-footer__bottom">
          <span>
            © <CopyrightYear /> {c.company.legalName}
          </span>
          <div className="mp-footer__legal">
            {c.legal.links.map((lk) => (
              <Link
                key={lk.href}
                href={lk.href === '/credits' ? lk.href : l(lk.href)}
              >
                {lk.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
