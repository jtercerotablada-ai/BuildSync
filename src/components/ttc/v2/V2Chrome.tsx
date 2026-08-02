'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: [string, string][] = [
  ['/projects', 'Projects'],
  ['/services', 'Services'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
];

export function V2Chrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', h, { passive: true });
    h();
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => { setOpen(false); }, [path]);

  const isActive = (href: string) => href === '/' ? path === '/' : path.startsWith(href);

  return (
    <>
      <header className={`v2h${scrolled ? ' is-scrolled' : ''}`}>
        <div className="v2h__inner">
          <Link href="/" className="v2h__logo" aria-label="Tercero Tablada — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ttc/img/logo-square.png" alt="" className="v2h__mark-img" aria-hidden="true" />
            <span className="v2h__name">Tercero Tablada</span>
            <span className="v2h__sub">Civil &amp; Structural Engineering</span>
          </Link>

          <nav className="v2h__nav" aria-label="Primary">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className={isActive(href) ? 'is-active' : ''}>{label}</Link>
            ))}
          </nav>

          <div className="v2h__right">
            <span className="v2h__lang"><b>EN</b><i>/</i>ES</span>
            <Link href="/contact" className="v2h__cta"><span>Consultation</span><i>→</i></Link>
            <button className={`v2h__burger${open ? ' is-open' : ''}`} onClick={() => setOpen(!open)} aria-label="Menu"><span /><span /></button>
          </div>
        </div>

        <div className={`v2h__mobile${open ? ' is-open' : ''}`}>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={isActive(href) ? 'is-active' : ''}>{label}</Link>
          ))}
          <Link href="/contact" className="v2h__mobile-cta">Request a Consultation →</Link>
        </div>
      </header>

      <main>{children}</main>

      <footer className="v2f">
        <div className="v2-shell">
          <div className="v2f__top">
            <div className="v2f__brand">
              <span className="v2f__logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ttc/img/logo-square.png" alt="" className="v2f__logo-img" aria-hidden="true" />
                Tercero Tablada
              </span>
              <p className="v2f__tag">Structural engineering for buildings that endure — reinforced concrete, BIM,
                recertification and building-safety inspection across South Florida.</p>
              <p className="v2f__pe">Registered P.E. / S.E.</p>
            </div>

            <div className="v2f__cols">
              <div className="v2f__col">
                <h4>Navigate</h4>
                {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
              </div>
              <div className="v2f__col">
                <h4>Services</h4>
                <Link href="/services">Reinforced Concrete</Link>
                <Link href="/services">BIM / Methodology</Link>
                <Link href="/services">Recertification</Link>
                <Link href="/services">Safety Inspection</Link>
              </div>
              <div className="v2f__col">
                <h4>Contact</h4>
                <a href="mailto:info@tercerotablada.com">info@tercerotablada.com</a>
                <span className="v2f__muted">Miami-Dade &amp; Broward, FL</span>
              </div>
            </div>
          </div>
          <div className="v2f__bottom">
            <span>© {new Date().getFullYear()} Tercero Tablada Civil &amp; Structural Engineering Inc.</span>
            <span className="v2-mono">ACI 318 · FBC · ISO 19650</span>
          </div>
        </div>
      </footer>
    </>
  );
}
