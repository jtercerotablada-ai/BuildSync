'use client';

import React, { useId, useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { FrameDrawing } from '@/lib/calc/frame/analysis';
import type { FrameUi } from '@/lib/calc/frame/strings';
import { everyWidth, layoutFor, type ArcShape, type ArrowShape, type Layout, type LegendKey, type Looks, type MemberLoadShape, type SupportShape } from './layout';
import { fill } from './text';

/**
 * The frame as entered and - once solved - as it carries its load: members and nodes with their numbers, the hinges, the supports by
 * kind, the loads and the reactions with their sizes, and on request one DIAGRAM over the frame: the bending moment M (on the tension
 * side), the shear V, the axial force N or the deformed shape.
 *
 * It is given a `FrameDrawing` (lib/calc/frame/analysis.ts) and knows nothing of the form or of the engine. WHAT IS RECKONED AND
 * WHAT IS DRAWN are two files: `frameLayout` (layout.ts) is arithmetic from end to end - where every line, symbol, arrow and word
 * goes, in pixels - and this file writes what it returns as SVG and adds nothing of its own, so the layout is held to its rules
 * without React, and it is kept from one draw to the next (`layoutFor`).
 *
 * A drawing of the visitor's own data: every number on it is in the tables beside it too, so the SVG is described in one sentence
 * (`summary`) and its shapes are hidden from a screen reader. The pointer, though, can pick a member out of it (hover, press), which
 * marks the same member in the tables and reads N, V and M at the place pointed at; the page carries the way for a keyboard (a list
 * of members and a slider along the member picked).
 */

export interface FrameSchematicWords {
  legend: FrameUi['results']['legend'];
  notes: FrameUi['results']['drawingNotes'];
  scaleLine: FrameUi['results']['scaleLine'];
  zeroDiagram: FrameUi['results']['zeroDiagram'];
}

export interface FrameSchematicProps {
  drawing: FrameDrawing;
  /** The width of the column that holds the drawing. */
  width: number;
  /** False on paper, which cannot scroll: the drawing is then exactly `width`. */
  widen?: boolean;
  /** On paper: the notes do not tell the reader to pick a member, and nothing answers a pointer. */
  paper?: boolean;
  /** Widen the drawing until every word is written on it. */
  every?: boolean;
  looks: Looks;
  /** The tallest the drawing may be, px. */
  maxHeight?: number;
  /** The drawing in one sentence, for whoever cannot see it. */
  summary: string;
  /** The member the pointer or the tables are on (label), and the one picked. */
  active?: number | null;
  onActive?: (label: number | null) => void;
  onPick?: (label: number) => void;
  /** A place along a member was pointed at: member label and the share of its length from its first node (0 to 1). */
  onProbe?: (label: number, share: number) => void;
  words: FrameSchematicWords;
  units: { length: string; moment: string; force: string; displacement: string };
  /** Where the drawing starts, for a link that jumps to it. */
  id?: string;
  /** A title for the figure (the printed sheet gives each its own). */
  caption?: string;
}

/** The scale statement under a drawing, or the line that says it is empty. */
export function scaleNote(layout: Layout, mode: Looks['mode'], words: Pick<FrameSchematicWords, 'scaleLine' | 'zeroDiagram'>, units: { length: string; moment: string; force: string; displacement: string }, group: string, deflectedMax: number | null): string {
  if (mode === 'none') return '';
  if (mode === 'deformed') {
    if (layout.factor === null) return words.scaleLine.still;
    return fill(words.scaleLine.deformed, { factor: formatNumber(layout.factor, 3, group), value: formatNumber(deflectedMax ?? 0, 3, group), unit: units.displacement });
  }
  if (layout.empty || layout.scaleValue === null) return words.zeroDiagram[mode];
  return fill(words.scaleLine[mode], { length: units.length, value: formatNumber(layout.scaleValue, 3, group), unit: mode === 'M' ? units.moment : units.force });
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const HEAD_LEN = 8;
const HEAD_HALF = 3.6;

function ArrowMark({ a, className }: { a: ArrowShape; className: string }) {
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
        <line key={x} className="mp-frame-fig__tick" x1={x} y1={y} x2={x - 5} y2={y + 6} />
      ))}
    </>
  );
}

/** One spring: a zigzag down to the ground, in the support's own frame (pointing down from the node). */
function SpringMark({ rotation, kind }: { rotation: number; kind: 'x' | 'y' | 'r' }) {
  return (
    <g transform={`rotate(${rotation})`} className="mp-frame-fig__spring">
      {kind === 'r' ? (
        <>
          <path d="M 0 -11 A 11 11 0 1 1 -11 0" fill="none" />
          <line x1="-11" y1="0" x2="-17" y2="0" />
          <line className="mp-frame-fig__ground" x1="-17" y1="-5" x2="-17" y2="5" />
        </>
      ) : (
        <>
          <polyline points="0,3 0,6 -5,9 5,13 -5,17 5,21 0,24 0,27" fill="none" />
          <line className="mp-frame-fig__ground" x1="-12" y1="27" x2="12" y2="27" />
          <Hatch x0={-12} x1={12} y={27} />
        </>
      )}
    </g>
  );
}

/** A support symbol, drawn pointing down the page from the origin and turned to its side. */
function SupportSymbol({ s }: { s: SupportShape }) {
  const hasMarks = s.kind === 'spring';
  return (
    <>
      <g className={`mp-frame-fig__support mp-frame-fig__support--${s.kind}`} transform={`translate(${s.x} ${s.y})`}>
        {hasMarks ? (
          s.marks.length > 0 ? (
            s.marks.map((m) => <SpringMark key={m.kind} rotation={m.kind === 'r' ? 0 : m.rotation} kind={m.kind} />)
          ) : (
            <line x1="0" y1="0" x2="0" y2="8" />
          )
        ) : (
          <g transform={`rotate(${s.rotation})`}>
            {s.kind === 'fixed' ? (
              <>
                <line className="mp-frame-fig__ground" x1="-14" y1="8" x2="14" y2="8" />
                <Hatch x0={-14} x1={14} y={8} />
              </>
            ) : s.kind === 'pin' ? (
              <>
                <polygon points="0,0 -11,20 11,20" />
                <line className="mp-frame-fig__ground" x1="-15" y1="20" x2="15" y2="20" />
              </>
            ) : s.kind === 'roller' ? (
              <>
                <polygon points="0,0 -9,15 9,15" />
                <circle cx="-4.5" cy="19.2" r="3.4" />
                <circle cx="4.5" cy="19.2" r="3.4" />
                <line className="mp-frame-fig__ground" x1="-13" y1="23" x2="13" y2="23" />
              </>
            ) : (
              <>
                <rect x="-12" y="5" width="24" height="4" />
                <circle cx="-6" cy="12" r="3" />
                <circle cx="6" cy="12" r="3" />
                <line className="mp-frame-fig__ground" x1="-14" y1="16" x2="14" y2="16" />
                <Hatch x0={-14} x1={14} y={16} />
              </>
            )}
          </g>
        )}
      </g>
      {s.badges.map((b) => (
        <g key={b.glyph} className="mp-frame-fig__badge">
          <circle cx={b.x} cy={b.y} r="6.5" />
          <text x={b.x} y={b.y + 3.4} textAnchor="middle">
            {b.glyph === 'k' ? 'k' : 'δ'}
          </text>
        </g>
      ))}
    </>
  );
}

function MemberLoadMark({ l }: { l: MemberLoadShape }) {
  return (
    <g className="mp-frame-fig__mload" data-load={l.label}>
      {l.heat.map((h, k) => (
        <line key={k} className="mp-frame-fig__heat" x1={h.x1} y1={h.y1} x2={h.x2} y2={h.y2} />
      ))}
      {l.line ? <polyline className="mp-frame-fig__mline" points={l.line.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" /> : null}
      {l.arrows.map((a, k) => (
        <ArrowMark key={k} a={{ ...a, text: null }} className="mp-frame-fig__load" />
      ))}
      {l.arc ? <ArcMark a={l.arc} className="mp-frame-fig__load" /> : null}
    </g>
  );
}

const Word = ({ box, className, size }: { box: { value: string; x: number; y: number }; className: string; size?: number }) => (
  <text className={className} x={box.x} y={box.y} textAnchor="middle" style={size && size !== 11 ? { fontSize: size } : undefined}>
    {box.value}
  </text>
);

export function FrameSchematic({ drawing, width, widen = true, paper = false, every = false, looks, maxHeight, summary, active = null, onActive, onPick, onProbe, words, units, id, caption }: FrameSchematicProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { drawn, layout, widened } = useMemo(() => {
    const wide = widen && every ? everyWidth(drawing, looks, width).width : width;
    return { drawn: wide, widened: wide > width, layout: layoutFor(drawing, { ...looks, width: wide, maxHeight }) };
  }, [drawing, width, widen, every, looks, maxHeight]);
  const ends = active === null ? null : layout.members.find((m) => m.label === active);
  const wide = drawn > width;
  const noteText = scaleNote(layout, looks.mode, words, units, looks.group, drawing.deflected?.maxDisplacement ?? null);
  const thinnedNote = layout.thinned > 0 ? fill(paper ? words.notes.thinnedPaper : words.notes.thinned, { count: layout.thinned }) : '';
  const mode = looks.mode;
  const hit = (m: Layout['members'][number]) => (e: React.PointerEvent<SVGLineElement>) => {
    if (paper) return;
    if (e.type === 'pointermove' && e.pointerType !== 'mouse') return;
    onActive?.(m.label);
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg || !onProbe) return;
    const box = svg.getBoundingClientRect();
    if (box.width === 0) return;
    const px = ((e.clientX - box.left) * layout.width) / box.width;
    const py = ((e.clientY - box.top) * layout.height) / box.height;
    const dx = m.x2 - m.x1;
    const dy = m.y2 - m.y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return;
    onProbe(m.label, Math.min(1, Math.max(0, ((px - m.x1) * dx + (py - m.y1) * dy) / l2)));
  };
  const diagramClass = mode === 'M' || mode === 'V' || mode === 'N' ? `mp-frame-fig__diagram--${mode}` : '';
  return (
    <figure className="mp-frame-fig mp-frame__target" id={id} tabIndex={id ? -1 : undefined}>
      {caption ? <figcaption className="mp-frame-fig__caption">{caption}</figcaption> : null}
      <div className={wide ? 'mp-frame-fig__scroll mp-frame-fig__scroll--wide' : 'mp-frame-fig__scroll'} role={wide ? 'group' : undefined} aria-label={wide ? words.notes.region : undefined} tabIndex={wide ? 0 : undefined}>
        <svg className="mp-plot__svg mp-frame-fig__svg" role="img" aria-label={summary} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
          <defs>
            <pattern id={`${uid}m`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" className="mp-frame-fig__pat mp-frame-fig__pat--M" />
            </pattern>
            <pattern id={`${uid}v`} width="5" height="5" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="5" className="mp-frame-fig__pat mp-frame-fig__pat--V" />
            </pattern>
            <pattern id={`${uid}n`} width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="2.5" r="0.9" className="mp-frame-fig__dot" />
            </pattern>
          </defs>
          <g aria-hidden="true">
            {ends ? <line className="mp-frame-fig__halo" x1={ends.x1} y1={ends.y1} x2={ends.x2} y2={ends.y2} /> : null}
            {layout.diagram ? (
              <g className={`mp-frame-fig__diagram ${diagramClass}`}>
                {layout.diagram.polygons.map((g, k) => (
                  <polygon key={k} className="mp-frame-fig__area" points={g.points} fill={`url(#${uid}${layout.diagram!.mode === 'M' ? 'm' : layout.diagram!.mode === 'V' ? 'v' : 'n'})`} />
                ))}
                {layout.diagram.outlines.map((p, k) => (
                  <polyline key={k} className="mp-frame-fig__outline" points={p} fill="none" />
                ))}
              </g>
            ) : null}
            {layout.deformed ? layout.members.map((m) => <line key={`g${m.label}`} className="mp-frame-fig__ghost" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />) : null}
            {layout.deformed ? layout.deformed.members.map((m) => <polyline key={`d${m.member}`} className="mp-frame-fig__deformed" points={m.points} fill="none" />) : null}
            {layout.memberLoads.map((l) => (
              <MemberLoadMark key={`ml${l.label}`} l={l} />
            ))}
            {layout.supports.map((s) => (
              <SupportSymbol key={`s${s.label}`} s={s} />
            ))}
            {layout.deformed ? null : layout.members.map((m) => (
              <line key={`m${m.label}`} className={`mp-frame-fig__member${active === m.label ? ' mp-frame-fig__member--active' : ''}`} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} data-member={m.label} />
            ))}
            {layout.deformed ? layout.members.map((m) => <line key={`m${m.label}`} className={`mp-frame-fig__member mp-frame-fig__member--thin${active === m.label ? ' mp-frame-fig__member--active' : ''}`} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} data-member={m.label} />) : null}
            {layout.loads.map((l) => (
              <g key={`l${l.label}`}>
                {l.arrow ? <ArrowMark a={l.arrow} className="mp-frame-fig__load" /> : null}
                {l.arc ? <ArcMark a={l.arc} className="mp-frame-fig__load" /> : null}
              </g>
            ))}
            {layout.reactions.map((r) => (
              <g key={`r${r.label}`}>
                {r.arrows.map((a, k) => (
                  <ArrowMark key={k} a={a} className="mp-frame-fig__reaction" />
                ))}
                {r.arc ? <ArcMark a={r.arc} className="mp-frame-fig__reaction" /> : null}
              </g>
            ))}
            {layout.hinges.map((h) => (
              <circle key={`h${h.member}-${h.x}-${h.y}`} className="mp-frame-fig__hinge" cx={h.x} cy={h.y} r={h.r} />
            ))}
            {layout.diagram
              ? layout.diagram.chevrons.map((c, k) => (
                  <polyline key={`c${k}`} className="mp-frame-fig__chevron" points="-3.5,-3.5 3,0 -3.5,3.5" fill="none" transform={`translate(${c.x} ${c.y}) rotate(${c.angle})`} />
                ))
              : null}
            {layout.nodes.map((n) => (
              <g key={`n${n.label}`} className={`mp-frame-fig__node${n.numbered ? '' : ' mp-frame-fig__node--dot'}${ends && (ends.i === n.label || ends.j === n.label) ? ' mp-frame-fig__node--active' : ''}${n.flagged ? ' mp-frame-fig__node--flagged' : ''}`}>
                <circle cx={n.x} cy={n.y} r={n.r} />
                {n.flagged ? <circle className="mp-frame-fig__ring" cx={n.x} cy={n.y} r={n.r + 4} /> : null}
                {n.numbered ? (
                  <text x={n.x} y={n.y + 3.2} textAnchor="middle">
                    {n.label}
                  </text>
                ) : null}
              </g>
            ))}
            {layout.loads.map((l) => (
              <g key={`lt${l.label}`}>
                {l.arrow?.text ? <Word box={l.arrow.text} className="mp-frame-fig__word mp-frame-fig__word--load" /> : null}
                {l.arc?.text ? <Word box={l.arc.text} className="mp-frame-fig__word mp-frame-fig__word--load" /> : null}
              </g>
            ))}
            {layout.memberLoads.map((l) => (l.text ? <Word key={`mt${l.label}`} box={l.text} className="mp-frame-fig__word mp-frame-fig__word--load" /> : null))}
            {layout.reactions.map((r) => (
              <g key={`rt${r.label}`}>
                {r.arrows.map((a, k) => (a.text ? <Word key={k} box={a.text} className="mp-frame-fig__word mp-frame-fig__word--reaction" /> : null))}
                {r.arc?.text ? <Word box={r.arc.text} className="mp-frame-fig__word mp-frame-fig__word--reaction" /> : null}
              </g>
            ))}
            {layout.diagram
              ? layout.diagram.labels.map((b, k) => <Word key={`v${k}`} box={b} className={`mp-frame-fig__word mp-frame-fig__word--${layout.diagram!.mode}`} size={layout.fontSize} />)
              : null}
            {layout.diagram
              ? layout.diagram.signs.map((s, k) => (
                  <text key={`sg${k}`} className={`mp-frame-fig__sign mp-frame-fig__sign--${layout.diagram!.mode}`} x={s.x} y={s.y} textAnchor="middle">
                    {s.glyph}
                  </text>
                ))
              : null}
            {layout.deformed ? layout.deformed.totals.map((b) => <Word key={`t${b.node}`} box={b} className="mp-frame-fig__word mp-frame-fig__word--deformed" size={layout.fontSize} />) : null}
            {layout.members.map((m) => (m.tag ? (
              <g key={`tag${m.label}`} className="mp-frame-fig__tag">
                <rect x={m.tag.rect.x0} y={m.tag.rect.y0} width={m.tag.rect.x1 - m.tag.rect.x0} height={m.tag.rect.y1 - m.tag.rect.y0} rx="2" />
                <text x={m.tag.x} y={m.tag.y} textAnchor="middle" style={layout.fontSize === 11 ? undefined : { fontSize: layout.fontSize }}>
                  {m.tag.value}
                </text>
              </g>
            ) : null))}
            {/* The press-and-hover targets: wide, clear, on top. They do not print. */}
            <g className="mp-frame-fig__hits">
              {layout.members.map((m) => (
                <line
                  key={`h${m.label}`}
                  className="mp-frame-fig__hit"
                  x1={m.x1}
                  y1={m.y1}
                  x2={m.x2}
                  y2={m.y2}
                  onPointerEnter={hit(m)}
                  onPointerMove={hit(m)}
                  onPointerDown={hit(m)}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') onActive?.(null);
                  }}
                  onClick={() => onPick?.(m.label)}
                />
              ))}
            </g>
          </g>
        </svg>
      </div>
      {wide ? <p className="mp-frame-fig__note mp-frame-fig__note--scroll">{widened ? words.notes.every : words.notes.scroll}</p> : null}
      {noteText ? <p className="mp-frame-fig__note mp-frame-fig__note--scale">{noteText}</p> : null}
      {thinnedNote ? <p className="mp-frame-fig__note mp-frame-fig__note--thinned">{thinnedNote}</p> : null}
      {layout.legend.length > 0 ? (
        <ul className="mp-frame-fig__legend">
          {layout.legend.map((key) => (
            <li key={key} className={`mp-frame-fig__key mp-frame-fig__key--${key}`}>
              <LegendSwatch kind={key} />
              <span>{key === 'deformed' && layout.factor !== null ? fill(words.legend.deformed, { factor: formatNumber(layout.factor, 3, looks.group) }) : words.legend[key]}</span>
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
    <svg className="mp-frame-fig__swatch" width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
      {kind === 'member' ? (
        <line className="mp-frame-fig__member" x1="1" y1="8" x2="29" y2="8" />
      ) : kind === 'node' ? (
        <g className="mp-frame-fig__node">
          <circle cx="15" cy="8" r="6" />
        </g>
      ) : kind === 'hinge' ? (
        <>
          <line className="mp-frame-fig__member" x1="1" y1="8" x2="29" y2="8" />
          <circle className="mp-frame-fig__hinge" cx="15" cy="8" r="4.2" />
        </>
      ) : kind === 'fixed' ? (
        <g className="mp-frame-fig__support">
          <line className="mp-frame-fig__ground" x1="3" y1="4" x2="27" y2="4" />
          <Hatch x0={3} x1={27} y={4} step={5} />
        </g>
      ) : kind === 'pin' ? (
        <g className="mp-frame-fig__support">
          <polygon points="15,1 9,12 21,12" />
          <line className="mp-frame-fig__ground" x1="5" y1="12" x2="25" y2="12" />
        </g>
      ) : kind === 'roller' ? (
        <g className="mp-frame-fig__support">
          <polygon points="15,0 10,8 20,8" />
          <circle cx="12" cy="10.8" r="2.2" />
          <circle cx="18" cy="10.8" r="2.2" />
          <line className="mp-frame-fig__ground" x1="6" y1="13.5" x2="24" y2="13.5" />
        </g>
      ) : kind === 'guide' ? (
        <g className="mp-frame-fig__support">
          <rect x="7" y="2" width="16" height="3" />
          <circle cx="11" cy="8" r="2" />
          <circle cx="19" cy="8" r="2" />
          <line className="mp-frame-fig__ground" x1="5" y1="11" x2="25" y2="11" />
          <Hatch x0={5} x1={25} y={11} step={5} />
        </g>
      ) : kind === 'spring' ? (
        <g className="mp-frame-fig__spring">
          <polyline points="15,0 15,2 11,4 19,7 11,10 19,13 15,15" fill="none" />
        </g>
      ) : kind === 'springBadge' || kind === 'settle' ? (
        <g className="mp-frame-fig__badge">
          <circle cx="15" cy="8" r="6.5" />
          <text x="15" y="11.4" textAnchor="middle">
            {kind === 'springBadge' ? 'k' : 'δ'}
          </text>
        </g>
      ) : kind === 'load' || kind === 'reaction' ? (
        <ArrowMark a={{ tail: { x: 1, y: 8 }, tip: { x: 29, y: 8 }, text: null }} className={kind === 'load' ? 'mp-frame-fig__load' : 'mp-frame-fig__reaction'} />
      ) : kind === 'loadMoment' || kind === 'reactionMoment' ? (
        <ArcMark a={{ cx: 15, cy: 8, r: 6, path: 'M 19.2 3.8 A 6 6 0 1 0 19.2 12.2', head: '19.2,12.2 15.8,14.8 22.4,15.4', text: null }} className={kind === 'loadMoment' ? 'mp-frame-fig__load' : 'mp-frame-fig__reaction'} />
      ) : kind === 'distributed' ? (
        <g className="mp-frame-fig__load">
          <line x1="3" y1="1.5" x2="27" y2="1.5" />
          <ArrowMark a={{ tail: { x: 5, y: 1.5 }, tip: { x: 5, y: 12 }, text: null }} className="mp-frame-fig__load" />
          <ArrowMark a={{ tail: { x: 15, y: 1.5 }, tip: { x: 15, y: 12 }, text: null }} className="mp-frame-fig__load" />
          <ArrowMark a={{ tail: { x: 25, y: 1.5 }, tip: { x: 25, y: 12 }, text: null }} className="mp-frame-fig__load" />
        </g>
      ) : kind === 'temperature' ? (
        <>
          <line className="mp-frame-fig__member" x1="1" y1="8" x2="29" y2="8" />
          <line className="mp-frame-fig__heat" x1="1" y1="3" x2="29" y2="3" />
          <line className="mp-frame-fig__heat" x1="1" y1="13" x2="29" y2="13" />
        </>
      ) : kind === 'moment' ? (
        <g className="mp-frame-fig__diagram mp-frame-fig__diagram--M">
          <rect className="mp-frame-fig__area mp-frame-fig__area--swatch" x="2" y="2" width="26" height="12" />
          <line className="mp-frame-fig__outline" x1="2" y1="2" x2="28" y2="2" />
          {[0, 4, 8, 12, 16, 20, 24].map((x) => (
            <line key={x} className="mp-frame-fig__pat mp-frame-fig__pat--M" x1={x + 2} y1="14" x2={Math.min(28, x + 14)} y2={Math.max(2, 14 - (28 - x - 2 < 12 ? 28 - x - 2 : 12))} />
          ))}
        </g>
      ) : kind === 'shear' ? (
        <g className="mp-frame-fig__diagram mp-frame-fig__diagram--V">
          <rect className="mp-frame-fig__area mp-frame-fig__area--swatch" x="2" y="2" width="26" height="12" />
          <line className="mp-frame-fig__outline" x1="2" y1="2" x2="28" y2="2" />
          {[5, 9, 13, 17, 21, 25].map((x) => (
            <line key={x} className="mp-frame-fig__pat mp-frame-fig__pat--V" x1={x} y1="2" x2={x} y2="14" />
          ))}
        </g>
      ) : kind === 'axial' ? (
        <g className="mp-frame-fig__diagram mp-frame-fig__diagram--N">
          <rect className="mp-frame-fig__area mp-frame-fig__area--swatch" x="2" y="2" width="26" height="12" />
          <line className="mp-frame-fig__outline" x1="2" y1="2" x2="28" y2="2" />
          {[6, 11, 16, 21, 26].flatMap((x) => [5, 9, 13].map((y) => <circle key={`${x}${y}`} className="mp-frame-fig__dot" cx={x} cy={y} r="0.9" />))}
        </g>
      ) : kind === 'positive' ? (
        <text className="mp-frame-fig__sign" x="15" y="12" textAnchor="middle">
          + −
        </text>
      ) : kind === 'direction' ? (
        <>
          <line className="mp-frame-fig__member" x1="1" y1="8" x2="29" y2="8" />
          <polyline className="mp-frame-fig__chevron" points="-3.5,-3.5 3,0 -3.5,3.5" fill="none" transform="translate(15 8)" />
        </>
      ) : kind === 'deformed' ? (
        <line className="mp-frame-fig__deformed" x1="1" y1="8" x2="29" y2="8" />
      ) : (
        <g className="mp-frame-fig__node mp-frame-fig__node--flagged">
          <circle cx="15" cy="8" r="5" />
          <circle className="mp-frame-fig__ring" cx="15" cy="8" r="7" />
        </g>
      )}
    </svg>
  );
}
