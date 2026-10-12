import type { Lang } from '@/lib/ttc/i18n';
import type { AnalysisIssueCode } from './analysis';
import type { EndKind } from './types';

/**
 * The words the continuous beam's FORM AND TABLES add to the first
 * calculator's own (beam/strings.ts, `ui`), in English and in Spanish.
 *
 * The tool (ContinuousCalculator.tsx) takes two sets of words. `t`, the
 * first calculator's: the units, the loads' fields, the "Section and
 * material" group, the drawings, the row of actions and most of the results
 * are the same pieces, and say the same things. And `c`, this file: what a
 * beam entered span by span has to say that a beam on any supports had not —
 * its spans and their stiffness, how its ends are held, settlements, dead
 * and live, the arrangements of the live load, and the faults of its own.
 * A phrase the first calculator already has is taken from `t`, never written
 * again here: each text of the site has one home
 * (continuous-calculator.test.ts compares the two, six words at a time, and
 * this file with the page's own text, page-strings.ts).
 *
 * Like `ui`, they travel to the browser as a prop: the server view picks the
 * language, and the calculator's script carries neither this file nor the
 * other language.
 *
 * NO VERDICT, NO CODE. The page gives moments, reactions, deflections and
 * elastic stresses under the loads as entered. No word here says whether a
 * value will do, and none names a standard.
 *
 * Spanish as the first calculator writes it — "vano", "apoyo", "empotrado",
 * "voladizo", formal "usted" — and for what is new: "asentamiento", "factor
 * de rigidez", "carga muerta" and "carga viva", and "disposición" for an
 * arrangement of the live load, as the page's text has it.
 */
export type ContinuousUi = {
  /**
   * The table of spans. `note` says what the stiffness factor multiplies and
   * what 1 means, and what the two loads of a row are.
   */
  spans: { title: string; stiffness: string; dead: string; live: string; note: string; add: string; limit: string };
  /** How each end of the beam is held: the three kinds, and what stands between two spans. */
  ends: { title: string; left: string; right: string; kinds: Record<EndKind, string>; note: string };
  /**
   * The group of settlements: its `title` (not the first calculator's
   * "Supports", which is the title of the results card under the form too:
   * two things with one name, and fields that never said "settlement"),
   * `name`, what the fields are for whoever cannot see the note above them,
   * and the `note` — true of the screen, where a support that does not
   * settle is an empty field, and of the printed sheet, which writes its 0.
   */
  settlements: { title: string; name: string; note: string };
  /** A further load is dead or live, and is placed in its own span. */
  loads: { kinds: { dead: string; live: string }; note: string };
  /**
   * How the live load is taken. `count` stands under "every arrangement"
   * with {spans}, how many spans carry a live load, and {count}, how many
   * arrangements that makes; `none` in its place when no span carries one.
   */
  live: { title: string; taken: string; all: string; every: string; allNote: string; everyNote: string; count: string; none: string };
  /** The "Section and material" group's first line, in place of the first calculator's: here a settlement depends on the section too. */
  section: { intro: string };
  /** The way to the first calculator with the beam on screen: `general` says what for, `generalLink` is the link — that calculator, by its name. */
  general: string;
  generalLink: string;
  results: {
    /** Heads of the "Supports" card. */
    reaction: string;
    momentOver: string;
    /**
     * Over every arrangement each of the two is a pair, and its two heads end
     * in these: `largest` is the end of the range further from zero — the
     * force or the moment to design for, whichever way it acts — and `other`
     * the end that is left. (Not "max" and "min": a support held down in
     * every arrangement read "max 8.025 downward, min 30.23 downward".)
     */
    ends: { largest: string; other: string };
    /** The "Span by span" card and its heads. */
    bySpan: string;
    sagging: string;
    fromSupports: string;
    /** A result over every arrangement, with {min} and {max}. */
    range: string;
    /**
     * Which spans carry their live load in the arrangement that gives a
     * value: {spans} is their numbers, joined with `and` before the last.
     */
    pattern: { one: string; many: string; none: string; and: string };
    /** Over the table of a card whose values name their arrangement: {on} and {off} are where the two marks are drawn. */
    key: string;
    /** Under the diagrams, when each is a band. */
    band: string;
    /**
     * On the drawing. `uniform` stands in its title when a block is a span's
     * two uniform loads, written "0.9 + 1.2": which number is which. `live`
     * follows the value of a further load that is live.
     */
    uniform: string;
    live: string;
    /** In place of the two stresses, where a span is not the section entered. */
    noStress: string;
  };
  /**
   * The faults that are this form's own. {min} and {max} are the limits of a
   * stiffness factor. `stopped` is not a fault of the beam: the arithmetic
   * itself failed on it (analysis.ts, `analyseSafely`), and the line says no
   * more than is known.
   */
  issues: Record<Exclude<AnalysisIssueCode, 'number' | 'section'>, string>;
};

export const continuousUi: Record<Lang, ContinuousUi> = {
  en: {
    spans: {
      title: 'Spans',
      stiffness: 'Stiffness factor',
      dead: 'Dead load',
      live: 'Live load',
      note: 'The stiffness factor multiplies the EI of the section entered below: 1 is that section, 2 a span twice as stiff. Dead and live load are uniform over the whole span.',
      add: 'Add a span',
      limit: 'Eight at most.',
    },
    ends: {
      title: 'Ends of the beam',
      left: 'Left end',
      right: 'Right end',
      kinds: { pin: 'Simple support', fixed: 'Fixed', free: 'Free' },
      note: 'Between two spans the beam rests on a simple support. An end span with a free end is an overhang.',
    },
    settlements: {
      title: 'Support settlements',
      name: 'Settlement',
      note: 'A settlement for any support, as a length downward. Empty or 0: that support does not move.',
    },
    loads: {
      kinds: { dead: 'Dead', live: 'Live' },
      note: 'Positions are measured from the left end of the load’s span.',
    },
    live: {
      title: 'Live load',
      taken: 'Taken',
      all: 'On every span',
      every: 'In every arrangement',
      allNote: 'Dead and live loads all act together: one case.',
      everyNote: 'A span’s live load — its uniform one and each load on it marked live — is either on or off, span by span. Each result is then the highest and the lowest value among those arrangements, or the largest of them.',
      count: 'Spans with a live load: {spans}. Arrangements: {count}.',
      none: 'No span carries a live load yet: there is one arrangement.',
    },
    section: {
      intro: 'Deflections, stresses and the effect of a settlement need this section. Where no support settles, shear and moment are the same for any section, unless its own weight is included.',
    },
    general: 'For internal hinges or applied moments, with every load acting at once:',
    generalLink: 'Take this beam to “Beam reactions and diagrams”',
    results: {
      reaction: 'Reaction',
      momentOver: 'Moment over it',
      ends: { largest: 'largest', other: 'other extreme' },
      bySpan: 'Span by span',
      sagging: 'Largest sagging moment',
      fromSupports: 'Deflection from its supports',
      range: '{min} to {max}',
      pattern: { one: 'live load on span {spans}', many: 'live load on spans {spans}', none: 'no live load', and: ' and ' },
      key: 'Beside a value: {on} a span with its live load on, {off} one with it off, in the arrangement that gives the value.',
      band: 'Each band runs from the lowest value to the highest among the arrangements.',
      uniform: 'uniform loads: dead + live',
      live: 'live',
      noStress: 'No stresses here: a span with a stiffness factor other than 1 is not the section entered, and its section modulus and shear area are not known.',
    },
    issues: {
      'no-spans': 'The beam has no span.',
      length: 'The length of this span must be a positive number.',
      stiffness: 'The stiffness factor must be a number from {min} to {max}.',
      size: 'A number here is too large or too small to work with.',
      outside: 'This position is off its span.',
      'short-span': 'This span is shorter than one thousandth of all the spans together: a span that short is not solved. Lengthen it, or remove it.',
      unstable: 'These ends do not hold the beam in place: it takes two supports, or one fixed end.',
      settlement: 'A support settles: turning that into forces takes E and I, which the section does not give yet. Complete the section, or empty the settlement field.',
      stopped: 'The calculation stopped on this beam, and has no result to show for it. The fault is in this calculator, not in the beam.',
    },
  },
  es: {
    spans: {
      title: 'Vanos',
      stiffness: 'Factor de rigidez',
      dead: 'Carga muerta',
      live: 'Carga viva',
      note: 'El factor de rigidez multiplica el EI de la sección que se introduce abajo: 1 es esa sección; 2, un vano el doble de rígido. La carga muerta y la viva son uniformes en todo el vano.',
      add: 'Añadir un vano',
      limit: 'Ocho como máximo.',
    },
    ends: {
      title: 'Extremos de la viga',
      left: 'Extremo izquierdo',
      right: 'Extremo derecho',
      kinds: { pin: 'Apoyo simple', fixed: 'Empotrado', free: 'Libre' },
      note: 'Entre dos vanos la viga descansa sobre un apoyo simple. Un vano extremo con el extremo libre es un voladizo.',
    },
    settlements: {
      title: 'Asentamientos de los apoyos',
      name: 'Asentamiento',
      note: 'Un asentamiento para cualquier apoyo, como longitud hacia abajo. Vacío o 0: ese apoyo no se mueve.',
    },
    loads: {
      kinds: { dead: 'Muerta', live: 'Viva' },
      note: 'Las posiciones se miden desde el extremo izquierdo del vano de la carga.',
    },
    live: {
      title: 'Carga viva',
      taken: 'Se toma',
      all: 'En todos los vanos',
      every: 'En cada disposición',
      allNote: 'Las cargas muertas y las vivas actúan todas juntas: un solo caso.',
      everyNote: 'La carga viva de un vano — la uniforme y cada carga que tenga marcada como viva — está o no está, vano por vano. Cada resultado es entonces el valor más alto y el más bajo entre esas disposiciones, o el mayor de ellos.',
      count: 'Vanos con carga viva: {spans}. Disposiciones: {count}.',
      none: 'Ningún vano tiene todavía carga viva: hay una sola disposición.',
    },
    section: {
      intro: 'Las deflexiones, los esfuerzos y el efecto de un asentamiento necesitan esta sección. Si ningún apoyo se asienta, el cortante y el momento son los mismos con cualquier sección, salvo que se incluya su peso propio.',
    },
    general: 'Para rótulas internas o momentos aplicados, con todas las cargas actuando a la vez:',
    generalLink: 'Llevar esta viga a «Reacciones y diagramas de vigas»',
    results: {
      reaction: 'Reacción',
      momentOver: 'Momento sobre él',
      ends: { largest: 'mayor', other: 'otro extremo' },
      bySpan: 'Vano por vano',
      sagging: 'Momento positivo máximo',
      fromSupports: 'Deflexión respecto a sus apoyos',
      range: '{min} a {max}',
      pattern: { one: 'carga viva en el vano {spans}', many: 'carga viva en los vanos {spans}', none: 'sin carga viva', and: ' y ' },
      key: 'Junto a un valor: {on} un vano con su carga viva aplicada, {off} uno sin ella, en la disposición que da ese valor.',
      band: 'Cada banda va del valor más bajo al más alto entre las disposiciones.',
      uniform: 'cargas uniformes: muerta + viva',
      live: 'viva',
      noStress: 'Aquí no hay esfuerzos: un vano con un factor de rigidez distinto de 1 no es la sección introducida, y no se conocen su módulo de sección ni su área de cortante.',
    },
    issues: {
      'no-spans': 'La viga no tiene ningún vano.',
      length: 'La longitud de este vano debe ser un número positivo.',
      stiffness: 'El factor de rigidez debe ser un número entre {min} y {max}.',
      size: 'Aquí hay un número demasiado grande o demasiado pequeño para operar con él.',
      outside: 'Esta posición queda fuera de su vano.',
      'short-span': 'Este vano no llega a la milésima parte de la suma de todos los vanos: uno tan corto no se resuelve. Alárguelo o quítelo.',
      unstable: 'Estos extremos no sujetan la viga: hacen falta dos apoyos, o un extremo empotrado.',
      settlement: 'Un apoyo se asienta: convertir eso en fuerzas requiere E e I, que la sección aún no da. Complete la sección o vacíe el campo del asentamiento.',
      stopped: 'El cálculo se ha detenido con esta viga y no tiene ningún resultado que mostrar. El error es de esta calculadora, no de la viga.',
    },
  },
};
