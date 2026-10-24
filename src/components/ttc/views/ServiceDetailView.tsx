import React from 'react';
import Link from 'next/link';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { company, holdsNotice, imagery, officeLinksCheckedISO, regulatoryCheckedISO } from '@/lib/ttc/site';
import { cityPath } from '@/lib/ttc/cities';
import { cityPagesOf } from '@/lib/ttc/city-content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { serviceLd, webPageLd } from '@/lib/ttc/structured-data';
import { COST_PATH } from '@/lib/ttc/cost-path';
import { guidePath } from '@/lib/ttc/guides';
import { getGuides, guideLabels } from '@/lib/ttc/guide-content';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { EngineerCredential } from '@/components/ttc/mp/EngineerCredential';
import { JUMP_ID, JumpLinks } from '@/components/ttc/mp/JumpLinks';
import { ReachRow } from '@/components/ttc/mp/ReachRow';
import { Dated, Outbound, Source } from '@/components/ttc/mp/Outbound';
import { ScrollRegion } from '@/components/ttc/mp/ScrollRegion';
import { OpenAtHash } from '@/components/ttc/mp/OpenAtHash';
import { ButtonLink, SectionHeading, Reveal, TextLink } from '@/components/ttc/mp/primitives';
import { firstSentence, keepHyphens } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * One service, in the order a client asks the questions.
 *
 * TWO LAYOUTS OF ONE TEMPLATE (the owner, 2026-10-20: "compact and
 * professional, every page"). Compact by layout, never by cutting what a
 * reader came for: every word stays in the server HTML.
 *
 *   • The two county programs (`service.program`) are long reference pages:
 *     when you need it → what is included and what you receive, then the
 *     complete package that county asks for, part by part → when it applies
 *     → the questions boards ask → who sent your notice → how it runs →
 *     good to know. The in-page links sit at the foot of the hero up to
 *     1023px and follow the page as a bar from 1024px (JumpLinks). Each
 *     question opens on its own (several can be open), the 26 offices fold
 *     under one line, and the package and the notes fold at 1180px and
 *     narrower — open above it where the browser supports ::details-content
 *     (mp.css, "Service detail, compact").
 *   • The other six (`lean`) say the same things in fewer bands: one "At a
 *     glance" band with the brief and three columns — when you need it,
 *     what is included, what you receive — then when it applies (milestone
 *     only, with both counties and the comparison in the same band), how
 *     it runs as one row of steps, the questions a client asks about that
 *     service (where it has them), and good to know.
 *   • On every one of them, "Related services" closes the good-to-know band
 *     instead of opening a band of its own.
 *
 * No code-standard names are rendered here (`service.standards` is not read
 * at all any more): a client reads "the Florida Building Code" in the process
 * copy where it matters, never a list of ACI/ASCE numbers.
 *
 * THE ACTION IS ON THE FIRST SCREEN, AND IT IS ONE BUTTON. A visitor from a
 * search lands here, not on Home. The same button — the same label, the same
 * `/contact?service=<slug>` — is in the hero, in "Next step" and, on a
 * regulated page, beside the rows under "When it applies"; the closing band
 * keeps the preset too. On the two county programs the label is the
 * program's own (`program.cta`, "Send the Miami-Dade Notice"); every other
 * service says "Request a Proposal". NOTHING IS PRINTED UNDER THE HERO
 * BUTTON (the owner, 2026-10-20: no helper lines under buttons) — what to
 * send is said in "Next step", in its own words.
 *
 * The two county programs also say WHO: the hero's facts give way to the
 * filing deadline, read from the verified timing row (never typed here), and
 * the engineer's name and license follow — there and in "Next step".
 *
 * NO PARAGRAPH IS PRINTED TWICE on those two pages (pages.test.ts). Four
 * were, and each now has one place: the deadline's whole row is under "When
 * it applies" and the hero prints its first sentence; nothing is printed
 * under the button beside that row (the owner, 2026-10-20: no helper lines
 * under buttons), so "The proposal is free…" is the closing band's, as on
 * every other page; and Call + WhatsApp, beside each of the three buttons,
 * are a pair of links and not a paragraph (ReachRow). The engineer's credential is whole under
 * the hero — with the link that verifies it and the firm's registration —
 * and "Next step" prints the name and the license number only (`brief`).
 *
 * HEADING OUTLINE. Every section owns its h2, so a screen reader's heading
 * list (and a crawler's outline) files each h3 under the right section. The
 * sections that show only a SectionHeading label (when it applies, how it
 * runs) carry a visually hidden h2 with that same label, and the visible
 * label is hidden from assistive tech so it is not announced twice.
 *
 * A HEADING IS A SECTION OF THE PAGE, NOT A LABEL. The two county programs
 * carried 32 headings each and the on-page check flagged all four pages
 * ("too many headings"); nine of the 32 were labels set in a heading tag.
 * Those are plain elements now, each with the class that draws it, so
 * nothing looks different (mp.css gives each class the heading rule's
 * weight, tracking and leading, which the tag no longer brings):
 *   • the six step titles (`mp-step__title`) and the jurisdiction on its
 *     card (`mp-juris__title`) are <p>;
 *   • the "Next step" box label is <p class="mp-callout__label">;
 *   • "Related services" has no h2 at all: the three links are a <nav>
 *     named by that label.
 * What stays a heading: every section's h2, every QUESTION (h3 — they are
 * what people search; inside its <summary> it is still an h3 in the HTML,
 * for crawlers and most screen readers, though some — VoiceOver — read a
 * <summary> as a button and drop the heading role), "What the board
 * must do" (h3, a list the answers point at by name) and the four names
 * compared on the milestone page (h3 under their own h2). Count before
 * adding one: 23 on a program page today.
 *
 * A service may word its own headings (`service.headings` in site.ts: "Who
 * has to recertify in Miami-Dade, and when"). Such a heading is always
 * PRINTED, as the section's headline under its label — see SectionOpen. It
 * is never slipped into the hidden h2 beside a different visible label: a
 * search phrase only a crawler can read is the one thing these headings
 * must not become.
 */
export function ServiceDetailView({ lang, slug }: { lang: Lang; slug: string }) {
  const c = getContent(lang);
  const u = c.ui;
  const service = c.services.find((s) => s.slug === slug);
  if (!service) return null;
  const l = (href: string) => localePath(href, lang);
  // The service's own wording for its page; each key falls back to the
  // shared label where it is read.
  const h = service.headings ?? {};
  // Both tracks hold four services, so every page has three same-track
  // siblings and the row is three equal columns. The grid still auto-fits
  // (mp.css `.mp-more`): were a track to shrink, the links would fill the row
  // instead of leaving a blank column.
  const related = c.services.filter((s) => s.slug !== slug && s.track === service.track).slice(0, 3);
  // The cities of this program that have a page of their own (cities.ts),
  // by the name their office row carries.
  const cityPages = new Map(cityPagesOf(lang, service.slug).map((p) => [p.city, p]));
  const trackLabel = service.track === 'new' ? u.newProjects : u.existingBuildings;
  // The SLUG, not the localized label: it survives the language switch and
  // any rename of a shortTitle. ContactForm maps it to this language's
  // option. Canonical here; localised where it is rendered.
  const contactHref = `/contact?service=${service.slug}`;
  const program = service.program;
  // Every service but the two county programs: the shorter layout.
  const lean = !program;
  const cta = program?.cta ?? u.requestProposal;
  // The filing deadline of a county program: the fact its timing row flags,
  // label and value as verified. Reading it here is what keeps the first
  // screen and the "When it applies" table from ever disagreeing.
  const filing = program ? service.timing?.rows[0]?.facts.find((f) => f.filing) : undefined;
  // Whether the reader of this page holds a notice (site.ts, `holdsNotice`):
  // the two county programs and the milestone page. The assessments page is
  // an existing-building service too, but its reader has cracks or a report,
  // not a letter, so its closing band says "Message us on WhatsApp".
  const notice = holdsNotice(service);
  // Each regulated service now carries ONE jurisdiction: Miami-Dade and
  // Broward have a page each, and the milestone page has the State's row. A
  // single card in the old auto-fit grid stretched across the whole shell,
  // with 250-character values running in one line. So one row is laid out
  // beside its own notes (`.mp-juris--single`); several rows keep the grid,
  // with the notes underneath.
  const singleRow = service.timing?.rows.length === 1;
  // The milestone page: both counties' links sit beside the State's row, and
  // the comparison follows in the same band. It used to be a band of its own
  // ("In Miami-Dade & Broward"), 1,200px tall on a desktop, whose first
  // words repeated the note beside the row.
  const mergedCounties = lean && singleRow && Boolean(service.countyPages?.length);
  // Surfaces alternate down the page. Where a lean page has a timing band
  // (milestone), that band is concrete, so the steps go back to paper and
  // good-to-know to concrete; everywhere else the steps are concrete and
  // good-to-know is paper — unless a lean page's questions (paper) come
  // between them, and then good-to-know is concrete (`notesOnConcrete`).
  const stepsOnPaper = lean && Boolean(service.timing);
  // "Last verified: …", the one date every regulatory row shares. With one
  // row it closes the line that names the row's authority, under the rows
  // themselves; alone in the notes it was the same seven-word paragraph on
  // all three regulated pages. Several rows share it, so there it stays a
  // line of its own, after them.
  const verified = service.timing ? (
    <Dated label={u.lastChecked} date={service.timing.checked} iso={regulatoryCheckedISO} />
  ) : null;
  const timingNotes = service.timing ? (
    <>
      <p className="mp-timing__note">{service.timing.note}</p>
      {/* The board's duties to unit owners, as a list a board can act on.
          An h3 under the section's h2: the answers below point at this list
          by its name, so it is a part of the page a reader looks for. */}
      {service.timing.duties?.length ? (
        <>
          <h3 className="mp-duties__title">{u.boardDuties}</h3>
          <ul className="mp-duties">
            {service.timing.duties.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </>
      ) : null}
      {singleRow ? null : <p className="mp-timing__src">{verified}</p>}
    </>
  ) : null;
  // The other county's page. The two programs never share a page or a
  // number, so each one ends by pointing at the other — the last line of
  // the block, under the button.
  const crossLinkEl = service.crossLink ? (
    <p className="mp-timing__cross">
      <span>{service.crossLink.text}</span>
      <TextLink href={l(`/services/${service.crossLink.slug}`)}>{service.crossLink.label}</TextLink>
    </p>
  ) : null;
  // The deadline has just been read, so the button is here again — beside
  // the rows, at the foot of the notes, where the eye already is (it hung
  // under the card in the left column, 800px of empty right column beside
  // it). Call and WhatsApp beside it on a county program; no line of small
  // print under it (the owner, 2026-10-20: no helper lines under buttons).
  const timingAction = (
    <div className="mp-prog__action">
      <ButtonLink href={l(contactHref)} variant="solid">
        {cta}
      </ButtonLink>
      {program ? <ReachRow c={c} className="mp-reach--row" /> : null}
    </div>
  );
  // The county programs: what the work costs, on its own page
  // (cost-page.ts), in words of its own, not the home page's.
  const costLink = program ? (
    <p className="mp-costp__late">
      {/* One <span> around the words: the link is an inline flex row, and
          the pieces keepHyphens returns were each a flex item of it, spaced
          by its gap ("size:  Miami-Dade  recertification"). */}
      <TextLink href={localePath(COST_PATH, lang)}>
        <span>
          {keepHyphens(
            c.pricing.pageLink.replace('{name}', c.pricing.programs.find((p) => p.slug === service.slug)?.name ?? service.title),
          )}
        </span>
      </TextLink>
    </p>
  ) : null;
  // How the state inspection is met in each county (milestone). Each heading
  // IS the link to that county's page — this used to be a plain-text note
  // saying the deadline "is on that county's page", with nothing to tap.
  const countiesEl = mergedCounties ? (
    <div className="mp-juris__counties">
      {service.countyPages!.map((cp) => (
        <div key={cp.slug}>
          <h2 className="mp-h3 mp-headlink__title">
            <Link className="mp-headlink" href={l(`/services/${cp.slug}`)}>
              {cp.title} <i aria-hidden="true">→</i>
            </Link>
          </h2>
          <p className="mp-headlink__text">{cp.text}</p>
        </div>
      ))}
    </div>
  ) : null;
  // The four names a board hears, under the same four labels: cards of plain
  // text, no ages and no deadlines. Same card and the same dl as the
  // jurisdiction above, so the four read line by line under identical
  // labels; on a phone they are one row that swipes (mp.css). The row is a
  // named, focusable region only while it does scroll (ScrollRegion): on a
  // phone the arrow keys move it; from 721px it is a table that fits, with
  // nothing for the keys to do and no reason to be a Tab stop.
  const comparisonEl = service.comparison ? (
    <div className="mp-compare__wrap">
      <Reveal>
        <h2 id="mp-compare-title" className="mp-h3 mp-compare__title">
          {service.comparison.title}
        </h2>
      </Reveal>
      <ScrollRegion className="mp-juris mp-compare" labelledBy="mp-compare-title">
        {service.comparison.rows.map((row) => (
          <Reveal as="div" key={row.name} className="mp-juris__card">
            <h3 className="mp-juris__title">{row.name}</h3>
            <dl className="mp-timing">
              {service.comparison?.labels.map((label, i) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{row.values[i]}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ))}
      </ScrollRegion>
      <p className="mp-timing__src">
        {u.sourceLabel}: {service.comparison.source}
        {service.timing ? (
          <>
            {' · '}
            <span className="mp-timing__checked">
              <Dated label={u.lastChecked} date={service.timing.checked} iso={regulatoryCheckedISO} />
            </span>
          </>
        ) : null}
      </p>
    </div>
  ) : null;

  // "Next step": what to send, the button, and on a county program who
  // reads it. A label over the sentence, not a section of the page: a <p>
  // with the look the h3 had (mp.css, .mp-callout__label).
  const nextBox = (
    <div className="mp-callout mp-callout--spaced mp-callout--next">
      <p className="mp-callout__label">{u.nextStep}</p>
      <p>{service.nextStep}</p>
      <div className="mp-cta-row">
        <ButtonLink href={l(contactHref)} variant="solid">
          {cta}
        </ButtonLink>
      </div>
      {/* Who answers: the name and the license number; how to verify them
          is in the hero's copy of this block, and the same two lines twice
          were a repeated paragraph. */}
      {program ? <EngineerCredential lang={lang} brief /> : null}
    </div>
  );
  const whenList = (
    <ul className="mp-pillars mp-pillars--plain">
      {service.when.map((w, i) => (
        <li key={w}>
          <b>{String(i + 1).padStart(2, '0')}</b>
          <span>{w}</span>
        </li>
      ))}
    </ul>
  );
  const scopeList = (
    <ol className="mp-speclist">
      {service.scope.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  );
  const receiveList = (
    <ol className="mp-speclist">
      {service.deliverables.map((d) => (
        <li key={d}>{d}</li>
      ))}
    </ol>
  );
  // Three links to the sibling services: navigation, not a section of this
  // page's content, so it has no heading. The <nav> takes the label as its
  // name; the printed label is hidden from assistive tech so it is not
  // announced twice. No catalogue number on the links: "05" under a band
  // numbered "05" was two numbering systems at once.
  const relatedEl = (
    <div className="mp-related">
      <p className="mp-related__label" aria-hidden="true">
        {u.relatedServices}
      </p>
      <nav className="mp-more" aria-label={u.relatedServices}>
        {related.map((r) => (
          <Link key={r.slug} href={l(`/services/${r.slug}`)}>
            <span className="mp-more__t">{r.title}</span>
            <span className="mp-more__go">
              {u.explore} <i aria-hidden="true">→</i>
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
  // A count in a toggle's label is the length of the list it opens, never
  // typed (`{n}` in site.ts).
  const counted = (label: string, n: number) => label.replace('{n}', String(n));

  // The Service node and, on the regulated pages, the WebPage node that
  // carries the date the rows were last checked: both built in
  // structured-data.ts, next to the site-wide graph they point into.
  const pageUrl = `${company.url}${l(`/services/${service.slug}`)}`;
  const pageLd = webPageLd(lang, service);
  // The questions, as markup — built from the SAME array the page prints, so
  // the two cannot drift apart. No rich result is expected from it; it only
  // says, in a form a machine reads, what is already on the page below.
  const faqLd = service.faq?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        url: pageUrl,
        inLanguage: lang === 'es' ? 'es-US' : 'en-US',
        mainEntity: service.faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      }
    : null;
  // Two columns of questions, in page order down the first and then the
  // second (one column from 1180px down, which reads 1 → 12).
  const faqCols = service.faq?.length
    ? [service.faq.slice(0, Math.ceil(service.faq.length / 2)), service.faq.slice(Math.ceil(service.faq.length / 2))]
    : [];

  let n = 0;
  const next = () => String(++n).padStart(2, '0');

  // The questions (`service.faq`). Each question is an h3 in the <summary>
  // of its own <details>: closed questions, each opening on its own, where
  // twelve open answers were a 4,000px wall on a phone. Nothing that needs
  // JavaScript; every answer is in the server HTML. A function, not a
  // value: it numbers its section when it is placed (`next()` counts in
  // page order). A hyphenated name stays whole on its line (`keepHyphens`):
  // balanced on a phone, "Miami-Dade?" broke at its hyphen.
  const faqSection = (surface: string) =>
    service.faq?.length ? (
      <section id={JUMP_ID.questions} className={`mp-section ${surface}`}>
        <div className="mp-shell">
          <SectionOpen n={next()} label={u.faqLabel} title={h.faq ?? u.faqTitle} />
          <div className="mp-faq mp-faq--acc">
            {faqCols.map((col, ci) => (
              <div key={ci} className="mp-faq__col">
                {col.map((item) => (
                  <Reveal as="div" key={item.q} className="mp-faq__item">
                    <details className="mp-faq__d">
                      <summary className="mp-faq__sum">
                        <h3 className="mp-faq__q">{keepHyphens(item.q)}</h3>
                        <span className="mp-faq__icon" aria-hidden="true" />
                      </summary>
                      <p className="mp-faq__a">{item.a}</p>
                    </details>
                  </Reveal>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    ) : null;
  // A lean page with questions prints them after the steps, on paper, and
  // its good-to-know band turns concrete so the surfaces still alternate.
  const leanFaq = lean && Boolean(service.faq?.length);
  const notesOnConcrete = stepsOnPaper || leanFaq;

  return (
    <>
      <JsonLd data={serviceLd(lang, service)} />
      {pageLd ? <JsonLd data={pageLd} /> : null}
      {faqLd ? <JsonLd data={faqLd} /> : null}
      <JsonLd
        data={breadcrumbLd(lang, [
          { name: u.home, path: '/' },
          { name: navLabelOf(c, '/services'), path: '/services' },
          { name: service.title, path: `/services/${service.slug}` },
        ])}
      />

      <PageHero
        eyebrow={trackLabel}
        crumbs={[
          { href: '/', label: u.home },
          { href: '/services', label: navLabelOf(c, '/services') },
          { label: service.shortTitle },
        ]}
        // `title` is the service's name (cards, nav, schema); a page that
        // needs its H1 or its first line to say more sets its own.
        titleLines={[h.h1 ?? service.title]}
        sub={service.heroSub ?? service.summary}
        actions={[{ href: contactHref, label: cta }]}
        // Client terms only: where the firm does this work. The old
        // "Service 01" index meant nothing to a client, "Basis" put a code
        // list in the first screen, and "Applies to: New construction" said
        // again what the eyebrow right above it says.
        // A county program prints its filing deadline instead: the answer a
        // notice-holder came for. The label and the FIRST SENTENCE of the
        // row — the deadline itself, still read from the row. The whole
        // value was printed here until it was found to be one paragraph
        // twice on the page; what qualifies the deadline is in the row under
        // "When it applies". site.ts keeps each value opening with a
        // sentence that is true by itself.
        facts={
          filing
            ? [{ k: filing.k, v: firstSentence(filing.v) }]
            : [{ k: u.coverage, v: service.coverage ?? c.contact.serviceAreaLabel }]
        }
        photo={imagery.services[service.slug]}
      >
        {program ? <EngineerCredential lang={lang} /> : null}
        {program ? <ReachRow c={c} /> : null}
      </PageHero>

      {/* Every section of the page's argument, in one wrapper: the in-page
          bar sticks inside it and lets go before the closing band. */}
      <div className={lean ? 'mp-svcd mp-svcd--lean' : 'mp-svcd'}>
        {program ? <JumpLinks c={c} service={service} /> : null}

        {lean ? (
          /* At a glance: why it matters, then when you need it, what is
             included and what you receive, side by side — one band where
             there were two, each with a half-empty column. The h2 is the
             short `problemTitle`; the `problem` paragraph opens the RIGHT
             column (`.mp-split__title` is sticky, and a paragraph in the
             same wrapper would let the title slide over it). */
          <section className="mp-section mp-surface--paper">
            <div className="mp-shell">
              <SectionHeading n={next()} label={u.atAGlance} />
              <div className="mp-split">
                <Reveal>
                  <h2 className="mp-split__title">{service.problemTitle}</h2>
                </Reveal>
                <Reveal delay={0.05}>
                  <p className="mp-split__lede">{service.problem}</p>
                  <p className="mp-svcd__aud">{service.audience.join(' · ')}</p>
                </Reveal>
              </div>
              <div className="mp-cols3">
                <Reveal>
                  <h2 className="mp-h3 mp-cols3__title">{u.whenYouNeedIt}</h2>
                  {whenList}
                </Reveal>
                <Reveal delay={0.05}>
                  <h2 className="mp-h3 mp-cols3__title">{h.whatsIncluded ?? u.whatsIncluded}</h2>
                  {scopeList}
                </Reveal>
                <Reveal delay={0.1}>
                  <h2 id={JUMP_ID.receive} className="mp-h3 mp-cols3__title">
                    {u.whatYouReceive}
                  </h2>
                  {receiveList}
                  {nextBox}
                </Reveal>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Why it matters + when you need it. */}
            <section className="mp-section mp-surface--paper">
              <div className="mp-shell">
                <SectionHeading n={next()} label={u.whenYouNeedIt} />
                <div className="mp-split">
                  <Reveal>
                    <h2 className="mp-split__title">{service.problemTitle}</h2>
                  </Reveal>
                  <Reveal delay={0.05}>
                    <p className="mp-split__lede">{service.problem}</p>
                    {whenList}
                    <p className="mp-svcd__aud">{service.audience.join(' · ')}</p>
                  </Reveal>
                </div>
              </div>
            </section>

            {/* What's included + what you receive. The label names the pair;
                the two column titles are the h2s, so the label never repeats
                one. The two titles stand OUTSIDE the reveal: "What you
                receive" is a target of the in-page bar, and a heading still
                parked 14px low by its reveal was measured there by the
                smooth scroll, which then landed it 2px under the bar once it
                rose. The lists under them still rise. */}
            <section className="mp-section mp-surface--concrete">
              <div className="mp-shell">
                <SectionHeading n={next()} label={u.scopeAndDeliverables} />
                <div className="mp-cols2">
                  <div>
                    <h2 className="mp-h3 mp-cols2__title">{h.whatsIncluded ?? u.whatsIncluded}</h2>
                    <Reveal>{scopeList}</Reveal>
                  </div>
                  <div>
                    <h2 id={JUMP_ID.receive} className="mp-h3 mp-cols2__title">
                      {u.whatYouReceive}
                    </h2>
                    <Reveal delay={0.05}>
                      {receiveList}
                      {nextBox}
                    </Reveal>
                  </div>
                </div>
                {/* The complete package, part by part (`service.packet`).
                    Under the two columns, so it follows "What you receive":
                    the first line of that list names the package and this
                    block lays it out, one row per part — its name, what it
                    is and when it applies. A definition list, and its label
                    a <p> drawn by its class: a part of a packet is not a
                    section of the page, and the page is at its ceiling of
                    headings (pages.test.ts). The rows are open above 1180px
                    and fold under one line at 1180px and narrower, where they
                    ran 1,270px on a phone (`mp-disclose--desk`); every row is
                    in the HTML either way. Each county's rows are its own; see the rules over
                    `packet` in site.ts before adding one.

                    The city pages link here (`#the-package`, "The package,
                    part by part"). The id is on a plain wrapper, not on the
                    block that rises: a target still parked low by its
                    reveal is measured low by the scroll. OpenAtHash opens
                    the folded rows for a visitor who arrives that way. */}
                {service.packet ? (
                  <div id={JUMP_ID.package}>
                    <OpenAtHash id={JUMP_ID.package} />
                    <Reveal as="div" delay={0.05} className="mp-packet">
                      <p className="mp-packet__label">{service.packet.label}</p>
                      <p className="mp-packet__lede">{service.packet.lede}</p>
                      <details className="mp-disclose mp-disclose--desk">
                        <summary>{counted(service.packet.toggle, service.packet.parts.length)}</summary>
                        <dl className="mp-packet__list">
                          {service.packet.parts.map((part) => (
                            <div key={part.k}>
                              <dt>{part.k}</dt>
                              <dd>{part.v}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                      <p className="mp-packet__note">{service.packet.note}</p>
                    </Reveal>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}

        {/* When it applies — regulated services only. The notes, the button
            and the links stand in the column beside the card. */}
        {service.timing ? (
          <section
            id={JUMP_ID.applies}
            className={`mp-section ${lean ? 'mp-surface--concrete' : 'mp-surface--paper'}`}
          >
            <div className="mp-shell">
              <SectionOpen n={next()} label={u.whenItApplies} title={h.whenItApplies} />
              <div className={singleRow ? 'mp-juris mp-juris--single' : 'mp-juris'}>
                {service.timing.rows.map((row) => (
                  <Reveal as="div" key={row.jurisdiction} className="mp-juris__card">
                    {/* Whose rows these are: a label on the card, under the
                        section's h2 — a <p>, drawn by its class. */}
                    <p className="mp-juris__title">{row.jurisdiction}</p>
                    <dl className="mp-timing">
                      {row.facts.map((f) => (
                        <div key={f.k}>
                          <dt>{f.k}</dt>
                          <dd>{f.v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mp-timing__src">
                      <Source row={row} />
                      {singleRow ? (
                        <>
                          {' · '}
                          <span className="mp-timing__checked">{verified}</span>
                        </>
                      ) : null}
                    </p>
                  </Reveal>
                ))}
                {singleRow ? (
                  <Reveal delay={0.06} className="mp-juris__aside">
                    {countiesEl}
                    {timingNotes}
                    {timingAction}
                    {costLink}
                    {crossLinkEl}
                  </Reveal>
                ) : null}
              </div>
              {singleRow ? null : (
                <>
                  <Reveal delay={0.06}>
                    {timingNotes}
                    {crossLinkEl}
                  </Reveal>
                  <Reveal delay={0.08}>{timingAction}</Reveal>
                  {costLink}
                </>
              )}
              {mergedCounties ? comparisonEl : null}
              {/* The owners' guides that lead to this program (guides.ts): by
                  name, as navigation — no heading, the page is at its
                  ceiling. Three to a row on a desktop. Its label is drawn
                  like "Related services", the page's other list of links,
                  and hidden from assistive tech for the same reason: the
                  <nav> is named by it already. */}
              {program ? (
                <nav className="mp-guide__more mp-guide__more--svc" aria-label={guideLabels(lang).forProgram}>
                  <p className="mp-related__label" aria-hidden="true">
                    {guideLabels(lang).forProgram}
                  </p>
                  <ul>
                    {getGuides(lang)
                      .filter((g) => (g.programs as string[]).includes(service.slug))
                      .map((g) => (
                        <li key={g.slug}>
                          <Link href={localePath(guidePath(g.slug), lang)}>{g.name}</Link>
                        </li>
                      ))}
                  </ul>
                </nav>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* A page with county links and no single timing row would still
            get its own band (no service has one today). */}
        {!mergedCounties && (service.countyPages?.length || service.comparison) ? (
          <section className="mp-section mp-surface--paper">
            <div className="mp-shell">
              <SectionHeading n={next()} label={u.inBothCounties} />
              {service.countyPages?.length ? (
                <div className="mp-cols2">
                  {service.countyPages.map((cp, i) => (
                    <Reveal key={cp.slug} delay={i * 0.05}>
                      <h2 className="mp-h3 mp-headlink__title">
                        <Link className="mp-headlink" href={l(`/services/${cp.slug}`)}>
                          {cp.title} <i aria-hidden="true">→</i>
                        </Link>
                      </h2>
                      <p className="mp-headlink__text">{cp.text}</p>
                    </Reveal>
                  ))}
                </div>
              ) : null}
              {comparisonEl}
            </div>
          </section>
        ) : null}

        {/* Questions boards ask — the two county programs. Above the steps: a
            board member skims for their own question before reading how the
            work runs. The answers point at the timing table by row label,
            so this section comes right under it, on the same surface. (A
            lean page prints its questions after the steps instead.) */}
        {lean ? null : faqSection('mp-surface--paper')}

        {/* Who sent your notice? — the two county programs. The letter has a
            city's name on it. One row per city: its name, and the building
            office as that city's own page calls it, folded under one line
            (26 rows were 2,200px on a phone). A ROW NEVER LINKS OUT. Each
            one used to be a link to the city's page; city websites answer
            crawlers with a 403 or not at all, the on-page check counted
            thirteen of them as broken, and the rows stopped being outside
            links (site.ts, `Service.offices` — do not link a city's website
            again). Where the city has a page of its own on THIS site
            (cities.ts), its name links there. Then the one link of the
            block — the page the county-level authority publishes its forms
            on — and the day the names were last read: a date of its own,
            not the rules' "Last verified". */}
        {service.offices ? (
          <section id={JUMP_ID.offices} className="mp-section mp-surface--paper">
            <div className="mp-shell">
              <SectionHeading n={next()} label={u.yourCity} />
              <div className="mp-intro mp-intro--row">
                <Reveal>
                  <h2 className="mp-intro__title">{service.offices.title}</h2>
                </Reveal>
                <Reveal delay={0.05}>
                  <p className="mp-intro__lede">{service.offices.lede}</p>
                </Reveal>
              </div>
              <details className="mp-disclose mp-offices__all">
                <summary>{counted(service.offices.toggle, service.offices.rows.length)}</summary>
                <ul className="mp-offices">
                  {service.offices.rows.map((row) => (
                    // The space between the two cells draws nothing in the
                    // row's grid; it keeps the page's plain text from running
                    // "Hialeah" into "City of Hialeah…".
                    <li key={row.city} className="mp-offices__row">
                      <span className="mp-offices__city">
                        {cityPages.has(row.city) ? (
                          <Link href={l(cityPath(cityPages.get(row.city)!))}>{row.city}</Link>
                        ) : (
                          row.city
                        )}
                      </span>{' '}
                      <span className="mp-offices__office">{row.office}</span>
                    </li>
                  ))}
                </ul>
              </details>
              <div className="mp-offices__foot">
                <p>{service.offices.note}</p>
                {/* The note ends "Send us the letter": the way to do it,
                    right there. */}
                {service.program ? (
                  <p>
                    <TextLink href={l(contactHref)}>{service.program.cta}</TextLink>
                  </p>
                ) : null}
                <p>
                  {service.offices.forms.text}{' '}
                  <Outbound href={service.offices.forms.url}>{service.offices.forms.label}</Outbound>
                </p>
                <p className="mp-timing__src">
                  <Dated label={u.linksChecked} date={service.offices.checked} iso={officeLinksCheckedISO} />
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* How it runs. The ruled grid of /existing-buildings (mp.css,
            `.mp-timeline--grid`): the step's number and name on one line,
            its sentence under them. A county program's six steps are a
            3 × 2 grid. On the lean pages four steps are one row from
            1101px, five are 3 + 2 from 1101px and one row from 1181px
            (`--mp-steps`); in one row the titles share a row track, so
            every sentence starts on the same line. Two columns from 641px,
            one on a phone. */}
        <section
          id={JUMP_ID.steps}
          className={`mp-section ${stepsOnPaper ? 'mp-surface--paper' : 'mp-surface--concrete'}`}
        >
          <div className="mp-shell">
            <SectionOpen n={next()} label={u.howItRuns} title={h.howItRuns} />
            <div
              className={lean ? 'mp-timeline mp-timeline--grid mp-timeline--row' : 'mp-timeline mp-timeline--grid'}
              style={lean ? ({ '--mp-steps': service.process.length } as React.CSSProperties) : undefined}
            >
              {service.process.map((p, i) => (
                <Reveal as="div" key={p.step} delay={i * 0.04} className="mp-step is-in">
                  <div className="mp-step__node">
                    <span className="mp-step__dot" aria-hidden="true" />
                    <span className="mp-step__n">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  {/* The step's name: a label beside its number, not a
                      section — six of them were six headings. A <p>, drawn
                      by its class. */}
                  <p className="mp-step__title">{p.step}</p>
                  <p className="mp-step__detail">{p.detail}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* A lean page's questions: after the steps, before the caveats —
            what it is, how it runs, then what clients ask about it. */}
        {lean ? faqSection('mp-surface--paper') : null}

        {/* Good to know. The label stays "Good to know"; the h2 says what the
            list actually is, instead of repeating the label at display size.
            The two county programs word their own, across the shell, with
            the notes in two columns above 1180px and folded under one line
            at 1180px and narrower; the others keep the split. Related
            services close the band. */}
        <section className={`mp-section ${notesOnConcrete ? 'mp-surface--concrete' : 'mp-surface--paper'}`}>
          <div className="mp-shell">
            {program ? (
              <>
                <SectionOpen n={next()} label={u.considerations} title={h.considerations ?? u.considerationsTitle} />
                <details className="mp-disclose mp-disclose--desk">
                  <summary>{counted(service.notesToggle ?? '{n}', service.considerations.length)}</summary>
                  <ul className="mp-notes">
                    {service.considerations.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (
              <>
                <SectionHeading n={next()} label={u.considerations} />
                <div className="mp-split">
                  <Reveal>
                    <h2 className="mp-split__title">{h.considerations ?? u.considerationsTitle}</h2>
                  </Reveal>
                  <Reveal delay={0.05} className="mp-prose">
                    <ul>
                      {service.considerations.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </Reveal>
                </div>
              </>
            )}
            {relatedEl}
          </div>
        </section>
      </div>

      <ContactCTA service={service.slug} notice={notice} />
    </>
  );
}

/**
 * How a section opens: its label, and its h2.
 *
 * With a `title` (the service's own heading, or the questions block's), the
 * label is followed by that headline — printed, at the size of every other
 * section headline on the site. Without one, the label is all there is to
 * see: the h2 repeats it for assistive tech and for the outline, and the
 * visible copy is hidden from them so it is not read twice.
 */
function SectionOpen({ n, label, title }: { n: string; label: string; title?: string }) {
  if (title) {
    return (
      <>
        <SectionHeading n={n} label={label} />
        <div className="mp-intro">
          <Reveal>
            <h2 className="mp-intro__title">{title}</h2>
          </Reveal>
        </div>
      </>
    );
  }
  return (
    <>
      <div aria-hidden="true">
        <SectionHeading n={n} label={label} />
      </div>
      <h2 className="mp-sr-only">{label}</h2>
    </>
  );
}
