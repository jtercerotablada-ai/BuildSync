'use client';

import React from 'react';
import Link from 'next/link';
import { imagery } from '@/lib/ttc/site';
import { DarkHeroSentinel, Reveal, RevealText, TextLink } from './primitives';
import { Img, MotionToggle, VideoLoop } from './media';
import { accentLines } from './text';
import { useContent, useL } from './lang';
import { ContactForm } from './ContactForm';

/**
 * The home page's sections after the ribbon-less top, laid out after
 * emxse.com (the owner, 2026-10-23: "cópialo al 100%"). Their layout and
 * order, our words and photographs — see `home` in site.ts for the list.
 * Styles: mp-firm.css, section 3.
 */

/** 1 · Full-screen video; nothing on it but "Get in touch" and the toggle. */
export function FirmHero() {
  const c = useContent();
  return (
    <section className="mp-fhero mp-surface--graphite" aria-label={c.company.name}>
      <div className="mp-fhero__video" aria-hidden="true">
        <VideoLoop clip={imagery.hero} priority />
      </div>
      <div className="mp-shell mp-fhero__foot">
        {/* A plain anchor to the form at the foot of this page (as on
            emxse.com), so the smooth-scroll handler lands it below the
            header; see Hero.tsx's note on #hash links. */}
        <a href="#contact" className="mp-fhero__cta">
          {c.home.getInTouch}
          <span className="mp-fhero__arrow" aria-hidden="true">
            ↗
          </span>
        </a>
        <MotionToggle />
      </div>
      <DarkHeroSentinel />
    </section>
  );
}

/** 2 · The H1 left, the lede right. */
export function FirmIntro() {
  const c = useContent();
  const l = useL();
  const h = c.hero;
  return (
    <section className="mp-section mp-surface--paper mp-fintro" aria-labelledby="mp-hero-title">
      <div className="mp-shell mp-fintro__grid">
        <RevealText
          as="h1"
          id="mp-hero-title"
          className="mp-fintro__title"
          lines={accentLines(h.titleLines, h.accentWord)}
        />
        <Reveal delay={0.05} className="mp-fintro__side">
          <p className="mp-fintro__lede">{h.sub}</p>
          <p className="mp-fintro__firm">{c.home.firm}</p>
          <p className="mp-fintro__links">
            <TextLink href={l(h.primary.href)}>{h.primary.label}</TextLink>
            <TextLink href={l(h.secondary.href)}>{h.secondary.label}</TextLink>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/** 4 · A featured service on the left; three staggered cards on the right. */
export function FirmWork() {
  const c = useContent();
  const l = useL();
  const w = c.home.work;
  const feature = c.services.find((s) => s.slug === c.home.feature.slug);
  const items = w.items
    .map((it) => ({ it, s: c.services.find((s) => s.slug === it.slug) }))
    .filter((x) => x.s);

  return (
    <section className="mp-section mp-surface--paper mp-fwork" aria-labelledby="mp-fwork-title">
      <div className="mp-shell mp-fwork__grid">
        {feature ? (
          <div className="mp-fwork__feature">
            <h2 className="mp-fwork__label">{c.home.feature.label}</h2>
            <Link href={l(`/services/${feature.slug}`)} className="mp-fwork__card">
              <span className="mp-fwork__photo">
                <Img photo={imagery.services[feature.slug]} sizes="(max-width: 900px) 100vw, 25vw" />
              </span>
              <span className="mp-fwork__name">{feature.title}</span>
            </Link>
            <p className="mp-fwork__when">{c.home.feature.line}</p>
          </div>
        ) : null}

        <div className="mp-fwork__main">
          <div className="mp-fwork__head">
            <h2 id="mp-fwork-title" className="mp-fwork__label">
              {w.label}
            </h2>
            <TextLink href={l(w.more.href)}>{w.more.label}</TextLink>
          </div>
          <ul className="mp-fwork__list">
            {items.map(({ it, s }) => (
              <li key={it.slug}>
                <Link href={l(`/services/${s!.slug}`)} className="mp-fwork__card">
                  <span className="mp-fwork__photo">
                    <Img photo={imagery.services[s!.slug]} sizes="(max-width: 900px) 100vw, 25vw" />
                  </span>
                  <span className="mp-fwork__name">{s!.title}</span>
                  <span className="mp-fwork__sub">{it.sub}</span>
                </Link>
                <p className="mp-fwork__when">{it.line}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** 5 · One sentence, white then grey, beside a square photograph. */
export function FirmStatement() {
  const c = useContent();
  const t = c.home.statement;
  return (
    <section className="mp-section mp-surface--paper mp-fstate">
      <div className="mp-shell mp-fstate__grid">
        <Reveal>
          <p className="mp-fstate__text">
            <span className="mp-fstate__strong">{t.strong}</span> <span className="mp-fstate__soft">{t.soft}</span>
          </p>
        </Reveal>
        <Reveal delay={0.06} className="mp-fstate__photo">
          <Img photo={imagery.home.statement} sizes="(max-width: 900px) 100vw, 40vw" />
        </Reveal>
      </div>
    </section>
  );
}

/** 6 · A full-width photograph, in black and white. */
export function FirmBand() {
  return (
    <div className="mp-fband" aria-hidden="true">
      <Img photo={imagery.home.band} sizes="100vw" />
    </div>
  );
}

/** 7 · The licenses as a staggered list, a heading and the partner lede. */
export function FirmCredentials() {
  const c = useContent();
  const t = c.home.credentials;
  return (
    <section className="mp-section mp-surface--paper mp-fcred" aria-labelledby="mp-fcred-title">
      <div className="mp-shell mp-fcred__grid">
        <div>
          <p className="mp-fcred__label">{t.label}</p>
          <ul className="mp-fcred__list">
            {t.items.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <Reveal delay={0.05}>
          <h2 id="mp-fcred-title" className="mp-fcred__title">
            {t.title}
          </h2>
          <p className="mp-fcred__body">{c.partner.lede}</p>
          <p className="mp-fcred__body mp-fcred__team">{t.team}</p>
        </Reveal>
      </div>
    </section>
  );
}

/** 8 · "Get in touch." and the form. */
export function FirmContact() {
  const c = useContent();
  return (
    <section id="contact" className="mp-section mp-surface--paper mp-fcontact" aria-labelledby="mp-fcontact-title">
      <div className="mp-shell">
        <h2 id="mp-fcontact-title" className="mp-fcontact__title">
          {c.home.contact.title}
        </h2>
        <p className="mp-fcontact__lede">{c.home.contact.lede}</p>
        <ContactForm />
      </div>
    </section>
  );
}
