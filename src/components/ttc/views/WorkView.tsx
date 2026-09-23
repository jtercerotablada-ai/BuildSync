import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { WorkList } from '@/components/ttc/mp/WorkList';
import { Gallery } from '@/components/ttc/mp/Gallery';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * Work: the engagements, the material, the close. The five-step process is
 * not repeated here — it lives on Home and Services.
 *
 * Until real case studies exist the page shows TYPICAL ENGAGEMENTS, and says
 * so with one label everywhere (hero eyebrow and section label alike). There
 * is deliberately no count fact in that state: "06" beside a heading reads as
 * six past jobs, which is exactly the fabricated social proof the site must
 * not imply. A count of real, published case studies is fine.
 */
export function WorkView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.workPage;
  const usingReal = c.caseStudies.length > 0;
  const navLabel = c.primaryNav[2].label;
  const label = usingReal ? p.eyebrowReal : c.ui.typicalEngagements;

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/projects' }])} />

      <PageHero
        eyebrow={label}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabel }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        sub={usingReal ? p.subReal : p.subRepresentative}
        facts={
          usingReal
            ? [{ k: label, v: String(c.caseStudies.length).padStart(2, '0') }, ...p.facts]
            : p.facts
        }
        photo={imagery.pages.work}
      />

      <WorkList n="01" />
      <Gallery n="02" />
      <ContactCTA n="03" />
    </>
  );
}
