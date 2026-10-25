import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { photo } from '@/lib/ttc/media';
import { Img } from '../media';
import { Reveal } from '../primitives';
import { accent } from '../text';
import { Words } from './Words';

/**
 * S4 · STATEMENT. The first quiet breath after the grid: three short lines
 * and one concrete, non-salesy sentence of trust. A SERVER component.
 *
 * The three lines are the section's `<h2>` — a 25-word heading is a bad
 * heading, so the sentence under them is a `<p>`, in grey, with one word in
 * the snow-white italic serif (`accentWord`, "all"). "An architect", not "a
 * builder": nothing here may read as the contractor.
 *
 * A TEXT BLOCK ON THE LEFT TWO THIRDS, A 4/5 PHOTOGRAPH ON THE RIGHT THIRD
 * (twelve columns: 1–8 and 9–12); on a phone the text comes first and the
 * photograph runs the full width under it. The photograph is
 * `photo.miamiTowersUp`, spare since 2026-10-20 — a stock illustration, never
 * captioned as a project, `aria-hidden` (its alt is the catalogue's).
 *
 * The lines are separate blocks, so the heading has a real space between
 * them (the same reason `RevealText` prints one): without it `textContent`
 * ran them together ("Hurricane wind.High water.").
 *
 * MOTION: the h2 `[data-fx="words"]` (word rise, `Words` with a running
 * `--wi` across the three lines); the photograph `[data-fx="img"]`.
 */
export function HomeStatement({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const s = c.home.statement;

  /* The index of each line's first word across the three lines, so the rise
     of the words (E8) runs on from one line to the next. */
  const first = s.lines.map((_, i) =>
    s.lines.slice(0, i).reduce((n, line) => n + line.split(/\s+/).filter(Boolean).length, 0),
  );
  const lines = s.lines.map((line, i) => <Words key={line} text={line} start={first[i]} />);

  return (
    <section className="h-plate h-stmt mp-surface--graphite" aria-labelledby="h-stmt-title">
      <div className="mp-grid-bg" aria-hidden="true" />
      <div className="h-wrap h-stmt__grid">
        <div className="h-stmt__text">
          <Reveal as="h2" fx="words" id="h-stmt-title" className="h-stmt__title">
            {lines.map((node, i) => (
              <React.Fragment key={i}>
                {i > 0 ? ' ' : null}
                <span className="h-l">{node}</span>
              </React.Fragment>
            ))}
          </Reveal>
          <Reveal fx="up" delay={0.15}>
            <p className="h-stmt__dim">{accent(s.dim, s.accentWord)}</p>
          </Reveal>
        </div>
        <Reveal fx="img" className="h-ph h-stmt__photo">
          <div className="h-ph__in">
            <Img photo={photo.miamiTowersUp} sizes="(min-width: 1100px) 26vw, 92vw" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
