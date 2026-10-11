import type { Lang } from '@/lib/ttc/i18n';

/**
 * The words the single-span mode adds to the beam calculator's own
 * (strings.ts, `ui`), in English and in Spanish. Everything else that page
 * says in its form and its tables is the first calculator's, word for word:
 * the same component prints it.
 *
 * Like `ui`, they travel to the browser as a prop (BeamCalculator.tsx,
 * `span`): the server view picks the language, and the calculator's script
 * carries neither this file nor the other language.
 *
 * NO VERDICT. The page gives the moment of inertia a limit asks for and what
 * the section entered has, side by side. Whether the second will do is the
 * engineer's to say, under the code the design answers to: no word here says
 * it for them (span-calculator.test.ts holds the list of words that would).
 */
export type SpanUi = {
  /** In the Beam group, under the length: what the span rests on, which is not the visitor's to choose here. */
  simple: string;
  /**
   * The way to the first calculator for what this one leaves out, with the
   * beam on screen: `general` says what for, and `generalLink` is the link
   * that follows it — that calculator, by its name.
   */
  general: string;
  generalLink: string;
  /**
   * Said in the results box when a link opened here held what this span has
   * not — other supports, internal hinges, applied moments: the span shown
   * is then not the beam the link was made for, and its reactions are not
   * that beam's.
   */
  leftOut: string;
  /**
   * The table of each load alone. Its rows are named as the form names them
   * ("Point load 1", from strings.ts); `own` and `all` are the two rows the
   * form has no name for. The heads of the moment and deflection columns
   * are the first calculator's words with the place they are read at.
   * `noteDeflection` follows `note` when there is a deflection column.
   * `note` promises a sum of what is PRINTED only as far as that is true:
   * each value is rounded on its own, four figures, so a column added up by
   * hand can miss the last row in its last figure.
   */
  loads: { title: string; load: string; left: string; right: string; own: string; all: string; note: string; noteDeflection: string };
  /**
   * The two values a limit asks of the section. `limit` reads on into its
   * field: "Deflection limit, L ÷ 360". `has` stands beside a value needed,
   * with {value} the section's own and its unit. The three `need…` say what
   * to enter where a value cannot be given; `badStress`, what is wrong with a
   * stress that was entered and is not above zero — the field may also be
   * left empty, and the line says so.
   */
  sizing: {
    title: string;
    limit: string;
    stress: string;
    inertia: string;
    modulus: string;
    has: string;
    needE: string;
    needLimit: string;
    needStress: string;
    badStress: string;
    note: string;
  };
};

export const spanUi: Record<Lang, SpanUi> = {
  en: {
    simple: 'A single span, simply supported: a pin at the left end and a roller at the right end.',
    general: 'For other supports, internal hinges or applied moments:',
    generalLink: 'Open this beam in “Beam reactions and diagrams”',
    leftOut: 'The beam in this link has other supports, internal hinges or applied moments. This page leaves them out: below is the pin-and-roller span under that beam’s point and distributed loads only.',
    loads: {
      title: 'Load by load',
      load: 'Load',
      left: 'Left support',
      right: 'Right support',
      own: 'Beam’s own weight',
      all: 'All loads',
      note: 'Each load alone on the span; the rows add up to the last one, though each value is rounded on its own and the last figure of a sum may differ. The moment is read at the section where the moment of all the loads is largest, or at midspan when it is zero all along. Positive: an upward reaction, a sagging moment.',
      noteDeflection: 'The deflection is read where that of all the loads is largest, and is positive upward.',
    },
    sizing: {
      title: 'Section needed',
      limit: 'Deflection limit, L ÷',
      stress: 'Bending stress limit',
      inertia: 'Moment of inertia needed',
      modulus: 'Section modulus needed',
      has: 'the section entered has {value}',
      needE: 'Enter E to see the moment of inertia needed.',
      needLimit: 'Enter a deflection limit greater than zero.',
      needStress: 'Enter a bending stress limit to see the section modulus needed.',
      badStress: 'Enter a bending stress limit greater than zero, or leave the field empty.',
      note: 'From the largest deflection and E, and from the largest moment: elastic mechanics only. No design code, load factor or safety factor is applied, and comparing each value with the section is left to you.',
    },
  },
  es: {
    simple: 'Un solo vano, simplemente apoyado: un apoyo articulado en el extremo izquierdo y un rodillo en el derecho.',
    general: 'Para otros apoyos, rótulas internas o momentos aplicados:',
    generalLink: 'Abrir esta viga en «Reacciones y diagramas de vigas»',
    leftOut: 'La viga de este enlace tiene otros apoyos, rótulas internas o momentos aplicados. Esta página los omite: abajo está el vano con articulación y rodillo, solo con las cargas puntuales y distribuidas de esa viga.',
    loads: {
      title: 'Carga por carga',
      load: 'Carga',
      left: 'Apoyo izquierdo',
      right: 'Apoyo derecho',
      own: 'Peso propio de la viga',
      all: 'Todas las cargas',
      note: 'Cada carga sola sobre el vano; las filas suman la última, aunque cada valor se redondea por separado y la última cifra de una suma puede diferir. El momento se lee en la sección donde el momento de todas las cargas es máximo, o en el centro del vano si es nulo en todo él. Positivos: una reacción hacia arriba, un momento que comba la viga hacia abajo.',
      noteDeflection: 'La deflexión se lee donde la de todas las cargas es máxima, y es positiva hacia arriba.',
    },
    sizing: {
      title: 'Sección necesaria',
      limit: 'Límite de deflexión, L ÷',
      stress: 'Límite del esfuerzo de flexión',
      inertia: 'Momento de inercia necesario',
      modulus: 'Módulo de sección necesario',
      has: 'la sección introducida tiene {value}',
      needE: 'Introduzca E para ver el momento de inercia necesario.',
      needLimit: 'Introduzca un límite de deflexión mayor que cero.',
      needStress: 'Introduzca un límite del esfuerzo de flexión para ver el módulo de sección necesario.',
      badStress: 'Introduzca un límite del esfuerzo de flexión mayor que cero, o deje el campo vacío.',
      note: 'A partir de la deflexión máxima y de E, y del momento máximo: solo mecánica elástica. No se aplica ninguna norma de diseño ni factor de carga o de seguridad, y comparar cada valor con la sección le corresponde a usted.',
    },
  },
};
