'use client';

/**
 * MONOLITHIC PRECISION — media primitives.
 *
 * Two things sit behind everything visual on this site: a photograph that must
 * not shift the page while it loads, and a silent loop that must not cost the
 * visitor anything they did not ask for.
 *
 * The rules encoded here, each of which exists because the naive version is
 * wrong in a way that is easy to miss:
 *
 *   1. REDUCED MOTION GETS THE POSTER, NOT A PAUSED VIDEO. A `<video>` element
 *      that never plays still downloads, still decodes its first frame, and
 *      still hands a media element to assistive tech for no reason. When the
 *      visitor has asked for less motion we render the poster as a plain image
 *      and never mount the video at all.
 *
 *   2. NOTHING PLAYS OFF-SCREEN. Browsers happily keep four background loops
 *      decoding at once. Each clip pauses when it leaves the viewport and
 *      resumes when it returns, so at most one is ever running.
 *
 *   3. THE POSTER IS THE REAL ASSET. A below-the-fold clip renders only its
 *      (lazy) poster until an observer sees it come within a viewport of being
 *      seen; only then does the `<video>` mount and touch the network. The hero
 *      clip waits for the page's `load` and an idle moment, so it never competes
 *      with the poster that is the page's LCP. A Save-Data connection never gets
 *      the video at all. Until the clip arrives — and wherever it never does —
 *      the poster IS the design. Both are art-directed to work alone.
 *
 *      Why not `preload="none"` / `"metadata"` on an always-mounted video: the
 *      `autoplay` attribute overrides `preload`, so every clip on the page was
 *      being buffered in full at hydration (4.9 MB of off-screen footage on a
 *      phone that never scrolled). Not mounting is the only reliable "not yet".
 *
 *   4. SSR SAFETY. `useReducedMotion()` returns `null` on the server but the
 *      visitor's REAL preference on the first client render, so anything that
 *      branches on it during that render ships markup React will not patch.
 *      The poster is therefore rendered unconditionally on the server and on
 *      the first client pass, and the upgrade to video happens in effects.
 *      Components that show or hide on the motion preference do it in CSS.
 *
 *   5. THE VISITOR CAN STOP IT. A loop that runs longer than five seconds next
 *      to content needs a pause control (WCAG 2.2.2) — an OS reduced-motion
 *      setting is not one. `MotionToggle` flips a single shared switch that
 *      every `VideoLoop` on the page obeys.
 */

import React from 'react';
import { useReducedMotion } from 'motion/react';
import type { Clip, Photo } from '@/lib/ttc/media';
import { useContent } from './lang';

/**
 * `<picture>` is only a source picker, never a box. Every photo slot styles
 * the `<img>` itself (`width/height: 100%`, `object-fit`) and several slots
 * are flex or grid containers; a real `<picture>` box between them would
 * become the flex/grid item and the image's percentage height would resolve
 * against an auto-height wrapper. `display: contents` keeps the `<img>` laid
 * out exactly as if it were the direct child it has always been. Inline, so
 * it holds from the very first byte of HTML.
 */
const PICK: React.CSSProperties = { display: 'contents' };

/** The phone breakpoint shared by the clip renditions and their posters. */
const PHONE = '(max-width: 700px)';

/* ── Photo ───────────────────────────────────────────────────────────────── */

/**
 * `900w, 1200w, <native>w`. A Photo that does not (yet) carry a rung — a
 * master added before the rendition script has run — degrades to fewer
 * candidates instead of taking the page down with it.
 */
function widths(sm: string | undefined, md: string | undefined, src: string, w: number) {
  return [sm && `${sm} 900w`, md && `${md} 1200w`, `${src} ${w}w`].filter(Boolean).join(', ');
}

/**
 * Three widths per photograph — 900, 1200 and the native master (2000, or
 * less when the source is smaller) — in AVIF with a JPEG fallback. The 1200
 * rung is the one that matters: without it every slot wider than ~450 CSS px
 * on a retina screen, or ~300 px on a DPR-3 phone, jumped straight to the
 * 2000-wide master. `sizes` is the caller's job, and it should describe the
 * slot's real rendered width — an overstatement buys a bigger file for nothing.
 *
 * `photo.pos` is the photograph's focal point. It is inline so that it beats
 * every slot's default `object-position` — a portrait frame's subject stays
 * in the crop whatever box it lands in.
 */
export function Img({
  photo,
  className,
  sizes,
  priority = false,
  /** Decorative by default: the surrounding copy already carries the meaning. */
  decorative = true,
}: {
  photo: Photo;
  className?: string;
  sizes?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  const s = sizes ?? '(max-width: 900px) 100vw, 50vw';
  return (
    <picture style={PICK}>
      {photo.avif ? (
        <source
          type="image/avif"
          srcSet={widths(photo.avif.sm, photo.avif.md, photo.avif.src, photo.w)}
          sizes={s}
        />
      ) : null}
      <img
        className={className}
        src={photo.src}
        srcSet={widths(photo.sm, photo.md, photo.src, photo.w)}
        sizes={s}
        alt={decorative ? '' : photo.alt}
        width={photo.w}
        height={photo.h}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        style={photo.pos ? { objectPosition: photo.pos } : undefined}
      />
    </picture>
  );
}

/* ── Motion switch (shared by every loop on the page) ────────────────────── */

/**
 * One module-level store rather than React context: the hero, the video band
 * and the BIM stage are siblings with no common client parent, and the switch
 * has to hold across client-side navigations too.
 *
 * The server snapshot is always "playing", so the markup is identical on the
 * server and the first client pass; a stored "paused" arrives in the render
 * `useSyncExternalStore` schedules right after hydration.
 *
 * localStorage is a per-visitor convenience only — so a visitor who paused the
 * loops is not ambushed by them on the next page. Every access is guarded: a
 * private window or blocked storage throws, and then the choice simply lasts
 * for this page view.
 */
const MOTION_KEY = 'ttc:motion-paused';
const motionListeners = new Set<() => void>();
let motionPaused: boolean | null = null;

function readMotionPaused(): boolean {
  if (motionPaused === null) {
    try {
      motionPaused = window.localStorage.getItem(MOTION_KEY) === '1';
    } catch {
      motionPaused = false;
    }
  }
  return motionPaused;
}

function emitMotion() {
  motionListeners.forEach((listener) => listener());
}

// Another tab flipped the switch (or cleared storage): follow it.
function onMotionStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== MOTION_KEY) return;
  motionPaused = e.key === null ? false : e.newValue === '1';
  emitMotion();
}

function subscribeMotion(listener: () => void) {
  if (motionListeners.size === 0) window.addEventListener('storage', onMotionStorage);
  motionListeners.add(listener);
  return () => {
    motionListeners.delete(listener);
    if (motionListeners.size === 0) window.removeEventListener('storage', onMotionStorage);
  };
}

export function setMotionPaused(next: boolean) {
  motionPaused = next;
  try {
    if (next) window.localStorage.setItem(MOTION_KEY, '1');
    else window.localStorage.removeItem(MOTION_KEY);
  } catch {
    /* Storage unavailable — the switch still holds for this page view. */
  }
  emitMotion();
}

/** true when the visitor has paused the background loops. */
export function useMotionPaused(): boolean {
  return React.useSyncExternalStore(subscribeMotion, readMotionPaused, () => false);
}

/**
 * The pause/play control for the background loops. Icon only, so it carries
 * its name in `aria-label`.
 *
 * The name stays "Pause background video" in both states and `aria-pressed`
 * carries the state: a toggle whose label ALSO flips announces "Play
 * background video, pressed", which contradicts itself (WAI-ARIA APG, button
 * pattern). The glyph does flip — pause bars while playing, a play triangle
 * once paused — because that is what a sighted visitor reads.
 *
 * Hidden in CSS for reduced-motion visitors (their loops are posters, there is
 * nothing to stop) — in CSS rather than on `useReducedMotion()`, which would
 * mismatch the server markup (rule 4).
 */
export function MotionToggle({ className }: { className?: string }) {
  const c = useContent();
  const paused = useMotionPaused();
  return (
    <button
      type="button"
      className={`mp-motion-toggle${className ? ` ${className}` : ''}`}
      aria-pressed={paused}
      aria-label={c.ui.pauseMotion}
      onClick={() => setMotionPaused(!paused)}
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
        {paused ? (
          <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
        ) : (
          <path d="M2 1.5h3v9H2zM7 1.5h3v9H7z" fill="currentColor" />
        )}
      </svg>
    </button>
  );
}

/* ── Video loop ──────────────────────────────────────────────────────────── */

/** Save-Data (or Lite mode) is an explicit request for fewer bytes. */
function wantsSaveData(): boolean {
  try {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    return nav.connection?.saveData === true;
  } catch {
    return false;
  }
}

export function VideoLoop({
  clip,
  className,
  priority = false,
}: {
  clip: Clip;
  className?: string;
  /** Above the fold: the poster loads eagerly at high priority, and the clip
   *  follows once the page has finished loading instead of waiting for scroll. */
  priority?: boolean;
}) {
  const reduce = useReducedMotion();
  const paused = useMotionPaused();
  const posterRef = React.useRef<HTMLImageElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const pausedRef = React.useRef(paused);
  // What the off-screen observer last reported: null until it has reported.
  const inViewRef = React.useRef<boolean | null>(null);
  // Has the clip's moment come? Hero: the page finished loading. Everything
  // else: the poster came within a viewport of being seen. Client-only.
  const [due, setDue] = React.useState(false);
  // Latched once the <video> is in the DOM, so a pause, a resume or a scroll
  // never unmounts it and never pays for the download twice.
  const [live, setLive] = React.useState(false);

  // `due` is only ever true on the client, so the Save-Data read below never
  // runs on the server — and the first client render matches it exactly.
  const showVideo = !reduce && (live || (due && !paused && !wantsSaveData()));

  React.useEffect(() => {
    if (showVideo && !live) setLive(true);
  }, [showVideo, live]);

  // When is the clip due?
  React.useEffect(() => {
    if (due || reduce) return;

    if (priority) {
      // After `load`, then an idle moment: the hero stream never competes with
      // the LCP poster, the fonts or the JavaScript. Safari has no
      // requestIdleCallback; a short timeout stands in.
      let idleId: number | undefined;
      let timer: number | undefined;
      const whenIdle = () => {
        if (typeof window.requestIdleCallback === 'function') {
          idleId = window.requestIdleCallback(() => setDue(true), { timeout: 2000 });
        } else {
          timer = window.setTimeout(() => setDue(true), 300);
        }
      };
      if (document.readyState === 'complete') whenIdle();
      else window.addEventListener('load', whenIdle, { once: true });
      return () => {
        window.removeEventListener('load', whenIdle);
        if (idleId !== undefined) window.cancelIdleCallback(idleId);
        if (timer !== undefined) window.clearTimeout(timer);
      };
    }

    // Observe the poster <img> itself — the <picture> around it has no box
    // (`display: contents`) and so never intersects anything. A viewport of
    // lead time means the clip is usually buffered by the time it is seen.
    // If the observer never fires, the poster stays: rule 3.
    const el = posterRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setDue(true);
          io.disconnect();
        }
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [priority, due, reduce]);

  // Playback START is the `autoPlay` attribute's job, not an observer's.
  //
  // Relying on IntersectionObserver to call play() looks tidier — nothing runs
  // until it is seen — but it makes playing at all conditional on the observer
  // firing, and there are real environments where it does not: a webview that
  // is not compositing, an embedded frame, a tab restored from bfcache. In
  // those the loop silently never starts and the section looks broken. A muted,
  // inline, autoplaying video is allowed everywhere, so once the <video> is
  // mounted the browser is the more reliable trigger.
  //
  // The observer below is therefore only an optimisation: it PAUSES clips that
  // have scrolled away, so four background loops are never decoding at once,
  // and resumes the one that comes back — unless the visitor paused them. If it
  // never fires, everything still plays.
  React.useEffect(() => {
    const el = videoRef.current;
    if (!showVideo || !el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = !!entry?.isIntersecting;
        if (inViewRef.current && !pausedRef.current) {
          // A rejected play() is normal — a background tab, or a browser that
          // declines autoplay. The poster frame stays up and nothing breaks.
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { rootMargin: '200px 0px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [showVideo]);

  // The visitor's switch, shared by every loop on the page. Pausing is
  // immediate everywhere. Resuming restarts only the clips on screen — the
  // one under the pressed control, typically — and leaves the rest to the
  // observer above, so a resume never sets off-screen loops decoding (rule 2).
  // If that observer has never reported, resume anyway: a clip that cannot
  // be tracked should not stay frozen after the visitor asked for it.
  React.useEffect(() => {
    pausedRef.current = paused;
    const el = videoRef.current;
    if (!el) return;
    if (paused) el.pause();
    else if (inViewRef.current !== false) void el.play().catch(() => {});
  }, [paused]);

  if (showVideo) {
    // Client-only branch, so reading the viewport here cannot mismatch the
    // server. The phone poster is the one the <picture> below already chose,
    // so the swap costs no second poster download.
    const poster =
      clip.mobilePoster && window.matchMedia(PHONE).matches ? clip.mobilePoster : clip.poster;
    return (
      <video
        ref={videoRef}
        className={className}
        poster={poster}
        width={clip.w}
        height={clip.h}
        autoPlay
        muted
        loop
        playsInline
        // Mounted only when it is wanted (rule 3), so there is nothing left to
        // hold back: autoplay would override a lighter preload anyway.
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      >
        {/* First match wins, and `media` on a video <source> is honoured again
            (Chrome 120+, Safari, Firefox): phones take the light portrait
            rendition, everything else the 1080p master. */}
        {clip.mobile ? <source src={clip.mobile} type="video/mp4" media={PHONE} /> : null}
        <source src={clip.src} type="video/mp4" />
      </video>
    );
  }

  // Server render, first client paint, every reduced-motion or Save-Data
  // visitor, and every clip that has not yet come near the viewport.
  return (
    <picture style={PICK}>
      {clip.mobilePoster ? <source media={PHONE} srcSet={clip.mobilePoster} /> : null}
      <img
        ref={posterRef}
        className={className}
        src={clip.poster}
        alt=""
        width={clip.w}
        height={clip.h}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
      />
    </picture>
  );
}
