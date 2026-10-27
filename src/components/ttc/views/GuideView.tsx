import React from 'react';
import Link from 'next/link';
import { getContent, type SiteContent } from '@/lib/ttc/content';
import { absoluteUrl, imagery, regulatoryCheckedISO } from '@/lib/ttc/site';
import { COST_PATH } from '@/lib/ttc/cost-path';
import { GUIDES_PATH, guidePath, guidesReviewed, guidesReviewedISO, type GuideFacts } from '@/lib/ttc/guides';
import { findGuide, getGuides, guideLabels, guidesIndex } from '@/lib/ttc/guide-content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { LD_LANG, ORGANIZATION, WEBSITE } from '@/lib/ttc/structured-data';
import { photo, type Photo } from '@/lib/ttc/media';
import { Img } from '@/components/ttc/mp/media';
import { LegalDoc } from '@/components/ttc/mp/LegalDoc';
import { PageHero, type HeroAction } from '@/components/ttc/mp/PageHero';
import { HomeContact } from '@/components/ttc/mp/home/HomeContact';
import { ReachRow } from '@/components/ttc/mp/ReachRow';
import { Dated, Source } from '@/components/ttc/mp/Outbound';
import { accentLines } from '@/components/ttc/mp/text';
import { Reveal, SectionHeading } from '@/components/ttc/mp/primitives';
import { Arrow, Diamond } from '@/components/ttc/mp/home/glyphs';
import { Words } from '@/components/ttc/mp/home/Words';
import { guideHoldsNotice } from '@/lib/ttc/notice-pages';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * One guide: /guides/<slug> (guides.ts). One reading column, then the way out:
 *
 *   hero     the question as the H1; one button per county program, each
 *            opening the form for its own county (or, for the reader with
 *            no letter yet, one button with no preset; or, for a guide of a
 *            service that is no county program, one button with that
 *            service preset); WhatsApp under the buttons, without "Send the
 *            notice" where the reader holds none (`guideHoldsNotice`)
 *   short    the short answer: three sentences before the long read
 *   guide    LegalDoc's guide variant — the contents in a rail from 901px:
 *              · the h2 sections, each with paragraphs, a list, and the
 *                county facts it needs (two counties side by side on a wide
 *                screen) — read from the program's verified timing row,
 *                with the row's authority and date, never typed
 *              · the questions, as its last section: one <details> per
 *                question, the h3 in the summary, the answer in the HTML
 *                even when closed; also FAQPage data
 *              · where to go from here: the program page(s), the cost page,
 *                the other guides
 *   service  the card of the service behind the guide (and of its county
 *            programs), as the home prints its cards
 *   contact  the contact plate, with the program preset only when the guide
 *            has one program (a two-county guide's reader picks the county
 *            on the form), or its service when it has none
 *
 * WHERE THE NUMBERS COME FROM: a fact block prints `service.timing.rows[0]`
 * facts by label, whole — the hedges of a row (Broward's "your city's letter
 * states its own date") are never cut — with the county's name in front of
 * the label, so the block is this page's and not the program page's row.
 */

/** One photograph per guide: its hero, and its card on /guides (media.ts). */
const GUIDE_PHOTO: Record<string, Photo> = {
  'recertification-notice': photo.guideNoticeMailboxes,
  'broward-bsip-notice': photo.guideBrowardWaterway,
  'is-my-building-due': photo.guideOlderCondoTower,
  'recertification-30-40-50-year': photo.guideWhiteCondoBalconies,
  'milestone-recertification-sirs': photo.guideCoastalCondoTowers,
  'failed-recertification': photo.guideSpalledConcrete,
  'parking-lot-illumination-guardrail': photo.guideParkingLotNight,
  /* The guides of 2026-10-26, one per service the guides did not reach. */
  'threshold-building': photo.typeCondoTowers,
  'balcony-spalling-cracks': photo.facadeRopeInspection,
  'buying-a-building': photo.typeOffices,
  'structural-peer-review-florida': photo.drawingsReviewDesk,
};

const PLACE: Record<GuideFacts['service'], Record<Lang, string>> = {
  'building-recertification': { en: 'Miami-Dade', es: 'Miami-Dade' },
  'broward-bsip': { en: 'Broward', es: 'Broward' },
  'milestone-inspections': { en: 'Florida', es: 'Florida' },
};

/** The facts a block names, in the page's language, with their row. */
export function guideFacts(lang: Lang, block: GuideFacts) {
  const en = getContent('en').services.find((s) => s.slug === block.service)?.timing?.rows[0];
  const timing = getContent(lang).services.find((s) => s.slug === block.service)?.timing;
  const row = timing?.rows[0];
  if (!en || !timing || !row) throw new Error(`guides: no timing row for ${block.service}`);
  const facts = block.keys.map((key) => {
    const i = en.facts.findIndex((f) => f.k === key);
    if (i < 0 || !row.facts[i]) throw new Error(`guides: ${block.service} has no fact “${key}”`);
    return row.facts[i];
  });
  return { row, facts, checked: timing.checked, place: PLACE[block.service][lang] };
}

function FactBlock({ lang, block, c }: { lang: Lang; block: GuideFacts; c: SiteContent }) {
  const t = guideLabels(lang);
  const { row, facts, checked, place } = guideFacts(lang, block);
  return (
    <div className="mp-guide__facts">
      <ul className="mp-guide__rows">
        {facts.map((f) => (
          <li key={f.k}>
            <b>
              {t.factLabel(place, f.k)}
              <span className="mp-sr-only">:</span>
            </b>{' '}
            <span>{f.v}</span>
          </li>
        ))}
      </ul>
      {/* A citation, the same words wherever these rows are printed: a <div>,
          not a paragraph of the page's own text. */}
      <div className="mp-timing__src">
        {t.rowsOf(row.jurisdiction)}. {c.ui.sourceLabel}: <Source row={row} />
        {' · '}
        <Dated label={c.ui.lastChecked} date={checked} iso={regulatoryCheckedISO} />
      </div>
    </div>
  );
}

export function GuideView({ lang, slug }: { lang: Lang; slug: string }) {
  const c = getContent(lang);
  const g = findGuide(lang, slug);
  if (!g) return null;
  const t = guideLabels(lang);
  const idx = guidesIndex(lang);
  const l = (href: string) => localePath(href, lang);
  // The services the guide leads to: its own first, then its county
  // programs (a threshold guide leads to both counties as well).
  const leads = [...new Set([g.service, ...g.programs])].map((slug) => c.services.find((s) => s.slug === slug)!);
  // The closing form's preset: the one program, or — for a guide with none
  // (assessments, peer review) — its own service; a two-county guide's
  // reader picks the county on the form.
  const preset = g.programs.length === 1 ? g.programs[0] : g.programs.length === 0 ? g.service : undefined;
  const pageUrl = absoluteUrl(l(guidePath(g.slug)));
  const others = getGuides(lang).filter((x) => x.slug !== g.slug);
  const date = guidesReviewed[lang];
  // The reader with no letter yet (`heroAction: 'address'`) is never asked
  // to send a notice: under "Send the Address", WhatsApp is the plain
  // "Message us" (and the chat opens without "I received a notice"), in the
  // hero and in the closing band alike.
  const notice = guideHoldsNotice(g);
  // One button per program, each with its own county preselected: under a
  // lede that says "in Miami-Dade or in Broward", a lone Miami-Dade button
  // sent Broward boards to a form set to Miami-Dade. Both solid — neither
  // county is the secondary choice (the /existing-buildings pattern).
  const heroActions: HeroAction[] =
    g.heroAction === 'address'
      ? [{ href: '/contact', label: t.addressCta, variant: 'solid' }]
      : g.programs.length
        ? g.programs.map((p) => ({
            href: `/contact?service=${p}`,
            label: c.services.find((s) => s.slug === p)!.program!.cta,
            variant: 'solid' as const,
          }))
        : // A guide with no county program: one button, its own service
          // preselected on the form.
          [{ href: `/contact?service=${g.service}`, label: t.proposalCta, variant: 'solid' as const }];

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: g.h1,
        description: g.seo.description,
        image: absoluteUrl(GUIDE_PHOTO[g.slug].src),
        url: pageUrl,
        mainEntityOfPage: pageUrl,
        inLanguage: LD_LANG[lang],
        datePublished: guidesReviewedISO,
        dateModified: guidesReviewedISO,
        author: { '@id': ORGANIZATION },
        publisher: { '@id': ORGANIZATION },
        isPartOf: { '@id': WEBSITE },
        about: leads.map((s) => ({ '@id': `${absoluteUrl(l(`/services/${s.slug}`))}#service` })),
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        url: pageUrl,
        inLanguage: LD_LANG[lang],
        mainEntity: g.faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };

  return (
    <div className="mp-plates mp-dark">
      <JsonLd data={ld} />
      <JsonLd
        data={breadcrumbLd(lang, [
          { name: c.ui.home, path: '/' },
          { name: idx.crumb, path: GUIDES_PATH },
          { name: g.name, path: guidePath(g.slug) },
        ])}
      />

      <PageHero
        eyebrow={t.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { href: GUIDES_PATH, label: idx.crumb }, { label: g.name }]}
        titleLines={[g.h1]}
        sub={g.heroSub}
        actions={heroActions}
        photo={GUIDE_PHOTO[g.slug]}
        // WhatsApp under the buttons: alone in the side panel it drew an
        // empty box beside the title (the owner saw it, 2026-10-26).
        reach={<ReachRow c={c} plain={!notice} />}
      />

      {/* The short answer: three sentences, the essentials in ten seconds,
          before the long read (2026-10-26). Its own words, never lines of
          the body; no heading — a label over a list. */}
      <section className="mp-section mp-surface--paper h-short-plate" aria-label={t.shortLabel}>
        <div className="mp-shell">
          <div className="h-short">
            <p className="h-label">{t.shortLabel}</p>
            <ul className="h-short__list">
              {g.short.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* The answer, the questions and the links on: one document, laid out
          like the legal pages (the contents in a rail from 901px) but in the
          guide variant — ragged-right, one right edge, no section label. */}
      <LegalDoc
        variant="guide"
        tocLabel={c.ui.onThisPage}
        updated={<Dated label={t.reviewed} date={date} iso={guidesReviewedISO} />}
        sections={[
          ...g.sections.map((s) => ({
            h: s.title,
            body: (
              <>
                {s.paras.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {s.list ? (
                  <ul>
                    {s.list.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                ) : null}
                {/* Two counties' facts side by side from 1200px; each block
                    keeps its county on every row, its source and its date. */}
                {s.facts ? (
                  <div className={`mp-guide__factset${s.facts.length > 1 ? ' mp-guide__factset--pair' : ''}`}>
                    {s.facts.map((b) => (
                      <FactBlock key={b.service} lang={lang} block={b} c={c} />
                    ))}
                  </div>
                ) : null}
              </>
            ),
          })),
          {
            // The questions: its h2 is the guide's own faqTitle, its line in
            // the contents the plain "Questions". The first answer is open;
            // a closed one is still in the HTML (and in the FAQPage data).
            h: g.faqTitle,
            toc: t.questionsLabel,
            body: (
              <div className="mp-gfaq">
                {g.faq.map((item, i) => (
                  <details key={item.q} className="mp-gfaq__item" open={i === 0}>
                    <summary className="mp-gfaq__sum">
                      <h3 className="mp-gfaq__q">{item.q}</h3>
                      <span className="mp-gfaq__icon" aria-hidden="true" />
                    </summary>
                    <p className="mp-gfaq__a">{item.a}</p>
                  </details>
                ))}
              </div>
            ),
          },
        ]}
      >
        {/* Where to go from here: up to the program pages and the cost page,
            across to every other guide. Navigation, so no heading per link. */}
        <nav className="mp-guide__more mp-guide__more--doc" aria-labelledby="mp-guide-more">
          <h2 id="mp-guide-more" className="mp-guide__more-title">
            {t.more}
          </h2>
          <ul className="mp-guide__up">
            {leads.map((s) => (
              <li key={s.slug}>
                <Link href={l(`/services/${s.slug}`)}>{s.shortTitle}</Link>
              </li>
            ))}
            {/* The cost page prices the two county programs: a guide of
                theirs links it, a guide of another service does not. */}
            {g.programs.length ? (
              <li>
                <Link href={l(COST_PATH)}>{t.costLink}</Link>
              </li>
            ) : null}
          </ul>
          <ul className="mp-guide__across">
            {others.map((x) => (
              <li key={x.slug}>
                <Link href={l(guidePath(x.slug))}>{x.name}</Link>
              </li>
            ))}
            <li>
              <Link href={l(GUIDES_PATH)}>{t.allGuides}</Link>
            </li>
          </ul>
        </nav>
      </LegalDoc>

      {/* The service behind the guide, as the home's card: the photograph,
          the name, the ring — no line of the service's own (each sentence of
          the site has one page). No heading: a label over the cards. */}
      <section className="h-plate mp-surface--graphite h-gsvc" aria-label={t.serviceLabel}>
        <div className="h-wrap">
          <p className="h-label">{t.serviceLabel}</p>
          {/* <div>s, not a list: a card's tag and name would read as one
              list item, the same on every guide of that service. */}
          <div className="h-gsvc__grid" style={{ '--cols': String(Math.min(leads.length, 3)) } as React.CSSProperties}>
            {leads.map((s) => (
              <div key={s.slug} className="h-card h-gsvc__card">
                <Reveal fx="img" className="h-ph" style={{ '--ar': '3 / 2' } as React.CSSProperties}>
                  <div className="h-ph__in">
                    <Img photo={imagery.services[s.slug]} sizes="(min-width: 900px) 30vw, 92vw" />
                  </div>
                </Reveal>
                <div className="h-card__meta">
                  <p className="h-track">
                    <Diamond />
                    {s.track === 'new' ? c.servicesPage.tracks.new.eyebrow : c.servicesPage.tracks.existing.eyebrow}
                  </p>
                  {/* A <div>: the service's name is printed on every guide of
                      that service, and a paragraph of six words or more may
                      be on one page only (guides.test.ts). */}
                  <div className="h-card__title h-gsvc__title">
                    <Link className="h-card__link" href={l(`/services/${s.slug}`)}>
                      {s.title}
                    </Link>
                  </div>
                  <span className="h-ring" aria-hidden="true">
                    <Arrow up />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HomeContact closing lang={lang} presetService={preset} notice={notice} />
    </div>
  );
}

/**
 * /guides — the list, as a two-column index from 901px: a small photograph,
 * the county the guide covers (what a reader chooses by; the guides are not
 * a sequence, so no numbers), the name and its line. The rows come from the
 * list's length, so an eighth guide adds a row, never a third column. Then
 * why the reader's own letter counts, and the closing band.
 */
export function GuidesView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const idx = guidesIndex(lang);
  const l = (href: string) => localePath(href, lang);
  const list = getGuides(lang);
  const pageUrl = absoluteUrl(l(GUIDES_PATH));

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#page`,
    url: pageUrl,
    name: idx.seo.title,
    description: idx.seo.description,
    inLanguage: LD_LANG[lang],
    isPartOf: { '@id': WEBSITE },
    publisher: { '@id': ORGANIZATION },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: list.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: absoluteUrl(l(guidePath(g.slug))),
        name: g.h1,
      })),
    },
  };

  return (
    <div className="mp-plates mp-dark">
      <JsonLd data={ld} />
      <JsonLd
        data={breadcrumbLd(lang, [
          { name: c.ui.home, path: '/' },
          { name: idx.crumb, path: GUIDES_PATH },
        ])}
      />
      <PageHero
        eyebrow={idx.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: idx.crumb }]}
        titleLines={accentLines(idx.titleLines, idx.accentWord)}
        sub={idx.sub}
        photo={imagery.pages.guides}
      />
      {/* The list, as the home's cards (2026-10-26; the thumbnail rows went
          with the services page's): the photograph at 3/2, the county the
          guide covers as the tag, the name as the link, its line, the ring.
          Three to a row, in the guides' own order. */}
      <section className="h-plate mp-surface--graphite" aria-labelledby="mp-guides-list">
        <div className="h-wrap">
          <header className="h-head">
            <div className="h-head__top">
              <Reveal as="p" fx="up" className="h-label">
                {idx.listLabel}
              </Reveal>
            </div>
            <Reveal as="h2" fx="words" id="mp-guides-list" className="h-h2">
              <Words text={idx.listTitle} />
            </Reveal>
          </header>
          {idx.groups.map((group) => {
            const mine = list.filter((g) => group.services.includes(g.service));
            if (!mine.length) return null;
            return (
              <div key={group.label} className="h-ggroup">
                <div className="h-ggroup__head">
                  <h2 className="h-ggroup__t">{group.label}</h2>
                  <p className="h-ggroup__lede">{group.lede}</p>
                </div>
          <ol className="h-tgrid h-tgrid--guides">
            {mine.map((g) => (
              <li key={g.slug} className="h-card h-type">
                <Reveal fx="img" className="h-ph" style={{ '--ar': '3 / 2' } as React.CSSProperties}>
                  <div className="h-ph__in">
                    <Img photo={GUIDE_PHOTO[g.slug]} sizes="(min-width: 900px) 30vw, (min-width: 561px) 46vw, 92vw" />
                  </div>
                </Reveal>
                <div className="h-card__meta">
                  <p className="h-track">
                    <Diamond />
                    {g.programs.length ? g.programs.map((p) => PLACE[p][lang]).join(' · ') : PLACE['milestone-inspections'][lang]}
                  </p>
                  <h3 className="h-card__title h-type__title">
                    <Link href={l(guidePath(g.slug))} className="h-card__link">
                      {g.name}
                    </Link>
                  </h3>
                  <p className="h-card__line">{g.card}</p>
                  <span className="h-ring" aria-hidden="true">
                    <Arrow up />
                  </span>
                </div>
              </li>
            ))}
          </ol>
              </div>
            );
          })}
        </div>
      </section>
      {/* The reader's letter: what a missed date leads to, what to send (or
          the address, with no letter yet) and what follows — the title in a
          column of its own from 901px, the paragraphs beside it. */}
      <section className="mp-section mp-surface--concrete" aria-labelledby="mp-guides-how">
        <div className="mp-shell">
          <SectionHeading n="02" label={idx.howLabel} />
          <div className="mp-guides__split">
            <div>
              <h2 id="mp-guides-how" className="mp-guides__how-title">
                {idx.howTitle}
              </h2>
            </div>
            <div className="mp-prose mp-guides__how">
              {idx.how.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </section>
      <HomeContact closing lang={lang} />
    </div>
  );
}
