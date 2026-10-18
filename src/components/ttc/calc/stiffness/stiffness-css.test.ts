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

/* ── What a reader with another need gets ─────────────────────────────── */

const site = readFileSync(resolve(__dirname, '../../../../app/(public)/mp.css'), 'utf8').replace(/\r\n/g, '\n');
type Rgb = [number, number, number];
const token = (name: string): string => site.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))![1];
const rgbOf = (hex: string): Rgb => {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  return [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
};
const mix = (fg: Rgb, bg: Rgb, alpha: number): Rgb => fg.map((c, k) => c * alpha + bg[k] * (1 - alpha)) as Rgb;
const luminance = ([r, g, b]: Rgb): number => {
  const lin = (c: number) => ((c / 255) <= 0.03928 ? c / 255 / 12.92 : (((c / 255) + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const PAPER = rgbOf(token('--mp-paper'));
const paletteOf = (name: string): Rgb => {
  const m = noComments.match(new RegExp(`--mp-st-${name}:\\s*(\\d+),\\s*(\\d+),\\s*(\\d+)`))!;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
/** The colour a cell of a mark is painted over the paper (its background-color; the hatch lines are thin and are not under the text of a digit that has a halo). */
const markBackground = (reason: string): Rgb => {
  const body = bodyOf(`.mp-st .mp-st__matrix .mp-st__hl--${reason}`);
  const m = body.match(/background-color:\s*rgba\(var\(--mp-st-(\w+)\),\s*([\d.]+)\)/);
  return m ? mix(paletteOf(m[1]), PAPER, Number(m[2])) : PAPER;
};
const colourOf = (body: string): Rgb | null => {
  const m = body.match(/(?<![-\w])color:\s*(var\(--[\w-]+\)|#[0-9a-fA-F]{6})/);
  if (!m) return null;
  return rgbOf(m[1].startsWith('#') ? m[1] : token(m[1].slice(4, -1)));
};

describe('the zeros read', () => {
  const zeroBody = [...rules.filter((r) => r.selectors.some((x) => /mp-st__zero--(light|dot)/.test(x)))].map((r) => r.body).join('\n');

  it('are lighter than the digits by their colour and not by a veil of opacity: no opacity on a zero, in the screen sheet or the printed one', () => {
    expect(zeroBody).not.toMatch(/opacity/);
    expect(bodyOf('.mp-st .mp-st__zero--light')).toMatch(/color:\s*var\(--mp-ink-3\)/);
  });

  it('reach 4.5:1 on the paper and on every mark a cell can carry, the default style of zero included - and a digit is darker than a zero', () => {
    const zero = colourOf(bodyOf('.mp-st .mp-st__zero--light'))!;
    expect(contrast(zero, PAPER)).toBeGreaterThanOrEqual(4.5);
    for (const reason of HIGHLIGHT_REASONS) {
      if (reason === 'pivot') continue;
      expect(contrast(zero, markBackground(reason)), reason).toBeGreaterThanOrEqual(4.5);
    }
    const ink = rgbOf(token('--mp-ink'));
    expect(contrast(ink, PAPER)).toBeGreaterThan(contrast(zero, PAPER));
    // The old zero: the faint ink under a 0.55 veil. It was 2.25:1, which is what this test would see of it.
    const veiled = mix(rgbOf(token('--mp-ink-faint')), PAPER, 0.55);
    expect(contrast(veiled, PAPER)).toBeLessThan(3);
  });

  it('reach 4.5:1 on paper in the printed sheet (a grey, no veil)', () => {
    const printed = rulesOf(print).filter((r) => r.selectors.includes('.mp-st .mp-st__zero--light')).map((r) => r.body).join('\n');
    expect(printed).not.toMatch(/opacity/);
    const grey = printed.match(/color:\s*(#[0-9a-fA-F]{3,6})/)![1];
    expect(contrast(rgbOf(grey), [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the marks in forced colors', () => {
  const forced = noComments.slice(noComments.indexOf('@media (forced-colors: active)'));
  const forcedRules = rulesOf(forced.slice(0, forced.indexOf('.mp-st .mp-st__legend {')));
  const forcedBody = (selector: string) => forcedRules.filter((r) => r.selectors.includes(selector)).map((r) => r.body).join('\n');

  it('gives every reason an outline of its own kind (a background does not survive forced colors), cells and legend swatches alike, in system colours only', () => {
    const signature = (reason: string): string => {
      const cell = forcedBody(`.mp-st .mp-st__matrix .mp-st__hl--${reason}`).replace(/\s+/g, ' ').trim();
      const swatch = forcedBody(`.mp-st .mp-st__swatch.mp-st__hl--${reason}`).replace(/\s+/g, ' ').trim();
      // The cell and the swatch of a reason are drawn the same.
      expect(swatch, reason).toBe(cell);
      return cell;
    };
    const seen = new Map<string, string>();
    for (const reason of HIGHLIGHT_REASONS) {
      const sig = signature(reason);
      expect(sig, reason).toMatch(/outline:|background:\s*Highlight/);
      // …in a system colour, never one of the palette's.
      expect(sig, reason).not.toMatch(/rgba?\(|#[0-9a-f]{3,6}|var\(/i);
      // Two reasons that can stand in one table are not the same line (the pivot is an inverted cell, the others outlines).
      const key = sig.replace(/outline-offset[^;]*;/g, '');
      if (['axial', 'bending', 'contributed', 'shared', 'eliminated', 'updated', 'zero-pivot', 'pivot', 'position'].includes(reason)) {
        expect(seen.get(key), `${reason} is drawn as ${seen.get(key)}`).toBeUndefined();
        seen.set(key, reason);
      }
    }
  });

  it('keeps the pivot an inverted cell in system colours, the one thing that cannot be taken for another', () => {
    const pivot = forcedBody('.mp-st .mp-st__matrix .mp-st__hl--pivot');
    expect(pivot).toMatch(/forced-color-adjust:\s*none/);
    expect(pivot).toMatch(/background:\s*Highlight/);
    expect(pivot).toMatch(/color:\s*HighlightText/);
  });

  it('marks the held heads of a row and of a column with an outline too, and drops the halo that a hatch needed', () => {
    expect(forcedBody('.mp-st .mp-st__matrix .mp-st__rowmark--restrained')).toMatch(/outline:/);
    expect(forcedBody('.mp-st .mp-st__matrix .mp-st__hl .mp-st__num')).toMatch(/text-shadow:\s*none/);
  });
});

describe('the lines that are told when they arrive are in the page before they have anything to say', () => {
  it('are out of sight when empty by the clip technique - which keeps them in the accessibility tree - and never by display: none, which removes them', () => {
    for (const selector of ['.mp-st .mp-st__warnings[data-empty]', '.mp-st .mp-st__partial[data-empty]', '.mp-st .mp-app__issues:empty', '.mp-st .mp-st__copied:empty', '.mp-st .mp-st__notice:empty', '.mp-st .mp-st__announce:empty', '.mp-st .mp-st__said:empty']) {
      const body = bodyOf(selector);
      expect(body, selector).toMatch(/clip-path:\s*inset\(50%\)/);
      expect(body, selector).toMatch(/position:\s*absolute/);
      expect(body, selector).not.toMatch(/display:\s*none/);
    }
  });
});

describe('the drawing stays beside the form, and the way through the steps stays under the thumb', () => {
  it('pins only the drawing and the sentence that reads it: the column is not sticky, its pin is, and it lets go when it is taller than the window', () => {
    expect(bodyOf('.mp-st .mp-app__out.mp-st__out')).toMatch(/position:\s*static/);
    expect(bodyOf('.mp-st .mp-app__out.mp-st__out')).toMatch(/display:\s*flex/);
    expect(bodyOf('.mp-st .mp-app__out.mp-st__out')).toMatch(/align-self:\s*stretch/);
    expect(bodyOf('.mp-st .mp-st__pin')).toMatch(/position:\s*sticky/);
    expect(bodyOf('.mp-st .mp-st__pin')).toMatch(/top:\s*calc\(var\(--mp-header-h/);
    expect(bodyOf('.mp-st .mp-st__pin.mp-st__pin--tall')).toMatch(/position:\s*static/);
  });

  it('puts the steps bar at the foot of the screen below 1100 px: sticky to the bottom, 44 px to press, under the site’s header, and gone on a wide screen and on paper', () => {
    const narrow = noComments;
    const bar = rulesOf(narrow).filter((r) => r.selectors.includes('.mp-st .mp-st__stepbar')).map((r) => r.body).join('\n');
    expect(bar).toMatch(/position:\s*sticky/);
    expect(bar).toMatch(/bottom:\s*0/);
    expect(Number(bar.match(/z-index:\s*(\d+)/)![1])).toBeLessThan(70);
    expect(rulesOf(narrow).filter((r) => r.selectors.includes('.mp-st .mp-st__stepbar .mp-app__btn')).map((r) => r.body).join('')).toMatch(/min-height:\s*44px/);
    expect(rulesOf(narrow).filter((r) => r.selectors.includes('.mp-st .mp-st__jump select')).map((r) => r.body).join('')).toMatch(/min-height:\s*44px/);
    // The cards go in a column there (a bar that is a grid item sticks only inside its own row).
    expect(rulesOf(narrow).filter((r) => r.selectors.includes('.mp-st .mp-st__layout')).map((r) => r.body).join('')).toMatch(/display:\s*flex/);
    expect(bodyOf('.mp-st .mp-st__stepbar')).toMatch(/display:\s*none/);
    expect(print).toContain('.mp-st .mp-st__stepbar');
  });

  it('keeps a skip link out of the flow when it has the focus, so that the page does not move under the reader', () => {
    expect(bodyOf('.mp-st')).toMatch(/position:\s*relative/);
    expect(bodyOf('.mp-st .mp-st__jumps:focus-within')).not.toMatch(/position:\s*static/);
    expect(bodyOf('.mp-st .mp-st__skip:focus')).not.toMatch(/position:\s*static/);
    expect(bodyOf('.mp-st .mp-st__skip')).toMatch(/position:\s*absolute/);
  });
});

describe('the printed sheet reads', () => {
  const sizeOf = (selector: string): number => Number(bodyOf(selector).match(/font-size:\s*([\d.]+)pt/)?.[1] ?? 0);
  const printRules = rulesOf(print);
  const printSize = (selector: string): number => Number(printRules.filter((r) => r.selectors.includes(selector)).map((r) => r.body).join('\n').match(/font-size:\s*([\d.]+)pt/)?.[1] ?? 0);
  void sizeOf;

  it('sets the entries of a matrix at 7 pt or more, its symbols, notes and legend at 6.5 pt or more, and nothing of a card under 6.5 pt', () => {
    expect(printSize('.mp-st .mp-st__matrix')).toBeGreaterThanOrEqual(7);
    for (const selector of ['.mp-st .mp-st__sym', '.mp-st .mp-st__legend', '.mp-st .mp-st__factor', '.mp-st .mp-st__units', '.mp-st .mp-st__name', '.mp-st .mp-st__stepnum']) {
      expect(printSize(selector), selector).toBeGreaterThanOrEqual(6.5);
    }
    for (const rule of printRules) {
      for (const m of rule.body.matchAll(/font-size:\s*([\d.]+)pt/g)) expect(Number(m[1]), rule.selectors.join()).toBeGreaterThanOrEqual(6.5);
    }
  });

  it('draws the screen title of the drawing nowhere on paper (the sheet’s figures carry their own), and takes the bar, the way back and the print note off the sheet', () => {
    for (const hidden of ['.mp-st .mp-st__stepbar', '.mp-st .mp-st__back', '.mp-st .mp-st__printnote', '.mp-st .mp-st__skip', '.mp-st .mp-st__later']) expect(print, hidden).toContain(hidden);
  });
});

describe('the room kept for a table not drawn', () => {
  it('is a box with a hairline, and is not there at all where scripts are off (the tables never come)', () => {
    expect(bodyOf('.mp-st .mp-st__later')).toMatch(/border:\s*1px dashed/);
    expect(noComments).toMatch(/@media \(scripting: none\)\s*\{\s*\.mp-st \.mp-st__later\s*\{\s*display:\s*none;/);
  });
});

describe('a block’s name is never inside a number’s cell', () => {
  it('has no rule for a name in a cell, and the name row is a row of its own with the line that cuts the partition', () => {
    expect(noComments).not.toContain('mp-st__named');
    expect(noComments).not.toMatch(/\.mp-st__block\s*\{/);
    expect(bodyOf('.mp-st .mp-st__matrix .mp-st__blockrow > td')).toMatch(/font-weight:\s*700/);
    expect(bodyOf('.mp-st .mp-st__matrix .mp-st__cut-row > td')).toMatch(/border-block-start:\s*2px solid/);
  });

  it('draws a shared cell with one direction of hatch and a halo behind the digits, not two directions through them', () => {
    const shared = bodyOf('.mp-st .mp-st__matrix .mp-st__hl--shared');
    expect((shared.match(/repeating-linear-gradient/g) ?? []).length).toBe(1);
    expect(bodyOf('.mp-st .mp-st__matrix .mp-st__hl .mp-st__num')).toMatch(/text-shadow:/);
  });
});
