import type { Metadata } from 'next';
import { company } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { LeadershipProfile } from '@/components/ttc/mp/LeadershipProfile';
import { CredentialsBar } from '@/components/ttc/mp/CredentialsBar';
import { SouthFloridaMap } from '@/components/ttc/mp/SouthFloridaMap';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Tercero Tablada Civil & Structural Engineering — a South Florida structural practice covering new reinforced-concrete design and the evaluation of existing buildings, with direct engineering accountability on every project.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About · Tercero Tablada',
    description:
      'A South Florida structural practice covering new construction and existing buildings, with direct engineering accountability.',
    url: '/about',
    type: 'website',
  },
};

const PRINCIPLES = [
  {
    k: 'Rigor',
    v: 'Every member is analyzed and checked against the governing code before it reaches a drawing.',
  },
  {
    k: 'Constructibility',
    v: 'Details that respect the field — buildable, sequenceable and clear to the contractor.',
  },
  {
    k: 'Coordination',
    v: 'Structure resolved against architecture and services early, so conflicts are caught in the model rather than on site.',
  },
  {
    k: 'Documented reasoning',
    v: 'Assumptions, loads and code provisions are written down, so any reviewer can follow the argument.',
  },
  {
    k: 'Longevity',
    v: 'Designed for durability and service life in a coastal environment, not just for the first day of occupancy.',
  },
];

export default function AboutPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: company.url },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'About',
        item: `${company.url}/about`,
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
        eyebrow="About the practice"
        crumbs={[{ href: '/', label: 'Home' }, { label: 'About' }]}
        titleLines={[
          'Structure is a',
          <span key="l2">
            <span className="mp-serif">responsibility</span>,
          </span>,
          'not a deliverable.',
        ]}
        plainTitle="Structure is a responsibility, not a deliverable."
        sub="Tercero Tablada is a structural engineering practice serving Miami-Dade and Broward. We engineer new reinforced-concrete buildings and evaluate the ones already standing — with the reasoning behind every conclusion written down."
        facts={[
          { k: 'Discipline', v: 'Civil & structural' },
          { k: 'Focus', v: 'Concrete, existing buildings, BIM' },
          { k: 'Region', v: 'South Florida' },
        ]}
        art="rebar"
      />

      {/* ── Approach ── */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n="01" label="Approach" meta="How we work" />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">
                Reviewed line by line, before it leaves.
              </h2>
            </Reveal>
            <Reveal delay={0.06} className="mp-prose">
              <p className="mp-lead">
                Two kinds of work run through this practice, and they inform
                each other. Designing new structures teaches you what fails in
                the field; inspecting buildings that have been standing for
                decades teaches you what to detail differently the next time.
              </p>
              <p>
                Our method is model-first. Structure is modelled, coordinated
                and documented as one connected source of truth, checked against
                the design basis, so that the design that gets permitted is the
                design that gets built.
              </p>
              <p>
                On existing buildings the same discipline applies in reverse:
                the building is field-verified before it is analyzed, and
                nothing is concluded from a drawing that has not been confirmed
                on site.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Principles ── */}
      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <SectionHeading n="02" label="Principles" meta="Non-negotiable" />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">How we hold the line.</h2>
            </Reveal>
            <Reveal delay={0.06}>
              <ul className="mp-lead__pillars" style={{ marginBlockStart: 0 }}>
                {PRINCIPLES.map((p) => (
                  <li key={p.k}>
                    <b>{p.k}</b>
                    <span>{p.v}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <LeadershipProfile n="03" />
      <CredentialsBar n="04" />
      <SouthFloridaMap n="05" />
      <ContactCTA n="06" />
    </>
  );
}
