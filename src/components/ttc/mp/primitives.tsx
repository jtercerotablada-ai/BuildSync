'use client';

/**
 * MONOLITHIC PRECISION — shared primitives.
 *
 * Motion rule for the whole system: every animation here is a no-op when the
 * user prefers reduced motion — the element renders in its final state, never
 * hidden. Nothing on this site depends on an animation to become readable,
 * and nothing depends on JavaScript to become VISIBLE: no component in this
 * file writes a hidden state into the server HTML.
 *
 * Two mechanisms, split at the fold, and neither is Motion:
 *
 *   • ABOVE THE FOLD — the hero and page-hero photo, eyebrow, headline, sub,
 *     CTA row and facts — entrances are CSS keyframes (`mp-enter` classes in
 *     mp.css). Motion serialises its `initial` state into the server HTML, so
 *     those elements used to ship invisible and waited for React to hydrate:
 *     an 8–11 s LCP on a throttled phone, for reduced-motion visitors too. A
 *     keyframe starts at first paint, JavaScript or not, and the
 *     reduced-motion media query switches it off.
 *
 *   • BELOW THE FOLD — `Reveal`, scroll-triggered `RevealText`, the
 *     stagger lists. They were Motion's `whileInView`, on the theory
 *     that hidden-until-hydrated is harmless down there. It
 *     was not: on a slow connection a visitor scrolls before React arrives
 *     and met an empty page, and a failed script left it empty for good.
 *     Now the markup is plain and visible. After hydration `useReveal` hands
 *     each block to reveal.ts, which hides (`data-rv="wait"`) only the ones
 *     still below the screen and plays them (`data-rv="in"`) as they scroll
 *     into view. The two states and their keyframes are in mp.css, under the
 *     `mp-enter` ones. Read reveal.ts before changing any of it — the order
 *     in which things are hidden is the failsafe.
 *
 * Timing travels as inline custom properties (`--rv-delay`, `--rv-y`),
 * written only when they differ from the CSS default: identical on the
 * server and the client, and most blocks carry no style at all.
 */

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { watchReveal } from './reveal';

/** Still what the header menu's Motion transitions use; mp.css has the same
 *  curve as --mp-ease. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Marker class on every element a reveal animates. It carries no declaration
 * of its own: the print rule in mp.css and the <noscript> rule in
 * PublicShell.tsx use it to force the final state — on paper for a block
 * that was still parked below the fold, and as a backstop should a Motion
 * `initial` ever be put on one of these again.
 */
const REVEAL = 'mp-reveal';
const cx = (...parts: (string | undefined | false)[]) =>
  parts.filter(Boolean).join(' ');

/**
 * Register an element with the reveal engine once it is in the document.
 * `margin` is how many px inside the viewport's edge it must be to count as
 * on screen (40 for blocks, 50 for lists, 60 for headlines — Motion's old
 * `viewport.margin` values).
 */
function useReveal<T extends HTMLElement>(margin: number) {
  const ref = useRef<T>(null);
  useEffect(
    () => (ref.current ? watchReveal(ref.current, margin) : undefined),
    [margin],
  );
  return ref;
}

/**
 * A photograph's two extra habits (the owner, 2026-10-25, on the live home:
 * "las imágenes cuando bajan se quedan en negro y tardan en mostrarse"):
 *
 *  1. IT LOADS AHEAD. The browser's own lazy loading starts a photograph
 *     about one screen before it is needed, which on an ordinary connection,
 *     with the hero film and the model loop downloading at the same time, is
 *     too late: the curtain opened on a black box. Two and a half screens
 *     before the photograph is due, its `loading` is switched to `eager`,
 *     which starts the download at once (the same switch VideoLoop uses for
 *     its poster).
 *
 *  2. IT PLAYS ONLY ONCE LOADED. The reveal engine writes `data-rv="in"` as
 *     the block comes on screen; if the photograph has not arrived by then,
 *     the curtain would open on nothing and the picture pop in afterwards.
 *     So the block is held at `wait` until the image has loaded, and plays
 *     then — the curtain always opens on a picture. A load that fails, or
 *     takes more than six seconds, plays anyway: nothing is ever stranded
 *     hidden (reveal.ts's own rule).
 *
 * Runs only for `fx="img"`, only in the browser, after hydration; the server
 * HTML carries none of it, and a visitor without scripts gets the plain
 * `loading="lazy"` photograph.
 */
function usePhotoAhead(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const imgs = Array.from(el.querySelectorAll('img'));
    if (imgs.length === 0) return;
    const cleanups: (() => void)[] = [];

    // 1. Load ahead.
    if (typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          for (const img of imgs) if (img.loading === 'lazy') img.loading = 'eager';
          io.disconnect();
        },
        { rootMargin: '250% 0px' },
      );
      io.observe(el);
      cleanups.push(() => io.disconnect());
    }

    // 2. Play only once loaded.
    const loaded = () => imgs.every((img) => img.complete && img.naturalWidth > 0);
    if (typeof MutationObserver === 'function' && !loaded()) {
      let holding = false;
      const play = () => {
        if (!holding) return;
        holding = false;
        el.setAttribute('data-rv', 'in');
      };
      const mo = new MutationObserver(() => {
        if (holding || el.getAttribute('data-rv') !== 'in' || loaded()) return;
        holding = true;
        el.setAttribute('data-rv', 'wait');
        const timer = window.setTimeout(play, 6000);
        const onDone = () => {
          if (loaded() || imgs.some((img) => img.complete && img.naturalWidth === 0)) {
            window.clearTimeout(timer);
            play();
          }
        };
        for (const img of imgs) {
          img.addEventListener('load', onDone, { once: true });
          img.addEventListener('error', onDone, { once: true });
        }
        cleanups.push(() => window.clearTimeout(timer));
      });
      mo.observe(el, { attributes: true, attributeFilter: ['data-rv'] });
      cleanups.push(() => mo.disconnect());
    }

    return () => {
      for (const c of cleanups) c();
    };
  }, [ref, enabled]);
}

/** Seconds → the whole-millisecond string CSS reads (0.1 + 2 × 0.07 is
 *  0.24000000000000002). */
const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;

/** Inline custom properties for mp.css; `undefined` entries are left out and
 *  an empty set yields no style attribute. */
function vars(
  set: Record<`--rv-${string}`, string | undefined>,
  base?: React.CSSProperties,
): React.CSSProperties | undefined {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(set)) if (v !== undefined) out[k] = v;
  return Object.keys(out).length ? (out as React.CSSProperties) : undefined;
}

/* ── Reveal ─────────────────────────────────────────────────────────────── */

/**
 * The home page's own reveals (spec E8 to E12), chosen with `fx`. The element
 * carries `data-fx` and the same `data-rv` states as every other reveal; the
 * look of each variant is in home-motion.css, under `.mp-home`, so on any
 * other page the attribute selects nothing:
 *
 *   words  E8   a heading: each word rises out of its own mask. The masks are
 *               rendered by `Words` (React, on the server); this only arms them.
 *   up     E9   a block: 34 px up and in, slower than the default.
 *   left   E10  a block slides in from the left (and a county's rule draws).
 *   line   E11  a hairline draws across from the left: the block's own rule
 *               (a card's `::before`) or the block itself, when it is one.
 *   img    E12  a photograph: revealed from the bottom edge while it settles
 *               from a closer scale.
 *
 * An `fx` element does NOT take the `mp-reveal` marker class: mp.css puts a
 * 14 px fade on every `.mp-reveal[data-rv]`, which would fight these. The
 * print and reduced-motion cases are covered by home-motion.css itself (its
 * hidden states exist only for screens that have not asked for less motion).
 */
export type RevealFx = 'words' | 'up' | 'left' | 'line' | 'img';

type RevealProps = {
  /** Absent for a block that is only a rule (`fx="line"`). */
  children?: React.ReactNode;
  delay?: number;
  /** Rise distance in px; mp.css defaults to 14 (34 for `fx="up"`). */
  y?: number;
  className?: string;
  as?: 'div' | 'span' | 'li' | 'p' | 'h2' | 'h3' | 'ul';
  /** One of the home page's variants (see above). */
  fx?: RevealFx;
  id?: string;
  /** Extra inline style (custom properties), merged under the timing ones. */
  style?: React.CSSProperties;
};

export function Reveal({
  children,
  delay = 0,
  y,
  className,
  as = 'div',
  fx,
  id,
  style,
}: RevealProps) {
  // A headline is armed a little earlier than a block (60 px, like
  // RevealText's lines): its words rise as it clears the foot of the screen.
  // A photograph plays 120 px BEFORE it enters (a negative margin pushes the
  // edge out): its curtain is already opening as it comes into view.
  const ref = useReveal<HTMLDivElement>(fx === 'words' ? 60 : fx === 'img' ? -120 : 40);
  usePhotoAhead(ref, fx === 'img');
  // One element type for the checker; the node is whatever `as` says.
  const Tag = as as 'div';
  return (
    <Tag
      ref={ref}
      id={id}
      className={cx(fx ? undefined : REVEAL, className) || undefined}
      data-fx={fx}
      style={vars(
        {
          '--rv-delay': delay ? ms(delay) : undefined,
          '--rv-y': y === undefined ? undefined : `${y}px`,
        },
        style,
      )}
    >
      {children}
    </Tag>
  );
}

/* ── RevealText — headline lines rise out of a clipping mask ─────────────── */

/**
 * The mask clips at the line box, but glyph ink (descenders, and ascenders at
 * line-height < 1) spills past it. The padding adds slack to the clip rect and
 * the negative margin takes it back out of the layout, so nothing shifts.
 */
const LINE_MASK: React.CSSProperties = {
  display: 'block',
  overflow: 'hidden',
  paddingBlock: '0.06em 0.18em',
  marginBlock: '-0.06em -0.18em',
};

/**
 * Each line is its own block span, so the heading's raw text needs a real
 * space between them: without it `textContent` — what crawlers, link
 * previews and readability parsers read — ran the words together
 * ("Structural Engineeringfor South Florida."). A whitespace-only text node
 * between two blocks renders nothing, so the layout is untouched.
 *
 * `id` goes on the heading itself, so a section can point `aria-labelledby`
 * at the real headline instead of at a visually hidden copy of it (which
 * screen readers used to announce a second time).
 */
export function RevealText({
  lines,
  className,
  lineClassName,
  delay = 0,
  animateOnMount = false,
  as: Tag = 'h2',
  id,
}: {
  /** Each entry is one visual line. Strings or nodes both work. */
  lines: React.ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  /** true for above-the-fold headlines, false for scroll-triggered ones. */
  animateOnMount?: boolean;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  id?: string;
}) {
  // Above the fold: the same mask-rise, as a CSS keyframe (`mp-enter--line`)
  // that starts at first paint — no `initial` state in the server HTML, no
  // wait for hydration. The per-line stagger is an inline animation-delay,
  // identical on the server and the client.
  if (animateOnMount) {
    return (
      <Tag id={id} className={className}>
        {lines.map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 ? ' ' : null}
            <span className={lineClassName} style={LINE_MASK}>
              <span
                className="mp-enter mp-enter--line"
                style={{ display: 'block', animationDelay: ms(delay + i * 0.07) }}
              >
                {line}
              </span>
            </span>
          </React.Fragment>
        ))}
      </Tag>
    );
  }

  return (
    <Tag id={id} className={className}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 ? ' ' : null}
          <RevealLine className={lineClassName} delay={delay + i * 0.07}>
            {line}
          </RevealLine>
        </React.Fragment>
      ))}
    </Tag>
  );
}

/**
 * One scroll-triggered headline line. The mask wrapper carries the viewport
 * trigger, NOT the translated line.
 *
 * IntersectionObserver clips against every `overflow: hidden` ancestor. A line
 * sitting at `translateY(108%)` is entirely outside its own mask, so its
 * intersection area is exactly zero — the observer would never fire and the
 * headline would stay hidden forever. So the (untranslated) mask is what is
 * watched and what takes `data-rv`, and mp.css moves the line inside it
 * (`[data-rv] > .mp-reveal--line`).
 */
function RevealLine({
  children,
  className,
  delay,
}: {
  children: React.ReactNode;
  className?: string;
  delay: number;
}) {
  const ref = useReveal<HTMLSpanElement>(60);
  return (
    <span ref={ref} className={className} style={LINE_MASK}>
      <span
        className={`${REVEAL} mp-reveal--line`}
        style={vars({ '--rv-delay': delay ? ms(delay) : undefined }, { display: 'block' })}
      >
        {children}
      </span>
    </span>
  );
}

/* ── Section heading — a small index and a label, nothing else ──────────── */

/**
 * The only section furniture on the site: "01 — What we design". The
 * right-aligned meta and the full-width rule that used to travel with it are
 * gone; a section starts with its label and its headline, not with a title
 * block.
 */
export function SectionHeading({
  n,
  label,
  className = '',
}: {
  n: string;
  label: string;
  className?: string;
}) {
  return (
    <Reveal as="p" className={`mp-sechead ${className}`.trim()}>
      <span className="mp-sechead__num" aria-hidden="true">
        {n}
      </span>
      <span className="mp-sechead__label">{label}</span>
    </Reveal>
  );
}

/* ── Technical eyebrow ───────────────────────────────────────────────────── */

export function TechnicalEyebrow({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`mp-eyebrow ${className}`.trim()}>{children}</p>;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

type ButtonVariant = 'solid' | 'line';

export function ButtonLink({
  href,
  children,
  variant = 'solid',
  arrow = true,
  className = '',
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  arrow?: boolean;
  className?: string;
  external?: boolean;
}) {
  const cls = `mp-btn mp-btn--${variant} ${className}`.trim();
  const inner = (
    <>
      <span>{children}</span>
      {arrow ? (
        <span className="mp-btn__arrow" aria-hidden="true">
          →
        </span>
      ) : null}
    </>
  );
  if (external) {
    return (
      <a className={cls} href={href} rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return (
    <Link className={cls} href={href}>
      {inner}
    </Link>
  );
}

export function TextLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link className={`mp-link ${className}`.trim()} href={href}>
      {children}
      <i aria-hidden="true">→</i>
    </Link>
  );
}

/* ── Stagger helpers for lists ───────────────────────────────────────────── */

/**
 * The LIST is what the engine watches and what takes `data-rv`; its items
 * are plain elements that mp.css hides and plays through the parent
 * (`[data-rv] > .mp-reveal--item`), each a beat after the one before
 * (`:nth-child`, 45 ms apart). So an item must be a direct child of its list.
 */
export function StaggerList({
  children,
  className,
  as = 'ul',
  tabIndex,
  role,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'ul' | 'div';
  /** Set to 0 when the list is a scrollable region (WCAG 2.1.1). */
  tabIndex?: number;
  role?: string;
  ariaLabel?: string;
}) {
  const ref = useReveal<HTMLUListElement>(50);
  const Tag = as as 'ul';
  return (
    <Tag ref={ref} className={className} tabIndex={tabIndex} role={role} aria-label={ariaLabel}>
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  as: Tag = 'li',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'li' | 'div';
}) {
  return <Tag className={cx(REVEAL, 'mp-reveal--item', className)}>{children}</Tag>;
}

/* ── Dark-hero sentinel ──────────────────────────────────────────────────── */

/**
 * Rendered at the bottom edge of any dark hero. It does two jobs:
 *
 *   1. Its mere presence in the document tells CSS the page opens on a dark
 *      surface (`body:has([data-mp-dark-hero])`), so the header renders
 *      transparent from the first paint — no JavaScript, no flash.
 *   2. `SiteHeader` observes it to know when the hero has scrolled away.
 *
 * Pages without a dark hero — the calculators under /resources, for example —
 * simply never render one, and the header stays solid.
 */
export function DarkHeroSentinel() {
  return (
    <div
      data-mp-dark-hero=""
      aria-hidden="true"
      style={{ position: 'absolute', bottom: 0, height: 1, width: '100%' }}
    />
  );
}
