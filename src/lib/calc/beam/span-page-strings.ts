import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings, type BeamPage } from './strings';

/**
 * The words of the single-span beam's PAGE (/resources/single-span-beam),
 * in English and in Spanish: what a search result shows, the hero, and the
 * notes under the tool. Read by the server view only (SingleSpanView). The
 * tool's own new words are in span-strings.ts and travel to the browser as
 * a prop; these never do.
 *
 * THE SAME SHAPE as the first calculator's page text (`BeamPage`,
 * strings.ts), because one view prints both (CalculatorPage). NOT the same
 * sentences: two pages that say one thing in the same words are, to a search
 * engine, one page twice. single-span.test.ts compares the two six words at
 * a time, and this page with its own line in the catalogue.
 *
 * THE LEGAL WORDS ARE SAID ONCE. The disclaimer, what the printed sheet is
 * called and the line in the margin of every printed page are the first
 * calculator's, taken by reference: a correction made there must not have a
 * second place to be made. Only the credit names this calculator.
 *
 * THE H1 IS THE CATALOGUE'S NAME AND TWO WORDS MORE. "Single-span beam" is
 * sixteen characters, and the owner's on-page check reports an H1 that
 * short as saying too little (seo.test.ts keeps the floor at 22, the
 * shortest it let pass). The two words are the ones an engineer looks this
 * case up by.
 *
 * THREE CLOSED FORMS close the method, for whoever wants to check the tool
 * before trusting it. They are in the method and not in a block of their
 * own because the method is the part of the page that is left off the
 * printed sheet (calc.css): a sheet has no use for them, a reader does.
 * single-span.test.ts solves each case with the engine and compares.
 *
 * Spanish as the first calculator writes it: "apoyo articulado", "rodillo",
 * "cortante", "momento flector", "deflexión", "vano", formal "usted".
 */
export type SpanPage = BeamPage;

export const spanPage: Record<Lang, SpanPage> = {
  en: {
    title: 'Simply Supported Beam Calculator: Deflection, Section Needed',
    description:
      'One simply supported span: reactions, diagrams and deflection, what each load adds to them, and the moment of inertia and section modulus needed.',
    h1: 'Single-span beam, simply supported',
    eyebrow: 'Calculator',
    sub: 'One simply supported span, a pin at one end and a roller at the other, carrying point loads and distributed loads. Beside the diagrams: what each load does on its own, and the section a deflection limit and a bending stress ask for.',
    facts: [
      { k: 'Supports', v: 'Pin and roller, at the ends' },
      { k: 'Loads', v: 'Point and distributed' },
      { k: 'Section needed', v: 'I for L/n, S for a stress' },
    ],
    toolHeading: 'The span',
    method: {
      label: 'Method',
      title: 'How the span is solved',
      paragraphs: [
        'This page runs the engine of Beam reactions and diagrams on one arrangement of supports: a pin at the left end of the span, a roller at the right, nothing between them. Such a span is statically determinate — equilibrium alone fixes its two reactions — and shear, moment and deflection follow as exact polynomials in x, with each largest value taken where it occurs.',
        'Load by load is superposition, which holds because the span is linear. Each load is placed on the span by itself and solved again; its row gives the two reactions it causes, the moment it causes at the section of the largest total moment, and the deflection it causes at the point of the largest total deflection. So the rows add up to the totals. They are not, in general, each load’s own largest values: those may occur at other sections.',
        'The two values under Section needed are mechanics and nothing more. Deflection is proportional to 1 ÷ EI, so the moment of inertia that holds the largest deflection to L/n comes from one solution and the modulus E, whether or not an I was entered. The section modulus is the largest moment divided by the bending stress you type. Each is printed beside what the section entered has; the comparison is yours. With a steel shape’s own weight included, both are for the weight of the shape chosen, not of a heavier one they may point to.',
        'Three cases to check it against by hand, L being the span.',
        'Uniform load w over the whole span: reactions wL/2; largest moment wL²/8 and largest deflection 5wL⁴/(384EI), both at midspan.',
        'Point load P at a from the left support and b from the right: reactions Pb/L and Pa/L; largest moment Pab/L, under the load.',
        'Load rising from zero at the left support to w at the right: reactions wL/6 and wL/3; largest moment wL²/(9√3), at L/√3 from the left.',
      ],
    },
    assumes: {
      title: 'What it assumes',
      items: [
        'A straight beam of a single span and constant section, simply supported: pinned at one end, on a roller at the other.',
        'Supports that neither settle nor resist rotation.',
        'Small deflections of an elastic material (Euler–Bernoulli): no shear deformation, no cracking, no creep.',
        'Vertical loads in the plane of bending; no axial force.',
        'Linear behaviour: the effects of the loads add.',
      ],
    },
    limits: {
      title: 'What it does not do',
      items: [
        'It checks nothing against a design code and gives no verdict: the needed values are mechanics for the limit and the stress you choose.',
        'One span only, with no overhang, fixed end, hinge or applied moment: the form links to the calculator that solves those, on this same beam.',
        'It uses the loads as entered, service or factored: a deflection limit and a stress may call for different combinations.',
        'Own weight counts only for a steel shape with its box ticked, and is that shape’s. For another section, add it as a load.',
      ],
    },
    signs: {
      title: 'Signs and units',
      items: [
        'Each load is a size and a direction; down is gravity.',
        'Positive shear pushes the left side of a cut upward. Positive moment sags the span, and plots above the axis.',
        'In the load-by-load table the values are signed: an upward load subtracts, and every column adds to its total, within the rounding of each value.',
        'L/n is the deflection allowed, the span over n: n = 360 on 24 ft is 0.8 in.',
        'Feet and kips or metres and kilonewtons; E and stresses in ksi or MPa; I in in⁴ or 10⁶ mm⁴, S in in³ or 10³ mm³.',
      ],
    },
    disclaimer: beamStrings.en.page.disclaimer,
    sheet: {
      kind: beamStrings.en.page.sheet.kind,
      credit: 'Produced with the single-span beam calculator of {firm} — {address}',
      margin: beamStrings.en.page.sheet.margin,
    },
    back: 'All calculators',
    noscript: 'With scripts off this page shows its example and cannot respond: the span is solved in the browser, and nothing typed leaves it.',
  },
  es: {
    title: 'Calculadora de viga simplemente apoyada: sección necesaria',
    description:
      'Un vano simplemente apoyado: reacciones, diagramas y deflexión, lo que aporta cada carga, y el momento de inercia y el módulo de sección necesarios.',
    h1: 'Viga de un solo vano, simplemente apoyada',
    eyebrow: 'Calculadora',
    sub: 'Un vano simplemente apoyado, con un apoyo articulado en un extremo y un rodillo en el otro, bajo cargas puntuales y cargas distribuidas. Junto a los diagramas: lo que hace cada carga por separado, y la sección que piden un límite de deflexión y un esfuerzo de flexión.',
    facts: [
      { k: 'Apoyos', v: 'Articulado y rodillo, en los extremos' },
      { k: 'Cargas', v: 'Puntuales y distribuidas' },
      { k: 'Sección necesaria', v: 'I para L/n, S para un esfuerzo' },
    ],
    toolHeading: 'El vano',
    method: {
      label: 'Método',
      title: 'Cómo se resuelve el vano',
      paragraphs: [
        'Esta página usa el motor de Reacciones y diagramas de vigas con una sola disposición de apoyos: un apoyo articulado en el extremo izquierdo del vano, un rodillo en el derecho y nada entre ambos. Un vano así es isostático — el equilibrio basta para fijar sus dos reacciones — y el cortante, el momento flector y la deflexión resultan polinomios exactos en x; cada valor máximo se toma donde ocurre.',
        'La tabla carga por carga es superposición, válida porque el vano es lineal. Cada carga se coloca sola sobre el vano y se resuelve de nuevo; su fila da las dos reacciones que produce, el momento que produce en la sección del momento total máximo y la deflexión que produce en el punto de la deflexión total máxima. Por eso las filas suman los totales. En general no son los máximos propios de cada carga, que pueden ocurrir en otras secciones.',
        'Los dos valores de Sección necesaria son mecánica y nada más. La deflexión es proporcional a 1 ÷ EI, de modo que el momento de inercia que limita la deflexión máxima a L/n sale de una sola solución y del módulo E, se haya introducido o no un valor de I. El módulo de sección es el momento máximo dividido entre el esfuerzo de flexión que usted escribe. Cada uno aparece junto a lo que tiene la sección introducida; la comparación le corresponde a usted. Con el peso propio de un perfil de acero incluido, ambos corresponden al peso del perfil elegido, no al de uno más pesado al que apunten.',
        'Tres casos para comprobarla a mano, con L como longitud del vano.',
        'Carga uniforme w en todo el vano: reacciones wL/2; momento máximo wL²/8 y deflexión máxima 5wL⁴/(384EI), ambos en el centro del vano.',
        'Carga puntual P a una distancia a del apoyo izquierdo y b del derecho: reacciones Pb/L y Pa/L; momento máximo Pab/L, bajo la carga.',
        'Carga que crece de cero en el apoyo izquierdo a w en el derecho: reacciones wL/6 y wL/3; momento máximo wL²/(9√3), a L/√3 del apoyo izquierdo.',
      ],
    },
    assumes: {
      title: 'Qué supone',
      items: [
        'Una viga recta de un solo vano y sección constante, simplemente apoyada: articulada en un extremo, sobre un rodillo en el otro.',
        'Ningún apoyo se asienta ni impide el giro.',
        'Deflexiones pequeñas de un material elástico (Euler–Bernoulli): sin deformación por cortante, sin fisuración ni fluencia lenta.',
        'Cargas verticales en el plano de flexión; sin fuerza axial.',
        'Comportamiento lineal: los efectos de las cargas se suman.',
      ],
    },
    limits: {
      title: 'Qué no hace',
      items: [
        'No comprueba nada con una norma de diseño ni emite un veredicto: los valores necesarios son mecánica para el límite y el esfuerzo que usted elige.',
        'Un solo vano, sin voladizos, empotramientos, rótulas ni momentos aplicados: el formulario enlaza con la calculadora que los resuelve, con esta misma viga.',
        'Usa las cargas tal como se introducen, sean de servicio o mayoradas: el límite de deflexión y el esfuerzo pueden pedir combinaciones distintas.',
        'El peso propio solo cuenta con un perfil de acero y su casilla marcada, y es el de ese perfil. Con otra sección, añádalo como carga.',
      ],
    },
    signs: {
      title: 'Signos y unidades',
      items: [
        'Cada carga es una magnitud y un sentido; hacia abajo es la gravedad.',
        'El cortante positivo empuja hacia arriba el lado izquierdo de un corte. El momento positivo comba el vano hacia abajo, y se traza por encima del eje.',
        'En la tabla carga por carga los valores llevan signo: una carga hacia arriba resta, y cada columna suma su total, salvo el redondeo de cada valor.',
        'L/n es la deflexión admitida, el vano entre n: n = 360 en 24 ft son 0.8 in.',
        'Pies y kips o metros y kilonewtons; E y los esfuerzos en ksi o MPa; I en in⁴ o 10⁶ mm⁴, S en in³ o 10³ mm³.',
      ],
    },
    disclaimer: beamStrings.es.page.disclaimer,
    sheet: {
      kind: beamStrings.es.page.sheet.kind,
      credit: 'Elaborada con la calculadora de viga de un solo vano de {firm} — {address}',
      margin: beamStrings.es.page.sheet.margin,
    },
    back: 'Todas las calculadoras',
    noscript: 'Sin scripts esta página muestra su ejemplo y no responde: el vano se resuelve en el navegador y nada de lo escrito sale de él.',
  },
};
