'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { ProjectCard } from '@/components/ttc/project-card';
import { ServiceCard } from '@/components/ttc/service-card';
import { ValueItem } from '@/components/ttc/value-item';
import { Marquee } from '@/components/ttc/marquee';
import { CounterStat } from '@/components/ttc/counter-stat';
import { ContactForm } from '@/components/ttc/contact-form';
import { serviceIcons } from '@/components/ttc/service-icons';
import type { TranslationKey } from '@/lib/i18n';

export default function HomePage() {
  const { t } = useTranslation();

  const featuredProjects: {
    image: string;
    categoryKey: TranslationKey;
    titleKey: TranslationKey;
    descKey: TranslationKey;
  }[] = [
    { image: '/ttc/img/projects/project-01.jpg', categoryKey: 'category.residential', titleKey: 'project.residentialTower', descKey: 'project.residentialTower.desc' },
    { image: '/ttc/img/projects/project-02.jpg', categoryKey: 'category.commercial', titleKey: 'project.commercialComplex', descKey: 'project.commercialComplex.desc' },
    { image: '/ttc/img/projects/project-03.jpg', categoryKey: 'category.industrial', titleKey: 'project.industrialWarehouse', descKey: 'project.industrialWarehouse.desc' },
    { image: '/ttc/img/projects/project-04.jpg', categoryKey: 'category.luxury', titleKey: 'project.luxuryResidence', descKey: 'project.luxuryResidence.desc' },
    { image: '/ttc/img/projects/project-05.jpg', categoryKey: 'category.multifamily', titleKey: 'project.multiFamilyHousing', descKey: 'project.multiFamilyHousing.desc' },
    { image: '/ttc/img/projects/project-06.jpg', categoryKey: 'category.publicWorks', titleKey: 'project.publicInfrastructure', descKey: 'project.publicInfrastructure.desc' },
    { image: '/ttc/img/projects/project-07.jpg', categoryKey: 'category.parking', titleKey: 'project.parkingStructure', descKey: 'project.parkingStructure.desc' },
    { image: '/ttc/img/projects/project-08.jpg', categoryKey: 'category.mixedUse', titleKey: 'project.mixedUse', descKey: 'project.mixedUse.desc' },
    { image: '/ttc/img/projects/project-09.jpg', categoryKey: 'category.healthcare', titleKey: 'project.healthcare', descKey: 'project.healthcare.desc' },
    { image: '/ttc/img/projects/project-10.jpg', categoryKey: 'category.hospitality', titleKey: 'project.hospitality', descKey: 'project.hospitality.desc' },
  ];

  const services: { icon: React.ReactNode; titleKey: TranslationKey; descKey: TranslationKey }[] = [
    { icon: serviceIcons.predesign, titleKey: 'service.predesign', descKey: 'service.predesign.desc' },
    { icon: serviceIcons.structural, titleKey: 'service.structural', descKey: 'service.structural.desc' },
    { icon: serviceIcons.review, titleKey: 'service.review', descKey: 'service.review.desc' },
    { icon: serviceIcons.postTension, titleKey: 'service.postTension', descKey: 'service.postTension.desc' },
    { icon: serviceIcons.bimDev, titleKey: 'service.bimDev', descKey: 'service.bimDev.desc' },
    { icon: serviceIcons.digital, titleKey: 'service.digital', descKey: 'service.digital.desc' },
    { icon: serviceIcons.coordination, titleKey: 'service.coordination', descKey: 'service.coordination.desc' },
    { icon: serviceIcons.clash, titleKey: 'service.clash', descKey: 'service.clash.desc' },
    { icon: serviceIcons.bimAudit, titleKey: 'service.bimAudit', descKey: 'service.bimAudit.desc' },
  ];

  const values: { number: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
    { number: '01', titleKey: 'value.adaptability', descKey: 'value.adaptability.desc' },
    { number: '02', titleKey: 'value.efficiency', descKey: 'value.efficiency.desc' },
    { number: '03', titleKey: 'value.trust', descKey: 'value.trust.desc' },
    { number: '04', titleKey: 'value.accompaniment', descKey: 'value.accompaniment.desc' },
    { number: '05', titleKey: 'value.personalized', descKey: 'value.personalized.desc' },
  ];

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
        <div className="hero__watermark" aria-hidden="true">TT</div>
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
            <Link href="/projects" className="btn btn--primary" data-magnetic>
              <span>{t('hero.viewProjects')}</span>
              <span className="btn__arrow">→</span>
            </Link>
            <Link href="/contact" className="btn btn--outline" data-magnetic>
              <span>{t('hero.contactUs')}</span>
            </Link>
          </div>
          <p className="hero__credential">{t('hero.credential')}</p>
        </div>
        <div className="hero__scroll">
          <span className="hero__scroll-text">{t('hero.scroll')}</span>
          <div className="hero__scroll-line"></div>
        </div>
      </section>

      {/* PROJECTS */}
      <section className="section projects" id="projects">
        <div className="container">
          <div className="section__header">
            <span className="section__label">{t('section.portfolio')}</span>
            <h2 className="section__title">{t('section.featuredProjects')}</h2>
          </div>
          <div className="projects__grid">
            {featuredProjects.map((p, i) => (
              <ProjectCard
                key={i}
                image={p.image}
                category={t(p.categoryKey)}
                title={t(p.titleKey)}
                description={t(p.descKey)}
                index={i + 1}
                total={featuredProjects.length}
                delay={(i % 4) * 100}
              />
            ))}
          </div>
          <div className="projects__cta">
            <Link href="/projects" className="btn btn--dark" data-magnetic>
              <span>{t('projects.viewAll')}</span>
              <span className="btn__arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="section services" id="services">
        <div className="container">
          <div className="section__header">
            <span className="section__label">{t('section.whatWeDo')}</span>
            <h2 className="section__title">{t('section.ourServices')}</h2>
            <p className="section__subtitle">{t('section.servicesSubtitle')}</p>
          </div>
          <div className="services__grid">
            {services.map((s, i) => (
              <ServiceCard
                key={i}
                icon={s.icon}
                title={t(s.titleKey)}
                description={t(s.descKey)}
                delay={(i % 3) * 100}
              />
            ))}
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="section values" id="values">
        <div className="container">
          <div className="section__header">
            <span className="section__label">{t('section.ourPrinciples')}</span>
            <h2 className="section__title">{t('section.ourValues')}</h2>
          </div>
          <div className="values__grid">
            {values.map((v, i) => (
              <ValueItem
                key={v.number}
                number={v.number}
                title={t(v.titleKey)}
                description={t(v.descKey)}
                delay={i * 80}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="section about" id="about">
        <div className="container">
          <div className="about__grid">
            <div className="about__image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ttc/img/team.jpg" alt="Tercero Tablada Team" loading="lazy" />
            </div>
            <div className="about__content">
              <span className="section__label">{t('section.aboutUs')}</span>
              <h2 className="section__title">{t('about.heading')}</h2>
              <p>{t('about.p1')}</p>
              <p>{t('about.p2')}</p>
              <div className="about__stats">
                <CounterStat target={150} suffix="+" label={t('stat.projects')} delay={0} />
                <CounterStat target={30} suffix="+" label={t('stat.yearsShort')} delay={100} />
                <CounterStat target={50} suffix="+" label={t('stat.clients')} delay={200} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLIENTS */}
      <section className="section clients" id="clients">
        <div className="container">
          <div className="section__header">
            <span className="section__label">{t('section.trustedBy')}</span>
            <h2 className="section__title">{t('section.ourClients')}</h2>
            <p className="section__subtitle">{t('section.clientsSubtitle')}</p>
          </div>
        </div>
        <Marquee />
      </section>

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
