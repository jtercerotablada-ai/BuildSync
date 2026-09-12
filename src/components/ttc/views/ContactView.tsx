import React from 'react';
import { getContent } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactForm } from '@/components/ttc/mp/ContactForm';
import { SouthFloridaMap } from '@/components/ttc/mp/SouthFloridaMap';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';

export function ContactView({ lang, presetService }: { lang: Lang; presetService?: string }) {
  const c = getContent(lang);
  const p = c.contactPage;
  const u = c.ui.contactPage;
  const navLabel = c.primaryNav[4].label;

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/contact' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabel }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        plainTitle={p.plainTitle}
        sub={p.sub}
        photo={imagery.pages.contact}
      />

      <section className="mp-section mp-section--lg mp-surface--paper" aria-labelledby="mp-contact-title">
        <div className="mp-shell">
          <SectionHeading n="01" label={c.ui.form.heading} />
          <h2 id="mp-contact-title" className="mp-form__hp">
            {c.ui.form.heading}
          </h2>

          <div className="mp-contact__grid">
            <div>
              <Reveal>
                <p className="mp-lead mp-contact__intro">{c.ui.form.intro}</p>
              </Reveal>
              <ContactForm presetService={presetService} />
            </div>

            <aside>
              <div className="mp-info">
                <div className="mp-info__block">
                  <span className="mp-info__label">{u.emailLabel}</span>
                  <a className="mp-info__value" href={`mailto:${c.contact.email}`}>
                    {c.contact.email}
                  </a>
                  <span className="mp-info__meta">{u.emailMeta}</span>
                </div>

                {c.contact.phone ? (
                  <div className="mp-info__block">
                    <span className="mp-info__label">{u.phone}</span>
                    <a className="mp-info__value" href={c.contact.phone.href}>
                      {c.contact.phone.display}
                    </a>
                  </div>
                ) : null}

                {c.contact.address ? (
                  <div className="mp-info__block">
                    <span className="mp-info__label">{u.office}</span>
                    <span className="mp-info__value">{c.contact.address.line1}</span>
                    <span className="mp-info__meta">
                      {c.contact.address.line2 ? `${c.contact.address.line2}, ` : ''}
                      {c.contact.address.city}, {c.contact.address.state} {c.contact.address.zip}
                    </span>
                  </div>
                ) : null}

                <div className="mp-info__block">
                  <span className="mp-info__label">{c.ui.engineer.eyebrow}</span>
                  <span className="mp-info__value">{c.leadership.name}</span>
                  <span className="mp-info__meta">
                    {c.leadership.role} · {c.leadership.credential}
                  </span>
                </div>

                <div className="mp-info__block">
                  <span className="mp-info__label">{u.serviceArea}</span>
                  <span className="mp-info__value">{c.contact.serviceAreaLabel}</span>
                  <span className="mp-info__meta">{u.serviceAreaMeta}</span>
                </div>

                <div className="mp-info__block">
                  <span className="mp-info__label">{u.whatWeCover}</span>
                  <span className="mp-info__meta mp-info__list">
                    {c.services.map((s) => s.shortTitle).join(' · ')}
                  </span>
                </div>
              </div>
            </aside>
          </div>

          <Reveal delay={0.06}>
            <p className="mp-disclaimer">{u.disclaimer}</p>
          </Reveal>
        </div>
      </section>

      <SouthFloridaMap n="02" />
    </>
  );
}
