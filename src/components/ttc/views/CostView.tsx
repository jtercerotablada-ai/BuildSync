import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { absoluteUrl, imagery } from '@/lib/ttc/site';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { COST_PATH, costPage } from '@/lib/ttc/cost-page';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { Reveal, SectionHeading, TextLink } from '@/components/ttc/mp/primitives';
import { accentLines, keepHyphens } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * /services/recertification-cost — what a recertification or a BSIP
 * inspection costs, for the owners who search for the price first.
 *
 *   hero            each county's starting price beside the title, so the
 *                   answer is on the first screen
 *   01  The fee     both counties in one table (the home page's), then what
 *                   the fee covers beside what it does not
 *   02  What moves  six factors in one table, each with the one thing an
 *       the price   owner can do about it
 *   03  Questions   seven answers, each a disclosure with its text in the
 *                   HTML, also as FAQPage data
 *   closing band
 *
 * The ranges are `pricing.programs` (site.ts / site.es.ts) — the rows the
 * home page prints, in the same table — so a price is typed once. Each
 * county keeps its own column. The structured data adds one AggregateOffer
 * per county, read from the same rows, and the FAQPage of the questions
 * printed below. The layout is mp.css section 22; the price table, the
 * split section header and the scope lists are section 20's.
 */
const dollars = (s: string) => [...s.matchAll(/\$([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));

export function CostView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const k = costPage(lang);
  const pr = c.pricing;
  const servicesLabel = navLabelOf(c, '/services');
  const pageUrl = absoluteUrl(localePath(COST_PATH, lang));

  const programs = pr.programs.map((p) => {
    const service = c.services.find((s) => s.slug === p.slug);
    const all = p.tiers.flatMap((t) => dollars(t.price));
    return { ...p, service, low: Math.min(...all), high: Math.max(...all) };
  });
  // Both counties price the same four sizes (`programs.test.ts` holds the
  // labels equal), so one column of sizes serves the two columns of prices.
  const sizes = programs[0].tiers.map((t) => t.size);

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#page`,
        url: pageUrl,
        name: k.seo.title,
        description: k.seo.description,
        inLanguage: lang === 'es' ? 'es-US' : 'en-US',
        about: programs.map((p) => ({ '@id': `${absoluteUrl(localePath(`/services/${p.slug}`, lang))}#service` })),
      },
      ...programs.map((p) => ({
        '@type': 'AggregateOffer',
        '@id': `${pageUrl}#${p.id}`,
        name: p.name,
        priceCurrency: 'USD',
        lowPrice: p.low,
        highPrice: p.high,
        offerCount: p.tiers.length,
        itemOffered: { '@id': `${absoluteUrl(localePath(`/services/${p.slug}`, lang))}#service` },
        url: pageUrl,
      })),
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        url: pageUrl,
        inLanguage: lang === 'es' ? 'es-US' : 'en-US',
        mainEntity: k.faq.items.map((item) => ({
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
          { name: servicesLabel, path: '/services' },
          { name: k.crumb, path: COST_PATH },
        ])}
      />

      <PageHero
        photo={imagery.pages.cost}
        eyebrow={k.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { href: '/services', label: servicesLabel }, { label: k.crumb }]}
        titleLines={accentLines(k.titleLines, k.accentWord)}
        sub={k.sub}
        actions={[{ href: '/contact', label: k.tables.cta, variant: 'solid' }]}
        // The answer a searcher came for, on the first screen: each county's
        // starting price, read from the first row of its ranges (cost.test
        // holds that row to a "From" figure).
        facts={programs.map((p) => ({ k: p.name, v: p.tiers[0].price }))}
      />

      {/* 01 — the fee: one table, then what it covers and what it does not */}
      <section className="mp-section mp-surface--paper mp-costp" aria-labelledby="mp-costp-fee">
        <div className="mp-shell">
          <SectionHeading n="01" label={k.tables.label} />
          <div className="mp-hsec__head">
            <Reveal>
              <h2 id="mp-costp-fee" className="mp-hsec__title">
                {k.tables.title}
              </h2>
            </Reveal>
            <Reveal delay={0.06} className="mp-hsec__aside">
              <p className="mp-hsec__lede">{k.tables.lede}</p>
              <p className="mp-costp__reviewed">{k.reviewed}</p>
            </Reveal>
          </div>

          {/* Not behind a Reveal: the prices are the page's answer and must
              not wait for the script. */}
          <div className="mp-cost__tablewrap">
            <table className="mp-cost__table" aria-labelledby="mp-costp-fee">
              <thead>
                <tr>
                  <th scope="col">{pr.sizeLabel}</th>
                  {programs.map((p) => (
                    <th key={p.id} id={`costp-${p.id}`} scope="col">
                      {keepHyphens(p.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizes.map((size, i) => (
                  <tr key={size}>
                    <th scope="row">{size}</th>
                    {programs.map((p) => (
                      // On a phone the header row is hidden: each price
                      // carries its county alone ("Broward"), as on the home.
                      <td key={p.id} data-label={p.service?.program?.county ?? p.name}>
                        {p.tiers[i].price}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {/* Each county's link under its own column. */}
              <tfoot className="mp-costp__links">
                <tr>
                  <td aria-hidden="true" />
                  {programs.map((p) => (
                    <td key={p.id}>
                      {p.service ? (
                        <TextLink href={localePath(`/services/${p.slug}`, lang)}>{k.programLink(p.service.title)}</TextLink>
                      ) : null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mp-cost__scope">
            <div>
              <h3 className="mp-cost__h">{pr.includesTitle}</h3>
              <ul className="mp-cost__list mp-cost__list--yes">
                {pr.includes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mp-cost__h">{k.outside.label}</h3>
              <ul className="mp-costp__out">
                {k.outside.items.map((it) => (
                  <li key={it.k}>
                    <strong>{it.k}</strong>
                    <span>{it.v}</span>
                  </li>
                ))}
              </ul>
              <p className="mp-costp__late">
                {/* What waiting costs opens each county's column on the home
                    page (there is no #urgency section any more). */}
                <TextLink href={`${localePath('/', lang)}#miami-dade`}>{k.outside.lateLink}</TextLink>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 02 — what moves the price, and what lowers it */}
      <section className="mp-section mp-surface--concrete mp-costp" aria-labelledby="mp-costp-factors">
        <div className="mp-shell">
          <SectionHeading n="02" label={k.factors.label} />
          <div className="mp-hsec__head">
            <Reveal>
              <h2 id="mp-costp-factors" className="mp-hsec__title">
                {k.factors.title}
              </h2>
            </Reveal>
            <Reveal delay={0.06} className="mp-hsec__aside">
              <p className="mp-hsec__lede">{k.factors.lede}</p>
              <p className="mp-costp__tip">{k.save.first}</p>
            </Reveal>
          </div>
          <table className="mp-costp__table" aria-labelledby="mp-costp-factors">
            <thead>
              <tr>
                <th scope="col" colSpan={2}>
                  {k.factors.head}
                </th>
                <th scope="col">{k.save.label}</th>
              </tr>
            </thead>
            <tbody>
              {k.factors.items.map((it) => (
                <tr key={it.k}>
                  <th scope="row">{it.k}</th>
                  <td className="mp-costp__why">{it.v}</td>
                  {it.save ? (
                    // The header row is hidden on a phone: the action keeps
                    // its column's name in `data-label`.
                    <td className="mp-costp__do" data-label={k.save.label}>
                      {it.save}
                    </td>
                  ) : (
                    <td className="mp-costp__none">
                      <span aria-hidden="true">—</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 03 — questions: the title beside them, each answer one tap away and
          in the HTML (never mounted later: the search engines and the H1
          test read it there) */}
      <section className="mp-section mp-surface--paper mp-costp" aria-labelledby="mp-costp-faq">
        <div className="mp-shell">
          <SectionHeading n="03" label={k.faq.label} />
          <div className="mp-costp__split">
            <Reveal>
              <h2 id="mp-costp-faq" className="mp-hsec__title">
                {k.faq.title}
              </h2>
            </Reveal>
            <div>
              {k.faq.items.map((item) => (
                <details key={item.q} className="mp-costp__qa">
                  <summary>
                    <h3 className="mp-faq__q">{item.q}</h3>
                    <span className="mp-costp__icon" aria-hidden="true" />
                  </summary>
                  <p className="mp-faq__a">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ContactCTA />
    </>
  );
}
