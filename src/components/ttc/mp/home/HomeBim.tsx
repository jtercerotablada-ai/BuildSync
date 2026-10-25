import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { imagery } from '@/lib/ttc/site';
import { MotionToggle, VideoLoop } from '../media';
import { Reveal } from '../primitives';
import { Arrow } from './glyphs';
import { Words } from './Words';

/**
 * S5 · BIM. The one piece of evidence a camera cannot show: the structural
 * model, assembling floor plate by floor plate. It replaces the BIM tile that
 * used to be buried as the seventh service card. A SERVER wrapper around the
 * client `VideoLoop`.
 *
 * ON A DESKTOP, twelve columns: the text in 1–5, the frame in 6–12 at 16:10
 * with four small gold corner ticks and the mono caption under it (and the
 * pause switch, at the caption's right: the loop moves, so it carries the
 * control — WCAG 2.2.2 — as the old new-buildings stage did). ON A PHONE the
 * frame comes first and the text after; the frame sits inside the page's
 * gutter, so no tick is ever within 16 px of the screen edge.
 *
 * `VideoLoop` is lazy by construction: it paints the (lazy) poster, mounts the
 * `<video>` only within one viewport of being seen, never under Save-Data or
 * reduced motion, picks the 341 KB phone rendition on a phone, and obeys the
 * shared pause switch. The loop is already monochrome, so it takes no filter.
 *
 * The link is the service's own title ("BIM Modeling & Coordination"), the
 * same words /services prints, to its page.
 *
 * The ticks are one `::after` with eight 16 × 1 px gradients (home.css).
 *
 * MOTION HOOKS: the h2 `[data-fx="words"]`; the frame `[data-fx="img"]`
 * (clip-path reveal of the whole frame); the caption row, a plain `Reveal`.
 */
export function HomeBim({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const b = c.home.bim;
  const service = c.services.find((s) => s.slug === 'bim-coordination');
  if (!service) throw new Error('home: no service "bim-coordination"');

  return (
    <section className="h-plate h-bim mp-surface--graphite" aria-labelledby="h-bim-title">
      <div className="mp-grid-bg" aria-hidden="true" />
      <div className="h-wrap h-bim__grid">
        <div className="h-bim__text">
          <Reveal>
            <p className="h-label">{b.label}</p>
          </Reveal>
          <h2 id="h-bim-title" className="h-h2 h-h2--m" data-fx="words">
            <Words text={b.title} accent={b.accentWord} />
          </h2>
          <Reveal>
            <p className="h-body h-bim__body">{b.body}</p>
          </Reveal>
          <Reveal>
            <Link className="h-link" href={localePath(`/services/${service.slug}`, lang)}>
              <span>{service.title}</span>
              <Arrow />
            </Link>
          </Reveal>
        </div>

        <div className="h-bim__media">
          <div className="h-bim__frame" data-fx="img">
            <VideoLoop clip={imagery.clips.bim} />
          </div>
          <Reveal className="h-bim__cap">
            <p className="h-mono">{b.caption}</p>
            <MotionToggle className="h-bim__toggle" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
