'use client';

import { useEffect } from 'react';
import { STACK_PINNED, dwellDelta } from './stack-math';

/**
 * The slide-over stack's keyboard island (QA finding A1). It renders nothing.
 *
 * Shift+Tab into the credentials plate from further down the page makes the
 * browser scroll to the license link it lands on, and that scroll overshoots
 * the pause the stylesheet gives the plate (home-motion.css §05): the snow
 * plate then lies over the plate and the focused link is hidden. When the
 * keyboard focus enters the credentials plate, and only where the stack is
 * pinned, the page is put back at the end of the pause (stack-math.ts): the
 * credentials plate whole, the snow plate just below the screen.
 *
 * Keyboard focus only. A press with a mouse also focuses a link, and moving
 * the page under the pointer between the press and the release would lose the
 * click. The scroll waits one frame: the browser's own scroll to the focused
 * element runs after the focus event.
 */
export function StackFocus() {
  useEffect(() => {
    const pinned = window.matchMedia(STACK_PINNED);

    const onFocusIn = (e: FocusEvent) => {
      if (!pinned.matches) return;
      const target = e.target;
      if (!(target instanceof HTMLElement) || !target.closest('#credentials')) return;
      requestAnimationFrame(() => {
        let keyboard = true;
        try {
          keyboard = target.matches(':focus-visible');
        } catch {
          // A browser without :focus-visible: treat the focus as the keyboard's.
        }
        if (!keyboard || !pinned.matches) return;
        const where = document.getElementById('where');
        if (!where) return;
        const dy = dwellDelta(where.getBoundingClientRect().top, window.innerHeight);
        if (dy !== 0) window.scrollBy({ top: dy, behavior: 'instant' });
      });
    };

    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  return null;
}
