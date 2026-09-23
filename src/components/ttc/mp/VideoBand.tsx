'use client';

import React from 'react';
import type { Clip } from '@/lib/ttc/media';
import { MotionToggle, VideoLoop } from './media';
import { ButtonLink, Reveal, RevealText, TechnicalEyebrow } from './primitives';

/**
 * A full-bleed dark band carrying one idea over moving footage.
 *
 * Used sparingly and on purpose: the page alternates light body sections with
 * dark bookends, and these are the bookends' louder cousins. Two on the home
 * page is the ceiling — a third turns a considered rhythm into a slideshow.
 *
 * The scrim is a fixed gradient rather than a blur or an opacity on the video,
 * because legibility must not depend on where the bright parts of the footage
 * happen to fall. Same reasoning as the hero.
 *
 * The loop runs past five seconds beside readable content, so the band
 * carries its own pause control (WCAG 2.2.2), in the corner over the footage.
 * It drives the same switch as the hero's — one choice stops every loop.
 */
export function VideoBand({
  eyebrow,
  titleLines,
  plainTitle,
  body,
  facts,
  cta,
  clip,
  align = 'left',
}: {
  eyebrow: string;
  titleLines: React.ReactNode[];
  /** Plain-text headline. Only used to derive a stable, readable heading id —
   *  the accessible name comes from the visible heading itself. */
  plainTitle: string;
  body: string;
  facts?: { k: string; v: string }[];
  cta?: { href: string; label: string };
  clip: Clip;
  align?: 'left' | 'right';
}) {
  const id = `mp-band-${plainTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  return (
    <section
      className={`mp-band mp-band--${align}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="mp-band__media" aria-hidden="true">
        <VideoLoop clip={clip} className="mp-band__video" />
      </div>

      <div className="mp-shell mp-band__inner">
        <div className="mp-band__col">
          <Reveal y={12}>
            <TechnicalEyebrow>{eyebrow}</TechnicalEyebrow>
          </Reveal>

          <RevealText
            as="h2"
            id={`${id}-title`}
            className="mp-band__title"
            lines={titleLines}
          />

          <Reveal delay={0.16}>
            <p className="mp-band__body">{body}</p>
          </Reveal>

          {facts?.length ? (
            <Reveal delay={0.22}>
              <dl className="mp-band__facts">
                {facts.map((f) => (
                  <div key={f.k}>
                    <dt>{f.k}</dt>
                    <dd>{f.v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          ) : null}

          {cta ? (
            <Reveal delay={0.28}>
              <div className="mp-cta-row mp-band__cta">
                <ButtonLink href={cta.href} variant="line">
                  {cta.label}
                </ButtonLink>
              </div>
            </Reveal>
          ) : null}
        </div>
      </div>

      <MotionToggle className="mp-band__toggle" />
    </section>
  );
}
