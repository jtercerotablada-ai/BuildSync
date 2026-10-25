import { describe, expect, it } from 'vitest';
import { NUMBER_WORD_MAX, numberWord, withNumberWord } from './number-words';

const EN = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const ES = ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce'];

describe('numberWord: one to twelve, in both languages', () => {
  it('says each count in English', () => {
    EN.forEach((word, i) => expect(numberWord(i + 1, 'en')).toBe(word));
  });

  it('says each count in Spanish', () => {
    ES.forEach((word, i) => expect(numberWord(i + 1, 'es')).toBe(word));
  });

  it('knows exactly twelve', () => {
    expect(NUMBER_WORD_MAX).toBe(12);
    expect(numberWord(NUMBER_WORD_MAX, 'en')).toBe('twelve');
    expect(numberWord(NUMBER_WORD_MAX + 1, 'en')).toBe('13');
  });

  it('gives every count its own word, in lower case', () => {
    for (const words of [EN, ES]) {
      expect(new Set(words).size).toBe(words.length);
      for (const w of words) expect(w).toBe(w.toLowerCase());
    }
  });

  it('keeps the page rendering past twelve, in digits, and for what is not a count', () => {
    expect(numberWord(13, 'es')).toBe('13');
    expect(numberWord(97, 'en')).toBe('97');
    expect(numberWord(0, 'en')).toBe('0');
    expect(numberWord(-3, 'es')).toBe('-3');
    expect(numberWord(2.5, 'en')).toBe('2.5');
    expect(numberWord(Number.NaN, 'en')).toBe('NaN');
  });
});

describe('withNumberWord: the count goes where {n} is', () => {
  it('opens a sentence with a capital', () => {
    expect(withNumberWord('{n} free engineering calculators', 9, 'en')).toBe('Nine free engineering calculators');
    expect(withNumberWord('{n} calculadoras de ingeniería gratuitas', 9, 'es')).toBe('Nueve calculadoras de ingeniería gratuitas');
    expect(withNumberWord('{n} guides for building owners', 7, 'en')).toBe('Seven guides for building owners');
    expect(withNumberWord('{n} guías para propietarios de edificios', 7, 'es')).toBe('Siete guías para propietarios de edificios');
  });

  it('keeps lower case anywhere else in the sentence', () => {
    expect(withNumberWord('All {n} of them', 4, 'en')).toBe('All four of them');
    expect(withNumberWord('Los {n} primeros', 3, 'es')).toBe('Los tres primeros');
  });

  it('puts the numeral where there is no word', () => {
    expect(withNumberWord('{n} guides', 14, 'en')).toBe('14 guides');
  });

  it('leaves a template with no {n} as it is', () => {
    expect(withNumberWord('Get in touch', 9, 'en')).toBe('Get in touch');
  });
});
