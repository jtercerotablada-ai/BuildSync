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
import { PageHero, type HeroAction } from '@/components/ttc/mp/PageHero';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { EngineerCredential } from '@/components/ttc/mp/EngineerCredential';
import { ReachRow } from '@/components/ttc/mp/ReachRow';
import { Dated, Source } from '@/components/ttc/mp/Outbound';
import { accentLines } from '@/components/ttc/mp/text';
import { SectionHeading } from '@/components/ttc/mp/primitives';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * One guide: /guides/<slug> (guides.ts). One reading column, then the way out:
 *
 *   hero     the question as the H1; one button per county program, each
 *            opening the form for its own county (or, for the reader with
 *            no letter yet, one button with no preset, and WhatsApp without
 *            "Send the notice" here and in the closing band); Call and
 *            WhatsApp; the engineer's credential last, after the actions
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
 *   contact  the closing band, with the program preset only when the guide
 *            has one program (a two-county guide's reader picks the county
 *            on the form, as on /existing-buildings)
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
  // The reader with no letter yet (`heroAction: 'address'`) is never asked
  // to send a notice: under "Send the Address", WhatsApp is the plain
  // "Message us" (and the chat opens without "I received a notice"), in the
  // hero and in the closing band alike.
  const notice = g.heroAction !== 'address';
  // One button per program, each with its own county preselected: under a
  // lede that says "in Miami-Dade or in Broward", a lone Miami-Dade button
  // sent Broward boards to a form set to Miami-Dade. Both solid — neither
  // county is the secondary choice (the /existing-buildings pattern).
  const heroActions: HeroAction[] =
    g.heroAction === 'address'
      ? [{ href: '/contact', label: t.addressCta, variant: 'solid' }]
      : g.programs.map((p) => ({
          href: `/contact?service=${p}`,
          label: c.services.find((s) => s.slug === p)!.program!.cta,
          variant: 'solid' as const,
        }));

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
        actions={heroActions}
        photo={GUIDE_PHOTO[g.slug]}
      >
        {/* The actions first (the buttons, then Call and WhatsApp), the
            credential after them: it used to sit between the button and
            the two links. */}
        <ReachRow c={c} plain={!notice} />
        <EngineerCredential lang={lang} brief />
      </PageHero>

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
      </LegalDoc>

      <ContactCTA service={g.programs.length === 1 ? own.slug : undefined} notice={notice} />
    </>
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
  const rows = Math.ceil(list.length / 2);

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
          <ol
            className="mp-guides mp-guides--index"
            style={{ '--mp-guides-rows': String(rows) } as React.CSSProperties}
          >
            {list.map((g, i) => (
              <li key={g.slug} className={i === rows ? 'mp-guides__col2' : undefined}>
                <div className="mp-guides__photo">
                  <Img photo={GUIDE_PHOTO[g.slug]} sizes="(max-width: 900px) 6rem, 10rem" />
                </div>
                <span className="mp-guides__where">{g.programs.map((p) => PLACE[p][lang]).join(' · ')}</span>
                <h3>
                  <Link href={l(guidePath(g.slug))}>{g.name}</Link>
                </h3>
                <p>{g.card}</p>
              </li>
            ))}
          </ol>
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
      <ContactCTA />
    </>
  );
}
