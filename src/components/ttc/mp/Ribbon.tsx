import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { TextLink } from './primitives';

/**
 * The moving ribbon under the home hero: two rows of large words running in
 * opposite directions — the buildings (smaller, grey) and the services
 * (larger, white). Copy is `ribbon` in site.ts.
 *
 * Pure CSS (mp-firm.css): each row prints its words twice in one track and
 * the track slides by exactly half its width, so the loop has no seam. The
 * rows are decorative repeats of the services menu, so they are hidden from
 * screen readers; the label and "All services" link above them are what a
 * screen reader gets. Reduced motion stops both rows (mp-firm.css).
 */
export function Ribbon({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const r = c.ribbon;

  return (
    <section className="mp-section mp-surface--paper mp-ribbon" aria-labelledby="mp-ribbon-title">
      <div className="mp-shell mp-ribbon__head">
        <h2 id="mp-ribbon-title" className="mp-ribbon__label">
          {r.label}
        </h2>
        <TextLink href={localePath(r.more.href, lang)}>{r.more.label}</TextLink>
      </div>
      <p className="mp-shell mp-ribbon__line">{c.home.servicesLine}</p>
      <div className="mp-ribbon__rows" aria-hidden="true">
        {r.rows.map((row, i) => (
          <div key={i} className={`mp-ribbon__row mp-ribbon__row--${i + 1}`}>
            <div className="mp-ribbon__track">
              {[0, 1].map((copy) => (
                <span key={copy} className="mp-ribbon__set">
                  {row.map((w) => (
                    <span key={w} className="mp-ribbon__word">
                      {w}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
