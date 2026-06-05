'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from './language-provider';

// Placeholder "#" hrefs so the icons render now — swap in the real profile
// URLs when you have them.
const SOCIAL = {
  linkedin: '#',
  x: '#',
  instagram: '#',
  facebook: '#',
  youtube: '#',
};

export function TTCFooter() {
  const { t } = useTranslation();
  const hasSocial = SOCIAL.instagram || SOCIAL.linkedin || SOCIAL.facebook;

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <Image
              src="/ttc/img/logo-white-wide.png"
              alt="TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC."
              className="footer__logo-img"
              width={360}
              height={137}
              priority={false}
            />
            <p className="footer__tagline">{t('footer.tagline')}</p>
            <p className="footer__credential">{t('footer.credential')}</p>
          </div>
        </div>

        <div className="footer__grid">
          <div className="footer__office">
            <h4>{t('footer.mainOffice')}</h4>
            <p>
              123 Engineering Blvd, Suite 100
              <br />
              Your City, State 00000
            </p>
            <a href="tel:+10000000000">+1 (000) 000-0000</a>
          </div>

          <div className="footer__links">
            <h4>{t('footer.navigation')}</h4>
            <Link href="/projects">{t('nav.projects')}</Link>
            <Link href="/services">{t('nav.services')}</Link>
            <Link href="/about">{t('nav.about')}</Link>
            <Link href="/contact">{t('nav.contact')}</Link>
          </div>

          <div className="footer__links">
            <h4>{t('footer.services')}</h4>
            <Link href="/services">{t('footer.structuralEng')}</Link>
            <Link href="/services">{t('footer.bim')}</Link>
            <Link href="/services">{t('footer.postTension')}</Link>
            <Link href="/services">{t('footer.digitalConstruction')}</Link>
            <Link href="/services">{t('footer.clashDetection')}</Link>
          </div>

          <div className="footer__social">
            <h4>{t('footer.connect')}</h4>
            {hasSocial && (
              <div className="footer__social-icons">
                <a href={SOCIAL.linkedin} aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" />
                    <path d="M8 11v5" />
                    <path d="M8 8v.01" />
                    <path d="M12 16v-5" />
                    <path d="M16 16v-3a2 2 0 0 0-4 0" />
                  </svg>
                </a>
                <a href={SOCIAL.x} aria-label="X (Twitter)" target="_blank" rel="noopener noreferrer">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4l11.733 16h4.267l-11.733-16z" />
                    <path d="M4 20l6.768-6.768m2.46-2.46l6.772-6.772" />
                  </svg>
                </a>
                <a href={SOCIAL.instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
                    <path d="M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z" />
                    <path d="M16.5 7.5v.01" />
                  </svg>
                </a>
                <a href={SOCIAL.facebook} aria-label="Facebook" target="_blank" rel="noopener noreferrer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 10v4h3v7h4v-7h3l1-4h-4V8a1 1 0 0 1 1-1h3V3h-3a5 5 0 0 0-5 5v2H7" />
                  </svg>
                </a>
                <a href={SOCIAL.youtube} aria-label="YouTube" target="_blank" rel="noopener noreferrer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 8a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" />
                    <path d="M10 9l5 3l-5 3z" />
                  </svg>
                </a>
              </div>
            )}
            <a href="mailto:info@tercerotablada.com" className="footer__email">
              info@tercerotablada.com
            </a>
          </div>
        </div>

        <div className="footer__bottom">
          <p>{t('footer.copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
