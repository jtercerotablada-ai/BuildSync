'use client';

import React from 'react';
import Link from 'next/link';
import { useContent, useL } from './lang';

export function SiteFooter() {
  const c = useContent();
  const l = useL();
  const year = new Date().getFullYear();

  return (
    <footer className="mp-footer">
      <div className="mp-shell">
        <div className="mp-footer__top">
          <div>
            <div className="mp-footer__brand-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.company.logo.lockupLight}
                alt={c.company.legalName}
                width={c.company.logo.lockupSize.w}
                height={c.company.logo.lockupSize.h}
              />
            </div>
            <p className="mp-footer__tag">{c.company.description}</p>
            <p className="mp-footer__pe">
              <span className="mp-footer__pe-mark" aria-hidden="true">
                P.E.
              </span>
              <span>
                {c.leadership.name} · {c.leadership.credential}
                {c.company.registry ? (
                  <>
                    <br />
                    <span className="mp-footer__reg">{c.company.registry}</span>
                  </>
                ) : null}
              </span>
            </p>
          </div>

          <div className="mp-footer__cols">
            {c.footerNav.map((group) => (
              <div className="mp-footer__col" key={group.title}>
                <h2>{group.title}</h2>
                {group.items.map((item) => (
                  <Link key={item.href} href={l(item.href)}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}

            <div className="mp-footer__col">
              <h2>{c.ui.footer.services}</h2>
              {c.services.map((s) => (
                <Link key={s.slug} href={l(`/services/${s.slug}`)}>
                  {s.shortTitle}
                </Link>
              ))}
            </div>

            <div className="mp-footer__col">
              <h2>{c.ui.footer.contact}</h2>
              <a href={`mailto:${c.contact.email}`}>{c.contact.email}</a>
              {c.contact.phone ? (
                <a href={c.contact.phone.href}>{c.contact.phone.display}</a>
              ) : null}
              {c.contact.address ? (
                <span>
                  {c.contact.address.line1}
                  {c.contact.address.line2 ? `, ${c.contact.address.line2}` : ''}
                  {`, ${c.contact.address.city}, ${c.contact.address.state} ${c.contact.address.zip}`}
                </span>
              ) : null}
              <span>{c.contact.serviceAreaLabel}</span>
              {c.contact.social.linkedin ? (
                <a
                  href={c.contact.social.linkedin}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {c.ui.footer.linkedin}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mp-footer__notice">{c.legal.notice}</p>

        <div className="mp-footer__bottom">
          <span>
            © {year} {c.company.legalName}
          </span>
          <div className="mp-footer__legal">
            {c.legal.links.map((lk) => (
              <Link
                key={lk.href}
                href={lk.href === '/credits' ? lk.href : l(lk.href)}
              >
                {lk.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
