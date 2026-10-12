'use client';

import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useIsoLayoutEffect } from './layout';

/**
 * THE CALCULATORS' SHELL — the printed sheet's moment. (What the shell is,
 * and a calculator built on it: index.ts.)
 *
 * On paper a calculator is a calculation sheet (calc.css, the print rules;
 * its letterhead and its disclaimer are the page's — views/CalculatorPage.tsx).
 * Two things about it are only known at the moment of printing, and are the
 * component's to do: the line that says when, with the address that opens
 * this very case; and the drawings, which are drawn again for the sheet's
 * width and not the window's.
 */

/** When the sheet was printed, as the page's language writes a date, and the address that opens the case on it. */
export type Stamp = { when: string; url: string };

/**
 * The printed sheet says when it was printed and gives the address that
 * opens this very case. Written at the moment of printing — `beforeprint`
 * is the button and the browser's own Print alike — and put on the page
 * at once, before the browser lays it out for paper.
 *
 * `onPaper` is true from that moment until the browser is done: the three
 * diagrams are drawn at their shortest for paper, so that the beam and all
 * three share the first sheet under the input; on screen their height is
 * the window's to give (layout.ts, usePlotHeight).
 *
 * `locale`: the page's (the words' `sheet.locale`). `url`: the address of
 * the case on screen, asked for at the moment of printing — the link of
 * address.ts for the case as it is then.
 */
export function useSheet({ locale, url }: { locale: string; url: () => string }): { stamp: Stamp | null; onPaper: boolean } {
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [onPaper, setOnPaper] = useState(false);
  // The address is the one of the case on screen when the sheet is printed, not when this was set up.
  const latest = useRef(url);
  useIsoLayoutEffect(() => {
    latest.current = url;
  });
  useEffect(() => {
    const mark = () => {
      const when = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
      const address = latest.current();
      flushSync(() => {
        setStamp({ when, url: address });
        setOnPaper(true);
      });
    };
    const back = () => setOnPaper(false);
    window.addEventListener('beforeprint', mark);
    window.addEventListener('afterprint', back);
    return () => {
      window.removeEventListener('beforeprint', mark);
      window.removeEventListener('afterprint', back);
    };
  }, [locale]);
  return { stamp, onPaper };
}

/**
 * On paper only: when the sheet was printed, and the address that opens this
 * very case again. The last thing in the calculator (.mp-app). `t`: the two
 * lines, with {when} and {url} where those go.
 */
export function SheetStamp({ stamp, t }: { stamp: Stamp | null; t: { printed: string; link: string } }) {
  return stamp ? (
    <p className="mp-sheet mp-sheet__stamp">
      {t.printed.replace('{when}', stamp.when)} · {t.link.replace('{url}', stamp.url)}
    </p>
  ) : null;
}
