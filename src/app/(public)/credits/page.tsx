import type { Metadata } from 'next';
import { company } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { SectionHeading } from '@/components/ttc/mp/primitives';

export const metadata: Metadata = {
  title: 'Image Credits · Tercero Tablada Civil & Structural Engineering Inc.',
  description:
    'Attribution for the architectural photography used on this site, and the licence each image is published under.',
  alternates: { canonical: '/credits' },
  robots: { index: true, follow: true },
};

/**
 * The photography on this site is licensed, not owned. CC BY and CC BY-SA both
 * require attribution "in a manner reasonable to the medium" — for a website
 * that means a page a visitor can actually reach, not only a file in the
 * repository. When real Tercero Tablada project photography replaces these,
 * this page can go with them.
 */
const CREDITS = [
  {
    file: 'hero-bg.jpg',
    used: 'Home hero · About · Structural condition assessments',
    author: 'Unattributed at time of import',
    licence: 'Provenance being confirmed',
    source: null,
  },
  {
    file: 'team.jpg',
    used: 'Expertise · Work',
    author: 'PortlandAppraisalBlog',
    licence: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:HollywoodHUB_under_construction_with_tower_crane_at_Hollywood_Transit_Center,_Portland,_Oregon_(January_2026).jpg',
  },
  {
    file: 'projects/project-01.jpg',
    used: 'Existing buildings path · Building recertification',
    author: 'Antti Leppänen',
    licence: 'CC BY 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Merihaka_apartment_high-rises.JPG',
  },
  {
    file: 'projects/project-02.jpg',
    used: 'New structures path · BIM coordination · Contact',
    author: 'Jonathan Simcoe',
    licence: 'CC0 1.0 (public domain)',
    source:
      'https://commons.wikimedia.org/wiki/File:Glass_building_corner_(Unsplash).jpg',
  },
  {
    file: 'projects/project-06.jpg',
    used: 'Structural analysis & foundations',
    author: 'Asopotnik',
    licence: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Highway_bridge_over_Mura_River.jpg',
  },
  {
    file: 'projects/project-09.jpg',
    used: 'Existing buildings · Building safety inspections',
    author: 'Wikimedia Commons contributor',
    licence: 'CC BY-SA 2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Firman_Desloge_Hospital_Building,_St._Louis_University_Medical_Center,_Grand_Boulevard,_The_Gate,_St._Louis,_MO_-_54223708669.jpg',
  },
  {
    file: 'projects/project-12.jpg',
    used: 'Reinforced concrete design · Peer review',
    author: 'Dietmar Rabich',
    licence: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Bonn,_Post-Tower_--_2017_--_2128_(bw).jpg',
  },
];

export default function CreditsPage() {
  return (
    <>
      <PageHero
        eyebrow="Attribution"
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Image Credits' }]}
        titleLines={['Image Credits']}
        plainTitle="Image Credits"
        sub="The architectural photography on this site is licensed from third-party photographers and shown as material, not as a portfolio. None of it depicts a Tercero Tablada Civil & Structural Engineering Inc. project."
      />

      <section className="mp-section mp-surface--paper">
        <div className="mp-shell mp-shell--narrow">
          <SectionHeading n="01" label="Photography" meta="Licensed" />

          <div className="mp-work__specs" style={{ marginBlockEnd: 'var(--mp-12)' }}>
            {CREDITS.map((c) => (
              <div key={c.file + c.used}>
                <dt>{c.file}</dt>
                <dd>
                  {c.author} — {c.licence}
                  <br />
                  <span style={{ color: 'var(--mp-ink-3)' }}>Used on: {c.used}</span>
                  {c.source ? (
                    <>
                      <br />
                      <a
                        href={c.source}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                        style={{
                          color: 'var(--mp-ink)',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px',
                          textDecorationColor: 'var(--mp-gold)',
                          wordBreak: 'break-word',
                        }}
                      >
                        Source
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
            ))}
          </div>

          <div className="mp-prose">
            <h2>Third-party software marks</h2>
            <p>
              The Revit, Navisworks, Autodesk, CYPE, BCF and buildingSMART logos
              are used nominatively to identify the software in our workflow.
              They are shown unmodified apart from a display filter and remain
              the property of their respective owners.
            </p>

            <h2>Replacing these</h2>
            <p>
              Every image above stands in for photography{' '}
              {company.name} does not yet own. As real project photography
              becomes available it replaces these files, the attribution
              obligation disappears with them, and this page can be retired.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
