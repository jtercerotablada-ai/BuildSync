import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { Reveal, SectionHeading } from './primitives';

/**
 * The firm's people, on /about (anchored #team): heading and lede, then one
 * card per person — portrait, role, name, credential lines — then what
 * working with the firm means for the client (`leadership.forYou`).
 *
 * It replaced the one-engineer profile (EngineerSection) on 2026-10-23: the
 * owner wants the site to read as a firm with a team, the way an established
 * practice presents itself. A person without a portrait yet (`photo: null`)
 * gets their initials on the same 4:5 tile, so the row keeps one shape.
 * Each card carries its member's `id` as an anchor; Juan's is `engineer`,
 * the @id of the Person JSON-LD.
 *
 * Credentials are named, never numbered, and an EIT is never called a
 * Professional Engineer (see `aboutPage.team` in site.ts).
 */
export function TeamSection({ n = '01', lang }: { n?: string; lang: Lang }) {
  const c = getContent(lang);
  const t = c.aboutPage.team;
  const forYou = c.leadership.forYou;

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
            <li key={m.id} id={m.id} className="mp-team__card">
              <Reveal delay={0.04 * i}>
                <figure className="mp-team__photo">
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photo.src}
                      alt={m.photo.alt}
                      width={m.photo.w}
                      height={m.photo.h}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="mp-team__initials" aria-hidden="true">
                      {initials(m.name)}
                    </span>
                  )}
                </figure>
                <p className="mp-team__role">{m.role}</p>
                <h3 className="mp-team__name">{m.name}</h3>
                <ul className="mp-team__lines">
                  {m.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal delay={0.08} className="mp-team__forwrap">
          <h3 className="mp-eng__forlabel">{c.ui.engineer.forYou}</h3>
          <ul className="mp-pillars mp-pillars--strip mp-eng__for">
            {forYou.map((p) => (
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

/** "Melvin Tercero, EIT" → "MT": the name before the comma, first letters. */
function initials(name: string) {
  return name
    .split(',')[0]
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
