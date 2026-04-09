'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from '@/components/ttc/language-provider';
import { ScrollAnimation } from '@/components/ttc/scroll-animation';
import { ProjectCard } from '@/components/ttc/project-card';
import { ServiceCard } from '@/components/ttc/service-card';
import { ValueItem } from '@/components/ttc/value-item';
import { Marquee } from '@/components/ttc/marquee';
import { CounterStat } from '@/components/ttc/counter-stat';
import { ContactForm } from '@/components/ttc/contact-form';
import { serviceIcons } from '@/components/ttc/service-icons';

export default function HomePage() {
  const { t } = useTranslation();

  const featuredProjects = [
    { image: '/ttc/img/projects/project-01.jpg', titleKey: 'project.residentialTower' as const, descKey: 'project.residentialTower.desc' as const },
    { image: '/ttc/img/projects/project-02.jpg', titleKey: 'project.commercialComplex' as const, descKey: 'project.commercialComplex.desc' as const },
    { image: '/ttc/img/projects/project-03.jpg', titleKey: 'project.industrialWarehouse' as const, descKey: 'project.industrialWarehouse.desc' as const },
    { image: '/ttc/img/projects/project-04.jpg', titleKey: 'project.luxuryResidence' as const, descKey: 'project.luxuryResidence.desc' as const },
    { image: '/ttc/img/projects/project-05.jpg', titleKey: 'project.multiFamilyHousing' as const, descKey: 'project.multiFamilyHousing.desc' as const },
    { image: '/ttc/img/projects/project-06.jpg', titleKey: 'project.publicInfrastructure' as const, descKey: 'project.publicInfrastructure.desc' as const },
    { image: '/ttc/img/projects/project-07.jpg', titleKey: 'project.parkingStructure' as const, descKey: 'project.parkingStructure.desc' as const },
    { image: '/ttc/img/projects/project-08.jpg', titleKey: 'project.mixedUse' as const, descKey: 'project.mixedUse.desc' as const },
  ];

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
      {/* ===== HERO ===== */}
      <section
        style={{
          position: 'relative',
          height: '100vh',
          minHeight: '700px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Video Background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
          }}
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/ttc/img/hero-bg.jpg"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          >
            <source src="/ttc/video/hero.mp4" type="video/mp4" />
          </video>
        </div>
        {/* Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(10,10,10,0.7) 0%, rgba(10,10,10,0.5) 50%, rgba(10,10,10,0.9) 100%)',
            zIndex: 1,
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'center',
            maxWidth: '900px',
            padding: '6rem 2rem 0',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#c9a84c',
              border: '1px solid rgba(201,168,76,0.3)',
              padding: '0.5rem 1.25rem',
              marginBottom: '2.5rem',
            }}
          >
            {t('hero.badge')}
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-playfair), serif',
              fontSize: 'clamp(2rem, 5.5vw, 4.5rem)',
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              marginBottom: '1.5rem',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color: '#fff' }}>{t('hero.titleLine1')}</span>
            {' '}
            <span style={{ color: '#c9a84c' }}>{t('hero.titleLine2')}</span>
          </h1>

          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#a3a3a3',
              marginBottom: '1.5rem',
            }}
          >
            {t('hero.materials')}
          </p>

          <p
            style={{
              fontSize: '1.0625rem',
              color: '#bbb',
              lineHeight: 1.8,
              maxWidth: '700px',
              margin: '0 auto 2.5rem',
            }}
          >
            {t('hero.desc')}
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/projects" className="ttc-btn ttc-btn--primary">
              {t('hero.viewProjects')}
            </Link>
            <Link href="/contact" className="ttc-btn ttc-btn--outline">
              {t('hero.contactUs')}
            </Link>
          </div>

          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              letterSpacing: '0.15em',
              color: '#c9a84c',
              marginTop: '2rem',
            }}
          >
            {t('hero.credential')}
          </p>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: '1px',
              height: '60px',
              background: 'linear-gradient(to bottom, #c9a84c, transparent)',
              animation: 'scrollPulse 2s ease-in-out infinite',
            }}
          />
        </div>
      </section>

      {/* ===== FEATURED PROJECTS ===== */}
      <section style={{ padding: '6rem 2rem', background: '#0a0a0a' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <ScrollAnimation>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <span className="ttc-section-label">{t('section.portfolio')}</span>
              <h2
                style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  fontWeight: 400,
                  color: '#fff',
                }}
              >
                {t('section.featuredProjects')}
              </h2>
            </div>
          </ScrollAnimation>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))',
              gap: '1.5rem',
            }}
          >
            {featuredProjects.map((p, i) => (
              <ScrollAnimation key={p.titleKey} delay={i % 2 === 0 ? 0 : 150}>
                <ProjectCard
                  image={p.image}
                  title={t(p.titleKey)}
                  description={t(p.descKey)}
                />
              </ScrollAnimation>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link href="/projects" className="ttc-btn ttc-btn--dark">
              {t('projects.viewAll')}
            </Link>
          </div>
        </div>
      </section>

      {/* ===== SERVICES ===== */}
      <section style={{ padding: '6rem 2rem', background: '#0d0d0d' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <ScrollAnimation>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <span className="ttc-section-label">{t('section.whatWeDo')}</span>
              <h2
                style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  fontWeight: 400,
                  color: '#fff',
                  marginBottom: '1rem',
                }}
              >
                {t('section.ourServices')}
              </h2>
              <p
                style={{
                  color: '#a3a3a3',
                  fontSize: '1.0625rem',
                  maxWidth: '640px',
                  margin: '0 auto',
                  lineHeight: 1.7,
                }}
              >
                {t('section.servicesSubtitle')}
              </p>
            </div>
          </ScrollAnimation>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
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

      {/* ===== VALUES ===== */}
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

      {/* ===== ABOUT ===== */}
      <section style={{ padding: '6rem 2rem', background: '#0d0d0d' }}>
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
              <span className="ttc-section-label">{t('section.aboutUs')}</span>
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
              <p style={{ color: '#a3a3a3', lineHeight: 1.8, marginBottom: '1rem', fontSize: '0.9375rem' }}>
                {t('about.p1')}
              </p>
              <p style={{ color: '#a3a3a3', lineHeight: 1.8, marginBottom: '2rem', fontSize: '0.9375rem' }}>
                {t('about.p2')}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
                <CounterStat target={150} suffix="+" label={t('stat.projects')} />
                <CounterStat target={30} suffix="+" label={t('stat.yearsShort')} />
                <CounterStat target={50} suffix="+" label={t('stat.clients')} />
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* ===== CLIENTS MARQUEE ===== */}
      <section style={{ padding: '4rem 0', background: '#0a0a0a' }}>
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
                  marginBottom: '1rem',
                }}
              >
                {t('section.ourClients')}
              </h2>
              <p style={{ color: '#a3a3a3', maxWidth: '600px', margin: '0 auto', lineHeight: 1.7 }}>
                {t('section.clientsSubtitle')}
              </p>
            </div>
          </ScrollAnimation>
        </div>
        <Marquee />
      </section>

      {/* ===== CONTACT ===== */}
      <section style={{ padding: '6rem 2rem', background: '#0d0d0d' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))',
              gap: '4rem',
            }}
          >
            <ScrollAnimation>
              <span className="ttc-section-label">{t('section.getInTouch')}</span>
              <h2
                style={{
                  fontFamily: 'var(--font-playfair), serif',
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  fontWeight: 400,
                  color: '#fff',
                  marginBottom: '1.5rem',
                }}
              >
                {t('contact.heading')}
              </h2>
              <p style={{ color: '#a3a3a3', lineHeight: 1.8, marginBottom: '2.5rem' }}>
                {t('contact.desc')}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Location */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <div>
                    <strong style={{ color: '#fff', fontSize: '0.875rem' }}>{t('contact.mainOffice')}</strong>
                    <p style={{ color: '#a3a3a3', fontSize: '0.875rem', lineHeight: 1.6, marginTop: '0.25rem' }}>
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
                    <strong style={{ color: '#fff', fontSize: '0.875rem' }}>{t('contact.phone')}</strong>
                    <p style={{ marginTop: '0.25rem' }}>
                      <a href="tel:+10000000000" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                        +1 (000) 000-0000
                      </a>
                    </p>
                  </div>
                </div>
                {/* Email */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                  <div>
                    <strong style={{ color: '#fff', fontSize: '0.875rem' }}>Email</strong>
                    <p style={{ marginTop: '0.25rem' }}>
                      <a href="mailto:info@tercerotablada.com" style={{ color: '#a3a3a3', fontSize: '0.875rem', textDecoration: 'none' }}>
                        info@tercerotablada.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </ScrollAnimation>

            <ScrollAnimation delay={200}>
              <ContactForm />
            </ScrollAnimation>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes scrollPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
