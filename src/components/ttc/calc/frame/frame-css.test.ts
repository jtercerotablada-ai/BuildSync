import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, 'frame.css'), 'utf8').replace(/\r\n/g, '\n');
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('the frame sheet’s rules', () => {
  it('keeps every rule at the weight of two classes, but the drawing’s own', () => {
    const rules = noComments.match(/[^{}]+(?=\{)/g)!;
    const single = rules.map((r) => r.trim()).filter((r) => /^\.mp-[\w-]+$/.test(r) && !r.startsWith('.mp-frame-fig__') && r !== '.mp-frame');
    expect(single).toEqual([]);
  });
  it('gives every control 44px to be pressed with', () => {
    expect(css).toMatch(/\.mp-frame \.mp-frame__pick \{\s*min-width: 44px;\s*min-height: 44px;/);
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) 44px;');
    expect(css).toMatch(/\.mp-frame \.mp-frame__jump a \{[^}]*min-height: 44px;/);
    const screen = noComments.slice(0, noComments.indexOf('@media print'));
    for (const rule of screen.match(/[^{}]+\{[^}]*\}/g)!) {
      if (!/__pick|__jump/.test(rule)) continue;
      for (const m of rule.matchAll(/min-height:\s*(\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(44);
    }
  });
  it('takes the switches, the readout and the template off the sheet, and keeps each diagram whole as its own figure', () => {
    const print = noComments.slice(noComments.indexOf('@media print'));
    for (const hidden of ['.mp-frame .mp-frame__template', '.mp-frame .mp-frame__options', '.mp-frame .mp-frame__readout', '.mp-frame .mp-frame-fig__hits']) expect(print).toContain(hidden);
    expect(print).toMatch(/\.mp-frame \.mp-frame-fig \{\s*break-inside: avoid;/);
    expect(print).toContain('.mp-frame .mp-frame__sheetgrid {');
  });
  it('tells the three diagrams apart by pattern as well as colour, and goes to black on paper', () => {
    expect(css).toContain('.mp-frame-fig__pat--M');
    expect(css).toContain('.mp-frame-fig__pat--V');
    expect(css).toContain('.mp-frame-fig__dot');
    const print = noComments.slice(noComments.indexOf('@media print'));
    for (const v of ['--mp-frame-m: #000;', '--mp-frame-v: #000;', '--mp-frame-n: #000;']) expect(print).toContain(v);
    expect(print).toMatch(/\.mp-frame-fig__word,\s*\.mp-frame-fig__sign \{[^}]*stroke: #fff !important;/);
  });
  it('keeps the deformed line’s dash-dot apart from the plain dashes', () => {
    expect(css).toMatch(/\.mp-frame-fig__deformed \{[^}]*stroke-dasharray: 10 3 2 3;/);
  });
});
