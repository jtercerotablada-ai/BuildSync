import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { marks } from '@/lib/ttc/municipalities';
import { Reveal } from '../primitives';
import { Words } from './Words';

/* The two logo files' own sizes (public/ttc/img/jurisdictions/), so the
   browser reserves the box before the file arrives; the stylesheet sets the
   drawn height (56 px) and the width follows. */
const LOGO: Record<string, { w: number; h: number }> = {
  'miami-dade': { w: 340, h: 160 },
  broward: { w: 300, h: 74 },
};
const FALLBACK_LOGO = { w: 160, h: 64 };

/**
 * S9 · WHERE WE WORK — the offices the firm files with, readable as a list.
 * The ONE snow-coloured plate of the home page: the only place the page is
 * white (it is `mp-surface--paper`, ink on paper).
 *
 * WHAT IT SAYS. "Miami-Dade and Broward County, and every city office we
 * file with" — the approved scope phrase. Not "every city", not a count: no
 * "34 / 31 municipalities" and no "two counties, every city" (the legal
 * audit and the owner's rule on overclaiming).
 *
 * THE LISTS ARE PLAIN. Each county is its logo, directly on the snow (no
 * tile), its name as an <h3>, and its municipalities as a list with `/`
 * between names, `white-space: nowrap` on each name so a line never breaks
 * "Fort Lauderdale" in two, colours alternating ink / faint ink (4.8:1) so
 * the eye can follow a long run of names. Names are <li>, not links: no city
 * has a page or a mark here (programs.test.ts pins the two county files, and
 * municipalities.ts says why no city seal or logo is ever shown).
 *
 * THE COUNTY LOGOS belong to their governments and are shown only to
 * identify the office: the approved disclaimer
 * (`pricing.jurisdictions.disclaimer`) is printed ONCE, as one line under the
 * lists. The county logos are `aria-hidden` with the county's name as alt,
 * beside the same name as the <h3>.
 *
 * GOLD ON SNOW reads olive, so the accent word is ink italic, and the only
 * gold-family colour is the 1 px `--mp-gold-ink` rule over each block.
 *
 * At 901 x 720 and up this plate slides over the credentials and pause plates
 * (E15, home-motion.css §05); the county blocks slide in from the left (E10).
 * A SERVER COMPONENT.
 */
export function HomeWhere({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const h = c.home.where;
  const k = c.pricing.jurisdictions;

  return (
    /* E15, this plate is `position: relative; z-index: 3` and
       slides over the two plates under it. */
    <section
      id="where"
      className="h-plate h-where mp-surface--paper"
      aria-labelledby="h-where-h"
      data-motion="stack-where"
    >
      <div className="h-wrap">
        <Reveal as="p" fx="up" className="h-label">
          {h.label}
        </Reveal>

        <div className="h-where__head">
          <Reveal as="h2" fx="words" id="h-where-h" className="h-h2 h-where__h">
            <Words text={h.title} accent={h.accentWord} />
          </Reveal>
          <Reveal as="p" fx="up" delay={0.25} className="h-lede h-where__lede">
            {h.lede}
          </Reveal>
        </div>

        <div className="h-where__counties">
          {k.lists.map((list, index) => {
            const mark = marks[list.mark];
            return (
              /* Each county block slides in from the left, 0.2 s apart (E10),
                 and its top rule draws (E11). */
              <Reveal key={list.title} fx="left" delay={index * 0.2} className="h-where__county">
                <div className="h-where__top">
                  {mark ? (
                    /* The county's own logo, from its own website, on the
                       snow with no tile. Named by the <h3> beside it. */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      className="h-where__logo"
                      src={`/ttc/img/jurisdictions/${mark.file}.webp`}
                      alt={list.title}
                      aria-hidden="true"
                      width={(LOGO[mark.file] ?? FALLBACK_LOGO).w}
                      height={(LOGO[mark.file] ?? FALLBACK_LOGO).h}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                  <h3 className="h-where__name">{list.title}</h3>
                </div>
                <ul className="h-where__list" role="list">
                  {list.names.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>

        <p className="h-where__note">{k.disclaimer}</p>
      </div>
    </section>
  );
}
