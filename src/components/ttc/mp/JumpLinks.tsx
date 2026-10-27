import React from 'react';
import type { SiteContent } from '@/lib/ttc/content';

/**
 * The ids the jump links point at. ServiceDetailView puts these same
 * constants on its sections, so a link and its target cannot drift apart;
 * like the home page's #miami-dade and #broward they are identical on the
 * English and the Spanish page.
 *
 * `package` is not in the bar: it is the complete package, part by part,
 * under "What you receive" on the two county programs — the target of each
 * city page's "The package, part by part" (CityView), which opens its rows
 * on arrival (OpenAtHash).
 */
export const JUMP_ID = {
  applies: 'when-it-applies',
  receive: 'what-you-receive',
  steps: 'how-it-runs',
  questions: 'questions',
  offices: 'your-city',
  package: 'the-package',
} as const;

type Service = SiteContent['services'][number];

/**
 * The links for one service, in the ORDER OF THE PAGE: how the work runs,
 * what you receive, when it applies, the questions, your city's office (the
 * steps moved up on 2026-10-27, right under the buildings). A
 * bar that jumps back and forth reads as a puzzle; one that follows the
 * page reads as its table of contents. A link is listed only if the section
 * it points at is rendered for this service (ServiceDetailView renders the
 * timing table, the questions and the offices only where the service has
 * them).
 *
 * Every label is the label already printed over that section (`ui`), in the
 * page's language: no new copy, and nothing here can state a county rule.
 */
export function jumpLinks(c: SiteContent, service: Service): { id: string; label: string }[] {
  const u = c.ui;
  return [
    { id: JUMP_ID.steps, label: u.howItRuns },
    { id: JUMP_ID.receive, label: u.whatYouReceive },
    service.timing ? { id: JUMP_ID.applies, label: u.whenItApplies } : null,
    service.faq?.length ? { id: JUMP_ID.questions, label: u.faqLabel } : null,
    service.offices ? { id: JUMP_ID.offices, label: u.yourCity } : null,
  ].filter((link) => link !== null);
}

/**
 * A row of in-page links on the two county-program pages: up to 1023px a
 * band at the foot of the hero (one column of 44px rows on a phone, two from
 * 641px — a tablet in portrait reads ten screens of these pages), and from
 * 1024px a bar that stays under the header while the page scrolls (mp.css,
 * "Service detail, compact"). The five labels fit one row only from 1024px,
 * so only there does it stick.
 *
 * Why: these are the two longest pages of the site, and the parts a board
 * member came for — does it apply, when is it due, which office sent the
 * letter — sit screens down with no way to reach them but scrolling.
 *
 * Its own list class, not the home hero's strip: the home page is styled on
 * its own schedule, and a change there must not move this bar. Plain
 * `<a href="#…">`: smooth-scroll lands the section below the fixed header
 * and this bar (mp.css sets the scroll-padding for both), moves focus into
 * it and writes the hash, and without JavaScript the same href is a native
 * jump.
 *
 * ServiceDetailView renders it as the FIRST child of the wrapper that holds
 * the page's sections, so the sticky bar lets go when the last of them ends,
 * before the closing band.
 *
 * No hooks: it takes the content bundle, so a server view can render it.
 */
export function JumpLinks({ c, service }: { c: SiteContent; service: Service }) {
  const links = jumpLinks(c, service);
  if (links.length < 2) return null;
  return (
    <nav className="mp-jump" aria-label={c.ui.onThisPage}>
      <div className="mp-shell">
        <ul className="mp-jump__list">
          {links.map((link) => (
            <li key={link.id}>
              <a href={`#${link.id}`}>{link.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
