import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { Reveal } from '../primitives';
import { Arrow } from './glyphs';
import { Words } from './Words';

/**
 * S8 · CREDENTIALS — why to trust the firm, said the way the large firms say
 * it (the owner, 2026-10-25, of emxse.com's Credentials block: "me gusta más
 * como lo pone EMX"): a small label and a list at the left, a large heading
 * and one paragraph at the right.
 *
 * THE LIST is the disciplines the firm practices, each with the credential
 * behind it (`home.credentials.rows`): civil, structural and electrical
 * engineering, each PE, and the structural one "Recognized Structural
 * Engineer" as well — "FL Board Recognized Structural Engineer", the Board's
 * own recognition (s. 471.055 F.S.), which the DBPR register shows on the
 * structural associate's PE (effective 2024-02-13; verified 2026-10-25),
 * printed in words: the owner, "nadie dice FRSE". Never "SE", a state
 * license he does not hold. Nothing else: the firm's own registration as an engineering
 * business is not listed (the owner, the same night: "eso es lógico").
 * DISCIPLINES, NOT PEOPLE: no name, no count, no license number (the owner,
 * 2026-10-24: "quita los números de ingeniería como las grandes").
 *
 * THE HEADING AND THE PARAGRAPH are the firm's own words, not EMX's: licensed
 * in Florida in every discipline it practices, licenses the state issues and
 * anyone can check. Nothing here names the contractor, a person, who signs what, or a
 * figure: the owner, 2026-10-25, took "lo de ambas empresas" off the home
 * page — Precision Source and the combined-experience sentence live on
 * /about and /existing-buildings, with the contractor's numbers where the
 * law wants them, beside its name.
 *
 * "Electrical engineering" is allowed only in the strings of the `home`
 * object (complete-package.test.ts lets exactly those through). No "SE" is
 * printed here or anywhere on the home page (views/home.test.ts holds it).
 *
 * Motion: the label and the paragraph fade up (E9), the rows slide in from
 * the left 0.12 s apart (E10), the heading's words rise (E8). A SERVER
 * COMPONENT.
 */
/* The DBPR licence search, the one outside host the site links for licenses
   (pages.test.ts). Here and not in site.ts: the home's strings carry no digit
   and no ampersand (home.test.ts), and an address is the same in both
   languages. */
const DBPR_LICENSE_SEARCH = 'https://www.myfloridalicense.com/wl11.asp?mode=0&SID=&brd=&typ=';

export function HomeCredentials({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const h = c.home.credentials;
  const rows: readonly { name: string; mark: string }[] = h.rows;

  return (
    <section id="credentials" className="h-plate h-cred mp-surface--graphite" aria-labelledby="h-cred-h">
      <div className="h-wrap h-cred__grid">
        <Reveal as="p" fx="up" className="h-label h-cred__label">
          {h.label}
        </Reveal>

        <div className="h-cred__main">
          <Reveal as="h2" fx="words" id="h-cred-h" className="h-h2 h-cred__h">
            <Words text={h.title} accent={h.accentWord} />
          </Reveal>
          <Reveal as="p" fx="up" delay={0.25} className="h-lede h-cred__p">
            {h.body}
          </Reveal>
          {/* The register the paragraph names, as the plate's one link: the
              DBPR licence search, in a new tab like every outside link. */}
          <Reveal fx="up" delay={0.35} className="h-cred__verify">
            <a className="h-link" href={DBPR_LICENSE_SEARCH} target="_blank" rel="noopener noreferrer">
              <span>{h.verify.label}</span>
              <Arrow />
            </a>
          </Reveal>
        </div>

        <ul className="h-cred__list">
          {rows.map((row, i) => (
            <Reveal key={row.name} as="li" fx="left" delay={i * 0.12} className="h-cred__row">
              <span className="h-cred__name">{row.name}</span>
              {/* The credential, as a small mono tag in a thin gold ring.
                  Not a heading, not a link. */}
              <span className="h-cred__tag">{row.mark}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
