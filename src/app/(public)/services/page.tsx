'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { ServicesShowcase } from '@/components/ttc/services-showcase';
import { CoverageSection } from '@/components/ttc/coverage-section';
import { ValueItem } from '@/components/ttc/value-item';
import type { TranslationKey } from '@/lib/i18n';

export default function ServicesPage() {
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
          <span className="section__label">{t('section.whatWeDo')}</span>
          <h1 className="page-hero__title">{t('section.ourServices')}</h1>
          <p className="page-hero__subtitle">{t('section.servicesSubtitle')}</p>
        </div>
      </section>

      <ServicesShowcase withHeader={false} />

      <CoverageSection />

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
