'use client';

import React, { useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import {
  CONTACT_ACCEPT,
  CONTACT_BLOB_ACCESS,
  CONTACT_MAX_BYTES,
  CONTACT_MAX_FILES,
  isContactFileAllowed,
  type ContactAttachment,
} from '@/lib/contact-attachments';
import { getContent, type SiteContent } from '@/lib/ttc/content';
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

/** Files moving at once. Enough to hide per-request latency on a phone
 *  without splitting a thin uplink five ways. */
const UPLOAD_CONCURRENCY = 3;

/**
 * A message the form wrote itself (rate limit, generic refusal). Anything else
 * that reaches the submit catch — a fetch TypeError, a body that is not JSON —
 * carries the BROWSER's text ("Failed to fetch", "Load failed"), which is
 * English, technical and useless to the visitor, so it is never shown.
 */
class FormMessage extends Error {}

/* The blob upload client (~15 KB gzipped) is imported statically, on
   purpose. Loading it on demand was tried and reverted: Turbopack caches a
   FAILED chunk load for the life of the page, so one flaky fetch left every
   later attachment — and every Retry — failing until a reload, while the
   saving was 15 KB on this one page. */

/* ── ?service= preset ──────────────────────────────────────────────────────── */

const BUNDLES = [getContent('en'), getContent('es')];
const norm = (s: string) => s.trim().toLocaleLowerCase();

/**
 * Map a `?service=` value to an option of THIS language's dropdown, or ''.
 *
 * Service pages link with the slug; older links (and a visitor who switched
 * language) carry a label in either language. A slug or a service label maps
 * through the service itself, so the preset survives the language switch and
 * a renamed shortTitle; the extra options that are not services ("Other / not
 * sure yet") map by position. Anything else becomes '' — the dropdown must
 * never show its placeholder while state holds a value the server will refuse.
 */
function presetOption(preset: unknown, c: SiteContent): string {
  if (typeof preset !== 'string' || !preset.trim()) return '';
  const v = norm(preset);
  const toOption = (slug: string) => {
    const title = c.services.find((s) => s.slug === slug)?.shortTitle;
    return title && c.contactServiceOptions.includes(title) ? title : '';
  };
  if (c.services.some((s) => s.slug === v)) return toOption(v);
  const extras = (b: SiteContent) =>
    b.contactServiceOptions.filter((o) => !b.services.some((s) => s.shortTitle === o));
  for (const b of BUNDLES) {
    const service = b.services.find((s) => norm(s.shortTitle) === v);
    if (service) return toOption(service.slug);
    const i = extras(b).findIndex((o) => norm(o) === v);
    if (i >= 0) return extras(c)[i] ?? '';
  }
  return '';
}

/* ── scroll + focus ────────────────────────────────────────────────────────── */

type LenisLike = {
  scrollTo: (target: number) => void;
  resize?: () => void;
};

/**
 * Bring a block the visitor has to see — the result of a send, the first
 * field to fix — to just under the fixed header, then put focus on it.
 *
 * Without this the result lands off-screen: the success block replaces a
 * ~1500px form (so on a phone it ends up entirely above the viewport) and the
 * error alert sits at the top of the form while the visitor is at the button.
 * The Send button was disabled while sending, so focus had already fallen to
 * <body>; focusing the result is also what makes a screen reader announce it.
 *
 * The offset is the header's real height (68 / 76 / 96px by breakpoint) plus
 * 16px, and the target is computed here as a number. Lenis is then told the
 * number, not the element: for an element it subtracts the page's own
 * scroll-padding-top as well, which would double the offset the moment one
 * is set, and it measures from its last-known position — stale right now,
 * because the page just changed height, hence `resize()` first. Without Lenis
 * (reduced motion) a plain scroll to the same number; scrollIntoView would
 * park the block under the header. A block already sitting in the upper half
 * of the view is not moved at all.
 */
function reveal(block: HTMLElement | null, focusTarget: HTMLElement | null = block) {
  if (!block) return;
  const header = document.querySelector<HTMLElement>('.mp-header');
  const offset = (header?.getBoundingClientRect().height ?? 0) + 16;
  const rect = block.getBoundingClientRect();
  const inView =
    rect.top >= offset && (rect.bottom <= window.innerHeight || rect.top <= window.innerHeight / 2);
  if (!inView) {
    const top = Math.max(0, window.scrollY + rect.top - offset);
    const lenis = (window as unknown as { __ttcLenis?: LenisLike }).__ttcLenis;
    if (lenis) {
      lenis.resize?.();
      lenis.scrollTo(top);
    } else {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    }
  }
  // Programmatic focus on a non-interactive target: no ring (see the
  // `:focus` rules for these classes), but the reader lands here.
  focusTarget?.focus({ preventScroll: true });
}

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
  const [f, setF] = useState<Fields>(() => ({ ...EMPTY, service: presetOption(presetService, c) }));
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [ref, setRef] = useState<string>('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  // Text of the persistent live region. It is mounted, empty, from the first
  // render: a region that appears already holding its text (as the success
  // block used to) is announced unreliably, NVDA and JAWS especially.
  const [announcement, setAnnouncement] = useState('');
  const honeypot = useRef('');
  const formRef = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const successTitleRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const restarted = useRef(false);
  const batch = useRef<string>('');

  // The attachment list, as the upload code sees it. Uploads resolve long
  // after the render that started them, so they read and write through this
  // ref — never a render's `pending` — and the state mirrors it for display.
  const pendingRef = useRef<Pending[]>([]);
  const queue = useRef<string[]>([]);
  const active = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  const seq = useRef(0);
  // Set when the form unmounts: nothing queued may start after that.
  const unmounted = useRef(false);

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
    // One of THIS language's options — the server accepts nothing else, and a
    // value the <select> cannot show would otherwise pass as "chosen".
    if (!c.contactServiceOptions.includes(v.service)) e.service = t.errors.service;
    if (!v.location.trim()) e.location = t.errors.location;
    if (v.message.trim().length < 12) e.message = t.errors.message;
    return e;
  }

  // The result of a send (or a fresh form after "Send another") is brought
  // into view and focused once it is in the DOM.
  useEffect(() => {
    if (status === 'ok') {
      reveal(successRef.current, successTitleRef.current);
    } else if (status === 'error') {
      reveal(alertRef.current);
    } else if (status === 'idle' && restarted.current) {
      restarted.current = false;
      reveal(formRef.current, formRef.current?.querySelector<HTMLElement>('[name="name"]') ?? null);
    }
  }, [status]);

  // Leaving the page mid-upload stops the transfers: nothing will ever send
  // those blobs, so finishing them only spends the visitor's data plan. The
  // queue is emptied FIRST — each aborted upload settles into pump(), which
  // would otherwise start the files still waiting for a slot, on the next
  // page, with controllers nobody aborts. (Reset to false in the body, so
  // React StrictMode's dev mount → cleanup → mount leaves it false.)
  useEffect(() => {
    unmounted.current = false;
    const inFlight = controllers.current;
    return () => {
      unmounted.current = true;
      queue.current = [];
      inFlight.forEach((ctl) => ctl.abort());
    };
  }, []);

  /* ── attachments ───────────────────────────────────────────────────────── */

  function writePending(next: Pending[]) {
    pendingRef.current = next;
    setPending(next);
  }

  function patchPending(id: string, patch: Partial<Pending>) {
    writePending(pendingRef.current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  /**
   * Every accepted file is listed at once (as "Uploading") and then uploaded
   * through one shared pool of UPLOAD_CONCURRENCY. Uploading one file at a
   * time and listing each only when the previous one settled made a visitor
   * who picked five photos see one — and add the rest again.
   */
  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    // Clear the input now so choosing the same file again still fires change.
    if (fileInput.current) fileInput.current.value = '';
    if (!batch.current) {
      batch.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const current = pendingRef.current;
    const live = current.filter((p) => p.state !== 'error');
    const key = (file: File) => `${file.name}|${file.size}|${file.lastModified}`;
    const listed = new Set(live.map((p) => key(p.file)));
    // Choosing again a file whose upload FAILED is the natural reaction to the
    // error — it revives that row rather than adding a twin beside it, which
    // a later Retry on the old row would turn into the same file sent twice.
    // The row takes the File just picked: the old handle may no longer be
    // readable (the file was moved), which is exactly why it failed.
    const errored = new Map(
      current.filter((p) => p.state === 'error').map((p) => [key(p.file), p.id] as const),
    );
    const revive: [string, File][] = [];
    const rejected = new Map<string, string[]>();
    const reject = (reason: string, name: string) =>
      rejected.set(reason, [...(rejected.get(reason) ?? []), name]);

    const accepted: File[] = [];
    for (const file of files) {
      if (file.size > CONTACT_MAX_BYTES) reject(t.errors.fileSize, file.name);
      else if (!isContactFileAllowed(file.name, file.type)) reject(t.errors.fileType, file.name);
      // Already in the list (picked twice): nothing to do, it is visible there.
      else if (!listed.has(key(file))) {
        listed.add(key(file));
        const failedId = errored.get(key(file));
        if (failedId) revive.push([failedId, file]);
        else accepted.push(file);
      }
    }
    const room = Math.max(0, CONTACT_MAX_FILES - live.length);
    const revived = revive.slice(0, room);
    const fresh = accepted.slice(0, room - revived.length);
    const messages = [...rejected].map(([reason, names]) => `${names.join(', ')} — ${reason}`);
    if (revive.length + accepted.length > room) messages.push(t.errors.fileCount);
    setFileError(messages.length ? messages.join(' ') : null);

    const added: Pending[] = fresh.map((file) => ({
      id: `f${++seq.current}`,
      file,
      state: 'uploading',
      progress: 0,
    }));
    if (!added.length && !revived.length) return;
    const again = new Map(revived);
    writePending([
      ...current.map((p) => {
        const file = again.get(p.id);
        return file ? { ...p, file, state: 'uploading' as const, progress: 0, error: undefined } : p;
      }),
      ...added,
    ]);
    queue.current.push(...revived.map(([id]) => id), ...added.map((p) => p.id));
    pump();
  }

  /** Start queued uploads while the pool has room. */
  function pump() {
    if (unmounted.current) return;
    while (active.current < UPLOAD_CONCURRENCY && queue.current.length) {
      const id = queue.current.shift()!;
      const entry = pendingRef.current.find((p) => p.id === id);
      if (!entry || entry.state !== 'uploading') continue; // removed while queued
      active.current += 1;
      void uploadOne(entry).finally(() => {
        active.current -= 1;
        pump();
      });
    }
  }

  async function uploadOne(p: Pending) {
    const controller = new AbortController();
    controllers.current.set(p.id, controller);
    const mimeType = p.file.type || 'application/octet-stream';
    try {
      const safeName = p.file.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 120);
      let shown = 0;
      const blob = await upload(`contact/${batch.current}/${safeName}`, p.file, {
        access: CONTACT_BLOB_ACCESS,
        handleUploadUrl: '/api/contact/upload',
        contentType: mimeType,
        clientPayload: JSON.stringify({ kind: 'contact-attachment', mimeType }),
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => {
          // Re-render on whole-percent steps only; progress events are dense.
          const pct = Math.round(percentage);
          if (pct !== shown) {
            shown = pct;
            patchPending(p.id, { progress: pct });
          }
        },
      });
      patchPending(p.id, {
        state: 'done',
        progress: 100,
        result: { url: blob.url, name: p.file.name, size: p.file.size, type: mimeType },
      });
    } catch (err) {
      if (controller.signal.aborted) return; // removed by the visitor
      const message =
        err instanceof Error && /429|Too many/i.test(err.message)
          ? t.errors.tooMany
          : t.errors.upload;
      patchPending(p.id, { state: 'error', error: message });
    } finally {
      controllers.current.delete(p.id);
    }
  }

  function retryFile(id: string) {
    // A failed file does not hold a slot; taking one back must still fit.
    const live = pendingRef.current.filter((p) => p.state !== 'error').length;
    if (live >= CONTACT_MAX_FILES) {
      setFileError(t.errors.fileCount);
      return;
    }
    setFileError(null);
    patchPending(id, { state: 'uploading', progress: 0, error: undefined });
    queue.current.push(id);
    pump();
  }

  function removeFile(id: string) {
    controllers.current.get(id)?.abort();
    writePending(pendingRef.current.filter((p) => p.id !== id));
  }

  /* ── submit ────────────────────────────────────────────────────────────── */

  function succeed(reference: string, didConfirm: boolean) {
    setRef(reference);
    setConfirmed(didConfirm);
    // The focused heading reads the title; the region adds the rest.
    setAnnouncement(
      [t.successBody, didConfirm ? t.successConfirmed : '', reference ? `${t.successRef}: ${reference}` : '']
        .filter(Boolean)
        .join(' '),
    );
    setStatus('ok');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const found = validate(f);
    setErrors(found);
    const firstKey = Object.keys(found)[0];
    if (firstKey) {
      const input = formRef.current?.querySelector<HTMLElement>(`[name="${firstKey}"]`) ?? null;
      reveal(input?.closest<HTMLElement>('.mp-field') ?? input, input);
      return;
    }
    if (pendingRef.current.some((p) => p.state === 'uploading')) {
      setFileError(t.uploading + '…');
      return;
    }
    if (honeypot.current) {
      succeed('', false);
      return;
    }

    setStatus('busy');
    const files = pendingRef.current
      .filter((p) => p.state === 'done' && p.result)
      .map((p) => p.result!);

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
        throw new FormMessage(res.status === 429 ? t.errors.tooMany : t.errors.generic);
      }
      // The route always answers JSON. A 2xx that is not JSON did not come
      // from it (something between us answered instead), so it is not a
      // confirmed send — it falls to the network message below.
      const body: unknown = await res.json();
      if (!body || typeof body !== 'object') throw new Error('Unexpected response');
      const { ref: reference, confirmed: didConfirm } = body as { ref?: unknown; confirmed?: unknown };
      succeed(typeof reference === 'string' ? reference : '', didConfirm === true);
    } catch (err) {
      setStatus('error');
      setServerError(err instanceof FormMessage ? err.message : t.errors.network);
    }
  }

  function restart() {
    controllers.current.forEach((ctl) => ctl.abort());
    controllers.current.clear();
    queue.current = [];
    writePending([]);
    setF({ ...EMPTY });
    setErrors({});
    setFileError(null);
    setRef('');
    setConfirmed(false);
    setAnnouncement('');
    honeypot.current = '';
    batch.current = '';
    restarted.current = true;
    setStatus('idle');
  }

  const liveRegion = (
    <div className="mp-sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );

  /* ── success ───────────────────────────────────────────────────────────── */

  if (status === 'ok') {
    return (
      <>
        {liveRegion}
        <div ref={successRef} className="mp-form__success">
          <span className="mp-form__success-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          {/* Focus target after a send (tabIndex -1: reachable by script only). */}
          <h3 ref={successTitleRef} className="mp-h3 mp-form__success-title" tabIndex={-1}>
            {t.successTitle}
          </h3>
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
          <button type="button" className="mp-link" onClick={restart}>
            {t.sendAnother} <i aria-hidden="true">→</i>
          </button>
        </div>
      </>
    );
  }

  /* ── form ──────────────────────────────────────────────────────────────── */

  const busy = status === 'busy';
  const uploading = pending.some((p) => p.state === 'uploading');
  const failed = status === 'error' && serverError ? serverError : null;

  return (
    <>
      {liveRegion}
      <form ref={formRef} className="mp-form" onSubmit={onSubmit} noValidate>
        {failed ? (
          <div ref={alertRef} className="mp-form__alert" role="alert" tabIndex={-1}>
            <span aria-hidden="true">!</span>
            <span>{failed}</span>
          </div>
        ) : null}

        <div className="mp-form__row">
          <Field id="mp-name" name="name" label={t.name} value={f.name} onChange={set('name')} error={errors.name} autoComplete="name" autoCapitalize="words" spellCheck={false} maxLength={120} required />
          <Field id="mp-email" name="email" label={t.email} type="email" inputMode="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={200} required />
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
          <Field id="mp-location" name="location" label={t.location} value={f.location} onChange={set('location')} error={errors.location} placeholder={t.locationPlaceholder} autoComplete="address-level2" autoCapitalize="words" maxLength={160} required />
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
            autoCapitalize="sentences"
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
            className="mp-sr-only"
            multiple
            accept={CONTACT_ACCEPT}
            aria-labelledby="mp-files-label"
            aria-describedby={fileError ? 'mp-files-hint mp-files-err' : 'mp-files-hint'}
            onChange={(e) => addFiles(e.target.files)}
            disabled={busy}
          />
          <div className="mp-files__row">
            <label htmlFor="mp-files" className="mp-btn mp-btn--line mp-files__add">
              <span>{t.addFiles}</span>
              <span aria-hidden="true">+</span>
            </label>
            {fileError ? (
              <span className="mp-field__error" id="mp-files-err" role="alert">
                {fileError}
              </span>
            ) : null}
          </div>
          {/* Always mounted (collapsed while empty) so additions are announced.
              Each item is read whole when it changes; the running percentage
              is hidden from assistive tech so a transfer is not read out
              several times a second — "Uploading", then the size or the
              error, is what a listener needs. */}
          <ul className="mp-files__list" aria-live="polite">
            {pending.map((p) => (
              <li key={p.id} className="mp-files__item" data-state={p.state} aria-atomic="true">
                <span className="mp-files__name">{p.file.name}</span>
                <span className="mp-files__meta">
                  {p.state === 'uploading' ? (
                    <>
                      {t.uploading}
                      <span aria-hidden="true"> {Math.round(p.progress)}%</span>
                    </>
                  ) : p.state === 'error' ? (
                    <>
                      {p.error}
                      <button
                        type="button"
                        className="mp-files__retry"
                        onClick={() => retryFile(p.id)}
                        aria-label={`${t.retry} ${p.file.name}`}
                        disabled={busy}
                      >
                        {t.retry}
                      </button>
                    </>
                  ) : (
                    `${Math.max(1, Math.round(p.file.size / 1024))} KB`
                  )}
                </span>
                <span className="mp-files__bar" aria-hidden="true">
                  <span style={{ width: `${p.state === 'done' ? 100 : p.progress}%` }} />
                </span>
                <button
                  type="button"
                  className="mp-files__remove"
                  onClick={() => removeFile(p.id)}
                  aria-label={`${t.removeFile} ${p.file.name}`}
                  disabled={busy}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mp-form__row">
          <Field id="mp-phone" name="phone" label={t.phone} optional optionalLabel={t.optional} type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" maxLength={40} />
          <Field id="mp-company" name="company" label={t.company} optional optionalLabel={t.optional} value={f.company} onChange={set('company')} autoComplete="organization" autoCapitalize="words" placeholder={t.companyPlaceholder} maxLength={160} />
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
          {/* The same failure, where the visitor tapped. The alert at the top
              is what gets announced and focused; this copy is hidden from
              assistive tech (no second reading) but still describes the
              button, so a return to Send explains why it is idle again. */}
          {failed ? (
            <span className="mp-field__error mp-form__actions-error" id="mp-form-actions-err" aria-hidden="true">
              {failed}
            </span>
          ) : null}
          <button
            type="submit"
            className="mp-btn mp-btn--solid"
            data-busy={busy || uploading ? 'true' : undefined}
            aria-busy={busy}
            aria-describedby={failed ? 'mp-form-actions-err' : undefined}
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
    </>
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
  inputMode,
  placeholder,
  autoComplete,
  autoCapitalize,
  spellCheck,
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
  /** Keyboard hint for phones (the email and phone layouts). */
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  autoComplete?: string;
  /** Names and places start capitalised; an email address must not. */
  autoCapitalize?: string;
  spellCheck?: boolean;
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
        inputMode={inputMode}
        className="mp-field__input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
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
