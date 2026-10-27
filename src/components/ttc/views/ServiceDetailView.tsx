import React from 'react';
import Link from 'next/link';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { company, holdsNotice, imagery, officeLinksCheckedISO, regulatoryCheckedISO } from '@/lib/ttc/site';
import { cityPath } from '@/lib/ttc/cities';
import { cityPagesOf } from '@/lib/ttc/city-content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { serviceLd, webPageLd } from '@/lib/ttc/structured-data';
import { guidePath } from '@/lib/ttc/guides';
import { getGuides, guideLabels } from '@/lib/ttc/guide-content';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ServiceBuildings } from '@/components/ttc/mp/plates/ServiceBuildings';
import { ServiceClock } from '@/components/ttc/mp/plates/ServiceClock';
import { ServiceFee } from '@/components/ttc/mp/plates/ServiceFee';
import { ServiceFlow } from '@/components/ttc/mp/plates/ServiceFlow';
import { ServiceGlance } from '@/components/ttc/mp/plates/ServiceGlance';
import { ServiceIncludes } from '@/components/ttc/mp/plates/ServiceIncludes';
import { HomeContact } from '@/components/ttc/mp/home/HomeContact';
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
 * ONE ORDER FOR EVERY SERVICE (the owner, 2026-10-27: "minimalista,
 * aesthetic, clean, claro, entendible para todo tipo de clientes, vendedor…
 * veo mucho texto pero sin explicación"). Compact by layout, never by
 * cutting what a reader came for: every word stays in the server HTML.
 *
 *   hero → in plain words (ServiceGlance: the question an owner types —
 *   "What is building recertification?" — three tiles that answer it, and
 *   the long brief folded) → the program's numbers (ServiceClock, the four
 *   regulated services; on Miami-Dade's, where to look the first one up) →
 *   the buildings it reaches → what's included (ServiceIncludes: a card per
 *   part of the work, with a photograph on the two county programs; the
 *   scope line by line, folded) → what you receive (+ the package, part by
 *   part, folded) → how it runs (on the two county programs, who does what
 *   at each step — ServiceFlow — with the steps folded under it) → the fee
 *   (ServiceFee, the two county programs) → when it applies (the rows; the
 *   board's duties folded) → the questions → who sent your notice (folded)
 *   → good to know (folded) → related services. The order of the
 *   competitor's page the owner called "bien claro" (2026-10-27): what it
 *   is, what it includes, what follows, who does what.
 *
 *   • The two county programs (`service.program`) carry the in-page links,
 *     at the foot of the hero up to 1023px and as a bar from 1024px
 *     (JumpLinks), in that same order.
 *   • The other four (`lean`) leave out what they do not have: the fee, the
 *     offices, and where a service has none, the rows and the questions.
 *     Their steps are one row (`--row`).
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
 * list (and a crawler's outline) files each h3 under the right section. A
 * section that shows only a SectionHeading label — What you receive on every
 * page; What's included, How it runs and When it applies wherever the service
 * does not word its own (`service.headings`) — carries a visually hidden h2
 * with that same label (SectionOpen without a title), and the visible label
 * is hidden from assistive tech so it is not announced twice.
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
 * <summary> as a button and drop the heading role) and the four names
 * compared on the milestone page (h3 under their own h2). "What the board
 * must do" was an h3 until 2026-10-27; it is the line of the fold that holds
 * the duties now. Count before adding one: 23 on a program page today —
 * the ceiling (MOST in pages.test.ts), so a new heading there must replace
 * one (the hidden h2 of What you receive took the last place, 2026-10-27);
 * 16 on milestone, 13 on the other three.
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
  // Three same-track siblings; the design-review track holds peer review
  // alone (2026-10-26: threshold inspections are an existing-building
  // service), so that page offers the first three of the other track rather
  // than an empty row. The grid auto-fits (mp.css `.mp-more`).
  const sameTrack = c.services.filter((s) => s.slug !== slug && s.track === service.track);
  const related = (sameTrack.length ? sameTrack : c.services.filter((s) => s.slug !== slug)).slice(0, 3);
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
  // Surfaces alternate down the page, after the plates: each band that is
  // rendered takes the next one, in page order, so two bands of one surface
  // never meet whatever a service leaves out.
  let band = 0;
  const surface = () => (band++ % 2 ? 'mp-surface--paper' : 'mp-surface--concrete');
  const look = c.serviceLook;
  // Who does what, step by step: the two county programs (site.ts,
  // `serviceFlow`). Where a service has it — one row per step — its steps
  // fold under it; if the rows ever stop matching the steps, the steps stand
  // open instead of an empty band.
  const flowData = c.serviceFlow[service.slug];
  const flow = Boolean(flowData) && flowData.rows.length === service.process.length;
  // The steps, sentence by sentence. Each rises with the page where the
  // steps are the band itself; inside a fold they are plain (a closed fold
  // gives a reveal no box to watch).
  const stepsGrid = (rise: boolean) => (
    <div
      className={lean ? 'mp-timeline mp-timeline--grid mp-timeline--row' : 'mp-timeline mp-timeline--grid'}
      style={lean ? ({ '--mp-steps': service.process.length } as React.CSSProperties) : undefined}
    >
      {service.process.map((p, i) => {
        const inner = (
          <>
            <div className="mp-step__node">
              <span className="mp-step__dot" aria-hidden="true" />
              <span className="mp-step__n">{String(i + 1).padStart(2, '0')}</span>
            </div>
            {/* The step's name: a label beside its number, not a section —
                six of them were six headings. A <p>, drawn by its class. */}
            <p className="mp-step__title">{p.step}</p>
            <p className="mp-step__detail">{p.detail}</p>
          </>
        );
        return rise ? (
          <Reveal as="div" key={p.step} delay={i * 0.04} className="mp-step is-in">
            {inner}
          </Reveal>
        ) : (
          <div key={p.step} className="mp-step is-in">
            {inner}
          </div>
        );
      })}
    </div>
  );
  // "Last verified: …", the one date every regulatory row shares. With one
  // row it closes the line that names the row's authority, under the rows
  // themselves; alone in the notes it was the same seven-word paragraph on
  // all three regulated pages. Several rows share it, so there it stays a
  // line of its own, after them.
  const verified = service.timing ? (
    <Dated label={u.lastChecked} date={service.timing.checked} iso={regulatoryCheckedISO} />
  ) : null;
  // The note under the rows and, on the two county programs, the board's
  // duties to unit owners. The duties fold under one line (2026-10-27, the
  // owner: "mucho texto"), the note with them as their lead-in. The line is
  // the list's own name, "What the board must do" — the name the answers
  // below point at ("see … above"); it was the list's h3, and a summary
  // carries it now, so the name is not printed twice once the fold opens. A
  // page with a note and no duties (milestone: one sentence) prints the
  // note as it is. Several rows share one date, printed after them, never
  // inside the fold.
  const timingNote = service.timing ? <p className="mp-timing__note">{service.timing.note}</p> : null;
  const timingFold = service.timing ? (
    <>
      {service.timing.duties?.length ? (
        <details className="h-fold mp-timing__fold">
          <summary className="h-fold__sum">
            {u.boardDuties}
            <span className="h-fold__plus" aria-hidden="true" />
          </summary>
          <div className="mp-timing__more">
            {timingNote}
            <ul className="mp-duties">
              {service.timing.duties.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </details>
      ) : (
        timingNote
      )}
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
  // What the work costs is the fee band's (ServiceFee), with the link to the
  // prices by building size.
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
      {/* No engineer's name here or in the hero since 2026-10-26 (the owner:
          "no pongas mi nombre, somos empresa"): the firm answers. */}
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
  const faqSection = (surfaceClass: string) =>
    service.faq?.length ? (
      <section id={JUMP_ID.questions} className={`mp-section ${surfaceClass}`}>
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

  return (
    <div className="mp-plates mp-dark">
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
        {program ? <ReachRow c={c} /> : null}
      </PageHero>

      {/* Every section of the page's argument, in one wrapper: the in-page
          bar sticks inside it and lets go before the closing band.

          ONE ORDER FOR EVERY SERVICE (2026-10-27, the owner: "minimalista…
          claro, entendible para todo tipo de clientes, vendedor… veo mucho
          texto pero sin explicación"): what it is in three lines, the
          numbers, the buildings, how it runs, what you get, what it costs —
          and only then the rules, the questions and the notes, each long
          text folded under one line. */}
      <div className={lean ? 'mp-svcd mp-svcd--lean' : 'mp-svcd'}>
        {program ? <JumpLinks c={c} service={service} /> : null}

        {/* In plain words: the question an owner types (2026-10-27, after a
            competitor's "What is building recertification?" the owner called
            "bien claro"), three tiles that answer it, and the texts the page
            used to open with, folded. */}
        <ServiceGlance
          lang={lang}
          slug={service.slug}
          title={look.question[service.slug] ?? service.problemTitle}
          more={
            <>
              <p className="mp-split__lede">{service.problem}</p>
              <div>
                {whenList}
                <p className="mp-svcd__aud">{service.audience.join(' · ')}</p>
              </div>
            </>
          }
        />

        {/* The program's numbers, large (the four regulated services), with
            where to look the first one up; then the buildings it reaches
            (2026-10-26, the owner: "edificios construidos… en todos"). */}
        <ServiceClock lang={lang} slug={service.slug} />
        <ServiceBuildings lang={lang} slug={service.slug} />

        {/* What's included: one card per part of the work (ServiceIncludes —
            with a photograph on the two county programs), then the scope
            line by line, folded. The label names the band; the service's own
            heading, where it has one, is the h2 (SectionOpen). */}
        <section className={`mp-section ${surface()}`}>
          <div className="mp-shell">
            <SectionOpen n={next()} label={u.whatsIncluded} title={h.whatsIncluded} />
            <ServiceIncludes lang={lang} slug={service.slug} />
            <details className="h-fold mp-svcd__scope">
              <summary className="h-fold__sum">
                {look.scopeMore}
                <span className="h-fold__plus" aria-hidden="true" />
              </summary>
              {scopeList}
            </details>
          </div>
        </section>

        {/* What you receive: the documents, and beside them the next step;
            then, on a county program, the package part by part. The id is
            on the section, a target of the in-page bar; its h2 is the
            label's own words, read by assistive tech (SectionOpen). */}
        <section id={JUMP_ID.receive} className={`mp-section ${surface()}`}>
          <div className="mp-shell">
            <SectionOpen n={next()} label={u.whatYouReceive} />
            <div className="mp-cols2 mp-svcd__receive">
              <Reveal>{receiveList}</Reveal>
              <Reveal delay={0.05}>{nextBox}</Reveal>
            </div>
            {/* The complete package, part by part (`service.packet`).
                Under "What you receive": the first line of that list names
                the package and this block lays it out, one row per part —
                its name, what it is and when it applies. A definition list,
                and its label a <p> drawn by its class: a part of a packet is
                not a section of the page, and the page is at its ceiling of
                headings (pages.test.ts). The rows fold under one line at
                every width since 2026-10-27; every row is in the HTML either
                way. Each county's rows are its own; see the rules over
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
                  <details className="mp-disclose">
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

        {/* How it runs. On a county program, first who does what at each
            step (ServiceFlow, 2026-10-27), and the steps sentence by
            sentence folded under it; on the other four, the steps
            themselves. The ruled grid of /existing-buildings (mp.css,
            `.mp-timeline--grid`): the step's number and name, its sentence
            under them. A county program's six steps are a 3 × 2 grid. On the
            lean pages four steps are one row from 1101px, five are 3 + 2
            from 1101px and one row from 1181px (`--mp-steps`); in one row the
            titles share a row track, so every sentence starts on the same
            line. Two columns from 641px, one on a phone. */}
        <section id={JUMP_ID.steps} className={`mp-section ${surface()}`}>
          <div className="mp-shell">
            <SectionOpen n={next()} label={u.howItRuns} title={h.howItRuns} />
            {flow ? (
              <>
                <Reveal>
                  <ServiceFlow lang={lang} slug={service.slug} steps={service.process.map((p) => p.step)} />
                </Reveal>
                <details className="h-fold mp-svcd__steps">
                  <summary className="h-fold__sum">
                    {look.flowMore}
                    <span className="h-fold__plus" aria-hidden="true" />
                  </summary>
                  {stepsGrid(false)}
                </details>
              </>
            ) : (
              stepsGrid(true)
            )}
          </div>
        </section>

        {/* The fee — the two county programs (ServiceFee). */}
        {program ? <ServiceFee lang={lang} slug={service.slug} href={contactHref} cta={cta} surface={surface()} /> : null}

        {/* When it applies — regulated services only. The notes, the button
            and the links stand in the column beside the card. */}
        {service.timing ? (
          <section id={JUMP_ID.applies} className={`mp-section ${surface()}`}>
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
                    {timingAction}
                    {timingFold}
                    {crossLinkEl}
                  </Reveal>
                ) : null}
              </div>
              {singleRow ? null : (
                <>
                  <Reveal delay={0.06}>{timingAction}</Reveal>
                  <Reveal delay={0.08}>
                    {timingFold}
                    {crossLinkEl}
                  </Reveal>
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
          <section className={`mp-section ${surface()}`}>
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

        {/* The questions, each closed under its own line. On a county program
            the answers point at the timing table by row label, so they come
            right under it. */}
        {service.faq?.length ? faqSection(surface()) : null}

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
          <section id={JUMP_ID.offices} className={`mp-section ${surface()}`}>
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

        {/* Good to know. The label stays "Good to know"; the h2 says what the
            list actually is. The notes fold under one line that counts them,
            at every width and on every service (2026-10-27: they were open
            on a desktop, the longest wall of text on the page). Related
            services close the band. */}
        <section className={`mp-section ${surface()}`}>
          <div className="mp-shell">
            <SectionOpen n={next()} label={u.considerations} title={h.considerations ?? u.considerationsTitle} />
            <details className="mp-disclose">
              <summary>{counted(service.notesToggle ?? look.notesAll, service.considerations.length)}</summary>
              <ul className="mp-notes">
                {service.considerations.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </details>
            {relatedEl}
          </div>
        </section>
      </div>

      <HomeContact closing lang={lang} presetService={service.slug} notice={notice} />
    </div>
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
