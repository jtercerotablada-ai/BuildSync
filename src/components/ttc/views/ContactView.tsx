import React from 'react';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { holdsNotice } from '@/lib/ttc/site';
import type { Lang } from '@/lib/ttc/i18n';
import { ContactForm } from '@/components/ttc/mp/ContactForm';
import { DarkHeroSentinel, Reveal } from '@/components/ttc/mp/primitives';
import { Words } from '@/components/ttc/mp/home/Words';
import { Diamond } from '@/components/ttc/mp/home/glyphs';
import { breadcrumbLd, JsonLd } from './meta';
import { whatsappHref } from '@/components/ttc/mp/ReachRow';

/**
 * The proposal page. `presetService` is the raw `?service=` value — normally
 * a service slug from a service page; ContactForm maps it to this language's
 * option (or to nothing).
 *
 * One screen, one action. The hero says what waiting costs and what the
 * visitor gets for free — and nothing beside it: no side panel (the owner,
 * 2026-10-24). Then the form, beside its guide: "What to send, and what
 * happens next." (`contactPage.before`) is the help a visitor needs WHILE
 * filling it in, so its situations are the form's right-hand column (see
 * SITUATIONS), and the whole guide is under the form from 1180px down —
 * AFTER the form in source, so nothing pushes the first field down a phone
 * screen.
 *
 * `mp-contact` is the hook for this page's CSS (mp.css 18 and "Contact"):
 * no photo band on a phone, a tighter section. A form opened for a county
 * program marks itself `data-mp-notice-first` (ContactForm), and mp.css then
 * keeps the first screen to the lede and the upload. Call and WhatsApp are
 * under the form for everyone (`mp-contact__reach-after`), so the guide's
 * "send it by WhatsApp" always has a link to tap.
 *
 * The sub follows the preset the way the WhatsApp text does: a new-building
 * service gets `subNew` (no notice, no lateness); a bare /contact and the
 * existing-building services keep the notice line.
 *
 * Every word of the H1 is a word of the page (seo.test.ts): EN "tell",
 * "about", "reply" and "scope", ES "cuéntenos" and "enviamos" are in the
 * guide.
 */

/* The guide's first rows are the situations — what to send in each — and
   sit beside the form, at body size; the rest (what happens
   next, where and in which language) run in two columns under both from
   1181px. Below that the two lists read as one. */
const SITUATIONS = 6;
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
  const navLabel = navLabelOf(c, '/contact');

  return (
    <div className="mp-plates mp-dark">
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/contact' }])} />

      {/* The opening, as the home's "Get in touch." plate (2026-10-26, the
          owner: "algo claro, lindo, pro, entendible, para que los clientes
          coticen sin confusión"): the label, the headline, the line for this
          visitor, then the three steps from sending to the visit. No photo:
          the form is the page. The sentinel keeps the header transparent
          over it, as over every inner page's hero. */}
      <section className="h-cq mp-surface--graphite" aria-labelledby="mp-phero-title">
        <div className="h-wrap">
          <p className="h-label">{p.eyebrow}</p>
          <h1 id="mp-phero-title" className="h-h2 h-cq__h">
            <Words text={p.titleLines.join(' ')} accent={p.accentWord} />
          </h1>
          <p className="mp-phero__sub h-cq__sub">{isNew ? p.subNew : p.sub}</p>
          <ol className="h-cq__steps">
            {p.steps.map((st, i) => (
              <Reveal as="li" fx="up" delay={i * 0.08} key={st.t} className="h-cq__step">
                <span className="h-cq__n" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="h-cq__t">{st.t}</p>
                <p className="h-cq__v">{st.v}</p>
              </Reveal>
            ))}
          </ol>
        </div>
        <DarkHeroSentinel />
      </section>

      <section className="mp-section mp-surface--paper mp-contact" aria-labelledby="mp-contact-title">
        <div className="mp-shell">
          <h2 id="mp-contact-title" className="mp-sr-only">
            {c.ui.form.heading}
          </h2>

          <div className="mp-contact__grid">
            {/* The form in the home's skin: large type, mono labels, gold on
                focus (home-lower.css, `.h-contact__form`). */}
            <div className="h-contact__form">
              <ContactForm presetService={presetService} />
              {/* WhatsApp, under the form: since 2026-10-24 the hero
                  has no side panel (the owner: "quita"), and this pair is the
                  page's direct line at every width. Links only, nothing under
                  them. The chat opens with the line that fits the visitor: the
                  notice for a county program, a project for a service whose
                  reader holds no letter (`plain`, site.ts `holdsNotice`). */}
              <div className="mp-reach mp-contact__reach-after">
                <div className="mp-reach__links">
                  {/* WhatsApp alone since 2026-10-26: no Call link (the owner). */}
                  {waHref ? (
                    <a className="mp-reach__link" href={waHref} target="_blank" rel="noopener noreferrer">
                      {plain ? c.reach.whatsappPlain : c.reach.whatsappNotice}
                    </a>
                  ) : null}
                </div>
              </div>
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

          {/* What a visitor weighs before sending: four promises, each a fact
              the site states (the proposal is free, the fee for the two
              county programs is fixed, the engineers are licensed, the reply
              usually comes the same day). */}
          <ul className="h-cq__promises">
            {p.promises.map((x) => (
              <li key={x}>
                <Diamond />
                <span>{x}</span>
              </li>
            ))}
          </ul>

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
    </div>
  );
}
