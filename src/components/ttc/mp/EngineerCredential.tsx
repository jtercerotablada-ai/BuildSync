import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';

/**
 * The firm's Florida licenses, by name — one small block for the service,
 * city and guide pages.
 *
 * NAMES, NEVER NUMBERS (the owner, 2026-10-23: "podemos mencionar todas las
 * licencias que tenemos pero no el número; eso no lo ponen las firmas de
 * verdad"). The block used to print the principal's name, his P.E. number
 * and a link to the state's search; the site now presents a firm, not one
 * engineer, so it names what the firm holds and nothing else. The labels are
 * `partner.engineering.licenses` — the same list /about prints.
 *
 * `brief` is kept for the call sites (the second time a page prints it) and
 * draws the same one line: there is no longer a long form to shorten.
 *
 * No hooks, and the language comes in as a prop, so it renders inside the
 * page hero (snow on graphite) and in the "Next step" box alike; its colours
 * are the --mp-ink-* tokens, which each surface remaps.
 */
export function EngineerCredential({
  lang,
  className,
}: {
  lang: Lang;
  className?: string;
  brief?: boolean;
}) {
  const c = getContent(lang);
  const licenses = c.partner.engineering.licenses;

  return (
    <dl className={`mp-cred ${className ?? ''}`.trim()}>
      <dt>{c.ui.engineer.label}</dt>
      {/* Each part is its own inline block and carries its separator at the
          END, so a narrow column breaks between parts and no line starts
          with a dot. */}
      <dd>
        {licenses.map((l, i) => (
          <React.Fragment key={l.label}>
            <span>
              {l.label}
              {i < licenses.length - 1 ? ' ·' : ''}
            </span>{' '}
          </React.Fragment>
        ))}
      </dd>
    </dl>
  );
}
