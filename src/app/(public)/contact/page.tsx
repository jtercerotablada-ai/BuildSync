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
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
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
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
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
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
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

              {/* Social section hidden until real URLs are available */}
            </div>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
