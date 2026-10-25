import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { photo, type Photo } from '@/lib/ttc/media';
import { Img } from '../media';
import { Reveal } from '../primitives';
import { Arrow } from './glyphs';
import { Words } from './Words';
import { TypesRail } from './TypesRail';

/**
 * S6 · BUILDING TYPES — the kinds of building the firm engineers, honestly
 * labelled as illustrations (it replaces the named-project portfolio the
 * firm cannot have).
 *
 * A SERVER COMPONENT: static markup for a native horizontal scroller. It
 * scrolls with a trackpad, a finger, the arrow keys (the region is
 * focusable) and shift + wheel, with no script at all. A later slice adds the
 * client island (`TypesRail`: prev / next buttons, mouse drag, the progress
 * bar and the counter); every spot it hooks into is marked MOTION HOOK.
 *
 * SIX CARDS. The first five are `typologies[0..4]`, so their titles and links
 * are the ones /services prints; the sixth is new — "Repair design for
 * existing structures", with the spare photograph `midriseBalconies` — and
 * not "Repairs to existing structures" over the worker with a trowel, which
 * would read as the firm doing the repairs. The trowel photograph
 * (`repairSoffitTrowel`) is not used on the home page.
 *
 * EACH PHOTOGRAPH IS AN ILLUSTRATION OF A TYPE, NEVER A PROJECT. The tag in
 * the head says so, and each card's mono caption is the photograph's own
 * written description (`photo.alt` / `altEs`): honest, and the description
 * the `aria-hidden` image no longer speaks for a screen reader.
 *
 * THE LINK IS THE TITLE AND THE WHOLE CARD IS THE TARGET (the pattern of
 * Typologies.tsx): the <a> holds the title alone; its `::after` is stretched
 * over the card in home-lower.css, so the link text is a name and never a
 * paragraph. Nothing else in a card may become a link. The cards are not
 * headings: the home page's outline has no h3 here.
 */
export function HomeTypes({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const h = c.home.types;

  const cards: { title: string; href: string; photo: Photo }[] = [
    ...c.typologies.slice(0, 5).map((t) => ({ title: t.title, href: t.href, photo: t.photo })),
    { title: h.sixth.title, href: '/existing-buildings', photo: photo.midriseBalconies },
  ];
  /* "06": how many cards there are, zero-padded — counted, never typed. */
  const total = String(cards.length).padStart(2, '0');

  return (
    <section className="h-plate h-types mp-surface--graphite" aria-labelledby="h-types-h">
      <div className="mp-grid-bg" aria-hidden="true" />
      <div className="h-wrap h-types__head">
        <div className="h-head__top">
          <Reveal as="p" fx="up" className="h-label">
            {h.label}
          </Reveal>
          <div className="h-types__aside">
            <p className="h-tag">{h.tag}</p>
            {/* The island: the two ring buttons (aria-labels `home.types.prev`
                / `.next`), once the script has run; the container is empty,
                and hidden, before it and without it. */}
            <TypesRail prev={h.prev} next={h.next} />
          </div>
        </div>
        <Reveal as="h2" fx="words" id="h-types-h" className="h-h2 h-h2--m h-types__h">
          <Words text={h.title} accent={h.accentWord} />
        </Reveal>
      </div>

      {/* The scroller. `role="region"` + `tabIndex={0}`: a keyboard user can
          focus it and scroll it with the arrow keys, which is what a focused
          scrollable region does natively.
          MOTION HOOK: `TypesRail` reads this element (`data-motion="rail"`)
          for drag, the prev / next step and the progress. */}
      <div className="h-types__rail" role="region" aria-label={h.region} tabIndex={0} data-motion="rail">
        <ul className="h-types__list">
          {cards.map((card) => (
            <li key={card.title} className="h-types__card" data-motion="rail-card">
              {/* The photograph reveals from its foot while it settles (E12). */}
              <Reveal fx="img" className="h-ph h-types__ph">
                <div className="h-ph__in">
                  <Img photo={card.photo} sizes="(min-width: 900px) 27vw, 76vw" />
                </div>
              </Reveal>
              <p className="h-types__cap">{lang === 'es' ? card.photo.altEs : card.photo.alt}</p>
              <p className="h-types__t">
                <Link href={localePath(card.href, lang)} className="h-types__link">
                  {card.title}
                </Link>
                <span className="h-ring" aria-hidden="true">
                  <Arrow up />
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* MOTION HOOK: `TypesRail` writes the counter ("02 / 06") from the
          card nearest the left edge and scales the bar to the visible
          fraction + position. Static: the first card, a third in view. */}
      <div className="h-types__foot" aria-hidden="true">
        <span className="h-types__count" data-motion="rail-count">
          {`01 / ${total}`}
        </span>
        <span className="h-types__bar">
          <i data-motion="rail-bar" />
        </span>
      </div>
    </section>
  );
}
