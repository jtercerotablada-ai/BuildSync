import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { Reveal, SectionHeading } from './primitives';

/**
 * The team on /about (anchored #team), after MKA's people page — the owner,
 * 2026-10-24: "me gusta MKA, página de equipo", and "no me pongas como
 * líder, soy parte igual". One grid of square portraits, the same tile for
 * everyone: the role, the name and the letters on a dark band across the
 * foot of the photograph, as MKA's tiles show them on hover — here always,
 * so a phone (no hover) and a keyboard read them too. The letters are the
 * credentials and nothing else: no university, no study lines (the owner,
 * 2026-10-24: "no menciones la universidad").
 *
 * The company line is content, not decoration: it is printed only for
 * someone who works for ANOTHER company (Rudy, at Precision Source — a
 * separate company), so the page never reads as if the engineering firm
 * were a contractor; the lede says once that the other two are the firm's. Credentials are named, never
 * numbered, and nobody but Juan is called an engineer — the rules are with
 * the copy, `aboutPage.team` in site.ts.
 *
 * Each tile carries its person's `id` as an anchor; Juan's is `engineer`,
 * the @id of the Person schema (AboutView). The portraits are content and
 * are read out: each alt says who is in it.
 */
export function TeamGrid({ n = '01', lang }: { n?: string; lang: Lang }) {
  const c = getContent(lang);
  const t = c.aboutPage.team;

  return (
    <section id="team" className="mp-section mp-surface--paper mp-team" aria-labelledby="mp-team-title">
      <div className="mp-shell">
        <SectionHeading n={n} label={t.eyebrow} />

        <div className="mp-split">
          <Reveal>
            <h2 id="mp-team-title" className="mp-split__title">
              {t.title}
            </h2>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="mp-lead">{t.lede}</p>
          </Reveal>
        </div>

        <ul className="mp-team__grid">
          {t.members.map((m, i) => (
            <li key={m.id} id={m.id} className="mp-team__member">
              <Reveal delay={0.06 * i}>
                <figure className="mp-team__tile">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.photo.src} alt={m.photo.alt} width={m.photo.w} height={m.photo.h} loading="lazy" decoding="async" />
                  <figcaption className="mp-team__band">
                    <span className="mp-team__role">{m.role}</span>
                    <h3 className="mp-team__name">{m.name}</h3>
                    <span className="mp-team__letters">{m.letters}</span>
                  </figcaption>
                </figure>
                {m.company ? (
                  <div className="mp-team__details">
                    <p className="mp-team__company">{m.company}</p>
                  </div>
                ) : null}
              </Reveal>
            </li>
          ))}
        </ul>

        {/* What working with the firm means: the three rows that were under
            the engineer's profile, kept (leadership.forYou). */}
        <Reveal delay={0.1} className="mp-team__forwrap">
          <h3 className="mp-team__forlabel">{c.ui.engineer.forYou}</h3>
          <ul className="mp-pillars mp-pillars--strip mp-team__for">
            {c.leadership.forYou.map((row) => (
              <li key={row.k}>
                <b>{row.k}</b>
                <span>{row.v}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
