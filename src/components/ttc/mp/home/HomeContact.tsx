import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { ContactForm } from '../ContactForm';
import { Reveal } from '../primitives';
import { whatsappHomeHref } from '../ReachRow';
import { Arrow } from './glyphs';
import { Words } from './Words';

/**
 * S11 · CONTACT — a very large "Get in touch." with the form right there.
 *
 * Desktop: label, the headline (the largest type of the page), one line,
 * then two columns — the REAL form on the left, and the four direct lines on
 * the right, each a full row with an arrow ring: Call · WhatsApp · Email ·
 * Where. Phone: one column in the order of the markup, the form and then the
 * lines (they were moved above the form with `order`, which took the keyboard
 * from the Send button back up to Call; the phone bar carries Call and
 * WhatsApp from the first scroll).
 *
 * THE FORM IS THE REAL ONE: `ContactForm variant="home"` — the same fields,
 * validation, upload to blob storage, honeypot, ads conversion, route and
 * success block as /contact (see the ContactForm docblock for the three
 * differences). Nothing is faked, and there is no `?service=` preset on the
 * home page. The form's own two neutral strings come from `home.form`.
 *
 * THE DIRECT LINES read the firm's contact data and print nothing that is
 * not configured: no phone line without `contact.phone`, no WhatsApp line
 * without `contact.whatsapp`. The WhatsApp chat opens with the home page's
 * own first line (`reach.whatsappTextHome`: "Hello, I would like to talk
 * about a building."), which names no notice and no proposal: the address is
 * `whatsappHomeHref` (ReachRow), the one the phone bar and the menu use.
 * "Where" is the service area, a plain row: not a link (the plate that
 * listed the offices is not on the home page).
 *
 * No reply-time promise and no free-proposal line anywhere in this section
 * (the owner's rule for the home page).
 *
 * A SERVER COMPONENT wrapping one client island (the form).
 */
export function HomeContact({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const h = c.home.contact;
  const phone = c.contact.phone;
  const wa = whatsappHomeHref(c);

  const lines: { key: string; label: string; value: string; href?: string; external?: boolean }[] = [];
  if (phone) lines.push({ key: 'call', label: h.call, value: phone.display, href: phone.href });
  if (wa) {
    lines.push({
      key: 'whatsapp',
      label: h.whatsapp,
      value: c.reach.whatsappPlain,
      href: wa,
      external: true,
    });
  }
  lines.push({ key: 'email', label: h.email, value: c.contact.email, href: `mailto:${c.contact.email}` });
  lines.push({ key: 'where', label: h.where, value: c.contact.serviceAreaLabel });

  return (
    <section id="contact" className="h-plate h-contact mp-surface--graphite" aria-labelledby="h-contact-h">
      <div className="h-wrap">
        <Reveal as="p" fx="up" className="h-label">
          {h.label}
        </Reveal>
        <Reveal as="h2" fx="words" id="h-contact-h" className="h-h2 h-contact__h">
          <Words text={h.title} accent={h.accentWord} />
        </Reveal>
        <Reveal as="p" fx="up" delay={0.3} className="h-lede h-contact__sub">
          {h.sub}
        </Reveal>

        <div className="h-contact__grid">
          <Reveal fx="up" className="h-contact__form">
            <ContactForm variant="home" />
          </Reveal>

          {/* The lines fade up (E9), 0.2 s after the form. */}
          <Reveal as="ul" fx="up" delay={0.2} className="h-contact__lines">
            {lines.map((line) => (
              <li key={line.key}>
                {line.href ? (
                  <a
                    className="h-contact__line"
                    href={line.href}
                    {...(line.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    <span className="h-contact__k">{line.label}</span>{' '}
                    <span className="h-contact__v">{line.value}</span>
                    <span className="h-ring h-contact__go" aria-hidden="true">
                      <Arrow up />
                    </span>
                  </a>
                ) : (
                  /* A plain row: no link, no ring, not focusable. */
                  <div className="h-contact__line h-contact__line--plain">
                    <span className="h-contact__k">{line.label}</span>{' '}
                    <span className="h-contact__v">{line.value}</span>
                  </div>
                )}
              </li>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
