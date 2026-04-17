'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from './language-provider';

export function TTCFooter() {
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ttc/img/logo-tt-v2.svg"
              alt="Tercero Tablada"
              className="footer__logo-img"
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
            <div className="footer__social-icons">
              <a href="#" aria-label="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a href="#" aria-label="LinkedIn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a href="#" aria-label="Facebook">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
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
