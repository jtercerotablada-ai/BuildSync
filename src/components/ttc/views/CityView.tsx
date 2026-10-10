import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { imagery, regulatoryCheckedISO } from '@/lib/ttc/site';
import { citiesChecked, citiesCheckedISO, cityPath, type CityPage } from '@/lib/ttc/cities';
import { cityPagesOf, findCityPage } from '@/lib/ttc/city-content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { cityFaqLd, cityServiceLd, cityWebPageLd } from '@/lib/ttc/city-structured-data';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { EngineerCredential } from '@/components/ttc/mp/EngineerCredential';
import { JUMP_ID } from '@/components/ttc/mp/JumpLinks';
import { ReachRow } from '@/components/ttc/mp/ReachRow';
import { Dated, Source } from '@/components/ttc/mp/Outbound';
import { ButtonLink, Reveal, SectionHeading, TextLink } from '@/components/ttc/mp/primitives';
import { firstSentence } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * One city, under its county program: /services/<program>/<city>.
 *
 * The order is the order of a board member's questions with the city's
 * letter in hand: is this my city's page (H1, the office by name) → how
 * does MY city handle it (the rows read on the city's own website) → how
 * long do we have (the county's verified rows, by label) → the questions
 * boards in this city ask → what to send, and to whom.
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
 *     building in that city. The whole row, with its conditions, is one
 *     link away on the county page.
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
  deadlinesLede: (place: string, county: string) => string;
  /** A deadline row's label, with the city: "Time to file in Hialeah". */
  inPlace: (label: string, place: string) => string;
  /** In front of the row's authority: "County rows for Hialeah". */
  rowsFor: (place: string, county: string) => string;
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
      deadlinesLede: (place, county) =>
        `The schedule is ${county} County’s, printed here for a building in ${place}; the date on your own notice is the one that counts.`,
      inPlace: (label, place) => `${label} in ${place}`,
      rowsFor: (place, county) => `${county} County’s rows, for ${place}`,
      questionsTitle: (place) => `Questions boards in ${place} ask`,
      receiveLabel: 'One team',
      receiveTitle: (place) => `The complete recertification for a building in ${place}`,
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
      deadlinesLede: (place, county) =>
        `The schedule is the ${county} County Board of Rules and Appeals’, printed here for a building in ${place}; the date on your own notice is the one that counts.`,
      inPlace: (label, place) => `${label} in ${place}`,
      rowsFor: (place, county) => `${county} County’s rows, for ${place}`,
      questionsTitle: (place) => `Questions boards in ${place} ask`,
      receiveLabel: 'One team',
      receiveTitle: (place) => `The complete BSIP inspection and report for a building in ${place}`,
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
      deadlinesLede: (place, county) =>
        `El calendario es el del Condado de ${county}, impreso aquí para un edificio en ${place}; la fecha que cuenta es la de su propia notificación.`,
      inPlace: (label, place) => `${label} en ${place}`,
      rowsFor: (place, county) => `Datos del Condado de ${county}, para ${place}`,
      questionsTitle: (place) => `Preguntas de las juntas directivas en ${place}`,
      receiveLabel: 'Un solo equipo',
      receiveTitle: (place) => `La recertificación completa para un edificio en ${place}`,
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
      deadlinesLede: (place, county) =>
        `El calendario es el de la Junta de Reglas y Apelaciones del Condado de ${county}, impreso aquí para un edificio en ${place}; la fecha que cuenta es la de su propia notificación.`,
      inPlace: (label, place) => `${label} en ${place}`,
      rowsFor: (place, county) => `Datos del Condado de ${county}, para ${place}`,
      questionsTitle: (place) => `Preguntas de las juntas directivas en ${place}`,
      receiveLabel: 'Un solo equipo',
      receiveTitle: (place) => `La inspección y el informe completos del BSIP para un edificio en ${place}`,
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
    <>
      <JsonLd data={cityServiceLd(lang, service, page)} />
      <JsonLd data={cityWebPageLd(lang, page, t.h1(page.place))} />
      <JsonLd data={cityFaqLd(lang, page)} />
      <JsonLd
        data={breadcrumbLd(lang, [
          { name: u.home, path: '/' },
          { name: c.primaryNav[0].label, path: '/services' },
          { name: service.title, path: servicePath },
          { name: page.city, path: cityPath(page) },
        ])}
      />

      <PageHero
        eyebrow={service.shortTitle}
        crumbs={[
          { href: '/', label: u.home },
          { href: '/services', label: c.primaryNav[0].label },
          { href: servicePath, label: service.shortTitle },
          { label: page.city },
        ]}
        titleLines={[t.h1(page.place)]}
        sub={page.heroSub}
        actions={[{ href: contactHref, label: service.program.cta }]}
        // No fact under the button. The county page prints the filing
        // deadline there; this page has a section for the deadlines, and
        // the office — the one fact that would fit — is an English name in
        // both languages, so the same line would stand on the English page
        // and on its Spanish twin. The first line names the office in the
        // page's own words, and the address block prints it in full.
        photo={imagery.services[service.slug]}
      >
        <EngineerCredential lang={lang} brief />
        <ReachRow c={c} />
      </PageHero>

      {/* How this city handles it: the page's own text, row by row. */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.yourCity} />
          <div className="mp-intro">
            <Reveal>
              <h2 className="mp-intro__title">{t.localTitle(page.place)}</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mp-intro__lede">{page.lede}</p>
            </Reveal>
          </div>
          <Reveal as="div" delay={0.05} className="mp-packet mp-city">
            <dl className="mp-packet__list">
              {page.local.map((item) => (
                <div key={item.k}>
                  <dt>{item.k}</dt>
                  <dd>{item.v}</dd>
                </div>
              ))}
            </dl>
            {/* Where the report goes: the office, its street address and its
                phone, as lines of one paragraph.
                  • Not an <address>: that element is the contact of the PAGE,
                    and these are the city's, on a site that publishes no
                    address of its own.
                  • The phone is TEXT, not a tel: link. The ads script counts
                    a tap on any tel: link as a call to the firm (ads.ts);
                    this number rings at a city office.
                  • A space between the lines: each is drawn on its own row
                    (mp.css), and a reader of the plain text must not get
                    "Section444 SW 2nd Ave". */}
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
            <p className="mp-timing__src">
              <Dated label={t.read(page.office.name)} date={citiesChecked[lang]} iso={citiesCheckedISO} />
            </p>
          </Reveal>
        </div>
      </section>

      {/* The county's deadlines, read from its verified row. */}
      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.whenItApplies} />
          <div className="mp-intro">
            <Reveal>
              <h2 className="mp-intro__title">{t.deadlinesTitle(page.place)}</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mp-intro__lede">{t.deadlinesLede(page.place, county)}</p>
            </Reveal>
          </div>
          <Reveal delay={0.05}>
            <ul className="mp-city__rows">
              {deadlines.map((f) => (
                <li key={f.k}>
                  {/* The colon is for whoever reads the item as text; the
                      label is drawn on its own (as on the home page). */}
                  <b>
                    {t.inPlace(f.k, page.place)}
                    <span className="mp-sr-only">:</span>
                  </b>{' '}
                  {f.homeWhole ? f.v : firstSentence(f.v)}
                </li>
              ))}
            </ul>
          </Reveal>
          <p className="mp-timing__src">
            {t.rowsFor(page.place, county)}. {u.sourceLabel}: <Source row={row} />
            {' · '}
            <Dated label={u.lastChecked} date={service.timing.checked} iso={regulatoryCheckedISO} />
          </p>
          {/* The button, then the way to the whole table — each in an element
              of its own: side by side in one, the two labels read as a single
              line of text, the same on every city of the county. */}
          <div className="mp-prog__action">
            <ButtonLink href={l(contactHref)} variant="solid">
              {service.program.cta}
            </ButtonLink>
            <p className="mp-city__all">
              <TextLink href={l(`${servicePath}#${JUMP_ID.applies}`)}>{service.program.timingLink}</TextLink>
            </p>
          </div>
        </div>
      </section>

      {/* Questions boards in this city ask: each an h3, each answer plain
          text in the HTML. */}
      <section id={JUMP_ID.questions} className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n={next()} label={u.faqLabel} />
          <div className="mp-intro">
            <Reveal>
              <h2 className="mp-intro__title">{t.questionsTitle(page.place)}</h2>
            </Reveal>
          </div>
          <div className="mp-faq">
            {page.faq.map((item) => (
              <Reveal as="div" key={item.q} className="mp-faq__item">
                <h3 className="mp-faq__q">{item.q}</h3>
                <p className="mp-faq__a">{item.a}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* What to send, and the way to the whole package on the county page. */}
      <section className="mp-section mp-surface--concrete">
        <div className="mp-shell">
          <SectionHeading n={next()} label={t.receiveLabel} />
          <div className="mp-split">
            <Reveal>
              <h2 className="mp-split__title">{t.receiveTitle(page.place)}</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <div className="mp-callout mp-callout--next">
                <p className="mp-callout__label">{u.nextStep}</p>
                <p>{page.nextStep}</p>
                <div className="mp-cta-row" style={{ marginTop: 'var(--mp-4)' }}>
                  <ButtonLink href={l(contactHref)} variant="solid">
                    {service.program.cta}
                  </ButtonLink>
                </div>
                <p className="mp-city__more">
                  <TextLink href={l(`${servicePath}#${JUMP_ID.receive}`)}>{t.packageLink}</TextLink>
                </p>
              </div>
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

      <ContactCTA n={next()} service={service.slug} />
    </>
  );
}
