'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { openCalculatorPaths } from '@/lib/ttc/calculator-paths';
import { stripLang } from '@/lib/ttc/i18n';
import { useContent, useL } from './lang';
import { whatsappHref } from './ReachRow';
import { pageHoldsNotice } from '@/lib/ttc/notice-pages';

/**
 * Phones only: Call · WhatsApp · Send the notice (or Free proposal), fixed to
 * the bottom of the screen once the visitor has scrolled past the first
 * screen.
 *
 * Why it exists: on a phone the first way to reach the firm used to be three
 * to four screens down the two program pages, and the visitor those pages are
 * written for is holding a county notice with a deadline. The bar keeps one
 * tap away from wherever they stopped reading.
 *
 * Why it waits for a scroll: the first screen already carries its own
 * buttons, and a bar over the hero would cover the strip of links under it.
 *
 * Not on a calculator either: its reader is an engineer at work, not an owner
 * with a notice, and the bar lay over the last field and the diagram being
 * read. Nor on their catalogue, /resources: the same reader, and the bar's
 * "Send the notice" and its WhatsApp line are written for an owner holding a
 * county letter. The header and the footer still carry every way to reach
 * the firm.
 *
 * Not on /contact — the form is the page — and not while the menu is open
 * (the header's `.is-menu-open` hides it in mp.css; the menu has its own
 * links). `inert` while hidden so it is out of the Tab order, not only out of
 * sight. Renders nothing until a phone number exists.
 */
export function MobileActionBar() {
  const c = useContent();
  const l = useL();
  const pathname = usePathname();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const phone = c.contact.phone;
  if (!phone) return null;
  if (/\/contact\/?$/.test(pathname)) return null;
  const canonical = stripLang(pathname).replace(/\/$/, '');
  if (canonical === '/resources' || openCalculatorPaths.some((p) => p === canonical)) return null;
  /* Where the reader holds a notice (pageHoldsNotice: the home page, the
     existing-building pages, the guides, the cost page, a county program,
     the milestone page and their city pages) the bar sends the notice.
     Elsewhere it offers the free proposal, and the WhatsApp chat opens
     without "I received a notice". A service page's button keeps its
     service chosen.

     Its own short label, not the header's "Request a Proposal": that one
     broke onto two lines in the bar's third of a 360–390px screen, and the
     header hides its button while the bar is up (mp.css, 19), so the two
     are never on screen together. */
  const svc = c.services.find((s) => canonical === `/services/${s.slug}` || canonical.startsWith(`/services/${s.slug}/`));
  const notice = pageHoldsNotice(canonical);
  const wa = whatsappHref(c, !notice);
  const r = c.reach;

  return (
    <nav
      className={`mp-bar${shown ? ' is-shown' : ''}`}
      aria-label={r.label}
      inert={!shown}
    >
      <a className="mp-bar__item" href={phone.href}>
        {r.call}
      </a>
      {wa ? (
        <a className="mp-bar__item" href={wa} target="_blank" rel="noopener noreferrer">
          {r.whatsapp}
        </a>
      ) : null}
      <Link className="mp-bar__item mp-bar__item--main" href={l(svc ? `/contact?service=${svc.slug}` : '/contact')}>
        {notice ? r.form : r.formPlain}
      </Link>
    </nav>
  );
}
