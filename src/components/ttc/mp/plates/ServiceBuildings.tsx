import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { Img } from '../media';
import { Reveal } from '../primitives';
import { Arrow, Diamond } from '../home/glyphs';
import { Words } from '../home/Words';

/**
 * "The buildings it reaches" — one plate on every service page, in the home's
 * language (the owner, 2026-10-26: "edificios construidos… en todos;
 * investiga, sé creativo, ten visión"). Each service says, in words of its
 * own (`serviceBuildings[slug]` in site.ts / site.es.ts), which buildings it
 * is for, and shows them as the home's photo cards: a finished, occupied
 * building of each kind, in black and white, its name under it with the gold
 * ◆. Where a program leaves buildings out, a hairline row under the cards
 * names them ("Outside the program"), so a reader can tell at a glance
 * whether the letter on the table is theirs.
 *
 * Every type and every exclusion comes from the program's verified rows (the
 * `timing` block of the same service) or the research of 2026-10-26 recorded
 * with `serviceBuildings`; nothing here is typed from memory.
 *
 * The cards are not links (a card on a service page pointing elsewhere would
 * pull the reader off the page they came for) and not headings (the program
 * pages sit at the ceiling of 23): a name in a <p>. The plate's own h2 is its
 * one heading. Six cards are three to a row, eight are four (`--cols`).
 *
 * A SERVER component; the words stay in the HTML.
 */
export function ServiceBuildings({ lang, slug }: { lang: Lang; slug: string }) {
  const c = getContent(lang);
  const b = c.serviceBuildings[slug];
  if (!b) return null;
  const cols = b.items.length % 4 === 0 ? 4 : 3;

  return (
    <section id="buildings" className="h-plate mp-surface--graphite h-bld" aria-labelledby="mp-bld-title">
      <div className="h-wrap">
        <header className="h-head">
          <div className="h-head__top">
            <Reveal as="p" fx="up" className="h-label">
              {b.label}
            </Reveal>
          </div>
          <Reveal as="h2" fx="words" id="mp-bld-title" className="h-h2 h-bld__h">
            <Words text={b.title} accent={b.accentWord} />
          </Reveal>
          <div className="h-head__foot">
            <Reveal fx="up" className="h-head__lede">
              <p className="h-lede">{b.lede}</p>
            </Reveal>
          </div>
        </header>

        <ul className="h-bld__grid" style={{ '--cols': String(cols) } as React.CSSProperties}>
          {b.items.map((it) => (
            <li key={it.title} className="h-bld__card">
              <Reveal fx="img" className="h-ph" style={{ '--ar': '4 / 5' } as React.CSSProperties}>
                <div className="h-ph__in">
                  <Img photo={it.photo} sizes={cols === 4 ? '(min-width: 900px) 22vw, (min-width: 561px) 46vw, 92vw' : '(min-width: 900px) 30vw, (min-width: 561px) 46vw, 92vw'} />
                </div>
              </Reveal>
              <p className="h-bld__t">
                <Diamond />
                <span>{it.title}</span>
              </p>
            </li>
          ))}
        </ul>

        {b.outside ? (
          <Reveal fx="up" className="h-bld__out">
            <p className="h-bld__out-k">{b.outside.label}</p>
            <div>
              <ul className="h-bld__out-list">
                {b.outside.items.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {/* What the program leaves out is still inspected: the line says
                  so and the quiet link goes to the service that does it. */}
              {b.outside.note || b.outside.link ? (
                <p className="h-bld__out-note">
                  {b.outside.note ? <span>{b.outside.note}</span> : null}
                  {b.outside.link ? (
                    <Link className="h-link" href={localePath(b.outside.link.href, lang)}>
                      <span>{b.outside.link.label}</span>
                      <Arrow />
                    </Link>
                  ) : null}
                </p>
              ) : null}
            </div>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
