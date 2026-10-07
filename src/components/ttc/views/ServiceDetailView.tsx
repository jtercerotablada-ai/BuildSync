import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { company, imagery } from '@/lib/ttc/site';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { EngineerCredential } from '@/components/ttc/mp/EngineerCredential';
import { SoftwareBand } from '@/components/ttc/mp/SoftwareBand';
import { ButtonLink, SectionHeading, Reveal, TextLink } from '@/components/ttc/mp/primitives';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * One service, in the order a client asks the questions: why it matters →
 * when you need it → what is included → what you receive → how it runs →
 * when it applies (regulated services) → good to know → next step.
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
 * HEADING OUTLINE. Every section owns one h2, so a screen reader's heading
 * list (and a crawler's outline) files each h3 under the right section. The
 * sections that show only a SectionHeading label (when it applies, how it
 * runs, related) carry a visually hidden h2 with that same label, and the
 * visible label is hidden from assistive tech so it is not announced twice.
 */
export function ServiceDetailView({ lang, slug }: { lang: Lang; slug: string }) {
  const c = getContent(lang);
  const u = c.ui;
  const service = c.services.find((s) => s.slug === slug);
  if (!service) return null;
  const l = (href: string) => localePath(href, lang);
  // Both tracks hold four services, so every page has three same-track
  // siblings and the row is three equal columns. The grid still auto-fits
  // (mp.css `.mp-more`): were a track to shrink, the links would fill the row
  // instead of leaving a blank column.
  const related = c.services.filter((s) => s.slug !== slug && s.track === service.track).slice(0, 3);
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
  // Each regulated service now carries ONE jurisdiction: Miami-Dade and
  // Broward have a page each, and the milestone page has the State's row. A
  // single card in the old auto-fit grid stretched across the whole shell,
  // with 250-character values running in one line. So one row is laid out
  // beside its own notes (`.mp-juris--single`); several rows keep the grid,
  // with the notes underneath.
  const singleRow = service.timing?.rows.length === 1;
  const timingNotes = service.timing ? (
    <>
      <p className="mp-timing__note">{service.timing.note}</p>
      <p className="mp-timing__src">
        {u.lastChecked}: {service.timing.checked}
      </p>
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

  // The provider is the ONE Organization node the (public) layout emits, by
  // @id — a second, unnamed ProfessionalService here read as a different
  // company. The EN page's @id is the same one the layout's offer catalogue
  // points at, so the two graphs join up.
  const pageUrl = `${company.url}${l(`/services/${service.slug}`)}`;
  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name: service.title,
    description: service.seo.description,
    serviceType: service.title,
    provider: { '@id': `${company.url}/#organization` },
    // A county program is offered in its own county only: the Broward page
    // must not tell a search engine it serves Miami-Dade, or the reverse.
    // Every other service is offered in both.
    areaServed: service.areaServed ?? ['Miami-Dade County, Florida', 'Broward County, Florida'],
    url: pageUrl,
  };

  let n = 0;
  const next = () => String(++n).padStart(2, '0');

  return (
    <>
      <JsonLd data={serviceLd} />
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
        titleLines={[service.title]}
        sub={service.summary}
        actions={[{ href: contactHref, label: cta }]}
        actionNote={program?.ctaNote}
        // Client terms only: what kind of building, and where. The old
        // "Service 01" index meant nothing to a client, and "Basis" put a
        // code list in the first screen.
        // A county program prints its filing deadline instead: there the two
        // facts only repeated the title above them ("Existing buildings",
        // the county), while the answer a notice-holder came for was four
        // screens down. The whole row is printed — its hedges are part of
        // the fact, and a shortened deadline is how a wrong one gets read.
        facts={
          filing
            ? [{ k: filing.k, v: filing.v }]
            : [
                { k: u.appliesTo, v: service.track === 'new' ? u.newConstruction : u.existingBuildings },
                { k: u.coverage, v: service.coverage ?? c.contact.serviceAreaLabel },
              ]
        }
        photo={imagery.services[service.slug]}
      >
        {program ? <EngineerCredential lang={lang} /> : null}
      </PageHero>

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
              <h2 className="mp-h3 mp-cols2__title">{u.whatsIncluded}</h2>
              <ol className="mp-speclist">
                {service.scope.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mp-h3 mp-cols2__title">{u.whatYouReceive}</h2>
              <ol className="mp-speclist">
                {service.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ol>
              <div className="mp-callout mp-callout--spaced mp-callout--next">
                <h3>{u.nextStep}</h3>
                <p>{service.nextStep}</p>
                <div className="mp-cta-row" style={{ marginTop: 'var(--mp-4)' }}>
                  <ButtonLink href={l(contactHref)} variant="solid">
                    {cta}
                  </ButtonLink>
                </div>
                {/* Who answers: the box used to say what to send and nothing
                    about who reads it. */}
                {program ? <EngineerCredential lang={lang} /> : null}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* When it applies — regulated services only */}
      {service.timing ? (
        <section className="mp-section mp-surface--paper">
          <div className="mp-shell">
            <div aria-hidden="true">
              <SectionHeading n={next()} label={u.whenItApplies} />
            </div>
            <h2 className="mp-sr-only">{u.whenItApplies}</h2>
            <div className={singleRow ? 'mp-juris mp-juris--single' : 'mp-juris'}>
              {service.timing.rows.map((row) => (
                <Reveal as="div" key={row.jurisdiction} className="mp-juris__card">
                  <h3 className="mp-juris__title">{row.jurisdiction}</h3>
                  <dl className="mp-timing">
                    {row.facts.map((f) => (
                      <div key={f.k}>
                        <dt>{f.k}</dt>
                        <dd>{f.v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mp-timing__src">{row.source}</p>
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
                the same row as the home page's program sections (mp.css 07):
                the button, and beside it the line that says what to send. */}
            <Reveal delay={0.08} className="mp-prog__action">
              <ButtonLink href={l(contactHref)} variant="solid">
                {cta}
              </ButtonLink>
              {program ? <p className="mp-prog__ctanote">{program.ctaNote}</p> : null}
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* How it runs */}
      <section className={`mp-section ${service.timing ? 'mp-surface--concrete' : 'mp-surface--paper'}`}>
        <div className="mp-shell">
          <div aria-hidden="true">
            <SectionHeading n={next()} label={u.howItRuns} />
          </div>
          <h2 className="mp-sr-only">{u.howItRuns}</h2>
          <div className="mp-timeline">
            <div className="mp-timeline__track" aria-hidden="true" />
            {service.process.map((p, i) => (
              <Reveal as="div" key={p.step} delay={i * 0.04} className="mp-step is-in">
                <div className="mp-step__node">
                  <span className="mp-step__dot" aria-hidden="true" />
                  <span className="mp-step__n">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mp-step__title">{p.step}</h3>
                <p className="mp-step__detail">{p.detail}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Good to know. The label stays "Good to know"; the h2 says what the
          list actually is, instead of repeating the label at display size. */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.considerations} />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">{u.considerationsTitle}</h2>
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

      {/* Related */}
      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <div aria-hidden="true">
            <SectionHeading n={next()} label={u.relatedServices} />
          </div>
          <h2 className="mp-sr-only">{u.relatedServices}</h2>
          <div className="mp-more">
            {related.map((r) => (
              <Link key={r.slug} href={l(`/services/${r.slug}`)}>
                <span className="mp-secnum">{r.n}</span>
                <span className="mp-more__t">{r.title}</span>
                <span className="mp-more__go">
                  {u.explore} <i aria-hidden="true">→</i>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ContactCTA n={next()} service={service.slug} />
    </>
  );
}
