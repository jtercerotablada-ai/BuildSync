'use client';

import React from 'react';
import { useTranslation } from '@/components/ttc/language-provider';
import { ScrollAnimation } from '@/components/ttc/scroll-animation';
import { ContactForm } from '@/components/ttc/contact-form';

export default function ContactPage() {
  const { t } = useTranslation();

  return (
    <>
      {/* Page Hero */}
      <section className="ttc-page-hero">
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
          <span className="ttc-section-label">{t('section.getInTouch')}</span>
          <h1>{t('contact.title')}</h1>
          <p>{t('contact.subtitle')}</p>
        </div>
      </section>

      {/* Contact Section */}
      <section style={{ padding: '4rem 2rem 6rem', background: '#0a0a0a' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: '4rem',
            }}
          >
            {/* Info */}
            <ScrollAnimation>
              <h2
                style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontSize: 'clamp(2rem, 4vw, 2.5rem)',
                  fontWeight: 400,
                  color: '#fff',
                  marginBottom: '2.5rem',
                }}
              >
                {t('contact.heading')}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
                {/* Location */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <div>
                    <strong style={{ color: '#fff', fontSize: '0.9375rem', display: 'block', marginBottom: '0.25rem' }}>
                      {t('contact.mainOffice')}
                    </strong>
                    <p style={{ color: '#a3a3a3', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                      123 Engineering Blvd, Suite 100<br />Your City, State 00000
                    </p>
                  </div>
                </div>

                {/* Phone */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  <div>
                    <strong style={{ color: '#fff', fontSize: '0.9375rem', display: 'block', marginBottom: '0.25rem' }}>
                      {t('contact.phone')}
                    </strong>
                    <a href="tel:+10000000000" style={{ color: '#a3a3a3', fontSize: '0.9375rem', textDecoration: 'none' }}>
                      +1 (000) 000-0000
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                  <div>
                    <strong style={{ color: '#fff', fontSize: '0.9375rem', display: 'block', marginBottom: '0.25rem' }}>
                      Email
                    </strong>
                    <a href="mailto:info@tercerotablada.com" style={{ color: '#a3a3a3', fontSize: '0.9375rem', textDecoration: 'none' }}>
                      info@tercerotablada.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Social */}
              <div>
                <h3
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: '#fff',
                    marginBottom: '1rem',
                  }}
                >
                  {t('contact.followUs')}
                </h3>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <a
                    href="#"
                    aria-label="Instagram"
                    style={{
                      width: '44px',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #333',
                      color: '#a3a3a3',
                      textDecoration: 'none',
                      transition: 'all 0.3s',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="2" width="20" height="20" rx="5" />
                      <circle cx="12" cy="12" r="5" />
                      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                    </svg>
                  </a>
                  <a
                    href="#"
                    aria-label="LinkedIn"
                    style={{
                      width: '44px',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #333',
                      color: '#a3a3a3',
                      textDecoration: 'none',
                      transition: 'all 0.3s',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                  <a
                    href="#"
                    aria-label="Facebook"
                    style={{
                      width: '44px',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #333',
                      color: '#a3a3a3',
                      textDecoration: 'none',
                      transition: 'all 0.3s',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                </div>
              </div>
            </ScrollAnimation>

            {/* Form */}
            <ScrollAnimation delay={200}>
              <ContactForm />
            </ScrollAnimation>
          </div>
        </div>
      </section>
    </>
  );
}
