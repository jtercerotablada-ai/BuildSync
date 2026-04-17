'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { CounterStat } from '@/components/ttc/counter-stat';
import { ValueItem } from '@/components/ttc/value-item';
import { Marquee } from '@/components/ttc/marquee';
import type { TranslationKey } from '@/lib/i18n';

export default function AboutPage() {
  const { t } = useTranslation();

  const values: { number: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
    { number: '01', titleKey: 'value.adaptability', descKey: 'value.adaptability.desc' },
    { number: '02', titleKey: 'value.efficiency', descKey: 'value.efficiency.desc' },
    { number: '03', titleKey: 'value.trust', descKey: 'value.trust.desc' },
    { number: '04', titleKey: 'value.accompaniment', descKey: 'value.accompaniment.desc' },
    { number: '05', titleKey: 'value.personalized', descKey: 'value.personalized.desc' },
  ];

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section__label">{t('section.whoWeAre')}</span>
          <h1 className="page-hero__title">{t('about.title')}</h1>
          <p className="page-hero__subtitle">{t('about.subtitle')}</p>
        </div>
      </section>

      <section className="section about-page">
        <div className="container">
          <div className="about__grid">
            <div className="about__image" data-aos="fade-right">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ttc/img/team.jpg" alt="Tercero Tablada Team" loading="lazy" />
            </div>
            <div className="about__content" data-aos="fade-left" data-aos-delay={100}>
              <span className="section__label">{t('section.ourStory')}</span>
              <h2 className="section__title">{t('about.heading')}</h2>
              <p>{t('about.p1')}</p>
              <p>{t('about.p2')}</p>
              <p>{t('about.p3')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section stats-section">
        <div className="container">
          <div className="stats-grid">
            <CounterStat target={150} suffix="+" label={t('stat.projects')} delay={0} />
            <CounterStat target={30} suffix="+" label={t('stat.years')} delay={100} />
            <CounterStat target={50} suffix="+" label={t('stat.clients')} delay={200} />
            <CounterStat target={9} label={t('stat.services')} delay={300} />
          </div>
        </div>
      </section>

      <section className="section values">
        <div className="container">
          <div className="section__header">
            <span className="section__label">{t('section.ourPrinciples')}</span>
            <h2 className="section__title">{t('section.ourValues')}</h2>
          </div>
          <div className="values__grid">
            {values.map((v, i) => (
              <ValueItem key={v.number} number={v.number} title={t(v.titleKey)} description={t(v.descKey)} delay={i * 80} />
            ))}
          </div>
        </div>
      </section>

      <section className="section clients">
        <div className="container">
          <div className="section__header">
            <span className="section__label">{t('section.trustedBy')}</span>
            <h2 className="section__title">{t('section.ourClients')}</h2>
          </div>
        </div>
        <Marquee />
      </section>

      <section className="section cta-section">
        <div className="container cta-section__inner">
          <h2>{t('cta.ready')}</h2>
          <Link href="/contact" className="btn btn--primary" data-magnetic>
            <span>{t('cta.contact')}</span>
            <span className="btn__arrow">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
