'use client';

import React from 'react';
import Link from 'next/link';
import { Img } from './media';
import { Reveal, RevealText, SectionHeading, TextLink } from './primitives';
import { accent, accentLines } from './text';
import { useContent, useL } from './lang';

/**
 * The two kinds of client, each with its own door. A visitor should find the
 * sentence that describes them ("I own a building…") and see, in one glance,
 * the services behind that door. The service pages carry the detail.
 */
export function TwoPaths({ n = '01' }: { n?: string }) {
  const c = useContent();
  const l = useL();
  const s = c.pathsSection;

  return (
    <section
      id="practice"
      className="mp-section mp-section--lg mp-surface--paper"
      aria-labelledby="mp-paths-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={s.eyebrow} />

        <div className="mp-paths__intro">
          <RevealText
            as="h2"
            className="mp-paths__title"
            lines={accentLines(s.titleLines, s.accentWord)}
          />
          <span id="mp-paths-title" className="mp-form__hp">
            {s.titleLines.join(' ')}
          </span>
          <Reveal delay={0.08}>
            <p className="mp-paths__lede">{s.lede}</p>
          </Reveal>
        </div>

        <div className="mp-paths">
          {c.paths.map((p, i) => (
            <Reveal as="div" key={p.key} delay={i * 0.06} className="mp-path">
              <Link
                href={l(p.cta.href)}
                className="mp-path__media"
                tabIndex={-1}
                aria-hidden="true"
              >
                <Img
                  photo={p.photo}
                  className="mp-path__photo"
                  sizes="(max-width: 900px) 100vw, 50vw"
                />
              </Link>

              <p className="mp-path__eyebrow">
                <span className="mp-secnum">{p.n}</span>
                {p.eyebrow}
              </p>
              <h3 className="mp-path__title">{accent(p.title, p.accentWord)}</h3>
              <p className="mp-path__lede">{p.lede}</p>

              <ul className="mp-path__services">
                {p.serviceSlugs.map((slug) => {
                  const svc = c.services.find((x) => x.slug === slug);
                  if (!svc) return null;
                  return (
                    <li key={slug}>
                      <Link href={l(`/services/${slug}`)}>
                        <span>{svc.title}</span>
                        <i aria-hidden="true">→</i>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mp-path__cta">
                <TextLink href={l(p.cta.href)}>{p.cta.label}</TextLink>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
