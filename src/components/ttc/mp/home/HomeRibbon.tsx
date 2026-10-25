import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { MotionToggle } from '../media';
import { Diamond } from './glyphs';

/**
 * S2 · RIBBON. The eight service names as very large type, then the building
 * types under them, running in opposite directions: the page's first proof of
 * breadth. This file is the SERVER MARKUP only; the script that moves it
 * (E7, `HomeRibbon` as a client island with `ribbon-math.ts`) comes later and
 * finds its pieces by the `data-ribbon-*` attributes below.
 *
 *   MOTION HOOK: [data-motion="ribbon"]    the section (IntersectionObserver root
 *                                          of the island: ±200 px)
 *   MOTION HOOK: [data-ribbon-row="a|b"]   the clipping row
 *   MOTION HOOK: [data-ribbon-track]       what the script translates (ref,
 *                                          never React-managed style)
 *   MOTION HOOK: [data-ribbon-copy="2"]    the second copy of the list; the
 *                                          script removes it under reduced
 *                                          motion (CSS already hides it)
 *
 * TWO COPIES OF EACH LIST, rendered here and not by the script, so hydration
 * never meets DOM it did not write. The loop is seamless because the track is
 * two identical lists and moves by exactly one of them (−50 %).
 *
 * DECORATIVE, AND SAYS SO. The rows are `aria-hidden`, every link in them has
 * `tabIndex={-1}`, and the second copy is `aria-hidden` once more: the same
 * eight services are real links in S3, and a moving ribbon is eight invisible
 * tab stops otherwise. A pointer can still click a word. What stays reachable
 * is the head row — the label and the pause switch — so the rows are the only
 * thing hidden (a focusable control inside `aria-hidden` is an error).
 *
 * WITHOUT JAVASCRIPT the rows still run, on CSS keyframes that apply only
 * while `html:not(.js)` (home.css): 120 s one way, 150 s the other. The script
 * replaces them. Under reduced motion each row is a plain wrapped list and
 * the second copy is gone.
 *
 * The words of the first row are the services' `shortTitle`s in `home.order`
 * (Miami-Dade Recertification and Broward BSIP are 4th and 6th, same size and
 * weight as the rest); the second row is `home.ribbon.types`.
 */
export function HomeRibbon({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const r = c.home.ribbon;
  const services = c.home.order.map((slug) => {
    const s = c.services.find((x) => x.slug === slug);
    if (!s) throw new Error(`home.order: no service "${slug}"`);
    return s;
  });

  const lists = (kind: 'a' | 'b') =>
    [1, 2].map((copy) => (
      <ul
        key={copy}
        className={`h-rib__list h-rib__${kind}`}
        aria-hidden={copy === 2 ? true : undefined}
        data-ribbon-copy={copy === 2 ? '2' : undefined}
      >
        {kind === 'a'
          ? services.map((s) => (
              <li key={s.slug}>
                <Link
                  href={localePath(`/services/${s.slug}`, lang)}
                  tabIndex={-1}
                  prefetch={false}
                >
                  {s.shortTitle}
                </Link>
              </li>
            ))
          : r.types.map((t) => <li key={t}>{t}</li>)}
      </ul>
    ));

  return (
    <section
      className="h-rib mp-surface--graphite"
      aria-labelledby="h-rib-label"
      data-motion="ribbon"
    >
      <div className="mp-grid-bg" aria-hidden="true" />

      <div className="h-rib__head">
        <p id="h-rib-label" className="h-label">
          {r.label}
        </p>
        <p className="h-mono h-rib__sides">
          <span>{r.sideNew}</span> <Diamond /> <span>{r.sideExisting}</span>
        </p>
        <MotionToggle className="h-rib__toggle" />
      </div>

      <div className="h-rib__rows" aria-hidden="true">
        <div className="h-rib__row" data-ribbon-row="a">
          <div className="h-rib__track" data-ribbon-track="">
            {lists('a')}
          </div>
        </div>
        <div className="h-rib__row h-rib__row--rev" data-ribbon-row="b">
          <div className="h-rib__track" data-ribbon-track="">
            {lists('b')}
          </div>
        </div>
      </div>
    </section>
  );
}
