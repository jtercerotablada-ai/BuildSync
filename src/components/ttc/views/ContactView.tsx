import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactForm } from '@/components/ttc/mp/ContactForm';
import { SectionHeading, Reveal } from '@/components/ttc/mp/primitives';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';
import { whatsappHref } from '@/components/ttc/mp/ReachRow';

/**
 * The proposal page. `presetService` is the raw `?service=` value — normally
 * a service slug from a service page; ContactForm maps it to this language's
 * option (or to nothing).
 *
 * `mp-contact` is the hook for the phone layout: every "Request a Proposal"
 * on the site lands here, so on a phone the first field must be on the first
 * screen. mp.css trims this section's top padding there and hides the label
 * and intro, which only repeat the hero's eyebrow and lede.
 *
 * A form opened for a county program marks itself `data-mp-notice-first`
 * (ContactForm), and mp.css then does the same at every width and drops the
 * hero's photo band on a phone: the upload that visitor was promised has to
 * be the first thing under the lede.
 *
 * Under the form: "Before you write" (`contactPage.before`) — what to send,
 * what comes back and the other ways in, for someone who has not pressed
 * Send yet. It is AFTER the form on purpose: nothing may push the first
 * field down a phone screen. The home page's service-area band used to sit
 * here, word for word; it stays on the home page, and this page keeps the
 * two counties and their cities in a sentence of its own. The layout is the
 * About page's "Principles" (`mp-split` + `mp-pillars`), so it adds no CSS.
 */
export function ContactView({ lang, presetService }: { lang: Lang; presetService?: string }) {
  const c = getContent(lang);
  const waHref = whatsappHref(c);
  const p = c.contactPage;
  const u = c.ui.contactPage;
  const b = p.before;
  const navLabel = navLabelOf(c, '/contact');

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/contact' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabel }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        sub={p.sub}
        photo={imagery.pages.contact}
      />

      <section
        className="mp-section mp-section--lg mp-surface--paper mp-contact"
        aria-labelledby="mp-contact-title"
      >
        <div className="mp-shell">
          {/* Visible label for sighted readers, hidden h2 for the outline —
              the same words, announced once. */}
          <div aria-hidden="true">
            <SectionHeading n="01" label={c.ui.form.heading} />
          </div>
          <h2 id="mp-contact-title" className="mp-sr-only">
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
                    <span className="mp-info__meta">{c.reach.reply}</span>
                  </div>
                ) : null}

                {waHref ? (
                  <div className="mp-info__block">
                    <span className="mp-info__label">{c.reach.whatsapp}</span>
                    <a className="mp-info__value" href={waHref} target="_blank" rel="noopener noreferrer">
                      {c.reach.whatsappNotice}
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

      <section className="mp-section mp-surface--concrete" aria-labelledby="mp-before-title">
        <div className="mp-shell">
          <SectionHeading n="02" label={b.eyebrow} />
          <div className="mp-split">
            <Reveal>
              <h2 id="mp-before-title" className="mp-split__title">
                {b.title}
              </h2>
            </Reveal>
            <Reveal delay={0.05}>
              <ul className="mp-pillars">
                {b.items.map((it) => (
                  <li key={it.k}>
                    <b>{it.k}</b>
                    <span>{it.v}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
