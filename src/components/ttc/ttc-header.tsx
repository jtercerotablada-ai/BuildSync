'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslation } from './language-provider';

export function TTCHeader() {
  const { language, t, toggleLanguage } = useTranslation();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHome = pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const navLinks = [
    { href: '/projects', label: t('nav.projects') },
    { href: '/services', label: t('nav.services') },
    { href: '/about', label: t('nav.about') },
    { href: '/contact', label: t('nav.contact') },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const headerClass = ['header', scrolled && 'scrolled', !isHome && 'header--solid']
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <header className={headerClass} id="header">
        <div className="header__inner">
          <Link href="/" className="header__logo">
            <Image
              src="/ttc/img/logo-tt-v2.svg"
              alt="Tercero Tablada"
              width={200}
              height={50}
              className="header__logo-img"
              priority
            />
          </Link>

          <nav className="header__nav">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={isActive(link.href) ? 'nav-active' : ''}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="header__actions">
            <button
              className="lang-toggle"
              onClick={toggleLanguage}
              aria-label="Toggle language"
            >
              <span className={language === 'en' ? 'lang-active' : 'lang-inactive'}>EN</span>
              {' / '}
              <span className={language === 'es' ? 'lang-active' : 'lang-inactive'}>ES</span>
            </button>
            <button
              className={`hamburger${mobileOpen ? ' active' : ''}`}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Open menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-menu${mobileOpen ? ' active' : ''}`}>
        <nav className="mobile-menu__nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
