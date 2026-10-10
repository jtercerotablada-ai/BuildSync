import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import {
  CALCULATOR_ICON_PX,
  calculatorCount,
  calculatorFamilies,
  calculatorIcons,
  calculatorsPage,
  type CalculatorFamily,
} from '@/lib/ttc/calculators';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';

/**
 * The calculators catalogue: /resources and /es/resources.
 *
 * A LIST, for now. The owner asked for one page that will hold every
 * calculator, with all of them written down and none built yet
 * (calculators.ts has the request and the rules). Three parts:
 *
 *   1. the hero, whose first line says that none of them is open;
 *   2. the index — the families as a grid of his icons on the graphite of
 *      the hero, each a link to its family further down;
 *   3. the ledger — one block per family: the icon and the family's name on
 *      a rail, and beside it the calculators as hairline rows (the name, one
 *      line on what it computes, the design standards it is planned for).
 *
 * The day a calculator has an `href`, its name becomes a link — nothing
 * else on this page needs to change for one to go live.
 *
 * Headings: one h1 and one h2 per family. A calculator's name is a row of a
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
        crumbs={[{ href: '/', label: c.ui.home }, { label: t.crumb }]}
        titleLines={[t.h1]}
        sub={t.sub}
        // How long the list is — counted from it, never typed.
        facts={[
          { k: t.crumb, v: `${calculatorCount} ${t.planned}` },
          { k: t.families, v: String(calculatorFamilies.length) },
        ]}
      />

      <nav className="mp-calcnav mp-surface--graphite" aria-label={t.index}>
        <div className="mp-shell">
          <ul className="mp-calcnav__list">
            {calculatorFamilies.map((family) => (
              // Two drawings need the width of two cells on a phone (mp.css).
              <li key={family.id} className={family.icons.length > 1 ? 'mp-calcnav__wide' : undefined}>
                <a href={`#${family.id}`}>
                  <Icons family={family} lang={lang} className="mp-calcnav__icons" />
                  <span className="mp-calcnav__name">{family.title[lang]}</span>
                  {/* The family's own block says how many, in words. */}
                  <span className="mp-calcnav__n" aria-hidden="true">
                    {family.items.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          {calculatorFamilies.map((family) => (
            <div key={family.id} id={family.id} className="mp-calc">
              <div className="mp-calc__rail">
                <Icons family={family} lang={lang} className="mp-calc__icons" />
                <h2 className="mp-calc__title">{family.title[lang]}</h2>
                <p className="mp-calc__count">
                  {family.items.length} {t.planned}
                </p>
              </div>
              <ul className="mp-calc__list">
                {family.items.map((item) => (
                  <li key={item.name.en}>
                    <span className="mp-calc__name">
                      {item.href ? <Link href={l(item.href)}>{item.name[lang]}</Link> : item.name[lang]}
                    </span>{' '}
                    <span className="mp-calc__does">{item.does[lang]}</span>
                    {item.codes?.length ? (
                      <>
                        {' '}
                        <span className="mp-calc__codes">
                          <span className="mp-sr-only">{t.codes}: </span>
                          {item.codes.join(' · ')}
                        </span>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="mp-calc__note">{t.note}</p>
        </div>
      </section>
    </>
  );
}
