import React from 'react';
import type { SiteContent } from '@/lib/ttc/content';

/**
 * The ids the jump links point at. ServiceDetailView puts these same
 * constants on its sections, so a link and its target cannot drift apart;
 * like the home page's #miami-dade and #broward they are identical on the
 * English and the Spanish page.
 */
export const JUMP_ID = {
  applies: 'when-it-applies',
  receive: 'what-you-receive',
  steps: 'how-it-runs',
  questions: 'questions',
} as const;

type Service = SiteContent['services'][number];

/**
 * The links for one service, in the order a notice-holder asks — does it
 * apply and by when, what do I get, how does it run, then the questions —
 * which is not the order of the page. A link is listed only if the section
 * it points at is rendered for this service (ServiceDetailView renders the
 * timing table and the questions only where the service has them).
 *
 * Every label is the label already printed over that section (`ui`), in the
 * page's language: no new copy, and nothing here can state a county rule.
 */
export function jumpLinks(c: SiteContent, service: Service): { id: string; label: string }[] {
  const u = c.ui;
  return [
    service.timing ? { id: JUMP_ID.applies, label: u.whenItApplies } : null,
    { id: JUMP_ID.receive, label: u.whatYouReceive },
    { id: JUMP_ID.steps, label: u.howItRuns },
    service.faq?.length ? { id: JUMP_ID.questions, label: u.faqLabel } : null,
  ].filter((link) => link !== null);
}

/**
 * A row of in-page links under the hero of the two county-program pages, on
 * phones (mp.css shows it at ≤640px only).
 *
 * Why: at 390px these pages run twelve to thirteen screens, and the parts a
 * board member came for — does it apply, when is it due — sit screens down
 * with no way to reach them but scrolling. Four links, each a 44px row.
 *
 * It is the home hero's strip again (`.mp-hero__caps`: the same list, the
 * same 44px rows on a phone), on the same graphite, so it reads as the foot
 * of the hero above it. Plain `<a href="#…">`, like that strip and for the
 * same reason: smooth-scroll.tsx lands the section below the fixed header,
 * moves focus into it and writes the hash, and without JavaScript the same
 * href is a native jump (mp.css sets the scroll-padding).
 *
 * No hooks: it takes the content bundle, so a server view can render it.
 */
export function JumpLinks({ c, service }: { c: SiteContent; service: Service }) {
  const links = jumpLinks(c, service);
  if (links.length < 2) return null;
  return (
    <nav className="mp-jump mp-surface--graphite" aria-label={c.ui.onThisPage}>
      <div className="mp-shell">
        <ul className="mp-hero__caps">
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
