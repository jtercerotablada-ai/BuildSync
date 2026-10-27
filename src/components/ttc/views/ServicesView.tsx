import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ServiceCard } from '@/components/ttc/mp/ServiceCard';
import { HomeContact } from '@/components/ttc/mp/home/HomeContact';
import { Reveal } from '@/components/ttc/mp/primitives';
import { Words } from '@/components/ttc/mp/home/Words';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * The services index, in the home's language (the owner, 2026-10-26: every
 * inner page to the standard of the home; the thumbnail rows this page had
 * were "horrible"):
 *
 *   hero          the page's headline, the lede, the photograph (PageHero in
 *                 the dark skin)
 *   services      ONE grid of the six services in `home.order`, each the
 *                 home's card — photograph at 3/2, track tag, name, one
 *                 line, the ring — with this page's own foot under it: the
 *                 first step, the link to the form, the fold with the three
 *                 other answers (ServiceCard). The two tracks' ledes open
 *                 the plate side by side; their titles went with the
 *                 two-column-by-track layout, which left one card alone
 *                 under "Design review" (the home's lesson of 2026-10-26).
 *   (the building types left this page on 2026-10-26 — the owner: "solo
 *   los 6 servicios"; they are a plate of the two county-program pages now)
 *   (the five steps of "How we work" moved to /about on 2026-10-26 — the
 *   owner: this page shows the six services and nothing else)
 *   closing band
 *
 * The hero has no facts panel: a count of services beside a headline that
 * counts them said it twice.
 */
export function ServicesView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.servicesPage;
  // The home's order (the owner's, 2026-10-26): recertification, BSIP,
  // then the rest by the sales he expects of them.
  const cards = c.home.order.map((slug) => {
    const s = c.services.find((x) => x.slug === slug);
    if (!s) throw new Error(`home.order: no service "${slug}"`);
    return s;
  });
  const trackLabel = (track: string) => (track === 'new' ? p.tracks.new.eyebrow : p.tracks.existing.eyebrow);

  return (
    <div className="mp-plates mp-dark">
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabelOf(c, '/services'), path: '/services' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabelOf(c, '/services') }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        // No line under the headline (the owner, 2026-10-27: "Organized by
        // what you need… me parece estúpido"): the six cards say it.
        photo={imagery.pages.services}
      />

      <section id="services" className="h-plate h-svc-plate mp-surface--graphite" aria-labelledby="mp-services-title">
        <div className="h-wrap">
          <header className="h-head">
            <div className="h-head__top">
              <Reveal as="p" fx="up" className="h-label">
                {p.grid.label}
              </Reveal>
            </div>
            <Reveal as="h2" fx="words" id="mp-services-title" className="h-h2">
              <Words text={p.grid.title} accent={p.grid.accentWord} />
            </Reveal>
            {/* No lines under the headline (the owner, 2026-10-27: "ya se sabe
                que es para ellos los servicios"): the two tracks' ledes that
                stood here said who each track was for. */}
          </header>

          <div className="h-svc__grid">
            {cards.map((s) => (
              <ServiceCard key={s.slug} service={s} track={trackLabel(s.track)} />
            ))}
          </div>
        </div>
      </section>

      <HomeContact closing lang={lang} notice={false} />
    </div>
  );
}
