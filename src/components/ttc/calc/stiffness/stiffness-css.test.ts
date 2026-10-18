import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HIGHLIGHT_REASONS } from '@/lib/calc/stiffness/codes';

/**
 * THE STIFFNESS SHEET'S RULES that a screenshot would not catch at the moment they break: the weight of every selector, the 44 px of every
 * control, the marks that must mean something without colour, and what the printed sheet keeps and drops.
 */

const css = readFileSync(resolve(__dirname, 'stiffness.css'), 'utf8').replace(/\r\n/g, '\n');
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const printAt = noComments.indexOf('\n@media print');
const screen = noComments.slice(0, printAt);
const print = noComments.slice(printAt);

/** Every rule `selector { body }` outside an at-rule, selector list split, by selector. */
function rulesOf(sheet: string): { selectors: string[]; body: string }[] {
  const out: { selectors: string[]; body: string }[] = [];
  for (const m of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x && !x.startsWith('@'));
    if (selectors.length) out.push({ selectors, body: m[2] });
  }
  return out;
}
const rules = rulesOf(noComments);
const bodyOf = (selector: string): string => rules.filter((r) => r.selectors.includes(selector)).map((r) => r.body).join('\n');

describe('the weight of the rules', () => {
  it('keeps every rule at two classes, but the drawing’s own and the root', () => {
    const single = rules.flatMap((r) => r.selectors).filter((s) => /^\.mp-[\w-]+$/.test(s) && !s.startsWith('.mp-st-fig__') && s !== '.mp-st');
    expect(single).toEqual([]);
  });

  it('puts nothing of this sheet on a class of another calculator, and nothing of another on this one', () => {
    for (const selector of rules.flatMap((r) => r.selectors)) {
      expect(selector, selector).not.toMatch(/\.mp-(beam|span|cont|shaft|truss|cable|sag|frame)\b/);
    }
    expect(css).not.toMatch(/!important[^;]*;[^}]*\bz-index\b/);
  });

  it('names no vendor and no design code', () => {
    expect(css).not.toMatch(/(AISC|ACI|ASCE|Eurocode|SkyCiv|RISA|ETABS|SAP2000)/i);
  });
});

describe('the controls', () => {
  it('give every control 44px to be pressed with', () => {
    for (const selector of ['.mp-st .mp-st__check', '.mp-st .mp-st__jumps a', '.mp-st .mp-st__bar .mp-app__btn', '.mp-st .mp-st__stagelink', '.mp-st .mp-st__toggle', '.mp-st .mp-st__copy']) {
      expect(bodyOf(selector), selector).toMatch(/min-height:\s*44px/);
    }
    expect(bodyOf('.mp-st .mp-st__chip')).toMatch(/min-width:\s*44px/);
    expect(bodyOf('.mp-st .mp-st__chip')).toMatch(/min-height:\s*44px/);
    expect(bodyOf('.mp-st .mp-st__item')).toContain('grid-template-columns: minmax(0, 1fr) 44px');
    // The remove button sits in the 44px column of its row.
    expect(bodyOf('.mp-st .mp-st__item > .mp-app__row--rm > .mp-app__remove')).toContain('grid-area: 1 / 2');
    // Nothing smaller is asked of a control anywhere on screen.
    for (const rule of rulesOf(screen)) {
      if (!rule.selectors.some((s) => /__(toggle|chip|stagelink|copy|check|jumps a|more|shape-open)/.test(s))) continue;
      for (const m of rule.body.matchAll(/min-(?:height|width):\s*(\d+)px/g)) expect(Number(m[1]), rule.selectors.join()).toBeGreaterThanOrEqual(44);
    }
  });

  it('shows a focus ring on what the keyboard reaches', () => {
    expect(css).toMatch(/\.mp-st \.mp-st__chip:focus-visible/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline/);
  });
});

describe('the marks on the matrices', () => {
  const classesOf = (reason: string) => [`.mp-st .mp-st__matrix .mp-st__hl--${reason}`, `.mp-st .mp-st__swatch.mp-st__hl--${reason}`];

  it('has a rule for every reason the library gives a cell, on a cell and on its legend swatch alike', () => {
    for (const reason of HIGHLIGHT_REASONS) {
      for (const selector of classesOf(reason)) {
        // A held or prescribed row is marked on its row head as well (it is the whole row that is held), not only on a cell.
        expect(rules.some((r) => r.selectors.includes(selector)), selector).toBe(true);
      }
    }
  });

  it('marks each by something that is not a colour: a pattern, a line, a weight or an inversion', () => {
    for (const reason of HIGHLIGHT_REASONS) {
      const body = bodyOf(classesOf(reason)[0]);
      expect(body, reason).toMatch(/background-image|box-shadow|outline|font-weight|background:\s*var\(--mp-ink\)/);
    }
  });

  it('gives no two reasons the same mark once the colours are taken away (a photocopy still tells them apart)', () => {
    const signature = (reason: string): string =>
      bodyOf(classesOf(reason)[0])
        .replace(/rgba\([^)]*\)/g, 'C')
        .replace(/var\(--[\w-]+\)/g, 'V')
        .replace(/background-color:[^;]*;/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const seen = new Map<string, string>();
    for (const reason of HIGHLIGHT_REASONS) {
      const sig = signature(reason);
      expect(seen.get(sig), `${reason} looks like ${seen.get(sig)} without colour: ${sig}`).toBeUndefined();
      seen.set(sig, reason);
    }
  });

  it('draws the pivot as an inverted cell, the one thing that cannot be mistaken for another', () => {
    const body = bodyOf(classesOf('pivot')[0]);
    expect(body).toMatch(/background:\s*var\(--mp-ink\)/);
    expect(body).toMatch(/color:\s*var\(--mp-paper\)/);
    expect(bodyOf('.mp-st .mp-st__matrix .mp-st__hl--pivot .mp-st__sym')).toMatch(/color:\s*var\(--mp-paper\)/);
  });

  it('makes a zero pivot dashed, so that it is a different thing from the pivot that works', () => {
    expect(bodyOf(classesOf('zero-pivot')[0])).toMatch(/outline:\s*2px dashed/);
  });

  it('keeps the head of a matrix in view as it scrolls, the corner above both', () => {
    expect(bodyOf('.mp-st .mp-st__matrix thead th')).toMatch(/position:\s*sticky/);
    expect(bodyOf('.mp-st .mp-st__matrix tbody th')).toMatch(/position:\s*sticky/);
    expect(bodyOf('.mp-st .mp-st__matrix .mp-st__corner')).toMatch(/position:\s*sticky/);
    const z = (selector: string) => Number(bodyOf(selector).match(/z-index:\s*(\d+)/)![1]);
    expect(z('.mp-st .mp-st__matrix .mp-st__corner')).toBeGreaterThan(z('.mp-st .mp-st__matrix thead th'));
    expect(z('.mp-st .mp-st__matrix thead th')).toBeGreaterThan(z('.mp-st .mp-st__matrix tbody th'));
  });

  it('writes the numbers in a column to the right, with the same width of digit, so that the decimal points line up', () => {
    expect(bodyOf('.mp-st .mp-st__matrix td')).toMatch(/text-align:\s*end/);
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(bodyOf('.mp-st .mp-st__matrix td')).toMatch(/white-space:\s*nowrap/);
  });
});

describe('the printed sheet', () => {
  it('takes off it what is a way to start, to look or to press: the templates, the switches, the outline and every button', () => {
    for (const hidden of ['.mp-st .mp-st__template', '.mp-st .mp-st__options', '.mp-st .mp-st__aside', '.mp-st .mp-st__looks', '.mp-st .mp-st__copy', '.mp-st .mp-st__jumps', '.mp-st .mp-st__chev', '.mp-st .mp-st__long']) {
      expect(print, hidden).toContain(hidden);
    }
    const hide = print.match(/([^{}]+)\{\s*display:\s*none\s*!important;\s*\}/)![1];
    for (const hidden of ['.mp-st__template', '.mp-st__aside', '.mp-st__copy', '.mp-st__jumps']) expect(hide, hidden).toContain(hidden);
  });

  it('keeps the patterns and drops the colours: every colour of a mark goes to black, and the cells are told to print their backgrounds', () => {
    for (const v of ['--mp-st-axial', '--mp-st-bending', '--mp-st-shared', '--mp-st-gold', '--mp-st-error', '--mp-st-held']) expect(print, v).toContain(`${v}: 0, 0, 0;`);
    expect(print).toMatch(/\.mp-st \.mp-st__matrix td,\s*\.mp-st \.mp-st__matrix th,\s*\.mp-st \.mp-st__swatch \{[^}]*print-color-adjust:\s*exact/);
    expect(print).toMatch(/\.mp-st \.mp-st__matrix \.mp-st__hl--pivot,\s*\.mp-st \.mp-st__swatch\.mp-st__hl--pivot \{[^}]*background:\s*#000;[^}]*color:\s*#fff;/);
  });

  it('keeps a figure whole on its sheet and lets the matrices and the solution run over the pages', () => {
    expect(print).toMatch(/\.mp-st \.mp-st-fig \{\s*break-inside:\s*avoid;/);
    expect(print).toMatch(/\.mp-st-fig__scroll \{\s*overflow:\s*visible\s*!important;/);
  });

  it('is the only place the sheet uses a unit of paper (pt, mm), and nowhere on screen', () => {
    expect(screen).not.toMatch(/\d(pt|mm)\b/);
    expect(print).toMatch(/\d(pt|mm)\b/);
  });
});

describe('the drawing', () => {
  it('draws the deformed shape in dashes and dots, a line of its own apart from the plain dashes of the loads and the supports', () => {
    expect(css).toMatch(/\.mp-st-fig__deformed \{[^}]*stroke-dasharray:\s*10 3 2 3;/);
  });

  it('has a ring for a node a problem is about, in a line that is neither the members’ nor the loads’', () => {
    expect(css).toMatch(/\.mp-st-fig__ring \{[^}]*stroke-dasharray/);
  });

  it('lets a wide drawing scroll in its own box on a phone, and says so', () => {
    expect(css).toMatch(/\.mp-st-fig__scroll--wide \{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/\.mp-st-fig__scroll--wide \.mp-st-fig__svg \{\s*max-width:\s*none;/);
  });
});
