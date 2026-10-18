'use client';

import React, { useId, useState } from 'react';
import { ambiguousNumber, parseNumber } from '@/lib/calc/format';
import { NumField } from '../NumField';
import { fill } from './text';

/**
 * A number field of the stiffness calculator: the shared field (../NumField), and what it leaves to the page.
 *
 * THE SHARED FIELD says nothing about a text that is not a number until the field is left (then it says “abc” is not a number, the
 * value is still 10), but from the first key the results already stand on the value the edit began with. A visitor typing “5e1” or
 * clearing a field to retype it saw the results go back to the old value, with the field red and nothing said, and the numbers on the
 * page looked like the ones typed. So here the same sentence (the shared field's own words, `numbers.refused` and `numbers.emptied`)
 * is shown AS SOON AS the text stops being a number, tied to the field by `aria-describedby`, and it goes when the field is left
 * (the shared field says it then, about the value that stands).
 *
 * THE FIELD WHOSE VALUE IS NOT A NUMBER (a member's own section, blank because the structure's is used; the structure's section left empty) has
 * no value to name, and the shared field says nothing about it, before or after leaving. Here the line is the field's own
 * (`words.blank`): the field stays empty. It stays under the field after it is left, until it is taken again.
 *
 * ANNOUNCED ONCE. The visible line carries the typed text and so changes with every key; a screen reader is not told that. A status
 * region, mounted empty with the field and filled with a sentence that does not change while the text stays a non-number (`words.live`),
 * is what announces it - once, when the text stops being a number, and not again for each further key.
 *
 * A POINT IN THE SPANISH PAGE. Where the page does not set thousands apart with a comma (Spanish), “1.000” is one here (a point is the
 * decimal mark) and a thousand to most Spanish writers: the field says how it was read (`words.point`) and what to write for thousands.
 *
 * It wraps the field in an element that takes no box of its own (`display: contents`, stiffness.css), so that the field and its line are
 * laid out in the grid of the form as before.
 */
export interface FNumWords {
  /** Announced when the text stops being a number: {value} stands. */
  live: string;
  /** Announced when the field is emptied and may not be. */
  liveEmptied: string;
  /** Said about a field that holds no number at all: {text}. */
  blank: string;
  /** Said when the field is emptied and holds no number at all. */
  blankEmptied: string;
  /** “1.000” in a page whose point is the decimal mark: {text} is read as {value}; {grouped} is what to write for thousands. */
  point: string;
}

type Props = React.ComponentProps<typeof NumField> & {
  /** How the page writes the value that stands, in the sentence ("1 × 10^-12", never "1e-12"). */
  format: (value: number) => string;
  words?: FNumWords;
};

/**
 * The text a field holds when it is not a number (null when it is one, or when it is one the shared field has its own line for: a text
 * that reads two ways). An empty text is the same case, and is '' - unless the field may be empty, where it is its empty value.
 */
export function refusedText(text: string, group: string, canBeEmpty: boolean): string | null {
  if (text.trim() === '') return canBeEmpty ? null : text;
  return parseNumber(text, group) !== null || ambiguousNumber(text, group) !== null ? null : text;
}

/** “1.000”, “12.500”: a point and three digits after one to three, which a page whose point is the decimal mark reads as 1 and 12.5. */
const POINT_THOUSANDS = /^(-?)([1-9]\d{0,2})\.(\d{3})$/;
export function pointThousands(text: string, group: string): { text: string; grouped: string; value: string } | null {
  if (group === ',') return null;
  const m = text.trim().match(POINT_THOUSANDS);
  return m ? { text: text.trim(), grouped: `${m[1]}${m[2]}${m[3]}`, value: `${m[1]}${m[2]}.${m[3]}` } : null;
}

const short = (text: string) => (text.length > 24 ? `${text.slice(0, 24)}…` : text);

/**
 * What a field says about the text in it, as one pure function: `line` (the sentence under the field: the text is not a number, and what stands),
 * `hint` (a point read as the decimal mark, “1.000”) and `live` (the sentence a screen reader is told, the same for every key while the text stays
 * a non-number). `typed` is the text while the field has focus and it is not a number; `left` the text a field of no number was left with.
 */
export function fieldSentences(o: {
  typed: string | null;
  left: string | null;
  point: ReturnType<typeof pointThousands>;
  standing: boolean;
  value: number;
  format: (v: number) => string;
  numbers?: { refused: string; emptied?: string };
  words?: FNumWords;
}): { line: string; hint: string; live: string } {
  const about = o.typed ?? o.left;
  const emptied = about !== null && about.trim() === '';
  let line = '';
  if (about !== null && o.numbers) {
    if (o.standing) line = fill(emptied ? (o.numbers.emptied ?? '') : o.numbers.refused, { text: short(about), value: o.format(o.value) });
    else if (o.words) line = fill(emptied ? o.words.blankEmptied : o.words.blank, { text: short(about) });
  }
  const hint = !line && o.point && o.words ? fill(o.words.point, o.point) : '';
  let live = '';
  if (o.typed !== null && o.words) live = o.standing ? fill(emptied ? o.words.liveEmptied : o.words.live, { value: o.format(o.value) }) : fill(emptied ? o.words.blankEmptied : o.words.blank, { text: '…' });
  return { line, hint, live };
}

export function FNum({ format, words: own, ...field }: Props) {
  const id = useId();
  // The text in the field, while it is not a number and the field has focus; and the one a field of no number was left with.
  const [typed, setTyped] = useState<string | null>(null);
  const [left, setLeft] = useState<string | null>(null);
  const [point, setPoint] = useState<ReturnType<typeof pointThousands>>(null);
  const group = field.numbers?.group ?? ',';
  const canBeEmpty = field.emptyIs !== undefined;
  const standing = Number.isFinite(field.value);

  const look = (text: string) => {
    setTyped(refusedText(text, group, canBeEmpty));
    setPoint(pointThousands(text, group));
    setLeft(null);
  };

  const { line, hint, live } = fieldSentences({ typed, left, point, standing, value: field.value, format, numbers: field.numbers, words: own });
  const shown = line || hint;
  const tied = [field.describedBy ?? '', shown ? id : ''].filter(Boolean).join(' ');

  return (
    <span
      className="mp-st__f"
      onInput={(e) => (e.target instanceof HTMLInputElement ? look(e.target.value) : undefined)}
      onFocus={() => setLeft(null)}
      onBlur={() => {
        // A field of no number keeps what it was left with in the line; the others are told by the shared field.
        setLeft(typed !== null && !standing ? typed : null);
        setTyped(null);
        setPoint(null);
      }}
    >
      <NumField {...field} describedBy={tied || undefined} />
      {shown ? (
        <p className="mp-num__hint" id={id}>
          {shown}
        </p>
      ) : null}
      <span className="mp-st__sr" role="status">
        {live}
      </span>
    </span>
  );
}
