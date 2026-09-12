'use client';

import React from 'react';
import { Reveal, SectionHeading } from './primitives';
import { useContent } from './lang';

/**
 * The toolchain, shown rather than listed. On a LIGHT surface on purpose:
 * these are third-party marks in their own colours; they sit desaturated and
 * return to full colour on hover — never recoloured or redrawn.
 */
export function SoftwareBand({
  n = '04',
  variant = 'strip',
}: {
  n?: string;
  variant?: 'strip' | 'full';
}) {
  const c = useContent();
  const s = c.software;
  return (
    <section
      className={`mp-section mp-surface--concrete mp-tools-sec mp-tools-sec--${variant}`}
      aria-labelledby="mp-software-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={s.eyebrow} />
        {variant === 'full' ? (
          <div className="mp-intro">
            <Reveal>
              <h2 id="mp-software-title" className="mp-intro__title">
                {s.title}
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="mp-intro__lede">{s.body}</p>
            </Reveal>
          </div>
        ) : (
          <h2 id="mp-software-title" className="mp-form__hp">
            {s.eyebrow}
          </h2>
        )}

        <Reveal delay={0.08}>
          <ul className="mp-tools">
            {s.items.map((t) => (
              <li className="mp-tool" key={t.name}>
                <span className="mp-tool__plate">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.logo} alt={`${t.name} logo`} loading="lazy" decoding="async" />
                </span>
                <span className="mp-tool__name">{t.name}</span>
                <span className="mp-tool__role">{t.role}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mp-tools__note">{s.note}</p>
        </Reveal>
      </div>
    </section>
  );
}
