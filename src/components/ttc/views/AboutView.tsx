import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { company, imagery } from '@/lib/ttc/site';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { PartnerSection } from '@/components/ttc/mp/PartnerSection';
import { TeamGrid } from '@/components/ttc/mp/TeamGrid';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * About: the one page that holds the engineer and the two firms, in order
 * (the owner, 2026-10-20: "not mixed in, everything ordered and as
 * professional as possible").
 *
 *   01 the team (paper, anchored #team; Juan's tile #engineer) — one grid of
 *      equal portraits after MKA's people page (the owner, 2026-10-24: "no
 *      me pongas como líder, soy parte igual"), each with the company the
 *      person works for (TeamGrid; `aboutPage.team` has the rules). It
 *      replaced the one-engineer profile (EngineerSection);
 *   02 how the work is held (concrete) — the approach beside its title, then
 *      the five principles as one strip under their label;
 *   03 the two firms (paper, anchored #contractor) — what each company is
 *      and the four registrations, the contractor's numbers linked to the
 *      state's search;
 *   then the closing band (graphite), the page's one action.
 *
 * The surfaces alternate, so no same-surface seam rule fires. The five-step
 * process lives on Services and the service-area band on Home; repeating
 * them here made a Home → Services → About visit read the same blocks three
 * times. Nothing on this page says who signs a report (the owner's rule).
 */
export function AboutView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.aboutPage;
  const e = c.leadership;
  const navLabel = navLabelOf(c, '/about');

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
    image: `${company.url}${e.portrait.src}`,
    hasCredential: [
      { '@type': 'EducationalOccupationalCredential', credentialCategory: 'license', name: 'Professional Engineer (P.E.), State of Florida', ...(e.license ? { identifier: e.license.number, url: e.license.url } : {}) },
      { '@type': 'EducationalOccupationalCredential', credentialCategory: 'degree', name: 'Master in Construction Project Management' },
      { '@type': 'EducationalOccupationalCredential', credentialCategory: 'degree', name: 'Civil Engineer' },
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
        sub={p.sub}
        facts={p.facts}
        photo={imagery.pages.about}
      />

      <TeamGrid n="01" lang={lang} />

      <section className="mp-section mp-surface--concrete mp-about-how" aria-labelledby="mp-about-how-title">
        <div className="mp-shell">
          <SectionHeading n="02" label={p.approach.eyebrow} />
          <div className="mp-split">
            <Reveal>
              <h2 id="mp-about-how-title" className="mp-split__title">
                {p.approach.title}
              </h2>
            </Reveal>
            <Reveal delay={0.05} className="mp-prose">
              {p.approach.body.map((par, i) => (
                <p key={i} className={i === 0 ? 'mp-lead' : undefined}>
                  {par}
                </p>
              ))}
            </Reveal>
          </div>
          <Reveal delay={0.08}>
            <h3 className="mp-about-how__label">{p.principles.eyebrow}</h3>
            <ul className="mp-pillars mp-pillars--strip">
              {p.principles.items.map((it) => (
                <li key={it.k}>
                  <b>{it.k}</b>
                  <span>{it.v}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* The short form: what each firm is, and the four registrations as
          one list, the contractor's numbers still links to the state's
          search. The block with the two cards is the home page's. Paper, so
          it does not sit concrete on concrete after section 02. */}
      <PartnerSection n="03" lang={lang} variant="about" surface="paper" />

      {/* The default secondary ("Meet the Team" → /about#team) would point
          back up this same page. */}
      <ContactCTA secondary={{ href: '/services', label: c.ui.seeAllServices }} notice={false} />
    </>
  );
}
