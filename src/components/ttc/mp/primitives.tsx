'use client';

/**
 * MONOLITHIC PRECISION — shared primitives.
 *
 * Motion rule for the whole system: every animation here is a no-op when the
 * user prefers reduced motion — the element renders in its final state, never
 * hidden. Nothing on this site depends on an animation to become readable.
 *
 * Two mechanisms, split at the fold:
 *
 *   • ABOVE THE FOLD — the hero and page-hero photo, eyebrow, headline, sub,
 *     CTA row and facts — entrances are CSS keyframes (`mp-enter` classes in
 *     mp.css). Motion serialises its `initial` state into the server HTML, so
 *     those elements used to ship invisible and waited for React to hydrate:
 *     an 8–11 s LCP on a throttled phone, for reduced-motion visitors too. A
 *     keyframe starts at first paint, JavaScript or not, and the
 *     reduced-motion media query switches it off.
 *
 *   • BELOW THE FOLD — `Reveal`, scroll-triggered `RevealText`, the stagger
 *     lists — Motion's `whileInView`. Hidden-until-hydrated is harmless there:
 *     by the time anyone scrolls to them, React has long since arrived.
 *
 * Why `animate` is set explicitly in the reduced-motion branch below: the
 * server cannot know the visitor's motion preference, so it always serialises
 * the animating `initial` state (opacity: 0) into the HTML. Passing
 * `initial={false}` on the client only stops Motion from *setting* a value —
 * it does not clear what the server already wrote. Without an explicit
 * `animate` target, every scroll-revealed element would stay invisible
 * forever for exactly the users who asked for less motion.
 */

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'motion/react';

export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Marker class on every Motion-animated element. Motion serialises its
 * `initial` state into the SSR markup (opacity: 0), so if JavaScript never
 * arrives the content would stay invisible. The <noscript> block in
 * (public)/layout.tsx resets anything carrying this class to its final state.
 * The CSS `mp-enter` entrances need no such reset — a keyframe runs without
 * JavaScript.
 */
const REVEAL = 'mp-reveal';
const cx = (...parts: (string | undefined | false)[]) =>
  parts.filter(Boolean).join(' ');

/* ── Reveal ─────────────────────────────────────────────────────────────── */

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'span' | 'li' | 'p';
  once?: boolean;
};

export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
  as = 'div',
  once = true,
}: RevealProps) {
  const reduce = useReducedMotion();
  const Comp =
    as === 'span'
      ? motion.span
      : as === 'li'
        ? motion.li
        : as === 'p'
          ? motion.p
          : motion.div;

  return (
    <Comp
      className={cx(REVEAL, className)}
      initial={reduce ? false : { opacity: 0, y }}
      animate={reduce ? { opacity: 1, y: 0 } : undefined}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once, margin: '-40px' }}
      transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

/* ── RevealText — headline lines rise out of a clipping mask ─────────────── */

/**
 * The mask wrapper carries the viewport trigger, NOT the translated line.
 *
 * IntersectionObserver clips against every `overflow: hidden` ancestor. A line
 * sitting at `y: 108%` is translated entirely outside its own mask, so its
 * intersection area is exactly zero — the observer would never fire and the
 * headline would stay hidden forever. Observing the (untranslated) mask and
 * propagating the state down through variants avoids that deadlock.
 */
const LINE_VARIANTS: Variants = {
  hidden: { y: '108%' },
  show: { y: '0%' },
};

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
  const reduce = useReducedMotion();

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
                style={{
                  display: 'block',
                  // Whole milliseconds: 0.1 + 2 × 0.07 is 0.24000000000000002.
                  animationDelay: `${Math.round((delay + i * 0.07) * 1000)}ms`,
                }}
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
          <motion.span
            className={lineClassName}
            style={LINE_MASK}
            initial={reduce ? false : 'hidden'}
            {...(reduce
              ? { animate: 'show' as const }
              : {
                  whileInView: 'show' as const,
                  viewport: { once: true, margin: '-60px' },
                })}
          >
            <motion.span
              className={REVEAL}
              style={{ display: 'block' }}
              variants={LINE_VARIANTS}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 0.7, ease: EASE, delay: delay + i * 0.07 }
              }
            >
              {line}
            </motion.span>
          </motion.span>
        </React.Fragment>
      ))}
    </Tag>
  );
}

/* ── AnimatedLine — a hairline that draws itself left-to-right ───────────── */

export function AnimatedLine({
  className = 'mp-rule',
  delay = 0,
  duration = 0.9,
}: {
  className?: string;
  delay?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cx(REVEAL, className)}
      initial={reduce ? false : { scaleX: 0 }}
      animate={reduce ? { scaleX: 1 } : undefined}
      whileInView={reduce ? undefined : { scaleX: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={reduce ? { duration: 0 } : { duration, ease: EASE, delay }}
    />
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

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

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
  const reduce = useReducedMotion();
  const Comp = as === 'ul' ? motion.ul : motion.div;
  return (
    <Comp
      className={className}
      tabIndex={tabIndex}
      role={role}
      aria-label={ariaLabel}
      variants={staggerParent}
      initial={reduce ? false : 'hidden'}
      animate={reduce ? 'show' : undefined}
      whileInView={reduce ? undefined : 'show'}
      viewport={{ once: true, margin: '-50px' }}
      transition={reduce ? { duration: 0 } : undefined}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
  as = 'li',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'li' | 'div';
}) {
  const reduce = useReducedMotion();
  const Comp = as === 'li' ? motion.li : motion.div;
  return (
    <Comp
      className={cx(REVEAL, className)}
      variants={staggerChild}
      transition={reduce ? { duration: 0 } : undefined}
    >
      {children}
    </Comp>
  );
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
