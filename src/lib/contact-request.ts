/**
 * Rules for the text of a public proposal request — the counterpart of
 * contact-attachments.ts, which holds the rules for its files.
 *
 * Shared by the form (to say what is required before anything is sent) and
 * the contact route (which repeats every rule, because the endpoint is public
 * and a hand-rolled POST skips the form). A rule relaxed on one side only
 * shows up as a request the visitor was told is fine and the server refuses.
 */

import { services as EN_SERVICES } from '@/lib/ttc/site';
import { es } from '@/lib/ttc/site.es';

/**
 * The dropdown options that are a county program — Miami-Dade's building
 * recertification and Broward's BSIP, i.e. the services that carry a
 * `program` block. Both languages, because the route receives the label of
 * whichever language the visitor was reading.
 */
const PROGRAM_OPTIONS = new Set<string>(
  [...EN_SERVICES, ...es.services].filter((s) => s.program).map((s) => s.shortTitle),
);

export function isProgramOption(option: string): boolean {
  return PROGRAM_OPTIONS.has(option);
}

/**
 * Whether a request has to carry a written description.
 *
 * Every button that opens the form for a county program says "a phone photo
 * of the letter is enough", so for those two services an attached file
 * stands in for the description. `attached` counts files that FINISHED
 * uploading: one still moving, or one that failed, is not a letter the
 * engineer can open. Every other service keeps the description — a drawing
 * with no words is not yet a request.
 */
export function descriptionRequired(option: string, attached: number): boolean {
  return !(isProgramOption(option) && attached > 0);
}

/** Cap of each line of a request's source. */
export const SOURCE_MAX = 300;

/**
 * A value that will be stored as ONE line under the message ("Stories: 4").
 * A line break inside it would start a line of its own there and could pass
 * for a field the visitor never filled, so control characters and runs of
 * whitespace collapse to a single space.
 */
export function oneLine(value: string, max: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export type RequestSource = { landing: string | null; referrer: string | null };

function parseUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Where a request came from: the page of this site the visit STARTED on and
 * the page that linked to the site. The office could see which service was
 * asked for and in which language, but not which page produced the request.
 *
 * `entry` is the URL this document was loaded at (the browser's navigation
 * entry) and `referrer` is `document.referrer`. The site moves between pages
 * without reloading, so both still describe the arrival when the form is
 * sent. Nothing is stored in the browser and nothing leaves it until the
 * visitor presses Send.
 *
 * Paths only. A query string is where click identifiers and search terms
 * travel, and neither belongs in the office inbox.
 */
export function requestSource(
  entry: string | null | undefined,
  referrer: string | null | undefined,
  origin: string,
): RequestSource {
  const from = parseUrl(entry);
  const ref = parseUrl(referrer);
  return {
    // An entry on another origin is not this site's page; say nothing.
    landing: from && from.origin === origin ? from.pathname.slice(0, SOURCE_MAX) : null,
    // Not `origin`: that is "null" for an app referrer (android-app://…).
    referrer: ref ? `${ref.protocol}//${ref.host}${ref.pathname}`.slice(0, SOURCE_MAX) : null,
  };
}
