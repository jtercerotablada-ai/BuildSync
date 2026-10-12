import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings, type BeamPage } from '../beam/strings';

/**
 * The words of the continuous beam's PAGE (/resources/continuous-beam), in
 * English and in Spanish: what a search result shows, the hero, and the
 * notes under the tool. Read by the server view only (ContinuousBeamView).
 * The tool's own words are in strings.ts and travel to the browser as a
 * prop; these never do.
 *
 * THE SAME SHAPE as the first calculator's page text (`BeamPage`,
 * beam/strings.ts), because one view prints all three (CalculatorPage). NOT
 * the same sentences: no run of six words here is on either of the other
 * two pages, nor in this page's own line of the catalogue
 * (continuous-beam.test.ts compares them).
 *
 * THE LEGAL WORDS ARE SAID ONCE. The disclaimer, what the printed sheet is
 * called and the line in the margin of every printed page are the first
 * calculator's, taken by reference, as the second calculator takes them.
 * Only the credit names this calculator.
 *
 * WHAT THE METHOD HAS TO SAY THAT THE OTHER TWO DID NOT. The catalogue calls
 * this calculator "solved by finite elements", and the first calculator's
 * page says of itself that it has no mesh. Both are true, and an engineer
 * who reads the two is owed the reason: the fourth paragraph gives it. The
 * rest is the engine (engine.ts) and the arrangements of the live load
 * (envelope.ts) in an engineer's words. continuous-beam.test.ts holds what
 * these sentences claim to what those two files do — the behaviour and,
 * where a word could be turned round with the behaviour untouched (a
 * direction, a sign, dead or live), the clause itself, in both languages —
 * and solves the four closed forms that close the method to compare them
 * with the fractions printed here.
 *
 * "FREE" on this page is an end of the beam that nothing holds, and never a
 * price: the test that keeps prices off the calculators' pages knows the
 * difference.
 *
 * THE FORM'S WORDS FOR THE FORM'S THINGS. Where a note speaks of a field or
 * a card, it calls it what the form calls it (strings.ts): "stiffness
 * factor", "settlement", "dead load" and "live load", "in every
 * arrangement", "largest sagging moment". The test holds the two files to
 * the same words, and to no sentence in common.
 *
 * Spanish as the first calculator writes it: "apoyo", "empotrado",
 * "voladizo", "cortante", "momento flector", "deflexión", "vano", formal
 * "usted". A sagging moment is "momento positivo", as in that calculator's
 * tables; an arrangement of the live load is a "disposición", the word
 * design codes in Spanish give it, and the page says "en cada disposición"
 * because the form's choice is labelled so.
 */
export type ContinuousPage = BeamPage;

export const continuousPage: Record<Lang, ContinuousPage> = {
  en: {
    title: 'Continuous Beam Calculator: Moments and Live Load Patterns',
    description:
      'A continuous beam entered span by span: support moments, reactions and deflection, with the live load in every arrangement and supports that may settle.',
    h1: 'Continuous beam over several supports',
    eyebrow: 'Calculator',
    sub: 'One span or several, up to eight, entered one by one: each with its own stiffness, on supports that may settle. The live load can be taken in every arrangement; each diagram is then the band between its two extremes, and each largest value names the spans loaded to cause it.',
    facts: [
      { k: 'Ends', v: 'Simple support, fixed or free' },
      { k: 'Live load', v: 'In every arrangement' },
      { k: 'Method', v: 'Direct stiffness' },
    ],
    toolHeading: 'The continuous beam',
    method: {
      label: 'Method',
      title: 'How the continuous beam is solved',
      paragraphs: [
        'The beam is solved by the direct stiffness method, with one beam element for each span. Every joint, an end of a span, has two displacements: its deflection and its rotation. At a support the deflection is known — zero, or the settlement entered — and at a fixed end so is the rotation. The rotations that remain are the unknowns, with one equation each: the end moments of the spans meeting at that support add up to zero.',
        'The loads on a span enter those equations as its fixed-end moments, in closed form: a point load P, a from one end and b from the other, gives Pab²/L² at the first, and a load varying linearly over any part of the span gives that expression integrated. A settlement enters the same way: a span with one support settling δ more than the other, its ends held against rotation, takes 6kEIδ/L² at each end, k being its stiffness factor. An end span whose end is free is a cantilever from its support; statics gives the moment it brings there, and it adds no unknown.',
        'With its two end moments known, each span is a simply supported beam under its own loads and those two moments, and shear, moment, slope and deflection inside it are closed forms worked out at the point asked for. Nothing is interpolated between joints. A largest value that falls between two loads or supports is located on the polynomial itself, where its derivative changes sign, and worked out there.',
        'For a beam, this is the finite element method, with a span for an element. And one element per span loses nothing. A mesh is approximate when its elements cannot take the true deflected shape. A beam element of constant stiffness can: between two joints an unloaded span bends into a cubic, which is the element’s own shape, and what the loads add inside the span is put back in closed form. Beam reactions and diagrams reaches the same result with no elements at all, as its page says; on a beam that both can describe, the two calculators agree, except where a value is so small that the other page prints it as 0.',
        'Taking the live load in every arrangement — pattern loading — means each span’s live load is on that span or off it, whatever the others carry: 2ⁿ arrangements for n spans with live load, 256 for eight. Dead loads and settlements are in all of them.',
        'The beam being linear, the arrangements are not solved one by one. It is solved once under what is always there and once under each span’s live load alone. At any point the highest value of a response is the first of those plus every span’s effect that raises it there, and the lowest is the first plus every effect that lowers it: the extremes of all the arrangements, exactly.',
        'Each largest value over the arrangements comes with the spans whose live load is on when it occurs. A span whose live load has no effect on a value is not listed with it: no load on another span puts shear or moment in an overhang, for one.',
        'Four results to verify by hand: equal spans L of one stiffness EI, on simple supports.',
        'Two spans under a uniform load w: −wL²/8 over the middle support; reactions 3wL/8, 5wL/4 and 3wL/8; largest sagging moment 9wL²/128, at 3L/8 from each end.',
        'Three spans under w: −wL²/10 over each interior support; reactions 2wL/5, 11wL/10, 11wL/10 and 2wL/5; largest sagging moments 2wL²/25 in the end spans and wL²/40 in the middle one.',
        'Two unloaded spans whose middle support settles by δ: a sagging moment 3EIδ/L² over it; each end reaction rises by 3EIδ/L³ and the middle one falls by 6EIδ/L³.',
        'Two spans with a live load w in every arrangement: largest sagging moment 49wL²/512, at 7L/16 from an end, with that span alone loaded; −wL²/8 over the middle support with both.',
      ],
    },
    assumes: {
      title: 'What it assumes',
      items: [
        'A straight beam with no internal hinge, continuous over every support between two spans. Each span has one flexural stiffness along its length: the section’s EI times that span’s factor.',
        'Every joint between two spans is a simple support. Each end of the beam is on a simple support, fixed, or free.',
        'Rigid supports: one moves only by the settlement entered for it, and a simple support does not restrain rotation.',
        'Small deflections of a linear elastic material in bending (Euler–Bernoulli), with shear deformation left out.',
        'Vertical loads only, and so no axial force. The effects of loads add, which is what allows the arrangements to be combined.',
      ],
    },
    limits: {
      title: 'What it does not do',
      items: [
        'It applies no design code and no load factor, and gives no verdict. Dead and live loads are used as entered, and an arrangement is their plain sum.',
        'A span’s live load is all on or all off: no part of it is taken on its own, and a moving load is not followed along the beam.',
        'One stiffness for each span, and the factor is yours: a section that changes within a span is not modelled, and no factor is derived for a cracked or a deeper one.',
        'No internal hinges and no applied moments. Beam reactions and diagrams has both, and the form links to it with this beam when that calculator can hold it.',
        'No spring supports. A settlement is a length you enter, not one the page works out, and it needs E and I to become forces.',
        'Stresses are of the section entered: M/S in bending and, for shear, the rule printed with the value — V over a shear area, 1.5V/A for a rectangle. Where any span’s stiffness factor is not 1, that span is another section and no stress is printed at all.',
        'A span under 1/1000 of the whole length, or a stiffness factor outside 0.001 to 1,000, is refused: the form marks the entry and no result is shown.',
        'With a steel shape and its own-weight box ticked, that weight is a dead load on every span. For any other section, enter it as dead load.',
      ],
    },
    signs: {
      title: 'Signs and units',
      items: [
        'Each span’s two uniform loads, dead and live, are positive downward: a minus sign turns one upward. The further loads have a direction of their own, and each is marked dead or live.',
        'A further load is placed from the left end of its own span, not of the beam. In the results x runs along the whole beam, from its left end.',
        'A settlement is entered as a length downward, in inches or millimetres; the support’s deflection is then that length, downward.',
        'A sagging moment is positive, so the hogging moment that gravity loads usually cause over an interior support is negative; an arrangement of the live load, or an overhang, can make the moment there positive. Shear is positive when the forces to the left of a cut add up to an upward one.',
        'The deflection of a span is measured from the straight line through its two supports, so that a settlement is not counted as bending; an overhang’s is measured from its support. The deflection diagram, the largest deflection and the one at a point are the movement of the beam itself, a settlement included. Where a deflection is printed with a sign, upward is positive; a slope is positive counter-clockwise, in radians.',
        'With the live load in every arrangement a diagram is a band. Its upper edge is the highest value at each point and its lower edge the lowest; the two edges, and two points of one edge, are in general from different arrangements.',
        'Spans and positions in feet or metres, loads in kips or kilonewtons; a settlement, like the section, in inches or millimetres. A stiffness factor has no unit.',
      ],
    },
    disclaimer: beamStrings.en.page.disclaimer,
    sheet: {
      kind: beamStrings.en.page.sheet.kind,
      credit: 'Produced with the continuous beam calculator of {firm} — {address}',
      margin: beamStrings.en.page.sheet.margin,
    },
    back: 'All calculators',
    noscript: 'Without scripts this page stays on its example and does not respond: the beam is solved in your browser, and what you type is sent nowhere.',
  },
  es: {
    title: 'Calculadora de viga continua: momentos y carga viva alternada',
    description:
      'Una viga continua introducida vano a vano: momentos en los apoyos, reacciones y deflexión, con la carga viva en cada disposición y asentamientos de apoyo.',
    h1: 'Viga continua sobre varios apoyos',
    eyebrow: 'Calculadora',
    sub: 'Un vano o varios, hasta ocho, introducidos uno a uno: cada uno con su propia rigidez, sobre apoyos que pueden asentarse. La carga viva puede tomarse en cada disposición; cada diagrama es entonces la banda entre sus dos extremos, y cada valor máximo indica los vanos cargados que lo producen.',
    facts: [
      { k: 'Extremos', v: 'Apoyo simple, empotrado o libre' },
      { k: 'Carga viva', v: 'En cada disposición' },
      { k: 'Método', v: 'Directo de la rigidez' },
    ],
    toolHeading: 'La viga continua',
    method: {
      label: 'Método',
      title: 'Cómo se resuelve la viga continua',
      paragraphs: [
        'La viga se resuelve por el método directo de la rigidez, con un elemento de viga por cada vano. Cada nudo, un extremo de vano, tiene dos desplazamientos: su deflexión y su giro. En un apoyo la deflexión es conocida — cero, o el asentamiento introducido — y en un extremo empotrado lo es también el giro. Los giros restantes son las incógnitas, con una ecuación para cada uno: los momentos de extremo de los vanos que concurren en ese apoyo suman cero.',
        'Las cargas de un vano entran en esas ecuaciones como sus momentos de empotramiento perfecto, en forma cerrada: una carga puntual P situada a la distancia a de un extremo y b del otro da Pab²/L² en el primero, y una carga que varía linealmente sobre cualquier parte del vano da esa misma expresión integrada. Un asentamiento entra del mismo modo: un vano con uno de sus apoyos asentado δ más que el otro, y con el giro de sus extremos impedido, recibe 6kEIδ/L² en cada extremo, siendo k su factor de rigidez. Un vano extremo cuyo extremo queda libre es un voladizo desde su apoyo; la estática da el momento que lleva a ese apoyo, y no añade ninguna incógnita.',
        'Conocidos sus dos momentos de extremo, cada vano es una viga simplemente apoyada con sus propias cargas y esos dos momentos, y dentro de él el cortante, el momento, el giro y la deflexión son fórmulas cerradas evaluadas en el punto pedido. No se interpola nada entre nudos. Un valor máximo que cae entre dos cargas o apoyos se localiza sobre el propio polinomio, donde su derivada cambia de signo, y se evalúa allí.',
        'Para una viga, esto es el método de los elementos finitos, con un vano por elemento. Y con un elemento por vano no se pierde nada. Una malla es aproximada cuando sus elementos no pueden adoptar la deformada real. Un elemento de viga de rigidez constante sí puede: entre dos nudos, un vano sin carga se deforma según una cúbica, que es la forma propia del elemento, y lo que las cargas añaden dentro del vano se repone en forma cerrada. Reacciones y diagramas de vigas llega al mismo resultado sin ningún elemento, como dice su página; en una viga que ambas pueden describir, las dos calculadoras coinciden, salvo donde un valor es tan pequeño que la otra página lo da como 0.',
        'Tomar la carga viva en cada disposición — la alternancia de cargas — significa que la carga viva de cada vano está en ese vano o no está, lleven lo que lleven los demás: 2ⁿ disposiciones para n vanos con carga viva, 256 para ocho. Las cargas muertas y los asentamientos están en todas.',
        'Como la viga es lineal, las disposiciones no se resuelven una por una. Se resuelve una vez con lo que siempre está y una vez con la carga viva de cada vano por separado. En cualquier punto, el valor más alto de una respuesta es el primero de esos resultados más el efecto de cada vano que lo aumenta allí, y el más bajo es el primero más cada efecto que lo reduce: los extremos de todas las disposiciones, exactamente.',
        'Cada valor máximo entre las disposiciones va acompañado de los vanos cuya carga viva está presente cuando ocurre. Un vano cuya carga viva no tiene efecto sobre un valor no figura junto a él: ninguna carga de otro vano, por ejemplo, produce cortante ni momento en un voladizo.',
        'Cuatro resultados para verificar a mano: vanos iguales de longitud L y una misma rigidez EI, sobre apoyos simples.',
        'Dos vanos con una carga uniforme w: −wL²/8 sobre el apoyo central; reacciones 3wL/8, 5wL/4 y 3wL/8; momento positivo máximo 9wL²/128, a 3L/8 de cada extremo.',
        'Tres vanos con w: −wL²/10 sobre cada apoyo intermedio; reacciones 2wL/5, 11wL/10, 11wL/10 y 2wL/5; momentos positivos máximos 2wL²/25 en los vanos extremos y wL²/40 en el central.',
        'Dos vanos sin carga cuyo apoyo central se asienta δ: un momento positivo 3EIδ/L² sobre él; cada reacción extrema aumenta 3EIδ/L³ y la central disminuye 6EIδ/L³.',
        'Dos vanos con una carga viva w en cada disposición: momento positivo máximo 49wL²/512, a 7L/16 de un extremo, con solo ese vano cargado; −wL²/8 sobre el apoyo central con ambos.',
      ],
    },
    assumes: {
      title: 'Qué supone',
      items: [
        'Una viga recta sin rótulas internas, continua sobre cada apoyo entre dos vanos. Cada vano tiene una sola rigidez a flexión en toda su longitud: el EI de la sección por el factor de ese vano.',
        'Cada nudo entre dos vanos es un apoyo simple. Cada extremo de la viga está sobre un apoyo simple, empotrado o libre.',
        'Apoyos rígidos: cada uno se mueve únicamente lo que indique el asentamiento introducido para él, y un apoyo simple no impide el giro.',
        'Flexión elástica lineal con deflexiones pequeñas (Euler–Bernoulli); la deformación por cortante queda fuera.',
        'Solo cargas verticales, y por tanto sin fuerza axial. Lo que hace cada carga se suma a lo de las demás, y eso es lo que permite combinar las disposiciones.',
      ],
    },
    limits: {
      title: 'Qué no hace',
      items: [
        'No aplica normas de diseño ni mayora las cargas, y no emite veredicto alguno. Las cargas muertas y vivas se usan tal como se introducen, y una disposición es su suma sin más.',
        'Cada vano tiene su carga viva entera o no la tiene: no se toma por separado una parte de ella, ni se sigue una carga móvil a lo largo de la viga.',
        'Una rigidez por vano, y el factor lo pone usted: no se modela una sección que cambia dentro de un vano, ni se deduce el factor de una sección fisurada o de mayor altura.',
        'Sin rótulas internas ni momentos aplicados. Reacciones y diagramas de vigas admite ambos, y el formulario lleva esta viga a esa calculadora cuando puede representarla.',
        'Sin apoyos elásticos. Un asentamiento es una longitud que usted introduce, no una que la página calcule, y necesita E e I para convertirse en fuerzas.',
        'Los esfuerzos son los de la sección introducida: M/S en flexión y, para el cortante, la regla que se indica junto al valor — V entre un área de cortante, 1.5V/A en un rectángulo. Si el factor de rigidez de algún vano no es 1, ese vano es otra sección y no se da ningún esfuerzo en toda la viga.',
        'Un vano menor que 1/1000 de la longitud total, o un factor de rigidez fuera del intervalo de 0.001 a 1000, se rechaza: el formulario señala el dato y no se muestra ningún resultado.',
        'Elegido un perfil de acero, con la casilla de su peso propio marcada, ese peso es una carga muerta en todos los vanos. Con cualquier otra sección, introdúzcalo como carga muerta.',
      ],
    },
    signs: {
      title: 'Signos y unidades',
      items: [
        'Las dos cargas uniformes de cada vano, la muerta y la viva, son positivas hacia abajo: con signo menos, una actúa hacia arriba. Las cargas adicionales tienen su propio sentido, y cada una se marca como muerta o viva.',
        'Una carga adicional se sitúa desde el extremo izquierdo de su propio vano, no de la viga. En los resultados, x recorre toda la viga desde su extremo izquierdo.',
        'Un asentamiento se introduce como una longitud hacia abajo, en pulgadas o milímetros; la deflexión del apoyo es entonces esa longitud, hacia abajo.',
        'Un momento positivo comba la viga hacia abajo, de modo que el momento que las cargas de gravedad suelen producir sobre un apoyo intermedio es negativo; una disposición de la carga viva, o un voladizo, puede volverlo positivo. El cortante es positivo cuando las fuerzas a la izquierda de un corte suman una fuerza hacia arriba.',
        'La deflexión de un vano se mide respecto a la recta que une sus dos apoyos, para que un asentamiento no cuente como flexión; la de un voladizo, respecto a su apoyo. El diagrama de deflexión, la deflexión máxima y la de un punto son el movimiento de la propia viga, asentamientos incluidos. Donde una deflexión lleva signo, hacia arriba es positivo; un giro es positivo en sentido antihorario, en radianes.',
        'Con la carga viva en cada disposición, un diagrama es una banda. Su borde superior es el valor más alto en cada punto y el inferior el más bajo; los dos bordes, y dos puntos de un mismo borde, corresponden en general a disposiciones distintas.',
        'Vanos y posiciones en pies o metros, cargas en kips o kilonewtons; un asentamiento, igual que la sección, se da en pulgadas o en milímetros. Un factor de rigidez no tiene unidad.',
      ],
    },
    disclaimer: beamStrings.es.page.disclaimer,
    sheet: {
      kind: beamStrings.es.page.sheet.kind,
      credit: 'Elaborada con la calculadora de viga continua de {firm} — {address}',
      margin: beamStrings.es.page.sheet.margin,
    },
    back: 'Todas las calculadoras',
    noscript: 'Sin scripts esta página se queda en su ejemplo y no responde: la viga se resuelve en su navegador, y lo que usted escribe no se envía a ninguna parte.',
  },
};
