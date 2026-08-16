'use client';

import React from 'react';
import {
  engagements,
  engagementsNote,
  imagery,
  projects,
  type Engagement,
} from '@/lib/ttc/site';
import { ServiceArt } from './art';
import { Img } from './media';
import { Reveal, SectionHeading, TextLink } from './primitives';

/**
 * Work section. It renders real project case studies when `projects` has
 * entries, and otherwise renders anonymized representative engagements.
 * There is no third state — no empty cards, no "photo forthcoming", no
 * placeholder tiles. Adding a real project to `site.ts` is all it takes to
 * switch this section over.
 */
export function SelectedExperience({
  n = '05',
  showLink = true,
  limit,
}: {
  n?: string;
  showLink?: boolean;
  limit?: number;
}) {
  const usingReal = projects.length > 0;
  const source: Engagement[] = usingReal ? projects : engagements;
  const items = typeof limit === 'number' ? source.slice(0, limit) : source;
  const label = usingReal ? 'Selected work' : 'Representative capabilities';

  return (
    <section
      className="mp-section mp-section--lg mp-surface--paper"
      aria-labelledby="mp-work-title"
    >
      <div className="mp-shell">
        <SectionHeading
          n={n}
          label={label}
          meta={`${String(items.length).padStart(2, '0')} profiles`}
        />
        <h2 id="mp-work-title" className="mp-form__hp">
          {label}
        </h2>

        <div className="mp-work">
          {items.map((e, i) => (
            <Reveal
              as="div"
              key={e.n}
              delay={(i % 2) * 0.07}
              className="mp-work__item"
            >
              {/* Photograph where one exists, line-art where it does not.
                  Never both: a technical overlay on a real building fights
                  the image and neither reads. */}
              {imagery.engagements[e.n] ? (
                <div className="mp-work__photo" aria-hidden="true">
                  <Img
                    photo={imagery.engagements[e.n]}
                    sizes="(max-width: 900px) 100vw, 46vw"
                  />
                </div>
              ) : (
                <div className="mp-work__art" aria-hidden="true">
                  <ServiceArt kind={e.art} />
                </div>
              )}

              <div className="mp-work__head">
                <span className="mp-secnum">{e.n}</span>
                <h3 className="mp-work__title">{e.title}</h3>
              </div>

              <dl className="mp-work__specs">
                <div>
                  <dt>Project type</dt>
                  <dd>{e.projectType}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{e.location}</dd>
                </div>
                <div>
                  <dt>Scope</dt>
                  <dd>{e.scope}</dd>
                </div>
                <div>
                  <dt>Structural system</dt>
                  <dd>{e.structuralSystem}</dd>
                </div>
                <div>
                  <dt>Deliverables</dt>
                  <dd>{e.deliverables}</dd>
                </div>
                <div>
                  <dt>Codes</dt>
                  <dd>{e.codes}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className="mp-work__status">{e.status}</span>
                  </dd>
                </div>
              </dl>
            </Reveal>
          ))}
        </div>

        {!usingReal ? (
          <Reveal delay={0.06}>
            <p className="mp-work__note">{engagementsNote}</p>
          </Reveal>
        ) : null}

        {showLink ? (
          <Reveal delay={0.1} className="mp-cta-row">
            <TextLink href="/projects">See the full scope</TextLink>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
