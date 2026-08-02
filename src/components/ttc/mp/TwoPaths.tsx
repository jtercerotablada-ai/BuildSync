'use client';

import React from 'react';
import { paths } from '@/lib/ttc/site';
import { PathArt } from './art';
import { Reveal, SectionHeading, TextLink } from './primitives';

/**
 * The two halves of the practice, side by side. They read as one section — a
 * shared grid, shared rhythm, one hairline between them — so the site never
 * feels like two disconnected businesses.
 */
export function TwoPaths() {
  return (
    <section
      className="mp-section mp-surface--concrete"
      aria-labelledby="mp-paths-title"
      style={{ position: 'relative', overflow: 'clip' }}
    >
      <span className="mp-ghost" aria-hidden="true">
        02
      </span>
      <div className="mp-shell">
        <SectionHeading
          n="02"
          label="Two disciplines, one practice"
          meta="Select a path"
        />
        <h2 id="mp-paths-title" className="mp-form__hp">
          Two disciplines, one practice
        </h2>

        <div className="mp-paths">
          {paths.map((p, i) => (
            <Reveal
              as="div"
              key={p.key}
              delay={i * 0.08}
              className="mp-path mp-frame"
            >
              <div className="mp-path__head">
                <span className="mp-secnum">{p.n}</span>
                <h3 className="mp-path__title">
                  {p.title.split(p.serifWord)[0]}
                  <span className="mp-serif">{p.serifWord}</span>
                  {p.title.split(p.serifWord)[1]}
                </h3>
              </div>

              {/* Photograph carries the material; the line-art sits on top as
                  the engineering read of it. The image is decorative — the
                  panel's meaning is in the heading and the list. */}
              <div className="mp-path__art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="mp-path__photo"
                  src={p.photo.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={1800}
                  height={1200}
                />
                <span className="mp-path__overlay" aria-hidden="true">
                  <PathArt kind={p.art} />
                </span>
              </div>

              <p className="mp-path__lede">{p.lede}</p>

              <ul className="mp-path__caps">
                {p.capabilities.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>

              <div className="mp-path__cta">
                <TextLink href={p.cta.href}>{p.cta.label}</TextLink>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
