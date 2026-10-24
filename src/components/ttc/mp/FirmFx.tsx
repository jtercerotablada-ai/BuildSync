'use client';

import { useEffect } from 'react';
import { useMotionPaused } from './media';

/**
 * The home page's motion, after emxse.com (the owner, 2026-10-23: "tiene unos
 * efectos lindos"). Their effects, rebuilt here without their code or GSAP:
 *
 *   • on scroll, each `[data-fx]` block plays its entrance once, when its top
 *     passes the middle of the screen: `up` rises from 110% of its height,
 *     `left` slides in from the left, `line` draws a hairline across, `zoom`
 *     settles a photograph from 1.25× — staggered by `--fx-i` (mp-firm.css 5);
 *   • the photograph band drifts slower than the page (parallax);
 *   • the ribbon's two rows run on a clock of their own: they turn round when
 *     the reader scrolls back up, speed up with the speed of the scroll and
 *     slow to a stop under a mouse.
 *
 * Nothing waits for this file to be VISIBLE: the hidden states in mp-firm.css
 * apply only under `html.mp-fx-on`, which this sets after hydration, and only
 * to blocks still below the screen. Reduced motion, or the page's pause
 * toggle, leaves everything still. The hero's entrance is CSS keyframes
 * (mp-firm.css 5), as every above-the-fold entrance on this site is.
 */
export function FirmFx() {
  const paused = useMotionPaused();

  // Scroll entrances and the band's parallax.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-fx]'));
    // Blocks already on screen keep their final state: hiding them now would
    // blink content the reader is looking at.
    const vh = window.innerHeight;
    for (const el of els) if (el.getBoundingClientRect().top < vh * 0.9) el.classList.add('is-in');
    root.classList.add('mp-fx-on');

    // Each block is watched through its PARENT: the block itself sits moved
    // out of place (110% down, or left behind a clipping mask) until it
    // plays, and an observer measures that moved box — a block slid out of
    // its mask never "intersects" at all.
    const byParent = new Map<Element, HTMLElement[]>();
    for (const el of els) {
      if (el.classList.contains('is-in') || !el.parentElement) continue;
      const list = byParent.get(el.parentElement) ?? [];
      list.push(el);
      byParent.set(el.parentElement, list);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          for (const el of byParent.get(e.target) ?? []) el.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -40% 0px' },
    );
    for (const parent of byParent.keys()) io.observe(parent);

    const band = document.querySelector<HTMLElement>('.mp-fband');
    const img = band?.querySelector<HTMLElement>('img');
    let raf = 0;
    const drift = () => {
      raf = 0;
      if (!band || !img) return;
      const r = band.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      // -1 as the band enters at the bottom, +1 as it leaves at the top.
      const p = (window.innerHeight - r.top) / (window.innerHeight + r.height) * 2 - 1;
      img.style.transform = `translate3d(0, ${(p * 12).toFixed(2)}%, 0) scale(1.3)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(drift);
    };
    drift();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      root.classList.remove('mp-fx-on');
      if (img) img.style.transform = '';
    };
  }, []);

  // The ribbon.
  useEffect(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('.mp-ribbon__row'));
    if (!rows.length) return;
    // The page's pause toggle stops the ribbon too (WCAG 2.2.2).
    if (paused) {
      rows.forEach((r) => r.classList.add('is-still'));
      return () => rows.forEach((r) => r.classList.remove('is-still'));
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    // Row 1 runs left, row 2 right; px per ms at rest.
    const state = rows.map((row, i) => ({
      row,
      track: row.querySelector<HTMLElement>('.mp-ribbon__track')!,
      base: (i === 0 ? -1 : 1) * 0.06,
      x: 0,
      scale: 1,
      hover: false,
    }));
    for (const s of state) {
      s.row.classList.add('is-js');
      if (s.base > 0) s.x = -s.track.scrollWidth / 2;
    }
    const section = rows[0].closest<HTMLElement>('.mp-ribbon');
    const enter = () => state.forEach((s) => (s.hover = true));
    const leave = () => state.forEach((s) => (s.hover = false));
    if (fine && section) {
      section.addEventListener('mouseenter', enter);
      section.addEventListener('mouseleave', leave);
    }

    let dir = 1;
    let lastY = window.scrollY;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const dt = Math.min(now - last, 64);
      last = now;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (dy > 0.5) dir = 1;
      else if (dy < -0.5) dir = -1;
      // Scroll speed adds to the rest speed, up to 8×, and fades back.
      const boost = Math.min(Math.abs(dy) / Math.max(dt, 1) * 1.6, 7);
      for (const s of state) {
        const target = s.hover ? 0 : dir * (1 + boost);
        s.scale += (target - s.scale) * (s.hover ? 0.08 : boost ? 0.25 : 0.06);
        const half = s.track.scrollWidth / 2;
        s.x += s.base * s.scale * dt;
        if (half) {
          if (s.x <= -half) s.x += half;
          if (s.x > 0) s.x -= half;
        }
        s.track.style.transform = `translate3d(${s.x.toFixed(2)}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(raf);
      if (section) {
        section.removeEventListener('mouseenter', enter);
        section.removeEventListener('mouseleave', leave);
      }
      for (const s of state) {
        s.row.classList.remove('is-js');
        s.track.style.transform = '';
      }
    };
  }, [paused]);

  return null;
}
