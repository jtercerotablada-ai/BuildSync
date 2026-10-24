'use client';

import React from 'react';
import { Reveal, SectionHeading } from './primitives';
import { useContent } from './lang';

/**
 * The person behind the practice, on /about — its only page (the owner,
 * 2026-10-20: his part lives on /about alone, "not mixed in", ordered and as
 * professional as possible). One composition, read as a profile:
 *
 *   1. the portrait beside his role, his name, the biography and his own
 *      words (the quote) — face and name together, so /about#engineer (the
 *      footer's "Meet the engineer" and the closing band on thirteen pages)
 *      lands on both, on a phone too, where the portrait is a thumbnail
 *      beside the name;
 *   2. the credentials in one row: Education, the Florida P.E. license with
 *      its link to the state registry, Practice focus — on a wide screen the
 *      first column is the portrait's, so the row lines up under it;
 *   3. what that means for the client, the three rows.
 *
 * No button: the page's one action is the closing band (and the header's).
 * No caption under the portrait: the role line and the name sit beside it.
 * Nothing here says who signs a report (the owner's rule); do not add it.
 *
 * The portrait is the real photograph in `leadership.portrait` (site.ts),
 * the page's one spoken image besides the footer lockup (pages.test).
 */
export function EngineerSection({ n = '01' }: { n?: string }) {
  const c = useContent();
  const e = c.leadership;
  const u = c.ui.engineer;

  return (
    <section
      id="engineer"
      className="mp-section mp-surface--paper mp-eng mp-eng--full"
      aria-labelledby="mp-eng-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={u.eyebrow} />

        <div className="mp-eng__grid">
          <Reveal className="mp-eng__fig">
            <figure className="mp-eng__figure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={e.portrait.src}
                alt={e.portrait.alt}
                width={e.portrait.w}
                height={e.portrait.h}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </Reveal>

          <Reveal delay={0.05} className="mp-eng__head">
            {/* His role, over his name. Not the credential too: "PE." is in
                the name, the biography's first words say Florida-licensed
                Professional Engineer, and the license has its own column. */}
            <p className="mp-eng__role">{e.role}</p>
            <h2 id="mp-eng-title" className="mp-eng__title">
              {e.name}
            </h2>
          </Reveal>

          <Reveal delay={0.1} className="mp-eng__body">
            {e.bio.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Reveal>

          <Reveal delay={0.12} className="mp-eng__quotewrap">
            <blockquote className="mp-eng__quote">
              <p>{e.approach}</p>
              <cite>— {e.firstName}</cite>
            </blockquote>
          </Reveal>
        </div>

        {/* Education, license, focus — in that order: the tablet layout
            spans the LAST group (focus) across the row. */}
        <Reveal delay={0.08} className="mp-eng__meta">
          <div>
            <h3>{u.education}</h3>
            <ul>
              {e.education.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          {e.license ? (
            <div>
              <h3>{u.license}</h3>
              <ul>
                <li className="mp-eng__lic">{e.license.number}</li>
                <li>
                  <a href={e.license.url} rel="noopener noreferrer" target="_blank">
                    {u.verify}
                  </a>
                </li>
              </ul>
            </div>
          ) : null}
          <div>
            <h3>{u.focus}</h3>
            <ul>
              {e.focus.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="mp-eng__forwrap">
          <h3 className="mp-eng__forlabel">{u.forYou}</h3>
          <ul className="mp-pillars mp-pillars--strip mp-eng__for">
            {e.forYou.map((p) => (
              <li key={p.k}>
                <b>{p.k}</b>
                <span>{p.v}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
