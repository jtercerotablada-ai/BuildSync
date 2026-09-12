'use client';

import React, { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import {
  CONTACT_ACCEPT,
  CONTACT_BLOB_ACCESS,
  CONTACT_MAX_BYTES,
  CONTACT_MAX_FILES,
  isContactFileAllowed,
  type ContactAttachment,
} from '@/lib/contact-attachments';
import { useContent, useLang } from './lang';

type Fields = {
  name: string;
  email: string;
  phone: string;
  company: string;
  location: string;
  service: string;
  message: string;
};

const EMPTY: Fields = {
  name: '',
  email: '',
  phone: '',
  company: '',
  location: '',
  service: '',
  message: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<keyof Fields, string>>;

type Pending = {
  id: string;
  file: File;
  state: 'uploading' | 'done' | 'error';
  progress: number;
  result?: ContactAttachment;
  error?: string;
};

/**
 * Proposal request. Required: name, email, service, location, description.
 * Optional: phone, company, up to five attachments.
 *
 * Attachments go browser → blob storage through /api/contact/upload (a route
 * handler cannot carry a scanned notice); see CONTACT_BLOB_ACCESS for why the
 * blobs are public-but-unguessable today. The form only sends the resulting
 * URLs; the server re-validates each one. A file that is still
 * uploading blocks submission so nothing arrives half-attached.
 *
 * Spam handling is a honeypot only — no third-party challenge, nothing that
 * blocks a keyboard or screen-reader user.
 */
export function ContactForm({ presetService }: { presetService?: string }) {
  const c = useContent();
  const lang = useLang();
  const t = c.ui.form;
  const [f, setF] = useState<Fields>({ ...EMPTY, service: presetService ?? '' });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [ref, setRef] = useState<string>('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const honeypot = useRef('');
  const formRef = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const batch = useRef<string>('');

  const set =
    (k: keyof Fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setF((prev) => ({ ...prev, [k]: e.target.value }));
      if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
    };

  function validate(v: Fields): Errors {
    const e: Errors = {};
    if (!v.name.trim()) e.name = t.errors.name;
    if (!v.email.trim()) e.email = t.errors.email;
    else if (!EMAIL_RE.test(v.email.trim())) e.email = t.errors.emailFormat;
    if (!v.service) e.service = t.errors.service;
    if (!v.location.trim()) e.location = t.errors.location;
    if (v.message.trim().length < 12) e.message = t.errors.message;
    return e;
  }

  /* ── attachments ───────────────────────────────────────────────────────── */

  function updatePending(id: string, patch: Partial<Pending>) {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setFileError(null);
    if (!batch.current) {
      batch.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const room = CONTACT_MAX_FILES - pending.filter((p) => p.state !== 'error').length;
    const files = Array.from(list);
    if (files.length > room) {
      setFileError(t.errors.fileCount);
    }
    for (const file of files.slice(0, Math.max(0, room))) {
      if (file.size > CONTACT_MAX_BYTES) {
        setFileError(t.errors.fileSize);
        continue;
      }
      if (!isContactFileAllowed(file.name, file.type)) {
        setFileError(t.errors.fileType);
        continue;
      }
      const id = `${file.name}-${file.size}-${Date.now()}`;
      setPending((prev) => [...prev, { id, file, state: 'uploading', progress: 0 }]);
      const mimeType = file.type || 'application/octet-stream';
      try {
        const safeName = file.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 120);
        const blob = await upload(`contact/${batch.current}/${safeName}`, file, {
          access: CONTACT_BLOB_ACCESS,
          handleUploadUrl: '/api/contact/upload',
          contentType: mimeType,
          clientPayload: JSON.stringify({ kind: 'contact-attachment', mimeType }),
          onUploadProgress: ({ percentage }) => updatePending(id, { progress: percentage }),
        });
        updatePending(id, {
          state: 'done',
          progress: 100,
          result: { url: blob.url, name: file.name, size: file.size, type: mimeType },
        });
      } catch (err) {
        const message =
          err instanceof Error && /429|Too many/i.test(err.message)
            ? t.errors.tooMany
            : t.errors.upload;
        updatePending(id, { state: 'error', error: message });
      }
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  function removeFile(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  /* ── submit ────────────────────────────────────────────────────────────── */

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length) {
      const firstKey = Object.keys(found)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      return;
    }
    if (pending.some((p) => p.state === 'uploading')) {
      setFileError(t.uploading + '…');
      return;
    }
    if (honeypot.current) {
      setStatus('ok');
      return;
    }

    setStatus('busy');
    const files = pending.filter((p) => p.state === 'done' && p.result).map((p) => p.result!);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name.trim(),
          email: f.email.trim(),
          phone: f.phone.trim() || null,
          company: f.company.trim() || null,
          location: f.location.trim(),
          service: f.service,
          message: f.message.trim(),
          lang,
          files: files.length ? files : null,
        }),
      });
      if (!res.ok) {
        // The server's own text is a Zod message: English-only and phrased for
        // a developer ("Too big: expected string to have <=5000 characters").
        // Rate limiting is the one case worth naming; everything else gets the
        // form's localised fallback.
        throw new Error(res.status === 429 ? t.errors.tooMany : t.errors.generic);
      }
      const body = (await res.json().catch(() => null)) as { ref?: string; confirmed?: boolean } | null;
      setRef(body?.ref ?? '');
      setConfirmed(Boolean(body?.confirmed));
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      setServerError(err instanceof Error ? err.message : t.errors.generic);
    }
  }

  /* ── success ───────────────────────────────────────────────────────────── */

  if (status === 'ok') {
    return (
      <div className="mp-form__success" role="status" aria-live="polite">
        <span className="mp-form__success-mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <h3 className="mp-h3">{t.successTitle}</h3>
        <p className="mp-body" style={{ maxWidth: '52ch' }}>
          {t.successBody}
          {confirmed ? <> {t.successConfirmed}</> : null}
          {ref ? (
            <>
              {' '}
              <span className="mp-form__ref">
                {t.successRef}: <b>{ref}</b>
              </span>
            </>
          ) : null}
        </p>
        <div className="mp-form__next">
          <h4>{t.whatNext}</h4>
          <ol>
            {t.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <p className="mp-form__note">
          {t.directEmail} <a href={`mailto:${c.contact.email}`}>{c.contact.email}</a>
        </p>
        <button
          type="button"
          className="mp-link"
          onClick={() => {
            setF({ ...EMPTY });
            setErrors({});
            setPending([]);
            setFileError(null);
            setStatus('idle');
            setRef('');
            setConfirmed(false);
            honeypot.current = '';
            batch.current = '';
          }}
        >
          {t.sendAnother} <i aria-hidden="true">→</i>
        </button>
      </div>
    );
  }

  /* ── form ──────────────────────────────────────────────────────────────── */

  const busy = status === 'busy';
  const uploading = pending.some((p) => p.state === 'uploading');

  return (
    <form ref={formRef} className="mp-form" onSubmit={onSubmit} noValidate>
      {status === 'error' && serverError ? (
        <div className="mp-form__alert" role="alert">
          <span aria-hidden="true">!</span>
          <span>{serverError}</span>
        </div>
      ) : null}

      <div className="mp-form__row">
        <Field id="mp-name" name="name" label={t.name} value={f.name} onChange={set('name')} error={errors.name} autoComplete="name" maxLength={120} required />
        <Field id="mp-email" name="email" label={t.email} type="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="email" maxLength={200} required />
      </div>

      <div className="mp-form__row">
        <div className="mp-field" data-invalid={errors.service ? 'true' : undefined}>
          <label className="mp-field__label" htmlFor="mp-service">
            {t.service}
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
            <option value="">{t.selectService}</option>
            {c.contactServiceOptions.map((s) => (
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
        <Field id="mp-location" name="location" label={t.location} value={f.location} onChange={set('location')} error={errors.location} placeholder={t.locationPlaceholder} autoComplete="address-level2" maxLength={160} required />
      </div>

      <div className="mp-field" data-invalid={errors.message ? 'true' : undefined}>
        <label className="mp-field__label" htmlFor="mp-message">
          {t.message}
        </label>
        <textarea
          id="mp-message"
          name="message"
          className="mp-field__input mp-field__textarea"
          rows={6}
          maxLength={5000}
          value={f.message}
          onChange={set('message')}
          placeholder={t.messagePlaceholder}
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

      {/* Attachments */}
      <div className="mp-field mp-files">
        <span className="mp-field__label" id="mp-files-label">
          {t.attachments} <span className="mp-field__opt">{t.optional}</span>
        </span>
        <p className="mp-files__hint" id="mp-files-hint">
          {t.attachmentsHint}
        </p>
        <input
          ref={fileInput}
          id="mp-files"
          type="file"
          className="mp-form__hp"
          multiple
          accept={CONTACT_ACCEPT}
          aria-labelledby="mp-files-label"
          aria-describedby="mp-files-hint"
          onChange={(e) => void addFiles(e.target.files)}
          disabled={busy}
        />
        <div className="mp-files__row">
          <label htmlFor="mp-files" className="mp-btn mp-btn--line mp-files__add">
            <span>{t.addFiles}</span>
            <span aria-hidden="true">+</span>
          </label>
          {fileError ? (
            <span className="mp-field__error" role="alert">
              {fileError}
            </span>
          ) : null}
        </div>
        {pending.length ? (
          <ul className="mp-files__list" aria-live="polite">
            {pending.map((p) => (
              <li key={p.id} className="mp-files__item" data-state={p.state}>
                <span className="mp-files__name">{p.file.name}</span>
                <span className="mp-files__meta">
                  {p.state === 'uploading'
                    ? `${t.uploading} ${Math.round(p.progress)}%`
                    : p.state === 'error'
                      ? p.error
                      : `${Math.max(1, Math.round(p.file.size / 1024))} KB`}
                </span>
                <span className="mp-files__bar" aria-hidden="true">
                  <span style={{ width: `${p.state === 'done' ? 100 : p.progress}%` }} />
                </span>
                <button
                  type="button"
                  className="mp-files__remove"
                  onClick={() => removeFile(p.id)}
                  aria-label={`${t.removeFile} ${p.file.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mp-form__row">
        <Field id="mp-phone" name="phone" label={t.phone} optional optionalLabel={t.optional} type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" maxLength={40} />
        <Field id="mp-company" name="company" label={t.company} optional optionalLabel={t.optional} value={f.company} onChange={set('company')} autoComplete="organization" placeholder={t.companyPlaceholder} maxLength={160} />
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
          data-busy={busy || uploading ? 'true' : undefined}
          aria-busy={busy}
          disabled={busy || uploading}
        >
          {busy ? <span className="mp-spinner" aria-hidden="true" /> : null}
          <span>{busy ? t.sending : uploading ? t.uploading : t.send}</span>
          {busy ? null : (
            <span className="mp-btn__arrow" aria-hidden="true">
              →
            </span>
          )}
        </button>
        <span className="mp-form__note" style={{ margin: 0 }}>
          {c.contact.responseNote}
        </span>
      </div>

      <p className="mp-form__note">{c.legal.contactFormNotice}</p>
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
  optionalLabel,
  maxLength,
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
  optionalLabel?: string;
  /** Mirrors the server's Zod cap so the value never gets there to be rejected. */
  maxLength?: number;
}) {
  return (
    <div className="mp-field" data-invalid={error ? 'true' : undefined}>
      <label className="mp-field__label" htmlFor={id}>
        {label}
        {optional ? <span className="mp-field__opt"> {optionalLabel}</span> : null}
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
        maxLength={maxLength}
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
