import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { company, imagery } from '@/lib/ttc/site';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { EngineerSection } from '@/components/ttc/mp/EngineerSection';
import { HowWeWork } from '@/components/ttc/mp/HowWeWork';
import { CredentialsBar } from '@/components/ttc/mp/CredentialsBar';
import { SouthFloridaMap } from '@/components/ttc/mp/SouthFloridaMap';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/** About: the practice, then the engineer (anchored), then how the work is held. */
export function AboutView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.aboutPage;
  const e = c.leadership;
  const navLabel = c.primaryNav[3].label;

  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${company.url}/about#engineer`,
    name: 'Juan Tercero',
    honorificSuffix: 'PE., M.Sc.',
    jobTitle: e.role,
    description: e.bio[0],
    url: `${company.url}${localePath('/about#engineer', lang)}`,
    worksFor: { '@id': `${company.url}/#organization` },
    hasCredential: [
      { '@type': 'EducationalOccupationalCredential', credentialCategory: 'license', name: 'Professional Engineer (P.E.), State of Florida', ...(e.license ? { identifier: e.license.number, url: e.license.url } : {}) },
      { '@type': 'EducationalOccupationalCredential', credentialCategory: 'degree', name: 'Master of Science (M.Sc.)' },
    ],
    knowsAbout: e.focus,
    ...(e.linkedin ? { sameAs: [e.linkedin] } : {}),
  };

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/about' }])} />
      <JsonLd data={personLd} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabel }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        plainTitle={p.plainTitle}
        sub={p.sub}
        facts={p.facts}
        photo={imagery.pages.about}
      />

      <EngineerSection n="01" variant="full" />

      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <SectionHeading n="02" label={p.approach.eyebrow} />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">{p.approach.title}</h2>
            </Reveal>
            <Reveal delay={0.05} className="mp-prose">
              {p.approach.body.map((par, i) => (
                <p key={i} className={i === 0 ? 'mp-lead' : undefined}>
                  {par}
                </p>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      <HowWeWork n="03" />

      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n="04" label={p.principles.eyebrow} />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">{p.principles.title}</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <ul className="mp-pillars">
                {p.principles.items.map((it) => (
                  <li key={it.k}>
                    <b>{it.k}</b>
                    <span>{it.v}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <CredentialsBar n="05" />
      <SouthFloridaMap n="06" />
      <ContactCTA n="07" />
    </>
  );
}
