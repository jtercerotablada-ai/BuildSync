import type { Metadata } from 'next';
import { company, engagements, projects } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { SelectedExperience } from '@/components/ttc/mp/SelectedExperience';
import { EngineeringProcess } from '@/components/ttc/mp/EngineeringProcess';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';

export const metadata: Metadata = {
  title: 'Work',
  description:
    'Representative structural engineering engagements — project types, structural systems, scope and deliverables for new construction and existing buildings across South Florida.',
  alternates: { canonical: '/projects' },
  openGraph: {
    title: 'Work · Tercero Tablada',
    description:
      'Representative structural engineering engagements — systems, scope and deliverables across South Florida.',
    url: '/projects',
    type: 'website',
  },
};

export default function ProjectsPage() {
  const usingReal = projects.length > 0;
  const count = usingReal ? projects.length : engagements.length;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: company.url },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Work',
        item: `${company.url}/projects`,
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
        eyebrow={usingReal ? 'Selected work' : 'Representative capabilities'}
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Work' }]}
        titleLines={[
          'The frame behind',
          <span key="l2">
            the <span className="mp-serif">project.</span>
          </span>,
        ]}
        plainTitle="The frame behind the project."
        sub={
          usingReal
            ? 'Structural engagements across South Florida — the system, the scope, and what was delivered.'
            : 'Engagement profiles describing the structural systems we work with, the scope each one carries, and the documents that come out of it. Anonymized by default; named case studies are published only with client permission.'
        }
        facts={[
          { k: 'Profiles', v: String(count).padStart(2, '0') },
          { k: 'Coverage', v: 'Miami-Dade & Broward' },
          { k: 'Systems', v: 'Reinforced concrete, steel' },
        ]}
        art="bim"
      />

      <SelectedExperience n="01" showLink={false} />
      <EngineeringProcess n="02" />
      <ContactCTA n="03" />
    </>
  );
}
