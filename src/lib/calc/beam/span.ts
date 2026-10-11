import { fieldNumber } from '../format';
import {
  bendingStress,
  convertUnits,
  decodeBeam,
  defaultBeam,
  deflectionFactor,
  encodeBeam,
  reduceBeam,
  sectionProps,
  stiffness,
  toEngine,
  type BeamAction,
  type BeamAnalysis,
  type BeamForm,
  type SteelShape,
  type UnitSystem,
} from './model';
import { solveBeam } from './solver';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE-SPAN BEAM — what the second calculator adds to the first
 * ─────────────────────────────────────────────────────────────────────────────
 * "Single-span beam" (/resources/single-span-beam) is the first calculator's
 * own component in another mode (BeamCalculator.tsx, the `span` prop): one
 * span on a pin and a roller, under point and distributed loads. The beam as
 * entered is still a `BeamForm`, so the units, the section, the engine and
 * the address of a beam are model.ts's, used as they are. Only what is new is
 * here, as pure functions:
 *
 *   — the supports, which are not the visitor's to place (`pinEnds`);
 *   — each load solved alone, for the table an engineer checks a beam by
 *     hand with (`byLoad`);
 *   — the section a deflection limit and a bending stress ask for
 *     (`sizing`): mechanics, no design code;
 *   — the address of this page's case: those two limits, then the beam
 *     (`encodeSpan`, `decodeSpan`), and whether the beam of a link held
 *     what this span has not (`beyondSpan`).
 *
 * UNITS are the form's, as everywhere in model.ts: feet and kips or metres
 * and kilonewtons along the beam, inches or millimetres in the section. No
 * factor of 12 or of 1,000 is written in this file: every conversion goes
 * through `stiffness`, `deflectionFactor` and `bendingStress`.
 */

/** What this page's case is called in its address: `#s=…`, where the first calculator's is `#b=…`. */
export const SPAN_KEY = 's';

/** The deflection limit the page opens with: L/360. */
export const DEFAULT_LIMIT = 360;

/* The ids of the two supports. A row's id is handed out from `nextId`, which
   starts above zero and only grows: no load can be given one of these. */
const PIN = -1;
const ROLLER = -2;

/**
 * The beam this page opens with — not the first calculator's, so that the
 * two do not open on the same one: 24 ft, 0.8 kip/ft over the whole span and
 * 6 kip at 8 ft, on a W16×40's properties. By hand: reactions 13.6 and
 * 11.6 kip.
 *
 * Its loads are numbered as a link numbers them (after the two supports it
 * would have listed), so this beam read back from its own address is this
 * beam, id for id.
 */
export function defaultSpan(): BeamForm {
  return {
    units: 'us',
    L: 24,
    supports: [
      { id: PIN, kind: 'pin', x: 0 },
      { id: ROLLER, kind: 'roller', x: 24 },
    ],
    hinges: [],
    points: [{ id: 3, x: 8, P: 6, dir: 'down' }],
    dists: [{ id: 4, x1: 0, x2: 24, w1: 0.8, w2: 0.8, dir: 'down' }],
    couples: [],
    section: { mode: 'props', material: 'steel', E: 29000, I: 518, S: 64.7, Av: 4.88, b: 12, h: 24, shape: 'W16X40', selfWeight: false },
    nextId: 5,
  };
}

/* ── The supports ─────────────────────────────────────────────────────── */

/**
 * The same loads on the span this page is about: a pin at 0, a roller at L,
 * no hinge, no applied moment. Whatever a form held of those — a link from
 * the first calculator names walls, hinges and moments — it is this beam
 * that is solved here.
 *
 * With a length that is not a positive number there is no end to put the
 * roller on: the supports stay where they were, and the form says what is
 * wrong with the length.
 *
 * A form that is already so comes back as the same object: nothing changed,
 * and nothing that watches the form is told otherwise.
 */
export function pinEnds(form: BeamForm): BeamForm {
  const held = form.L > 0 && Number.isFinite(form.L);
  const [a, b] = form.supports;
  const pinned = form.supports.length === 2 && a.id === PIN && a.kind === 'pin' && a.x === 0 && b.id === ROLLER && b.kind === 'roller' && b.x === form.L;
  if ((pinned || !held) && form.hinges.length === 0 && form.couples.length === 0) return form;
  return {
    ...form,
    supports: held && !pinned ? [{ id: PIN, kind: 'pin', x: 0 }, { id: ROLLER, kind: 'roller', x: form.L }] : form.supports,
    hinges: [],
    couples: [],
  };
}

/** What each edit does to the form on this page: what it does on the first calculator's, on the pinned span. */
export function reduceSpan(form: BeamForm, action: BeamAction): BeamForm {
  return pinEnds(reduceBeam(form, action));
}

/* ── Load by load ─────────────────────────────────────────────────────── */

/** What one load — or all of them — puts on the span. */
export interface LoadShare {
  /** The reactions at the left and the right support, positive upward (kip, kN). */
  left: number;
  right: number;
  /** The moment at the section asked about, positive sagging (kip·ft, kN·m). */
  M: number;
  /** EI·v at the point asked about, positive upward (the engine's kip·ft³, kN·m³)… */
  EIv: number;
  /** …and as a deflection in the unit shown (in, mm); zero when E or I is missing. */
  deflection: number;
}

export interface LoadRow extends LoadShare {
  /** The list of the form the load is a row of, and its place there; 'own' is the beam's own weight. */
  list: 'points' | 'dists' | 'own';
  index: number;
}

/**
 * Each load of the form ALONE on the span, solved by the engine: the point
 * loads in their order, then the distributed loads, then the beam's own
 * weight when it is a load. `xM` is the section the moments are read at and
 * `xD` the point the deflections are read at — the page gives the places
 * where those of the whole beam are largest.
 *
 * The beam is linear, so the rows add up to the whole beam (`sum`, held
 * against the engine's own answer for all the loads together in
 * span.test.ts). A load that is no load — of size zero, of no length — is a
 * row of zeros.
 *
 * `null` when the span cannot be solved: there is nothing to share out.
 */
export function byLoad(form: BeamForm, shape: SteelShape | null | undefined, xM: number, xD: number): { rows: LoadRow[]; sum: LoadShare } | null {
  const span = pinEnds(form);
  const section = sectionProps(span, shape);
  const toDeflection = deflectionFactor(span.units, stiffness(span.units, section));
  const alone = (points: BeamForm['points'], dists: BeamForm['dists'], ownWeight: number): LoadShare | null => {
    // Through the model's own door to the engine: a direction becomes a sign in one place only.
    const out = solveBeam(toEngine({ ...span, points, dists }, { ...section, selfWeight: ownWeight }));
    if (!out.ok || out.reactions.length !== 2) return null;
    const EIv = out.at(xD).EIv;
    // Without E or I there is no deflection to give: a plain zero, not EI·v times nothing.
    return { left: out.reactions[0].Rv, right: out.reactions[1].Rv, M: out.at(xM).M, EIv, deflection: toDeflection ? EIv * toDeflection : 0 };
  };
  const rows: LoadRow[] = [];
  const add = (list: LoadRow['list'], index: number, share: LoadShare | null) => {
    if (share) rows.push({ list, index, ...share });
    return share !== null;
  };
  const solved =
    span.points.every((p, i) => add('points', i, alone([p], [], 0))) &&
    span.dists.every((d, i) => add('dists', i, alone([], [d], 0))) &&
    (section.selfWeight === 0 || add('own', 0, alone([], [], section.selfWeight)));
  // With no load there was nothing to try the span with: it is tried bare.
  if (!solved || (rows.length === 0 && !alone([], [], 0))) return null;
  const sum: LoadShare = { left: 0, right: 0, M: 0, EIv: 0, deflection: 0 };
  for (const r of rows) for (const key of Object.keys(sum) as (keyof LoadShare)[]) sum[key] += r[key];
  return { rows, sum };
}

/* ── The section a limit asks for ─────────────────────────────────────── */

/**
 * Two values, mechanics only — no design code, no factor, no verdict:
 *
 * `I`, the moment of inertia with which the largest deflection of the span
 * is L/`limit` (in⁴, 10⁶ mm⁴ — the unit of the I field). It needs the
 * modulus E and no I: the engine returns EI·v, and
 *
 *     v ÷ L = 1 ÷ limit   ⇒   E·I = |EI·v| × limit ÷ L
 *
 * in the engine's own units, where `stiffness` says what one unit of I is
 * worth. `null` when E is not usable or the limit is not a positive number.
 *
 * `S`, the section modulus with which the largest moment gives the bending
 * stress typed (in³, 10³ mm³): S = |M| ÷ σ, through `bendingStress` at
 * S = 1. `null` when no stress is typed (zero is "not given", as for the
 * section's own optional values).
 *
 * The largest values are the engine's, as they come: the page settles what
 * is rounding before it prints (BeamCalculator.tsx, `peaks`).
 */
export function sizing(analysis: BeamAnalysis, form: BeamForm, limit: number, stress: number): { I: number | null; S: number | null } {
  const sol = analysis.solution;
  if (!sol) return { I: null, S: null };
  const e = sol.extremes;
  const EIv = Math.max(Math.abs(e.EIvMax.value), Math.abs(e.EIvMin.value));
  const M = Math.max(Math.abs(e.Mmax.value), Math.abs(e.Mmin.value));
  const perI = stiffness(form.units, { ...analysis.section, I: 1 });
  const perS = bendingStress(form.units, { ...analysis.section, S: 1 }, M);
  return {
    I: perI > 0 && limit > 0 && Number.isFinite(limit) ? (EIv * limit) / (sol.L * perI) : null,
    S: perS !== null && stress > 0 && Number.isFinite(stress) ? perS / stress : null,
  };
}

/**
 * A stress in the other unit system (ksi, MPa). Converted as a modulus of
 * elasticity is — the same unit — and by the model itself, for its rounding:
 * 24 ksi looked at in MPa and brought back is 24 ksi again, not 23.9999.
 */
export function convertStress(stress: number, from: UnitSystem, to: UnitSystem): number {
  if (from === to) return stress;
  const carrier = defaultBeam();
  // 'custom': a listed material would bring its own modulus instead of converting this one.
  return convertUnits({ ...carrier, units: from, section: { ...carrier.section, material: 'custom', E: stress } }, to).section.E;
}

/* ── This page's case in an address ───────────────────────────────────── */

/** What the page holds: the beam, the deflection limit L/`limit`, and the bending stress to size for (zero: none). */
export interface SpanCase {
  form: BeamForm;
  limit: number;
  stress: number;
  /**
   * Said of a case read from a link, and only when it is so: the beam in the
   * link held what this span has not (`beyondSpan`), and `form` is the span
   * without it. The page says so; a link that lost nothing has no such key.
   */
  lost?: true;
}

/* Between the two limits and the beam. A beam's own string has none: it is
   numbers, a few letters and `;` `,` `_`, and a shape's name allows only
   letters, digits and `. / -` (model.ts). And an address carries a tilde as
   it is, never as %7E. */
const SEP = '~';

/* The two limits are written and read as the numbers of a beam are (the
   same eight figures, the same three names for what is not a number: a
   stress near the largest a number can be overflows when the units are
   switched). model.ts keeps its own copies of these to itself. */
const NUMBER = /^-?\d+(\.\d+)?(e-?\d+)?$/;
const NAMED = new Map<string, number>([['inf', Infinity], ['-inf', -Infinity], ['nan', Number.NaN]]);
const written = (v: number): string => (Number.isFinite(v) ? fieldNumber(v).replace('e+', 'e') : v > 0 ? 'inf' : v < 0 ? '-inf' : 'nan');
const read = (s: string): number | null => {
  const named = NAMED.get(s);
  if (named !== undefined) return named;
  const v = NUMBER.test(s) ? Number(s) : Number.NaN;
  // As a number, a zero written with a minus is a plain zero.
  return Number.isFinite(v) ? v + 0 : null;
};

/**
 * The case as a string for the page's address, after `#s=`:
 *
 *     limit ~ stress, or nothing ~ the beam, as `encodeBeam` writes it
 *
 * THE TWO LIMITS GO FIRST. The beam's string begins with a check of
 * everything after it (model.ts, `checkOf`), and that is what a link cut
 * short on its way fails: with the limits at the end, a link that lost its
 * tail would still open — on another stress, with no notice.
 *
 * Whatever the fields hold is written, as for a beam: a limit of 0 on the
 * way to 240 comes back from a reload as 0, with its mark.
 */
export function encodeSpan(form: BeamForm, limit: number, stress: number): string {
  return [written(limit), stress === 0 ? '' : written(stress), encodeBeam(form)].join(SEP);
}

/**
 * What a link does not carry starts from THIS page's example: a beam given
 * by its properties says nothing of a rolled shape, and "Steel shape" then
 * opens on the W16×40 those properties are — not on the first calculator's
 * shape. In the link's own units.
 */
function ownSection(form: BeamForm): BeamForm {
  const own = (form.units === 'si' ? convertUnits(defaultSpan(), 'si') : defaultSpan()).section;
  const s = form.section;
  const section =
    s.mode === 'shape'
      ? { ...own, mode: s.mode, material: s.material, shape: s.shape, selfWeight: s.selfWeight }
      : s.mode === 'rect'
        ? { ...own, mode: s.mode, material: s.material, E: s.E, b: s.b, h: s.h }
        : { ...own, mode: s.mode, material: s.material, E: s.E, I: s.I, S: s.S, Av: s.Av };
  return { ...form, section };
}

/**
 * Whether a beam holds what this page's span has not, so that `pinEnds`
 * makes another beam of it: supports that are not one at each end, free to
 * turn there (a pin and a roller either way round are the same span under
 * these loads); an internal hinge; an applied moment that is one.
 *
 * Not "`pinEnds` changed it": every beam read from a link is changed by
 * `pinEnds`, which gives the two supports this page's own ids.
 */
export function beyondSpan(beam: BeamForm): boolean {
  const xs = beam.supports.map((s) => s.x).sort((p, q) => p - q);
  const ends = beam.supports.length === 2 && beam.supports.every((s) => s.kind !== 'fixed') && xs[0] === 0 && xs[1] === beam.L;
  return !ends || beam.hinges.length > 0 || beam.couples.some((c) => c.M !== 0);
}

/**
 * The case a string from `encodeSpan` describes, or `null` if it is anything
 * else: not three fields, a limit that is not a number, a beam `decodeBeam`
 * refuses. A link cut short is always one of those.
 *
 * The beam may be any beam the first calculator writes. Its supports, hinges
 * and applied moments are not this page's: it opens as the pinned span under
 * that beam's point and distributed loads, and not as an error — but not in
 * silence either: an applied moment is a load, and the span shown is then
 * not the beam the link was made for. The case says so (`lost`).
 */
export function decodeSpan(text: string): SpanCase | null {
  const parts = text.split(SEP);
  if (parts.length !== 3) return null;
  const limit = read(parts[0]);
  const stress = parts[1] === '' ? 0 : read(parts[1]);
  const beam = decodeBeam(parts[2]);
  if (limit === null || stress === null || !beam) return null;
  return { form: ownSection(pinEnds(beam)), limit, stress, ...(beyondSpan(beam) ? { lost: true as const } : {}) };
}

/**
 * The first calculator's own link (what follows its `#b=`), opened on this
 * page: that beam's loads on the pinned span, with the limits the page
 * opens with. For the engineer who brings a beam over by its address.
 */
export function adoptBeam(text: string): SpanCase | null {
  const beam = decodeBeam(text);
  return beam ? { form: ownSection(pinEnds(beam)), limit: DEFAULT_LIMIT, stress: 0, ...(beyondSpan(beam) ? { lost: true as const } : {}) } : null;
}
