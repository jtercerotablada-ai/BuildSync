'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { ServicesShowcase } from '@/components/ttc/services-showcase';
import { TrustBar } from '@/components/ttc/trust-bar';
import { CounterStat } from '@/components/ttc/counter-stat';
import { ContactForm } from '@/components/ttc/contact-form';
import { CtaBand } from '@/components/ttc/cta-band';
import { ProcessSection } from '@/components/ttc/process-section';
import { WhyUs } from '@/components/ttc/why-us';
import HeroCanvas from '@/components/ttc/hero-canvas';

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <>
      {/* HERO */}
      <section className="hero" id="hero">
        <div className="hero__bg">
          <video autoPlay muted loop playsInline poster="/ttc/img/hero-bg.jpg">
            <source src="/ttc/video/hero.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="hero__overlay"></div>
        <div className="hero-canvas-wrap" aria-hidden="true">
          <HeroCanvas />
        </div>
        <div className="hero-bp" aria-hidden="true"></div>
        <div className="hero__side-lines" aria-hidden="true"></div>
        <div className="hero__content">
          <div className="hero__badge">{t('hero.badge')}</div>
          <h1 className="hero__title">
            <span className="hero__title-line">{t('hero.titleLine1')}</span>
            <span className="hero__title-line accent">{t('hero.titleLine2')}</span>
          </h1>
          <p className="hero__materials">{t('hero.materials')}</p>
          <p className="hero__desc">{t('hero.desc')}</p>
          <div className="hero__cta">
            <Link href="/contact" className="btn btn--primary" data-magnetic>
              <span>{t('hero.contactUs')}</span>
              <span className="btn__arrow">→</span>
            </Link>
            <Link href="/services" className="btn btn--outline" data-magnetic>
              <span>{t('hero.viewProjects')}</span>
            </Link>
          </div>
          <p className="hero__credential">{t('hero.credential')}</p>
        </div>
        <div className="hero__scroll">
          <span className="hero__scroll-text">{t('hero.scroll')}</span>
          <div className="hero__scroll-line"></div>
        </div>
      </section>

      {/* TRUST / CREDENTIALS */}
      <TrustBar />

      {/* SERVICES (3 core) */}
      <ServicesShowcase />

      {/* HOW WE WORK */}
      <ProcessSection />

      {/* WHY US */}
      <WhyUs />

      {/* ABOUT */}
      <section className="section about about--light" id="about">
        <div className="container">
          <div className="about__grid">
            <div className="about__image" data-aos="fade-right">
              <div className="about__image-parallax" data-parallax="0.45">
                <Image
                  src="/ttc/img/team.jpg"
                  alt="Tercero Tablada Team"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            </div>
            <div className="about__content">
              <span className="section__label">{t('section.aboutUs')}</span>
              <h2 className="section__title">{t('about.heading')}</h2>
              <p>{t('about.p1')}</p>
              <p>{t('about.p2')}</p>
              <div className="about__stats">
                <CounterStat target={100} suffix="%" label={t('stat.projects')} delay={0} />
                <CounterStat target={30} suffix="+" label={t('stat.yearsShort')} delay={100} />
                <CounterStat target={3} label={t('stat.services')} delay={200} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaBand />

      {/* CONTACT */}
      <section className="section contact" id="contact">
        <div className="container">
          <div className="contact__grid">
            <div className="contact__info">
              <span className="section__label">{t('section.getInTouch')}</span>
              <h2 className="section__title">{t('contact.heading')}</h2>
              <p>{t('contact.desc')}</p>
              <div className="contact__details">
                <div className="contact__item">
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
                <div className="contact__item">
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
                <div className="contact__item">
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
            </div>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
