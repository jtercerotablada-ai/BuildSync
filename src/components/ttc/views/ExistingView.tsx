import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ServiceCard } from '@/components/ttc/mp/ServiceCard';
import { ProcessTimeline } from '@/components/ttc/mp/ProcessTimeline';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/** Landing for associations, managers and owners of buildings already standing. */
export function ExistingView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.existingPage;
  const existing = c.services.filter((s) => s.track === 'existing');
  const navLabel = c.primaryNav[1].label;

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/existing-buildings' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabel }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        sub={p.sub}
        facts={p.facts}
        photo={imagery.pages.existingBuildings}
      />

      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n="01" label={p.triggers.eyebrow} />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">{p.triggers.title}</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <ul className="mp-pillars">
                {p.triggers.items.map((t) => (
                  <li key={t.k}>
                    <b>{t.k}</b>
                    <span>{t.v}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mp-section mp-section--lg mp-surface--concrete">
        <div className="mp-shell">
          <SectionHeading n="02" label={p.servicesEyebrow} />
          <div className="mp-svcgrid">
            {existing.map((s, i) => (
              <ServiceCard key={s.slug} service={s} index={i} />
            ))}
          </div>
        </div>
      </section>

      <ProcessTimeline n="03" />
      <ContactCTA n="04" />
    </>
  );
}
