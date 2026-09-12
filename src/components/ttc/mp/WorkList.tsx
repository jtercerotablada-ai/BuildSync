'use client';

import React from 'react';
import { imagery } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';
import { useContent } from './lang';

/**
 * Work. Three honest states and no fourth:
 *
 *   • `caseStudies` has entries → real projects, grouped into FIRM PROJECTS
 *     and PRIOR PROFESSIONAL EXPERIENCE so a visitor never mistakes one for
 *     the other. Each shows the building type, general location, problem,
 *     scope, our role and the documented result. Illustrative photographs are
 *     labelled as such.
 *   • `caseStudies` is empty → anonymized representative engagements, with
 *     the note saying exactly what they are.
 *   • There is no "coming soon" state.
 */
export function WorkList({ n = '01' }: { n?: string }) {
  const c = useContent();
  const u = c.ui.work;
  const real = c.caseStudies;
  const usingReal = real.length > 0;
  const label = usingReal ? c.workSection.eyebrowReal : c.workSection.eyebrowRepresentative;

  const groups = usingReal
    ? [
        { key: 'firm', title: u.firmProjects, note: null, items: real.filter((x) => x.attribution === 'firm') },
        { key: 'prior', title: u.priorExperience, note: u.priorNote, items: real.filter((x) => x.attribution === 'prior') },
      ].filter((g) => g.items.length)
    : [];

  return (
    <section
      className="mp-section mp-section--lg mp-surface--paper"
      aria-labelledby="mp-work-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={label} />
        <h2 id="mp-work-title" className="mp-form__hp">
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
          <div className="mp-work">
            {c.engagements.map((e, i) => (
              <Reveal as="div" key={e.n} delay={(i % 2) * 0.05} className="mp-work__item">
                {imagery.engagements[e.n] ? (
                  <div className="mp-work__photo" aria-hidden="true">
                    <Img photo={imagery.engagements[e.n]} sizes="(max-width: 900px) 100vw, 46vw" />
                    <span className="mp-work__illus">{u.illustrative}</span>
                  </div>
                ) : null}
                <div className="mp-work__head">
                  <span className="mp-secnum">{e.n}</span>
                  <h3 className="mp-work__title">{e.title}</h3>
                </div>
                <dl className="mp-work__specs">
                  <div><dt>{u.projectType}</dt><dd>{e.projectType}</dd></div>
                  <div><dt>{u.location}</dt><dd>{e.location}</dd></div>
                  <div><dt>{u.scope}</dt><dd>{e.scope}</dd></div>
                  <div><dt>{u.structuralSystem}</dt><dd>{e.structuralSystem}</dd></div>
                  <div><dt>{u.deliverables}</dt><dd>{e.deliverables}</dd></div>
                  <div><dt>{u.codes}</dt><dd>{e.codes}</dd></div>
                  <div>
                    <dt>{u.status}</dt>
                    <dd><span className="mp-work__status">{e.status}</span></dd>
                  </div>
                </dl>
              </Reveal>
            ))}
          </div>
        )}

        {!usingReal ? (
          <Reveal delay={0.05}>
            <p className="mp-work__note">{c.workSection.engagementsNote}</p>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
