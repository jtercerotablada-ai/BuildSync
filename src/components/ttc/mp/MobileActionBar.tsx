'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContent, useL } from './lang';
import { whatsappHref } from './ReachRow';

/**
 * Phones only: Call · WhatsApp · Send the notice, fixed to the bottom of the
 * screen once the visitor has scrolled past the first screen.
 *
 * Why it exists: on a phone the first way to reach the firm used to be three
 * to four screens down the two program pages, and the visitor those pages are
 * written for is holding a county notice with a deadline. The bar keeps one
 * tap away from wherever they stopped reading.
 *
 * Why it waits for a scroll: the first screen already carries its own
 * buttons, and a bar over the hero would cover the strip of links under it.
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
  const wa = whatsappHref(c);
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
      <Link className="mp-bar__item mp-bar__item--main" href={l('/contact')}>
        {r.form}
      </Link>
    </nav>
  );
}
