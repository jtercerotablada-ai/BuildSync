'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from './language-provider';

export function TTCFooter() {
  const { t } = useTranslation();

  return (
    <footer
      style={{
        background: '#0a0a0a',
        borderTop: '1px solid #1a1a1a',
        padding: '4rem 2rem 0',
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Brand */}
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <Image
            src="/ttc/img/logo-tt-v2.svg"
            alt="Tercero Tablada"
            width={180}
            height={45}
            style={{ height: '40px', width: 'auto', marginBottom: '1rem', display: 'inline-block' }}
          />
          <p
            style={{
              color: '#a3a3a3',
              fontSize: '0.875rem',
              letterSpacing: '0.05em',
            }}
          >
            {t('footer.tagline')}
          </p>
          <p
            style={{
              color: '#c9a84c',
              fontSize: '0.8125rem',
              fontWeight: 500,
              marginTop: '0.25rem',
            }}
          >
            {t('footer.credential')}
          </p>
        </div>

        {/* Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '3rem',
            paddingBottom: '3rem',
            borderBottom: '1px solid #1a1a1a',
          }}
        >
          {/* Office */}
          <div>
            <h3
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#fff',
                marginBottom: '1.25rem',
              }}
            >
              {t('footer.mainOffice')}
            </h3>
            <p
              style={{
                color: '#a3a3a3',
                fontSize: '0.875rem',
                lineHeight: 1.7,
                marginBottom: '0.75rem',
              }}
            >
              123 Engineering Blvd, Suite 100
              <br />
              Your City, State 00000
            </p>
            <a
              href="tel:+10000000000"
              style={{
                color: '#a3a3a3',
                fontSize: '0.875rem',
                textDecoration: 'none',
                transition: 'color 0.3s',
              }}
            >
              +1 (000) 000-0000
            </a>
          </div>

          {/* Navigation */}
          <div>
            <h3
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#fff',
                marginBottom: '1.25rem',
              }}
            >
              {t('footer.navigation')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <Link href="/projects" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t('nav.projects')}
              </Link>
              <Link href="/services" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t('nav.services')}
              </Link>
              <Link href="/about" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t('nav.about')}
              </Link>
              <Link href="/contact" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t('nav.contact')}
              </Link>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#fff',
                marginBottom: '1.25rem',
              }}
            >
              {t('footer.services')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <Link href="/services" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t('footer.structuralEng')}
              </Link>
              <Link href="/services" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t('footer.bim')}
              </Link>
              <Link href="/services" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t('footer.postTension')}
              </Link>
              <Link href="/services" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t('footer.digitalConstruction')}
              </Link>
              <Link href="/services" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                {t('footer.clashDetection')}
              </Link>
            </div>
          </div>

          {/* Connect */}
          <div>
            <h3
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#fff',
                marginBottom: '1.25rem',
              }}
            >
              {t('footer.connect')}
            </h3>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <a
                href="#"
                aria-label="Instagram"
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #333',
                  color: '#a3a3a3',
                  textDecoration: 'none',
                  transition: 'all 0.3s',
                  fontSize: '1rem',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #333',
                  color: '#a3a3a3',
                  textDecoration: 'none',
                  transition: 'all 0.3s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Facebook"
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #333',
                  color: '#a3a3a3',
                  textDecoration: 'none',
                  transition: 'all 0.3s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
            <a
              href="mailto:info@tercerotablada.com"
              style={{
                color: '#c9a84c',
                fontSize: '0.875rem',
                textDecoration: 'none',
              }}
            >
              info@tercerotablada.com
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div
          style={{
            textAlign: 'center',
            padding: '2rem 0',
          }}
        >
          <p
            style={{
              color: '#888',
              fontSize: '0.6875rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}
