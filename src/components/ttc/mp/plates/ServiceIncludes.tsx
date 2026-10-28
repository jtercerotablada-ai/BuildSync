import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { Img } from '../media';
import { Reveal } from '../primitives';

/**
 * What the inspection includes, as cards (2026-10-27, the owner pointing at
 * a competitor's "inspections include…" row: "bien claro"). One card per
 * part of the work (`serviceIncludes[slug]` in site.ts): on the two county
 * programs a black-and-white photograph at 4:3, then the number and the
 * name, then one plain sentence; on the other four, the same card without
 * the photograph, its number set large.
 *
 * The name is a <div>, never a heading (the program pages sit at their
 * ceiling of 23) and never a <p> of its own: a paragraph that names the
 * thermography must say where it applies (complete-package.test.ts), and
 * the name alone cannot. The sentence is the card's one <p>.
 *
 * ON A CITY PAGE (`bare`): the photographs and the names only — the
 * sentences are the program page's, and a city page prints nothing of six
 * words that another page prints (cities.test.ts). A part that is in the
 * package only where it applies keeps its condition after its name
 * ("Infrared thermography, where required"): the sentence that carried it is
 * not printed, and "required where" must never read as "always"
 * (complete-package.test.ts). `omit` leaves out the parts the city's own
 * page excludes (cities.ts, `omitIncludes`); the cards are numbered as
 * printed.
 *
 * A SERVER component; every word is in the HTML.
 */
export function ServiceIncludes({
  lang,
  slug,
  bare = false,
  omit = [],
}: {
  lang: Lang;
  slug: string;
  bare?: boolean;
  omit?: readonly string[];
}) {
  const c = getContent(lang);
  const inc = c.serviceIncludes[slug];
  if (!inc) return null;
  const items = inc.items.filter((it) => !it.id || !omit.includes(it.id));
  const photos = items.every((it) => it.photo);

  return (
    <ul
      className={photos ? 'h-inc' : 'h-inc h-inc--text'}
      style={{ '--n': String(items.length) } as React.CSSProperties}
    >
      {items.map((it, i) => (
        <li key={it.title} className="h-inc__card">
          {it.photo ? (
            <Reveal fx="img" className="h-ph h-inc__ph" style={{ '--ar': '4 / 3' } as React.CSSProperties}>
              <div className="h-ph__in">
                <Img photo={it.photo} sizes="(min-width: 1181px) 19vw, (min-width: 900px) 30vw, (min-width: 641px) 46vw, 92vw" />
              </div>
            </Reveal>
          ) : null}
          {/* On a city page the number is drawn (dark.css, `data-n`), not
              printed: the name and its condition are the card's text, under
              six words — the same card is on every city page of the county. */}
          {bare ? (
            <div className="h-inc__t" data-n={String(i + 1).padStart(2, '0')}>
              {it.when ? `${it.title}, ${it.when}` : it.title}
            </div>
          ) : (
            <div className="h-inc__t">
              <span className="h-inc__n">{String(i + 1).padStart(2, '0')}</span> {it.title}
            </div>
          )}
          {bare ? null : <p className="h-inc__v">{it.line}</p>}
        </li>
      ))}
    </ul>
  );
}
