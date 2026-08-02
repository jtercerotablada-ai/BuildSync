'use client';

import React, { useRef, useState } from 'react';
import { contactServiceOptions, legal } from '@/lib/ttc/site';

type Fields = {
  name: string;
  company: string;
  email: string;
  phone: string;
  location: string;
  service: string;
  message: string;
  timeline: string;
};

const EMPTY: Fields = {
  name: '',
  company: '',
  email: '',
  phone: '',
  location: '',
  service: '',
  message: '',
  timeline: '',
};

const TIMELINES = [
  'As soon as possible',
  'Within 1 month',
  '1–3 months',
  '3+ months',
  'Not yet defined',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<keyof Fields, string>>;

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Please enter your name';
  if (!f.email.trim()) e.email = 'Please enter an email address';
  else if (!EMAIL_RE.test(f.email.trim())) e.email = 'Check the email address';
  if (!f.service) e.service = 'Select the service you need';
  if (f.message.trim().length < 12)
    e.message = 'Tell us a little more about the project';
  return e;
}

/**
 * Contact form. Posts to the existing /api/contact route, which stores the
 * submission and notifies the office. The route accepts
 * `{ name, email, phone, service, message }`, so the extra qualifying fields
 * are appended to the message body rather than being silently dropped.
 *
 * Spam handling is a honeypot only — no third-party challenge, nothing that
 * blocks a keyboard or screen-reader user. Deliberately no "submitted too
 * fast" heuristic: on a lead form, silently discarding a real inquiry because
 * someone typed quickly or used autofill costs far more than the spam it
 * would stop.
 */
export function ContactForm() {
  const [f, setF] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const honeypot = useRef('');
  const formRef = useRef<HTMLFormElement>(null);

  const set =
    (k: keyof Fields) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setF((prev) => ({ ...prev, [k]: e.target.value }));
      if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
    };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    // Validate first, so a real person always sees why the form did not send.
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length) {
      const firstKey = Object.keys(found)[0];
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstKey}"]`)
        ?.focus();
      return;
    }

    // Honeypot: a hidden field only an automated filler would touch.
    if (honeypot.current) {
      setStatus('ok');
      return;
    }

    setStatus('busy');

    const extras = [
      f.company ? `Company: ${f.company}` : null,
      f.location ? `Project location: ${f.location}` : null,
      f.timeline ? `Desired timeline: ${f.timeline}` : null,
    ].filter(Boolean);

    const message = extras.length
      ? `${f.message.trim()}\n\n---\n${extras.join('\n')}`
      : f.message.trim();

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name.trim(),
          email: f.email.trim(),
          phone: f.phone.trim() || null,
          service: f.service,
          message,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Something went wrong on our side.');
      }
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      setServerError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please email us instead.',
      );
    }
  }

  if (status === 'ok') {
    return (
      <div className="mp-form__success" role="status" aria-live="polite">
        <span className="mp-form__success-mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <h3 className="mp-h3">Message received.</h3>
        <p className="mp-body" style={{ maxWidth: '48ch' }}>
          Thank you — your inquiry is with us. An engineer will review the scope
          and reply with next steps.
        </p>
        <button
          type="button"
          className="mp-link"
          onClick={() => {
            setF(EMPTY);
            setErrors({});
            setStatus('idle');
            honeypot.current = '';
          }}
        >
          Send another message <i aria-hidden="true">→</i>
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} className="mp-form" onSubmit={onSubmit} noValidate>
      {status === 'error' && serverError ? (
        <div className="mp-form__alert" role="alert">
          <span aria-hidden="true">!</span>
          <span>{serverError}</span>
        </div>
      ) : null}

      <div className="mp-form__row">
        <Field
          id="mp-name"
          name="name"
          label="Name"
          value={f.name}
          onChange={set('name')}
          error={errors.name}
          autoComplete="name"
          placeholder="Full name"
          required
        />
        <Field
          id="mp-company"
          name="company"
          label="Company"
          optional
          value={f.company}
          onChange={set('company')}
          autoComplete="organization"
          placeholder="Association, developer, firm"
        />
      </div>

      <div className="mp-form__row">
        <Field
          id="mp-email"
          name="email"
          label="Email"
          type="email"
          value={f.email}
          onChange={set('email')}
          error={errors.email}
          autoComplete="email"
          placeholder="you@company.com"
          required
        />
        <Field
          id="mp-phone"
          name="phone"
          label="Phone"
          optional
          type="tel"
          value={f.phone}
          onChange={set('phone')}
          autoComplete="tel"
          placeholder="(000) 000-0000"
        />
      </div>

      <div className="mp-form__row">
        <Field
          id="mp-location"
          name="location"
          label="Project location"
          optional
          value={f.location}
          onChange={set('location')}
          placeholder="City or county"
        />

        <div
          className="mp-field"
          data-invalid={errors.service ? 'true' : undefined}
        >
          <label className="mp-field__label" htmlFor="mp-service">
            Service needed
          </label>
          <select
            id="mp-service"
            name="service"
            className="mp-field__input mp-field__select"
            value={f.service}
            onChange={set('service')}
            aria-describedby={errors.service ? 'mp-service-err' : undefined}
            aria-invalid={errors.service ? true : undefined}
            required
          >
            <option value="">Select a service…</option>
            {contactServiceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.service ? (
            <span className="mp-field__error" id="mp-service-err">
              {errors.service}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mp-field">
        <label className="mp-field__label" htmlFor="mp-timeline">
          Desired timeline <span className="mp-field__opt">optional</span>
        </label>
        <select
          id="mp-timeline"
          name="timeline"
          className="mp-field__input mp-field__select"
          value={f.timeline}
          onChange={set('timeline')}
        >
          <option value="">No preference</option>
          {TIMELINES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div
        className="mp-field"
        data-invalid={errors.message ? 'true' : undefined}
      >
        <label className="mp-field__label" htmlFor="mp-message">
          Project description
        </label>
        <textarea
          id="mp-message"
          name="message"
          className="mp-field__input mp-field__textarea"
          rows={6}
          value={f.message}
          onChange={set('message')}
          placeholder="Building type, what you need engineered or inspected, and any deadline you are working to."
          aria-describedby={errors.message ? 'mp-message-err' : undefined}
          aria-invalid={errors.message ? true : undefined}
          required
        />
        {errors.message ? (
          <span className="mp-field__error" id="mp-message-err">
            {errors.message}
          </span>
        ) : null}
      </div>

      {/* Honeypot — hidden from users and assistive tech, visible to bots. */}
      <div className="mp-form__hp" aria-hidden="true">
        <label htmlFor="mp-website">Website</label>
        <input
          id="mp-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          onChange={(e) => {
            honeypot.current = e.target.value;
          }}
        />
      </div>

      <div className="mp-form__actions">
        <button
          type="submit"
          className="mp-btn mp-btn--solid"
          data-busy={status === 'busy' ? 'true' : undefined}
          aria-busy={status === 'busy'}
        >
          {status === 'busy' ? (
            <span className="mp-spinner" aria-hidden="true" />
          ) : null}
          <span>{status === 'busy' ? 'Sending' : 'Send inquiry'}</span>
          {status === 'busy' ? null : (
            <span className="mp-btn__arrow" aria-hidden="true">
              →
            </span>
          )}
        </button>
      </div>

      <p className="mp-form__note">{legal.contactFormNotice}</p>
    </form>
  );
}

/* ── field ───────────────────────────────────────────────────────────────── */

function Field({
  id,
  name,
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  autoComplete,
  required,
  optional,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="mp-field" data-invalid={error ? 'true' : undefined}>
      <label className="mp-field__label" htmlFor={id}>
        {label}
        {optional ? <span className="mp-field__opt"> optional</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        className="mp-field__input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      {error ? (
        <span className="mp-field__error" id={`${id}-err`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
