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
 *   3. THE POSTER IS THE REAL ASSET. `preload="none"` means the clip does not
 *      touch the network until it is close to being seen — until then, and on
 *      any connection where it never arrives, the poster IS the design. Both
 *      are art-directed to work alone.
 *
 *   4. SSR SAFETY. `useReducedMotion()` returns `null` on the server and on the
 *      first client render, so the markup is identical either way: we always
 *      render the poster first and upgrade to video in an effect. No hydration
 *      mismatch, and the image is what paints.
 */

import React from 'react';
import { useReducedMotion } from 'motion/react';
import type { Clip, Photo } from '@/lib/ttc/media';

/* ── Photo ───────────────────────────────────────────────────────────────── */

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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={photo.src}
      srcSet={`${photo.sm} 900w, ${photo.src} 2000w`}
      sizes={sizes ?? '(max-width: 900px) 100vw, 50vw'}
      alt={decorative ? '' : photo.alt}
      width={photo.w}
      height={photo.h}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  );
}

/* ── Video loop ──────────────────────────────────────────────────────────── */

export function VideoLoop({
  clip,
  className,
  priority = false,
}: {
  clip: Clip;
  className?: string;
  /** Above the fold: start loading immediately instead of waiting for scroll. */
  priority?: boolean;
}) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  const ref = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  // Playback START is the `autoPlay` attribute's job, not this observer's.
  //
  // Relying on IntersectionObserver to call play() looks tidier — nothing runs
  // until it is seen — but it makes playing at all conditional on the observer
  // firing, and there are real environments where it does not: a webview that
  // is not compositing, an embedded frame, a tab restored from bfcache. In
  // those the loop silently never starts and the section looks broken. A muted,
  // inline, autoplaying video is allowed everywhere, so the browser is the more
  // reliable trigger.
  //
  // The observer is therefore only an optimisation: it PAUSES clips that have
  // scrolled away, so four background loops are never decoding at once, and
  // resumes the one that comes back. If it never fires, everything still plays.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // A rejected play() is normal — a background tab, or a browser that
          // declines autoplay. The poster stays up and nothing breaks.
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { rootMargin: '200px 0px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  // Server render, first client paint, and every reduced-motion visitor.
  if (!mounted || reduce) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={clip.poster}
        alt=""
        width={clip.w}
        height={clip.h}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
      />
    );
  }

  return (
    <video
      ref={ref}
      className={className}
      poster={clip.poster}
      width={clip.w}
      height={clip.h}
      autoPlay
      muted
      loop
      playsInline
      // `metadata` rather than `none` for the deferred clips: with autoPlay the
      // browser fetches when it decides to play anyway, and `none` only costs a
      // round trip at exactly the moment the section comes into view.
      preload={priority ? 'auto' : 'metadata'}
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src={clip.src} type="video/mp4" />
    </video>
  );
}
