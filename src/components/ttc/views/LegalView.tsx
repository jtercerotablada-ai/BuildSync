import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { LegalDoc } from '@/components/ttc/mp/LegalDoc';

/**
 * The privacy policy and the terms of use.
 *
 * Two names for each page, on purpose (`legal` in site.ts): `doc.h1` is the
 * headline, which says what the policy covers ("Privacy Policy for This
 * Website"), and `doc.title` is the short name the breadcrumb, the section
 * label and the footer link use. The short name was the H1 too, and at 12 to
 * 15 characters the on-page check listed it as too short to describe a page.
 *
 * A section is a heading and one paragraph, or several (`p` is a string or a
 * list). The page closes with its OWN line under "Contact" (`doc.contact`):
 * the two documents used to end in the same block — the firm, its counties,
 * the address — and the on-page check counted it as text shared by two pages.
 *
 * The layout is LegalDoc's, shared with the image credits: contents on the
 * left from 901px, numbered sections of justified text on the right. The
 * contact block is the LAST section, so it stays the last block of the page,
 * which the tests check.
 */
export function LegalView({ lang, kind }: { lang: Lang; kind: 'privacy' | 'terms' }) {
  const c = getContent(lang);
  const doc = c.legal[kind];
  return (
    <div className="mp-plates mp-dark">
      <PageHero
        eyebrow={c.ui.legalPages.legal}
        crumbs={[{ href: '/', label: c.ui.home }, { label: doc.title }]}
        titleLines={[doc.h1]}
        sub={doc.sub}
        photo={imagery.pages.legal}
      />
      <LegalDoc
        label={doc.title}
        tocLabel={c.legal.toc}
        updated={'updated' in doc ? doc.updated : c.legal.updated}
        sections={[
          ...doc.sections.map((s) => ({
            h: s.h,
            body: (typeof s.p === 'string' ? [s.p] : s.p).map((par) => <p key={par}>{par}</p>),
          })),
          {
            h: c.legal.contactHeading,
            body: (
              <p>
                {doc.contact} <a href={`mailto:${c.contact.email}`}>{c.contact.email}</a>.{' '}
                {c.company.legalName} — {c.contact.serviceAreaLabel}.
              </p>
            ),
          },
        ]}
      />
    </div>
  );
}
