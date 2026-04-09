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
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/projects', label: t('nav.projects') },
    { href: '/services', label: t('nav.services') },
    { href: '/about', label: t('nav.about') },
    { href: '/contact', label: t('nav.contact') },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: '0 2rem',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: scrolled || !isHome
            ? 'rgba(10, 10, 10, 0.95)'
            : 'transparent',
          backdropFilter: scrolled || !isHome ? 'blur(20px)' : 'none',
          borderBottom: scrolled || !isHome
            ? '1px solid rgba(255,255,255,0.05)'
            : '1px solid transparent',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <Image
              src="/ttc/img/logo-tt-v2.svg"
              alt="Tercero Tablada"
              width={160}
              height={40}
              style={{ height: '36px', width: 'auto' }}
              priority
            />
          </Link>

          {/* Desktop Nav */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2rem',
            }}
            className="ttc-desktop-nav"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  color: isActive(link.href) ? '#c9a84c' : '#999999',
                  transition: 'color 0.3s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive(link.href))
                    (e.target as HTMLElement).style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  if (!isActive(link.href))
                    (e.target as HTMLElement).style.color = '#999999';
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              aria-label="Toggle language"
              style={{
                background: 'transparent',
                border: '1px solid #333',
                color: '#fff',
                padding: '0.375rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.3s',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ color: language === 'en' ? '#c9a84c' : '#666' }}>
                EN
              </span>
              {' / '}
              <span style={{ color: language === 'es' ? '#c9a84c' : '#666' }}>
                ES
              </span>
            </button>

            {/* Client Portal */}
            <Link
              href="/login"
              className="ttc-desktop-nav"
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                padding: '0.5rem 1.25rem',
                background: '#c9a84c',
                color: '#0a0a0a',
                transition: 'all 0.3s',
              }}
            >
              {t('nav.clientPortal')}
            </Link>

            {/* Hamburger */}
            <button
              className="ttc-hamburger"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Open menu"
              style={{
                display: 'none',
                flexDirection: 'column',
                gap: '5px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: '24px',
                  height: '2px',
                  background: '#fff',
                  transition: 'all 0.3s',
                  transform: mobileOpen
                    ? 'rotate(45deg) translate(5px, 5px)'
                    : 'none',
                }}
              />
              <span
                style={{
                  display: 'block',
                  width: '24px',
                  height: '2px',
                  background: '#fff',
                  transition: 'all 0.3s',
                  opacity: mobileOpen ? 0 : 1,
                }}
              />
              <span
                style={{
                  display: 'block',
                  width: '24px',
                  height: '2px',
                  background: '#fff',
                  transition: 'all 0.3s',
                  transform: mobileOpen
                    ? 'rotate(-45deg) translate(5px, -5px)'
                    : 'none',
                }}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(10, 10, 10, 0.98)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2rem',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s',
        }}
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            style={{
              fontSize: '1.5rem',
              fontWeight: 300,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              color: isActive(link.href) ? '#c9a84c' : '#ffffff',
              fontFamily: 'var(--ttc-font-heading)',
            }}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/login"
          onClick={() => setMobileOpen(false)}
          className="ttc-btn ttc-btn--primary"
          style={{ marginTop: '1rem' }}
        >
          {t('nav.clientPortal')}
        </Link>
      </div>

      {/* Responsive styles */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .ttc-desktop-nav {
            display: none !important;
          }
          .ttc-hamburger {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
