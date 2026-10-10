'use client';

import React, { useState } from 'react';
import { fieldNumber, parseNumber } from '@/lib/calc/format';

/**
 * A number, with its label and its unit — the field every calculator is
 * made of.
 *
 * A TEXT input, not `type="number"`: a number input drops what it cannot
 * parse ("1." on the way to "1.5", a lone "-"), steps on the scroll wheel,
 * and in a Spanish browser shows 1,5 for a value the page prints as 1.5.
 * `inputMode="decimal"` still brings up the numeric keyboard on a phone, and
 * a comma typed there is read as the decimal point.
 *
 * While the field has focus it shows exactly what was typed and reports
 * every state that IS a number; anything else leaves the last good value in
 * place, and leaving the field puts that value back on screen.
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
  optional,
  onEdit,
  onCommit,
  className = '',
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (value: number) => void;
  invalid?: boolean;
  /** The word for "optional", shown after the label when the field may be left at zero. */
  optional?: string;
  /** The field took focus: an edit begins. */
  onEdit?: () => void;
  /** The field was left: whatever was typed is final. */
  onCommit?: () => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className={`mp-num ${className}`.trim()} data-invalid={invalid ? 'true' : undefined}>
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
          value={draft ?? fieldNumber(value)}
          aria-invalid={invalid ? true : undefined}
          onFocus={(e) => {
            setDraft(fieldNumber(value));
            e.currentTarget.select();
            onEdit?.();
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = parseNumber(e.target.value);
            if (parsed !== null) onChange(parsed);
          }}
          onBlur={() => {
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
  );
}
