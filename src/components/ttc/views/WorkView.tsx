import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { WorkList } from '@/components/ttc/mp/WorkList';
import { HowWeWork } from '@/components/ttc/mp/HowWeWork';
import { Gallery } from '@/components/ttc/mp/Gallery';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

export function WorkView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.workPage;
  const usingReal = c.caseStudies.length > 0;
  const navLabel = c.primaryNav[2].label;
  const count = usingReal ? c.caseStudies.length : c.engagements.length;

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/projects' }])} />

      <PageHero
        eyebrow={usingReal ? p.eyebrowReal : p.eyebrowRepresentative}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabel }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        plainTitle={p.plainTitle}
        sub={usingReal ? p.subReal : p.subRepresentative}
        facts={[{ k: usingReal ? p.eyebrowReal : p.eyebrowRepresentative, v: String(count).padStart(2, '0') }, ...p.facts]}
        photo={imagery.pages.work}
      />

      <WorkList n="01" />
      <HowWeWork n="02" />
      <Gallery n="03" />
      <ContactCTA n="04" />
    </>
  );
}
