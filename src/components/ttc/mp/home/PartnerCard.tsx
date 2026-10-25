import React from 'react';
import { getContent, type SiteContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { Reveal } from '../primitives';

/**
 * The contractor's card of the home page's credentials plate: Precision
 * Source Inc., with its own logo, the role line and BOTH Florida license
 * numbers. It is the one place on the home page that names the contractor,
 * and the one place the word "partner" is printed (`partner.construction.role`,
 * welcome only where the logo is shown — the owner, 2026-10-24).
 *
 * Extracted from PartnerSection, which printed this card (beside the
 * engineering card) in its `full` variant; that variant left with the old
 * home page, and PartnerSection keeps the two short forms of /about and
 * /existing-buildings, which share only `licenseNo` with this file.
 *
 * THE MARKUP IS THE OLD CARD'S, AND TESTS GREP IT (shared-text.test.ts finds
 * the card by `div.mp-partner__card`, the logo's file name and the two
 * closing `</div>`s). Keep the class names and the nesting:
 *
 *   div.mp-partner__card
 *     div.mp-partner__logo > img          (the contractor's own file, never redrawn)
 *     p.mp-partner__role                  ("Partner · General and electrical contractor")
 *     p.mp-partner__name
 *     p.mp-partner__who                   (the place)
 *     div.mp-partner__lic > p + dl > div > dt + dd > a   (one row per license)
 *
 * The name is a <p>, not the <h3> it was: the home page's outline is one h1,
 * nine h2 and ten h3 (the eight services, the two counties) and its cards
 * are not headings (home-concepts/SPEC.md, S8).
 *
 * THE CARD IS NEVER SPLIT, NEVER HIDDEN ON A PHONE AND NEVER SHOWN WITHOUT
 * BOTH NUMBERS: F.S. 489.119(5)(b) wants the contractor's license numbers in
 * every advertisement, websites included. Each number is a link to the
 * state's registry, so a board can check it instead of taking the card's
 * word (`licenseNo`). Nothing here says who signs which report or what each
 * firm does on a job (see `partner` in site.ts).
 *
 * A SERVER COMPONENT: it reads its words from `getContent(lang)`; no hook,
 * nothing shipped to the browser.
 */

/**
 * One license number as a link to the Florida DBPR search. The visible text
 * is the number alone; the hidden suffix says where the link goes, so two
 * links to one page are told apart in a screen reader's link list and each
 * still starts with what is on screen. The registry has no stable
 * per-license address — `leadership.license.url` is its search page — so
 * both numbers open the same form. Without an address the number is plain
 * text.
 */
export function licenseNo(c: SiteContent, number: string): React.ReactNode {
  const url = c.leadership.license?.url ?? null;
  return url ? (
    <a href={url} rel="noopener noreferrer" target="_blank">
      {number}
      <span className="mp-sr-only"> — {c.ui.engineer.verify}</span>
    </a>
  ) : (
    number
  );
}

export function PartnerCard({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const p = c.partner;
  const build = p.construction;

  return (
    /* The card's gold top rule draws on scroll (E11), last of the three.
       `Reveal fx` puts no class in front of the list: the tests find the
       card by `<div class="mp-partner__card`. */
    <Reveal fx="line" delay={0.4} className="mp-partner__card h-cred__card h-cred__card--partner">
      <div className="mp-partner__logo">
        {/* The mark is named by its alt, for whoever reads the image and not
            the page (a search engine, a saved picture). It is `aria-hidden`
            because the same name is printed as the card's title two lines
            down: a screen reader would say it twice. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={build.logo.src}
          alt={build.name}
          aria-hidden="true"
          width={build.logo.w}
          height={build.logo.h}
          loading="lazy"
          decoding="async"
        />
      </div>
      <p className="mp-partner__role">{build.role}</p>
      <p className="mp-partner__name">{build.name}</p>
      <p className="mp-partner__who">{build.place}</p>
      <div className="mp-partner__lic">
        <p className="mp-partner__lic-label">{p.licensesLabel}</p>
        <dl>
          {build.licenses.map((l) => (
            <div key={l.number}>
              <dt>{l.label}</dt>
              <dd>{licenseNo(c, l.number)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Reveal>
  );
}
