import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { Reveal } from '../primitives';

/**
 * "In plain words" — the first plate under a service page's hero (the owner,
 * 2026-10-27: "veo mucho texto pero sin explicación; alguien que no le gusta
 * leer se aburre"). The page's short headline (`problemTitle`), then three
 * tiles a reader takes in at a glance — what it is, who it is for, what you
 * get (`serviceLook.plain[slug]`) — and the long texts the page used to open
 * with folded under one line (`more`: the problem, the situations, the
 * audience). Every word stays in the server HTML.
 *
 * The h2 is the one the page's first section always had, so the page's count
 * of headings does not move (pages.test.ts, a ceiling of 23). The tiles'
 * keys are labels, not headings. The fold is the home's `h-fold`, not the
 * `mp-disclose` the tests count on the county pages.
 *
 * A SERVER component.
 */
export function ServiceGlance({
  lang,
  slug,
  title,
  more,
}: {
  lang: Lang;
  slug: string;
  title: string;
  more: React.ReactNode;
}) {
  const c = getContent(lang);
  const g = c.serviceLook.glance;
  const plain = c.serviceLook.plain[slug];
  if (!plain) return null;

  return (
    <section className="h-plate mp-surface--concrete h-gl" aria-labelledby="mp-gl-title">
      <div className="h-wrap">
        <Reveal as="p" fx="up" className="h-label">
          {g.label}
        </Reveal>
        <Reveal as="h2" fx="up" id="mp-gl-title" className="h-h2 h-gl__h">
          {title}
        </Reveal>
        <ol className="h-gl__tiles">
          {plain.map((line, i) => (
            <Reveal as="li" fx="up" delay={i * 0.08} key={g.keys[i]} className="h-gl__tile">
              <p className="h-gl__k">
                <span className="h-gl__n">{String(i + 1).padStart(2, '0')}</span> {g.keys[i]}
              </p>
              <p className="h-gl__v">{line}</p>
            </Reveal>
          ))}
        </ol>
        <details className="h-fold h-gl__fold">
          <summary className="h-fold__sum">
            {g.more}
            <span className="h-fold__plus" aria-hidden="true" />
          </summary>
          <div className="h-gl__more">{more}</div>
        </details>
      </div>
    </section>
  );
}
