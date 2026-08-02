import type { Metadata } from 'next';
import { company, contact } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { SectionHeading } from '@/components/ttc/mp/primitives';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: `Terms governing use of the ${company.legalName} website.`,
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Terms of Use' }]}
        titleLines={['Terms of Use']}
        plainTitle="Terms of Use"
        sub="The basis on which the information published here is provided."
      />

      <section className="mp-section mp-surface--paper">
        <div className="mp-shell mp-shell--narrow">
          <SectionHeading n="01" label="Terms" />
          <div className="mp-prose">
            <h2>General information only</h2>
            <p>
              The content on this website describes services in general terms.
              It is not an engineering opinion, a recommendation for a specific
              building, or a substitute for a site-specific evaluation. Nothing
              here should be relied on as the basis for a construction, repair
              or compliance decision.
            </p>

            <h2>No professional relationship</h2>
            <p>
              Visiting this site, reading it, or submitting the contact form does
              not create a professional engineering relationship. An engagement
              begins only when scope, fee and terms are agreed in writing.
            </p>

            <h2>Regulatory outcomes</h2>
            <p>
              Requirements for inspection, recertification and permitting vary by
              jurisdiction, building age, construction type and scope. Descriptions
              of any process on this site are typical sequences, not guarantees.
              We do not promise approval by any building department or reviewing
              authority.
            </p>

            <h2>Sealed documents</h2>
            <p>
              Where a signed and sealed document is required, it is issued as a
              formal deliverable under an agreed scope of work. Content on this
              website is never a sealed deliverable.
            </p>

            <h2>Accuracy and availability</h2>
            <p>
              We keep this site current, but do not warrant that every statement
              is complete or free of error, or that the site will always be
              available.
            </p>

            <h2>Intellectual property</h2>
            <p>
              The text, drawings, diagrams and marks on this site belong to{' '}
              {company.legalName} unless stated otherwise, and may not be
              reproduced without permission.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these terms:{' '}
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
