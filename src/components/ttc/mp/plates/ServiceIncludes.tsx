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
 * A SERVER component; every word is in the HTML.
 */
export function ServiceIncludes({ lang, slug }: { lang: Lang; slug: string }) {
  const c = getContent(lang);
  const inc = c.serviceIncludes[slug];
  if (!inc) return null;
  const photos = inc.items.every((it) => it.photo);

  return (
    <ul
      className={photos ? 'h-inc' : 'h-inc h-inc--text'}
      style={{ '--n': String(inc.items.length) } as React.CSSProperties}
    >
      {inc.items.map((it, i) => (
        <li key={it.title} className="h-inc__card">
          {it.photo ? (
            <Reveal fx="img" className="h-ph h-inc__ph" style={{ '--ar': '4 / 3' } as React.CSSProperties}>
              <div className="h-ph__in">
                <Img photo={it.photo} sizes="(min-width: 1181px) 19vw, (min-width: 900px) 30vw, (min-width: 641px) 46vw, 92vw" />
              </div>
            </Reveal>
          ) : null}
          <div className="h-inc__t">
            <span className="h-inc__n">{String(i + 1).padStart(2, '0')}</span> {it.title}
          </div>
          <p className="h-inc__v">{it.line}</p>
        </li>
      ))}
    </ul>
  );
}
