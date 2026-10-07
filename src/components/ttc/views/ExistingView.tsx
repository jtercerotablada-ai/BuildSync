import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { SituationCard } from '@/components/ttc/mp/SituationCard';
import { ProcessTimeline } from '@/components/ttc/mp/ProcessTimeline';
import { PartnerSection } from '@/components/ttc/mp/PartnerSection';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * Landing for associations, managers and owners of buildings already
 * standing — a HUB, not a second copy of /services.
 *
 *   01  When to call        four situations, each with one door to the
 *                           service that answers it (SituationCard)
 *   02  Recertification     the six steps both county programs share
 *       & BSIP
 *   03  Who we work with    the short form of the partner block
 *   04  Contact
 *
 * It used to list four "moments" that linked nowhere and then print the four
 * existing-building services as the cards /services prints, word for word.
 * The two are one section now, written for this page; the full cards — when
 * you need it, what is included, what you receive, next step — are on
 * /services, and each situation here leads to its service's own page.
 */
export function ExistingView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.existingPage;
  const existing = c.services.filter((s) => s.track === 'existing');
  const navLabel = c.primaryNav[1].label;
  // One button per county program, in the site's order (Miami-Dade, then
  // Broward), each with that program's own label and its service preselected
  // on the form. Both solid: neither county is the secondary choice. This
  // page tells the reader to "send the notice" and, on a phone, used to
  // offer its one contact link twelve screens down.
  const noticeActions = existing.flatMap((s) =>
    s.program
      ? [{ href: `/contact?service=${s.slug}`, label: s.program.cta, variant: 'solid' as const }]
      : [],
  );

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/existing-buildings' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabel }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        sub={p.sub}
        actions={noticeActions}
        facts={p.facts}
        photo={imagery.pages.existingBuildings}
      />

      <section className="mp-section mp-section--lg mp-surface--paper" aria-labelledby="mp-situations-title">
        <div className="mp-shell">
          <SectionHeading n="01" label={p.triggers.eyebrow} />
          <div className="mp-intro">
            <Reveal>
              <h2 id="mp-situations-title" className="mp-intro__title">
                {p.triggers.title}
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="mp-intro__lede">{p.triggers.lede}</p>
            </Reveal>
          </div>
          <div className="mp-svcgrid">
            {p.triggers.items.map((item, i) => (
              <SituationCard key={item.slug} item={item} index={i} />
            ))}
          </div>
        </div>
      </section>

      <ProcessTimeline n="02" />
      {/* Right after the process: who the reader will be dealing with while
          it runs. The short form — the block is whole on the home page, and
          the licenses are listed on /about, where this one links. */}
      <PartnerSection n="03" lang={lang} surface="paper" variant="brief" />
      <ContactCTA n="04" />
    </>
  );
}
