'use client';

import React, { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { StiffnessDrawing } from '@/lib/calc/stiffness/analysis';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import { figureWidth, layoutFor, type ArcShape, type ArrowShape, type LabelBox, type Layout, type LegendKey, type Looks, type SupportShape } from './layout';
import { fill } from './text';

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
 * A drawing of the visitor's own data: every number on it is in the tables beside it too, so the SVG is described in one sentence (`summary`)
 * and its shapes are hidden from a screen reader.
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
  /** How many words the drawing leaves off, told whenever the drawing that is shown changes (the page offers its switch by it). */
  onThinned?: (count: number) => void;
  looks: Looks;
  /** The tallest the drawing may be, px. */
  maxHeight?: number;
  /** The drawing in one sentence, for whoever cannot see it. */
  summary: string;
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
  if (layout.factor === null) return words.notes.still;
  return fill(words.notes.scale, { factor: formatNumber(layout.factor, 3, looks.group), value: formatNumber(drawing.deformed.maxDisplacement, 3, looks.group), unit: units.displacement });
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const HEAD_LEN = 8;
const HEAD_HALF = 3.6;

function ArrowMark({ a, className }: { a: { tail: { x: number; y: number }; tip: { x: number; y: number } }; className: string }) {
  const dx = a.tip.x - a.tail.x;
  const dy = a.tip.y - a.tail.y;
  const len = Math.hypot(dx, dy) || 1;
  const u = { x: dx / len, y: dy / len };
  const base = { x: a.tip.x - u.x * HEAD_LEN, y: a.tip.y - u.y * HEAD_LEN };
  const head = `${a.tip.x},${a.tip.y} ${base.x - u.y * HEAD_HALF},${base.y + u.x * HEAD_HALF} ${base.x + u.y * HEAD_HALF},${base.y - u.x * HEAD_HALF}`;
  return (
    <g className={className}>
      <line x1={a.tail.x} y1={a.tail.y} x2={base.x} y2={base.y} />
      <polygon points={head} />
    </g>
  );
}

function ArcMark({ a, className }: { a: ArcShape; className: string }) {
  return (
    <g className={className}>
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

/** A support symbol, drawn pointing down the page from the origin and turned to its side. */
function SupportSymbol({ s }: { s: SupportShape }) {
  return (
    <>
      <g className={`mp-st-fig__support mp-st-fig__support--${s.kind}`} transform={`translate(${s.x} ${s.y})`}>
        {s.kind === 'rotation' ? (
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
        )}
      </g>
      {s.badge ? (
        <g className="mp-st-fig__badge">
          <circle cx={s.badge.x} cy={s.badge.y} r="6.5" />
          <text x={s.badge.x} y={s.badge.y + 3.4} textAnchor="middle">
            δ
          </text>
        </g>
      ) : null}
    </>
  );
}

const Word = ({ box, className, size }: { box: LabelBox; className: string; size?: number }) => (
  <text className={className} x={box.x} y={box.y} textAnchor="middle" style={size && size !== 11 ? { fontSize: size } : undefined}>
    {box.value}
  </text>
);

export function StiffnessSchematic({ drawing, width, widen = true, paper = false, every = false, canWiden = null, onThinned, looks, maxHeight, summary, words, units, id, caption }: SchematicProps) {
  // The bays have a width of their own below which the loads and words of neighbouring bays run into each other: a drawing in a narrow
  // column is made that wide and scrolls, and says so. Paper cannot scroll, and keeps its width.
  const make = () => {
    const f = widen ? figureWidth(drawing, looks, width, every) : { drawn: width, room: width, widened: false };
    return { drawn: f.drawn, widened: f.widened, layout: layoutFor(drawing, { ...looks, width: f.drawn, maxHeight }) };
  };
  // THE LAYOUT IS NOT RECKONED INSIDE THE KEYSTROKE. Finding a clear place for every word of a structure of twelve nodes is a piece of arithmetic
  // the next key should not wait for. The first drawing - the server's, and the one the page opens with - is made at once; after it, a change of
  // the structure, the width or the looks is drawn a moment later, a task of its own, and until then the drawing on screen is the one before.
  // Paper is made at once.
  const [held, setHeld] = useState(make);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (paper) return;
    const timer = setTimeout(() => setHeld(make()), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, width, widen, every, looks, maxHeight, paper]);
  const sync = useMemo(
    () => (paper ? make() : null), // eslint-disable-next-line react-hooks/exhaustive-deps
    [paper, drawing, width, widen, every, looks, maxHeight],
  );
  const { drawn, layout, widened } = sync ?? held;
  useEffect(() => {
    onThinned?.(layout.thinned);
  }, [layout, onThinned]);
  const wide = drawn > width;
  const noteText = scaleNote(layout, looks, drawing, words, units);
  // What the note about the words left off tells the reader to do must be possible: the switch is named only where there is one.
  const thinnedNote = layout.thinned > 0 ? fill(paper ? words.notes.thinnedPaper : canWiden === false ? words.notes.thinnedRead : words.notes.thinned, { count: layout.thinned }) : '';
  return (
    <figure className="mp-st-fig mp-st__target" id={id} tabIndex={id ? -1 : undefined}>
      {caption ? <figcaption className="mp-st-fig__caption">{caption}</figcaption> : null}
      <div className={wide ? 'mp-st-fig__scroll mp-st-fig__scroll--wide' : 'mp-st-fig__scroll'} role={wide ? 'group' : undefined} aria-label={wide ? words.notes.region : undefined} tabIndex={wide ? 0 : undefined}>
        <svg className="mp-plot__svg mp-st-fig__svg" role="img" aria-label={summary} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
          <g aria-hidden="true">
            {layout.deformed ? layout.members.map((m) => <line key={`g${m.label}`} className="mp-st-fig__ghost" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />) : null}
            {layout.deformed ? layout.deformed.members.map((m) => <polyline key={`d${m.member}`} className="mp-st-fig__deformed" points={m.points} fill="none" />) : null}
            {layout.memberLoads.map((l) => (
              <g key={`ml${l.label}`} className="mp-st-fig__mload" data-load={l.label}>
                {l.line ? <polyline className="mp-st-fig__mline" points={l.line.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" /> : null}
                {l.arrows.map((a, k) => (
                  <ArrowMark key={k} a={a} className="mp-st-fig__load" />
                ))}
              </g>
            ))}
            {layout.supports.map((s) => (
              <SupportSymbol key={`s${s.label}`} s={s} />
            ))}
            {layout.deformed
              ? layout.members.map((m) => <line key={`m${m.label}`} className="mp-st-fig__member mp-st-fig__member--thin" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} data-member={m.label} />)
              : layout.members.map((m) => <line key={`m${m.label}`} className="mp-st-fig__member" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} data-member={m.label} />)}
            {layout.loads.map((l) => (
              <g key={`l${l.label}`}>
                {l.arrows.map((a: ArrowShape, k) => (
                  <ArrowMark key={k} a={a} className="mp-st-fig__load" />
                ))}
                {l.arc ? <ArcMark a={l.arc} className="mp-st-fig__load" /> : null}
              </g>
            ))}
            {layout.reactions.map((r) => (
              <g key={`r${r.label}`}>
                {r.arrows.map((a, k) => (
                  <ArrowMark key={k} a={a} className="mp-st-fig__reaction" />
                ))}
                {r.arc ? <ArcMark a={r.arc} className="mp-st-fig__reaction" /> : null}
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
      {noteText ? <p className="mp-st-fig__note mp-st-fig__note--scale">{noteText}</p> : null}
      {thinnedNote ? <p className="mp-st-fig__note mp-st-fig__note--thinned">{thinnedNote}</p> : null}
      {layout.legend.length > 0 ? (
        <ul className="mp-st-fig__legend">
          {layout.legend.map((key) => (
            <li key={key} className={`mp-st-fig__key mp-st-fig__key--${key}`}>
              <LegendSwatch kind={key} />
              <span>{fill(key === 'dofTag' && drawing.nodes.some((n) => n.dofs.length > 2) ? words.legend.dofTagRotation : words.legend[key], { factor: layout.factor !== null ? formatNumber(layout.factor, 3, looks.group) : '' })}</span>
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
          <circle cx="15" cy="8" r="6.5" />
          <text x="15" y="11.4" textAnchor="middle">
            δ
          </text>
        </g>
      ) : kind === 'load' || kind === 'pointLoad' || kind === 'reaction' ? (
        <ArrowMark a={{ tail: { x: 1, y: 8 }, tip: { x: 29, y: 8 } }} className={kind === 'reaction' ? 'mp-st-fig__reaction' : 'mp-st-fig__load'} />
      ) : kind === 'loadMoment' || kind === 'reactionMoment' ? (
        <ArcMark a={{ cx: 15, cy: 8, r: 6, path: 'M 19.2 3.8 A 6 6 0 1 0 19.2 12.2', head: '19.2,12.2 15.8,14.8 22.4,15.4', text: null }} className={kind === 'loadMoment' ? 'mp-st-fig__load' : 'mp-st-fig__reaction'} />
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
