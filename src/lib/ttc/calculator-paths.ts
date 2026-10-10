/**
 * The calculators that are OPEN: the address of each, and nothing else.
 *
 * Its own small file because the proxy needs the list (a calculator's page
 * must be a known public page, or it is answered with the 404 every other
 * /resources/<x> gets) and the proxy's bundle must not carry the catalogue's
 * text — the same arrangement as city-slugs.ts.
 *
 * TO OPEN A CALCULATOR: add its path here, give its entry in calculators.ts
 * the same `href`, and add its two route files (English and /es).
 * calculators.test.ts and proxy.test.ts fail until the three agree.
 */
export const openCalculatorPaths = ['/resources/beam'] as const;
