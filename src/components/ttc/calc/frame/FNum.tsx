'use client';

import React, { useId, useState } from 'react';
import { ambiguousNumber, parseNumber } from '@/lib/calc/format';
import { NumField } from '../NumField';
import { fill } from './text';

/**
 * A number field of the frame calculator: the shared field (../NumField), and what it leaves to the page.
 *
 * THE SHARED FIELD says nothing about a text that is not a number until the field is left (then it says “abc” is not a number, the
 * value is still 10), but from the first key the results already stand on the value the edit began with. A visitor typing “5e1” or
 * clearing a field to retype it saw the results go back to the old value, with the field red and nothing said, and the numbers on the
 * page looked like the ones typed. So here the same sentence (the shared field's own words, `numbers.refused` and `numbers.emptied`)
 * is shown AS SOON AS the text stops being a number, tied to the field by `aria-describedby` and announced, and it goes when the field
 * is left (the shared field says it then, about the value that stands). Junk and an empty field are the same case: the value that
 * stands is the one the edit began with, and both say so.
 *
 * It wraps the field in an element that takes no box of its own (`display: contents`, frame.css), so that the field and its line are
 * laid out in the grid of the form as before.
 */
type Props = React.ComponentProps<typeof NumField> & {
  /** How the page writes the value that stands, in the sentence ("1 × 10^-12", never "1e-12"). */
  format: (value: number) => string;
};

/**
 * The text a field holds when it is not a number (null when it is one, or when it is one the shared field has its own line for: a text
 * that reads two ways). An empty text is the same case, and is '' - unless the field may be empty, where it is its empty value.
 */
export function refusedText(text: string, group: string, canBeEmpty: boolean): string | null {
  if (text.trim() === '') return canBeEmpty ? null : text;
  return parseNumber(text, group) !== null || ambiguousNumber(text, group) !== null ? null : text;
}

export function FNum({ format, ...field }: Props) {
  const id = useId();
  // The text in the field, while it is not a number and the field has focus.
  const [typed, setTyped] = useState<string | null>(null);
  const group = field.numbers?.group ?? ',';
  const canBeEmpty = field.emptyIs !== undefined;

  const look = (text: string) => setTyped(refusedText(text, group, canBeEmpty));

  const words = field.numbers;
  const line =
    typed !== null && words && Number.isFinite(field.value)
      ? fill(typed.trim() === '' ? (words.emptied ?? '') : words.refused, { text: typed.length > 24 ? `${typed.slice(0, 24)}…` : typed, value: format(field.value) })
      : '';
  const tied = [field.describedBy ?? '', line ? id : ''].filter(Boolean).join(' ');

  return (
    <span className="mp-frame__f" onInput={(e) => (e.target instanceof HTMLInputElement ? look(e.target.value) : undefined)} onBlur={() => setTyped(null)}>
      <NumField {...field} describedBy={tied || undefined} />
      {line ? (
        <p className="mp-num__hint" id={id} role="status">
          {line}
        </p>
      ) : null}
    </span>
  );
}
