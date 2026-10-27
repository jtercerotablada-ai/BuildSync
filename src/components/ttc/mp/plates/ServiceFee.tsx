import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { COST_PATH } from '@/lib/ttc/cost-path';
import { ButtonLink, Reveal, TextLink } from '../primitives';
import { keepHyphens } from '../text';

/**
 * The fee, on the two county programs (2026-10-27, the owner: "vendedor"):
 * three figures on the clock's gold hairline — the starting price, the days
 * to the signed package, the free proposal — then one line, the link to the
 * prices by building size, and the page's button.
 *
 * Nothing is typed here: the price is the first tier of `pricing` (the cost
 * page's table prints the same tier), the days are the owner's
 * (`pricing.delivery`), the words around them are `serviceLook.fee`. The
 * link to the cost page lived beside the timing rows until now; it is
 * printed here, once. No heading (the page sits at its ceiling of 23); the
 * band is named by its label. Its button stands alone: WhatsApp is beside
 * the hero's and the deadline's buttons only (pages.test.ts counts two).
 *
 * The figures share the clock's look (dark.css, `.h-clock`); the clock's
 * test reads `serviceClock`, never this band.
 *
 * A SERVER component.
 */
export function ServiceFee({
  lang,
  slug,
  href,
  cta,
  surface,
}: {
  lang: Lang;
  slug: string;
  href: string;
  cta: string;
  /** The page's next surface, so the bands around it still alternate. */
  surface: string;
}) {
  const c = getContent(lang);
  const program = c.pricing.programs.find((p) => p.slug === slug);
  if (!program) return null;
  const f = c.serviceLook.fee;
  const first = program.tiers[0];
  // "From $2,500" / "Desde $2,500": the word, then the figure.
  const [, from = '', figure = first.price] = first.price.match(/^(\D+?)\s+(\$.+)$/) ?? [];

  return (
    <section className={`h-plate ${surface} h-clock h-fee`} aria-label={f.label}>
      <div className="h-wrap">
        <Reveal as="p" fx="up" className="h-label">
          {f.label}
        </Reveal>
        <ol className="h-clock__line h-fee__figs">
          <Reveal as="li" fx="up" className="h-clock__item">
            <p className="h-clock__n">
              {from ? <span className="h-clock__unit mp-serif">{from}</span> : null}{' '}
              <span className="h-clock__num">{figure}</span>
            </p>
            <p className="h-clock__k">{f.fixed}</p>
            <p className="h-clock__sub">{first.size}</p>
          </Reveal>
          <Reveal as="li" fx="up" delay={0.08} className="h-clock__item">
            <p className="h-clock__n">
              <span className="h-clock__num">{f.days.n}</span>{' '}
              <span className="h-clock__unit mp-serif">{f.days.unit}</span>
            </p>
            <p className="h-clock__k">{f.days.k.replace('{name}', program.name)}</p>
            <p className="h-clock__sub">{f.days.sub}</p>
          </Reveal>
          <Reveal as="li" fx="up" delay={0.16} className="h-clock__item">
            <p className="h-clock__n">
              <span className="h-clock__num">{f.free.n}</span>
            </p>
            <p className="h-clock__k">{f.free.k}</p>
          </Reveal>
        </ol>
        <Reveal fx="up" className="h-fee__foot">
          <p className="h-fee__text">{f.line.replace('{name}', program.name)}</p>
          <div className="h-fee__act">
            <ButtonLink href={localePath(href, lang)} variant="solid">
              {cta}
            </ButtonLink>
            {/* One <span> around the words: the link is an inline flex row,
                and the pieces keepHyphens returns were each a flex item of it. */}
            <TextLink href={localePath(COST_PATH, lang)}>
              <span>{keepHyphens(c.pricing.pageLink.replace('{name}', program.name))}</span>
            </TextLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
