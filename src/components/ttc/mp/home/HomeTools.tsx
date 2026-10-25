import React from 'react';
import Link from 'next/link';
import { calculatorFamilies, openCalculatorCount } from '@/lib/ttc/calculators';
import { getContent } from '@/lib/ttc/content';
import { GUIDES_PATH, guideSlugs } from '@/lib/ttc/guides';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { withNumberWord } from '@/lib/ttc/number-words';
import { Arrow } from './glyphs';
import { Words } from './Words';

/**
 * S10 · FREE TOOLS — proof of craft that is also useful: the firm is
 * engineers first. Two full-width rows, each a big numeral, a title with one
 * line under it, and an arrow ring:
 *
 *   09   Nine free engineering calculators   → /resources
 *        (the names of the open ones, with gold dots between them)
 *   07   Seven guides for building owners    → /guides
 *        In plain words, in English and in Spanish.
 *
 * NOTHING IS TYPED. Each numeral is a count the site already keeps — the open
 * calculators (`openCalculatorCount`) and the guides (`guideSlugs.length`) —
 * zero-padded; each number WORD in a title comes from `withNumberWord`
 * (lib/ttc/number-words.ts) out of the template in `home.tools`; the names
 * are the open entries of `calculatorFamilies`, in catalogue order, in the
 * page's language. Opening a tenth calculator changes this page by itself
 * (views/home.test.ts keeps the word equal to the numeral and fails past
 * twelve, which is the reminder to add the next word).
 *
 * THE LINK IS THE TITLE and the whole row is the target (the pattern of the
 * building-types cards): the <a> holds the title alone and its `::after`
 * covers the row, so a link's text is a name — the list of names beside it
 * would be a paragraph (pages.test.ts: no internal link reads out more than
 * 120 characters). The numeral and the ring are `aria-hidden`; the rows are
 * not headings.
 *
 * Read by a SERVER component only: `calculators.ts` must not reach the
 * client bundle (its banner says so).
 */
export function HomeTools({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const h = c.home.tools;

  const calcCount = openCalculatorCount;
  const guideCount = guideSlugs.length;
  const names = calculatorFamilies
    .flatMap((family) => family.items)
    .filter((item) => item.href)
    .map((item) => item.name[lang]);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section id="tools" className="h-plate h-tools mp-surface--graphite" aria-labelledby="h-tools-h">
      <div className="mp-grid-bg" aria-hidden="true" />
      <div className="h-wrap">
        <p className="h-label">{h.label}</p>
        {/* MOTION HOOK: the words rise out of their masks (E8) —
            `data-fx="words"`. */}
        <h2 id="h-tools-h" className="h-h2 h-tools__h" data-fx="words">
          <Words text={h.title} accent={h.accentWord} />
        </h2>

        {/* MOTION HOOK: the rows slide in from the left, 0.2 s apart (E10) —
            `data-fx="left"` on each. */}
        <ul className="h-tools__list">
          <li className="h-tools__row" data-fx="left">
            <span className="h-tools__num" aria-hidden="true">
              {pad(calcCount)}
            </span>
            <div className="h-tools__body">
              <p className="h-tools__title">
                <Link href={localePath('/resources', lang)} className="h-tools__link">
                  {withNumberWord(h.calc.title, calcCount, lang)}
                </Link>
              </p>
              <ul className="h-tools__names" role="list">
                {names.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
            <span className="h-ring h-tools__go" aria-hidden="true">
              <Arrow up />
            </span>
          </li>

          <li className="h-tools__row" data-fx="left">
            <span className="h-tools__num" aria-hidden="true">
              {pad(guideCount)}
            </span>
            <div className="h-tools__body">
              <p className="h-tools__title">
                <Link href={localePath(GUIDES_PATH, lang)} className="h-tools__link">
                  {withNumberWord(h.guides.title, guideCount, lang)}
                </Link>
              </p>
              <p className="h-tools__line">{h.guides.line}</p>
            </div>
            <span className="h-ring h-tools__go" aria-hidden="true">
              <Arrow up />
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
