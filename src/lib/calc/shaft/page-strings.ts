import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings, type BeamPage } from '../beam/strings';

/**
 * The words of the shaft's PAGE (/resources/shaft-on-bearings), in English
 * and in Spanish: what a search result shows, the hero, and the notes under
 * the tool. Read by the server view only (ShaftView). The tool's own words
 * are in strings.ts and travel to the browser as a prop; these never do.
 *
 * THE SAME SHAPE as the first calculator's page text (`BeamPage`,
 * beam/strings.ts), because one view prints all four (CalculatorPage). NOT
 * the same sentences: no run of six words here is on any of the other three
 * pages, in their forms, or in this page's own line of the catalogue
 * (views/shaft.test.ts compares them).
 *
 * THE LEGAL WORDS ARE SAID ONCE. The disclaimer, what the printed sheet is
 * called and the line in the margin of every printed page are the first
 * calculator's, taken by reference, as the second and the third take them.
 * Only the credit names this calculator.
 *
 * A SHAFT'S PAGE SAYS "SHAFT". The other three are about beams and say so;
 * this one is read by whoever sizes a countershaft, and the word "beam" is
 * nowhere in it — not for the method either, which is told in the terms of
 * the thing solved: two planes, two simple supports, equilibrium.
 *
 * WHAT THE NOTES ARE HELD TO. The engine (engine.ts) and the form's model
 * (model.ts) — and views/shaft.test.ts holds each sentence to them: the
 * behaviour and, where a word could be turned round with the behaviour
 * untouched (a direction, a sign, which side of a shoulder), the clause
 * itself, in both languages. The four shafts that close the method are each
 * worked out there — the last by the unit-load method, written out — and
 * compared with the engine and with the formulas printed here.
 *
 * WHAT IT IS NOT IS SAID AS PLAINLY AS WHAT IT IS. A shaft is designed
 * against torsion, fatigue and the stress raised at a shoulder at least as
 * much as against bending, and this page does bending alone. Each of those
 * has its own line under "What it does not do": a reader must not take a
 * nominal bending stress for the stress a shaft is judged by. And no limit
 * is quoted as a rule — not a slope a kind of bearing tolerates, not a
 * deflection a gear mesh allows: those are the bearing maker's and the
 * designer's numbers, and they differ.
 *
 * Spanish as the first calculator writes it: "cortante", "momento flector",
 * "deflexión", "giro" for a slope, formal "usted". And a shaft's own words:
 * "eje", "cojinete" (the catalogue's name for this page), "tramo" for a
 * segment, "hombro" for a shoulder, "momento aplicado" for a couple — the
 * form's word: "par" is the torque to a Spanish reader, and torque is no
 * load of this page.
 */
export type ShaftPage = BeamPage;

export const shaftPage: Record<Lang, ShaftPage> = {
  en: {
    title: 'Stepped Shaft Deflection Calculator: Bearing Loads and Slope',
    description:
      'A stepped round shaft on two bearings, loaded in two planes: the radial load and the slope at each bearing, bending moment, nominal stress and deflection.',
    h1: 'Shaft on bearings: reactions, bending and deflection',
    eyebrow: 'Calculator',
    sub: 'A round shaft turned in steps, solid or bored, on two bearings, under forces and applied moments that act in two planes at once. At each bearing, its radial load and the slope of the shaft; in each segment, the largest bending moment and its nominal stress; and the deflection anywhere, in either plane or as the two together.',
    facts: [
      { k: 'Shaft', v: 'Stepped, solid or hollow' },
      { k: 'Loads', v: 'Forces and applied moments, in two planes' },
      { k: 'At each bearing', v: 'Radial load and slope' },
    ],
    toolHeading: 'The shaft',
    method: {
      label: 'Method',
      title: 'How the shaft is solved',
      paragraphs: [
        'The shaft is solved in two planes, the vertical and the horizontal, one at a time. In each, the two bearings are simple supports and the loads are that plane’s components: of every force, of every applied moment and, in the vertical plane, the shaft’s own weight where it is counted. Two simple supports leave nothing indeterminate: the two reactions follow from the two equations of equilibrium, and the shear and the bending moment at a section from the forces on one side of it. The diameters do not enter any of these, except through the weight of the shaft.',
        'Slope and deflection are where the diameters count. The shaft is cut at every shoulder, bearing, force and applied moment, and on each piece a plane’s bending moment is one polynomial — a straight line, or a parabola under the shaft’s own weight — over one flexural stiffness EI, with I = π(D⁴ − d⁴)/64 for an outer diameter D and a bore d. Integrating M/EI once gives the slope, a cubic at most, and once more the deflection, a quartic at most: closed forms, written out term by term and evaluated where they are asked for, with no numerical integration and no interpolation. Slope and deflection carry over unbroken from one piece into the next, across a shoulder as across an applied moment, and the two constants of integration are fixed by the deflection being zero at the two bearings.',
        'A section feels the two planes together. The resultant — the square root of the sum of the squares of the two components — is taken of the shear, the bending moment, the slope and the deflection alike. For a round section that is exact: its moment of inertia is the same about every diameter, so the moments of the two planes are one moment about one diameter. The resultant deflection is how far the centre of the section has moved, and the resultant slope the angle its axis has turned through, whatever the direction of either; a bearing’s radial load is the resultant of its two reactions.',
        'The bending stress is the resultant moment over the section modulus of the segment the section is in, Z = π(D⁴ − d⁴)/(32D). At a shoulder the moment is one value and the section is two, so the stress there is two values, the higher on the side of the smaller modulus. Each segment is given the largest moment within its own length over its own modulus, and the largest stress on the shaft is the largest of those: it may be at a shoulder, far from the largest moment, as in the example the page opens with.',
        'The largest resultant is not, in general, where either plane’s own diagram peaks. On each piece the sum of the squares of the two planes’ values is a polynomial, and the largest moment, slope and deflection are looked for at the sign changes of its derivative, and at the ends of the pieces: each is the value at the place it is printed with, not the largest of the points plotted.',
        'To check the page by hand, four shafts with a closed form. L is the distance between the two bearings, and a shaft of one solid diameter D has I = πD⁴/64.',
        'One diameter, a force P midway between the bearings: each reaction P/2; deflection under the force PL³/(48EI); slope at each bearing PL²/(16EI).',
        'One diameter, a force P on an overhang, a beyond one bearing: that bearing carries P(L + a)/L, the other Pa/L the opposite way; moment Pa at the near bearing; deflection under the force Pa²(L + a)/(3EI).',
        'The first case with P at 45° between the two planes: each plane carries P/√2 and gives 1/√2 of that deflection and slope; the resultants are the first case’s, whole.',
        'The first case on a stepped shaft, its middle half of stiffness nEI and its two end quarters of EI: deflection under the force PL³(1 + 7/n)/(384EI); slope at each bearing PL²(1 + 3/n)/(64EI).',
      ],
    },
    assumes: {
      title: 'What it assumes',
      items: [
        'A straight shaft of round section, solid or with a concentric bore. Its diameters change at a point: each segment has one section from end to end, with no taper and no fillet.',
        'One material, linear elastic, with a single modulus E for every segment.',
        'Two bearings, each a simple support at one point of the axis: it holds the shaft against moving across its axis and does not give, and it lets the shaft turn there.',
        'Small deflections, and bending alone (Euler–Bernoulli): the shear force adds nothing to the deflection.',
        'Loads across the axis only: forces and moments applied at points, and the weight of the shaft where it is counted. No axial force and no torque is carried; a gear’s axial force is entered as the moment it makes at the gear’s radius.',
        'A static calculation: the loads of one instant, with nothing of the rotation in it.',
      ],
    },
    limits: {
      title: 'What it does not do',
      items: [
        'It is mechanics and nothing more: no design code, no factor on a load or on a stress, no verdict. Whether a slope, a deflection or a stress will do is yours to say.',
        'No torsion. A torque is not entered, the shear stress it would cause is not worked out, and nothing is combined with the bending stress.',
        'No fatigue. The bending stress is the static one, although in a shaft that turns under loads fixed in direction it reverses with every turn.',
        'No stress raiser. The stress is nominal — the moment over the modulus of the plain section — at a shoulder, a keyway, a groove or a press fit as anywhere else.',
        'No critical speed and no vibration; and no bearing life: no bearing is chosen or rated here. The radial load and the slope at each are the numbers to take to a bearing’s own data.',
        'Two bearings and no more. On three the shaft is statically indeterminate, and it is not solved here; nor is a bearing that resists turning, such as a long sleeve or a pair set close together.',
        'No shear deformation, which a short, thick shaft has more of; no taper; and none of the stiffness a hub, a gear or a pressed-on ring adds.',
        'A segment under a millionth of the shaft’s length, a segment more than a million times as stiff as another, and two bearings within a thousandth of that length of each other are not solved: the entry is marked in the form, and the results are withheld.',
        'The shaft’s own weight is a load only when you include it. Each segment then weighs its density times its area of metal, a uniform load in the vertical plane: the weight of a shaft that lies horizontal.',
      ],
    },
    signs: {
      title: 'Signs and units',
      items: [
        'Every position is measured along the shaft from its left end: a bearing’s, a force’s, an applied moment’s.',
        'The vertical plane is the shaft seen from the side, and the horizontal plane the shaft seen from above, its left end at the left in both. A force is a size in each plane with the way it points: down or up; towards the viewer, who stands beside the shaft, or away from the viewer.',
        'An applied moment is a size in each plane with the way it turns, counter-clockwise or clockwise, as that plane is drawn. A size entered with a minus sign acts the other way, for a force as for a moment.',
        'Under Values at a point each plane keeps its signs: for shear, moment and deflection those written under the diagrams when that plane is the view, and for a slope, positive counter-clockwise as that plane is drawn.',
        'Both planes shows sizes: every value there is of the two planes together and never negative, because the direction of a resultant turns along the shaft and it has no sign to carry.',
        'The radial load of a bearing is its two reactions taken together as one size; the slope there is its two slopes taken the same way, in radians.',
        'A deflection is the movement of the axis off the line that joins the two bearings, and they do not move.',
        'Lengths, diameters and deflections in inches or millimetres; forces in pounds-force or newtons; moments in lbf·in or N·m; the modulus E and every stress in ksi or MPa; slopes in radians in both systems.',
        'A density in lb/in³ is read as a weight, lbf/in³; one in kg/m³ is multiplied by standard gravity, 9.80665 m/s².',
      ],
    },
    disclaimer: beamStrings.en.page.disclaimer,
    sheet: {
      kind: beamStrings.en.page.sheet.kind,
      credit: 'Produced with the shaft calculator of {firm} — {address}',
      margin: beamStrings.en.page.sheet.margin,
    },
    back: 'All calculators',
    noscript: 'Scripts are not running here, so the page shows its example and will not answer. When they run, the shaft is worked out by your own browser and no number you type is sent.',
  },
  es: {
    title: 'Calculadora de ejes escalonados: giro, deflexión y cojinetes',
    description:
      'Un eje escalonado sobre dos cojinetes, cargado en dos planos: carga radial y giro en cada cojinete, momento flector, esfuerzo nominal y deflexión.',
    h1: 'Eje sobre cojinetes: reacciones, flexión y deflexión',
    eyebrow: 'Calculadora',
    sub: 'Un eje redondo torneado en escalones, macizo o hueco, sobre dos cojinetes, con fuerzas y momentos aplicados que actúan en dos planos a la vez. En cada cojinete, su carga radial y el giro del eje; en cada tramo, el momento flector máximo y su esfuerzo nominal; y la deflexión en cualquier punto, en uno u otro plano o en los dos juntos.',
    facts: [
      { k: 'Eje', v: 'Escalonado, macizo o hueco' },
      { k: 'Cargas', v: 'Fuerzas y momentos aplicados, en dos planos' },
      { k: 'En cada cojinete', v: 'Carga radial y giro' },
    ],
    toolHeading: 'El eje',
    method: {
      label: 'Método',
      title: 'Cómo se resuelve el eje',
      paragraphs: [
        'El eje se resuelve en dos planos, el vertical y el horizontal, uno cada vez. En cada uno, los dos cojinetes son apoyos simples y las cargas son las componentes de ese plano: la de cada fuerza, la de cada momento aplicado y, en el plano vertical, el peso propio del eje cuando se cuenta. Con dos apoyos simples nada queda indeterminado: las dos reacciones salen de las dos ecuaciones de equilibrio, y el cortante y el momento flector en una sección, de las fuerzas que quedan a un lado de ella. Los diámetros no entran en nada de esto, salvo por el peso del eje.',
        'En el giro y en la deflexión es donde cuentan los diámetros. El eje se corta en cada hombro, cojinete, fuerza y momento aplicado, y en cada trozo el momento flector de un plano es un solo polinomio — una recta, o una parábola bajo el peso propio del eje — sobre una sola rigidez a flexión EI, con I = π(D⁴ − d⁴)/64 para un diámetro exterior D y un diámetro interior d. Integrar M/EI una vez da el giro, a lo sumo una cúbica, y otra vez la deflexión, a lo sumo de cuarto grado: fórmulas cerradas, escritas término a término y evaluadas donde se piden, sin integración numérica y sin interpolación. El giro y la deflexión pasan sin salto de un trozo al siguiente, lo mismo por un hombro que por un momento aplicado, y las dos constantes de integración quedan fijadas porque la deflexión es cero en los dos cojinetes.',
        'Una sección siente los dos planos a la vez. La resultante — la raíz cuadrada de la suma de los cuadrados de las dos componentes — se toma por igual del cortante, del momento flector, del giro y de la deflexión. En una sección redonda eso es exacto: su momento de inercia es el mismo respecto a cualquier diámetro, de modo que los momentos de los dos planos son un solo momento respecto a un solo diámetro. La deflexión resultante es cuánto se ha desplazado el centro de la sección, y el giro resultante, el ángulo que ha girado su eje, sea cual sea la dirección de una y de otro; la carga radial de un cojinete es la resultante de sus dos reacciones.',
        'El esfuerzo de flexión es el momento resultante entre el módulo de sección del tramo en que está la sección, Z = π(D⁴ − d⁴)/(32D). En un hombro el momento es un solo valor y la sección son dos, así que el esfuerzo tiene allí dos valores, el mayor del lado del módulo menor. A cada tramo se le da el momento máximo dentro de su propia longitud entre su propio módulo, y el esfuerzo máximo del eje es el mayor de esos: puede estar en un hombro, lejos del momento máximo, como en el ejemplo con que se abre la página.',
        'La resultante máxima no está, en general, donde alcanza su máximo el diagrama de uno u otro plano. En cada trozo la suma de los cuadrados de lo que vale cada plano es un polinomio, y los máximos del momento, del giro y de la deflexión se buscan en los cambios de signo de su derivada, y en los extremos de los trozos: cada uno es el valor en el punto con que se da, no el mayor de los puntos dibujados.',
        'Para comprobar la página a mano, cuatro ejes con fórmula cerrada. L es la distancia entre los dos cojinetes, y un eje de un solo diámetro macizo D tiene I = πD⁴/64.',
        'Un solo diámetro, una fuerza P a media distancia entre los cojinetes: cada reacción P/2; deflexión bajo la fuerza PL³/(48EI); giro en cada cojinete PL²/(16EI).',
        'Un solo diámetro, una fuerza P en un voladizo, separada a de un cojinete: ese cojinete recibe P(L + a)/L y el otro Pa/L en sentido contrario; momento Pa en el cojinete cercano; deflexión bajo la fuerza Pa²(L + a)/(3EI).',
        'El primer caso con P a 45° entre los dos planos: cada plano recibe P/√2 y da 1/√2 de aquella deflexión y de aquel giro; las resultantes son las del primer caso, enteras.',
        'El primer caso en un eje escalonado, con rigidez nEI en su mitad central y EI en sus dos cuartos extremos: deflexión bajo la fuerza PL³(1 + 7/n)/(384EI); giro en cada cojinete PL²(1 + 3/n)/(64EI).',
      ],
    },
    assumes: {
      title: 'Qué supone',
      items: [
        'Un eje recto de sección redonda, maciza o hueca, con su diámetro interior concéntrico. Sus diámetros cambian en un punto: cada tramo tiene una sola sección de un extremo al otro, sin conicidad y sin radio de acuerdo.',
        'Un solo material, elástico lineal, con un mismo módulo E en todos los tramos.',
        'Dos cojinetes, cada uno un apoyo simple en un punto del eje: impide que el eje se desplace de través y no cede, y lo deja girar allí.',
        'Deflexiones pequeñas, y solo flexión (Euler–Bernoulli): la fuerza cortante no añade nada a la deflexión.',
        'Solo cargas transversales al eje: fuerzas y momentos aplicados en puntos, y el peso del eje cuando se cuenta. No se lleva fuerza axial ni par de torsión; la fuerza axial que recibe un engranaje se introduce como el momento que hace a su radio.',
        'Un cálculo estático: las cargas de un instante, sin nada de la rotación.',
      ],
    },
    limits: {
      title: 'Qué no hace',
      items: [
        'Es mecánica y nada más: ninguna norma de diseño, ningún factor sobre una carga ni sobre un esfuerzo, ningún veredicto. Si un giro, una deflexión o un esfuerzo sirven, lo dice usted.',
        'Sin torsión. No se introduce un par de torsión, no se calcula el esfuerzo cortante que produciría, y nada se combina con el esfuerzo de flexión.',
        'Sin fatiga. El esfuerzo de flexión es el estático, aunque en un eje que gira bajo cargas de dirección fija se invierte en cada vuelta.',
        'Sin concentración de esfuerzos. El esfuerzo es nominal — el momento entre el módulo de la sección lisa — en un hombro, un chavetero, una ranura o un ajuste a presión igual que en cualquier otro punto.',
        'Sin velocidad crítica ni vibraciones; y sin vida de cojinetes: aquí no se elige ni se dimensiona ningún cojinete. La carga radial y el giro en cada uno son los números que se llevan a los datos del propio cojinete.',
        'Dos cojinetes y no más. Con tres el eje es hiperestático, y aquí no se resuelve; tampoco un cojinete que impide el giro, como un casquillo largo o dos cojinetes montados muy juntos.',
        'Sin deformación por cortante, que es mayor en un eje corto y grueso; sin conicidad; y sin la rigidez que añade un cubo, un engranaje o un aro montado a presión.',
        'Un tramo de menos de una millonésima de la longitud del eje, un tramo con más de un millón de veces la rigidez de otro y dos cojinetes separados menos de una milésima de lo que mide el eje no se resuelven: el dato queda señalado en el formulario y los resultados no se dan.',
        'El peso propio del eje es una carga solo cuando usted lo incluye. Cada tramo pesa entonces su densidad por su área de metal, una carga uniforme en el plano vertical: el peso de un eje que está horizontal.',
      ],
    },
    signs: {
      title: 'Signos y unidades',
      items: [
        'Toda posición es una distancia desde el extremo izquierdo del eje: la de un cojinete, la de una fuerza, la de un momento aplicado.',
        'El plano vertical es el eje visto de lado, y el plano horizontal el eje visto desde arriba, con su extremo izquierdo a la izquierda en ambos. Una fuerza es una magnitud en cada plano con el sentido en que actúa: hacia abajo o hacia arriba; hacia el observador, que está junto al eje, o hacia el fondo.',
        'Un momento aplicado es una magnitud en cada plano con el sentido en que gira, antihorario u horario, tal como se dibuja ese plano. Una magnitud escrita con signo menos actúa en el sentido contrario, tanto en una fuerza como en un momento.',
        'En Valores en un punto cada plano conserva sus signos: para el cortante, el momento y la deflexión, los que se leen bajo los diagramas cuando ese plano es la vista; para un giro, positivo en sentido antihorario tal como se dibuja ese plano.',
        'Ambos planos muestra magnitudes: todo valor es allí el de los dos planos juntos y nunca negativo, porque la dirección de una resultante va cambiando a lo largo del eje y no tiene signo que llevar.',
        'La carga radial de un cojinete son sus dos reacciones tomadas juntas como una sola magnitud; el giro allí son sus dos giros tomados del mismo modo, en radianes.',
        'Una deflexión se mide desde la recta que pasa por los dos cojinetes, que no se mueven.',
        'Longitudes, diámetros y deflexiones en pulgadas o milímetros; fuerzas en libras-fuerza o newtons; momentos en lbf·in o N·m; el módulo E y cada esfuerzo en ksi o MPa; giros en radianes en ambos sistemas.',
        'Una densidad en lb/in³ se lee como un peso, lbf/in³; una en kg/m³ se multiplica por la gravedad estándar, 9.80665 m/s².',
      ],
    },
    disclaimer: beamStrings.es.page.disclaimer,
    sheet: {
      kind: beamStrings.es.page.sheet.kind,
      credit: 'Elaborada con la calculadora de ejes de {firm} — {address}',
      margin: beamStrings.es.page.sheet.margin,
    },
    back: 'Todas las calculadoras',
    noscript: 'Aquí no se están ejecutando los scripts, así que lo que se ve es el ejemplo de la página, que no va a responder. Cuando se ejecutan, el eje lo calcula su propio navegador y no se envía ningún número que usted escriba.',
  },
};
