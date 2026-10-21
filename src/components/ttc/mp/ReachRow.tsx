import React from 'react';
import type { SiteContent } from '@/lib/ttc/content';

/**
 * The WhatsApp link, opening the chat with a first line already written so
 * the message that arrives says why. `null` when no WhatsApp line is set.
 *
 * `contact.whatsapp.href` is WhatsApp's own `…/send?phone=<number>`, which
 * already carries a query, so the message is joined with `&`. (It was the
 * short `wa.me/<number>?text=…`, which answers every click with a redirect
 * to this address.)
 *
 * `plain`: the first line for a reader with no notice (a new building), so
 * the chat does not open with "I received a building inspection notice".
 */
export function whatsappHref(c: SiteContent, plain = false): string | null {
  const wa = c.contact.whatsapp;
  const text = plain ? c.reach.whatsappTextPlain : c.reach.whatsappText;
  return wa ? `${wa.href}&text=${encodeURIComponent(text)}` : null;
}

/**
 * Call and WhatsApp, as two plain links under a button. A board holding a
 * notice with a deadline phones whoever answers, and a Spanish-speaking owner
 * sends the photo of the letter by WhatsApp — the form alone lost both.
 *
 * No hooks, so server views and client sections can both render it; it takes
 * the content bundle instead of reading the language itself. Renders nothing
 * until a phone number exists (`contact.phone` was null for the site's first
 * year: an empty slot, never a placeholder number).
 *
 * `assure` prints the two facts that sit next to the links — the proposal is
 * free, and a reply usually comes within two hours — for the places that do
 * not already say them.
 *
 * THE LINKS ARE NOT A PARAGRAPH. The pair sits beside every button — three
 * times on a county program's page — and as a <p> that was one paragraph
 * printed three times, on pages the owner's on-page check kept listing for
 * duplicate paragraphs. It is a pair of links, so it is a <div>:
 * `.mp-reach__links` styles it by class, and nothing changes on screen. The
 * `assure` line IS a sentence and stays a <p>; a page prints it once (see
 * ContactCTA's `assure`).
 */
export function ReachRow({
  c,
  assure = false,
  plain = false,
  className = '',
}: {
  c: SiteContent;
  assure?: boolean;
  /** A page with no notice in the reader's hand: "Message us on WhatsApp". */
  plain?: boolean;
  className?: string;
}) {
  const phone = c.contact.phone;
  if (!phone) return null;
  const wa = whatsappHref(c, plain);
  const r = c.reach;
  return (
    <div className={`mp-reach ${className}`.trim()}>
      {assure ? (
        <p className="mp-reach__assure">
          {r.free} {r.reply}
        </p>
      ) : null}
      <div className="mp-reach__links">
        <a className="mp-reach__link" href={phone.href}>
          {r.call} {phone.display}
        </a>
        {wa ? (
          <a className="mp-reach__link" href={wa} target="_blank" rel="noopener noreferrer">
            {plain ? r.whatsappPlain : r.whatsappNotice}
          </a>
        ) : null}
      </div>
    </div>
  );
}
