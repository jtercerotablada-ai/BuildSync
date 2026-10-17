import React from 'react';
import { SectionHeading } from './primitives';

/**
 * The body of a legal page: the privacy policy, the terms of use and the
 * image credits share it, so the three read as one set of documents.
 *
 * From 901px it is two columns — a table of contents that stays in view on
 * the left, the numbered sections on the right; on a phone, one column with
 * the contents above. Section numbers are drawn by CSS from a counter, so a
 * heading's text is exactly the heading, and the contents are plain anchors:
 * not list items, not headings, because the on-page checks count every
 * <h*>, <p> and <li> of the page and a repeated heading would read as a
 * repeated paragraph.
 *
 * Body text is justified from 640px (mp.css, section 21). The last thing in
 * `children` is the page's closing line, and the closing line stays the last
 * block of the page — the tests rely on it.
 */
export type LegalDocSection = { h: string; body: React.ReactNode };

export function LegalDoc({
  n = '01',
  label,
  tocLabel,
  updated,
  sections,
  children,
}: {
  n?: string;
  /** The section label, as on every other page. */
  label: string;
  /** Accessible name of the contents. */
  tocLabel: string;
  /** "Last updated: …", printed under the contents. */
  updated?: React.ReactNode;
  sections: readonly LegalDocSection[];
  /** After the last section: the closing "Contact" block. */
  children?: React.ReactNode;
}) {
  return (
    <section className="mp-section mp-surface--paper">
      <div className="mp-shell">
        <SectionHeading n={n} label={label} />
        <div className="mp-legal">
          <aside className="mp-legal__side">
            <nav className="mp-legal__toc" aria-label={tocLabel}>
              {sections.map((s, i) => (
                <a key={s.h} href={`#s${i + 1}`}>
                  <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  {s.h}
                </a>
              ))}
            </nav>
            {/* A div, not a <p>: the same date on the policy and on the terms would be a paragraph shared by two pages. */}
            {updated ? <div className="mp-legal__updated">{updated}</div> : null}
          </aside>
          <div className="mp-legal__body">
            {sections.map((s, i) => (
              <section key={s.h} id={`s${i + 1}`} aria-labelledby={`s${i + 1}-h`} className="mp-legal__sec">
                <h2 id={`s${i + 1}-h`}>{s.h}</h2>
                {s.body}
              </section>
            ))}
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
