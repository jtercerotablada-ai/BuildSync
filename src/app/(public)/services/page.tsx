'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { ScrollAnimation } from '@/components/ttc/scroll-animation';
import { ServiceCard } from '@/components/ttc/service-card';
import { ValueItem } from '@/components/ttc/value-item';
import { serviceIcons } from '@/components/ttc/service-icons';

export default function ServicesPage() {
  const { t } = useTranslation();

  const services = [
    { icon: serviceIcons.predesign, titleKey: 'service.predesign' as const, descKey: 'service.predesign.desc' as const },
    { icon: serviceIcons.structural, titleKey: 'service.structural' as const, descKey: 'service.structural.desc' as const },
    { icon: serviceIcons.review, titleKey: 'service.review' as const, descKey: 'service.review.desc' as const },
    { icon: serviceIcons.postTension, titleKey: 'service.postTension' as const, descKey: 'service.postTension.desc' as const },
    { icon: serviceIcons.bimDev, titleKey: 'service.bimDev' as const, descKey: 'service.bimDev.desc' as const },
    { icon: serviceIcons.digital, titleKey: 'service.digital' as const, descKey: 'service.digital.desc' as const },
    { icon: serviceIcons.coordination, titleKey: 'service.coordination' as const, descKey: 'service.coordination.desc' as const },
    { icon: serviceIcons.clash, titleKey: 'service.clash' as const, descKey: 'service.clash.desc' as const },
    { icon: serviceIcons.bimAudit, titleKey: 'service.bimAudit' as const, descKey: 'service.bimAudit.desc' as const },
  ];

  const values = [
    { number: '01', titleKey: 'value.adaptability' as const, descKey: 'value.adaptability.desc' as const },
    { number: '02', titleKey: 'value.efficiency' as const, descKey: 'value.efficiency.desc' as const },
    { number: '03', titleKey: 'value.trust' as const, descKey: 'value.trust.desc' as const },
    { number: '04', titleKey: 'value.accompaniment' as const, descKey: 'value.accompaniment.desc' as const },
    { number: '05', titleKey: 'value.personalized' as const, descKey: 'value.personalized.desc' as const },
  ];

  return (
    <>
      {/* Page Hero */}
      <section className="ttc-page-hero">
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
          <span className="ttc-section-label">{t('section.whatWeDo')}</span>
          <h1>{t('section.ourServices')}</h1>
          <p>{t('section.servicesSubtitle')}</p>
        </div>
      </section>

      {/* Services Grid */}
      <section style={{ padding: '4rem 2rem 6rem', background: '#0a0a0a' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: '1.5rem',
            }}
          >
            {services.map((s, i) => (
              <ScrollAnimation key={s.titleKey} delay={(i % 3) * 100}>
                <ServiceCard
                  icon={s.icon}
                  title={t(s.titleKey)}
                  description={t(s.descKey)}
                />
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '6rem 2rem', background: '#0d0d0d' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <ScrollAnimation>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <span className="ttc-section-label">{t('section.ourPrinciples')}</span>
              <h2
                style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  fontWeight: 400,
                  color: '#fff',
                }}
              >
                {t('section.ourValues')}
              </h2>
            </div>
          </ScrollAnimation>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: '2.5rem',
              maxWidth: '1000px',
              margin: '0 auto',
            }}
          >
            {values.map((v, i) => (
              <ScrollAnimation key={v.number} delay={i * 100}>
                <ValueItem
                  number={v.number}
                  title={t(v.titleKey)}
                  description={t(v.descKey)}
                />
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: '6rem 2rem',
          background: '#0a0a0a',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: 'var(--font-playfair), serif',
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 400,
              color: '#fff',
              marginBottom: '2rem',
            }}
          >
            {t('cta.ready')}
          </h2>
          <Link href="/contact" className="ttc-btn ttc-btn--primary">
            {t('cta.contact')}
          </Link>
        </div>
      </section>
    </>
  );
}
