import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';

/**
 * Who the engineer is, and how to check it — one small block for the two
 * county-program pages, which used to carry no name and no license number at
 * all: a board comparing engineers found the firm's proof on Home and About,
 * never on the page it landed on from a search.
 *
 * Nothing here is typed in: the name and the P.E. number are `leadership`'s,
 * the registry line is `company.registry`, and the link is the one /about
 * uses. The registry has no stable per-license URL, so it opens DBPR's search
 * page (see `leadership.license` in site.ts).
 *
 * THE LABEL IS "ENGINEER", NOT "SIGNED BY". These two pages also print which
 * report the firm prepares and what it confirms for taller buildings (the
 * scope notes). A credential that said who signs would answer that question
 * a second time, in different words.
 *
 * No hooks, and the language comes in as a prop, so the same component
 * renders inside the page hero (a client component, snow on graphite) and in
 * the "Next step" box (paper). Its colours are the --mp-ink-* tokens, which
 * each surface remaps.
 */
export function EngineerCredential({ lang, className }: { lang: Lang; className?: string }) {
  const c = getContent(lang);
  const e = c.leadership;
  const u = c.ui.engineer;

  return (
    <dl className={`mp-cred ${className ?? ''}`.trim()}>
      <dt>{u.label}</dt>
      {/* Each part is its own inline block and carries its separator at the
          END, so a narrow column breaks between parts and no line starts
          with a dot. */}
      <dd>
        {e.license ? (
          <>
            <span>{e.name} ·</span>{' '}
            <span>
              {u.licensePrefix} {e.license.number} ·
            </span>{' '}
            <a href={e.license.url} rel="noopener noreferrer" target="_blank">
              {u.verify}
            </a>
          </>
        ) : (
          <span>{e.name}</span>
        )}
      </dd>
      {c.company.registry ? <dd className="mp-cred__reg">{c.company.registry}</dd> : null}
    </dl>
  );
}
