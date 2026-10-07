import { describe, expect, it } from 'vitest';
import { afterFirstSentence, firstSentence } from './text';

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

/**
 * `afterFirstSentence` is the other half: what the home page prints under a
 * county program's button (ProgramSection), where the whole line belongs to
 * the program's own page. The two halves must put the line back together.
 */
describe('afterFirstSentence', () => {
  it('returns what follows the first sentence', () => {
    expect(afterFirstSentence('A photo is enough. No notice yet? Send the address.')).toBe(
      'No notice yet? Send the address.',
    );
    expect(afterFirstSentence('Basta una foto. ¿Aún no tiene notificación? Envíe la dirección.')).toBe(
      '¿Aún no tiene notificación? Envíe la dirección.',
    );
  });

  it('is empty when there is one sentence', () => {
    expect(afterFirstSentence('Only one sentence.')).toBe('');
    expect(afterFirstSentence('Every 10 years')).toBe('');
  });

  it('with `firstSentence`, gives the paragraph back', () => {
    const line = 'A photo is enough. No notice yet? Send the address.';
    expect(`${firstSentence(line)} ${afterFirstSentence(line)}`).toBe(line);
  });
});
