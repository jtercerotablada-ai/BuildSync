import { isProgramOption } from '@/lib/contact-request';
import type { SiteContent } from '@/lib/ttc/content';

/**
 * Two decisions of ContactForm that the home page's rules reach into, kept in
 * plain functions so a node test can pin them (the form itself is a client
 * component and the test environment has no DOM).
 */

/**
 * Does the form speak of a county notice? When a county program is selected
 * in the dropdown, the labels become "Photo of the notice" and "A phone photo
 * of the letter is enough". The HOME is a presentation of the firm and uses
 * neither word, so its form never enters this mode, whatever is selected:
 * the labels, the hint, the placeholder and the error text stay the home's.
 * (The server still applies `descriptionRequired` by service, so a county
 * program with an attached file needs no description on the home either.)
 */
export function programMode(home: boolean, service: string): boolean {
  return !home && isProgramOption(service);
}

/**
 * The options of the service dropdown, in the order a reader of THIS form
 * should meet them. Everywhere but the home it is the site's own order (which
 * lists the two county programs first). On the home it is `home.order` — the
 * order the ribbon and the grid use, where the two county programs are the
 * fourth and the sixth of eight and no more prominent than the rest — and
 * then whatever else the list holds ("Other / not sure yet"). The same
 * options, the same values: only the order differs, so the server's list of
 * allowed services is unaffected.
 */
export function serviceOptions(
  c: Pick<SiteContent, 'home' | 'services' | 'contactServiceOptions'>,
  home: boolean,
): readonly string[] {
  if (!home) return c.contactServiceOptions;
  const title = new Map(c.services.map((s) => [s.slug, s.shortTitle]));
  const ordered = c.home.order
    .map((slug) => title.get(slug))
    .filter((t): t is string => t !== undefined && c.contactServiceOptions.includes(t));
  return [...ordered, ...c.contactServiceOptions.filter((o) => !ordered.includes(o))];
}
