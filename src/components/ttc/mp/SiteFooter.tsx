import React from 'react';
import Link from 'next/link';
import {
  company,
  contact,
  footerNav,
  legal,
  services,
} from '@/lib/ttc/site';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mp-footer">
      <div className="mp-shell">
        <div className="mp-footer__top">
          <div>
            <div className="mp-footer__brand-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={company.logo.light}
                alt=""
                width={38}
                height={38}
                aria-hidden="true"
              />
              <span className="mp-footer__brand-name">
                {company.name}
                <br />
                <span
                  className="mp-mono"
                  style={{ fontSize: '0.5625rem', opacity: 0.7 }}
                >
                  {company.discipline}
                </span>
              </span>
            </div>
            <p className="mp-footer__tag">{company.positioning.body}</p>
          </div>

          <div className="mp-footer__cols">
            {footerNav.map((group) => (
              <div className="mp-footer__col" key={group.title}>
                <h2>{group.title}</h2>
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}

            <div className="mp-footer__col">
              <h2>Services</h2>
              {services.map((s) => (
                <Link key={s.slug} href={`/services/${s.slug}`}>
                  {s.shortTitle}
                </Link>
              ))}
            </div>

            <div className="mp-footer__col">
              <h2>Contact</h2>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
              {contact.phone ? (
                <a href={contact.phone.href}>{contact.phone.display}</a>
              ) : null}
              {contact.address ? (
                <span>
                  {contact.address.line1}
                  {contact.address.line2 ? `, ${contact.address.line2}` : ''}
                  {`, ${contact.address.city}, ${contact.address.state} ${contact.address.zip}`}
                </span>
              ) : null}
              <span>{contact.serviceAreaLabel}</span>
              {contact.social.linkedin ? (
                <a
                  href={contact.social.linkedin}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  LinkedIn
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mp-footer__notice">{legal.notice}</p>

        <div className="mp-footer__bottom">
          <span>
            © {year} {company.legalName}
          </span>
          <div className="mp-footer__legal">
            {legal.links.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
