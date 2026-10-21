'use client';

import React from 'react';
import Link from 'next/link';
import { engagementServices } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';
import { useContent, useL } from './lang';

/**
 * Work. Three honest states and no fourth:
 *
 *   • `caseStudies` has entries → real projects, grouped into FIRM PROJECTS
 *     and PRIOR PROFESSIONAL EXPERIENCE so a visitor never mistakes one for
 *     the other. Each shows the building type, general location, problem,
 *     scope, our role and the documented result, as a photo card (lg
 *     rhythm). Illustrative photographs are labelled as such.
 *   • `caseStudies` is empty → TYPICAL ENGAGEMENTS, as one register
 *     (`.mp-work--register`): a row per profile — the reader's situation
 *     (`need`), the service page that answers it, and four facts (project
 *     type, scope, structural system, deliverables). No photograph: a big
 *     16:10 frame over each profile, some of identifiable towers, read as
 *     "our projects". No Status row and no footnote: the hero's lede says
 *     once what these are. They carry no location row either: the honest
 *     value ("Miami-Dade or Broward") is the same on all six and already
 *     stated by the hero's Coverage fact. No code row — the client site does
 *     not list code standards.
 *   • There is no "coming soon" state.
 *
 * The register reads three ways (mp.css, section 15): run-in "LABEL value"
 * lines on a phone; the profile beside a 2 × 2 of the facts from 901px; one
 * table with a single header row from 1181px, where each row's labels are
 * only visually hidden — the dt stays in the HTML on every row ("Project
 * type" answers the H1's "type"). The header row is aria-hidden: the dts
 * already name every value. A text space sits between each dt and dd, or the
 * run-in rows render "PROJECT TYPEResidential" as one word.
 *
 * Each profile's link names the service by its own short name, looked up by
 * slug in `engagementServices`; a slug with no service renders nothing. The
 * links sit in a <div>, not a <p>: two of them make a block of six words in
 * Spanish, which the one-home tests would then count.
 *
 * The visible section label is hidden from assistive tech; the visually
 * hidden h2 carries the same words, so the label is announced once, as the
 * section's heading.
 */
export function WorkList({ n = '01' }: { n?: string }) {
  const c = useContent();
  const l = useL();
  const u = c.ui.work;
  const real = c.caseStudies;
  const usingReal = real.length > 0;
  const label = usingReal ? c.workSection.eyebrowReal : c.ui.typicalEngagements;
  const bySlug = new Map(c.services.map((s) => [s.slug, s]));

  const groups = usingReal
    ? [
        { key: 'firm', title: u.firmProjects, note: null, items: real.filter((x) => x.attribution === 'firm') },
        { key: 'prior', title: u.priorExperience, note: u.priorNote, items: real.filter((x) => x.attribution === 'prior') },
      ].filter((g) => g.items.length)
    : [];

  return (
    <section
      className={usingReal ? 'mp-section mp-section--lg mp-surface--paper' : 'mp-section mp-surface--paper'}
      aria-labelledby="mp-work-title"
    >
      <div className="mp-shell">
        <div aria-hidden="true">
          <SectionHeading n={n} label={label} />
        </div>
        <h2 id="mp-work-title" className="mp-sr-only">
          {label}
        </h2>

        {usingReal ? (
          groups.map((g) => (
            <div key={g.key} className="mp-work__group">
              <h3 className="mp-work__group-title">{g.title}</h3>
              {g.note ? <p className="mp-note" style={{ margin: '0 0 var(--mp-8)' }}>{g.note}</p> : null}
              <div className="mp-work">
                {g.items.map((cs, i) => (
                  <Reveal as="div" key={cs.n} delay={(i % 2) * 0.05} className="mp-work__item">
                    {cs.photo ? (
                      <div className="mp-work__photo" aria-hidden="true">
                        <Img photo={cs.photo} sizes="(max-width: 900px) 100vw, 46vw" />
                        {cs.photoIsIllustrative ? (
                          <span className="mp-work__illus">{u.illustrative}</span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mp-work__head">
                      <span className="mp-secnum">{cs.n}</span>
                      <h4 className="mp-work__title">{cs.title}</h4>
                    </div>
                    <dl className="mp-work__specs">
                      <div><dt>{u.projectType}</dt><dd>{cs.projectType}</dd></div>
                      <div><dt>{u.location}</dt><dd>{cs.location}</dd></div>
                      <div><dt>{u.problem}</dt><dd>{cs.problem}</dd></div>
                      <div><dt>{u.scope}</dt><dd>{cs.scope}</dd></div>
                      <div><dt>{u.role}</dt><dd>{cs.role}</dd></div>
                      <div><dt>{u.result}</dt><dd>{cs.result}</dd></div>
                    </dl>
                  </Reveal>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="mp-work mp-work--register">
            <div className="mp-work__cols" aria-hidden="true">
              <span />
              <span className="mp-work__cols-specs">
                <span>{u.projectType}</span>
                <span>{u.scope}</span>
                <span>{u.structuralSystem}</span>
                <span>{u.deliverables}</span>
              </span>
            </div>
            {c.engagements.map((e, i) => (
              <Reveal as="div" key={e.n} delay={(i % 3) * 0.04} className="mp-work__item">
                <div className="mp-work__head">
                  <span className="mp-secnum">{e.n}</span>
                  <h3 className="mp-work__title">{e.title}</h3>
                </div>
                <p className="mp-work__need">{e.need}</p>
                <dl className="mp-work__specs">
                  <div><dt>{u.projectType}</dt>{' '}<dd>{e.projectType}</dd></div>
                  <div><dt>{u.scope}</dt>{' '}<dd>{e.scope}</dd></div>
                  <div><dt>{u.structuralSystem}</dt>{' '}<dd>{e.structuralSystem}</dd></div>
                  <div><dt>{u.deliverables}</dt>{' '}<dd>{e.deliverables}</dd></div>
                </dl>
                <div className="mp-work__more">
                  {(engagementServices[e.n] ?? []).map((slug, k) => {
                    const s = bySlug.get(slug);
                    return s ? (
                      <React.Fragment key={slug}>
                        {k ? ' ' : null}
                        <Link href={l(`/services/${slug}`)} className="mp-link">
                          {s.shortTitle} <i aria-hidden="true">→</i>
                        </Link>
                      </React.Fragment>
                    ) : null;
                  })}
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
