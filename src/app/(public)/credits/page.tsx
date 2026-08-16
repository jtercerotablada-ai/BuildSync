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
 * The photography on this site is licensed, not owned.
 *
 * As of the move to the Pexels media set, NOTHING ON THE SITE REQUIRES
 * ATTRIBUTION any more: every photograph and every clip but one is
 * Pexels-licensed — commercial use, no attribution, no share-alike. The
 * exception is `bim-assembly.mp4`, licensed through the firm's own Artlist /
 * Artgrid subscription, which likewise carries no attribution requirement, so
 * it does not add a row below either. The
 * Creative Commons files listed below are no longer shown on any page; they
 * remain in the repository and are still reachable by direct URL, which is why
 * their attribution is kept here rather than deleted. Removing the files is
 * what retires this page.
 *
 * CC BY and CC BY-SA both require attribution "in a manner reasonable to the
 * medium" — for a website that means a page a visitor can actually reach, not
 * only a file in the repository.
 */
const CREDITS = [
  {
    file: 'hero-bg.jpg',
    used: 'Home hero',
    author: 'Unattributed at time of import',
    licence: 'Provenance being confirmed',
    source: null,
  },
  {
    file: 'projects/project-02.jpg',
    used: 'Home — "Design new structures"',
    author: 'Jonathan Simcoe',
    licence: 'CC0 1.0 (public domain)',
    source:
      'https://commons.wikimedia.org/wiki/File:Glass_building_corner_(Unsplash).jpg',
  },
  {
    file: 'projects/project-01.jpg',
    used: 'Home — "Evaluate existing buildings"',
    author: 'Antti Leppänen',
    licence: 'CC BY 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Merihaka_apartment_high-rises.JPG',
  },
  {
    file: 'team.jpg',
    used: 'Expertise',
    author: 'PortlandAppraisalBlog',
    licence: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:HollywoodHUB_under_construction_with_tower_crane_at_Hollywood_Transit_Center,_Portland,_Oregon_(January_2026).jpg',
  },
  {
    file: 'projects/project-09.jpg',
    used: 'Existing Buildings',
    author: 'Wikimedia Commons contributor',
    licence: 'CC BY-SA 2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Firman_Desloge_Hospital_Building,_St._Louis_University_Medical_Center,_Grand_Boulevard,_The_Gate,_St._Louis,_MO_-_54223708669.jpg',
  },
  {
    file: 'projects/project-12.jpg',
    used: 'Work',
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
        sub="The architectural photography on this site is licensed from third-party photographers and shown as material and typology, never as a portfolio. Each image appears in exactly one place, and none of it depicts a Tercero Tablada Civil & Structural Engineering Inc. project."
      />

      <section className="mp-section mp-surface--paper">
        <div className="mp-shell mp-shell--narrow">
          <SectionHeading n="01" label="Photography" meta="Licensed" />

          <div className="mp-prose" style={{ marginBlockEnd: 'var(--mp-12)' }}>
            <p>
              The photography and video currently shown across this site are
              licensed under the <strong>Pexels licence</strong>: free for
              commercial use, modification permitted, and{' '}
              <strong>no attribution required</strong>. They are not listed
              individually here because nothing is owed for them.
            </p>
            <p>
              The Creative Commons images below are <strong>no longer displayed
              on any page</strong>. They remain in the repository and are still
              reachable by direct URL, so their attribution stays published.
            </p>
          </div>

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
              Every image on this site stands in for photography{' '}
              {company.name} does not yet own. As real project photography
              becomes available it replaces these files one at a time, in{' '}
              <code>src/lib/ttc/media.ts</code>, without touching a component —
              and each replacement makes the site more genuinely the firm&rsquo;s
              own.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
