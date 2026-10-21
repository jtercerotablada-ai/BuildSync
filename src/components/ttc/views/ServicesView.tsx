import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ServiceCard } from '@/components/ttc/mp/ServiceCard';
import { Typologies } from '@/components/ttc/mp/Typologies';
import { HowWeWork } from '@/components/ttc/mp/HowWeWork';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * Services organised by the client's situation. Existing buildings first —
 * the order of the whole site, the footer and the contact dropdown — then
 * new projects:
 *
 *   01  Existing buildings ┐ paper   one band, the two tracks side by side
 *   02  New projects       ┘         from 900px (#existing, #new), stacked
 *                                     below; four index rows each
 *   03  What we design       concrete  the typology list
 *   04  How we work          paper     the five-step process (this page only)
 *   05  Contact
 *
 * The track ids are link targets (`/services#new` from the home page's
 * new-buildings section). The two columns share one grid (mp.css,
 * `.mp-tracks`): with subgrid the section labels, the intros and the four
 * row rules line up across both, and `--mp-track-rows` is the number of rows
 * a column spans — its label, its intro and its longest list.
 *
 * The hero has no facts panel: "4 services / 4 services / Miami-Dade &
 * Broward" said again what the H1 and the line under it say.
 */
export function ServicesView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.servicesPage;
  const tracks = [
    { ...p.tracks.existing, items: c.services.filter((s) => s.track === 'existing') },
    { ...p.tracks.new, items: c.services.filter((s) => s.track === 'new') },
  ];
  const rows = 2 + Math.max(...tracks.map((t) => t.items.length));

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabelOf(c, '/services'), path: '/services' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabelOf(c, '/services') }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        sub={p.sub}
        photo={imagery.pages.services}
      />

      <div className="mp-section mp-surface--paper">
        <div className="mp-shell mp-tracks" style={{ ['--mp-track-rows' as string]: String(rows) }}>
          {tracks.map((tr, ti) => (
            <section
              key={tr.id}
              id={tr.id}
              className="mp-track"
              aria-labelledby={`mp-track-${tr.id}`}
            >
              <SectionHeading n={String(ti + 1).padStart(2, '0')} label={tr.eyebrow} />
              <div className="mp-intro mp-intro--track">
                <Reveal>
                  <h2 id={`mp-track-${tr.id}`} className="mp-intro__title">
                    {tr.title}
                  </h2>
                </Reveal>
                <Reveal delay={0.06}>
                  <p className="mp-intro__lede">{tr.lede}</p>
                </Reveal>
              </div>
              <div className="mp-svcindex">
                {tr.items.map((s, i) => (
                  <ServiceCard key={s.slug} service={s} index={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <Typologies n="03" />
      <HowWeWork n="04" surface="paper" />
      <ContactCTA notice={false} />
    </>
  );
}
