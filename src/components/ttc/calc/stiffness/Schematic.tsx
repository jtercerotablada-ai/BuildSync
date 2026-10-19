'use client';

import React, { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { StiffnessDrawing } from '@/lib/calc/stiffness/analysis';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import { BADGE_R, drawnOf, figureOf, type ArcShape, type ArrowShape, type DrawnFacts, type LabelBox, type Layout, type LegendKey, type Looks, type SupportShape } from './layout';
import { cautionLine, fill, listOf, PRINT_FLOOR, FACTOR_CAP, raised, scalePhrase } from './text';

/**
 * The structure as entered and - once solved - as it carries its load: members and nodes with their numbers, the supports by the movements
 * they hold, the loads and the reactions with their sizes, the DOF numbers of each node on request, and the deformed shape with its
 * exaggeration stated.
 *
 * It is given a `StiffnessDrawing` (lib/calc/stiffness/analysis.ts) and knows nothing of the form or of the engine. WHAT IS RECKONED AND
 * WHAT IS DRAWN are two files: `stiffnessLayout` (layout.ts) is arithmetic from end to end - where every line, symbol, arrow and word goes,
 * in pixels - and this file writes what it returns as SVG and adds nothing of its own, so the layout is held to its rules without React, and
 * it is kept from one draw to the next (`layoutFor`).
 *
 * A LOAD AND A REACTION DIFFER BY SHAPE, NOT BY COLOUR ALONE: a load is a solid arrow with a solid head, a reaction a dashed arrow with an open
 * head (the same for a ring), so that the two are told apart on a sheet printed in black and white.
 *
 * A drawing of the visitor's own data: every number on it is in the tables beside it too, so the SVG has a short name (`summary`: what it
 * holds), is described by the sentence under it (`describedBy`) and its shapes are hidden from a screen reader.
 */

export interface SchematicWords {
  legend: StiffnessUi['drawing']['legend'];
  notes: StiffnessUi['drawing']['notes'];
  /** The drawing that cannot be made to scale. */
  broken: string;
}

/**
 * THE FIGURE CANNOT TAKE THE PAGE DOWN. The drawing is built from numbers a visitor typed; whatever they are, a fault in building it is said in
 * a line and the form, the problems and the tables stay. It tries again when the drawing it is given changes.
 */
export class FigureGuard extends Component<{ children: ReactNode; message: string; reset: unknown }, { failed: boolean; at: unknown }> {
  state = { failed: false, at: this.props.reset };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  static getDerivedStateFromProps(props: { reset: unknown }, state: { failed: boolean; at: unknown }) {
    return props.reset !== state.at ? { failed: false, at: props.reset } : null;
  }
  componentDidCatch() {
    /* said in the line below; nothing else to do */
  }
  render() {
    return this.state.failed ? (
      <p className="mp-app__need" role="status">
        {this.props.message}
      </p>
    ) : (
      this.props.children
    );
  }
}

export interface SchematicProps {
  drawing: StiffnessDrawing;
  /** The width of the column that holds the drawing. */
  width: number;
  /** False on paper, which cannot scroll: the drawing is then exactly `width`. */
  widen?: boolean;
  /** On paper: the notes do not tell the reader to scroll. */
  paper?: boolean;
  /** Widen the drawing until every word is written on it. */
  every?: boolean;
  /** Whether widening the drawing would put every left-off word on it (null while that is being found out). */
  canWiden?: boolean | null;
  /**
   * How many words the drawing leaves off, told whenever the drawing that is shown changes (the page offers its switch by it), with what the
   * drawing shows that a sentence about it must follow: which nodes are dots, and what is drawn of the loads and the reactions.
   */
  onThinned?: (count: number, drawn: DrawnFacts) => void;
  looks: Looks;
  /** The tallest the drawing may be, px. */
  maxHeight?: number;
  /** The drawing's name for whoever cannot see it: short, what it holds. */
  summary: string;
  /** The id of the element that reads the drawing in a sentence (the SVG is described by it). */
  describedBy?: string;
  words: SchematicWords;
  units: { length: string; displacement: string };
  /** Where the drawing starts, for a link that jumps to it. */
  id?: string;
  /** A title for the figure. */
  caption?: string;
}

/** The note about the deformed shape's exaggeration, or the line that says nothing moves. */
export function scaleNote(layout: Layout, looks: Looks, drawing: StiffnessDrawing, words: Pick<SchematicWords, 'notes'>, units: { displacement: string }): string {
  if (!looks.deformed || !drawing.deformed) return '';
  // Nothing moves (still), or what moves is rounding, under the print floor: said as that, never as a movement of 0.
  if (layout.tiny) return fill(words.notes.tiny, { floor: raised(formatNumber(PRINT_FLOOR, 1)), unit: units.displacement });
  if (layout.factor === null) return words.notes.still;
  const num = (v: number, significant: number) => formatNumber(v, significant, looks.group);
  // The same rounding as the sentence under the drawing and the tables: one number is one number.
  return fill(words.notes.scale, { scale: scalePhrase({ factor: layout.factor, shrink: drawing.deformed.shrink }, num, words.notes), value: raised(num(drawing.deformed.maxDisplacement, 4)), unit: units.displacement });
}

/** What a drawing on screen was made of: the structure, the width and the looks. */
export interface FigureStamp {
  drawing: unknown;
  width: number;
  widen: boolean;
  every: boolean;
  looks: Looks;
  maxHeight: number | undefined;
  paper: boolean;
}
/** Whether two sets of looks are the same looks (the page makes a new object of them whenever it is drawn again). */
const sameLooks = (a: Looks, b: Looks): boolean =>
  a === b || (a.loads === b.loads && a.reactions === b.reactions && a.deformed === b.deformed && a.dofs === b.dofs && a.nodeNumbers === b.nodeNumbers && a.memberNumbers === b.memberNumbers && a.values === b.values && a.group === b.group && (a.flagged ?? []).join() === (b.flagged ?? []).join());
/** Whether the drawing on screen was made of what is asked for now. (Nothing is stale on paper: it is made at once.) */
export const sameStamp = (a: FigureStamp, b: FigureStamp): boolean => a.drawing === b.drawing && a.width === b.width && a.widen === b.widen && a.every === b.every && sameLooks(a.looks, b.looks) && a.maxHeight === b.maxHeight && a.paper === b.paper;

/** Whether what is asked for now is to widen the drawing and the one on screen was made without that (the switch was just ticked). */
export const asksToWiden = (made: FigureStamp, now: FigureStamp): boolean => !now.paper && now.every && !made.every;

/**
 * The two notes under the drawing that follow its state. While the drawing on screen is not the one asked for and what was asked for is to widen it
 * (the switch was just ticked: `widening`), it says that it is widening, and the note that tells the visitor to choose that switch is not shown (they
 * have); once the drawing is made, the note that says how many words it leaves off follows what the drawing says (the switch is named only where there
 * is one).
 */
export function figureNotes(o: { layout: Layout; widening: boolean; paper: boolean; canWiden: boolean | null; words: Pick<SchematicWords, 'notes'> }): { widening: string; thinned: string } {
  const widening = o.widening && !o.paper;
  const thinned = widening || o.layout.thinned === 0 ? '' : fill(o.paper ? o.words.notes.thinnedPaper : o.canWiden === false ? o.words.notes.thinnedRead : o.words.notes.thinned, { count: o.layout.thinned });
  return { widening: widening ? o.words.notes.widening : '', thinned };
}

/** The line that says the exaggeration stopped at the cap (only when the deformed shape is drawn at it). */
export function cappedNote(layout: Layout, looks: Looks, words: Pick<SchematicWords, 'notes'>): string {
  if (!looks.deformed || layout.factor === null || !layout.capped) return '';
  return fill(words.notes.capped, { cap: formatNumber(FACTOR_CAP, 5, looks.group) });
}

/** The line that says where the loads cancel and so nothing is drawn. */
export function cancelledNote(layout: Layout, words: Pick<SchematicWords, 'notes'>): string {
  if (layout.cancelled.length === 0) return '';
  return fill(layout.cancelled.length === 1 ? words.notes.cancelledOne : words.notes.cancelledMany, { nodes: listOf(layout.cancelled, words.notes.and) });
}

/** The caution that the largest movement is no longer small beside the structure, when it is not (and only when a deformed shape is drawn). */
export function movementNote(layout: Layout, looks: Looks, drawing: StiffnessDrawing, words: Pick<SchematicWords, 'notes'>): string {
  if (!looks.deformed || layout.factor === null) return '';
  return cautionLine(drawing, words.notes, (v, significant) => formatNumber(v, significant, looks.group));
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const HEAD_LEN = 8;
const HEAD_HALF = 3.6;
const OPEN_LEN = 9;
const OPEN_HALF = 4.4;

/** A load is a solid arrow with a solid head; a reaction (`open`) a dashed arrow with an open head. */
function ArrowMark({ a, className, open = false, mark }: { a: { tail: { x: number; y: number }; tip: { x: number; y: number } }; className: string; open?: boolean; mark?: string }) {
  const dx = a.tip.x - a.tail.x;
  const dy = a.tip.y - a.tail.y;
  const len = Math.hypot(dx, dy) || 1;
  const u = { x: dx / len, y: dy / len };
  if (open) {
    const base = { x: a.tip.x - u.x * OPEN_LEN, y: a.tip.y - u.y * OPEN_LEN };
    const head = `${base.x - u.y * OPEN_HALF},${base.y + u.x * OPEN_HALF} ${a.tip.x},${a.tip.y} ${base.x + u.y * OPEN_HALF},${base.y - u.x * OPEN_HALF}`;
    return (
      <g className={className} data-mark={mark}>
        <line className="mp-st-fig__shaft" x1={a.tail.x} y1={a.tail.y} x2={a.tip.x - u.x * 2} y2={a.tip.y - u.y * 2} />
        <polyline className="mp-st-fig__open" points={head} fill="none" />
      </g>
    );
  }
  const base = { x: a.tip.x - u.x * HEAD_LEN, y: a.tip.y - u.y * HEAD_LEN };
  const head = `${a.tip.x},${a.tip.y} ${base.x - u.y * HEAD_HALF},${base.y + u.x * HEAD_HALF} ${base.x + u.y * HEAD_HALF},${base.y - u.x * HEAD_HALF}`;
  return (
    <g className={className} data-mark={mark}>
      <line x1={a.tail.x} y1={a.tail.y} x2={base.x} y2={base.y} />
      <polygon points={head} />
    </g>
  );
}

/** The ring of a moment: solid with a solid head for a load, dashed with an open head for a reaction (`open`). */
function ArcMark({ a, className, open = false, mark }: { a: ArcShape; className: string; open?: boolean; mark?: string }) {
  if (open) {
    // The head is given as its tip and the two corners of its base; an open head is the two lines that meet at the tip.
    const [tip, left, right] = a.head.split(' ');
    return (
      <g className={className} data-mark={mark}>
        <path className="mp-st-fig__shaft" d={a.path} fill="none" />
        <polyline className="mp-st-fig__open" points={`${left} ${tip} ${right}`} fill="none" />
      </g>
    );
  }
  return (
    <g className={className} data-mark={mark}>
      <path d={a.path} fill="none" />
      <polygon points={a.head} />
    </g>
  );
}

function Hatch({ x0, x1, y, step = 6 }: { x0: number; x1: number; y: number; step?: number }) {
  const ticks: number[] = [];
  for (let x = x0 + 2; x <= x1; x += step) ticks.push(x);
  return (
    <>
      {ticks.map((x) => (
        <line key={x} className="mp-st-fig__tick" x1={x} y1={y} x2={x - 5} y2={y + 6} />
      ))}
    </>
  );
}

/** The mark of a rotation held alone: a square round the node, hatched. */
function Clamp() {
  return (
    <>
      <rect x="-12" y="-12" width="24" height="24" />
      {[
        [-12, 0, 0, -12],
        [-12, 8, 8, -12],
        [-8, 12, 12, -8],
        [0, 12, 12, 0],
      ].map(([x1, y1, x2, y2]) => (
        <line key={`${x1}${y1}`} className="mp-st-fig__tick" x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </>
  );
}

/** The shapes of a support symbol, drawn pointing down the page from the origin. */
function SymbolShapes({ s }: { s: SupportShape }) {
  return s.kind === 'rotation' ? (
    <Clamp />
  ) : (
    <g transform={`rotate(${s.rotation})`}>
      {s.kind === 'fixed' ? (
        <>
          <line className="mp-st-fig__ground" x1="-14" y1="8" x2="14" y2="8" />
          <Hatch x0={-14} x1={14} y={8} />
        </>
      ) : s.kind === 'pin' ? (
        <>
          <polygon points="0,0 -11,20 11,20" />
          <line className="mp-st-fig__ground" x1="-15" y1="20" x2="15" y2="20" />
        </>
      ) : s.kind === 'roller' ? (
        <>
          <polygon points="0,0 -9,15 9,15" />
          <circle cx="-4.5" cy="19.2" r="3.4" />
          <circle cx="4.5" cy="19.2" r="3.4" />
          <line className="mp-st-fig__ground" x1="-13" y1="23" x2="13" y2="23" />
        </>
      ) : (
        <>
          <rect x="-12" y="5" width="24" height="4" />
          <circle cx="-6" cy="12" r="3" />
          <circle cx="6" cy="12" r="3" />
          <line className="mp-st-fig__ground" x1="-14" y1="16" x2="14" y2="16" />
          <Hatch x0={-14} x1={14} y={16} />
        </>
      )}
    </g>
  );
}

/** A support symbol, drawn pointing down the page from the origin and turned to its side; a halo under it where it stands over a member. */
function SupportSymbol({ s }: { s: SupportShape }) {
  return (
    <>
      {s.blocked ? (
        <g className={`mp-st-fig__support mp-st-fig__halo mp-st-fig__support--${s.kind}`} data-halo="" transform={`translate(${s.x} ${s.y}) scale(${s.scale})`}>
          <SymbolShapes s={s} />
        </g>
      ) : null}
      <g className={`mp-st-fig__support mp-st-fig__support--${s.kind}`} data-symbol={s.symbol} transform={`translate(${s.x} ${s.y}) scale(${s.scale})`}>
        <SymbolShapes s={s} />
      </g>
    </>
  );
}

/** The settlement badge, with the line that ties it to its node when it does not stand beside it. */
function Badge({ s }: { s: SupportShape }) {
  if (!s.badge) return null;
  const b = s.badge;
  return (
    <g className="mp-st-fig__badge" data-node={s.node}>
      {b.leader ? (
        <>
          <line className="mp-st-fig__leader" x1={b.leader.x1} y1={b.leader.y1} x2={b.leader.x2} y2={b.leader.y2} />
          <circle className="mp-st-fig__leader-dot" cx={b.leader.x2} cy={b.leader.y2} r="1.5" />
        </>
      ) : null}
      <circle cx={b.x} cy={b.y} r={b.r} />
      <text x={b.x} y={b.y + 3.8} textAnchor="middle">
        δ
      </text>
    </g>
  );
}

const POWER = /^(.*) × 10\^(−?\d+)$/;
/** A number as the drawing writes it: "1.258 × 10^13" is set as 1.258 × 10 with a raised 13 (where SVG text lets it). */
function Figures({ value }: { value: string }) {
  const m = POWER.exec(value);
  if (!m) return <>{value}</>;
  return (
    <>
      {m[1]} × 10
      <tspan className="mp-st-fig__exp" dy="-0.42em" fontSize="72%">
        {m[2]}
      </tspan>
    </>
  );
}

const Word = ({ box, className }: { box: LabelBox; className: string }) => (
  <>
    {box.leader ? (
      <>
        <line className="mp-st-fig__leader" x1={box.leader.x1} y1={box.leader.y1} x2={box.leader.x2} y2={box.leader.y2} />
        <circle className="mp-st-fig__leader-dot" cx={box.leader.x1} cy={box.leader.y1} r="1.5" />
      </>
    ) : null}
    <text className={className} data-mark="value" x={box.x} y={box.y} textAnchor="middle" style={box.size !== 11 ? { fontSize: box.size } : undefined}>
      <Figures value={box.value} />
    </text>
  </>
);

export function StiffnessSchematic({ drawing, width, widen = true, paper = false, every = false, canWiden = null, onThinned, looks, maxHeight, summary, describedBy, words, units, id, caption }: SchematicProps) {
  // The bays have a width of their own below which the loads and words of neighbouring bays run into each other: a drawing in a narrow
  // column is made that wide and scrolls, and says so. Paper cannot scroll, and keeps its width.
  const make = () => figureOf(drawing, looks, { width, widen, every, maxHeight });
  // THE LAYOUT IS NOT RECKONED INSIDE THE KEYSTROKE. Finding a clear place for every word of a structure of twelve nodes is a piece of arithmetic
  // the next key should not wait for. The first drawing - the server's, and the one the page opens with - is made at once; after it, a change of
  // the structure, the width or the looks is drawn a moment later, a task of its own, and until then the drawing on screen is the one before.
  // Paper is made at once. WHAT THE VISITOR ASKED FOR SHOWS AT ONCE, though: the drawing on screen knows what it was made of (`stamp`), and while
  // that is not what it is asked for it is dimmed and, where the switch that widens it was just ticked, says that it is widening.
  const stamp = { drawing, width, widen, every, looks, maxHeight, paper };
  const [held, setHeld] = useState(() => ({ ...make(), stamp }));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (paper) return;
    const timer = setTimeout(() => setHeld({ ...make(), stamp }), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, width, widen, every, looks, maxHeight, paper]);
  const sync = useMemo(
    () => (paper ? make() : null), // eslint-disable-next-line react-hooks/exhaustive-deps
    [paper, drawing, width, widen, every, looks, maxHeight],
  );
  const { drawn, layout, widened, thinnedAtRoom } = sync ?? held;
  const stale = sync === null && !sameStamp(held.stamp, stamp);
  useEffect(() => {
    // (the page offers its switch by the words left off without it: not 0, because the switch was used)
    onThinned?.(thinnedAtRoom, drawnOf(layout));
  }, [layout, thinnedAtRoom, onThinned]);
  const wide = drawn > width;
  const noteText = scaleNote(layout, looks, drawing, words, units);
  const cappedText = cappedNote(layout, looks, words);
  const cancelledText = cancelledNote(layout, words);
  const cautionText = movementNote(layout, looks, drawing, words);
  const { widening: wideningNote, thinned: thinnedNote } = figureNotes({ layout, widening: stale && asksToWiden(held.stamp, stamp), paper, canWiden, words });
  const hasArrows = layout.loads.some((l) => l.arrows.length > 0 || l.arc) || layout.memberLoads.length > 0 || layout.reactions.some((r) => r.arrows.length > 0 || r.arc);
  return (
    <figure className={stale ? 'mp-st-fig mp-st-fig--busy mp-st__target' : 'mp-st-fig mp-st__target'} id={id} tabIndex={id ? -1 : undefined} aria-busy={stale ? true : undefined}>
      {caption ? <figcaption className="mp-st-fig__caption">{caption}</figcaption> : null}
      <div className={wide ? 'mp-st-fig__scroll mp-st-fig__scroll--wide' : 'mp-st-fig__scroll'} role={wide ? 'group' : undefined} aria-label={wide ? words.notes.region : undefined} tabIndex={wide ? 0 : undefined}>
        <svg className="mp-plot__svg mp-st-fig__svg" role="img" aria-label={summary} aria-describedby={describedBy} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
          <g aria-hidden="true">
            {layout.deformed ? layout.members.map((m) => <line key={`g${m.label}`} className="mp-st-fig__ghost" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />) : null}
            {layout.deformed ? layout.deformed.members.map((m) => <polyline key={`d${m.member}`} className="mp-st-fig__deformed" points={m.points} fill="none" />) : null}
            {layout.memberLoads.map((l) => (
              <g key={`ml${l.label}`} className="mp-st-fig__mload" data-load={l.label} data-mark={l.kind}>
                {l.line ? <polyline className="mp-st-fig__mline" points={l.line.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" /> : null}
                {l.arrows.map((a, k) => (
                  <ArrowMark key={k} a={a} className="mp-st-fig__load" />
                ))}
              </g>
            ))}
            {layout.deformed
              ? layout.members.map((m) => <line key={`m${m.label}`} className="mp-st-fig__member mp-st-fig__member--thin" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} data-member={m.label} />)
              : layout.members.map((m) => <line key={`m${m.label}`} className="mp-st-fig__member" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} data-member={m.label} />)}
            {layout.supports.map((s) => (
              <SupportSymbol key={`s${s.label}`} s={s} />
            ))}
            {layout.loads.map((l) => (
              <g key={`l${l.label}`} data-node={l.node}>
                {l.arrows.map((a: ArrowShape, k) => (
                  <ArrowMark key={k} a={a} className="mp-st-fig__load" mark="load" />
                ))}
                {l.arc ? <ArcMark a={l.arc} className="mp-st-fig__load" mark="load-moment" /> : null}
              </g>
            ))}
            {layout.reactions.map((r) => (
              <g key={`r${r.label}`} data-node={r.label}>
                {r.arrows.map((a, k) => (
                  <ArrowMark key={k} a={a} className="mp-st-fig__reaction" open mark="reaction" />
                ))}
                {r.arc ? <ArcMark a={r.arc} className="mp-st-fig__reaction" open mark="reaction-moment" /> : null}
              </g>
            ))}
            {layout.nodes.map((n) => (
              <g key={`n${n.label}`} className={`mp-st-fig__node${n.numbered ? '' : ' mp-st-fig__node--dot'}${n.flagged ? ' mp-st-fig__node--flagged' : ''}`}>
                <circle cx={n.x} cy={n.y} r={n.r} />
                {n.flagged ? <circle className="mp-st-fig__ring" cx={n.x} cy={n.y} r={n.r + 4} /> : null}
                {n.numbered ? (
                  <text x={n.x} y={n.y + 3.2} textAnchor="middle">
                    {n.label}
                  </text>
                ) : null}
              </g>
            ))}
            {layout.supports.map((s) => (s.badge ? <Badge key={`b${s.label}`} s={s} /> : null))}
            {layout.loads.map((l) => (
              <g key={`lt${l.label}`}>
                {l.arrows.map((a, k) => (a.text ? <Word key={k} box={a.text} className="mp-st-fig__word mp-st-fig__word--load" /> : null))}
                {l.arc?.text ? <Word box={l.arc.text} className="mp-st-fig__word mp-st-fig__word--load" /> : null}
              </g>
            ))}
            {layout.memberLoads.map((l) => (l.text ? <Word key={`mt${l.label}`} box={l.text} className="mp-st-fig__word mp-st-fig__word--load" /> : null))}
            {layout.reactions.map((r) => (
              <g key={`rt${r.label}`}>
                {r.arrows.map((a, k) => (a.text ? <Word key={k} box={a.text} className="mp-st-fig__word mp-st-fig__word--reaction" /> : null))}
                {r.arc?.text ? <Word box={r.arc.text} className="mp-st-fig__word mp-st-fig__word--reaction" /> : null}
              </g>
            ))}
            {layout.nodes.map((n) =>
              n.dofTag ? (
                <g key={`dt${n.label}`} className="mp-st-fig__dof">
                  <rect x={n.dofTag.box.rect.x0} y={n.dofTag.box.rect.y0} width={n.dofTag.box.rect.x1 - n.dofTag.box.rect.x0} height={n.dofTag.box.rect.y1 - n.dofTag.box.rect.y0} rx="2" />
                  <text x={n.dofTag.box.x} y={n.dofTag.box.y} textAnchor="middle" style={layout.fontSize === 11 ? undefined : { fontSize: layout.fontSize }}>
                    {n.dofTag.box.value}
                  </text>
                  {n.dofTag.underlines.map((u, k) => (
                    <line key={k} className="mp-st-fig__held" x1={u.x1} y1={u.y} x2={u.x2} y2={u.y} />
                  ))}
                </g>
              ) : null,
            )}
            {layout.members.map((m) =>
              m.tag ? (
                <g key={`tag${m.label}`} className="mp-st-fig__tag">
                  <rect x={m.tag.rect.x0} y={m.tag.rect.y0} width={m.tag.rect.x1 - m.tag.rect.x0} height={m.tag.rect.y1 - m.tag.rect.y0} rx="2" />
                  <text x={m.tag.x} y={m.tag.y} textAnchor="middle" style={layout.fontSize === 11 ? undefined : { fontSize: layout.fontSize }}>
                    {m.tag.value}
                  </text>
                </g>
              ) : null,
            )}
          </g>
        </svg>
      </div>
      {layout.broken ? <p className="mp-st-fig__note mp-st-fig__note--broken">{words.broken}</p> : null}
      {wide ? <p className="mp-st-fig__note mp-st-fig__note--scroll">{widened ? words.notes.every : words.notes.scroll}</p> : null}
      {wideningNote ? <p className="mp-st-fig__note mp-st-fig__note--widening">{wideningNote}</p> : null}
      {noteText ? <p className="mp-st-fig__note mp-st-fig__note--scale">{noteText}</p> : null}
      {cappedText ? <p className="mp-st-fig__note mp-st-fig__note--capped">{cappedText}</p> : null}
      {cancelledText ? <p className="mp-st-fig__note mp-st-fig__note--cancelled">{cancelledText}</p> : null}
      {cautionText ? <p className="mp-st-fig__note mp-st-fig__note--caution">{cautionText}</p> : null}
      {layout.summed.length > 0 ? <p className="mp-st-fig__note mp-st-fig__note--summed">{words.notes.summed}</p> : null}
      {hasArrows ? <p className="mp-st-fig__note mp-st-fig__note--arrows">{words.notes.arrows}</p> : null}
      {layout.dotted > 0 ? <p className="mp-st-fig__note mp-st-fig__note--dotted">{fill(words.notes.dotted, { count: layout.dotted })}</p> : null}
      {layout.supportsOverlap ? <p className="mp-st-fig__note mp-st-fig__note--close">{words.notes.supportsClose}</p> : null}
      {thinnedNote ? <p className="mp-st-fig__note mp-st-fig__note--thinned">{thinnedNote}</p> : null}
      {layout.legend.length > 0 ? (
        <ul className="mp-st-fig__legend">
          {layout.legend.map((key) => (
            <li key={key} className={`mp-st-fig__key mp-st-fig__key--${key}`}>
              <LegendSwatch kind={key} />
              <span>{fill(key === 'dofTag' && drawing.nodes.some((n) => n.dofs.length > 2) ? words.legend.dofTagRotation : words.legend[key], { scale: layout.factor !== null ? scalePhrase({ factor: layout.factor, shrink: drawing.deformed?.shrink }, (v, significant) => formatNumber(v, significant, looks.group), words.notes) : '' })}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}

/** The small picture of a mark, in the same classes as the drawing. */
export function LegendSwatch({ kind }: { kind: LegendKey }) {
  return (
    <svg className="mp-st-fig__swatch" width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
      {kind === 'member' ? (
        <line className="mp-st-fig__member" x1="1" y1="8" x2="29" y2="8" />
      ) : kind === 'ghost' ? (
        <line className="mp-st-fig__member mp-st-fig__member--thin" x1="1" y1="8" x2="29" y2="8" />
      ) : kind === 'node' ? (
        <g className="mp-st-fig__node">
          <circle cx="15" cy="8" r="6" />
        </g>
      ) : kind === 'nodeDot' ? (
        <g className="mp-st-fig__node mp-st-fig__node--dot">
          <circle cx="15" cy="8" r="3.2" />
        </g>
      ) : kind === 'deformed' ? (
        <line className="mp-st-fig__deformed" x1="1" y1="8" x2="29" y2="8" />
      ) : kind === 'fixed' ? (
        <g className="mp-st-fig__support">
          <line className="mp-st-fig__ground" x1="3" y1="4" x2="27" y2="4" />
          <Hatch x0={3} x1={27} y={4} step={5} />
        </g>
      ) : kind === 'pin' ? (
        <g className="mp-st-fig__support">
          <polygon points="15,1 9,12 21,12" />
          <line className="mp-st-fig__ground" x1="5" y1="12" x2="25" y2="12" />
        </g>
      ) : kind === 'roller' ? (
        <g className="mp-st-fig__support">
          <polygon points="15,0 10,8 20,8" />
          <circle cx="12" cy="10.8" r="2.2" />
          <circle cx="18" cy="10.8" r="2.2" />
          <line className="mp-st-fig__ground" x1="6" y1="13.5" x2="24" y2="13.5" />
        </g>
      ) : kind === 'guide' ? (
        <g className="mp-st-fig__support">
          <rect x="7" y="2" width="16" height="3" />
          <circle cx="11" cy="8" r="2" />
          <circle cx="19" cy="8" r="2" />
          <line className="mp-st-fig__ground" x1="5" y1="11" x2="25" y2="11" />
          <Hatch x0={5} x1={25} y={11} step={5} />
        </g>
      ) : kind === 'rotation' ? (
        <g className="mp-st-fig__support" transform="translate(15 8) scale(0.55)">
          <Clamp />
        </g>
      ) : kind === 'settle' ? (
        <g className="mp-st-fig__badge">
          <circle cx="15" cy="8" r={BADGE_R * 0.8} />
          <text x="15" y="11.4" textAnchor="middle">
            δ
          </text>
        </g>
      ) : kind === 'load' || kind === 'pointLoad' ? (
        <ArrowMark a={{ tail: { x: 1, y: 8 }, tip: { x: 29, y: 8 } }} className="mp-st-fig__load" />
      ) : kind === 'reaction' ? (
        <ArrowMark a={{ tail: { x: 1, y: 8 }, tip: { x: 29, y: 8 } }} className="mp-st-fig__reaction" open />
      ) : kind === 'loadMoment' || kind === 'reactionMoment' ? (
        <ArcMark a={{ cx: 15, cy: 8, r: 6, path: 'M 19.2 3.8 A 6 6 0 1 0 19.2 12.2', head: '19.2,12.2 15.8,14.8 22.4,15.4', pts: [], text: null }} className={kind === 'loadMoment' ? 'mp-st-fig__load' : 'mp-st-fig__reaction'} open={kind === 'reactionMoment'} />
      ) : kind === 'distributed' ? (
        <g className="mp-st-fig__load">
          <line x1="3" y1="1.5" x2="27" y2="1.5" />
          <ArrowMark a={{ tail: { x: 5, y: 1.5 }, tip: { x: 5, y: 12 } }} className="mp-st-fig__load" />
          <ArrowMark a={{ tail: { x: 15, y: 1.5 }, tip: { x: 15, y: 12 } }} className="mp-st-fig__load" />
          <ArrowMark a={{ tail: { x: 25, y: 1.5 }, tip: { x: 25, y: 12 } }} className="mp-st-fig__load" />
        </g>
      ) : kind === 'axialLoad' ? (
        <g>
          <line className="mp-st-fig__member" x1="1" y1="12" x2="29" y2="12" />
          <ArrowMark a={{ tail: { x: 2, y: 5 }, tip: { x: 13, y: 5 } }} className="mp-st-fig__load" />
          <ArrowMark a={{ tail: { x: 16, y: 5 }, tip: { x: 27, y: 5 } }} className="mp-st-fig__load" />
        </g>
      ) : kind === 'values' ? (
        <text className="mp-st-fig__word mp-st-fig__word--swatch" x="15" y="11.4" textAnchor="middle">
          12.5
        </text>
      ) : kind === 'leader' ? (
        <g>
          <circle className="mp-st-fig__leader-dot" cx="4" cy="8" r="1.6" />
          <line className="mp-st-fig__leader" x1="4" y1="8" x2="15" y2="8" />
          <text className="mp-st-fig__word mp-st-fig__word--swatch" x="22" y="11.4" textAnchor="middle">
            7
          </text>
        </g>
      ) : kind === 'dofTag' ? (
        <g className="mp-st-fig__dof">
          <rect x="3" y="1.5" width="24" height="13" rx="2" />
          <text x="15" y="11.4" textAnchor="middle">
            1 2
          </text>
          <line className="mp-st-fig__held" x1="8.5" y1="13" x2="14" y2="13" />
        </g>
      ) : kind === 'tag' ? (
        <g className="mp-st-fig__tag">
          <rect x="8" y="1.5" width="14" height="13" rx="2" />
          <text x="15" y="11.4" textAnchor="middle">
            1
          </text>
        </g>
      ) : (
        <g className="mp-st-fig__node mp-st-fig__node--flagged">
          <circle cx="15" cy="8" r="5" />
          <circle className="mp-st-fig__ring" cx="15" cy="8" r="7" />
        </g>
      )}
    </svg>
  );
}
