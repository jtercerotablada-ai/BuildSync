import React from 'react';
import Link from 'next/link';
import { getContent, type SiteContent } from '@/lib/ttc/content';
import { absoluteUrl, regulatoryCheckedISO } from '@/lib/ttc/site';
import { COST_PATH } from '@/lib/ttc/cost-path';
import { GUIDES_PATH, guidePath, guidesReviewed, guidesReviewedISO, type GuideFacts } from '@/lib/ttc/guides';
import { findGuide, getGuides, guideLabels, guidesIndex } from '@/lib/ttc/guide-content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { LD_LANG, ORGANIZATION, WEBSITE } from '@/lib/ttc/structured-data';
import { photo, type Photo } from '@/lib/ttc/media';
import { Img } from '@/components/ttc/mp/media';
import { LegalDoc } from '@/components/ttc/mp/LegalDoc';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { EngineerCredential } from '@/components/ttc/mp/EngineerCredential';
import { ReachRow } from '@/components/ttc/mp/ReachRow';
import { Dated, Source } from '@/components/ttc/mp/Outbound';
import { accentLines } from '@/components/ttc/mp/text';
import { Reveal, SectionHeading } from '@/components/ttc/mp/primitives';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * One guide: /guides/<slug> (guides.ts).
 *
 *   hero       the question as the H1, the program's button, the engineer
 *   01 guide   the answer: h2 sections, each with paragraphs, a list, and
 *              the county facts it needs — read from the program's verified
 *              timing row, with the row's authority and date, never typed
 *   02 questions  one h3 per question, also as FAQPage data
 *   03 keep reading  the program page(s), the cost page, the other guides
 *   04 contact
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
  const own = c.services.find((s) => s.slug === g.programs[0])!;
  const pageUrl = absoluteUrl(l(guidePath(g.slug)));
  const others = getGuides(lang).filter((x) => x.slug !== g.slug);
  const date = guidesReviewed[lang];

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: g.h1,
        description: g.seo.description,
        url: pageUrl,
        mainEntityOfPage: pageUrl,
        inLanguage: LD_LANG[lang],
        datePublished: guidesReviewedISO,
        dateModified: guidesReviewedISO,
        author: { '@id': ORGANIZATION },
        publisher: { '@id': ORGANIZATION },
        isPartOf: { '@id': WEBSITE },
        about: g.programs.map((p) => ({ '@id': `${absoluteUrl(l(`/services/${p}`))}#service` })),
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
    <>
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
        actions={[{ href: `/contact?service=${own.slug}`, label: own.program!.cta, variant: 'solid' }]}
        photo={GUIDE_PHOTO[g.slug]}
      >
        <EngineerCredential lang={lang} brief />
        <ReachRow c={c} />
      </PageHero>

      {/* 01 — the answer, laid out like the legal pages: the contents in a
          column of their own from 901px, the sections beside them. */}
      <LegalDoc
        label={t.eyebrow}
        tocLabel={c.ui.onThisPage}
        updated={<Dated label={t.reviewed} date={date} iso={guidesReviewedISO} />}
        sections={g.sections.map((s) => ({
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
              {s.facts?.map((b) => <FactBlock key={b.service} lang={lang} block={b} c={c} />)}
            </>
          ),
        }))}
      />

      {/* 02 — questions */}
      <section className="mp-section mp-surface--concrete" aria-labelledby="mp-guide-faq">
        <div className="mp-shell">
          <SectionHeading n="02" label={t.questionsLabel} />
          <Reveal>
            <h2 id="mp-guide-faq" className="mp-intro__title">
              {g.faqTitle}
            </h2>
          </Reveal>
          <div className="mp-faq">
            {g.faq.map((item) => (
              <div key={item.q} className="mp-faq__item">
                <h3 className="mp-faq__q">{item.q}</h3>
                <p className="mp-faq__a">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 03 — keep reading: up to the program pages and the cost page, across
          to the other guides. Navigation, so no heading per link. */}
      <section className="mp-section mp-surface--paper" aria-labelledby="mp-guide-more">
        <div className="mp-shell">
          <SectionHeading n="03" label={t.moreLabel} />
          <h2 id="mp-guide-more" className="mp-intro__title">
            {t.more}
          </h2>
          <nav className="mp-guide__more" aria-labelledby="mp-guide-more">
            <ul className="mp-guide__up">
              {g.programs.map((p) => {
                const s = c.services.find((x) => x.slug === p)!;
                return (
                  <li key={p}>
                    <Link href={l(`/services/${p}`)}>{s.shortTitle}</Link>
                  </li>
                );
              })}
              <li>
                <Link href={l(COST_PATH)}>{t.costLink}</Link>
              </li>
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
        </div>
      </section>

      <ContactCTA n="04" service={own.slug} />
    </>
  );
}

/** /guides — the list. */
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
    <>
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
      />
      <section className="mp-section mp-surface--paper" aria-labelledby="mp-guides-list">
        <div className="mp-shell">
          <SectionHeading n="01" label={idx.listLabel} />
          <h2 id="mp-guides-list" className="mp-intro__title">
            {idx.listTitle}
          </h2>
          <ol className="mp-guides">
            {list.map((g, i) => (
              <li key={g.slug}>
                <div className="mp-guides__photo">
                  <Img photo={GUIDE_PHOTO[g.slug]} sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw" />
                </div>
                <span className="mp-secnum" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3>
                  <Link href={l(guidePath(g.slug))}>{g.name}</Link>
                </h3>
                <p>{g.card}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="mp-section mp-surface--concrete" aria-labelledby="mp-guides-how">
        <div className="mp-shell">
          <SectionHeading n="02" label={idx.listLabel} />
          <h2 id="mp-guides-how" className="mp-intro__title">
            {idx.howTitle}
          </h2>
          <div className="mp-prose mp-guides__how">
            {idx.how.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>
      <ContactCTA n="03" />
    </>
  );
}
