import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings, type BeamPage } from '../beam/strings';

/**
 * The words of the truss calculator's PAGE (/resources/truss-member-forces),
 * in English and in Spanish: what a search result shows, the hero, and the
 * notes under the tool. Read by the server view only (TrussView). The tool's
 * own words are in strings.ts and travel to the browser as a prop; these never
 * do.
 *
 * THE SAME SHAPE as the first calculator's page text (`BeamPage`,
 * beam/strings.ts), because one view prints all the calculators
 * (CalculatorPage). That shape has four lists of notes, and this page puts
 * its sections in them like this:
 *   - `method`  how the truss is solved, what the results mean (equilibrium
 *               check, stress, elongation, zero-force members), the starting
 *               shapes (templates), and two cases to check the page by hand;
 *   - `assumes` what the model takes to be true of the truss;
 *   - `limits`  what it leaves out, what it refuses and the limits of size;
 *   - `signs`   signs, units, and how to read each column of results.
 * NOT the same sentences: no run of six words here is on any other
 * calculator's page, in its form, or in the catalogue's line for this one
 * (views/truss.test.ts compares them).
 *
 * THE LEGAL WORDS ARE SAID ONCE. The disclaimer, what the printed sheet is
 * called and the line in the margin of every printed page are the first
 * calculator's, taken by reference, as the others take them. Only the credit
 * names this calculator.
 *
 * WHAT THE NOTES ARE HELD TO. The engine (engine.ts), the form's model
 * (model.ts) and the templates (templates.ts): views/truss.test.ts solves
 * the two cases printed under "How the truss is solved" with the engine and
 * compares them with the formulas written here.
 *
 * WHAT IT IS NOT IS SAID AS PLAINLY AS WHAT IT IS. A truss is an idealisation:
 * pins, loads at the joints, small displacements. The page gives member
 * forces; it does not size a member, check buckling, design a connection or
 * apply a code, and it names none. Words of verdict ("adequate", "safe",
 * "passes") and any figure that is not in a formula are held out by the test.
 *
 * Spanish as a Latin-American structural engineer writes it: "cercha", "barra",
 * "nudo", "apoyo articulado", "apoyo de rodillo", "tensión" and "compresión"
 * for the kind of force, "esfuerzo" for stress, formal "usted".
 */
export type TrussPage = BeamPage;

export const trussPage: Record<Lang, TrussPage> = {
  en: {
    title: 'Truss Member Forces Calculator: Tension and Compression',
    description:
      'Axial force in every member of a 2D pin-jointed truss, in tension or compression, with the support reactions, by joint equilibrium and the direct stiffness method.',
    h1: 'Truss member forces in a plane',
    eyebrow: 'Calculator',
    sub: 'A plane truss of straight members pinned at the joints, held by pins and rollers and loaded at the joints. The axial force in every member, in tension or in compression; what each support pushes back with; and, once each member has a section, its stress, its elongation and how far every joint moves.',
    facts: [
      { k: 'Truss', v: 'Pin-jointed' },
      { k: 'Loads', v: 'At the joints' },
      { k: 'Results', v: 'Force in every member' },
    ],
    toolHeading: 'The truss',
    method: {
      label: 'Method',
      title: 'How the truss is solved',
      paragraphs: [
        'A joint is called a node in the tool below, and a node’s number is its place in the list. A member pinned at both ends, with no load along it, can carry a force along its own axis and nothing else. Each member therefore stands for one unknown, its axial force N, positive in tension. Every joint, with its loads and the pull or push of each member that meets there, must be in equilibrium: the forces on it add up to zero in x and in y. With j joints that is 2j equations, and the unknowns are the m member forces and the r reactions of the supports.',
        'When m + r = 2j and the truss is stable, there are as many equations as unknowns and equilibrium alone gives every force. That is what the method of joints does by hand, one joint at a time; here all the joints are solved together. The section and the modulus of a member appear nowhere in that solution: a statically determinate truss carries the same forces in steel as in aluminium, and in any size of section. They are asked for only to work out stress, elongation and displacement afterwards.',
        'When m + r is greater than 2j the truss is statically indeterminate: equilibrium no longer says how the load is shared. The direct stiffness method adds the compatibility that is missing. The unknowns are the displacements of the joints; a member whose ends move apart along its axis by δ carries N = (EA/L)δ, for a length L, a modulus E and an area A; and the stiffness matrix of the truss is the sum of the members’ own. Solving that system gives the displacements, then every N. The forces now depend on how the members’ EA/L compare with one another: raising every EA by the same factor changes no force. If only some members are given a section, the calculator takes EA as the same in all of them and says so.',
        'A pin holds its joint against moving in either direction and so gives two components of reaction. A roller holds it against moving along one line only, and gives one force along that line. A roller of any angle is treated exactly, by taking its joint’s displacement along the line it leaves open; no stiff spring stands in for it.',
        'Before any solving, the calculator asks whether the truss could shift while every member keeps its length, which depends on the geometry and the supports and never on E and A. If it can, because a panel has no diagonal, or the supports hold it in too few directions, or part of it can swing on its own, no force is given: the joints that can move are named. Counting m + r against 2j does not settle it, as a truss can meet that count and still be a mechanism.',
        'The page also lists the members that carry nothing by inspection. At an unloaded joint with no support, two members that are not on one line both carry zero; and when an unloaded joint with no support has two members along one line and a third across them, that third carries zero. Those members are then set aside and the rule is applied again at the next joint, so the list can run on.',
        'Equilibrium of the whole is checked on the answer: the loads and the reactions together are summed in x, in y and in moment about the centre of the truss, and the largest force left unbalanced at any joint is found. Each is rounding, and an answer for which they are not is withheld.',
        'The shapes offered to start from (triangle, king post, queen post, Pratt, Howe, Warren with and without verticals, Fink, and a cantilever from a wall) fill the form with joints, members, supports and loads for a span, a depth and a number of panels. The bottom chord lies on y = 0. The load you enter is the one on each joint along the top chord, with half of it on the joint at either end, where the chord has one; the supports are either a pin on the left with a roller on the right, or its mirror, or a pin on each side. In a Pratt truss the diagonals slope down towards the middle and in a Howe truss up towards it. A value a shape cannot be built with, such as an odd number of panels for a Pratt truss, is replaced by the nearest it can, and the form says what it changed. Everything is editable afterwards: a shape is a starting point and not a recommendation.',
        'Two cases with a closed form, to hold the answers against.',
        'A triangle of span L and height h, with a load P at the apex and a pin and a roller at the ends: each reaction is P/2; each rafter is in compression by Ps/(2h), where s = √((L/2)² + h²) is its length; the tie along the bottom is in tension by PL/(4h).',
        'A vertical bar and two bars inclined at an angle θ either side of it, all of the same EA, joining a loaded joint to three pinned supports on a line: with a load P down on that joint, the vertical bar carries P/(1 + 2cos³θ) and each inclined one Pcos²θ/(1 + 2cos³θ), all in tension. Statics alone cannot give these three numbers; the shorter bar takes the most.',
      ],
    },
    assumes: {
      title: 'What it assumes',
      items: [
        'A plane truss: all the joints, members and loads in one plane. Nothing is checked for the truss to stay in that plane.',
        'Every joint is a frictionless pin, so a member carries axial force alone. A joint that is welded, gusseted or a chord continuous through it carries some bending in a real truss, and the moments that come from it are not found here.',
        'Loads act at the joints. A load along a member, such as a purlin between joints or the member’s own weight, is moved by you to the joints on either side; the weight of the members is a load only if you enter it.',
        'Supports are pins and rollers that do not give. A support that settles, or one that is a spring, is not offered.',
        'The material is linear elastic, and the displacements are so small that the equations are written on the truss as drawn. Each member has an area and a modulus, taken from the form’s own when a member has none of its own.',
        'The load is static and applied once: nothing of its history, its dynamics or its repetition is in the answer.',
      ],
    },
    limits: {
      title: 'What it leaves out',
      items: [
        'It gives forces and nothing else about design: no code is applied, no load is factored, and nothing is said of whether a member will do. That is yours to decide.',
        'No buckling. A long, slender member in compression can buckle at a force well under the one its stress would suggest; its slenderness, its end conditions and its bracing are not read, and a stress here is the plain force over the area.',
        'No member and no connection is sized: gusset plates, bolts, welds, the bearing at a support and the eccentricity at a joint are outside it.',
        'First order only. Equilibrium is written on the truss as drawn, and the effect of the joints moving on the forces is left out.',
        'No temperature change, no member made too long or too short, and no settlement of a support. In an indeterminate truss each of these would change the forces.',
        'A truss that can move is not solved. A joint of two members on one line, with no third member and no support, is a mechanism and is refused, whatever load is put on it; so is a truss the supports hold in too few directions.',
        'Two joints at one place, a member of no length, a member between two joints that already have one, a joint that no member reaches, and a truss in separate pieces each get a flag on their row, and no result is shown until they are put right.',
        'An indeterminate truss whose members differ in stiffness by many orders of magnitude may be refused, since its forces would not be right to the figures shown. A determinate one is not affected.',
        'Up to 40 joints, 120 members, 40 supports and 80 loads. Past any of these the row is not added and the form says so.',
      ],
    },
    signs: {
      title: 'Signs, units and reading the results',
      items: [
        'A force in a member is positive in tension, where the member pulls on its two joints, and negative in compression, where it pushes on them. A member whose force is nothing is listed as zero.',
        'x runs to the right and y upward. Joints and members are numbered from 1, in the order of their rows; a member is named by the two joints it joins.',
        'A load is a component in x and one in y, positive to the right and upward. Gravity is therefore a negative y component.',
        'A reaction is the force the support exerts on the truss, positive to the right and upward, so a truss resting on its supports has upward reactions. A pin gives a component in x and one in y; a roller gives one force along its line.',
        'A roller’s angle is in degrees, counter-clockwise from the positive x axis, and is the line its reaction acts along: 90 is the usual roller under a truss, with a vertical reaction; 0 is a roller against a wall, with a horizontal one. The force along the line is positive in the direction the angle points.',
        'Stress is a member’s force over its area, positive in tension. Elongation is NL/(EA), positive when the member lengthens. A joint’s displacement is given in x and in y only when every member has an area and a modulus.',
        'The equilibrium check lists what is left when loads and reactions are added: the sums in x, in y and in moment, and the largest unbalanced force at a joint. They are rounding.',
        'US units are feet and kips for geometry and forces, square inches for areas and ksi for the modulus; stress is in ksi and elongation and displacement in inches. SI units are metres and kilonewtons, square millimetres and GPa; stress is in MPa, elongation and displacement in millimetres.',
        'The case you set up is kept in the address of the page, after #t=, and that address reopens it.',
      ],
    },
    disclaimer: beamStrings.en.page.disclaimer,
    sheet: {
      kind: beamStrings.en.page.sheet.kind,
      credit: 'Produced with the truss calculator of {firm} — {address}',
      margin: beamStrings.en.page.sheet.margin,
    },
    back: 'All calculators',
    noscript: 'Without scripts this page can only show its example; it cannot answer. With them, your own browser works out the truss and nothing you type leaves it.',
  },
  es: {
    title: 'Calculadora de cerchas planas: fuerzas en las barras',
    description:
      'Fuerza axial en cada barra de una cercha plana articulada, a tensión o a compresión, con las reacciones de los apoyos, por equilibrio de nudos y rigidez directa.',
    h1: 'Fuerzas en barras de cerchas planas',
    eyebrow: 'Calculadora',
    sub: 'Una cercha plana de barras rectas articuladas en los nudos, sostenida por apoyos articulados y de rodillo y cargada en los nudos. Cuánto tira o cuánto empuja cada barra sobre sus nudos, es decir su fuerza axial; lo que devuelve cada apoyo; y, cuando cada barra tiene su sección, su esfuerzo, su alargamiento y cuánto se desplaza cada nudo.',
    facts: [
      { k: 'Cercha', v: 'Articulada' },
      { k: 'Cargas', v: 'En los nudos' },
      { k: 'Resultados', v: 'Fuerza en cada barra' },
    ],
    toolHeading: 'La cercha',
    method: {
      label: 'Método',
      title: 'Cómo se resuelve la cercha',
      paragraphs: [
        'Una barra articulada en sus dos extremos, sin carga a lo largo de ella, solo puede transmitir una fuerza a lo largo de su propio eje. Cada barra representa entonces una incógnita, su fuerza axial N, positiva a tensión. Todo nudo, con sus cargas y el tirón o el empuje de cada barra que llega a él, debe estar en equilibrio: las fuerzas sobre él suman cero en x y en y. Con n nudos son 2n ecuaciones, y las incógnitas son las b fuerzas de las barras y las r reacciones de los apoyos.',
        'Cuando b + r = 2n y la cercha es estable, hay tantas ecuaciones como incógnitas y el equilibrio por sí solo da todas las fuerzas. Eso es lo que hace a mano el método de los nudos, un nudo tras otro; aquí todos los nudos se resuelven juntos. La sección y el módulo de una barra no aparecen en esa solución: una cercha estáticamente determinada lleva las mismas fuerzas en acero que en aluminio, y con cualquier tamaño de sección. Se piden solo para calcular después el esfuerzo, el alargamiento y el desplazamiento.',
        'Cuando b + r es mayor que 2n la cercha resulta estáticamente indeterminada, y el equilibrio ya no dice cómo se reparte la carga. El método de rigidez directa aporta la compatibilidad que falta. Las incógnitas son los desplazamientos de los nudos; una barra cuyos extremos se separan δ a lo largo de su eje lleva N = (EA/L)δ, para una longitud L, un módulo E y un área A; y la matriz de rigidez de la cercha es la suma de las de las barras. Resolver ese sistema da los desplazamientos y luego cada N. Las fuerzas dependen ahora de cómo se comparan entre sí los EA/L de las barras: multiplicar todos los EA por un mismo factor no cambia ninguna fuerza. Si solo a algunas barras se les da sección, la calculadora toma EA igual en todas y lo dice.',
        'Un apoyo articulado impide que su nudo se mueva en cualquier dirección y por eso da dos componentes de reacción. Un apoyo de rodillo se lo impide a lo largo de una sola recta, y da una fuerza sobre ella. Un rodillo con cualquier ángulo se trata de forma exacta, tomando el desplazamiento de su nudo en la recta que deja abierta; ningún resorte rígido lo sustituye.',
        'Antes de resolver, la calculadora pregunta si la cercha podría desplazarse conservando cada barra su longitud, lo que depende de la geometría y de los apoyos y nunca de E ni de A. Si puede, porque a un panel le falta la diagonal, o los apoyos la sujetan en muy pocas direcciones, o una parte puede girar por sí sola, no se da ninguna fuerza: se nombran los nudos que pueden moverse. Contar b + r frente a 2n no lo decide, porque una cercha puede cumplir esa cuenta y ser un mecanismo.',
        'La página también enumera las barras que no llevan nada por simple inspección. En un nudo sin carga y sin apoyo, dos barras que no están en una misma recta llevan cero las dos; y si un nudo sin carga y sin apoyo tiene dos barras alineadas y una tercera que las cruza, esa tercera lleva cero. Esas barras se apartan y la regla se aplica de nuevo en el nudo siguiente, de modo que la lista puede seguir.',
        'El equilibrio del conjunto se comprueba sobre la respuesta: las cargas y las reacciones juntas se suman en x, en y y en momento respecto al centro de la cercha, y se halla la mayor fuerza que queda sin equilibrar en un nudo. Cada una es redondeo, y una respuesta en que no lo son no se da.',
        'Las formas que se ofrecen para empezar (triángulo, pendolón, dos pendolones, Pratt, Howe, Warren con y sin montantes, Fink y un voladizo desde un muro) llenan el formulario con nudos, barras, apoyos y cargas para una luz, una altura y un número de paneles. El cordón inferior está sobre y = 0. La carga que usted escribe es la de cada nudo a lo largo del cordón superior, con la mitad de ella en el nudo de cada extremo del cordón, donde lo hay; los apoyos son uno articulado a la izquierda con uno de rodillo a la derecha, o al revés, o uno articulado a cada lado. En una cercha Pratt las diagonales bajan hacia el centro, y en una Howe suben hacia él. Un valor con el que una forma no puede construirse, como un número impar de paneles en una Pratt, se sustituye por el más cercano que sí puede, y el formulario dice qué cambió. Después todo se puede editar: una forma es un punto de partida y no una recomendación.',
        'Dos casos con fórmula cerrada, para contrastar las respuestas.',
        'Un triángulo de luz L y altura h, con una carga P en el vértice y un apoyo articulado y uno de rodillo en los extremos: cada reacción es P/2; cada barra inclinada está a compresión con Ps/(2h), donde s = √((L/2)² + h²) es su longitud; el tirante inferior está a tensión con PL/(4h).',
        'Una barra vertical y dos inclinadas un ángulo θ a uno y otro lado de ella, todas con el mismo EA, que unen un nudo cargado con tres apoyos articulados alineados: con una carga P hacia abajo en ese nudo, la barra vertical lleva P/(1 + 2cos³θ) y cada una de las inclinadas Pcos²θ/(1 + 2cos³θ), todas a tensión. La estática sola no puede dar estos tres valores; la barra más corta toma más.',
      ],
    },
    assumes: {
      title: 'Qué supone',
      items: [
        'Una cercha plana: todos los nudos, barras y cargas en un solo plano. No se comprueba que la cercha se mantenga en ese plano.',
        'Cada nudo es un pasador sin fricción, de modo que una barra lleva solo fuerza axial. En una cercha real, un nudo soldado, con cartela, o un cordón continuo a través de él lleva algo de flexión, y los momentos que de ahí resultan no se calculan aquí.',
        'Las cargas actúan en los nudos. Una carga a lo largo de una barra, como una correa entre nudos o el peso de la propia barra, la lleva usted a los nudos de uno y otro lado; el peso de las barras es una carga solo si lo introduce.',
        'Los apoyos son articulados y de rodillo, y no ceden. Un apoyo que se asienta, o que es un resorte, no se ofrece.',
        'El material es elástico lineal, y los desplazamientos son tan pequeños que las ecuaciones se escriben sobre la cercha tal como está dibujada. Cada barra tiene un área y un módulo, tomados de los generales del formulario cuando una barra no tiene los suyos.',
        'La carga es estática y se aplica una sola vez: nada de su historia, de su dinámica ni de su repetición está en la respuesta.',
      ],
    },
    limits: {
      title: 'Qué no hace',
      items: [
        'Da fuerzas y nada más sobre el diseño: no se aplica ninguna norma, no se mayora ninguna carga, y no se dice si una barra servirá. Eso lo decide usted.',
        'Sin pandeo. Una barra larga y esbelta a compresión puede pandearse con una fuerza muy inferior a la que sugeriría su esfuerzo; su esbeltez, sus condiciones de extremo y su arriostramiento no se leen, y un esfuerzo aquí es la fuerza simple entre el área.',
        'No se dimensiona ninguna barra ni ninguna conexión: cartelas, pernos, soldaduras, el aplastamiento en un apoyo y la excentricidad en un nudo quedan fuera.',
        'Solo primer orden. El equilibrio se escribe sobre la cercha tal como está dibujada, y el efecto que el movimiento de los nudos tiene sobre las fuerzas no se incluye.',
        'Sin cambio de temperatura, sin barras hechas más largas o más cortas, y sin asentamiento de un apoyo. En una cercha estáticamente indeterminada cada una de estas cosas cambiaría las fuerzas.',
        'Una cercha que puede moverse no se resuelve. Un nudo de dos barras en una misma recta, sin una tercera barra y sin apoyo, es un mecanismo y se rechaza, sea cual sea la carga que se le ponga; también una cercha que los apoyos sujetan en muy pocas direcciones.',
        'Dos nudos en un mismo lugar, una barra sin longitud, una barra entre dos nudos que ya tienen una, un nudo al que no llega ninguna barra y una cercha en piezas separadas llevan una marca en su fila, y los resultados esperan a que se corrijan.',
        'Una cercha estáticamente indeterminada cuyas barras difieren en rigidez en muchos órdenes de magnitud puede rechazarse, pues sus fuerzas no serían correctas en las cifras mostradas. Una isostática no se ve afectada.',
        'Hasta 40 nudos, 120 barras, 40 apoyos y 80 cargas. Pasado cualquiera de estos límites la fila no se agrega y el formulario lo dice.',
      ],
    },
    signs: {
      title: 'Signos, unidades y lectura de resultados',
      items: [
        'Una fuerza en una barra es positiva a tensión, cuando la barra tira de sus dos nudos, y negativa a compresión, cuando los empuja. Una barra cuya fuerza es nula aparece como cero.',
        'x va hacia la derecha e y hacia arriba. Los nudos y las barras se numeran desde 1, en el orden de sus filas; una barra se nombra por los dos nudos que une.',
        'Una carga es una componente en x y una en y, positivas hacia la derecha y hacia arriba. La gravedad es, por tanto, una componente negativa en y.',
        'Una reacción es la fuerza que el apoyo ejerce sobre la cercha, positiva hacia la derecha y hacia arriba, de modo que una cercha que descansa sobre sus apoyos tiene reacciones hacia arriba. Un apoyo articulado da una componente en x y una en y; uno de rodillo da una sola fuerza sobre su recta.',
        'El ángulo de un rodillo está en grados, en sentido antihorario desde el eje x positivo, y es la recta sobre la que actúa su reacción: 90 es el rodillo usual bajo una cercha, con reacción vertical; 0 es un rodillo contra un muro, con reacción horizontal. La fuerza sobre la recta es positiva en el sentido en que apunta el ángulo.',
        'El esfuerzo es la fuerza de una barra entre su área, positivo a tensión. El alargamiento es NL/(EA), positivo cuando la barra se alarga. El desplazamiento de un nudo se da en x y en y solo cuando todas las barras tienen área y módulo.',
        'La comprobación de equilibrio enumera lo que queda al sumar cargas y reacciones: las sumas en x, en y y en momento, y la mayor fuerza sin equilibrar en un nudo. Son redondeo.',
        'En unidades de EE. UU., pies y kips para la geometría y las fuerzas, pulgadas cuadradas para las áreas y ksi para el módulo; el esfuerzo en ksi y el alargamiento y el desplazamiento en pulgadas. En unidades SI, metros y kilonewtons, milímetros cuadrados y GPa; el esfuerzo en MPa, el alargamiento y el desplazamiento en milímetros.',
        'El caso que usted arma queda guardado en la dirección de la página, después de #t=, y esa dirección lo vuelve a abrir.',
      ],
    },
    disclaimer: beamStrings.es.page.disclaimer,
    sheet: {
      kind: beamStrings.es.page.sheet.kind,
      credit: 'Elaborada con la calculadora de cerchas de {firm} — {address}',
      margin: beamStrings.es.page.sheet.margin,
    },
    back: 'Todas las calculadoras',
    noscript: 'Sin scripts esta página solo puede mostrar su ejemplo y no responde. Con ellos, su propio navegador calcula la cercha y nada de lo que usted escriba sale de él.',
  },
};
