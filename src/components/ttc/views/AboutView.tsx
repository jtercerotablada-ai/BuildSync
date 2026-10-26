import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { PartnerSection } from '@/components/ttc/mp/PartnerSection';
import { HomeContact } from '@/components/ttc/mp/home/HomeContact';
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
  const navLabel = navLabelOf(c, '/about');
  // No Person schema and no team since 2026-10-26 (the owner: "no pongas mi
  // nombre, somos empresa"): the page is the firm's.

  return (
    <div className="mp-plates mp-dark">
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/about' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabel }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        sub={p.sub}
        photo={imagery.pages.about}
      />

      <section className="mp-section mp-surface--paper mp-about-how" aria-labelledby="mp-about-how-title">
        <div className="mp-shell">
          <SectionHeading n="01" label={p.approach.eyebrow} />
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
      {/* What working with the firm means: the three rows that stood under
          the team grid (leadership.forYou), in the firm's voice. */}
      <section className="mp-section mp-surface--concrete" aria-labelledby="mp-about-for-title">
        <div className="mp-shell">
          <SectionHeading n="02" label={c.ui.engineer.forYou} />
          <div className="mp-intro">
            <Reveal>
              <h2 id="mp-about-for-title" className="mp-intro__title">
                {p.forYouTitle}
              </h2>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mp-intro__lede">{p.forYouLede}</p>
            </Reveal>
          </div>
          <Reveal delay={0.06}>
            <ul className="mp-pillars mp-pillars--strip">
              {c.leadership.forYou.map((row) => (
                <li key={row.k}>
                  <b>{row.k}</b>
                  <span>{row.v}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <PartnerSection n="03" lang={lang} variant="about" surface="paper" />

      {/* The default secondary ("Meet the Team" → /about#team) would point
          back up this same page. */}
      <HomeContact closing lang={lang} notice={false} />
    </div>
  );
}
