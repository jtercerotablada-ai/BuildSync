'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const r = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={r ? false : { opacity: 0, y: 26 }}
      whileInView={r ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/* Six services offered — kept in sync with the firm's scope of practice. */
const SERVICES = [
  'Reinforced Concrete Design',
  'Structural Design & Analysis',
  'BIM / ISO 19650 Coordination',
  'Building Recertification (40-Year / Milestone)',
  'Building Safety Inspection (SB-4-D)',
  'Peer Review & Due Diligence',
] as const;

const SERVICE_AREAS = ['Miami-Dade', 'Broward', 'South Florida'] as const;

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  service: string;
  message: string;
};

const EMPTY_FORM: ContactForm = {
  firstName: '',
  lastName: '',
  email: '',
  company: '',
  service: '',
  message: '',
};

function Crosshair() {
  return (
    <svg
      className="v2-area__mark"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path d="M7 0.5v13M0.5 7h13" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export default function ContactV2() {
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  const onField =
    (key: keyof ContactForm) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // TODO: wire this to a real backend / transactional-email endpoint.
    // No submission is sent yet — this only flips to the inline success state.
    setSubmitted(true);
  }

  function reset() {
    setForm(EMPTY_FORM);
    setSubmitted(false);
  }

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="v2-sec">
        <div className="v2-shell">
          <div className="v2-sec__head">
            <span className="v2-num">01</span>
            <span className="v2-sec__label">Contact</span>
          </div>

          <Reveal>
            <h1 className="v2-statement v2-contact-hero__title">
              Let&apos;s engineer it <em>right.</em>
            </h1>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="v2-contact-hero__sub">
              Tell us about the project — we&apos;ll respond with a clear scope
              and a Registered P.E. on point.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============ FORM + INFO ============ */}
      <section className="v2-sec">
        <div className="v2-shell">
          <div className="v2-contact-grid">
            {/* ---- LEFT: underline form ---- */}
            <Reveal className="v2-contact-grid__form">
              {submitted ? (
                <div
                  className="v2-form__success"
                  role="status"
                  aria-live="polite"
                >
                  <span className="v2-form__success-mark" aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                    >
                      <path
                        d="M4 10.5l4 4 8-9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </span>
                  <h2 className="v2-form__success-title">
                    Thanks — we&apos;ll be in touch.
                  </h2>
                  <p className="v2-form__success-text">
                    Your message is in. Expect a reply from a Registered P.E.
                    with next steps and a clear scope for the work.
                  </p>
                  <button
                    type="button"
                    className="v2-linkbtn"
                    onClick={reset}
                  >
                    Send another message <i>→</i>
                  </button>
                </div>
              ) : (
                <form className="v2-form" onSubmit={handleSubmit} noValidate>
                  <div className="v2-form__row">
                    <div className="v2-field">
                      <label className="v2-field__label" htmlFor="cf-first">
                        First name
                      </label>
                      <input
                        id="cf-first"
                        className="v2-field__input"
                        type="text"
                        name="firstName"
                        autoComplete="given-name"
                        placeholder="Jane"
                        value={form.firstName}
                        onChange={onField('firstName')}
                        required
                      />
                    </div>
                    <div className="v2-field">
                      <label className="v2-field__label" htmlFor="cf-last">
                        Last name
                      </label>
                      <input
                        id="cf-last"
                        className="v2-field__input"
                        type="text"
                        name="lastName"
                        autoComplete="family-name"
                        placeholder="Doe"
                        value={form.lastName}
                        onChange={onField('lastName')}
                        required
                      />
                    </div>
                  </div>

                  <div className="v2-field">
                    <label className="v2-field__label" htmlFor="cf-email">
                      Email
                    </label>
                    <input
                      id="cf-email"
                      className="v2-field__input"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="jane@company.com"
                      value={form.email}
                      onChange={onField('email')}
                      required
                    />
                  </div>

                  <div className="v2-field">
                    <label className="v2-field__label" htmlFor="cf-company">
                      Company <span className="v2-field__opt">optional</span>
                    </label>
                    <input
                      id="cf-company"
                      className="v2-field__input"
                      type="text"
                      name="company"
                      autoComplete="organization"
                      placeholder="Firm, developer, or owner"
                      value={form.company}
                      onChange={onField('company')}
                    />
                  </div>

                  <div className="v2-field v2-field--select">
                    <label className="v2-field__label" htmlFor="cf-service">
                      Service
                    </label>
                    <select
                      id="cf-service"
                      className="v2-field__input v2-field__select"
                      name="service"
                      value={form.service}
                      onChange={onField('service')}
                      required
                    >
                      <option value="" disabled>
                        Select a service…
                      </option>
                      {SERVICES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="v2-field">
                    <label className="v2-field__label" htmlFor="cf-message">
                      Message
                    </label>
                    <textarea
                      id="cf-message"
                      className="v2-field__input v2-field__textarea"
                      name="message"
                      rows={5}
                      placeholder="Scope, location, timeline, and what you need stamped."
                      value={form.message}
                      onChange={onField('message')}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="v2-btn v2-btn--solid v2-btn--lg v2-form__submit"
                  >
                    Send message <i>→</i>
                  </button>

                  <p className="v2-form__note">
                    We&apos;ll only use your details to reply to this inquiry.
                  </p>
                </form>
              )}
            </Reveal>

            {/* ---- RIGHT: contact info ---- */}
            <Reveal delay={0.1} className="v2-contact-grid__info">
              <div className="v2-info">
                <div className="v2-info__block">
                  <span className="v2-info__label v2-mono">Email</span>
                  <a
                    className="v2-info__value v2-info__link"
                    href="mailto:info@tercerotablada.com"
                  >
                    info@tercerotablada.com
                  </a>
                  <span className="v2-info__meta">
                    Best for scope, drawings, and permit questions.
                  </span>
                </div>

                <div className="v2-info__block">
                  <span className="v2-info__label v2-mono">Service area</span>
                  <span className="v2-info__value">Miami-Dade &amp; Broward, FL</span>
                  <span className="v2-info__meta">
                    On-site inspections and coordination across South Florida.
                  </span>
                </div>

                <div className="v2-info__block">
                  <span className="v2-info__label v2-mono">Phone &amp; address</span>
                  <span className="v2-info__value v2-info__value--muted">
                    Coming soon
                  </span>
                  <span className="v2-info__meta">
                    Direct line and office address are placeholders for now —
                    email is the fastest way to reach us.
                  </span>
                </div>

                <div className="v2-info__pe">
                  <span className="v2-info__pe-mark v2-mono">P.E.</span>
                  <p className="v2-info__pe-text">
                    Every project is reviewed and stamped by a{' '}
                    <span className="v2-accent">
                      Registered Professional Engineer
                    </span>{' '}
                    licensed in Florida — ACI 318, the Florida Building Code, and
                    ASCE 7 throughout.
                  </p>
                </div>

                <Link
                  className="v2-btn v2-btn--line v2-info__services-link"
                  href="/v2/services"
                >
                  See what we do <i>→</i>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ SERVICE-AREA STRIP ============ */}
      <section className="v2-sec v2-area">
        <div className="v2-shell">
          <div className="v2-sec__head">
            <span className="v2-num">02</span>
            <span className="v2-sec__label">Where we work</span>
          </div>

          <Reveal>
            <ul className="v2-area__list">
              {SERVICE_AREAS.map((a) => (
                <li key={a} className="v2-area__chip">
                  <Crosshair />
                  {a}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="v2-area__note">
              Structural engineering for South Florida — new construction,
              recertification, and safety inspections under the Florida Building
              Code.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}