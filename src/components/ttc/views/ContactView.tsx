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
  const navLabel = navLabelOf(c, '/contact');

  return (
    <div className="mp-plates mp-dark">
      <JsonLd data={breadcrumbLd(lang, [{ name: c.ui.home, path: '/' }, { name: navLabel, path: '/contact' }])} />

      <PageHero
        eyebrow={p.eyebrow}
        crumbs={[{ href: '/', label: c.ui.home }, { label: navLabel }]}
        titleLines={accentLines(p.titleLines, p.accentWord)}
        sub={isNew ? p.subNew : p.sub}
        photo={imagery.pages.contact}
      />

      <section className="mp-section mp-surface--paper mp-contact" aria-labelledby="mp-contact-title">
        <div className="mp-shell">
          <h2 id="mp-contact-title" className="mp-sr-only">
            {c.ui.form.heading}
          </h2>

          <div className="mp-contact__grid">
            <div>
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
