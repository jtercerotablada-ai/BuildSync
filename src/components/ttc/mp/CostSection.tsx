'use client';

import React from 'react';
import { ButtonLink, Reveal, RevealText, SectionHeading, TextLink } from './primitives';
import { accentLines } from './text';
import { useContent, useL } from './lang';
import { ReachRow } from './ReachRow';
import { marks } from '@/lib/ttc/municipalities';

/**
 * Three home sections, one file, one copy block (`pricing` in site.ts and
 * site.es.ts):
 *
 *   PricingSection       fixed-fee ranges by building size, per county
 *   UrgencySection       what waiting can cost, and who takes it from there
 *   JurisdictionsSection the offices we file with, by their own marks
 *
 * The ranges are fixed-fee ranges, not regulatory facts: no date, and no age
 * or day count anywhere in this file or its copy (those live in each county's
 * timing row and nowhere else). The two counties' ranges stay in their own
 * cards, never merged.
 *
 * The seals are shown only to identify an office; the disclaimer and the
 * credits link sit directly under them and are not optional.
 */

export function PricingSection({ n, surface = 'paper' }: { n: string; surface?: 'paper' | 'concrete' }) {
  const c = useContent();
  const l = useL();
  const k = c.pricing;
  return (
    <section
      id="pricing"
      className={`mp-section mp-section--lg mp-cost mp-surface--${surface}`}
      aria-labelledby="mp-cost-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={k.eyebrow} />
        <RevealText
          as="h2"
          id="mp-cost-title"
          className="mp-prog__title"
          lines={accentLines(k.titleLines, k.accentWord)}
        />
        <Reveal delay={0.06}>
          <p className="mp-prog__lede">{k.lede}</p>
        </Reveal>

        <div className="mp-cost__cards">
          {k.programs.map((p, i) => (
            <Reveal key={p.id} delay={0.06 + i * 0.04} className="mp-cost__card">
              <h3 id={p.id} className="mp-cost__name">
                {p.name}
              </h3>
              <dl className="mp-cost__tiers" aria-labelledby={p.id}>
                {p.tiers.map((t) => (
                  <div key={t.size}>
                    <dt>{t.size}</dt>
                    <dd>{t.price}</dd>
                  </div>
                ))}
              </dl>
              <TextLink href={l(`/contact?service=${p.slug}`)}>{k.cta}</TextLink>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.08} className="mp-cost__scope">
          <div>
            <h3 className="mp-cost__h">{k.includesTitle}</h3>
            <ul className="mp-cost__list mp-cost__list--yes">
              {k.includes.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mp-cost__h">{k.excludesTitle}</h3>
            <ul className="mp-cost__list">
              {k.excludes.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mp-cost__note">{k.note}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function UrgencySection({ n }: { n: string }) {
  const c = useContent();
  const l = useL();
  const k = c.pricing.urgency;
  return (
    <section
      id="urgency"
      className="mp-section mp-section--lg mp-cost mp-cost--urgent mp-surface--graphite"
      aria-labelledby="mp-urgency-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={k.eyebrow} />
        <RevealText
          as="h2"
          id="mp-urgency-title"
          className="mp-prog__title"
          lines={accentLines(k.titleLines, k.accentWord)}
        />
        <Reveal delay={0.06}>
          <p className="mp-prog__lede">{k.lede}</p>
        </Reveal>

        <div className="mp-cost__urgent-grid">
          <Reveal delay={0.08} className="mp-cost__urgent-main">
            <h3 className="mp-cost__h">{k.miamiDade}</h3>
            <ul className="mp-cost__risks">
              {k.items.map((it) => (
                <li key={it.k}>
                  <strong>{it.k}</strong>
                  <span>{it.v}</span>
                </li>
              ))}
            </ul>
            <p className="mp-cost__foot">{k.footnote}</p>
            <h3 className="mp-cost__h mp-cost__h--gap">{k.broward}</h3>
            <p className="mp-cost__broward">{k.browardLine}</p>
          </Reveal>

          <Reveal delay={0.1} className="mp-cost__resolve">
            <h3 className="mp-cost__resolve-title">{k.resolveTitle}</h3>
            <ol className="mp-cost__steps">
              {k.resolve.map((it, i) => (
                <li key={it.k}>
                  <span className="mp-secnum">{String(i + 1).padStart(2, '0')}</span>
                  <strong>{it.k}</strong>
                  <span>{it.v}</span>
                </li>
              ))}
            </ol>
            <p className="mp-cost__closing">{k.closing}</p>
            <div className="mp-prog__action">
              <ButtonLink href={l('/contact?service=building-recertification')} variant="solid">
                {k.cta}
              </ButtonLink>
              <ReachRow c={c} className="mp-reach--row" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function JurisdictionsSection({ n }: { n: string }) {
  const c = useContent();
  const k = c.pricing.jurisdictions;
  return (
    <section
      id="jurisdictions"
      className="mp-section mp-cost mp-cost--juris mp-surface--paper"
      aria-labelledby="mp-juris-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={k.eyebrow} />
        <Reveal as="div">
          <h2 id="mp-juris-title" className="mp-h3 mp-cost__jtitle">
            {k.title}
          </h2>
          <p className="mp-prog__lede">{k.lede}</p>
        </Reveal>

        <h3 className="mp-cost__more">{k.more}</h3>
        {k.lists.map((list) => {
          // The county's own mark first, then every municipality that has one
          // on file; the ones without are named in a line under the marks.
          const shown = [list.title, ...list.names].filter((name) => marks[name]);
          const rest = list.names.filter((name) => !marks[name]);
          return (
            <Reveal key={list.title} delay={0.04} className="mp-cost__county">
              <h4 className="mp-cost__h">{list.title}</h4>
              <ul className="mp-cost__seals">
                {shown.map((name) => {
                  const m = marks[name];
                  return (
                    <li key={name} data-tone={m.dark ? 'dark' : undefined}>
                      {/* Decorative marks, named by the visible caption. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/ttc/img/jurisdictions/${m.file}.webp`}
                        alt={name}
                        aria-hidden="true"
                        width={160}
                        height={64}
                        loading="lazy"
                        decoding="async"
                      />
                      <span>{name}</span>
                    </li>
                  );
                })}
              </ul>
              {rest.length ? (
                <p className="mp-cost__rest">
                  <strong>{k.also}:</strong> {rest.join(' · ')}
                </p>
              ) : null}
            </Reveal>
          );
        })}

        <p className="mp-cost__disclaimer">
          {k.disclaimer} <TextLink href="/credits">{k.creditLabel}</TextLink>
        </p>
      </div>
    </section>
  );
}
