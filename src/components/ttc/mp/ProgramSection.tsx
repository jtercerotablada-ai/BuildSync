'use client';

import React from 'react';
import { imagery, regulatoryCheckedISO } from '@/lib/ttc/site';
import { Img } from './media';
import { ButtonLink, Reveal, RevealText, SectionHeading, TextLink } from './primitives';
import { accentLines } from './text';
import { useContent, useL } from './lang';
import { ReachRow } from './ReachRow';
import { Dated, Source } from './Outbound';

/**
 * One county's program, on the home page: Miami-Dade's recertification, then
 * Broward's BSIP. The first thing under the hero, because the reader with a
 * deadline is the one holding a Notice of Required Inspection.
 *
 * THE NUMBERS ARE NOT IN THIS FILE, and not in `service.program` either. The
 * six rows are `service.timing.rows[0]` — the same row the service page
 * prints — with its authority and the one shared date beside it. So the home
 * page and the service page cannot drift apart, and a county's numbers only
 * ever appear under that county's own name. Never merge the two sections
 * into one, and never lift a number out of a row into the copy.
 *
 * Both sections are the same component on purpose: identical row labels in
 * the same order, so the two counties compare line by line. `mirrored` swaps
 * the photograph to the other side so the pair reads as one spread.
 *
 * ORDER. The markup is in reading order for a phone — headline, lede, the
 * button and what to send, the six rows, the photograph, the steps, the
 * link — so the action sits above the facts on a small
 * screen. From 901px the photograph is placed in the other column by CSS
 * (`.mp-prog__grid`) and travels with the reader while the rows scroll by.
 *
 * The button carries the SLUG, not a label: ContactForm maps it to this
 * language's dropdown option, so it survives the language switch.
 *
 * The photograph is decorative (empty alt) and is never captioned: it
 * illustrates the kind of building the program reaches, not a client's.
 */
export function ProgramSection({
  slug,
  n,
  surface,
  mirrored = false,
}: {
  /** A service that carries a `program` block: the two county pages. */
  slug: string;
  n: string;
  surface: 'paper' | 'concrete';
  /** Photograph on the left, copy on the right (desktop only). */
  mirrored?: boolean;
}) {
  const c = useContent();
  const l = useL();
  const u = c.ui;
  const service = c.services.find((s) => s.slug === slug);
  const p = service?.program;
  const timing = service?.timing;
  const row = timing?.rows[0];
  // A slug without a program, or a program without its verified row, renders
  // nothing: a section with a headline number and no source would be worse.
  if (!service || !p || !timing || !row) return null;

  const titleId = `mp-prog-${p.id}-title`;

  return (
    <section
      id={p.id}
      className={[
        'mp-section mp-section--lg mp-prog',
        surface === 'paper' ? 'mp-surface--paper' : 'mp-surface--concrete',
        mirrored ? 'mp-prog--mirrored' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={titleId}
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={p.eyebrow} />

        {/* The section is named by the real headline (no hidden duplicate). */}
        <RevealText
          as="h2"
          id={titleId}
          className="mp-prog__title"
          lines={accentLines(p.titleLines, p.accentWord)}
        />

        <div className="mp-prog__grid">
          <div className="mp-prog__main">
            <Reveal delay={0.06}>
              <p className="mp-prog__lede">{p.lede}</p>
            </Reveal>

            <Reveal delay={0.1} className="mp-prog__action">
              <ButtonLink href={l(`/contact?service=${service.slug}`)} variant="solid">
                {p.cta}
              </ButtonLink>
              <p className="mp-prog__ctanote">{p.ctaNote}</p>
              <ReachRow c={c} className="mp-reach--row" />
            </Reveal>

            {/* The same list the service page prints, without its card: the
                bare rows are restyled by `.mp-prog .mp-timing` in mp.css. */}
            <Reveal delay={0.06}>
              <dl className="mp-timing">
                {row.facts.map((f) => (
                  <div key={f.k}>
                    <dt>{f.k}</dt>
                    <dd>{f.v}</dd>
                  </div>
                ))}
              </dl>
              {/* Every number above answers to this line: the authority, and
                  the one date the whole site's regulatory rows share. The
                  authority is a link to its own text; the date is a <time>. */}
              <p className="mp-timing__src">
                {u.sourceLabel}: <Source row={row} /> ·{' '}
                <span className="mp-timing__checked">
                  <Dated label={u.lastChecked} date={timing.checked} iso={regulatoryCheckedISO} />
                </span>
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.08} className="mp-prog__media">
            <Img
              photo={imagery.services[service.slug]}
              // The photograph's DRAWN width, not the plate's. On a phone the
              // 16:10 plate is the full column and the 3:2 frame fills it by
              // width (92vw). From 901px the plate is 4:5 and `object-fit:
              // cover` fits the 3:2 frame to the plate's HEIGHT, so the image
              // is drawn 1.875x the plate's width (1.25 x 1.5): 36vw -> 68vw
              // at 1440, then the shell's fixed steps, 600 -> 1125px at 1500
              // and 680 -> 1275px at 2000. Change the plate's ratio in mp.css
              // and these three numbers change with it.
              sizes="(max-width: 900px) 92vw, (max-width: 1499px) 68vw, (max-width: 1999px) 1125px, 1275px"
            />
          </Reveal>

          <div className="mp-prog__after">
            <Reveal>
              <ol className="mp-prog__steps" aria-label={u.howItRuns}>
                {p.steps.map((step, i) => (
                  <li key={step}>
                    <span className="mp-secnum">{String(i + 1).padStart(2, '0')}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={0.08} className="mp-prog__more">
              <TextLink href={l(`/services/${service.slug}`)}>{p.detail}</TextLink>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
