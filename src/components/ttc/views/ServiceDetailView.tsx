import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { company, imagery, officeLinksCheckedISO, regulatoryCheckedISO } from '@/lib/ttc/site';
import { cityPath } from '@/lib/ttc/cities';
import { cityPagesOf } from '@/lib/ttc/city-content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { serviceLd, webPageLd } from '@/lib/ttc/structured-data';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { EngineerCredential } from '@/components/ttc/mp/EngineerCredential';
import { JUMP_ID, JumpLinks } from '@/components/ttc/mp/JumpLinks';
import { ReachRow } from '@/components/ttc/mp/ReachRow';
import { Dated, Outbound, Source } from '@/components/ttc/mp/Outbound';
import { SoftwareBand } from '@/components/ttc/mp/SoftwareBand';
import { ButtonLink, SectionHeading, Reveal, TextLink } from '@/components/ttc/mp/primitives';
import { firstSentence } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * One service, in the order a client asks the questions: when you need it →
 * what is included and what you receive (on the two county programs, then
 * the complete package that county asks for, part by part) → when it applies
 * (regulated services) → the questions boards ask, then who sent the notice
 * (the two county programs) → how it runs → good to know → next step.
 *
 * No code-standard names are rendered here (`service.standards` is not read
 * at all any more): a client reads "the Florida Building Code" in the process
 * copy where it matters, never a list of ACI/ASCE numbers.
 *
 * THE ACTION IS ON THE FIRST SCREEN, AND IT IS ONE BUTTON. A visitor from a
 * search lands here, not on Home; on a phone the first link to the form used
 * to sit three and a half screens down. The same button — the same label,
 * the same `/contact?service=<slug>` — is in the hero, in "Next step" and
 * under "When it applies", and the closing band keeps the preset too. On the
 * two county programs the label is the program's own (`program.cta`, "Send
 * the Miami-Dade Notice") with its line about what to send; every other
 * service says "Request a Proposal".
 *
 * The two county programs also say WHO: the hero's facts give way to the
 * filing deadline, read from the verified timing row (never typed here), and
 * the engineer's name and license follow — there and in "Next step".
 *
 * NO PARAGRAPH IS PRINTED TWICE on those two pages (pages.test.ts). Four
 * were, and each now has one place: the deadline's whole row is under "When
 * it applies" and the hero prints its first sentence; "The proposal is
 * free…" is beside the button under that row and not in the closing band;
 * and Call + WhatsApp, beside each of the three buttons, are a pair of links
 * and not a paragraph (ReachRow). The engineer's credential is whole under
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
 * what people search), "What the board must do" (h3, a list the answers
 * point at by name) and the four names compared on the milestone page (h3
 * under their own h2). Count before adding one: 23 on a program page today.
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
  const isBim = service.slug === 'bim-coordination';
  const trackLabel = service.track === 'new' ? u.newProjects : u.existingBuildings;
  // The SLUG, not the localized label: it survives the language switch and
  // any rename of a shortTitle. ContactForm maps it to this language's
  // option. Canonical here; localised where it is rendered.
  const contactHref = `/contact?service=${service.slug}`;
  const program = service.program;
  const cta = program?.cta ?? u.requestProposal;
  // The filing deadline of a county program: the fact its timing row flags,
  // label and value as verified. Reading it here is what keeps the first
  // screen and the "When it applies" table from ever disagreeing.
  const filing = program ? service.timing?.rows[0]?.facts.find((f) => f.filing) : undefined;
  // Where "The proposal is free…" is printed: beside the button under the
  // timing rows, on a county program. The closing band leaves it out there.
  const assuredUnderRows = Boolean(program && service.timing);
  // Each regulated service now carries ONE jurisdiction: Miami-Dade and
  // Broward have a page each, and the milestone page has the State's row. A
  // single card in the old auto-fit grid stretched across the whole shell,
  // with 250-character values running in one line. So one row is laid out
  // beside its own notes (`.mp-juris--single`); several rows keep the grid,
  // with the notes underneath.
  const singleRow = service.timing?.rows.length === 1;
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
      {/* The other county's page. The two programs never share a page or a
          number, so each one ends by pointing at the other. */}
      {service.crossLink ? (
        <p className="mp-timing__cross">
          <span>{service.crossLink.text}</span>
          <TextLink href={l(`/services/${service.crossLink.slug}`)}>
            {service.crossLink.label}
          </TextLink>
        </p>
      ) : null}
    </>
  ) : null;

  // The Service node and, on the regulated pages, the WebPage node that
  // carries the date the rows were last checked: both built in
  // structured-data.ts, next to the site-wide graph they point into.
  const pageUrl = `${company.url}${l(`/services/${service.slug}`)}`;
  const pageLd = webPageLd(lang, service);
  // The questions, as markup — built from the SAME array the page prints, so
  // the two cannot drift apart. No rich result is expected from it; it only
  // says, in a form a machine reads, what is already visible below.
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

  let n = 0;
  const next = () => String(++n).padStart(2, '0');

  return (
    <>
      <JsonLd data={serviceLd(lang, service)} />
      {pageLd ? <JsonLd data={pageLd} /> : null}
      {faqLd ? <JsonLd data={faqLd} /> : null}
      <JsonLd
        data={breadcrumbLd(lang, [
          { name: u.home, path: '/' },
          { name: c.primaryNav[0].label, path: '/services' },
          { name: service.title, path: `/services/${service.slug}` },
        ])}
      />

      <PageHero
        eyebrow={trackLabel}
        crumbs={[
          { href: '/', label: u.home },
          { href: '/services', label: c.primaryNav[0].label },
          { label: service.shortTitle },
        ]}
        // `title` is the service's name (cards, nav, schema); a page that
        // needs its H1 or its first line to say more sets its own.
        titleLines={[h.h1 ?? service.title]}
        sub={service.heroSub ?? service.summary}
        actions={[{ href: contactHref, label: cta }]}
        actionNote={program?.ctaNote}
        // Client terms only: what kind of building, and where. The old
        // "Service 01" index meant nothing to a client, and "Basis" put a
        // code list in the first screen.
        // A county program prints its filing deadline instead: there the two
        // facts only repeated the title above them ("Existing buildings",
        // the county), while the answer a notice-holder came for was four
        // screens down. The label and the FIRST SENTENCE of the row — the
        // deadline itself, still read from the row. The whole value was
        // printed here until it was found to be one paragraph twice on the
        // page; what qualifies the deadline is in the row under "When it
        // applies", which is the first of the links under this hero on a
        // phone. site.ts keeps each value opening with a sentence that is
        // true by itself.
        facts={
          filing
            ? [{ k: filing.k, v: firstSentence(filing.v) }]
            : [
                { k: u.appliesTo, v: service.track === 'new' ? u.newConstruction : u.existingBuildings },
                { k: u.coverage, v: service.coverage ?? c.contact.serviceAreaLabel },
              ]
        }
        photo={imagery.services[service.slug]}
      >
        {program ? <EngineerCredential lang={lang} /> : null}
        {program ? <ReachRow c={c} /> : null}
      </PageHero>
      {program ? <JumpLinks c={c} service={service} /> : null}

      {/* Why it matters + when you need it.
          The h2 is the short `problemTitle`; the `problem` paragraph is its
          lede and opens the RIGHT column. It must not sit under the h2 in
          the left Reveal: `.mp-split__title` is sticky, and a paragraph in
          the same wrapper would let the title slide over it while the
          reader scrolls. */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.whenYouNeedIt} />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">{service.problemTitle}</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mp-split__lede">{service.problem}</p>
              <ul className="mp-pillars mp-pillars--plain">
                {service.when.map((w, i) => (
                  <li key={w}>
                    <b>{String(i + 1).padStart(2, '0')}</b>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
              <p className="mp-note" style={{ marginTop: 'var(--mp-6)' }}>
                {service.audience.join(' · ')}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* What's included + what you receive. The label names the pair; the
          two column titles are the h2s, so the label never repeats one. */}
      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.scopeAndDeliverables} />
          <div className="mp-cols2">
            <Reveal>
              <h2 className="mp-h3 mp-cols2__title">{h.whatsIncluded ?? u.whatsIncluded}</h2>
              <ol className="mp-speclist">
                {service.scope.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 id={JUMP_ID.receive} className="mp-h3 mp-cols2__title">{u.whatYouReceive}</h2>
              <ol className="mp-speclist">
                {service.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ol>
              <div className="mp-callout mp-callout--spaced mp-callout--next">
                {/* A label over the sentence, not a section of the page: a <p>
                    with the look the h3 had (mp.css, .mp-callout__label). */}
                <p className="mp-callout__label">{u.nextStep}</p>
                <p>{service.nextStep}</p>
                <div className="mp-cta-row" style={{ marginTop: 'var(--mp-4)' }}>
                  <ButtonLink href={l(contactHref)} variant="solid">
                    {cta}
                  </ButtonLink>
                </div>
                {/* Who answers: the box used to say what to send and nothing
                    about who reads it. The name and the license number; how
                    to verify them is in the hero's copy of this block, and
                    the same two lines twice were a repeated paragraph. */}
                {program ? <EngineerCredential lang={lang} brief /> : null}
              </div>
            </Reveal>
          </div>
          {/* The complete package, part by part — the two county programs
              (`service.packet`). Under the two columns, so it follows "What
              you receive": the first line of that list names the package
              and this block lays it out, one row per part — its name, what
              it is and when it applies. A definition list, and its label a
              <p> drawn by its class: a part of a packet is not a section
              of the page, and the page is at its ceiling of headings
              (pages.test.ts). Each county's rows are its own; see the rules
              over `packet` in site.ts before adding one. */}
          {service.packet ? (
            <Reveal as="div" delay={0.05} className="mp-packet">
              <p className="mp-packet__label">{service.packet.label}</p>
              <p className="mp-packet__lede">{service.packet.lede}</p>
              <dl className="mp-packet__list">
                {service.packet.parts.map((part) => (
                  <div key={part.k}>
                    <dt>{part.k}</dt>
                    <dd>{part.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mp-packet__note">{service.packet.note}</p>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* When it applies — regulated services only */}
      {service.timing ? (
        <section id={JUMP_ID.applies} className="mp-section mp-surface--paper">
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
                  {timingNotes}
                </Reveal>
              ) : null}
            </div>
            {singleRow ? null : <Reveal delay={0.06}>{timingNotes}</Reveal>}
            {/* The deadline has just been read, so the button is here again —
                the same row as the home page's program sections (mp.css 07),
                without their line about what to send: on this page the hero
                prints that line under this same button, and "Next step",
                one section up, says it again in its own words. Printed here
                too, it was the same paragraph twice on one page. What IS
                said here and not above: the proposal is free, and how soon
                a reply usually comes. */}
            <Reveal delay={0.08} className="mp-prog__action">
              <ButtonLink href={l(contactHref)} variant="solid">
                {cta}
              </ButtonLink>
              {assuredUnderRows ? <ReachRow c={c} assure className="mp-reach--row" /> : null}
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* The milestone page: how the state inspection is met in each county.
          Each heading IS the link to that county's page — this used to be a
          plain-text note saying the deadline "is on that county's page",
          with nothing to tap. Then the four names a board hears, under the
          same four labels: cards of plain text, no ages and no deadlines.
          Paper after the paper section above, so mp.css joins the two with
          a hairline instead of a second band of padding. */}
      {service.countyPages?.length || service.comparison ? (
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
            {service.comparison ? (
              <>
                <Reveal>
                  <h2 className="mp-h3 mp-compare__title">{service.comparison.title}</h2>
                </Reveal>
                {/* Same card and the same dl as the jurisdiction above, so the
                    four read line by line under identical labels. */}
                <div className="mp-juris mp-compare">
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
                </div>
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
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Questions boards ask — the two county programs. Above the steps: a
          board member skims for their own question before reading how the
          work runs. Each question is an h3 and each answer is plain text in
          the HTML (nothing to open, nothing that needs JavaScript). The
          answers point at the timing table by row label, so this section
          comes right under it, on the same surface. It no longer closes
          with the row's authority and the shared date: both are printed
          once, with the table the answers point at (the authority under the
          rows, the date beside them), and the second copy was the same
          line twice on one page. */}
      {service.faq?.length ? (
        <section id={JUMP_ID.questions} className="mp-section mp-surface--paper">
          <div className="mp-shell">
            <SectionOpen n={next()} label={u.faqLabel} title={h.faq ?? u.faqTitle} />
            <div className="mp-faq">
              {service.faq.map((item) => (
                <Reveal as="div" key={item.q} className="mp-faq__item">
                  <h3 className="mp-faq__q">{item.q}</h3>
                  <p className="mp-faq__a">{item.a}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Who sent your notice? — the two county programs. The letter has a
          city's name on it, and these pages named none. One row per city:
          its name, and the building office as that city's own page calls
          it. A ROW NEVER LINKS OUT. Each one used to be a link to the
          city's page; city websites answer crawlers with a 403 or not at
          all, the on-page check counted thirteen of them as broken, and
          the rows stopped being outside links (site.ts, `Service.offices`
          — do not link a city's website again). Where the city has a page
          of its own on THIS site (cities.ts), its name links there: how
          that office runs the program, read on the city's website.
          Right under the questions, whose last word on filing is "the
          office that sent the notice". Then the one link of the block —
          the page the county-level authority publishes its forms on — and
          the day the names were last read: a date of its own, not the
          rules' "Last verified". */}
      {service.offices ? (
        <section className="mp-section mp-surface--paper">
          <div className="mp-shell">
            <SectionHeading n={next()} label={u.yourCity} />
            <div className="mp-intro">
              <Reveal>
                <h2 className="mp-intro__title">{service.offices.title}</h2>
              </Reveal>
              <Reveal delay={0.05}>
                <p className="mp-intro__lede">{service.offices.lede}</p>
              </Reveal>
            </div>
            <ul className="mp-offices">
              {service.offices.rows.map((row) => (
                // The space between the two cells draws nothing in the row's
                // grid; it keeps the page's plain text from running
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
            <div className="mp-offices__foot">
              <p>{service.offices.note}</p>
              {/* The note ends "Send us the letter": the way to do it, right
                  there. The list above stopped being links, so without this
                  the section had nothing to act on. */}
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

      {/* How it runs */}
      <section id={JUMP_ID.steps} className={`mp-section ${service.timing ? 'mp-surface--concrete' : 'mp-surface--paper'}`}>
        <div className="mp-shell">
          <SectionOpen n={next()} label={u.howItRuns} title={h.howItRuns} />
          <div className="mp-timeline">
            <div className="mp-timeline__track" aria-hidden="true" />
            {service.process.map((p, i) => (
              <Reveal as="div" key={p.step} delay={i * 0.04} className="mp-step is-in">
                <div className="mp-step__node">
                  <span className="mp-step__dot" aria-hidden="true" />
                  <span className="mp-step__n">{String(i + 1).padStart(2, '0')}</span>
                </div>
                {/* The step's name: a label beside its number, not a section
                    — six of them were six headings. A <p>, drawn by its
                    class. */}
                <p className="mp-step__title">{p.step}</p>
                <p className="mp-step__detail">{p.detail}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Good to know. The label stays "Good to know"; the h2 says what the
          list actually is, instead of repeating the label at display size.
          The two county programs word their own: their questions took the
          caveats a board asks about, and what is left is a shorter list. */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
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
        </div>
      </section>

      {isBim ? <SoftwareBand n={next()} variant="full" /> : null}

      {/* Related. Three links to the sibling services: navigation, not a
          section of this page's content, so it has no heading. The <nav>
          takes the label as its name; the printed label is hidden from
          assistive tech, as it was beside the hidden h2, so it is not
          announced twice. */}
      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <div aria-hidden="true">
            <SectionHeading n={next()} label={u.relatedServices} />
          </div>
          <nav className="mp-more" aria-label={u.relatedServices}>
            {related.map((r) => (
              <Link key={r.slug} href={l(`/services/${r.slug}`)}>
                <span className="mp-secnum">{r.n}</span>
                <span className="mp-more__t">{r.title}</span>
                <span className="mp-more__go">
                  {u.explore} <i aria-hidden="true">→</i>
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <ContactCTA n={next()} service={service.slug} assure={!assuredUnderRows} />
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
