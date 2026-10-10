import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { beamStrings } from '@/lib/calc/beam/strings';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { TextLink } from '@/components/ttc/mp/primitives';
import { BeamCalculator } from '@/components/ttc/calc/beam/BeamCalculator';
import { breadcrumbLd, JsonLd } from './meta';

/** The calculator's address, the same in both languages (the Spanish page is /es + this). */
export const BEAM_PATH = '/resources/beam';

/**
 * /resources/beam — "Beam reactions and diagrams", the first calculator of
 * the catalogue to open.
 *
 * Three parts: the hero (what it is, in a line), the calculator itself, and
 * under it what an engineer wants to know before trusting a number from a
 * web page — how it is solved, what it assumes, what it does not do, the
 * sign convention — and the terms it is offered on.
 *
 * WRITTEN FOR ENGINEERS. The site's pages speak to building owners and keep
 * codes and jargon out; this one is a tool for people who use the words
 * "hogging moment". Its text is in lib/calc/beam/strings.ts, not site.ts.
 *
 * The calculator is a client component and renders here with its default
 * beam, so the server HTML already has a solved example, drawings and all.
 * Without JavaScript that example is what shows, with a line saying why it
 * does not respond.
 *
 * Headings: the h1, an h2 over the tool (visually hidden — the tool is the
 * page), h3s for its result tables, then an h2 and h3s for the notes.
 */
export function BeamCalculatorView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const s = beamStrings[lang].page;
  const resources = navLabelOf(c, '/resources');

  return (
    <>
      <JsonLd
        data={breadcrumbLd(lang, [
          { name: c.ui.home, path: '/' },
          { name: resources, path: '/resources' },
          { name: s.h1, path: BEAM_PATH },
        ])}
      />
      <PageHero
        eyebrow={s.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { href: '/resources', label: resources }, { label: s.h1 }]}
        titleLines={[s.h1]}
        sub={s.sub}
        facts={s.facts}
      />

      <section className="mp-section mp-surface--paper mp-appsec" aria-labelledby="beam-tool">
        <div className="mp-shell">
          <h2 id="beam-tool" className="mp-sr-only">
            {s.toolHeading}
          </h2>
          <noscript>
            <p className="mp-app__noscript">{s.noscript}</p>
          </noscript>
          <BeamCalculator lang={lang} />
        </div>
      </section>

      <section className="mp-section mp-surface--concrete mp-appnotes">
        <div className="mp-shell">
          <div className="mp-split">
            <div>
              <p className="mp-eyebrow">{s.method.label}</p>
              <h2 className="mp-split__title">{s.method.title}</h2>
            </div>
            <div className="mp-prose">
              {s.method.paragraphs.map((p, i) => (
                <p key={i} className={i === 0 ? 'mp-lead' : undefined}>
                  {p}
                </p>
              ))}
            </div>
          </div>

          <div className="mp-appnotes__grid">
            {[s.assumes, s.limits, s.signs].map((block) => (
              <div key={block.title}>
                <h3 className="mp-appnotes__h">{block.title}</h3>
                <ul className="mp-appnotes__list">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mp-appnotes__terms">
            <h3 className="mp-appnotes__h">{s.disclaimer.title}</h3>
            <p>{s.disclaimer.body}</p>
            <p>
              <TextLink href={localePath('/resources', lang)}>{s.back}</TextLink>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
