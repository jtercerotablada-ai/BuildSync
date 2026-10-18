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

/* Brand marks from Simple Icons (CC0), one colour, drawn in the footer's own
   ink. */
const ICON: Record<'linkedin' | 'facebook' | 'instagram', string> = {
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  instagram:
    'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  facebook:
    'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
};

export function SiteFooter() {
  const c = useContent();
  const social = [
    { href: c.contact.social.linkedin, label: c.ui.footer.linkedin, icon: ICON.linkedin },
    { href: c.contact.social.facebook, label: c.ui.footer.facebook, icon: ICON.facebook },
    { href: c.contact.social.instagram, label: c.ui.footer.instagram, icon: ICON.instagram },
  ].filter((x): x is { href: string; label: string; icon: string } => Boolean(x.href));
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
            {/* The firm's profiles as icons. Each link keeps its network's
                name as visually hidden text, so it still reads "LinkedIn"
                to a screen reader and to the link checks. */}
            {social.length ? (
              <div className="mp-footer__social">
                {social.map((s) => (
                  <a key={s.href} href={s.href} rel="noopener noreferrer" target="_blank" className="mp-footer__social-link">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                      <path d={s.icon} fill="currentColor" />
                    </svg>
                    <span className="mp-sr-only">{s.label}</span>
                  </a>
                ))}
              </div>
            ) : null}
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
