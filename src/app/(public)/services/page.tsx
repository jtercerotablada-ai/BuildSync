'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { ServiceCard } from '@/components/ttc/service-card';
import { ValueItem } from '@/components/ttc/value-item';
import { serviceIcons } from '@/components/ttc/service-icons';
import type { TranslationKey } from '@/lib/i18n';

export default function ServicesPage() {
  const { t } = useTranslation();

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
      <section className="page-hero">
        <div className="container">
          <span className="section__label">{t('section.whatWeDo')}</span>
          <h1 className="page-hero__title">{t('section.ourServices')}</h1>
          <p className="page-hero__subtitle">{t('section.servicesSubtitle')}</p>
        </div>
      </section>

      <section className="section services-page">
        <div className="container">
          <div className="services__grid">
            {services.map((s, i) => (
              <ServiceCard key={i} icon={s.icon} title={t(s.titleKey)} description={t(s.descKey)} delay={(i % 3) * 100} />
            ))}
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
