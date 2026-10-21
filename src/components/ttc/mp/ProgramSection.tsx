'use client';

import React from 'react';
import { flushSync } from 'react-dom';
import { imagery, regulatoryCheckedISO } from '@/lib/ttc/site';
import { Img } from './media';
import { ButtonLink, Reveal, SectionHeading, TextLink } from './primitives';
import { accentLines, firstSentence, keepHyphens } from './text';
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
 * (`#miami-dade`, `#broward`: the hero's strip and other pages land there),
 * its own heading and only its own county's numbers, under its own name.
 * Never merge the two columns' rows into one table: a county's numbers only
 * ever appear under that county.
 *
 * THE NUMBERS ARE NOT IN THIS FILE, and not in `service.program` either. The
 * rows are read from `service.timing.rows[0]` — the row the service page
 * prints — with its authority and the one shared date beside them. So the
 * home page and the service page cannot drift apart. Never lift a number out
 * of a row into the copy.
 *
 * THE HOME PAGE IS THE SUMMARY; THE PROGRAM'S PAGE IS THE REFERENCE. A column
 * prints
 *   · the row's `scope` fact (which buildings the program reaches) and the
 *     facts it flags `home`, each as its label and its FIRST SENTENCE
 *     (`firstSentence`) in one list item — cut from the row in code, never
 *     retyped (`homeWhole` prints a value whole). The city pages print the
 *     `home` facts only: they are the deadlines;
 *   · one link to the table itself, on the program's page
 *     (`#when-it-applies`), where every row is whole, with its exemptions and
 *     its hedges;
 *   · the button alone, with no small print under it (the owner,
 *     2026-10-20: the line under the button confused clients). What to send
 *     is the form's job, and the program's page says it under "Next step".
 *
 * ROWS LINE UP ACROSS THE COLUMNS. From 1024px the two columns are subgrids
 * of one grid: photograph, county, headline, lede, action, each fact, source
 * and links each share a row with the same piece of the other county, so
 * "Time to file" sits level with "Time to file" however long either value
 * runs. Both rows carry the same labels in the same order (site.ts), which is
 * what makes the comparison honest.
 *
 * UNDER 1024px, ONE COUNTY AT A TIME. Two full columns stacked were 3,600px
 * of phone, and a reader holding a notice knows which county sent it. A
 * two-option switch (a radio group) picks the column; both columns stay in
 * the page. The phone layout is right from the first frame: the root
 * layout's first script sets `html.js` (and `data-county` for an address
 * ending in #broward) before anything paints, and mp.css shows the switch
 * and hides the other column from that. Without script, both columns show,
 * one after the other, and the switch stays hidden; so does a printed page.
 *
 * A LINK TO A COLUMN MUST LAND ON IT. Every in-page link is caught by
 * SmoothScroll (smooth-scroll.tsx), which measures the target, scrolls and
 * writes the address with `replaceState` — no `hashchange`. A hidden column
 * measures nothing. So a capture-phase click listener runs first and shows
 * the column the link points at, synchronously (`flushSync`), and
 * SmoothScroll then measures a column that is there. Back and forward still
 * come through `hashchange`.
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
  const seg = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // On load the browser has already scrolled to #broward (the first-frame
    // CSS shows it); the column only has to be chosen. One commit: the
    // column and `data-ready` change together, so nothing moves.
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      return ids.includes(id) ? id : null;
    };
    const first = fromHash();
    if (first) setShown(first);
    setReady(true);

    const onHashChange = () => {
      const id = fromHash();
      if (!id) return;
      flushSync(() => setShown(id));
      document.getElementById(id)?.scrollIntoView();
    };
    // Capture phase, so it runs before SmoothScroll's bubbling listener; the
    // same guards as SmoothScroll's, so a click that opens a new tab does not
    // switch the county here.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const id = a?.getAttribute('href')?.slice(1);
      if (id && ids.includes(id)) flushSync(() => setShown(id));
    };
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      document.removeEventListener('click', onClick, true);
    };
    // `ids` is the same two strings on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A program without its verified row renders nothing: a headline number
  // with no source would be worse than no column.
  if (!programs.length) return null;
  // Every column spans the same number of rows, so the facts line up even if
  // one county ever prints a row the other does not.
  const factRows = Math.max(...programs.map((s) => homeFacts(s.timing!.rows[0].facts).length));
  const steps = programs[0].program!.steps;

  /* The radio group's keys: arrows move the choice (and the focus) and wrap,
     Home and End go to the ends. Space and Enter are the buttons' own. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = ids.indexOf(shown);
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (i + 1) % ids.length
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (i - 1 + ids.length) % ids.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? ids.length - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    setShown(ids[next]);
    seg.current?.querySelectorAll('button')[next]?.focus();
  };

  return (
    <div className="mp-section mp-surface--paper mp-progs" data-ready={ready ? '' : undefined}>
      <div className="mp-shell">
        <SectionHeading n={n} label={c.ui.existingBuildings} />
        {programs.length > 1 ? (
          <div className="mp-progs__switch">
            <p id="mp-progs-switch" className="mp-progs__ask">
              {c.ui.chooseCounty}
            </p>
            <div
              ref={seg}
              className="mp-progs__seg"
              role="radiogroup"
              aria-labelledby="mp-progs-switch"
              onKeyDown={onKeyDown}
            >
              {programs.map((s) => {
                const id = s.program!.id;
                const on = shown === id;
                return (
                  <button
                    key={s.slug}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-controls={id}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setShown(id)}
                  >
                    {s.program!.county}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {/* Seven rows of its own (photograph, county, headline, lede,
            action, source, links) plus one per fact. No rise on the reveal
            (`y={0}`): the two columns are link targets, and a column still
            parked 14px low when a link measures it lands 14px off. */}
        <Reveal y={0} className="mp-progs__grid">
          {programs.map((s) => (
            <ProgramColumn
              key={s.slug}
              slug={s.slug}
              rows={7 + factRows}
              off={s.program!.id !== shown}
              onReader={setShown}
            />
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

type Fact = { k: string; v: string; home?: boolean; homeWhole?: boolean; scope?: boolean };

/** What a column prints: the scope fact, then the facts flagged `home`. */
function homeFacts<F extends Fact>(facts: readonly F[]): F[] {
  return facts.filter((f) => f.scope || f.home);
}

function ProgramColumn({
  slug,
  rows,
  off,
  onReader,
}: {
  slug: string;
  rows: number;
  /** Not the county the phone switch shows (hidden under 1024px only). */
  off: boolean;
  /** The reader is in this column. */
  onReader: (id: string) => void;
}) {
  const c = useContent();
  const l = useL();
  const u = c.ui;
  const service = c.services.find((s) => s.slug === slug)!;
  const p = service.program!;
  const timing = service.timing!;
  const row = timing.rows[0];
  const titleId = `mp-prog-${p.id}-title`;
  const facts = homeFacts(row.facts);
  /* Whichever column the reader is in — focus, a touch, the pointer over it
     — becomes the switch's choice, so zooming a desktop window or turning a
     tablet across 1024px keeps that column on screen instead of hiding it
     (and the focus inside it). Under 1024px only the shown column can be
     reached, so this changes nothing there. */
  const here = () => onReader(p.id);

  return (
    <section
      id={p.id}
      className="mp-prog"
      aria-labelledby={titleId}
      data-off={off ? '' : undefined}
      onFocusCapture={here}
      onPointerDown={here}
      onPointerOver={here}
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
          {keepHyphens(p.cta)}
        </ButtonLink>
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
