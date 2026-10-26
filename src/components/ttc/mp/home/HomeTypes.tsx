import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { photo, type Photo } from '@/lib/ttc/media';
import { Img } from '../media';
import { Reveal } from '../primitives';
import { Arrow } from './glyphs';
import { Words } from './Words';
import { TypesDrift } from './TypesDrift';

/**
 * S6 · BUILDING TYPES — the kinds of building the firm engineers, honestly
 * labelled as illustrations (it replaces the named-project portfolio the
 * firm cannot have).
 *
 * A BAND THAT DRIFTS, endlessly, from right to left (the owner, 2026-10-25:
 * "que se mueva al suave infinitamente de derecha a izquierda"). The six
 * cards are printed TWICE, one set after the other; a CSS keyframe
 * (home-lower.css §01) moves the track one set to the left and starts again,
 * so the join is never seen. The second set is `aria-hidden`: a screen reader
 * meets each card once. The pointer over the band holds it, the page's pause
 * switch holds it (`TypesDrift`, the one script here, writes `data-paused`),
 * and under reduced motion it does not move: the first set alone, as a
 * native horizontal scroller.
 *
 * THE CARDS' LINKS ARE NOT IN THE TAB ORDER (`tabIndex={-1}`), as the
 * ribbon's are not: a link that slides away under the keyboard focus leaves
 * an invisible stop. Every destination is reachable by keyboard elsewhere on
 * the page — the five services in the services grid, Existing Buildings in
 * the header — and a pointer can still click a card while it holds.
 *
 * SIX CARDS. The first five are `typologies[0..4]`, so their titles and links
 * are the ones /services prints; the sixth is new — "Repair design for
 * existing structures", with the spare photograph `midriseBalconies` — and
 * not "Repairs to existing structures" over the worker with a trowel, which
 * would read as the firm doing the repairs. The trowel photograph
 * (`repairSoffitTrowel`) is not used on the home page.
 *
 * EACH PHOTOGRAPH IS AN ILLUSTRATION OF A TYPE, NEVER A PROJECT. The tag in
 * the head says so; a card is its photograph and its title, nothing more
 * (the written description that sat under each photograph left on
 * 2026-10-25: it read as a catalogue entry).
 *
 * THE LINK IS THE TITLE AND THE WHOLE CARD IS THE TARGET (the pattern of
 * Typologies.tsx): the <a> holds the title alone; its `::after` is stretched
 * over the card in home-lower.css, so the link text is a name and never a
 * paragraph. Nothing else in a card may become a link. The cards are not
 * headings: the home page's outline has no h3 here.
 *
 * A SERVER COMPONENT; `TypesDrift` is its only client code.
 */
export function HomeTypes({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const h = c.home.types;

  const cards: { title: string; href: string; photo: Photo }[] = [
    ...c.typologies.slice(0, 5).map((t) => ({ title: t.title, href: t.href, photo: t.photo })),
    { title: h.sixth.title, href: '/existing-buildings', photo: photo.midriseBalconies },
  ];

  const set = (copy: boolean) => (
    <ul className="h-types__set" aria-hidden={copy ? true : undefined}>
      {cards.map((card) => (
        <li key={card.title} className="h-types__card">
          {/* The photograph reveals from its foot while it settles (E12),
              once as the card first comes into view. */}
          <Reveal fx="img" className="h-ph h-types__ph">
            <div className="h-ph__in">
              <Img photo={card.photo} sizes="(min-width: 900px) 27vw, 76vw" />
            </div>
          </Reveal>
          <p className="h-types__t">
            <Link href={localePath(card.href, lang)} className="h-types__link" tabIndex={-1}>
              {card.title}
            </Link>
            <span className="h-ring" aria-hidden="true">
              <Arrow up />
            </span>
          </p>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="h-plate h-types mp-surface--graphite" aria-labelledby="h-types-h">
      <div className="h-wrap h-types__head">
        <div className="h-head__top">
          <Reveal as="p" fx="up" className="h-label">
            {h.label}
          </Reveal>
        </div>
        <Reveal as="h2" fx="words" id="h-types-h" className="h-h2 h-h2--m h-types__h">
          <Words text={h.title} accent={h.accentWord} />
        </Reveal>
      </div>

      {/* The band. MOTION HOOK: `TypesDrift` writes `data-paused` here while
          the page's pause switch is pressed; the CSS drift reads it. */}
      <div className="h-types__rail" aria-label={h.region} data-motion="types-drift">
        <TypesDrift />
        <div className="h-types__track">
          {set(false)}
          {set(true)}
        </div>
      </div>
    </section>
  );
}
