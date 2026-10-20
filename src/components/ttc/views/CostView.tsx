import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { absoluteUrl } from '@/lib/ttc/site';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { COST_PATH, costPage } from '@/lib/ttc/cost-page';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactCTA } from '@/components/ttc/mp/ContactCTA';
import { Reveal, SectionHeading, TextLink } from '@/components/ttc/mp/primitives';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

/**
 * /services/recertification-cost — what a recertification or a BSIP
 * inspection costs, for the owners who search for the price first.
 *
 *   01  The fee          the two counties' fixed-fee ranges, side by side,
 *                        with what the fee covers and what it does not
 *   02  What moves it    six factors
 *   03  Outside the fee  repairs, the offices' own fees, late penalties
 *   04  Pay less         five things an owner can do
 *   05  Questions        six answers, also as FAQPage data
 *   06  Contact
 *
 * The ranges are `pricing.programs` (site.ts / site.es.ts) — the rows the
 * home page prints — so a price is typed once. Each county stays in its own
 * table. The structured data adds one AggregateOffer per county, read from
 * the same rows, and the FAQPage of the questions printed below.
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
        eyebrow={k.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { href: '/services', label: servicesLabel }, { label: k.crumb }]}
        titleLines={accentLines(k.titleLines, k.accentWord)}
        sub={k.sub}
        actions={[{ href: '/contact', label: k.tables.cta, variant: 'solid' }]}
      />

      {/* 01 — the two tables */}
      <section className="mp-section mp-section--lg mp-surface--paper mp-cost" aria-labelledby="mp-costp-fee">
        <div className="mp-shell">
          <SectionHeading n="01" label={k.tables.label} />
          <div className="mp-intro">
            <Reveal>
              <h2 id="mp-costp-fee" className="mp-intro__title">
                {k.tables.title}
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="mp-intro__lede">{k.tables.lede}</p>
            </Reveal>
          </div>
          <p className="mp-costp__reviewed">{k.reviewed}</p>

          <div className="mp-cost__cards">
            {programs.map((p) => (
              <div key={p.id} className="mp-cost__card">
                <h3 id={`costp-${p.id}`} className="mp-cost__name">
                  {p.name}
                </h3>
                <dl className="mp-cost__tiers" aria-labelledby={`costp-${p.id}`}>
                  {p.tiers.map((t) => (
                    <div key={t.size}>
                      <dt>{t.size}</dt>
                      <dd>{t.price}</dd>
                    </div>
                  ))}
                </dl>
                {p.service ? (
                  <TextLink href={localePath(`/services/${p.slug}`, lang)}>{k.programLink(p.service.title)}</TextLink>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mp-cost__note">{k.tables.note}</p>

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
              <h3 className="mp-cost__h">{pr.excludesTitle}</h3>
              <ul className="mp-cost__list">
                {pr.excludes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 02 — what moves the price */}
      <section className="mp-section mp-surface--concrete mp-cost" aria-labelledby="mp-costp-factors">
        <div className="mp-shell">
          <SectionHeading n="02" label={k.factors.label} />
          <div className="mp-intro">
            <Reveal>
              <h2 id="mp-costp-factors" className="mp-intro__title">
                {k.factors.title}
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="mp-intro__lede">{k.factors.lede}</p>
            </Reveal>
          </div>
          <ol className="mp-costp__grid">
            {k.factors.items.map((it, i) => (
              <li key={it.k}>
                <span className="mp-secnum" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3>{it.k}</h3>
                <p>{it.v}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 03 — outside the fee, and 04 — pay less */}
      <section className="mp-section mp-surface--paper mp-cost" aria-labelledby="mp-costp-outside">
        <div className="mp-shell">
          <SectionHeading n="03" label={k.outside.label} />
          <div className="mp-cost__urgent-grid">
            <div>
              <h2 id="mp-costp-outside" className="mp-h3 mp-costp__h2">
                {k.outside.title}
              </h2>
              <ul className="mp-cost__risks">
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
            <div>
              <SectionHeading n="04" label={k.save.label} />
              <h2 className="mp-h3 mp-costp__h2">{k.save.title}</h2>
              <ol className="mp-cost__steps">
                {k.save.items.map((t, i) => (
                  <li key={t}>
                    <span className="mp-secnum">{String(i + 1).padStart(2, '0')}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* 05 — questions */}
      <section className="mp-section mp-surface--paper" aria-labelledby="mp-costp-faq">
        <div className="mp-shell">
          <SectionHeading n="05" label={k.faq.label} />
          <Reveal>
            <h2 id="mp-costp-faq" className="mp-intro__title">
              {k.faq.title}
            </h2>
          </Reveal>
          <div className="mp-faq">
            {k.faq.items.map((item) => (
              <div key={item.q} className="mp-faq__item">
                <h3 className="mp-faq__q">{item.q}</h3>
                <p className="mp-faq__a">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ContactCTA />
    </>
  );
}
