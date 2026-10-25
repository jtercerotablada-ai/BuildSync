import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { Reveal } from '../primitives';
import { PartnerCard } from './PartnerCard';
import { Words } from './Words';

/**
 * S8 · CREDENTIALS — why to trust the firm, in one screen: the license
 * words, the registration, and the contractor with its logo and both of its
 * numbers (the single place the contractor is named on the home page).
 *
 * THE OWNER'S THREE DISCIPLINES (2026-10-25). The headline is one line per
 * discipline — Professional Engineers. Structural Engineers. Electrical
 * Engineers. — with "Structural" as the one italic accent. They are
 * DISCIPLINE names beside "Professional Engineers", not a count of people and
 * not licenses: Florida licenses engineers as PE only, so no "SE" is printed
 * here or anywhere on the home page (views/home.test.ts holds it), and
 * nothing says "Licensed Structural Engineers". "Electrical engineers" is
 * allowed only in the strings of the `home` object, which are what is
 * printed here (complete-package.test.ts lets exactly those through).
 *
 * THE MARKS (owner, 2026-10-25, ADDENDUM C of the spec): each line ends in
 * its credential — Professional Engineers PE, Structural Engineers "Special
 * Inspector · Threshold Buildings", Electrical Engineers PE
 * (`home.credentials.marks`, one per line). Florida has no "SE" license, and
 * the FRSE recognition (s. 471.055 F.S.) is not shown for the structural
 * associate, so neither is printed: the owner chose the Special Inspector
 * credential (s. 553.71(9) F.S.), no number, no name. The long mark sits on
 * its own line under its heading line (`h-cred__tag--wide`); the short ones
 * ride the end of theirs.
 *
 * THE THREE-UP ROW, left to right:
 *   1. The engineers — `home.credentials.engineers`: the Florida Professional
 *      Engineer license, what it covers (the scope line), and its status
 *      ("Licensed"). NO NUMBER: the owner, 2026-10-24, "quita los números de
 *      ingeniería como las grandes".
 *   2. The firm — its white monogram (the real file, never redrawn) and the
 *      registry line `company.registry` ("Registered Florida Engineering
 *      Business"), status "Registered". No number either (the registry
 *      number feeds only the structured data).
 *   3. The contractor — `PartnerCard`, with its logo, role line and BOTH
 *      license numbers as links to the state's registry (F.S. 489.119(5)(b)).
 *
 * THE SENTENCE (`partner.lede`, "More than 30 years of combined experience.
 * Two licensed firms, working as one team.") is printed ONCE, as ONE text
 * node: shared-text.test.ts counts the exact string. "Combined" and "two
 * firms" are in the same breath, so it is never read as one person's.
 * Nothing here names a person, says who signs a report, or says the firm
 * builds: the firm designs and inspects.
 *
 * Plain flow for now; the motion slice pins this plate over the pause
 * photograph (E15) and draws the cards' gold rules (E11), marked MOTION HOOK.
 * A SERVER COMPONENT.
 */
export function HomeCredentials({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const h = c.home.credentials;
  const p = c.partner;
  const firm = c.company;

  /* The index of each word across the three lines, so the rise of the words
     (E8) runs on from one line to the next. */
  const wordsBefore = h.titleLines.map((_, i) =>
    h.titleLines.slice(0, i).reduce((n, line) => n + line.split(/\s+/).length, 0),
  );

  return (
    /* MOTION HOOK: E15 pins this plate (sticky, top 0, min-height 100svh,
       z-index 2) over the pause photograph at ≥ 900 × 720. */
    <section
      id="credentials"
      className="h-plate h-cred mp-surface--graphite"
      aria-labelledby="h-cred-h"
      data-motion="stack-credentials"
    >
      <div className="mp-grid-bg" aria-hidden="true" />
      <div className="h-wrap">
        <Reveal as="p" fx="up" className="h-label">
          {h.label}
        </Reveal>

        <div className="h-cred__head">
          {/* The words rise out of their masks (E8). One span per line, a
              space between them so the heading reads in a line. */}
          <Reveal as="h2" fx="words" id="h-cred-h" className="h-h2 h-cred__h">
            {h.titleLines.map((line, i) => (
              <React.Fragment key={line}>
                {i > 0 ? ' ' : null}
                <span className="h-cred__line">
                  <Words text={line} accent={h.accentWord} start={wordsBefore[i]} />
                  {/* The credential mark of the line: a small mono tag. The
                      short ones (PE) ride the end of their line; the long
                      one (the Special Inspector credential) takes a line of
                      its own under it. Not a heading, not a link. */}
                  {h.marks[i] ? (
                    <>
                      {' '}
                      <span className={h.marks[i].length > 6 ? 'h-cred__tag h-cred__tag--wide' : 'h-cred__tag'}>
                        {h.marks[i]}
                      </span>
                    </>
                  ) : null}
                </span>
              </React.Fragment>
            ))}
          </Reveal>
          <Reveal as="p" fx="up" delay={0.3} className="h-lede h-cred__lede">
            {p.lede}
          </Reveal>
        </div>

        {/* Each card's gold top rule draws across, 0.2 s apart (E11): the
            rules are the cards' `::before`. */}
        <div className="h-cred__row">
          <Reveal fx="line" className="h-cred__card h-cred__card--eng">
            <p className="h-cred__kind">{h.engineers.k}</p>
            <p className="h-cred__name">{h.engineers.name}</p>
            <p className="h-cred__scope">{h.engineers.scope}</p>
            <p className="h-cred__status">{p.engineering.licensed}</p>
          </Reveal>

          {firm.registry ? (
            <Reveal fx="line" delay={0.2} className="h-cred__card h-cred__card--firm">
              <div className="h-cred__mark">
                {/* The firm's own white monogram. `aria-hidden`: its name is
                    the card's own line, and a screen reader would say it
                    twice; the alt is for whoever reads the markup. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={firm.logo.markLightSm}
                  alt={firm.name}
                  aria-hidden="true"
                  width={firm.logo.markSmSize.w}
                  height={firm.logo.markSmSize.h}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p className="h-cred__kind">{h.firm.k}</p>
              <p className="h-cred__name">{firm.registry}</p>
              <p className="h-cred__status">{p.engineering.registered}</p>
            </Reveal>
          ) : null}

          <PartnerCard lang={lang} />
        </div>
      </div>
    </section>
  );
}
