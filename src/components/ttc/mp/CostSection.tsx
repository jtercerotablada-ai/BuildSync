'use client';

import React from 'react';
import { ButtonLink, Reveal, RevealText, SectionHeading, TextLink } from './primitives';
import { accentLines } from './text';
import { useContent, useL } from './lang';
import { ReachRow } from './ReachRow';

/**
 * Three home sections, one file, one copy block (`pricing` in site.ts and
 * site.es.ts):
 *
 *   PricingSection       fixed-fee ranges by building size, per county
 *   UrgencySection       what waiting can cost + the owner letter
 *   JurisdictionsSection the offices we file with, by their own marks
 *
 * The ranges are fixed-fee ranges, not regulatory facts: no date, and no age
 * or day count anywhere in this file or its copy (those live in each county's
 * timing row and nowhere else). The two counties' ranges stay in their own
 * cards, never merged.
 *
 * The letter is the firm's own owner letter with everything that identified
 * an owner (name, address, case number) replaced by bars: it shows the
 * letter, not a person.
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
  const lt = k.letter;
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

        <div className="mp-cost__urgent-grid">
          <div className="mp-cost__urgent-main">
            <Reveal delay={0.06}>
              <p className="mp-prog__lede">{k.lede}</p>
            </Reveal>

            <Reveal delay={0.08}>
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

            <Reveal delay={0.1} className="mp-prog__action">
              <ButtonLink href={l('/contact?service=building-recertification')} variant="solid">
                {k.cta}
              </ButtonLink>
              <ReachRow c={c} className="mp-reach--row" />
            </Reveal>
          </div>

          <Reveal delay={0.1} className="mp-cost__letterwrap">
            <p className="mp-cost__letterlabel">{lt.label}</p>
            <article className="mp-letter" aria-label={lt.title}>
              <header className="mp-letter__head">
                <strong>{lt.lh1}</strong>
                <span>{lt.lh2}</span>
              </header>
              <p className="mp-letter__to" aria-label={lt.redacted}>
                <span className="mp-letter__bar mp-letter__bar--w60" aria-hidden="true" />
                <span className="mp-letter__bar mp-letter__bar--w40" aria-hidden="true" />
                <span className="mp-letter__bar mp-letter__bar--w50" aria-hidden="true" />
                <span className="mp-sr-only">{lt.redacted}</span>
              </p>
              <h3 className="mp-letter__title">{lt.title}</h3>
              <p className="mp-letter__case" aria-hidden="true">
                <span className="mp-letter__bar mp-letter__bar--w70" />
              </p>
              <p>{lt.salutation}</p>
              {lt.paras.map((t) => (
                <p key={t}>{t}</p>
              ))}
              <ul>
                {lt.bullets.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="mp-letter__close">{lt.close}</p>
            </article>
            <p className="mp-cost__redacted">{lt.redacted}</p>
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
      className="mp-section mp-cost mp-cost--juris mp-surface--concrete"
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

        <Reveal delay={0.06}>
          <ul className="mp-cost__seals">
            {k.items.map((it) => (
              <li key={it.file} data-tone={it.tone}>
                {/* Decorative marks, named by the visible caption. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/ttc/img/jurisdictions/${it.file}.webp`}
                  alt={it.name}
                  aria-hidden="true"
                  width={160}
                  height={64}
                  loading="lazy"
                  decoding="async"
                />
                <span>{it.name}</span>
              </li>
            ))}
          </ul>
          <p className="mp-cost__more">{k.more}</p>
          <p className="mp-cost__disclaimer">
            {k.disclaimer} <TextLink href="/credits">{k.creditLabel}</TextLink>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
