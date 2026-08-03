import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { company, services, serviceBySlug } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SoftwareBand } from '@/components/ttc/mp/SoftwareBand';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) return { title: 'Service not found' };

  return {
    title: service.seo.title,
    description: service.seo.description,
    keywords: service.seo.keywords,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: {
      title: `${service.seo.title} · ${company.name}`,
      description: service.seo.description,
      url: `/services/${service.slug}`,
      type: 'website',
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) notFound();

  const related = services.filter((s) => s.slug !== service.slug).slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: service.title,
        description: service.seo.description,
        serviceType: service.title,
        provider: {
          '@type': 'ProfessionalService',
          name: company.legalName,
          url: company.url,
        },
        areaServed: [
          'Miami-Dade County, Florida',
          'Broward County, Florida',
        ],
        url: `${company.url}/services/${service.slug}`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: company.url },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Expertise',
            item: `${company.url}/services`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: service.title,
            item: `${company.url}/services/${service.slug}`,
          },
        ],
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
        eyebrow={
          service.track === 'new' ? 'New structures' : 'Existing buildings'
        }
        crumbs={[
          { href: '/', label: 'Home' },
          { href: '/services', label: 'Expertise' },
          { label: service.shortTitle },
        ]}
        titleLines={[service.title]}
        plainTitle={service.title}
        sub={service.summary}
        facts={[
          { k: 'Service', v: service.n },
          { k: 'Applies to', v: service.track === 'new' ? 'New construction' : 'Existing buildings' },
          { k: 'Basis', v: service.standards.slice(0, 2).join(' · ') },
        ]}
        photo={service.photo}
      />

      {/* ── The problem ── */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n="01" label="What it solves" />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">Why it matters</h2>
            </Reveal>
            <Reveal delay={0.06} className="mp-prose">
              <p className="mp-lead">{service.problem}</p>
              <h3>Who this is for</h3>
              <ul>
                {service.audience.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Scope ── */}
      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <SectionHeading n="02" label="Typical scope" />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">What the work covers</h2>
            </Reveal>
            <Reveal delay={0.06}>
              <ol className="mp-speclist">
                {service.scope.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Process ── */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading
            n="03"
            label="Process"
            meta={`${String(service.process.length).padStart(2, '0')} stages`}
          />
          <div className="mp-timeline">
            <div className="mp-timeline__track" aria-hidden="true" />
            {service.process.map((p, i) => (
              <Reveal as="div" key={p.step} delay={i * 0.05} className="mp-step is-in">
                <div className="mp-step__node">
                  <span className="mp-step__dot" aria-hidden="true" />
                  <span className="mp-step__n">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mp-step__title">{p.step}</h3>
                <p className="mp-step__detail">{p.detail}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Deliverables + considerations ── */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n="04" label="Deliverables & considerations" />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">What you receive</h2>
            </Reveal>
            <div>
              <Reveal delay={0.06}>
                <ol className="mp-speclist">
                  {service.deliverables.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ol>
              </Reveal>

              <Reveal delay={0.1}>
                <div
                  className="mp-callout"
                  style={{ marginBlockStart: 'var(--mp-12)' }}
                >
                  <h3>Considerations</h3>
                  <div className="mp-prose">
                    <ul>
                      {service.considerations.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.14}>
                <ul
                  className="mp-standards"
                  style={{ marginBlockStart: 'var(--mp-8)' }}
                >
                  {service.standards.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── Toolchain, only where it is actually the subject ── */}
      {service.slug === 'bim-coordination' ? <SoftwareBand n="05" /> : null}

      {/* ── Related ── */}
      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <SectionHeading
            n={service.slug === 'bim-coordination' ? '06' : '05'}
            label="Related expertise"
          />
          <div className="mp-more">
            {related.map((r) => (
              <Link key={r.slug} href={`/services/${r.slug}`}>
                <span className="mp-secnum">{r.n}</span>
                <span className="mp-more__t">{r.title}</span>
                <span className="mp-mono" style={{ color: 'var(--mp-ink-3)' }}>
                  Explore →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ContactCTA n={service.slug === 'bim-coordination' ? '07' : '06'} />
    </>
  );
}
