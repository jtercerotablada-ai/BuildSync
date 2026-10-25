import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { imagery } from '@/lib/ttc/site';
import { MotionToggle, VideoLoop } from '../media';
import { DarkHeroSentinel, RevealText } from '../primitives';
import { accentLines } from '../text';
import { Arrow, Diamond } from './glyphs';

/**
 * S1 · HERO. What and where in five seconds, with the credential words, and
 * one action. A SERVER component: it reads its words with `getContent(lang)`
 * and ships none of the copy to the browser; only the three pieces that need
 * script are client components (`VideoLoop`, `MotionToggle`, `RevealText`).
 *
 *   gold hairline + eyebrow (the disciplines, a gold ◆ between them)
 *   H1, three lines, the last word in the gold italic serif
 *   foot row: the sub-line (36ch) on the left, the one button on the right
 *   the bar: the firm's full name · the two counties · the pause switch
 *
 * The film is the same one the old home played (`imagery.hero`), now in black
 * and white under a scrim (home.css). `VideoLoop` paints the poster first —
 * the page's LCP, at high priority — and swaps the film in after `load` and
 * an idle moment; reduced motion and Save-Data keep the poster. The shared
 * switch in the bar stops the film (and, later, the ribbon): WCAG 2.2.2.
 *
 * EVERY ENTRANCE HERE IS A CSS KEYFRAME (home.css, E2 to E6), not Motion and
 * not a script: the whole first screen paints from the server HTML, with or
 * without JavaScript, and reduced motion removes all of it. The H1's lines
 * are `RevealText animateOnMount` — the site's own mask-rise — with the
 * duration and the stagger of the home set in home.css.
 *
 * The button is a plain anchor to `#contact`: smooth-scroll.tsx lands it
 * below the fixed header, and without JavaScript it is a native jump.
 *
 * `DarkHeroSentinel` stays: its presence is what makes the header render
 * transparent from the first paint (`body:has([data-mp-dark-hero])`).
 *
 * MOTION HOOK (E14, parallax): `[data-parallax="hero"]` is the film's box,
 * deliberately a different element from `.h-hero__film`, which carries the
 * settle keyframe: the two transforms must not share a node. The box is
 * 12 % taller than the hero (top −6 %) so it can travel without a gap.
 */
export function HomeHero({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const h = c.home.hero;

  return (
    <section
      className="h-hero mp-surface--graphite"
      aria-labelledby="h-hero-title"
      data-motion="hero"
    >
      <div className="h-hero__media" aria-hidden="true" data-parallax="hero">
        <div className="h-hero__film">
          <VideoLoop clip={imagery.hero} priority />
        </div>
      </div>
      <div className="h-hero__scrim" aria-hidden="true" />

      <div className="h-hero__copy">
        <p className="h-hero__eyebrow">
          {h.eyebrow.map((item, i) => (
            <React.Fragment key={item}>
              {i > 0 ? (
                <>
                  {' '}
                  <Diamond />{' '}
                </>
              ) : null}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </p>

        <RevealText
          as="h1"
          id="h-hero-title"
          className="h-hero__title"
          lineClassName="h-hero__line"
          animateOnMount
          delay={0.5}
          lines={accentLines(h.titleLines, h.accentWord)}
        />

        <div className="h-hero__foot">
          <p className="h-hero__sub">{h.sub}</p>
          <a className="h-btn" href="#contact">
            <span>{h.cta}</span>
            <span className="h-btn__arrow" aria-hidden="true">
              <Arrow />
            </span>
          </a>
        </div>

        <div className="h-hero__bar">
          <p className="h-hero__firm">{c.company.name}</p>
          <p className="h-hero__counties">
            {h.counties.map((county, i) => (
              <React.Fragment key={county}>
                {i > 0 ? (
                  <>
                    {' '}
                    <Diamond />{' '}
                  </>
                ) : null}
                <span>{county}</span>
              </React.Fragment>
            ))}
          </p>
          <MotionToggle className="h-hero__toggle" />
        </div>
      </div>

      <DarkHeroSentinel />
    </section>
  );
}
