'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from '@/components/ttc/language-provider';
import { ScrollAnimation } from '@/components/ttc/scroll-animation';
import { CounterStat } from '@/components/ttc/counter-stat';
import { ValueItem } from '@/components/ttc/value-item';
import { Marquee } from '@/components/ttc/marquee';

export default function AboutPage() {
  const { t } = useTranslation();

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
          <span className="ttc-section-label">{t('section.whoWeAre')}</span>
          <h1>{t('about.title')}</h1>
          <p>{t('about.subtitle')}</p>
        </div>
      </section>

      {/* About Content */}
      <section style={{ padding: '4rem 2rem 6rem', background: '#0a0a0a' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))',
              gap: '4rem',
              alignItems: 'center',
            }}
          >
            <ScrollAnimation>
              <div
                style={{
                  position: 'relative',
                  aspectRatio: '4/3',
                  overflow: 'hidden',
                }}
              >
                <Image
                  src="/ttc/img/team.jpg"
                  alt="Tercero Tablada Engineering Team"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            </ScrollAnimation>

            <ScrollAnimation delay={200}>
              <span className="ttc-section-label">{t('section.ourStory')}</span>
              <h2
                style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                  fontWeight: 400,
                  color: '#fff',
                  marginBottom: '1.5rem',
                  lineHeight: 1.2,
                }}
              >
                {t('about.heading')}
              </h2>
              <p style={{ color: '#999', lineHeight: 1.8, marginBottom: '1rem', fontSize: '0.9375rem' }}>
                {t('about.p1')}
              </p>
              <p style={{ color: '#999', lineHeight: 1.8, marginBottom: '1rem', fontSize: '0.9375rem' }}>
                {t('about.p2')}
              </p>
              <p style={{ color: '#999', lineHeight: 1.8, fontSize: '0.9375rem' }}>
                {t('about.p3')}
              </p>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section
        style={{
          padding: '5rem 2rem',
          background: '#0d0d0d',
          borderTop: '1px solid #1a1a1a',
          borderBottom: '1px solid #1a1a1a',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '3rem',
            }}
          >
            <ScrollAnimation>
              <CounterStat target={150} suffix="+" label={t('stat.projects')} />
            </ScrollAnimation>
            <ScrollAnimation delay={100}>
              <CounterStat target={30} suffix="+" label={t('stat.years')} />
            </ScrollAnimation>
            <ScrollAnimation delay={200}>
              <CounterStat target={50} suffix="+" label={t('stat.clients')} />
            </ScrollAnimation>
            <ScrollAnimation delay={300}>
              <CounterStat target={9} label={t('stat.services')} />
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '6rem 2rem', background: '#0a0a0a' }}>
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
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

      {/* Clients Marquee */}
      <section style={{ padding: '4rem 0', background: '#0d0d0d' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
          <ScrollAnimation>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <span className="ttc-section-label">{t('section.trustedBy')}</span>
              <h2
                style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  fontWeight: 400,
                  color: '#fff',
                }}
              >
                {t('section.ourClients')}
              </h2>
            </div>
          </ScrollAnimation>
        </div>
        <Marquee />
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
