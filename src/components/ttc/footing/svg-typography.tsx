import React from 'react';

/**
 * SVG subscript helper — replaces the underscore-style labels (q_max, V_u…)
 * with proper typographic subscripts inside <text> elements:
 *
 *   <text>q<Sub>max</Sub> = {qmax} kPa</text>
 *
 * Uses baselineShift="sub" + 72% font-size, supported in all modern browsers
 * for SVG rendering.
 */
export function Sub({ children }: { children: React.ReactNode }) {
  return <tspan baselineShift="sub" fontSize="0.72em">{children}</tspan>;
}

/**
 * SVG prime symbol — replaces the apostrophe in f'c with a typographic prime.
 *   <text>f<Prime />c = 25 MPa</text>
 */
export function Prime() {
  return <tspan>′</tspan>;
}
