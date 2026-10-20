'use client';

import React from 'react';
import { imagery, regulatoryCheckedISO } from '@/lib/ttc/site';
import { Img } from './media';
import { ButtonLink, Reveal, SectionHeading, TextLink } from './primitives';
import { accentLines, afterFirstSentence, firstSentence } from './text';
import { useContent, useL } from './lang';
import { ReachRow } from './ReachRow';
import { Dated, Source } from './Outbound';
import { JUMP_ID } from './JumpLinks';

/** The two county programs, in the order the home page prints them. */
const SLUGS = ['building-recertification', 'broward-bsip'] as const;

/**
 * The two county programs on the home page, side by side: Miami-Dade's
 * recertification on the left, Broward's BSIP on the right. The first thing
 * under the hero, because the reader with a deadline is the one holding a
 * Notice of Required Inspection — and an owner who does not yet know which
 * county's rules apply reads the two across, row by row.
 *
 * ONE COLUMN PER COUNTY, EACH ITS OWN <section>. A column keeps its id
 * (`#miami-dade`, `#broward`: the hero's buttons and strip land there), its
 * own heading and only its own county's numbers, under its own name. Never
 * merge the two columns' rows into one table: a county's numbers only ever
 * appear under that county.
 *
 * THE NUMBERS ARE NOT IN THIS FILE, and not in `service.program` either. The
 * rows are read from `service.timing.rows[0]` — the row the service page
 * prints — with its authority and the one shared date beside them. So the
 * home page and the service page cannot drift apart. Never lift a number out
 * of a row into the copy.
 *
 * THE HOME PAGE IS THE SUMMARY; THE PROGRAM'S PAGE IS THE REFERENCE. A column
 * prints
 *   · only the facts the row flags `home` (site.ts), each as its label and its
 *     FIRST SENTENCE (`firstSentence`) in one list item — cut from the row in
 *     code, never retyped (`homeWhole` prints a value whole);
 *   · one link to the table itself, on the program's page
 *     (`#when-it-applies`), where every row is whole, with its exemptions and
 *     its hedges;
 *   · under the button, the second half of `ctaNote` — what to send when
 *     there is no notice yet. The program's page prints `ctaNote` whole.
 *
 * ROWS LINE UP ACROSS THE COLUMNS. From 1024px the two columns are subgrids
 * of one grid: photograph, county, headline, lede, action, each fact, source
 * and links each share a row with the same piece of the other county, so
 * "Time to file" sits level with "Time to file" however long either value
 * runs. Both rows carry the same labels in the same order (site.ts), which is
 * what makes the comparison honest. Under 1024px a column is a plain stack,
 * Miami-Dade first.
 *
 * WHAT THE TWO SHARE IS PRINTED ONCE, under both columns: the four steps
 * (both programs run the same four — `programs.test.ts` holds them equal)
 * and the call / WhatsApp pair.
 *
 * The button carries the SLUG, not a label: ContactForm maps it to this
 * language's dropdown option, so it survives the language switch.
 *
 * The photographs are decorative (hidden from screen readers; the alt only
 * says what is in the frame, and names no city, county or building) and
 * never captioned: they illustrate the kind of building a program reaches,
 * not a client's.
 */
export function ProgramsSection({ n }: { n: string }) {
  const c = useContent();
  const programs = SLUGS.map((slug) => c.services.find((s) => s.slug === slug)).filter(
    (s): s is NonNullable<typeof s> => Boolean(s?.program && s.timing?.rows[0]),
  );
  const ids = programs.map((s) => s.program!.id);
  const [shown, setShown] = React.useState(ids[0]);
  const [ready, setReady] = React.useState(false);

  /* A link to #broward (the hero strip, another page) must land on Broward
     even on a phone, where only one column shows: the address picks the
     column, then the page goes to it. */
  React.useEffect(() => {
    setReady(true);
    const follow = () => {
      const id = window.location.hash.slice(1);
      if (!ids.includes(id)) return;
      setShown(id);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
    // `ids` is the same two strings on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A program without its verified row renders nothing: a headline number
  // with no source would be worse than no column.
  if (!programs.length) return null;
  // Every column spans the same number of rows, so the facts line up even if
  // one county ever flags a row the other does not.
  const factRows = Math.max(...programs.map((s) => s.timing!.rows[0].facts.filter((f) => f.home).length));
  const steps = programs[0].program!.steps;

  return (
    <div className="mp-section mp-surface--paper mp-progs" data-ready={ready ? '' : undefined}>
      <div className="mp-shell">
        <SectionHeading n={n} label={c.ui.existingBuildings} />
        {/* Under 1024px one county at a time: a reader holding a notice
            knows which county sent it, and two full columns stacked were
            3,600px of phone. The switch only appears once the page is live
            (`data-ready`); before that, and without script, both columns
            show, one after the other. Both are always in the page. */}
        {programs.length > 1 ? (
          <div className="mp-progs__switch" role="group" aria-labelledby="mp-progs-switch">
            <p id="mp-progs-switch" className="mp-progs__ask">
              {c.ui.chooseCounty}
            </p>
            <div className="mp-progs__seg">
              {programs.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  aria-pressed={shown === s.program!.id}
                  aria-controls={s.program!.id}
                  onClick={() => setShown(s.program!.id)}
                >
                  {s.program!.county}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {/* Seven rows of its own (photograph, county, headline, lede,
            action, source, links) plus one per fact. */}
        <Reveal className="mp-progs__grid">
          {programs.map((s) => (
            <ProgramColumn key={s.slug} slug={s.slug} rows={7 + factRows} off={s.program!.id !== shown} />
          ))}
        </Reveal>
        <Reveal className="mp-progs__shared">
          <p id="mp-progs-steps" className="mp-progs__label">
            {c.ui.howItRuns}
          </p>
          <ol className="mp-prog__steps" aria-labelledby="mp-progs-steps">
            {steps.map((step, i) => (
              <li key={step}>
                <span className="mp-secnum">{String(i + 1).padStart(2, '0')}</span>
                {step}
              </li>
            ))}
          </ol>
          <ReachRow c={c} className="mp-reach--row" />
        </Reveal>
      </div>
    </div>
  );
}

function ProgramColumn({ slug, rows, off }: { slug: string; rows: number; off: boolean }) {
  const c = useContent();
  const l = useL();
  const u = c.ui;
  const service = c.services.find((s) => s.slug === slug)!;
  const p = service.program!;
  const timing = service.timing!;
  const row = timing.rows[0];
  const titleId = `mp-prog-${p.id}-title`;
  const facts = row.facts.filter((f) => f.home);
  const noNotice = afterFirstSentence(p.ctaNote);

  return (
    <section
      id={p.id}
      className="mp-prog"
      aria-labelledby={titleId}
      // Not the county the phone switch shows (hidden under 1024px only).
      data-off={off ? '' : undefined}
      // How many rows of the shared grid the column and its list span
      // (`.mp-prog` and `.mp-prog__facts` from 1024px, in mp.css).
      style={{ ['--mp-prog-rows' as string]: rows, ['--mp-prog-facts' as string]: facts.length }}
    >
      <div className="mp-prog__media">
        <Img
          photo={imagery.services[service.slug]}
          // The plate is the column's full width: 92vw on a phone, about
          // 44vw beside the other column from 1024px (half the shell less
          // the gap), capped by the shell's fixed widths above 1500px.
          sizes="(max-width: 1023px) 92vw, (max-width: 1499px) 44vw, (max-width: 1999px) 640px, 860px"
        />
      </div>

      <p className="mp-prog__county">{p.eyebrow}</p>

      {/* The column is named by its real headline (no hidden duplicate). */}
      <h2 id={titleId} className="mp-prog__title">
        {accentLines(p.titleLines, p.accentWord).map((line, i) => (
          <span key={i} className="mp-prog__line">
            {line}{' '}
          </span>
        ))}
      </h2>

      <p className="mp-prog__lede">{p.lede}</p>

      <div className="mp-prog__action">
        <ButtonLink href={l(`/contact?service=${service.slug}`)} variant="solid">
          {p.cta}
        </ButtonLink>
        {noNotice ? <p className="mp-prog__ctanote">{`${u.photoTheLetter} ${noNotice}`}</p> : null}
      </div>

      {/* A list, not the service page's dl: label and sentence are ONE item,
          so no line here is a paragraph of the program's page. The colon is
          for whoever reads the item as text (a screen reader, a crawler); on
          screen the label has its own column (`.mp-prog__facts`). From
          1024px every item is a row of the shared grid (subgrid). */}
      <ul className="mp-prog__facts">
        {facts.map((f) => (
          <li key={f.k}>
            <span className="mp-prog__k">
              {f.k}
              <span className="mp-sr-only">:</span>
            </span>{' '}
            <span className="mp-prog__v">{f.homeWhole ? f.v : firstSentence(f.v)}</span>
          </li>
        ))}
      </ul>

      {/* Every number above answers to this line: the authority, and the one
          date the whole site's regulatory rows share. */}
      <p className="mp-timing__src">
        {u.sourceLabel}: <Source row={row} /> ·{' '}
        <span className="mp-timing__checked">
          <Dated label={u.lastChecked} date={timing.checked} iso={regulatoryCheckedISO} />
        </span>
      </p>

      {/* Every row whole — exemptions, hedges, the board's duties — is one
          tap away, on the program's own page; then the page itself. */}
      <div className="mp-prog__links">
        <TextLink href={l(`/services/${service.slug}#${JUMP_ID.applies}`)}>{p.timingLink}</TextLink>
        <TextLink href={l(`/services/${service.slug}`)}>{p.detail}</TextLink>
      </div>
    </section>
  );
}
