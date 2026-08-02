import type { Metadata } from 'next';
import { company, contact, services } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactForm } from '@/components/ttc/mp/ContactForm';
import { SouthFloridaMap } from '@/components/ttc/mp/SouthFloridaMap';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Tercero Tablada Civil & Structural Engineering Inc. Describe your project, building or compliance requirement and an engineer will define the appropriate structural scope and next steps.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact · Tercero Tablada Civil & Structural Engineering Inc.',
    description:
      'Tell us about your project, building or compliance requirement. We will define the engineering scope and next steps.',
    url: '/contact',
    type: 'website',
  },
};

export default function ContactPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: company.url },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Contact',
        item: `${company.url}/contact`,
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
        eyebrow="Start a project"
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Contact' }]}
        titleLines={[
          'Bring us the structure.',
          <span key="l2">
            We’ll carry the{' '}
            <span className="mp-serif">responsibility.</span>
          </span>,
        ]}
        plainTitle="Bring us the structure. We’ll carry the responsibility."
        sub="Tell us about your project, building or compliance requirement. We will help define the appropriate engineering scope and next steps."
        art="peer"
      />

      <section
        className="mp-section mp-surface--paper"
        aria-labelledby="mp-contact-title"
      >
        <div className="mp-shell">
          <SectionHeading n="01" label="Inquiry" meta="Reviewed by an engineer" />
          <h2 id="mp-contact-title" className="mp-form__hp">
            Project inquiry
          </h2>

          <div className="mp-contact__grid">
            <ContactForm />

            <aside>
              <div className="mp-info">
                <div className="mp-info__block">
                  <span className="mp-info__label">Email</span>
                  <a
                    className="mp-info__value"
                    href={`mailto:${contact.email}`}
                  >
                    {contact.email}
                  </a>
                  <span className="mp-info__meta">
                    Best for scope, drawings and permit questions. Attachments
                    are welcome by email.
                  </span>
                </div>

                {contact.phone ? (
                  <div className="mp-info__block">
                    <span className="mp-info__label">Phone</span>
                    <a className="mp-info__value" href={contact.phone.href}>
                      {contact.phone.display}
                    </a>
                  </div>
                ) : null}

                {contact.address ? (
                  <div className="mp-info__block">
                    <span className="mp-info__label">Office</span>
                    <span className="mp-info__value">
                      {contact.address.line1}
                    </span>
                    <span className="mp-info__meta">
                      {contact.address.line2
                        ? `${contact.address.line2}, `
                        : ''}
                      {contact.address.city}, {contact.address.state}{' '}
                      {contact.address.zip}
                    </span>
                  </div>
                ) : null}

                <div className="mp-info__block">
                  <span className="mp-info__label">Service area</span>
                  <span className="mp-info__value">
                    {contact.serviceAreaLabel}
                  </span>
                  <span className="mp-info__meta">
                    On-site inspection and coordination across South Florida.
                  </span>
                </div>

                <div className="mp-info__block">
                  <span className="mp-info__label">What we cover</span>
                  <ul className="mp-standards">
                    {services.map((s) => (
                      <li key={s.slug}>{s.shortTitle}</li>
                    ))}
                  </ul>
                  <span className="mp-info__meta">
                    {contact.responseNote}
                  </span>
                </div>
              </div>
            </aside>
          </div>

          <Reveal delay={0.08}>
            <p className="mp-disclaimer">
              Descriptions on this site are general. The scope, sequence and
              deliverables for any specific building are confirmed in writing
              before work begins, and requirements vary by jurisdiction.
            </p>
          </Reveal>
        </div>
      </section>

      <SouthFloridaMap n="02" />
    </>
  );
}
