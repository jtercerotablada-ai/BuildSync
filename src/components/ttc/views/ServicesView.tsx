import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ServiceCard } from '@/components/ttc/mp/ServiceCard';
import { HowWeWork } from '@/components/ttc/mp/HowWeWork';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/** Services organised by the client's situation: new projects, then existing buildings. */
export function ServicesView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.servicesPage;
  const tracks = [
    { ...p.tracks.new, items: c.services.filter((s) => s.track === 'new') },
    { ...p.tracks.existing, items: c.services.filter((s) => s.track === 'existing') },
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: c.primaryNav[0].label, path: '/services' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: c.primaryNav[0].label }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        plainTitle={p.plainTitle}
        sub={p.sub}
        facts={p.facts}
        photo={imagery.pages.services}
      />

      {tracks.map((tr, ti) => (
        <section
          key={tr.id}
          id={tr.id}
          className={`mp-section mp-section--lg ${ti === 0 ? 'mp-surface--paper' : 'mp-surface--concrete'}`}
          aria-labelledby={`mp-track-${tr.id}`}
        >
          <div className="mp-shell">
            <SectionHeading n={String(ti + 1).padStart(2, '0')} label={tr.eyebrow} />
            <div className="mp-intro">
              <Reveal>
                <h2 id={`mp-track-${tr.id}`} className="mp-intro__title">
                  {tr.title}
                </h2>
              </Reveal>
              <Reveal delay={0.06}>
                <p className="mp-intro__lede">{tr.lede}</p>
              </Reveal>
            </div>
            <div className="mp-svcgrid">
              {tr.items.map((s, i) => (
                <ServiceCard key={s.slug} service={s} index={i} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <HowWeWork n="03" />
      <ContactCTA n="04" />
    </>
  );
}
