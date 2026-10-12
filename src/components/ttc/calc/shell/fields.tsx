import React from 'react';

/**
 * THE CALCULATORS' SHELL — what a form is made of beside the number field
 * (../NumField.tsx). (What the shell is, and a calculator built on it:
 * index.ts.)
 *
 * No hook here, and so no 'use client' of its own: these are used by a
 * calculator's component, which is one.
 */

/** A value that cannot be one where a size is asked for: not a number, or below zero. (Zero is "not given", for a value that is optional.) */
export const off = (v: number) => !Number.isFinite(v) || v < 0;

/**
 * A field that is a list: laid out as a number field is, with its label
 * over it. `options`: each value with the words for it. `kind`: a class of
 * its own beside the field's (`mp-num--dir` for a direction, which is short).
 *
 * A function and not a component: it is called where the field goes,
 * `{select(label, value, options, onChange)}`.
 */
export const select = <T extends string>(label: string, value: T, options: [T, string][], onChange: (v: T) => void, kind = '') => (
  <label className={`mp-num mp-num--select ${kind}`.trim()}>
    <span className="mp-num__label">{label}</span>
    <span className="mp-num__box">
      <select className="mp-num__input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </span>
  </label>
);
