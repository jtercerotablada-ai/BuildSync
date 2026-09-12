import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { company, imagery } from '@/lib/ttc/site';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SoftwareBand } from '@/components/ttc/mp/SoftwareBand';
import { ButtonLink, SectionHeading, Reveal } from '@/components/ttc/mp/primitives';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * One service, in the order a client asks the questions: why it matters →
 * when you need it → what is included → what you receive → how it runs →
 * when it applies (regulated services) → good to know → next step.
 */
export function ServiceDetailView({ lang, slug }: { lang: Lang; slug: string }) {
  const c = getContent(lang);
  const u = c.ui;
  const service = c.services.find((s) => s.slug === slug);
  if (!service) return null;
  const l = (href: string) => localePath(href, lang);
  const related = c.services.filter((s) => s.slug !== slug && s.track === service.track).slice(0, 3);
  const isBim = service.slug === 'bim-coordination';
  const trackLabel = service.track === 'new' ? u.newProjects : u.existingBuildings;

  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.title,
    description: service.seo.description,
    serviceType: service.title,
    inLanguage: lang,
    provider: { '@type': 'ProfessionalService', name: company.legalName, url: company.url },
    areaServed: ['Miami-Dade County, Florida', 'Broward County, Florida'],
    url: `${company.url}${l(`/services/${service.slug}`)}`,
  };

  let n = 0;
  const next = () => String(++n).padStart(2, '0');

  return (
    <>
      <JsonLd data={serviceLd} />
      <JsonLd
        data={breadcrumbLd(lang, [
          { name: u.home, path: '/' },
          { name: c.primaryNav[0].label, path: '/services' },
          { name: service.title, path: `/services/${service.slug}` },
        ])}
      />

      <PageHero
        eyebrow={trackLabel}
        crumbs={[
          { href: '/', label: u.home },
          { href: '/services', label: c.primaryNav[0].label },
          { label: service.shortTitle },
        ]}
        titleLines={[service.title]}
        plainTitle={service.title}
        sub={service.summary}
        facts={[
          { k: u.service, v: service.n },
          { k: u.appliesTo, v: service.track === 'new' ? u.newConstruction : u.existingBuildings },
          { k: u.basis, v: service.standards.slice(0, 2).join(' · ') },
        ]}
        photo={imagery.services[service.slug]}
      />

      {/* Why it matters + when you need it */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.whenYouNeedIt} />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">{service.problem}</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <ul className="mp-pillars mp-pillars--plain">
                {service.when.map((w, i) => (
                  <li key={w}>
                    <b>{String(i + 1).padStart(2, '0')}</b>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
              <p className="mp-note" style={{ marginTop: 'var(--mp-6)' }}>
                {service.audience.join(' · ')}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* What's included + what you receive */}
      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.whatsIncluded} />
          <div className="mp-cols2">
            <Reveal>
              <h2 className="mp-h3 mp-cols2__title">{u.whatsIncluded}</h2>
              <ol className="mp-speclist">
                {service.scope.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mp-h3 mp-cols2__title">{u.whatYouReceive}</h2>
              <ol className="mp-speclist mp-speclist--gold">
                {service.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ol>
              <div className="mp-callout mp-callout--spaced mp-callout--next">
                <h3>{u.nextStep}</h3>
                <p>{service.nextStep}</p>
                <div className="mp-cta-row" style={{ marginTop: 'var(--mp-4)' }}>
                  <ButtonLink href={l(`/contact?service=${encodeURIComponent(service.shortTitle)}`)} variant="solid">
                    {u.requestProposal}
                  </ButtonLink>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* When it applies — regulated services only */}
      {service.timing ? (
        <section className="mp-section mp-surface--paper">
          <div className="mp-shell">
            <SectionHeading n={next()} label={u.whenItApplies} />
            <div className="mp-juris">
              {service.timing.rows.map((row) => (
                <Reveal as="div" key={row.jurisdiction} className="mp-juris__card">
                  <h3 className="mp-juris__title">{row.jurisdiction}</h3>
                  <dl className="mp-timing">
                    {row.facts.map((f) => (
                      <div key={f.k}>
                        <dt>{f.k}</dt>
                        <dd>{f.v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mp-timing__src">{row.source}</p>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.06}>
              <p className="mp-timing__note">{service.timing.note}</p>
              <p className="mp-timing__src">
                {u.lastChecked}: {service.timing.checked}
              </p>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* How it runs */}
      <section className={`mp-section ${service.timing ? 'mp-surface--concrete' : 'mp-surface--paper'}`}>
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.howItRuns} />
          <div className="mp-timeline">
            <div className="mp-timeline__track" aria-hidden="true" />
            {service.process.map((p, i) => (
              <Reveal as="div" key={p.step} delay={i * 0.04} className="mp-step is-in">
                <div className="mp-step__node">
                  <span className="mp-step__dot" aria-hidden="true" />
                  <span className="mp-step__n">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mp-step__title">{p.step}</h3>
                <p className="mp-step__detail">{p.detail}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Good to know */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.considerations} />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">{u.considerations}</h2>
            </Reveal>
            <Reveal delay={0.05} className="mp-prose">
              <ul>
                {service.considerations.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p className="mp-basis">
                {u.designBasis} · {service.standards.join(' · ')}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {isBim ? <SoftwareBand n={next()} variant="full" /> : null}

      {/* Related */}
      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.relatedServices} />
          <div className="mp-more">
            {related.map((r) => (
              <Link key={r.slug} href={l(`/services/${r.slug}`)}>
                <span className="mp-secnum">{r.n}</span>
                <span className="mp-more__t">{r.title}</span>
                <span className="mp-more__go">
                  {u.explore} <i aria-hidden="true">→</i>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ContactCTA n={next()} />
    </>
  );
}
