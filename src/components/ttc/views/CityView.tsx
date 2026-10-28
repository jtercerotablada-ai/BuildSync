import React from 'react';
import Link from 'next/link';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { imagery, regulatoryCheckedISO } from '@/lib/ttc/site';
import { cityChecked, cityCheckedISO, cityPath, type CityPage } from '@/lib/ttc/cities';
import { cityPagesOf, findCityPage } from '@/lib/ttc/city-content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { cityFaqLd, cityServiceLd, cityWebPageLd } from '@/lib/ttc/city-structured-data';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { HomeContact } from '@/components/ttc/mp/home/HomeContact';
import { ServiceClock } from '@/components/ttc/mp/plates/ServiceClock';
import { ServiceFee } from '@/components/ttc/mp/plates/ServiceFee';
import { ServiceIncludes } from '@/components/ttc/mp/plates/ServiceIncludes';
import { JUMP_ID } from '@/components/ttc/mp/JumpLinks';
import { ReachRow } from '@/components/ttc/mp/ReachRow';
import { Dated, Source } from '@/components/ttc/mp/Outbound';
import { ButtonLink, Reveal, SectionHeading, TextLink } from '@/components/ttc/mp/primitives';
import { firstSentence, keepHyphens } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * One city, under its county program: /services/<program>/<city>.
 *
 * THE PROGRAM PAGE'S PARTS (2026-10-27, the owner: "mejora las páginas de
 * las ciudades como building-recertification, ya que tenemos el diseño
 * lindo" … "el principal de recertification y BSIP puedes aplicar a todas,
 * lo único que en base a tus investigaciones"), in the order of a board
 * member's worries (the owner, 2026-10-20: what the reader risks comes
 * first): the hero names the city and, in its panel, the office → the
 * county's clock, its numbers large, each caption naming the city → the
 * deadline rows they come from, in one card, with the button → how THIS
 * city runs the program, one numbered card per subject read on the city's
 * own website, then the office's address → what the work includes, the
 * program page's photo cards by name, with the way to who does what → the
 * fee, every line naming the city → the questions boards in this city ask
 * → what to send, with the way to the package on the county page. The
 * closing band carries the form. The cards and the answers say "the rows
 * above": keep the rows first.
 *
 * WHAT IT DOES NOT TAKE FROM THE PROGRAM'S PAGE: the sentences under the
 * photo cards, the who-does-what table and the reviews. Each is the same
 * text on every page that prints it, and a city page prints nothing of six
 * words that another page prints (below); it links to the table. (A city's
 * office in the table's first lane was tried on 2026-10-27 and taken out:
 * its cells are the program's, and several cities' own pages say they do
 * not describe the step a cell gave their office.)
 *
 * Every word is in the server HTML: the questions are closed <details>, the
 * site's one disclosure look (`.mp-faq--acc`); they print open.
 *
 * WHERE EACH WORD COMES FROM.
 *   • Everything specific to the city — the first line, the lede, the rows,
 *     the questions, the next step — is the page's own text in cities.ts /
 *     cities.es.ts, and each line of it was read on the city's website
 *     (city-sources.ts).
 *   • The deadlines are NOT the page's: they are the `home` facts of the
 *     county program's timing row, label and first sentence, exactly as
 *     the home page prints them — read here, never typed. Each row is
 *     printed with the city's name in its label ("Time to file in
 *     Hialeah"), which is what it is on this page: that fact, for a
 *     building in that city; the city part is set in the second ink, so
 *     the labels scan as "First due / Then / Time to file". The whole row,
 *     with its conditions, is one link away on the county page.
 *   • The headings are built here, with the city's name in each.
 *
 * NOTHING OF SIX WORDS OR MORE IS SHARED with another page: not between
 * two cities, not with the county page (cities.test.ts). That is why the
 * button's note, the free-proposal line and the package list are NOT
 * repeated here — the county page has them, and this page links to it —
 * and why the line that dates the rows names the city.
 *
 * HEADINGS: one h1, four h2 and one h3 per question. Row labels, the
 * office card and the list of other cities are not headings.
 */

type Labels = {
  h1: (place: string) => string;
  office: string;
  phone: string;
  localTitle: (place: string) => string;
  /** In front of the day the city's pages were read, naming the office: a
      line of its own on every page, so it is never one line on all of them. */
  read: (office: string) => string;
  deadlinesTitle: (place: string) => string;
  /** Under the deadlines' heading: the stake. Whose dates they are is the
      source line's, under the rows (`rowsFor`), so it is not said twice. */
  deadlinesLede: (place: string) => string;
  /** The city part of a deadline row's label, after the county's label:
      "Time to file" + " in Hialeah". Drawn in the second ink. */
  at: (place: string) => string;
  /** In front of the row's authority: "County rows for Hialeah". */
  rowsFor: (place: string, county: string) => string;
  /** What the fee band calls the work, naming the city ("Hialeah
      recertification"): ServiceFee's `name`. The Spanish name follows "en",
      so it takes the place, with its article ("en la Ciudad de Miami"). */
  feeName: (city: string, place: string) => string;
  /** Over the photo cards of what the work includes, naming the city. */
  includesLabel: (place: string) => string;
  /** The way to "Who does what" on the county page, under five words: the
      same short line on every city page (cities.test.ts counts six). */
  flowLink: string;
  questionsTitle: (place: string) => string;
  receiveLabel: string;
  receiveTitle: (place: string) => string;
  packageLink: string;
  otherCities: (county: string) => string;
};

const COUNTY: Record<CityPage['program'], string> = {
  'building-recertification': 'Miami-Dade',
  'broward-bsip': 'Broward',
};

const LABELS: Record<Lang, Record<CityPage['program'], Labels>> = {
  en: {
    'building-recertification': {
      h1: (place) => `Building Recertification in ${place}`,
      office: 'Building office',
      phone: 'Phone',
      localTitle: (place) => `How building recertification is handled in ${place}`,
      read: (office) => `Read on the website of the ${office}`,
      deadlinesTitle: (place) => `The deadlines that apply in ${place}`,
      // No clock here: where each one starts is said only in the rows, read
      // from site.ts — Miami-Dade "from the Notice", Broward from RECEIVING
      // it (a lede that said "the date on your notice" contradicted the
      // Broward row printed beside it). "Does not go away" is the county
      // page's own line, without its figures — a city sets its own amounts.
      deadlinesLede: (place) =>
        `For a building in ${place}, these are the dates that count, and an unanswered notice does not go away.`,
      at: (place) => `in ${place}`,
      rowsFor: (place, county) => `${county} County’s rows, for ${place}`,
      feeName: (city) => `${city} recertification`,
      includesLabel: (place) => `What the recertification includes in ${place}`,
      flowLink: 'Who does each step',
      questionsTitle: (place) => `Questions boards in ${place} ask`,
      receiveLabel: 'What to send',
      // "Fixed fee": every recertification is quoted as one before any
      // work starts (site.ts, `pricing`).
      receiveTitle: (place) => `The complete recertification in ${place}, at a fixed fee`,
      packageLink: 'The package, part by part',
      otherCities: (county) => `Other ${county} cities`,
    },
    'broward-bsip': {
      h1: (place) => `Building Safety Inspection (BSIP) in ${place}`,
      office: 'Building office',
      phone: 'Phone',
      localTitle: (place) => `How the Building Safety Inspection Program runs in ${place}`,
      read: (office) => `Read on the website of the ${office}`,
      deadlinesTitle: (place) => `The deadlines that apply in ${place}`,
      // The same lede as Miami-Dade's, with no clock: Broward's time to file
      // runs from RECEIVING the notice and its repairs from the date of the
      // report (site.ts, the Broward timing row) — the rows say so.
      deadlinesLede: (place) =>
        `For a building in ${place}, these are the dates that count, and an unanswered notice does not go away.`,
      at: (place) => `in ${place}`,
      rowsFor: (place, county) => `${county} County’s rows, for ${place}`,
      feeName: (city) => `${city} BSIP`,
      includesLabel: (place) => `What the BSIP inspection includes in ${place}`,
      flowLink: 'Who does each step',
      questionsTitle: (place) => `Questions boards in ${place} ask`,
      receiveLabel: 'What to send',
      receiveTitle: (place) => `The complete BSIP inspection and report in ${place}, at a fixed fee`,
      packageLink: 'The package, part by part',
      otherCities: (county) => `Other ${county} cities`,
    },
  },
  es: {
    'building-recertification': {
      h1: (place) => `Recertificación de edificios en ${place}`,
      office: 'Oficina de construcción',
      phone: 'Teléfono',
      localTitle: (place) => `Cómo se tramita la recertificación de edificios en ${place}`,
      read: (office) => `Leído en el sitio web de la oficina (${office})`,
      deadlinesTitle: (place) => `Los plazos que rigen en ${place}`,
      deadlinesLede: (place) =>
        `Para un edificio en ${place}, estos son los plazos que cuentan, y una notificación sin respuesta no desaparece.`,
      at: (place) => `en ${place}`,
      rowsFor: (place, county) => `Datos del Condado de ${county}, para ${place}`,
      feeName: (_city, place) => `Recertificación en ${place}`,
      includesLabel: (place) => `Qué incluye la recertificación en ${place}`,
      flowLink: 'Quién hace cada paso',
      questionsTitle: (place) => `Preguntas de las juntas directivas en ${place}`,
      receiveLabel: 'Qué enviar',
      receiveTitle: (place) => `La recertificación completa en ${place}, a precio fijo`,
      packageLink: 'El paquete, parte por parte',
      otherCities: (county) => `Otras ciudades de ${county}`,
    },
    'broward-bsip': {
      h1: (place) => `Inspección de seguridad de edificios (BSIP) en ${place}`,
      office: 'Oficina de construcción',
      phone: 'Teléfono',
      localTitle: (place) => `Cómo funciona el Programa de Inspección de Seguridad de Edificios en ${place}`,
      read: (office) => `Leído en el sitio web de la oficina (${office})`,
      deadlinesTitle: (place) => `Los plazos que rigen en ${place}`,
      deadlinesLede: (place) =>
        `Para un edificio en ${place}, estos son los plazos que cuentan, y una notificación sin respuesta no desaparece.`,
      at: (place) => `en ${place}`,
      rowsFor: (place, county) => `Datos del Condado de ${county}, para ${place}`,
      feeName: (_city, place) => `BSIP en ${place}`,
      includesLabel: (place) => `Qué incluye la inspección del BSIP en ${place}`,
      flowLink: 'Quién hace cada paso',
      questionsTitle: (place) => `Preguntas de las juntas directivas en ${place}`,
      receiveLabel: 'Qué enviar',
      receiveTitle: (place) => `La inspección y el informe completos del BSIP en ${place}, a precio fijo`,
      packageLink: 'El paquete, parte por parte',
      otherCities: (county) => `Otras ciudades de ${county}`,
    },
  },
};

/** The H1 of a city page — also what its breadcrumb and its tests read. */
export const cityH1 = (lang: Lang, page: Pick<CityPage, 'program' | 'place'>) =>
  LABELS[lang][page.program].h1(page.place);

export function CityView({ lang, program, slug }: { lang: Lang; program: string; slug: string }) {
  const c = getContent(lang);
  const u = c.ui;
  const page = findCityPage(lang, program, slug);
  const service = c.services.find((s) => s.slug === program);
  if (!page || !service?.program || !service.timing) return null;
  const t = LABELS[lang][page.program];
  const county = COUNTY[page.program];
  const l = (href: string) => localePath(href, lang);
  const servicePath = `/services/${service.slug}`;
  const contactHref = `/contact?service=${service.slug}`;
  const row = service.timing.rows[0];
  // The county's rows a notice-holder asks about: the ones the home page
  // prints, each as its label and its first sentence (site.ts flags them).
  const deadlines = row.facts.filter((f) => f.home);
  const others = cityPagesOf(lang, page.program).filter((p) => p.slug !== page.slug);

  let n = 0;
  const next = () => String(++n).padStart(2, '0');

  return (
    <div className="mp-plates mp-dark">
      <JsonLd data={cityServiceLd(lang, service, page)} />
      <JsonLd data={cityWebPageLd(lang, page, t.h1(page.place))} />
      <JsonLd data={cityFaqLd(lang, page)} />
      <JsonLd
        data={breadcrumbLd(lang, [
          { name: u.home, path: '/' },
          { name: navLabelOf(c, '/services'), path: '/services' },
          { name: service.title, path: servicePath },
          { name: page.city, path: cityPath(page) },
        ])}
      />

      <PageHero
        eyebrow={service.shortTitle}
        crumbs={[
          { href: '/', label: u.home },
          { href: '/services', label: navLabelOf(c, '/services') },
          { href: servicePath, label: service.shortTitle },
          { label: page.city },
        ]}
        titleLines={[t.h1(page.place)]}
        sub={page.heroSub}
        actions={[{ href: contactHref, label: service.program.cta }]}
        // The office, by name, in the panel beside the title (2026-10-27:
        // the panel stood empty above the WhatsApp line). The same name is
        // printed on the English page and its Spanish twin — a proper name,
        // in English in both — and the address block prints it in full.
        facts={[{ k: t.office, v: page.office.name }]}
        photo={imagery.services[service.slug]}
      >
        <ReachRow c={c} />
      </PageHero>

      {/* The page's sections, not the hero and not the closing band: the
          city-page rules in mp.css and dark.css are scoped under this
          wrapper. The county's numbers, large → the rows they come from →
          how THIS city runs it, in cards → what the work includes → the fee
          → the questions → what to send. */}
      <div className="mp-cityp">
        {/* The county's clock, for this city: its numbers, large, each
            caption and the exception line ending with the city's name
            (ServiceClock `at`). */}
        <ServiceClock lang={lang} slug={service.slug} at={t.at(page.place)} />

        {/* The deadlines: the county's verified rows, label and first
            sentence, each with the city in its label, in one card; then the
            button and the way to the whole table. First, because it is what
            the reader risks (the owner, 2026-10-20) — and the city's cards
            and answers below refer to "the rows above". */}
        <section className="mp-section mp-surface--concrete">
          <div className="mp-shell">
            <SectionHeading n={next()} label={u.whenItApplies} />
            <div className="mp-cityp__pair">
              <div className="mp-cityp__head">
                <Reveal>
                  <h2 className="mp-intro__title">{t.deadlinesTitle(page.place)}</h2>
                </Reveal>
                <Reveal delay={0.05}>
                  <p className="mp-intro__lede">{t.deadlinesLede(page.place)}</p>
                </Reveal>
              </div>
              <div className="mp-cityp__body">
                <Reveal delay={0.05} className="mp-city__rowscard">
                  <ul className="mp-city__rows">
                    {deadlines.map((f) => (
                      <li key={f.k}>
                        {/* The colon is for whoever reads the item as text;
                            the label is drawn on its own (as on the home
                            page). One expression in the span, so React
                            prints no comment inside the label. */}
                        <b>
                          {f.k}
                          <span className="mp-city__in">{` ${t.at(page.place)}`}</span>
                          <span className="mp-sr-only">:</span>
                        </b>{' '}
                        {f.homeWhole ? f.v : firstSentence(f.v)}
                      </li>
                    ))}
                  </ul>
                  <p className="mp-timing__src">
                    {t.rowsFor(page.place, county)}. {u.sourceLabel}: <Source row={row} />
                    {' · '}
                    {/* The date in one piece, as on the program's page. */}
                    <span className="mp-timing__checked">
                      <Dated label={u.lastChecked} date={service.timing.checked} iso={regulatoryCheckedISO} />
                    </span>
                  </p>
                </Reveal>
                {/* The button, then the way to the whole table — each in an
                    element of its own: side by side in one, the two labels
                    read as a single line of text, the same on every city of
                    the county. */}
                <div className="mp-prog__action">
                  <ButtonLink href={l(contactHref)} variant="solid">
                    {service.program.cta}
                  </ButtonLink>
                  <p className="mp-city__all">
                    <TextLink href={l(`${servicePath}#${JUMP_ID.applies}`)}>{service.program.timingLink}</TextLink>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How this city handles it: the page's own text, one card per
            subject, numbered, then the office where the report goes. */}
        <section className="mp-section mp-surface--paper">
          <div className="mp-shell">
            <SectionHeading n={next()} label={u.yourCity} />
            <div className="mp-cityp__pair">
              <div className="mp-cityp__head">
                <Reveal>
                  <h2 className="mp-intro__title">{t.localTitle(page.place)}</h2>
                </Reveal>
              </div>
              <Reveal delay={0.05} className="mp-cityp__body">
                <p className="mp-intro__lede">{page.lede}</p>
              </Reveal>
            </div>
            <div className="mp-city mp-city--cards">
              <dl className="mp-city__cards">
                {page.local.map((item, i) => (
                  <Reveal as="div" key={item.k} delay={Math.min(i, 5) * 0.04} className="mp-city__card">
                    <dt>{item.k}</dt>
                    <dd>{item.v}</dd>
                  </Reveal>
                ))}
              </dl>
              {/* Where the report goes: the office, its street address and
                  its phone, as lines of one paragraph.
                    • Not an <address>: that element is the contact of the
                      PAGE, and these are the city's, on a site that
                      publishes no address of its own.
                    • The phone is TEXT, not a tel: link. The ads script
                      counts a tap on any tel: link as a call to the firm
                      (ads.ts); this number rings at a city office.
                    • A space between the lines: a phone draws each on its
                      own row, and from 761px each is an item of one wrapping
                      row, a dot between two items and none at a row's start
                      (mp.css); a reader of the plain text must not get
                      "Section444 SW 2nd Ave".
                    • The card is drawn on the wrapper (dark.css): the
                      paragraph clips the dot of an item that opens a row,
                      and padding on the paragraph itself would show it. */}
              <div className="mp-city__officebox">
                <p className="mp-city__office">
                  <span className="mp-city__k">{t.office}</span>{' '}
                  <span className="mp-city__name">{page.office.name}</span>
                  {page.office.address?.map((line) => (
                    <React.Fragment key={line}>
                      {' '}
                      <span className="mp-city__line">{line}</span>
                    </React.Fragment>
                  ))}
                  {page.office.phone ? (
                    <>
                      {' '}
                      <span className="mp-city__line">
                        {t.phone}: {page.office.phone}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <p className="mp-timing__src">
                <Dated label={t.read(page.office.name)} date={cityChecked(page, lang)} iso={cityCheckedISO(page)} />
              </p>
            </div>
          </div>
        </section>

        {/* What the work includes: the program page's photo cards, the names
            only, a part that applies only somewhere with its condition
            (ServiceIncludes `bare`), less what this city's own page excludes
            (`omitIncludes`). No heading: a city page has four h2
            (cities.test.ts); the band's label names the city. Who does what
            at each step is the county page's table, one link away: its cells
            are the program's, and on 48 pages they would be the same block
            48 times — under a city's office name, they also said what
            several cities' own pages leave unsaid. */}
        <section className="mp-section mp-surface--concrete" aria-label={t.includesLabel(page.place)}>
          <div className="mp-shell">
            <SectionHeading n={next()} label={t.includesLabel(page.place)} />
            <ServiceIncludes lang={lang} slug={service.slug} bare omit={page.omitIncludes} />
            <p className="mp-city__more mp-city__flow">
              <TextLink href={l(`${servicePath}#${JUMP_ID.steps}`)}>{t.flowLink}</TextLink>
            </p>
          </div>
        </section>

        {/* The fee, as on the program's page, every line naming the city
            (ServiceFee `name`). */}
        <ServiceFee
          lang={lang}
          slug={service.slug}
          href={contactHref}
          cta={service.program.cta}
          surface="mp-surface--paper"
          name={t.feeName(page.city, page.place)}
        />

        {/* Questions boards in this city ask: each an h3 in the <summary> of
            its own <details>, closed; every answer is plain text in the
            server HTML, and the page prints them open. */}
        <section id={JUMP_ID.questions} className="mp-section mp-surface--concrete">
          <div className="mp-shell">
            <SectionHeading n={next()} label={u.faqLabel} />
            <div className="mp-cityp__pair">
              <div className="mp-cityp__head">
                <Reveal>
                  <h2 className="mp-intro__title">{t.questionsTitle(page.place)}</h2>
                </Reveal>
              </div>
              <div className="mp-cityp__body mp-faq mp-faq--acc">
                <div className="mp-faq__col">
                  {page.faq.map((item) => (
                    <Reveal as="div" key={item.q} className="mp-faq__item">
                      <details className="mp-faq__d">
                        <summary className="mp-faq__sum">
                          {/* A hyphenated name ("40-year", "Miami-Dade")
                              stays whole on its line, as on the program's
                              page. */}
                          <h3 className="mp-faq__q">{keepHyphens(item.q)}</h3>
                          <span className="mp-faq__icon" aria-hidden="true" />
                        </summary>
                        <p className="mp-faq__a">{item.a}</p>
                      </details>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What to send, and the way to the package part by part on the
            county page. No button here: the closing band right under it
            carries the form, with the program selected. */}
        <section className="mp-section mp-surface--paper">
          <div className="mp-shell">
            <SectionHeading n={next()} label={t.receiveLabel} />
            <div className="mp-cityp__pair">
              <div className="mp-cityp__head">
                <Reveal>
                  <h2 className="mp-intro__title">{t.receiveTitle(page.place)}</h2>
                </Reveal>
              </div>
              <Reveal delay={0.05} className="mp-cityp__body mp-cityp__next">
                <p>{page.nextStep}</p>
                <p className="mp-city__more">
                  <TextLink href={l(`${servicePath}#${JUMP_ID.package}`)}>{t.packageLink}</TextLink>
                </p>
              </Reveal>
            </div>
            {/* The other cities of the county: navigation, so no heading. */}
            {others.length ? (
              <nav className="mp-city__others" aria-label={t.otherCities(county)}>
                <span className="mp-city__k" aria-hidden="true">
                  {t.otherCities(county)}
                </span>
                <ul>
                  {others.map((p) => (
                    <li key={p.slug}>
                      <Link href={l(cityPath(p))}>{p.city}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
        </section>
      </div>

      <HomeContact closing lang={lang} presetService={service.slug} />
    </div>
  );
}
