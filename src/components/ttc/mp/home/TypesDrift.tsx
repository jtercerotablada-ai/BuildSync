'use client';

import { useEffect } from 'react';
import { useMotionPaused } from '../media';

/**
 * The building-types band's one piece of script: it renders nothing and
 * answers the page's shared pause switch.
 *
 * The band drifts on CSS alone (home-lower.css §01: `h-types-drift`, a linear
 * keyframe that moves the track one set of cards to the left and starts
 * again, so the six cards pass endlessly from right to left). The switch the
 * visitor has for everything that moves on this page (the film, the model
 * loop, the ribbon) is React state with no mark in the DOM, so this island
 * writes one: `data-paused` on the band while the switch is pressed, and the
 * stylesheet holds the drift. The pointer over the band holds it too (CSS),
 * and under reduced motion there is no drift at all.
 */
export function TypesDrift() {
  const paused = useMotionPaused();
  useEffect(() => {
    const band = document.querySelector<HTMLElement>('[data-motion="types-drift"]');
    if (!band) return;
    if (paused) band.setAttribute('data-paused', 'true');
    else band.removeAttribute('data-paused');
  }, [paused]);
  return null;
}
