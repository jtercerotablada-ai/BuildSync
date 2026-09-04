'use client';

import React from 'react';
import { software } from '@/lib/ttc/site';
import { Reveal, SectionHeading } from './primitives';

/**
 * The toolchain, shown rather than listed.
 *
 * Two densities. The home page gets the `strip`: a label, the six marks and
 * the ownership note — a breath between the BIM section and the next video
 * band, not a section competing with them. The BIM service page, where the
 * toolchain is actually the subject, gets `full`, which adds the title and
 * the paragraph.
 *
 * Deliberately on a LIGHT surface: these are third-party brand marks in their
 * own colours (Autodesk's is solid black, CYPE's is a red badge) and several
 * would disappear or fight the palette on graphite. They sit desaturated so
 * the band reads as one material, and return to full colour on hover — the
 * marks are never recoloured or redrawn, which respects each owner's brand.
 */
export function SoftwareBand({
  n = '04',
  variant = 'strip',
}: {
  n?: string;
  variant?: 'strip' | 'full';
}) {
  return (
    <section
      className={`mp-section mp-surface--concrete mp-tools-sec mp-tools-sec--${variant}`}
      aria-labelledby="mp-software-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={software.eyebrow} />
        {variant === 'full' ? (
          <div className="mp-intro">
            <Reveal>
              <h2 id="mp-software-title" className="mp-intro__title">
                {software.title}
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="mp-intro__lede">{software.body}</p>
            </Reveal>
          </div>
        ) : (
          <h2 id="mp-software-title" className="mp-form__hp">
            {software.eyebrow}
          </h2>
        )}

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
