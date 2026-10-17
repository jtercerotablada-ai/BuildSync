import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NumField } from '@/components/ttc/calc/NumField';
import { noticeTimer } from '@/components/ttc/calc/shell/Actions';
import { fieldNumber, sayNumber } from '@/lib/calc/format';

/**
 * The shared pass of 2026-10-17 (the pieces every calculator uses): the copy
 * notice's single timer, the line under a field that names a value, the
 * field's placeholder, and errors that print black. One calculator's work
 * does not touch these; when they change, every calculator's suite runs.
 */

/** Timers that run when the test says so, so that a second start can be told from a first. */
function fakeTimers() {
  let next = 1;
  const pending = new Map<number, () => void>();
  const cleared: number[] = [];
  return {
    timers: {
      set: (run: () => void) => {
        const id = next++;
        pending.set(id, run);
        return id;
      },
      clear: (id: number) => {
        cleared.push(id);
        pending.delete(id);
      },
    },
    pending,
    cleared,
    // A timer that fires is gone, as in a browser.
    fire: () => [...pending.entries()].forEach(([id, run]) => { pending.delete(id); run(); }),
  };
}

describe('the copy notice has one timer', () => {
  it('a second start restarts the four seconds: the first timer is cleared, and only the second can end the notice', () => {
    const f = fakeTimers();
    let ended = 0;
    const timer = noticeTimer(() => ended++, 4000, f.timers);
    timer.start();
    timer.start();
    expect(f.cleared).toEqual([1]);
    expect(f.pending.size).toBe(1);
    f.fire();
    expect(ended).toBe(1);
    // It ended once and holds nothing: another start begins afresh.
    timer.start();
    expect(f.pending.size).toBe(1);
  });

  it('stop leaves nothing pending, and stopping when nothing runs is fine', () => {
    const f = fakeTimers();
    let ended = 0;
    const timer = noticeTimer(() => ended++, 4000, f.timers);
    timer.stop();
    timer.start();
    timer.stop();
    expect(f.pending.size).toBe(0);
    f.fire();
    expect(ended).toBe(0);
  });
});

describe('a value named under a field is not spelt like a spreadsheet', () => {
  it('writes a value that needs an exponent as the tables do, with a true minus', () => {
    expect(sayNumber(2.2481e-13)).toBe('2.2481 × 10^−13');
    expect(sayNumber(-3.5e-7)).toBe('-3.5 × 10^−7');
    expect(sayNumber(1.1111111e39)).toBe('1.1111111 × 10^39');
  });
  it('leaves an ordinary value as the field shows it, and a value that is not a number as nothing', () => {
    expect(sayNumber(12.5)).toBe(fieldNumber(12.5));
    expect(sayNumber(1250)).toBe('1250');
    expect(sayNumber(Number.NaN)).toBe('');
    expect(sayNumber(Number.POSITIVE_INFINITY)).toBe('');
  });
  it('a field still shows what it can read back: the field keeps the spreadsheet spelling', () => {
    expect(fieldNumber(2.2481e-13)).toBe('2.2481e-13');
  });
});

describe('a field that may be empty can say what empty stands for', () => {
  const numbers = { group: ',', ambiguous: '', refused: '', emptied: '' };
  it('prints the placeholder on an empty field and none where it is not given', () => {
    const empty = renderToStaticMarkup(h(NumField, { label: 'Load', unit: 'lb/ft', value: Number.NaN, emptyIs: Number.NaN, placeholder: 'same as state 1: 100 lb/ft', numbers, onChange: () => undefined }));
    expect(empty).toContain('placeholder="same as state 1: 100 lb/ft"');
    expect(empty).toContain('value=""');
    const plain = renderToStaticMarkup(h(NumField, { label: 'Load', unit: 'lb/ft', value: 25, numbers, onChange: () => undefined }));
    expect(plain).not.toContain('placeholder');
    expect(plain).toContain('value="25"');
  });
});

describe('errors print black', () => {
  const css = readFileSync(join(__dirname, '..', 'calc.css'), 'utf8').replace(/\r\n/g, '\n');
  it('the first print block turns the problems box and a marked field black', () => {
    const print = css.slice(css.indexOf('@media print {'));
    const block = print.slice(0, print.indexOf('/* 1. The letterhead. */'));
    expect(block).toMatch(/\.mp-app__issues li \{\s*color: #000 !important;\s*border-color: #000 !important;/);
    expect(block).toMatch(/\.mp-num\[data-invalid='true'\] \.mp-num__box \{\s*border-block-end-color: #000 !important;/);
  });
});
