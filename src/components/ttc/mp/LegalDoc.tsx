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
 *
 * `variant="guide"` is the owners' guides (GuideView): the same two columns,
 * but ragged-right with no automatic hyphens, one right edge for text, facts,
 * questions and links, and no section label — the hero's eyebrow already
 * says "Guide". On a phone the contents are not shown (they stay in the
 * markup). Its rules are in mp.css section 23; the legal pages never get
 * the variant's classes, so they render exactly as before.
 *
 * A section's `toc` is its line in the contents when that line is not the
 * heading (a guide's questions: "Questions" beside "What boards ask…").
 */
export type LegalDocSection = { h: string; toc?: string; body: React.ReactNode };

export function LegalDoc({
  n = '01',
  label,
  tocLabel,
  updated,
  sections,
  variant,
  children,
}: {
  n?: string;
  /** The section label, as on every other page. Left out by the guide variant. */
  label?: string;
  /** Accessible name of the contents. */
  tocLabel: string;
  /** "Last updated: …", printed under the contents. */
  updated?: React.ReactNode;
  sections: readonly LegalDocSection[];
  /** 'guide': the owners' guides' reading layout (see above). */
  variant?: 'guide';
  /** After the last section: the closing "Contact" block. */
  children?: React.ReactNode;
}) {
  const guide = variant === 'guide';
  return (
    <section className={guide ? 'mp-section mp-surface--paper mp-legal-sec--guide' : 'mp-section mp-surface--paper'}>
      <div className="mp-shell">
        {label && !guide ? <SectionHeading n={n} label={label} /> : null}
        <div className={guide ? 'mp-legal mp-legal--guide' : 'mp-legal'}>
          <aside className="mp-legal__side">
            <nav className="mp-legal__toc" aria-label={tocLabel}>
              {sections.map((s, i) => (
                <a key={s.h} href={`#s${i + 1}`}>
                  <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  {s.toc ?? s.h}
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
