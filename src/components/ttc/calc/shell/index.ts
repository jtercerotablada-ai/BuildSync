/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CALCULATORS' SHELL — what every calculator does around its own form
 * ─────────────────────────────────────────────────────────────────────────────
 * A calculator of the catalogue (/resources) is a form on the left, its
 * answer on the right, tables of numbers under both, and a printed sheet.
 * What is the calculator's own is its form, its engine (lib/calc/…) and its
 * tables. Everything else is the same machinery from one to the next, and it
 * is here, once. It came out of the first calculator's component
 * (beam/BeamCalculator.tsx) when the third one needed a different form: a
 * second copy would have drifted from the first within a month.
 *
 *   layout.ts        the column of drawings: its width, a diagram's height,
 *                    whether it is too tall to pin; what both are on paper.
 *   address.ts       THE ADDRESS FOLLOWS THE CASE: `#<key>=…` read on load
 *                    and on hashchange, written 300 ms after the last change
 *                    and at once when the visitor reaches for something
 *                    else; the example leaves it bare.
 *   sheet.tsx        the printed sheet's moment: the stamp (when, and the
 *                    address that opens this case), "on paper" set before
 *                    the browser lays the page out.
 *   steel.ts         the table of steel shapes: fetched the first time it is
 *                    wanted, the failure that must be said, a name read in
 *                    any case of letters.
 *   SectionGroup.tsx the "Section and material" group of the form.
 *   Actions.tsx      Copy link, Print, Start over.
 *   fields.tsx       a field that is a list; a value that cannot be one.
 *   results.ts       what a results table asks of a value before it prints
 *                    it: rounding is zero, a peak and where it is, the
 *                    up/down word, a jump.
 *
 * None of it knows what a beam is, none of it has words of its own (a
 * calculator's words are a prop from its server view: imported here, both
 * languages would travel with the script), and none of it can send anything
 * anywhere. Its classes are calc.css's.
 *
 * A CALCULATOR BUILT ON IT — the order matters where one piece is given
 * another's result:
 *
 *   'use client';
 *   const EXAMPLE = encode(defaultCase());                    // module level: the example as its address writes it
 *   function caseIn(hash: string): Case | null | undefined {  // undefined: not ours; null: ours, and cannot be read
 *     const m = hash.match(/^#c=(.*)$/);
 *     if (!m) return undefined;
 *     …decodeURIComponent, then the model's own decode…
 *   }
 *
 *   export function Calculator({ t }: { t: Ui }) {
 *     const [form, dispatch] = useReducer(reduce, undefined, defaultCase);
 *     const [probeX, setProbeX] = useState<number | null>(null);
 *     const uid = useId();
 *
 *     // The column of drawings.
 *     const [plotRef, windowWidth] = useWidth<HTMLDivElement>();
 *     const [outRef, tooTall] = useTooTall<HTMLElement>();
 *     const windowPlotHeight = usePlotHeight();
 *
 *     // The address. `code` keeps its identity while the case does.
 *     const code = useCallback(() => encode(form), [form]);
 *     const address = useAddress<Case>({
 *       key: 'c',
 *       example: EXAMPLE,
 *       code,
 *       read: caseIn,
 *       blank: defaultCase,
 *       open: (found) => {
 *         dispatch({ type: 'load', form: found });
 *         setProbeX(null);
 *       },
 *     });
 *
 *     // The printed sheet.
 *     const { stamp, onPaper } = useSheet({ locale: t.sheet.locale, url: () => address.link(encode(form)) });
 *     const plotHeight = onPaper ? PAPER_PLOT : windowPlotHeight;
 *     const width = onPaper ? PAPER_WIDTH : windowWidth;
 *
 *     // The section, and the shape table when it is a steel shape.
 *     const respell = useCallback((shape: string) => dispatch({ type: 'section', patch: { shape } }), []);
 *     const steel = useSteelShapes({ wanted: form.section.mode === 'shape', name: form.section.shape, onName: respell });
 *     const worked = sectionProps(form, steel.shape);
 *     const sectionFault = …the model's issues have one about the section…;
 *     const unknownText = steel.unknown ? t.section.unknownShape.replace('{shape}', form.section.shape) : '';
 *
 *     …solve; settle every value ONCE (results.ts: settle, peak, larger); then every table reads the settled ones…
 *
 *     return (
 *       <div className="mp-app">
 *         <div className="mp-app__top">
 *           <form className="mp-app__form" onSubmit={(e) => e.preventDefault()} noValidate>
 *             …the calculator's own groups: NumField, select(…)…
 *             <SectionGroup
 *               t={t.section} numbers={t.numbers} units={form.units} section={form.section} worked={worked} steel={steel}
 *               uid={uid} describedBy={sectionFault ? `${uid}section` : undefined} unknownText={unknownText}
 *               onSection={(patch) => dispatch({ type: 'section', patch })}
 *               onMaterial={(material) => dispatch({ type: 'material', material })}
 *               flush={address.flush}
 *             />
 *             <Actions
 *               t={t.toolbar}
 *               copy={() => {
 *                 address.take(encode(form));
 *                 return address.link(encode(form));
 *               }}
 *               reset={() => {
 *                 dispatch({ type: 'load', form: defaultCase() });
 *                 steel.setFilter('');
 *                 setProbeX(null);
 *                 address.take(EXAMPLE);
 *               }}
 *             />
 *           </form>
 *           <section className={tooTall ? 'mp-app__out mp-app__out--tall' : 'mp-app__out'} aria-label={t.results.title} ref={outRef}>
 *             <div className="mp-app__issues" role="alert" aria-live="assertive">
 *               …the problems, each once — the section's at the id `${uid}section`, a shape the table has not (unknownText);
 *                 or, with none, `address.linkError ? t.linkError : null`…
 *             </div>
 *             <div className="mp-app__plots" ref={plotRef}>…the drawings, at `width` and `plotHeight`…</div>
 *           </section>
 *         </div>
 *         <div className="mp-app__tables">…the cards…</div>
 *         <p className="mp-app__privacy">{t.results.privacy}</p>
 *         <SheetStamp stamp={stamp} t={t.sheet} />
 *       </div>
 *     );
 *   }
 *
 * What a calculator must still do itself, because it is about its own case:
 * render with its example on the server (the page is not an empty box before
 * the script arrives); say `linkError` in its results box; drop a place
 * pointed at when another case opens (`open`) or the units change.
 *
 * ONE THING THE LINT ASKS of a component built this way. With the shape
 * table's `import()` in steel.ts and no longer in the component, the lint's
 * rules for memos read the whole component (they give up, in silence, on one
 * that holds an `import()`). They hold every dependency of a `useMemo` to
 * being a value nothing touches again: a state, a prop, what a hook or
 * another memo returned, a plain number or string made of those. What a
 * helper returned at this draw (`larger(…)`) is not one until it is held in
 * a memo of its own — beam/BeamCalculator.tsx, `mAbs`.
 */

export { Actions } from './Actions';
export { useAddress, type Address, type AddressOptions } from './address';
export { off, select } from './fields';
export { PAPER_PLOT, PAPER_WIDTH, useIsoLayoutEffect, usePlotHeight, useTooTall, useWidth } from './layout';
export { arrow, larger, peak, settle, two, type Peak } from './results';
export { SectionGroup } from './SectionGroup';
export { SheetStamp, useSheet, type Stamp } from './sheet';
export { useSteelShapes, type SteelShapes } from './steel';
