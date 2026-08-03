import type { Metadata } from 'next';
import Link from 'next/link';
import { company, imagery, services } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ServiceArt } from '@/components/ttc/mp/art';
import { EngineeringProcess } from '@/components/ttc/mp/EngineeringProcess';
import { CredentialsBar } from '@/components/ttc/mp/CredentialsBar';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SectionHeading } from '@/components/ttc/mp/primitives';

export const metadata: Metadata = {
  title: 'Expertise',
  description:
    'Structural engineering expertise across South Florida — reinforced-concrete design, structural analysis and foundations, BIM coordination, building recertification, safety inspections, condition assessments and peer review.',
  alternates: { canonical: '/services' },
  keywords: [
    'structural engineering South Florida',
    'structural engineer Miami',
    'reinforced concrete design',
    'building recertification Miami-Dade',
    'BIM coordination',
  ],
  openGraph: {
    title: 'Expertise · Tercero Tablada Civil & Structural Engineering Inc.',
    description:
      'Seven structural engineering services for new construction and existing buildings across Miami-Dade and Broward.',
    url: '/services',
    type: 'website',
  },
};

const trackLabel: Record<string, string> = {
  new: 'New structures',
  existing: 'Existing buildings',
};

export default function ServicesPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: company.url },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Expertise',
        item: `${company.url}/services`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        eyebrow="Expertise"
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Expertise' }]}
        titleLines={[
          'One practice for the',
          <span key="l2">
            whole <span className="mp-serif">structure.</span>
          </span>,
        ]}
        plainTitle="One practice for the whole structure."
        sub="Seven services covering both halves of the work: engineering new structures, and evaluating the ones already standing. The same engineer, the same standard of documentation, across every one."
        facts={[
          { k: 'Services', v: String(services.length) },
          { k: 'Coverage', v: 'Miami-Dade & Broward' },
          { k: 'Scope', v: 'New build & existing' },
        ]}
        photo={imagery.pages.services}
      />

      <section
        className="mp-section mp-surface--paper"
        aria-labelledby="mp-svcindex-title"
      >
        <div className="mp-shell">
          <SectionHeading
            n="01"
            label="Capabilities"
            meta={`${String(services.length).padStart(2, '0')} services`}
          />
          <h2 id="mp-svcindex-title" className="mp-form__hp">
            Capabilities
          </h2>

          <div className="mp-svcgrid">
            {services.map((s) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                className="mp-svccard"
              >
                <div className="mp-svccard__top">
                  <span className="mp-secnum">{s.n}</span>
                  <span className="mp-svccard__track">
                    {trackLabel[s.track]}
                  </span>
                </div>
                <div className="mp-svccard__art" aria-hidden="true">
                  <ServiceArt kind={s.art} />
                </div>
                <h3 className="mp-svccard__title">{s.title}</h3>
                <p className="mp-svccard__desc">{s.summary}</p>
                <span className="mp-svccard__go">
                  Explore service <i aria-hidden="true">→</i>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <EngineeringProcess n="02" />
      <CredentialsBar n="03" />
      <ContactCTA n="04" />
    </>
  );
}
