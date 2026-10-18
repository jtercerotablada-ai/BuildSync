import React from 'react';
import { notation } from './math';

/**
 * A formula, a symbol or a sentence that holds them, set as a textbook sets it: `K_FF` with a subscript, `T^T` with a superscript
 * (math.ts says what is and is not one). Text with neither is written as it is, with no element round it.
 */
export function Notation({ text }: { text: string }) {
  const parts = notation(text);
  if (parts.every((p) => p.kind === 'text')) return <>{text}</>;
  return (
    <>
      {parts.map((p, k) =>
        p.kind === 'sub' ? (
          <sub key={k} className="mp-st__sub">
            {p.text}
          </sub>
        ) : p.kind === 'sup' ? (
          <sup key={k} className="mp-st__sup">
            {p.text}
          </sup>
        ) : (
          <React.Fragment key={k}>{p.text}</React.Fragment>
        ),
      )}
    </>
  );
}
