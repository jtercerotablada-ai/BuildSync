'use client';

import React from 'react';
import { software } from '@/lib/ttc/site';
import { Reveal, SectionHeading } from './primitives';

/**
 * The toolchain, shown rather than listed.
 *
 * Deliberately on a LIGHT surface: these are third-party brand marks in their
 * own colours (Autodesk's is solid black, CYPE's is a red badge) and several
 * would disappear or fight the palette on graphite. They sit desaturated so
 * the band reads as one material, and return to full colour on hover — the
 * marks are never recoloured or redrawn, which respects each owner's brand.
 */
export function SoftwareBand({ n = '05' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-surface--concrete"
      aria-labelledby="mp-software-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={software.eyebrow} meta="Toolchain" />
        <h2 id="mp-software-title" className="mp-form__hp">
          {software.eyebrow}
        </h2>

        <div className="mp-split">
          <Reveal>
            <h3 className="mp-split__title mp-h3">{software.title}</h3>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="mp-lead mp-measure">{software.body}</p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <ul className="mp-tools">
            {software.items.map((t) => (
              <li className="mp-tool" key={t.name}>
                <span className="mp-tool__plate">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.logo}
                    alt={`${t.name} logo`}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="mp-tool__name">{t.name}</span>
                <span className="mp-tool__role">{t.role}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.14}>
          <p className="mp-tools__note">{software.note}</p>
        </Reveal>
      </div>
    </section>
  );
}
