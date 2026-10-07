import React from 'react';

/**
 * The links that leave the site for an authority's own page: the source of a
 * timing row, a city's building office under "Who sent your notice?", the
 * page a county publishes its forms on. Until these, the two program pages
 * had no outbound link at all: every number named its authority and gave the
 * reader no way to open it.
 *
 * Always a new tab, so the page with the deadline stays open behind it, and
 * always `noopener noreferrer`. THE LINK TEXT NAMES WHERE IT GOES — the
 * office or the text of the rule, never "here" or "source": that is what a
 * screen reader's list of links reads out, and what tells a reader the next
 * page is a government's and not ours.
 *
 * No hooks, so the same components render in the service pages (server) and
 * in the home page's program sections (client).
 */
export function Outbound({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a className={`mp-out ${className ?? ''}`.trim()} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/**
 * A timing row's authority. A link where the row carries a `sourceUrl`; the
 * same words as plain text where it does not — a source that cannot be
 * opened today is still named, never guessed at (see `timing` in site.ts).
 */
export function Source({ row }: { row: { source: string; sourceUrl?: string } }) {
  return row.sourceUrl ? <Outbound href={row.sourceUrl}>{row.source}</Outbound> : <>{row.source}</>;
}

/**
 * "Last verified: October 4, 2026", with the date in a <time> element: the
 * words are the page's language, `iso` is the same day for a machine. The
 * date was plain text, which no crawler or answer engine can read as a date.
 */
export function Dated({ label, date, iso }: { label: string; date: string; iso: string }) {
  return (
    <>
      {label}: <time dateTime={iso}>{date}</time>
    </>
  );
}
