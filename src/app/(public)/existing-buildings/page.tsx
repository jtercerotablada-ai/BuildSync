import type { Metadata } from 'next';
import Link from 'next/link';
import { company, imagery, services } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { Img } from '@/components/ttc/mp/media';
import { ProcessTimeline } from '@/components/ttc/mp/ProcessTimeline';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';

export const metadata: Metadata = {
  title: 'Existing Buildings',
  description:
    'Structural services for existing South Florida buildings — recertification, building safety and milestone inspections, structural condition assessments, repair recommendations, reinspections and compliance documentation.',
  alternates: { canonical: '/existing-buildings' },
  keywords: [
    'building recertification Miami-Dade',
    'building recertification Broward',
    'building safety inspection',
    'structural condition assessment',
    'existing building evaluation',
  ],
  openGraph: {
    title: 'Existing Buildings · Tercero Tablada Civil & Structural Engineering Inc.',
    description:
      'Recertification, safety inspections and structural condition assessments for buildings already standing in South Florida.',
    url: '/existing-buildings',
    type: 'website',
  },
};

const TRIGGERS = [
  {
    k: 'A notice arrived',
    v: 'A recertification or milestone-inspection notice has been issued for the building and the board needs a structural engineer engaged.',
  },
  {
    k: 'Visible distress',
    v: 'Cracking, spalling, corrosion staining or movement has appeared and someone needs to say whether it affects capacity.',
  },
  {
    k: 'Before you spend',
    v: 'Repairs are being priced and the scope has not been defined by an engineer, so the bids are not comparable.',
  },
  {
    k: 'Before you buy',
    v: 'Structural due diligence on an acquisition, including alterations and change-of-use questions.',
  },
];

export default function ExistingBuildingsPage() {
  const existing = services.filter((s) => s.track === 'existing');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: company.url },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Existing Buildings',
        item: `${company.url}/existing-buildings`,
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
        eyebrow="Existing buildings"
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Existing Buildings' }]}
        titleLines={[
          'The building is',
          <span key="l2">
            already <span className="mp-serif">standing.</span>
          </span>,
        ]}
        plainTitle="The building is already standing."
        sub="Recertification, safety inspection and structural assessment for buildings in service. We document what is actually there, explain what it means structurally, and define the work that follows."
        facts={[
          { k: 'For', v: 'Associations, owners, managers' },
          { k: 'Coverage', v: 'Miami-Dade & Broward' },
          { k: 'Output', v: 'Reports, scopes, reinspections' },
        ]}
        photo={imagery.pages.existingBuildings}
      />

      {/* ── When to bring in an engineer ── */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n="01" label="When to call" />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">
                Four moments that need an engineer
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <ul className="mp-pillars">
                {TRIGGERS.map((t) => (
                  <li key={t.k}>
                    <b>{t.k}</b>
                    <span>{t.v}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Services in this track ── */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n="02" label="Services" />
          <div className="mp-svcgrid">
            {existing.map((s) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                className="mp-svccard"
              >
                <div className="mp-svccard__photo" aria-hidden="true">
                  <Img
                    photo={imagery.services[s.slug]}
                    sizes="(max-width: 720px) 100vw, 50vw"
                  />
                </div>
                <span className="mp-svccard__track">Existing buildings</span>
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

      <ProcessTimeline n="03" />

      <ContactCTA n="04" />
    </>
  );
}
