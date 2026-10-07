'use client';

import React from 'react';
import Link from 'next/link';
import { imagery } from '@/lib/ttc/site';
import { Img } from './media';
import { ButtonLink, Reveal, SectionHeading } from './primitives';
import { useContent, useL } from './lang';

/**
 * The person behind the practice.
 *
 * Two variants share one composition: `teaser` on the home page (name,
 * credential, two sentences, one link) and `full` on the About page
 * (biography, education, focus, approach, what it means for the client,
 * license verification when supplied).
 *
 * THE TWO PRINT NO SENTENCE IN COMMON. They used to share the line over the
 * headline and the three "What that means for you" rows, word for word. The
 * teaser now carries the license number over its promise and the three rows
 * as their names alone; About keeps the role line and the rows in full.
 *
 * BOTH VARIANTS NAME THE ENGINEER. The home teaser used to make its promise —
 * one accountable engineer — without saying who, and dropped the name row
 * from the plate. The owner asked to be named (2026-10-06), and the partner
 * block right under the teaser prints his name and P.E. number anyway. What
 * still differs is the headline: About leads with the name; the teaser keeps
 * its own label and the promise as its h2, and names him on the plate (on
 * the portrait's caption, once there is one).
 *
 * THE PORTRAIT SLOT IS HONEST. When `leadership.portrait` is null the figure
 * renders a typographic plate — the firm's real monogram over a darkened
 * photograph of structure, with the engineer's name and licensure as type.
 * No stock person, no silhouette, no "photo coming soon". Supplying the
 * portrait in `site.ts` swaps it in without touching this component.
 *
 * The caption belongs to the PORTRAIT only. The plate already sets name (or
 * role) and licensure as type, so a caption under it repeated the same facts
 * a second time — a third with the role eyebrow beside it, and a stutter
 * once the columns stack on a phone.
 */
export function EngineerSection({
  n = '03',
  variant = 'teaser',
}: {
  n?: string;
  variant?: 'teaser' | 'full';
}) {
  const c = useContent();
  const l = useL();
  const e = c.leadership;
  const u = c.ui.engineer;
  const full = variant === 'full';

  return (
    <section
      id="engineer"
      className={`mp-section mp-section--lg mp-surface--paper mp-eng mp-eng--${variant}`}
      aria-labelledby="mp-eng-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={full ? u.eyebrow : u.eyebrowTeaser} />

        <div className="mp-eng__grid">
          <Reveal>
            <figure className="mp-eng__figure">
              {e.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.portrait.src}
                  alt={e.portrait.alt}
                  width={e.portrait.w}
                  height={e.portrait.h}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="mp-eng__plate">
                  <Img
                    photo={imagery.sections.engineer}
                    className="mp-eng__plate-bg"
                    sizes="(max-width: 900px) 100vw, 40vw"
                  />
                  <div className="mp-grid-bg" aria-hidden="true" />
                  {/* The 256 px resize of the real white monogram (never a
                      redraw): the plate shows it at up to ~84 px, so the
                      1254 px master was ~230 KB for nothing. Named by its
                      alt and `aria-hidden`: the plate's own rows, right
                      under it, are what a screen reader should read. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="mp-eng__plate-mark"
                    src={c.company.logo.markLightSm}
                    alt={c.company.name}
                    aria-hidden="true"
                    width={c.company.logo.markSmSize.w}
                    height={c.company.logo.markSmSize.h}
                    loading="lazy"
                    decoding="async"
                  />
                  <dl className="mp-eng__plate-list">
                    {e.plate.map((r) => (
                      <div key={r.k}>
                        <dt>{r.k}</dt>
                        <dd>{r.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {e.portrait ? (
                <figcaption className="mp-eng__caption">
                  <span>{e.name}</span>
                  <span>{e.credential}</span>
                </figcaption>
              ) : null}
            </figure>
          </Reveal>

          <div className="mp-eng__copy">
            <Reveal delay={0.05}>
              {/* About: his role, over his name. The teaser: his license,
                  over the promise — the role is already on the plate beside
                  it, and the number is the one fact the home page's first
                  mention of him was missing. */}
              <p className="mp-eng__role">
                {full || !e.license ? (
                  <>
                    {e.role} · {e.credential}
                  </>
                ) : (
                  <>
                    {e.credential} · {e.license.number}
                  </>
                )}
              </p>
              <h2 id="mp-eng-title" className="mp-eng__title">
                {full ? e.name : e.teaserTitle}
              </h2>
            </Reveal>

            <Reveal delay={0.1} className="mp-eng__body">
              {full ? (
                e.bio.map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p>{e.teaser}</p>
              )}
            </Reveal>

            {full ? (
              <>
                <Reveal delay={0.12}>
                  <blockquote className="mp-eng__quote">
                    <p>{e.approach}</p>
                    <cite>— {e.firstName}</cite>
                  </blockquote>
                </Reveal>

                <Reveal delay={0.14} className="mp-eng__meta">
                  <div>
                    <h3>{u.education}</h3>
                    <ul>
                      {e.education.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>{u.focus}</h3>
                    <ul>
                      {e.focus.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                  {e.license ? (
                    <div>
                      <h3>{u.license}</h3>
                      <ul>
                        <li>{e.license.number}</li>
                        <li>
                          <a href={e.license.url} rel="noopener noreferrer" target="_blank">
                            {u.verify}
                          </a>
                        </li>
                        {/* The link opens the registry's search form, not the
                            license: say what to do there. */}
                        <li>{u.verifyHow}</li>
                      </ul>
                    </div>
                  ) : null}
                </Reveal>
              </>
            ) : null}

            <Reveal delay={0.16}>
              <h3 className="mp-eng__forlabel">{u.forYou}</h3>
              {full ? (
                <ul className="mp-pillars mp-eng__for">
                  {e.forYou.map((p) => (
                    <li key={p.k}>
                      <b>{p.k}</b>
                      <span>{p.v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                /* The teaser explains each row in a line of ITS OWN
                   (`teaser`). About's sentences printed here were the same
                   three sentences on two pages; the three bare names that
                   replaced them left a phone visitor with a label and
                   nothing under it. */
                <ul className="mp-pillars mp-eng__for">
                  {e.forYou.map((p) => (
                    <li key={p.k}>
                      <b>{p.k}</b>
                      <span>{p.teaser}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Reveal>

            <Reveal delay={0.18} className="mp-cta-row">
              {full ? (
                <ButtonLink href={l('/contact')} variant="solid">
                  {c.ui.requestProposal}
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href={l('/about#engineer')} variant="line">
                    {u.readMore}
                  </ButtonLink>
                  <Link href={l('/contact')} className="mp-link">
                    {c.ui.requestProposal} <i aria-hidden="true">→</i>
                  </Link>
                </>
              )}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
