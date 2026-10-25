import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { Reveal } from '../primitives';
import { Words } from './Words';

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
 * THE LISTS ARE PLAIN TEXT. Each county is its name as an <h3>, and its
 * municipalities as a list with `/` between names, `white-space: nowrap` on
 * each name so a line never breaks "Fort Lauderdale" in two, colours
 * alternating ink / faint ink (4.8:1) so the eye can follow a long run of
 * names. Names are <li>, not links.
 *
 * NO LOGO, SEAL OR MARK OF ANY GOVERNMENT, ever (the owner, 2026-10-25:
 * "es ilegal ... quiero evitar problemas de usar esos logos"). The two county
 * logos that this plate used to show are gone with their files, and with
 * them the disclaimer that existed only because of them; municipalities.ts
 * says why, and programs.test.ts and home.test.ts guard it.
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
          {k.lists.map((list, index) => (
            /* Each county block slides in from the left, 0.2 s apart (E10),
               and its top rule draws (E11). */
            <Reveal key={list.title} fx="left" delay={index * 0.2} className="h-where__county">
              <div className="h-where__top">
                <h3 className="h-where__name">{list.title}</h3>
              </div>
              <ul className="h-where__list" role="list">
                {list.names.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
