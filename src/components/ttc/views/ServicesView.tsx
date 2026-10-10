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
 *   01  Existing buildings   paper      #existing   four cards
 *   02  New projects         concrete   #new        four cards
 *   03  What we design       paper      the typology grid, moved here from
 *                                       the home page
 *   04  How we work          concrete   the five-step process (this page only)
 *   05  Contact
 *
 * The track ids are link targets (`/services#new` from the home page's
 * new-buildings section). Four and four: the two-column card grid closes on
 * a straight edge in both tracks.
 */
export function ServicesView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.servicesPage;
  const tracks = [
    { ...p.tracks.existing, items: c.services.filter((s) => s.track === 'existing') },
    { ...p.tracks.new, items: c.services.filter((s) => s.track === 'new') },
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabelOf(c, '/services'), path: '/services' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabelOf(c, '/services') }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
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

      <Typologies n="03" surface="paper" />
      <HowWeWork n="04" />
      <ContactCTA n="05" />
    </>
  );
}
