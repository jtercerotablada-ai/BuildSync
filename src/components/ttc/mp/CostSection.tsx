'use client';

import React from 'react';
import { Reveal, RevealText, SectionHeading, TextLink } from './primitives';
import { accentLines, keepHyphens } from './text';
import { useContent, useL } from './lang';
import { marks } from '@/lib/ttc/municipalities';
import { COST_PATH } from '@/lib/ttc/cost-path';

/**
 * Two home sections, one file, one copy block (`pricing` in site.ts and
 * site.es.ts):
 *
 *   PricingSection       fixed-fee ranges by building size, both counties in
 *                        one table
 *   JurisdictionsSection the offices we file with, by their own marks
 *
 * What waiting can cost used to be a section of its own here; it now opens
 * each county's column (`program.lede`, ProgramSection) — the owner,
 * 2026-10-20.
 *
 * Both open the same way: the headline on the left, its lede on the right,
 * tops aligned (`.mp-hsec__head`), so the reader gets the point in one line
 * and the section starts working at once.
 *
 * The ranges are fixed-fee ranges, not regulatory facts: no date, and no age
 * or day count anywhere in this file or its copy (those live in each county's
 * timing row and nowhere else). Each county's ranges stay in that county's
 * own column of the table, under its name, never merged into one figure.
 *
 * The seals are shown only to identify an office; the disclaimer and the
 * credits link sit directly under them and are not optional.
 */

function Head({
  id,
  titleLines,
  accentWord,
  lede,
  children,
}: {
  id: string;
  titleLines: readonly string[];
  accentWord: string;
  lede: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mp-hsec__head">
      <RevealText as="h2" id={id} className="mp-hsec__title" lines={accentLines(titleLines, accentWord)} />
      <Reveal delay={0.06} className="mp-hsec__aside">
        <p className="mp-hsec__lede">{lede}</p>
        {children}
      </Reveal>
    </div>
  );
}

export function PricingSection({ n, surface = 'paper' }: { n: string; surface?: 'paper' | 'concrete' }) {
  const c = useContent();
  const l = useL();
  const k = c.pricing;
  // Both counties price the same four sizes (`programs.test.ts` holds the
  // labels equal), so one column of sizes serves the two columns of prices.
  const sizes = k.programs[0].tiers.map((t) => t.size);
  // On a phone each price is labelled with its county alone ("Broward"):
  // the program's full name over every price wrapped onto two lines.
  const countyOf = (slug: string) => c.services.find((s) => s.slug === slug)?.program?.county;
  return (
    <section
      id="pricing"
      className={`mp-section mp-cost mp-surface--${surface}`}
      aria-labelledby="mp-cost-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={k.eyebrow} />
        <Head id="mp-cost-title" titleLines={k.titleLines} accentWord={k.accentWord} lede={k.lede}>
          <p className="mp-cost__delivery">{k.delivery}</p>
        </Head>

        <Reveal delay={0.06} className="mp-cost__tablewrap">
          {/* Named by the section's headline: the table is what it says. */}
          <table className="mp-cost__table" aria-labelledby="mp-cost-title">
            <thead>
              <tr>
                <th scope="col">{k.sizeLabel}</th>
                {k.programs.map((p) => (
                  <th key={p.id} id={p.id} scope="col">
                    {keepHyphens(p.name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sizes.map((size, i) => (
                <tr key={size}>
                  <th scope="row">{size}</th>
                  {k.programs.map((p) => (
                    // The county's name rides with each price for the phone
                    // layout, where the header row is hidden and every row
                    // is a size over its two prices.
                    <td key={p.id} data-label={countyOf(p.slug) ?? p.name}>
                      {p.tiers[i].price}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        <Reveal delay={0.08} className="mp-cost__scope">
          <div>
            <h3 className="mp-cost__h">{k.includesTitle}</h3>
            <ul className="mp-cost__list mp-cost__list--yes">
              {k.includes.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          {/* What is quoted separately lives on the cost page only (the
              owner, 2026-10-20); here, what moves the price and two links:
              ONE proposal link — the county columns above already carry a
              button each — and the cost page. */}
          <div>
            <p className="mp-cost__note">{k.note}</p>
            <div className="mp-cost__links">
              <TextLink href={l('/contact')}>{k.cta}</TextLink>
              <TextLink href={l(COST_PATH)}>{k.costLink}</TextLink>
            </div>
          </div>
        </Reveal>
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
        <div className="mp-hsec__head">
          <Reveal>
            <h2 id="mp-juris-title" className="mp-hsec__title mp-hsec__title--sm">
              {k.title}
            </h2>
          </Reveal>
          <Reveal delay={0.06} className="mp-hsec__aside">
            <p className="mp-hsec__lede">{k.lede}</p>
            <p className="mp-cost__more">{k.more}</p>
          </Reveal>
        </div>

        <div className="mp-cost__counties">
          {k.lists.map((list) => {
            // The county's own mark and its largest cities first; the ones
            // with no mark on file (Miami Beach, Aventura, Surfside…) are named
            // right under them, always in view; every other municipality with
            // a mark opens under the disclosure.
            const featured = [list.mark, ...list.featured].filter((name) => marks[name]);
            const rest = list.names.filter((name) => marks[name] && !featured.includes(name));
            const unmarked = list.names.filter((name) => !marks[name]);
            // The county's mark is keyed by its English name; it is captioned
            // with this language's title ("Condado de Broward").
            const label = (name: string) => (name === list.mark ? list.title : name);
            return (
              <Reveal key={list.title} delay={0.04} className="mp-cost__county">
                <h3 className="mp-cost__h">{list.title}</h3>
                <Seals names={featured} label={label} />
                {unmarked.length ? (
                  <p className="mp-cost__rest">
                    <strong>{k.also}:</strong> {unmarked.join(' · ')}
                  </p>
                ) : null}
                <details className="mp-cost__all">
                  <summary>{k.all.replace('{n}', String(list.names.length))}</summary>
                  <Seals names={rest} />
                </details>
              </Reveal>
            );
          })}
        </div>

        <p className="mp-cost__disclaimer">
          {k.disclaimer} <TextLink href="/credits">{k.creditLabel}</TextLink>
        </p>
      </div>
    </section>
  );
}

/** A grid of offices, each mark over its name. */
function Seals({ names, label = (name) => name }: { names: readonly string[]; label?: (name: string) => string }) {
  return (
    <ul className="mp-cost__seals">
      {names.map((name) => {
        const m = marks[name];
        const caption = label(name);
        return (
          <li key={name} data-tone={m.dark ? 'dark' : undefined}>
            {/* Decorative marks, named by the visible caption. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/ttc/img/jurisdictions/${m.file}.webp`}
              alt={caption}
              aria-hidden="true"
              width={160}
              height={64}
              loading="lazy"
              decoding="async"
            />
            <span>{caption}</span>
          </li>
        );
      })}
    </ul>
  );
}
