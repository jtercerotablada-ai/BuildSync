'use client';

import React from 'react';
import { useTranslation } from '@/components/ttc/language-provider';
import { ContactForm } from '@/components/ttc/contact-form';

export default function ContactPage() {
  const { t } = useTranslation();

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section__label">{t('section.getInTouch')}</span>
          <h1 className="page-hero__title">{t('contact.title')}</h1>
          <p className="page-hero__subtitle">{t('contact.subtitle')}</p>
        </div>
      </section>

      <section className="section contact-page">
        <div className="container">
          <div className="contact__grid">
            <div className="contact__info" data-aos="fade-right">
              <h2 className="section__title">{t('contact.heading')}</h2>
              <div className="contact__details">
                <div className="contact__item" data-aos="fade-up" data-aos-delay={0}>
                  <div className="contact__item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <strong>{t('contact.mainOffice')}</strong>
                    <p>123 Engineering Blvd, Suite 100<br />Your City, State 00000</p>
                  </div>
                </div>
                <div className="contact__item" data-aos="fade-up" data-aos-delay={100}>
                  <div className="contact__item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                    </svg>
                  </div>
                  <div>
                    <strong>{t('contact.phone')}</strong>
                    <p><a href="tel:+10000000000">+1 (000) 000-0000</a></p>
                  </div>
                </div>
                <div className="contact__item" data-aos="fade-up" data-aos-delay={200}>
                  <div className="contact__item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <path d="M22 6l-10 7L2 6" />
                    </svg>
                  </div>
                  <div>
                    <strong>Email</strong>
                    <p><a href="mailto:info@tercerotablada.com">info@tercerotablada.com</a></p>
                  </div>
                </div>
              </div>

              <div className="contact__social">
                <h3>{t('contact.followUs')}</h3>
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
              </div>
            </div>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
