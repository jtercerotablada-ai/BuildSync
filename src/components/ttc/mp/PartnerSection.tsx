import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { SectionHeading, Reveal, TextLink } from './primitives';
import { licenseNo } from './home/PartnerCard';

/**
 * Who the practice works with, in the two short forms of the pages that are
 * not the home page: /about (what each company is, and the registrations as
 * one list) and /existing-buildings (who the reader deals with while a
 * recertification runs). The home page's own card for the contractor — logo,
 * role line and both numbers — is `PartnerCard` (home/PartnerCard.tsx), shared
 * with this file only through `licenseNo`.
 *
 * Nothing here says who signs which report: the owner decided the site does
 * not state it (see `partner` in site.ts), so do not add a "signed and
 * sealed" line back. No form says what a firm does on a job either — the
 * owner wants a team shown, not a division of labour — and neither form shows
 * a logo, so neither prints the word "partner" (a test holds both).
 *
 * THE ENGINEERING LICENSES ARE NAMED, NOT NUMBERED (the owner, 2026-10-24:
 * as the large structural firms print them; Florida does not require the
 * number on a website — see `company.registry` in site.ts). The register
 * says "Licensed" / "Registered" where the contractor's row says a number.
 * THE CONTRACTOR'S NUMBERS STAY (F.S. 489.119(5)(b): in every
 * advertisement, websites included), and each is a link to the state
 * registry, so a board can check it instead of taking the row's word. The
 * registry (DBPR) has no stable per-license URL — `leadership.license.url`
 * is its search page — so both numbers open the same form; /about's sentence
 * above the register says that they open the state's search (no how-to line
 * under them: the owner, 2026-10-20, no small print).
 *
 * TWO FORMS, ONE PER PAGE. The block used to be printed whole on the home
 * page, on /about and on /existing-buildings: one text on three pages, and
 * the first thing the on-page check listed as repeated. The whole form (the
 * two cards under a headline and a lede) left with the old home page. Now:
 *   • `about` (/about): what each company is, and the four registrations as
 *     ONE list — firm, license, number or status — with the same links. No
 *     logos and no cards: the page is about the practice, and the list is
 *     what a board came to check.
 *   • `brief` (/existing-buildings): two sentences on who the reader deals
 *     with while a recertification runs, and a link to the list on /about.
 * The copy of the two forms is `partner.about` and `partner.brief`
 * (site.ts); the rules written there hold for both.
 * The section keeps its id, `contractor`, in both forms — /about#contractor
 * is where `brief` links.
 */
export function PartnerSection({
  n,
  lang,
  surface = 'concrete',
  variant,
}: {
  n: string;
  lang: Lang;
  surface?: 'paper' | 'concrete';
  variant: 'about' | 'brief';
}) {
  const c = getContent(lang);
  const p = c.partner;
  const firm = c.company;
  const e = c.leadership;
  const build = p.construction;
  const short = variant === 'about' ? p.about : p.brief;
  /* One row per registration, the firm's own first and then the
     contractor's two. Each row is a single line of text — who, which
     license, which number (or, for the engineering credentials, which
     status) — so it reads as a register, not as the cards the home page
     prints (home/PartnerCard.tsx). */
  const rows: { who: string; label: string; value: React.ReactNode }[] =
    variant === 'about'
      ? [
          { who: firm.name, label: p.engineering.registryLabel, value: p.engineering.registered },
          { who: e.name, label: p.engineering.licenseLabel, value: p.engineering.licensed },
          ...build.licenses.map((lic) => ({
            who: build.name,
            label: lic.label,
            value: licenseNo(c, lic.number),
          })),
        ]
      : [];

  return (
    <section
      id="contractor"
      className={`mp-section mp-surface--${surface} mp-partner mp-partner--${variant}`}
      aria-labelledby="mp-partner-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={p.eyebrow} />

        <div className="mp-split">
          <Reveal>
            <h2 id="mp-partner-title" className="mp-split__title">
              {short.title}
            </h2>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="mp-lead mp-partner__lede">{short.body}</p>
            {rows.length ? (
              <ul className="mp-partner__register" aria-label={p.licensesLabel}>
                {rows.map((row) => (
                  <li key={`${row.who} ${row.label}`}>
                    <span className="mp-partner__register-who">{row.who}</span>{' '}
                    <span className="mp-partner__register-label">{row.label}</span>{' '}
                    <span className="mp-partner__register-no">{row.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {variant === 'brief' ? (
              <p className="mp-partner__more">
                <TextLink href={localePath(p.brief.link.href, lang)}>{p.brief.link.label}</TextLink>
              </p>
            ) : null}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
