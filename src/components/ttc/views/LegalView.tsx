import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { SectionHeading } from '@/components/ttc/mp/primitives';

/**
 * The privacy policy and the terms of use.
 *
 * Two names for each page, on purpose (`legal` in site.ts): `doc.h1` is the
 * headline, which says what the policy covers ("Privacy Policy for This
 * Website"), and `doc.title` is the short name the breadcrumb, the section
 * label and the footer link use. The short name was the H1 too, and at 12 to
 * 15 characters the on-page check listed it as too short to describe a page.
 */
export function LegalView({ lang, kind }: { lang: Lang; kind: 'privacy' | 'terms' }) {
  const c = getContent(lang);
  const doc = c.legal[kind];
  return (
    <>
      <PageHero
        eyebrow={c.ui.legalPages.legal}
        crumbs={[{ href: '/', label: c.ui.home }, { label: doc.title }]}
        titleLines={[doc.h1]}
        sub={doc.sub}
      />
      {/* Standard shell, so the body starts on the same left edge as the
          hero title and breadcrumb; the measure is limited on the prose, not
          by narrowing (and re-centering) the whole column. */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n="01" label={doc.title} />
          <div className="mp-prose mp-measure">
            {doc.sections.map((s) => (
              <React.Fragment key={s.h}>
                <h2>{s.h}</h2>
                <p>{s.p}</p>
              </React.Fragment>
            ))}
            <h2>{c.legal.contactHeading}</h2>
            <p>
              {c.company.legalName} — {c.contact.serviceAreaLabel}.{' '}
              <a href={`mailto:${c.contact.email}`}>{c.contact.email}</a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
