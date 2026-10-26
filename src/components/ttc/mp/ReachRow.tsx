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
 * The WhatsApp link on the home page: the chat opens with a first line that
 * promises nothing and names no notice and no proposal
 * (`reach.whatsappTextHome`). For the home's phone bar and its phone menu; the
 * contact block of the page words its own line the same way
 * (HomeContact). `null` when no WhatsApp line is set.
 */
export function whatsappHomeHref(c: SiteContent): string | null {
  const wa = c.contact.whatsapp;
  return wa ? `${wa.href}&text=${encodeURIComponent(c.reach.whatsappTextHome)}` : null;
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
 * NOTHING PRINTED UNDER THE BUTTON BUT THE TWO LINKS. The row used to carry
 * a small grey line, "The proposal is free. We usually reply within two
 * hours." (`assure`). The owner's rule since October 20, 2026 is no small
 * print under a button; the two facts are now the end of the closing band's
 * text (`closingCta.body`), at reading size.
 *
 * THE LINKS ARE NOT A PARAGRAPH. The pair sits beside every button — three
 * times on a county program's page — and as a <p> that was one paragraph
 * printed three times, on pages the owner's on-page check kept listing for
 * duplicate paragraphs. It is a pair of links, so it is a <div>:
 * `.mp-reach__links` styles it by class, and nothing changes on screen.
 */
export function ReachRow({
  c,
  plain = false,
  className = '',
}: {
  c: SiteContent;
  /** A page with no notice in the reader's hand: "Message us on WhatsApp".
      Which pages: pageHoldsNotice (notice-pages.ts). */
  plain?: boolean;
  className?: string;
}) {
  /* WhatsApp alone since 2026-10-26 (the owner: "quita Call, no quiero ver
     Call"); the number itself stays in the footer's contact column. */
  const wa = whatsappHref(c, plain);
  if (!wa) return null;
  const r = c.reach;
  return (
    <div className={`mp-reach ${className}`.trim()}>
      <div className="mp-reach__links">
        <a className="mp-reach__link" href={wa} target="_blank" rel="noopener noreferrer">
          {plain ? r.whatsappPlain : r.whatsappNotice}
        </a>
      </div>
    </div>
  );
}
