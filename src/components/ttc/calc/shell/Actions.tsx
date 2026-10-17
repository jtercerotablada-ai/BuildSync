'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * The four seconds a notice is on screen, as one timer: starting it again restarts
 * the four seconds (a second Copy used to be cleared by the first one's timer),
 * and stopping it leaves nothing pending. The timers are a parameter so that this
 * can be tested without a browser.
 */
export function noticeTimer(
  clear: () => void,
  ms = 4000,
  timers: { set: (run: () => void, ms: number) => number; clear: (id: number) => void } = { set: (run, after) => window.setTimeout(run, after), clear: (id) => window.clearTimeout(id) },
) {
  let id: number | null = null;
  return {
    start() {
      if (id !== null) timers.clear(id);
      id = timers.set(() => {
        id = null;
        clear();
      }, ms);
    },
    stop() {
      if (id !== null) timers.clear(id);
      id = null;
    },
  };
}

/**
 * THE CALCULATORS' SHELL — the row of actions that closes a form: Copy
 * link, Print, Start over. (What the shell is, and a calculator built on
 * it: index.ts.)
 *
 * It keeps one thing of its own: whether the link was copied, said for four
 * seconds in a line a screen reader is told of. Everything else is the
 * calculator's, through two callbacks:
 *
 *   `copy` — called at the press. It returns the link to copy (address.ts,
 *     `link`, for the case on screen) and brings the address to that case
 *     too (`take`): the link in the clipboard and the one in the address bar
 *     are then the same case.
 *   `reset` — Start over: the calculator puts its example back on screen,
 *     with whatever else is part of its case, and its address goes bare
 *     (`take` with the example).
 *
 * Print is the browser's own: what the sheet needs at that moment is done
 * on `beforeprint` (sheet.tsx), which the button and Ctrl+P both raise.
 */
export function Actions({ t, copy, reset }: { t: { copy: string; copied: string; copyFailed: string; print: string; reset: string }; copy: () => string; reset: () => void }) {
  const [copied, setCopied] = useState<'' | 'ok' | 'failed'>('');
  // One timer for the notice: a second Copy inside the four seconds restarts them, and the page leaving takes the timer with it.
  const holder = useRef<ReturnType<typeof noticeTimer> | null>(null);
  if (holder.current === null) holder.current = noticeTimer(() => setCopied(''));
  useEffect(() => () => holder.current?.stop(), []);
  const copyLink = async () => {
    const link = copy();
    try {
      await navigator.clipboard.writeText(link);
      setCopied('ok');
    } catch {
      // No clipboard (an old browser, a page not served over https): the address bar has it.
      setCopied('failed');
    }
    holder.current?.start();
  };
  return (
    <div className="mp-app__actions">
      <button type="button" className="mp-app__btn" onClick={copyLink}>
        {t.copy}
      </button>
      <button type="button" className="mp-app__btn" onClick={() => window.print()}>
        {t.print}
      </button>
      <button type="button" className="mp-app__btn mp-app__btn--quiet" onClick={() => reset()}>
        {t.reset}
      </button>
      <p className="mp-app__copied" role="status" aria-live="polite">
        {copied === 'ok' ? t.copied : copied === 'failed' ? t.copyFailed : ''}
      </p>
    </div>
  );
}
