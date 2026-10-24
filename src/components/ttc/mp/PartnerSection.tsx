import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { SectionHeading, Reveal, TextLink } from './primitives';

/**
 * Who the practice works with: two licensed firms side by side, each with its
 * own mark and its own Florida licences — the engineering practice on the
 * left, Precision Source on the right. Nothing here says who signs which
 * report: the owner decided the site does not state it (see `partner` in
 * site.ts), so do not add a "signed and sealed" line back.
 *
 * The two cards are deliberately the same shape. The point a client takes
 * away is "two separate licensed companies, one team", and a block that put
 * the other firm's logo in a strip under our own copy would say
 * "subcontractor" instead. No card says what its firm does on a job — the
 * owner wants a team shown, not a division of labour (see `partner` in
 * site.ts).
 *
 * Both logos are the files each company supplied (never redrawn), dark ink on
 * the white card. Every fact on the engineering card comes from `company` and
 * `leadership`.
 *
 * THE ENGINEERING LICENSES ARE NAMED, NOT NUMBERED (the owner, 2026-10-24:
 * as the large structural firms print them; Florida does not require the
 * number on a website — see `company.registry` in site.ts). The engineering
 * card says "Licensed" / "Registered" where the contractor's card says a
 * number. THE CONTRACTOR'S NUMBERS STAY (F.S. 489.119(5)(b): in every
 * advertisement, websites included), and each is a link to the state
 * registry, so a board can check it instead of taking the card's word. The
 * registry (DBPR) has no stable per-license URL — `leadership.license.url`
 * is its search page — so both numbers open the same form; /about's sentence
 * above the register says that they open the state's search (no how-to line
 * under them: the owner, 2026-10-20, no small print).
 *
 * THREE FORMS, ONE PER PAGE. The block above — headline, lede, the two
 * cards, the line about the registry — was printed whole on the home page,
 * on /about and on /existing-buildings: one text on three pages, and the
 * first thing the on-page check listed as repeated. Now:
 *   • `full`  (home): everything above, unchanged.
 *   • `about` (/about): what each company is, and the four registrations as
 *     ONE list — firm, license, number or status — with the same links. No
 *     logos and no cards: the page is about the practice, and the list is
 *     what a board came to check.
 *   • `brief` (/existing-buildings): two sentences on who the reader deals
 *     with while a recertification runs, and a link to the list on /about.
 * The copy of the two short forms is `partner.about` and `partner.brief`
 * (site.ts); the rules written there for the whole block hold for all three.
 * The section keeps its id, `contractor`, in every form — /about#contractor
 * is where `brief` links.
 */
export function PartnerSection({
  n,
  lang,
  surface = 'concrete',
  variant = 'full',
}: {
  n: string;
  lang: Lang;
  surface?: 'paper' | 'concrete';
  variant?: 'full' | 'about' | 'brief';
}) {
  const c = getContent(lang);
  const p = c.partner;
  const firm = c.company;
  const e = c.leadership;
  const build = p.construction;
  const dbprUrl = e.license?.url ?? null;
  /* The visible text is the number alone; the hidden suffix says where the
     link goes, so two links to one page are told apart in a screen
     reader's link list and each still starts with what is on screen. */
  const licenseNo = (number: string) =>
    dbprUrl ? (
      <a href={dbprUrl} rel="noopener noreferrer" target="_blank">
        {number}
        <span className="mp-sr-only"> — {c.ui.engineer.verify}</span>
      </a>
    ) : (
      number
    );

  if (variant !== 'full') {
    const short = variant === 'about' ? p.about : p.brief;
    /* One row per registration, the firm's own first and then in the order
       of the home page's cards. Each row is a single line of text — who,
       which license, which number (or, for the engineering credentials,
       which status) — so it reads as a register and is not the home page's
       card cut into pieces. */
    const rows: { who: string; label: string; value: React.ReactNode }[] =
      variant === 'about'
        ? [
            { who: firm.name, label: p.engineering.registryLabel, value: p.engineering.registered },
            { who: e.name, label: p.engineering.licenseLabel, value: p.engineering.licensed },
            ...build.licenses.map((lic) => ({
              who: build.name,
              label: lic.label,
              value: licenseNo(lic.number),
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

  return (
    <section
      id="contractor"
      className={`mp-section mp-surface--${surface} mp-partner mp-partner--full`}
      aria-labelledby="mp-partner-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={p.eyebrow} />

        <div className="mp-split">
          <Reveal>
            <p className="mp-partner__kicker">{p.kicker}</p>
            <h2 id="mp-partner-title" className="mp-split__title">
              {p.title}
            </h2>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="mp-lead mp-partner__lede">{p.lede}</p>
          </Reveal>
        </div>

        <div className="mp-partner__cards">
          <Reveal className="mp-partner__card">
            <div className="mp-partner__logo">
              {/* Each mark is named by its alt, for whoever reads the image
                  and not the page (a search engine, a saved picture). It is
                  `aria-hidden` because the same name is the card's heading
                  two lines down: a screen reader would say it twice. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={firm.logo.markDarkSm}
                alt={firm.name}
                aria-hidden="true"
                width={firm.logo.markSmSize.w}
                height={firm.logo.markSmSize.h}
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="mp-partner__role">{p.engineering.role}</p>
            <h3 className="mp-partner__name">{firm.name}</h3>
            <p className="mp-partner__who">{e.name}</p>
            <div className="mp-partner__lic">
              <p className="mp-partner__lic-label">{p.licensesLabel}</p>
              <dl>
                <div>
                  <dt>{p.engineering.licenseLabel}</dt>
                  <dd>{p.engineering.licensed}</dd>
                </div>
                <div>
                  <dt>{p.engineering.registryLabel}</dt>
                  <dd>{p.engineering.registered}</dd>
                </div>
              </dl>
            </div>
          </Reveal>

          <Reveal delay={0.06} className="mp-partner__card">
            <div className="mp-partner__logo">
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
            <h3 className="mp-partner__name">{build.name}</h3>
            <p className="mp-partner__who">{build.place}</p>
            <div className="mp-partner__lic">
              <p className="mp-partner__lic-label">{p.licensesLabel}</p>
              <dl>
                {build.licenses.map((l) => (
                  <div key={l.number}>
                    <dt>{l.label}</dt>
                    <dd>{licenseNo(l.number)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
        {/* No note under the cards (the owner, 2026-10-20: no small print).
            The contractor's numbers are still links to the registry. */}
      </div>
    </section>
  );
}
