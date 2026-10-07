import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { SectionHeading, Reveal } from './primitives';

/**
 * Who the practice works with: two licensed firms side by side, each with its
 * own mark and its own Florida licences — the engineering practice on the
 * left, Precision Source on the right — and one line underneath saying whose
 * seal goes on the reports.
 *
 * The two cards are deliberately the same shape. The point a client takes
 * away is "two separate licensed companies, one team", and a block that put
 * the other firm's logo in a strip under our own copy would say
 * "subcontractor" instead. No card says what its firm does on a job — the
 * owner wants a team shown, not a division of labour (see `partner` in
 * site.ts).
 *
 * Both logos are the files each company supplied (never redrawn), dark ink on
 * the white card. Every fact on the engineering card comes from `company` and
 * `leadership`, so the P.E. number printed here is the one /about prints.
 */
export function PartnerSection({
  n,
  lang,
  surface = 'concrete',
}: {
  n: string;
  lang: Lang;
  surface?: 'paper' | 'concrete';
}) {
  const c = getContent(lang);
  const p = c.partner;
  const firm = c.company;
  const e = c.leadership;
  const build = p.construction;
  /* `company.registry` is one printed line ("FL Engineering Business No.
     40285"); the card wants the number on its own, in the same two-column
     row as the P.E. licence, so the two cards' lists line up. */
  const registryNo = firm.registry?.match(/No\.\s*\d+/)?.[0] ?? null;

  return (
    <section
      id="contractor"
      className={`mp-section mp-section--lg mp-surface--${surface} mp-partner`}
      aria-labelledby="mp-partner-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={p.eyebrow} />

        <div className="mp-split">
          <Reveal>
            <p className="mp-partner__kicker">{p.kicker}</p>
            <h2 id="mp-partner-title" className="mp-split__title">
              {p.title}
            </h2>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="mp-lead mp-partner__lede">{p.lede}</p>
          </Reveal>
        </div>

        <div className="mp-partner__cards">
          <Reveal className="mp-partner__card">
            <div className="mp-partner__logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={firm.logo.markDarkSm}
                alt=""
                width={firm.logo.markSmSize.w}
                height={firm.logo.markSmSize.h}
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="mp-partner__role">{p.engineering.role}</p>
            <h3 className="mp-partner__name">{firm.name}</h3>
            <p className="mp-partner__who">{e.name}</p>
            <div className="mp-partner__lic">
              <p className="mp-partner__lic-label">{p.licensesLabel}</p>
              <dl>
                {e.license ? (
                  <div>
                    <dt>{p.engineering.licenseLabel}</dt>
                    <dd>{e.license.number}</dd>
                  </div>
                ) : null}
                {registryNo ? (
                  <div>
                    <dt>{p.engineering.registryLabel}</dt>
                    <dd>{registryNo}</dd>
                  </div>
                ) : null}
              </dl>
              {firm.registry && !registryNo ? (
                <p className="mp-partner__reg">{firm.registry}</p>
              ) : null}
            </div>
          </Reveal>

          <Reveal delay={0.06} className="mp-partner__card">
            <div className="mp-partner__logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={build.logo.src}
                alt=""
                width={build.logo.w}
                height={build.logo.h}
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="mp-partner__role">{build.role}</p>
            <h3 className="mp-partner__name">{build.name}</h3>
            <p className="mp-partner__who">{build.place}</p>
            <div className="mp-partner__lic">
              <p className="mp-partner__lic-label">{p.licensesLabel}</p>
              <dl>
                {build.licenses.map((l) => (
                  <div key={l.number}>
                    <dt>{l.label}</dt>
                    <dd>{l.number}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.08}>
          <p className="mp-partner__note">
            <b>{p.seal.k}</b>
            <span>{p.seal.v}</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
