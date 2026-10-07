import { describe, expect, it } from 'vitest';
import { firstSentence } from './text';

/**
 * `firstSentence` decides how much of a county program's filing deadline the
 * hero of its page prints (ServiceDetailView): the row's first sentence, with
 * what qualifies it left in the row. A cut in the wrong place would print
 * half a deadline on the first screen, so the rule is pinned here; what the
 * two heroes actually print is checked against the real rows in
 * views/pages.test.ts.
 */
describe('firstSentence', () => {
  it('stops at the first full stop that ends a sentence', () => {
    expect(firstSentence('Due on the date in the letter. Older guides differ.')).toBe(
      'Due on the date in the letter.',
    );
    expect(firstSentence('El plazo (el de la carta). Las guías antiguas difieren.')).toBe(
      'El plazo (el de la carta).',
    );
  });

  // A full stop inside a number or a reference ends nothing, and neither
  // does one before a lower-case word.
  it('does not stop inside a reference or at an abbreviation in mid-sentence', () => {
    expect(firstSentence('Section 8-11.f applies. Then the rest.')).toBe('Section 8-11.f applies.');
    expect(firstSentence('Approx. the same. Then the rest.')).toBe('Approx. the same.');
  });

  it('returns a single sentence whole, with or without its full stop', () => {
    expect(firstSentence('Every 10 years')).toBe('Every 10 years');
    expect(firstSentence('Only one sentence.')).toBe('Only one sentence.');
  });
});
