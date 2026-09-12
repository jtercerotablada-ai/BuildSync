import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { SectionHeading } from '@/components/ttc/mp/primitives';

export function LegalView({ lang, kind }: { lang: Lang; kind: 'privacy' | 'terms' }) {
  const c = getContent(lang);
  const doc = c.legal[kind];
  return (
    <>
      <PageHero
        eyebrow={c.ui.legalPages.legal}
        crumbs={[{ href: '/', label: c.ui.home }, { label: doc.title }]}
        titleLines={[doc.title]}
        plainTitle={doc.title}
        sub={doc.sub}
      />
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell mp-shell--narrow">
          <SectionHeading n="01" label={doc.title} />
          <div className="mp-prose">
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
