import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { holdsNotice, imagery } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ContactForm } from '@/components/ttc/mp/ContactForm';
import { accentLines } from '@/components/ttc/mp/text';
import { breadcrumbLd, JsonLd } from './meta';
import { whatsappHref } from '@/components/ttc/mp/ReachRow';

/**
 * The proposal page. `presetService` is the raw `?service=` value — normally
 * a service slug from a service page; ContactForm maps it to this language's
 * option (or to nothing).
 *
 * One screen, one action. The hero says what waiting costs and what the
 * visitor gets for free, and carries the direct lines (call, WhatsApp,
 * email, the usual reply time) as quiet text links: in the hero's side
 * panel from 1024px, under the lede below that — on a phone the call link is
 * on the first screen, where MobileActionBar (hidden on this page) would
 * otherwise have put it. Then the form, beside its guide: "What to send, and
 * what happens next." (`contactPage.before`) is the help a visitor needs
 * WHILE filling it in, so its situations are the form's right-hand column
 * (see SITUATIONS), and the whole guide is under the form from 1180px down —
 * AFTER the form in source, so nothing pushes the first field down a phone
 * screen.
 *
 * `mp-contact` is the hook for this page's CSS (mp.css 18 and "Contact"):
 * no photo band on a phone, a tighter section. A form opened for a county
 * program marks itself `data-mp-notice-first` (ContactForm), and mp.css then
 * hides the hero's direct lines on a phone as well: the upload that visitor
 * was promised has to be the first thing under the lede. The same Call and
 * WhatsApp links then show under the form instead (`mp-contact__reach-after`,
 * shown only in that case), so the guide's "send it by WhatsApp" always has
 * a link to tap and exactly one pair is visible at every width.
 *
 * The sub follows the preset the way the WhatsApp text does: a new-building
 * service gets `subNew` (no notice, no lateness); a bare /contact and the
 * existing-building services keep the notice line.
 *
 * Every word of the H1 is a word of the page (seo.test.ts): EN "tell",
 * "about" and "scope", ES "cuéntenos" and "enviamos" are in the guide, EN
 * "reply" in the reply-time line.
 */

/* The guide's first rows are the situations — what to send in each — and
   sit beside the form, at body size; the rest (what happens
   next, where and in which language) run in two columns under both from
   1181px. Below that the two lists read as one. */
const SITUATIONS = 4;
export function ContactView({ lang, presetService }: { lang: Lang; presetService?: string }) {
  const c = getContent(lang);
  // With a new-building service chosen (?service=…), the hero's sub asks
  // for a proposal, not about a notice. The WhatsApp chat follows the
  // service's reader (site.ts `holdsNotice`, the rule of the service page
  // the visitor came from): the assessments page is an existing building
  // with no letter, so its chat does not open with "I received a building
  // inspection notice". A bare /contact keeps the notice: the site's first
  // reader holds one.
  const preset = c.services.find((s) => s.slug === presetService);
  const isNew = preset?.track === 'new';
  const plain = preset ? !holdsNotice(preset) : false;
  const waHref = whatsappHref(c, plain);
  const p = c.contactPage;
  const b = p.before;
  const a = c.contact.address;
  const navLabel = navLabelOf(c, '/contact');

  return (
    <>
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/contact' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabel }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        sub={isNew ? p.subNew : p.sub}
        photo={imagery.pages.contact}
      >
        {/* Links, not a paragraph (see ReachRow): plain <a href> so the ads
            tag's click listener counts the call and the WhatsApp chat. */}
        <div className="mp-reach mp-contact__reach">
          <div className="mp-reach__links">
            {c.contact.phone ? (
              <a className="mp-reach__link" href={c.contact.phone.href}>
                {`${c.reach.call} ${c.contact.phone.display}`}
              </a>
            ) : null}
            {waHref ? (
              <a className="mp-reach__link" href={waHref} target="_blank" rel="noopener noreferrer">
                {c.reach.whatsapp}
              </a>
            ) : null}
            <a className="mp-reach__link" href={`mailto:${c.contact.email}`}>
              {c.contact.email}
            </a>
          </div>
          <p className="mp-phero__note">{c.reach.reply}</p>
          {a ? (
            <p className="mp-phero__note">
              {`${c.ui.contactPage.office}: ${a.line1}${a.line2 ? `, ${a.line2}` : ''}, ${a.city}, ${a.state} ${a.zip}`}
            </p>
          ) : null}
        </div>
      </PageHero>

      <section className="mp-section mp-surface--paper mp-contact" aria-labelledby="mp-contact-title">
        <div className="mp-shell">
          <h2 id="mp-contact-title" className="mp-sr-only">
            {c.ui.form.heading}
          </h2>

          <div className="mp-contact__grid">
            <div>
              <ContactForm presetService={presetService} />
              {/* The hero's Call and WhatsApp, again, for the one case where
                  the hero's are hidden: a phone, with the form opened for a
                  county program (mp.css 18 shows this only then). Not for a
                  service whose reader holds no notice, which is never opened
                  that way. No note under them: links only. */}
              {plain ? null : (
                <div className="mp-reach mp-contact__reach-after">
                  <div className="mp-reach__links">
                    {c.contact.phone ? (
                      <a className="mp-reach__link" href={c.contact.phone.href}>
                        {`${c.reach.call} ${c.contact.phone.display}`}
                      </a>
                    ) : null}
                    {waHref ? (
                      <a className="mp-reach__link" href={waHref} target="_blank" rel="noopener noreferrer">
                        {c.reach.whatsappNotice}
                      </a>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <aside className="mp-contact__rail" aria-labelledby="mp-before-title">
              <div className="mp-contact__kicker">{b.eyebrow}</div>
              <h2 id="mp-before-title" className="mp-contact__rail-title">
                {b.title}
              </h2>
              <ul className="mp-pillars mp-pillars--rail">
                {b.items.slice(0, SITUATIONS).map((it) => (
                  <li key={it.k}>
                    <b>{it.k}</b>
                    <span>{it.v}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <ul className="mp-pillars mp-pillars--rail mp-pillars--next">
            {b.items.slice(SITUATIONS).map((it) => (
              <li key={it.k}>
                <b>{it.k}</b>
                <span>{it.v}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
