import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { absoluteUrl } from '@/lib/ttc/site';
import '@/components/ttc/calc/calc.css';
import type { BeamPage } from '@/lib/calc/beam/strings';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { TextLink } from '@/components/ttc/mp/primitives';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * THE PAGE OF ONE CALCULATOR — everything around the tool, the same for
 * each of them. It was the first calculator's view (BeamCalculatorView);
 * the second one needed the same page with other words, and a copy would
 * have drifted from the original within a month. A calculator's view is now
 * its address, its text and its tool, handed to this.
 *
 * Three parts: the hero (what it is, in a line), the calculator itself, and
 * under it what an engineer wants to know before trusting a number from a
 * web page — how it is solved, what it assumes, what it does not do, the
 * sign convention — and the terms it is offered on.
 *
 * The tool comes in as `children`: a client component rendered with its
 * example case, so the server HTML already has a solved example, drawings
 * and all. Without JavaScript that example is what shows, with a line
 * saying why it does not respond.
 *
 * Headings: the h1, an h2 over the tool (visually hidden — the tool is the
 * page), h3s for its result tables, then an h2 and h3s for the notes.
 *
 * ON PAPER it is a calculation sheet, not this page (calc.css, the print
 * rules). The owner printed the first calculator and found a web page on six
 * sheets with no logo, no credit and its disclaimer at the bottom of the
 * last one. So: a letterhead that exists only in print (`.mp-sheet`: the
 * firm's real dark lockup, the calculator's name, what the sheet is); the
 * disclaimer in a ruled box with the credit under it; and, in the MARGIN OF
 * EVERY PAGE, the firm's name at the top and the short disclaimer at the
 * foot — through `@page` margin boxes, whose text CSS takes from custom
 * properties this view sets, because the words are this language's and live
 * with the calculator's text, not in a stylesheet.
 */

/** What a calculator's page says, apart from its tool: the shape the first one's text has (lib/calc/beam/strings.ts). */
export type CalculatorText = BeamPage;

/** A string as a CSS string: for the custom properties the print margins read. */
const cssString = (text: string) => `"${text.replace(/[\\"<>&\n]/g, (ch) => `\\${ch.codePointAt(0)!.toString(16)} `)}"`;

export function CalculatorPage({
  lang,
  path,
  page: s,
  children,
}: {
  lang: Lang;
  /** The calculator's address, the same in both languages (the Spanish page is /es + this). */
  path: string;
  page: CalculatorText;
  /** The tool, with this language's words already in it. */
  children: React.ReactNode;
}) {
  const c = getContent(lang);
  const resources = navLabelOf(c, '/resources');
  // Where the calculator is, as a reader would type it: no scheme, no language of the visitor's.
  const address = `${absoluteUrl(localePath(path, lang)).replace(/^https?:\/\//, '')}`;
  // The tool's heading, named after the last word of the address: "beam-tool".
  const toolId = `${path.slice(path.lastIndexOf('/') + 1)}-tool`;

  return (
    <>
      <JsonLd
        data={breadcrumbLd(lang, [
          { name: c.ui.home, path: '/' },
          { name: resources, path: '/resources' },
          { name: s.h1, path },
        ])}
      />
      <PageHero
        eyebrow={s.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { href: '/resources', label: resources }, { label: s.h1 }]}
        titleLines={[s.h1]}
        sub={s.sub}
        facts={s.facts}
      />

      {/* What the print margins say on every page (calc.css, @page). Escaped as CSS strings: nothing in them can close this element. */}
      <style dangerouslySetInnerHTML={{ __html: `:root{--mp-sheet-top:${cssString(c.company.legalName)};--mp-sheet-name:${cssString(s.h1)};--mp-sheet-bottom:${cssString(s.sheet.margin)}}` }} />

      <section className="mp-section mp-surface--paper mp-appsec" aria-labelledby={toolId}>
        <div className="mp-shell">
          {/* The letterhead: on paper only. The firm's own lockup, never a drawing of it —
              named for the firm like every logo of the site, and silent for a screen
              reader, which meets the firm's name in the footer (pages.test.ts). */}
          <div className="mp-sheet mp-sheet__head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mp-sheet__logo" src={c.company.logo.lockupDarkSm} alt={c.company.legalName} width={c.company.logo.lockupSmSize.w} height={c.company.logo.lockupSmSize.h} decoding="async" fetchPriority="low" aria-hidden="true" />
            <div className="mp-sheet__title">
              <p className="mp-sheet__kind">{s.sheet.kind}</p>
              <p className="mp-sheet__name">{s.h1}</p>
              <p className="mp-sheet__site">{address}</p>
            </div>
          </div>
          <h2 id={toolId} className="mp-sr-only">
            {s.toolHeading}
          </h2>
          <noscript>
            <p className="mp-app__noscript">{s.noscript}</p>
          </noscript>
          {children}
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
            {/* On paper the box closes with whose calculator made the sheet. */}
            <p className="mp-sheet mp-sheet__credit">{s.sheet.credit.replace('{firm}', c.company.legalName).replace('{address}', address)}</p>
            {/* The site's terms say the same of every calculator (site.ts, legal.terms). */}
            <p className="mp-appnotes__links">
              <TextLink href={localePath('/resources', lang)}>{s.back}</TextLink>
              <TextLink href={localePath('/terms', lang)}>{c.legal.terms.title}</TextLink>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
