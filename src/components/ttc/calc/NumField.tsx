'use client';

import React, { useId, useRef, useState } from 'react';
import { ambiguousNumber, fieldNumber, parseNumber, sayNumber } from '@/lib/calc/format';

/**
 * A number, with its label and its unit — the field every calculator is
 * made of.
 *
 * A TEXT input, not `type="number"`: a number input drops what it cannot
 * parse ("1." on the way to "1.5", a lone "-"), steps on the scroll wheel,
 * and in a Spanish browser shows 1,5 for a value the page prints as 1.5.
 * `inputMode="decimal"` still brings up the numeric keyboard on a phone,
 * whose decimal key is a comma where the phone's region writes one: a comma
 * is read as the decimal point, except where the page prints commas between
 * thousands and the text is a number written that way (see `parseNumber`).
 *
 * While the field has focus it shows exactly what was typed. A text that is
 * a number, as a whole, is reported at once. A text that is not — "12 ft",
 * "1.250,5", nothing at all — marks the field, and the value is the one the
 * edit began with: never the last few characters that happened to be a
 * number on the way. Leaving the field puts the value in use back on screen.
 *
 * One text is neither: "1,250" on a page that prints no grouping comma
 * (`numbers.group`), which is 1250 to one reader and 1.25 to another. The
 * field is marked and a line under it says what to write for each.
 *
 * A text that was not a number when the field was left is not dropped in
 * silence: a line under the row says it was not taken and which value
 * stands, until the field is taken again or its value changes. (Someone
 * entering a column of values with Tab saw the mark for one keypress, and
 * then the old value with nothing to say it was the old one.) The field
 * itself carries no mark then: what it shows is the value in use. A field
 * emptied and left is the same case with no text to name, and has a line of
 * its own (`numbers.emptied`): emptying a load to take it off put the old
 * load back without a word, in a form whose settlements read an empty
 * field as none.
 *
 * A field the PAGE leaves says none of this. A case arriving in the address
 * (Back, a link pasted over the page) ends the edit in progress: the
 * calculator leaves the field that has the focus, and the shell marks that
 * field `data-ended` for that moment (shell/address.ts). What it held was
 * typed into the case before: a Length emptied there said "the field was
 * left empty: the value is still 20" under the beam Back had brought, which
 * had 20 ft of its own and a field nobody had emptied.
 *
 * A field that may be left EMPTY says which value stands for "nothing
 * here" (`emptyIs`): that value is shown as an empty field, not as its
 * digits, and an emptied field reports it and is not marked. Without it an
 * optional limit opened on a 0 that read as a limit of zero. A text that
 * was not a number, left in such a field while it was empty, is dropped
 * without the line that names the value standing: none is on screen.
 *
 * The unit sits inside the `<label>`, so it is part of the field's name
 * ("Length ft") for a screen reader as it is for the eye.
 */
export function NumField({
  label,
  unit,
  value,
  onChange,
  invalid,
  describedBy,
  optional,
  emptyIs,
  placeholder,
  numbers,
  onEdit,
  onCommit,
  className = '',
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (value: number) => void;
  invalid?: boolean;
  /** The id of the message that says what is wrong with the value, when one is on screen. */
  describedBy?: string;
  /** The word for "optional", shown after the label when the field may be left at zero. */
  optional?: string;
  /** The value an empty field stands for, where the field may be left empty. */
  emptyIs?: number;
  /** What an empty field says it stands for, in grey inside the box (for a field whose empty is a choice, e.g. "same as state 1"). */
  placeholder?: string;
  /**
   * How the page writes numbers: what it sets thousands apart with; the
   * line for a text that reads two ways, with {grouped}, {decimal} and
   * {padded} where the three ways to write it go; the line for any other
   * text that was not a number when the field was left, with {text} and the
   * {value} that stands; and the line for a field left with no text at all,
   * with that {value}.
   */
  numbers?: { group: string; ambiguous: string; refused: string; emptied?: string };
  /** The field took focus: an edit begins. */
  onEdit?: () => void;
  /** The field was left: whatever was typed is final. */
  onCommit?: () => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // The text the field was left with, when it was not a number, and the
  // value that was put back in its place.
  const [dropped, setDropped] = useState<{ text: string; value: number } | null>(null);
  // The value the edit began with: what stands while the text is not a number.
  const before = useRef(value);
  const id = useId();
  const group = numbers?.group ?? ',';
  const canBeEmpty = emptyIs !== undefined;
  // What the field shows of its value when nobody is typing in it.
  const shown = canBeEmpty && Object.is(value, emptyIs) ? '' : fieldNumber(value);
  /** The number a text is, the empty field's value included; null when it is neither. */
  const read = (text: string) => (canBeEmpty && text.trim() === '' ? emptyIs : parseNumber(text, group));
  // What is said of a dropped text is said of one value. Once the value
  // changes under it (other units, an example, a link opened) the line is
  // withdrawn, and does not come back if the value does.
  if (dropped && !Object.is(dropped.value, value)) setDropped(null);
  const left = draft === null && dropped && Object.is(dropped.value, value) ? dropped.text : null;
  const unsure = ambiguousNumber(draft ?? left ?? '', group);
  const refused = draft !== null && read(draft) === null;
  const marked = Boolean(invalid) || refused;
  // One pass over the line, so that nothing typed is taken for a place in it.
  const fill = (line: string, parts: Record<string, string>) => line.replace(/\{(\w+)\}/g, (all, key: string) => parts[key] ?? all);
  const hint = unsure && numbers ? fill(numbers.ambiguous, unsure) : '';
  // A paragraph pasted by mistake is named by its beginning. Under a field
  // that is empty again nothing is said: the line would name the value an
  // empty field stands for ("the value is still 0"), which it does not show.
  const lost = left !== null && !hint && numbers && !(canBeEmpty && Object.is(value, emptyIs)) ? fill(left === '' ? (numbers.emptied ?? '') : numbers.refused, { text: left.length > 24 ? `${left.slice(0, 24)}…` : left, value: sayNumber(value) }) : '';
  // While the field has focus the line is about the text in it, and is read with it.
  const tied = hint !== '' && draft !== null;
  const described = [tied ? id : '', describedBy ?? ''].filter(Boolean).join(' ');
  return (
    <>
      <label className={`mp-num ${className}`.trim()} data-invalid={marked ? 'true' : undefined}>
        <span className="mp-num__label">
          {label}
          {optional ? <span className="mp-num__opt"> ({optional})</span> : null}
        </span>
        <span className="mp-num__box">
          <input
            className="mp-num__input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder}
            value={draft ?? shown}
            aria-invalid={marked ? true : undefined}
            aria-describedby={described || undefined}
            onFocus={(e) => {
              before.current = value;
              setDraft(shown);
              setDropped(null);
              e.currentTarget.select();
              onEdit?.();
            }}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(read(e.target.value) ?? before.current);
            }}
            onBlur={(e) => {
              // A text that is not a number is not taken, and no text at all is
              // one — unless the field may be empty, where it is its empty value.
              // A field whose own value is not a number (a link can bring one)
              // says nothing here: its row already does. Nor does a field the
              // page itself has left because a case arrived in the address
              // (`data-ended`, the shell's mark): that text was typed into the
              // case before, and this one has not been touched.
              const text = (draft ?? '').trim();
              const untaken = text === '' ? draft !== null && !canBeEmpty : parseNumber(text, group) === null;
              setDropped(untaken && Number.isFinite(value) && e.currentTarget.dataset.ended === undefined ? { text, value } : null);
              setDraft(null);
              onCommit?.();
            }}
            onKeyDown={(e) => {
              // Enter ends the edit, as leaving the field does.
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          {unit ? <span className="mp-num__unit">{unit}</span> : null}
        </span>
      </label>
      {/* Outside the label, or it would be read as part of the field's name.
          An alert while the field has focus; a status once it is left: the
          focus has moved on, and a second alert would talk over the next field. */}
      {hint || lost ? (
        <p className="mp-num__hint" id={tied ? id : undefined} role={draft !== null ? 'alert' : 'status'}>
          {hint || lost}
        </p>
      ) : null}
    </>
  );
}
