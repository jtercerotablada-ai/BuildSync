import React from 'react';
import Link from 'next/link';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import {
  CALCULATOR_ICON_PX,
  calculatorCount,
  calculatorFamilies,
  calculatorIcons,
  calculatorsPage,
  openCalculatorCount,
  type CalculatorFamily,
} from '@/lib/ttc/calculators';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { imagery } from '@/lib/ttc/site';
import { CalcFolds } from '@/components/ttc/mp/CalcFolds';
import { PageHero } from '@/components/ttc/mp/PageHero';

/**
 * The calculators catalogue: /resources and /es/resources.
 *
 * A LIST, for now. The owner asked for one page that will hold every
 * calculator, with all of them written down and built one at a time
 * (calculators.ts has the request and the rules). Two parts:
 *
 *   1. the hero, over a photograph like the other pages' heroes, which says
 *      how many there are and how many are open (the owner, October 21,
 *      2026: no index of the families up here — they are the ledger);
 *   2. the ledger — the families in two columns, each a block with a header
 *      row (the icon on its tile, the family's name, how many it holds) and
 *      the calculators under it as hairline rows: the name, one line on what
 *      it computes, the design standards it is planned for.
 *
 * On a phone the subjects with no open calculator start folded to their
 * header (CalcFolds), so the seventeen headers read as an index of their
 * own. Every row is in the server's HTML, open.
 *
 * The page is out of the header since October 21, 2026 (site.ts): it is
 * reached from the footer and from each calculator's breadcrumb.
 *
 * A calculator with an `href` is open: its row is in ink and its name is a
 * link to it, underlined in gold. One without is listed in a straw grey. No
 * word says "open" beside a name — the owner had it taken off (October 10,
 * 2026): the colour and the link say it. Nothing else on this page changes
 * for one to go live — the counts are counted from the list.
 *
 * Headings: one h1 and one h2 per family, never inside the summary (some
 * screen readers — VoiceOver — flatten a heading inside a summary into the
 * button's name). A calculator's name is a row of a
 * list, not a heading — there are close to a hundred of them.
 *
 * The icons are the owner's drawings (calculators.ts). Each `<img>` carries
 * a written description and is `aria-hidden`, like every photograph on the
 * site: the family's name is printed right beside it, and a screen reader
 * that read both would say everything twice.
 */
function Icons({ family, lang, className }: { family: CalculatorFamily; lang: Lang; className: string }) {
  return (
    <span className={className}>
      {family.icons.map((key) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={calculatorIcons[key].src}
          alt={calculatorIcons[key].alt[lang]}
          aria-hidden="true"
          width={CALCULATOR_ICON_PX}
          height={CALCULATOR_ICON_PX}
          loading="lazy"
          decoding="async"
        />
      ))}
    </span>
  );
}

export function CalculatorsView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const t = calculatorsPage[lang];
  const l = (href: string) => localePath(href, lang);

  return (
    <>
      <PageHero
        eyebrow={t.eyebrow}
        // Called in its breadcrumb what the menu calls it.
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabelOf(c, '/resources') }]}
        titleLines={[t.h1]}
        sub={t.sub}
        // How long the list is — counted from it, never typed.
        facts={[
          { k: t.crumb, v: String(calculatorCount) },
          { k: t.open, v: String(openCalculatorCount) },
          { k: t.families, v: String(calculatorFamilies.length) },
        ]}
        // A photograph like the other pages' heroes; the families are the
        // ledger right under it (the owner, 2026-10-21: no index up here).
        photo={imagery.pages.resources}
      />

      <section className="mp-section mp-surface--paper mp-calcledger">
        <div className="mp-shell">
          <div className="mp-calc__families">
            {calculatorFamilies.map((family) => (
              <div key={family.id} id={family.id} className="mp-calc">
                <div className="mp-calc__rail">
                  <Icons family={family} lang={lang} className="mp-calc__icons" />
                  <h2 className="mp-calc__title">{family.title[lang]}</h2>
                </div>
                {/* Open from the server. On a phone, a family with no open
                    calculator is folded after the first paint (CalcFolds);
                    its count is the toggle. */}
                <details
                  className="mp-calc__fold"
                  open
                  data-calc-fold={family.items.some((item) => item.href) ? undefined : 'planned'}
                >
                  {/* The toggle is named after its subject and its count
                      ("Welds, 3 calculators"): the h2 is outside it, and a
                      list of controls all called "3 calculators" tells a
                      screen reader nothing. A plain label, because one built
                      from the page's text takes the uppercase transform and
                      loses the space in Chrome. */}
                  <summary
                    className="mp-calc__count"
                    aria-label={`${family.title[lang]}, ${family.items.length} ${t.count}`}
                  >
                    {/* On a phone the number alone is drawn; the word stays for a screen reader.
                        The number and its space are one text node, so the space is never dropped. */}
                    <span>
                      {`${family.items.length} `}
                      <span className="mp-calc__countword">{t.count}</span>
                    </span>
                  </summary>
                  <ul className="mp-calc__list">
                    {family.items.map((item) => (
                      <li key={item.name.en} className={item.href ? 'is-open' : undefined}>
                        <span className="mp-calc__name">{item.href ? <Link href={l(item.href)}>{item.name[lang]}</Link> : item.name[lang]}</span>{' '}
                        <span className="mp-calc__does">{item.does[lang]}</span>
                        {item.codes?.length ? (
                          <>
                            {' '}
                            <span className="mp-calc__codes">
                              <span className="mp-sr-only">{t.codes}: </span>
                              {/* A designation never breaks across two lines ("AS 1720.1"),
                                  and a line never starts with the dot between two. */}
                              {item.codes.map((code) => code.replace(/ /g, ' ')).join(' · ')}
                            </span>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
          </div>
          <CalcFolds />
        </div>
      </section>
    </>
  );
}
