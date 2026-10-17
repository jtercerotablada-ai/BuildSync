import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings, type BeamPage } from '../beam/strings';

/**
 * The words of the cable sag calculator's PAGE (/resources/cable-sag-pretension),
 * in English and in Spanish: what a search result shows, the hero, and the
 * notes under the tool. Read by the server view only (CableSagView). The tool's
 * own words are in strings.ts and travel to the browser as a prop; these never
 * do.
 *
 * THE SAME SHAPE as the first calculator's page text (`BeamPage`,
 * beam/strings.ts), because one view prints all the calculators
 * (CalculatorPage). That shape has four lists of notes, and this page puts
 * its sections in them like this:
 *   - `method`  how the cable is solved: the parabola, the catenary, the two
 *               together, the change of state, the cable with point loads,
 *               and two cases to check the page by hand;
 *   - `assumes` what the model takes to be true of the cable;
 *   - `limits`  what it leaves out, what it refuses and the limits of size;
 *   - `signs`   signs, units, the two sags, and how to read the results.
 * NOT the same sentences: no run of six words here is on any other
 * calculator's page, in its form, or in the catalogue's line for this one
 * (views/cable-sag.test.ts compares them).
 *
 * THE LEGAL WORDS ARE SAID ONCE. The disclaimer, what the printed sheet is
 * called and the line in the margin of every printed page are the first
 * calculator's, taken by reference, as the others take them. Only the credit
 * names this calculator.
 *
 * WHAT THE NOTES ARE HELD TO. The engine (lib/calc/cable-sag): views/cable-sag.test.ts
 * solves the cases printed under "How the cable is solved" with it and
 * compares them with the formulas written here: the level parabola, its
 * inclined chord, the length series, the level catenary, the cubic of the
 * change of state, the moment of the loads in the funicular polygon, and the
 * point at which the parabola and the catenary part by one percent.
 *
 * WHAT IT IS NOT IS SAID AS PLAINLY AS WHAT IT IS. A cable is an idealisation:
 * perfectly flexible, vertical loads, supports that do not move. The page gives
 * the shape and the tensions of that cable; it does not size one, check an end
 * fitting or apply a code, and it names none. Words of verdict ("adequate",
 * "safe", "passes") and any figure that is not in a formula are held out by
 * the test.
 *
 * THE OTHER CABLE CALCULATOR. A straight cable pulled along its axis, with no
 * sag, is the catalogue's "Cable tension and elongation". It is named as the
 * catalogue names it, and the test reads that name from the catalogue.
 *
 * Spanish as a Latin-American structural engineer writes it: "cable", "flecha",
 * "pretensión", "tensión horizontal", "catenaria", "parábola", "cambio de
 * estado", "apoyo", "cargas puntuales", "polígono funicular", "luz" for the
 * span, formal "usted".
 */
export type CableSagPage = BeamPage;

export const cableSagPage: Record<Lang, CableSagPage> = {
  en: {
    title: 'Cable Sag and Pretension Calculator: Catenary and Parabola',
    description:
      'Horizontal tension, support tensions and length of a hanging cable from its sag, by parabola or catenary; change of state with temperature; point loads.',
    h1: 'Cable sag and pretension for a hanging cable',
    eyebrow: 'Calculator',
    sub: 'A cable hung between two supports, level or at different heights, loaded by its weight, by a load spread over the span, or by both. Give the sag, the horizontal tension, a tension at a support or the length, and read the rest; follow the same cable to another load and another temperature; or hang it from up to 12 separate loads.',
    facts: [
      { k: 'Cable', v: 'Perfectly flexible' },
      { k: 'Loads', v: 'Weight, span load, point loads' },
      { k: 'Results', v: 'Pretension, tensions, sag' },
    ],
    toolHeading: 'The cable',
    method: {
      label: 'Method',
      title: 'How the cable is solved',
      paragraphs: [
        'A cable with no bending stiffness carries tension along its own curve and nothing else. No horizontal load acts on it, so the horizontal component of the tension, H, is the same at every point, and the vertical component at a point is the load carried between the lowest point and there. H is the pretension in the usual sense, and with the loads it fixes the whole shape. It is not the force at an anchor: the anchor or the jack must resist T, the pull of the cable on its support, which is larger than H by the vertical part of the load that support carries, and the page gives both. Whichever value you give (the sag at mid-span or below the lower support, H itself, the tension at the higher or the lower support, or the unstretched length), the calculator turns it into the H that produces it, and every other result follows from H.',
        'When the load is uniform along the horizontal, as for a deck or a pipe hung from the cable, the curve is a parabola. For a level span L and a mid-span sag d, H = qL²/(8d), with q the load per unit of horizontal length. Each support carries a vertical reaction qL/2, and the largest tension, at the supports, is T_max = √(H² + (qL/2)²). The length of the cable is S = L(1 + 8/3 (d/L)² − 32/5 (d/L)⁴ + …), which is why a shallow cable is barely longer than its span.',
        'On an inclined chord, with one support a height h above the other and L still the horizontal distance, the sag d is the vertical offset of the cable below the chord at mid-span, and H = qL²/(8d) holds unchanged. What changes is the split of the load: the higher support carries qL/2 + Hh/L and the lower one qL/2 − Hh/L. The tension at a support is √(H² + V²), with V its vertical reaction. When h is greater than 4d the lower reaction is negative, and the cable then leaves that support upward.',
        'A cable loaded by its own weight w per unit of its LENGTH hangs as a catenary, y = a(cosh(x/a) − 1), measured from the lowest point, with a = H/w. For a level span the sag is d = a(cosh(L/2a) − 1), the length is S = 2a sinh(L/2a), and the tension at a point a height y above the lowest is T = wa cosh(x/a) = H + wy, so that T_max = H + wd at the supports. There is no closed form for a from d, and the calculator solves for it numerically; on an inclined chord the same curve is cut by the two supports, and its lowest point may lie outside the span.',
        'With the cable’s weight and a load along the span together, neither curve is the exact one. The calculator solves the equilibrium of an element of cable, H z″ = q + w√(1 + z′²), and gives that exact shape, with the stretch of the cable in it when a modulus and an area are given. Next to it comes the parabola that results from spreading the cable’s weight over the chord, as a hand calculation does: the weight w per unit of chord length is w√(1 + (h/L)²) per unit of horizontal length, so the parabola carries q + w√(1 + (h/L)²), which is q + w on a level span. The two can be compared.',
        'The two curves agree closely for a shallow cable. For a level cable under its own weight, the parabola’s H, largest tension or mid-span sag departs from the exact value by 1 % at a sag of about 0.085 of the span, and by more beyond. The page then notes it, and the exact column is the one to read.',
        'A cable that is elastic stretches under tension: an element of unstretched length ds becomes ds(1 + T/EA), with E the modulus and A the metallic area. The stretched length is added up along the cable, element by element, and not taken from an average tension.',
        'A change of state follows one cable from state 1 to state 2: another load, another temperature, or both. What links the two states is the unstressed length, which changes only with temperature, L₀₂ = L₀₁(1 + αΔT), α being the coefficient of thermal expansion. For a level parabola, with q the whole load per unit of horizontal length (the cable’s weight included, that is q + w), taking the loaded length as L + q²L³/(24H²) and the strain as H/EA, equal unstressed lengths give a cubic in the new horizontal tension: (K/EA)H₂³ + (K − 1)H₂² − q₂²L²/24 = 0, where K = (1 + αΔT)(1 + q₁²L²/(24H₁²))/(1 + H₁/EA). A heavier load or a lower temperature raises H; a lighter load or a higher one lowers it. The calculator solves the exact lengths of both states for the catenary and the combined cable, without those approximations, and shows the parabola’s result beside them.',
        'A cable that carries separate vertical loads is straight between them: a funicular polygon. The bending moment M(x) that the same loads cause in a simply supported beam of the span L equals H times the vertical offset s(x) of the cable below the chord, H s(x) = M(x). One sag therefore fixes H, H = M(x₀)/s₀ at the position x₀ where it is given, and x₀ need not carry a load. The sag at each load is then M/H, the slope of each segment follows from the sags on either side, and its tension is T = H√(1 + slope²). The largest tension is in the steepest segment, which is next to a support when every load is downward. H, or the largest tension, can be given instead of a sag.',
        'Two cases whose answers are known in closed form, to check the page against.',
        'One load P at mid-span of a level span L, with the cable a sag d below the chord under it: H = PL/(4d), each segment has a vertical component P/2, and the tension in both is T = √(H² + (P/2)²).',
        'A level cable of weight w per unit of length, with a = H/w chosen so that L/(2a) = 1: the sag is d = a(cosh 1 − 1), the length S = 2a sinh 1, and the tension at the supports T_max = wa cosh 1. That is one case where a, and not the sag, is the starting value.',
      ],
    },
    assumes: {
      title: 'What it assumes',
      items: [
        'A perfectly flexible cable: it has no bending stiffness, so its tension acts along its curve at every point. A thick or stiff cable at a small sag and a low tension bends near its supports and clamps, and that bending is not found here.',
        'The loads are vertical and static. Wind, a lateral load, vibration and the dynamic effects of moving loads are not in the answer; ice enters only as a load that you give to a state.',
        'The cable’s weight acts per unit of its own length, which makes a catenary, while a deck or pipe load acts per unit of horizontal length, which makes a parabola. You give each in its own place, and the exact curve takes both.',
        'The supports are points that do not move, and the cable is able to turn at them. A saddle, a pulley, a clamp with a radius, or a support that settles, is not modelled.',
        'The material behaves linearly, with properties that are typical values. The effective modulus of a wire rope sits well under that of the steel in its wires, because of how it is made, so use the maker’s value for the cable you have. Each listed material has its own round value in each unit system, which is not the exact conversion of the other, so switching the units can move a result by a few parts in a thousand.',
        'The temperature is the same along the whole cable and the thermal strain is α times the change. Stretch from the first loading of a new rope, creep and relaxation are not modelled.',
        'A straight cable pulled along its axis, with no sag, is the subject of the catalogue’s Cable tension and elongation, and not of this page.',
      ],
    },
    limits: {
      title: 'What it leaves out',
      items: [
        'It gives tensions, shapes and lengths and stops there: it applies no code, factors no load, and does not say whether a cable will do. Breaking strength, fatigue, end fittings, saddles and anchorages are yours to decide.',
        'One cable between two supports, with one section along its length: a cable net, a cable over saddles in several spans, and a cable of changing section are outside it.',
        'The elastic and thermal changes are small-strain ones. A warning shows when the strain T/EA at the largest tension goes above 1 %.',
        'A cable that cannot be reached is refused with the reason: a given unstretched length that is not longer than the chord, a given tension below the least the cable can have, a sag with the wrong sign for the loads, a rigid cable cooled until it is shorter than the chord.',
        'A tension given as the known can fit two cables, one taut and one slack; the taut cable is the one returned, and the slack cable’s H and sag are shown beside it. In the cable with point loads a given largest tension can fit two cables as well; the slack one’s H is then named in a note.',
        'The change of state is for a cable under its own weight, a span load, or both, between the same two supports in both states. It does not follow point loads and does not move the supports.',
        'The cable with point loads has no elasticity and no temperature: its length is the geometric length of the polygon, and the weight of the cable itself is not counted unless you enter it as loads on the segments. A load pulling upward is accepted and flagged.',
        'Up to 12 point loads, each strictly between the supports and none at the same position as another. The tables of a change of state have up to 41 rows of temperature and 21 rows of load factor; a request for more is refused. A row that cannot be solved is marked in its own row and does not stop the others.',
        'The three modes are separate cases of one form. The calculator does not combine them: point loads do not enter a change of state, and a change of state does not enter the cable with point loads.',
      ],
    },
    signs: {
      title: 'Signs, units and how to read the results',
      items: [
        'x runs to the right from the support A, and z upward. The support B is a horizontal distance L away and a height h above A, with h negative when B is lower and zero for a level span. The cable hangs below the straight line between the supports.',
        'There are two sags. The mid-span sag is the vertical distance from the chord to the cable at the middle of the span, and is the one usually meant. The low sag is the vertical distance from the level of the lower support to the lowest point of the cable. On a level span they are the same number; on an inclined one they differ, and the low sag is zero when the lowest point is not inside the span.',
        'H, the pretension, is the horizontal tension, the same along the cable and always positive. The tension at a point is H√(1 + slope²), so the largest is at a support, and the page gives it at the higher and at the lower support.',
        'A reaction is the vertical force that the support exerts on the cable, positive upward; the horizontal force is H at each. The cable pushes on the support with the opposite of these. A negative reaction means that the cable leaves that support upward.',
        'The angle at a support is measured in degrees below the horizontal, going into the span. It is negative where the cable leaves the support upward.',
        'The length is shown stretched, under load, and unstretched, with their difference as the elongation. The unstretched length is what a known length refers to.',
        'q is a load per unit of horizontal length and w a weight per unit of cable length. Both are zero or positive and not both zero. In the parabola column, all the load is taken per horizontal unit, as q + w√(1 + (h/L)²), which is q + w on a level span.',
        'State 2 has a temperature of its own, and a rise from state 1 lengthens the unstressed cable. State 2 carries the same load per horizontal length as state 1 unless a different one is typed for it. The load-factor table scales what state 2 adds to state 1, its ice and any load per length above (or below) state 1’s, so that factor 1 gives state 2 itself and factor 0 gives state 1’s loads at state 2’s temperature; it leaves the cable’s weight alone.',
        'In US units, lengths are in feet, tensions in kips, line loads in pounds per foot, areas in square inches and the modulus in ksi; diameters are in inches. In SI units they are metres, kilonewtons, kilonewtons per metre, square millimetres and GPa; diameters are in millimetres. Temperatures are in degrees Fahrenheit or Celsius.',
        'The address of the page holds the case you have set up, written after #g=, and opening that address brings it back.',
      ],
    },
    disclaimer: beamStrings.en.page.disclaimer,
    sheet: {
      kind: beamStrings.en.page.sheet.kind,
      credit: 'Produced with the cable sag calculator of {firm} — {address}',
      margin: beamStrings.en.page.sheet.margin,
    },
    back: 'All calculators',
    noscript: 'Without scripts only the worked example can be shown. With them the cable is solved in your own browser, and what you type stays on your device.',
  },
  es: {
    title: 'Flecha y pretensión de cables: catenaria y parábola',
    description:
      'Tensión horizontal, tensiones en los apoyos y longitud de un cable colgante a partir de su flecha, por parábola o catenaria; cambio de estado; cargas puntuales.',
    h1: 'Flecha y pretensión de cables colgantes',
    eyebrow: 'Calculadora',
    sub: 'Un cable colgado entre dos apoyos, al mismo nivel o a alturas distintas, bajo su peso propio, una carga repartida en la luz, o ambos. Dé la flecha, la tensión horizontal, una tensión en un apoyo o la longitud, y lea el resto; siga el mismo cable hasta otra carga y otra temperatura; o cuélguelo de hasta 12 cargas separadas.',
    facts: [
      { k: 'Cable', v: 'Perfectamente flexible' },
      { k: 'Cargas', v: 'Peso, carga en la luz, puntuales' },
      { k: 'Resultados', v: 'Pretensión, tensiones, flecha' },
    ],
    toolHeading: 'El cable',
    method: {
      label: 'Método',
      title: 'Cómo se resuelve el cable',
      paragraphs: [
        'Un cable sin rigidez a la flexión lleva tensión a lo largo de su propia curva y nada más. Sobre él no actúa ninguna carga horizontal, de modo que la componente horizontal de la tensión, H, es la misma en todos sus puntos, y la componente vertical en un punto es la carga soportada entre el punto más bajo y ese. H es la pretensión en el sentido usual, y junto con las cargas fija toda la forma. No es la fuerza en un anclaje: el anclaje o el gato debe resistir T, la tensión en el apoyo, mayor que H por la parte vertical de la carga que ese apoyo recibe, y la página da las dos. Sea cual sea el valor que usted dé (la flecha al centro de la luz o bajo el apoyo más bajo, la propia H, la tensión en el apoyo superior o en el inferior, o la longitud sin estirar), la calculadora lo convierte en la H que lo produce, y todo lo demás se deduce de H.',
        'Cuando la carga es uniforme en la horizontal, como la de un tablero o una tubería colgados del cable, la curva es una parábola. Para una luz L a nivel y una flecha d al centro, H = qL²/(8d), con q la carga por unidad de longitud horizontal. Cada apoyo recibe una reacción vertical qL/2, y la mayor tensión, en los apoyos, es T_max = √(H² + (qL/2)²). La longitud del cable es S = L(1 + 8/3 (d/L)² − 32/5 (d/L)⁴ + …), y por eso un cable poco flechado es apenas más largo que su luz.',
        'Con la cuerda inclinada, un apoyo a una altura h sobre el otro y L siempre la distancia horizontal, la flecha d es la distancia vertical del cable bajo la cuerda en el punto medio de la luz, y H = qL²/(8d) sigue valiendo igual. Lo que cambia es el reparto de la carga: el apoyo más alto recibe qL/2 + Hh/L y el más bajo qL/2 − Hh/L. La tensión en un apoyo es √(H² + V²), con V su reacción vertical. Cuando h es mayor que 4d la reacción del apoyo bajo es negativa, y entonces el cable parte de ese apoyo hacia arriba.',
        'Un cable cargado por su peso w por unidad de LONGITUD del propio cable cuelga como una catenaria, y = a(cosh(x/a) − 1), medida desde el punto más bajo, con a = H/w. Para una luz a nivel la flecha es d = a(cosh(L/2a) − 1), la longitud es S = 2a sinh(L/2a), y la tensión en un punto a una altura y sobre el más bajo es T = wa cosh(x/a) = H + wy, de modo que T_max = H + wd en los apoyos. No existe una forma cerrada para a a partir de d, y la calculadora la resuelve numéricamente; con la cuerda inclinada la misma curva la cortan los dos apoyos, y su punto más bajo puede quedar fuera de la luz.',
        'Con el peso del cable y una carga repartida en la luz a la vez, ninguna de las dos curvas es la exacta. La calculadora resuelve el equilibrio de un elemento de cable, H z″ = q + w√(1 + z′²), y da esa forma exacta, con el estiramiento del cable incluido cuando se dan un módulo y un área. A su lado va la parábola que resulta de repartir el peso del cable sobre la cuerda, como hace un cálculo a mano: el peso w por unidad de longitud de cuerda es w√(1 + (h/L)²) por unidad de longitud horizontal, de modo que la parábola lleva q + w√(1 + (h/L)²), que es q + w en una luz a nivel. Así pueden compararse.',
        'Las dos curvas coinciden de cerca en un cable poco flechado. Para un cable a nivel bajo su peso, la H de la parábola, la mayor tensión o la flecha central se aparta del valor exacto en 1 % con una flecha de cerca de 0.085 de la luz, y en más a partir de ahí. La página lo avisa entonces, y la columna exacta es la que se lee.',
        'Un cable elástico se estira bajo tensión: un elemento de longitud sin estirar ds pasa a ds(1 + T/EA), con E el módulo y A el área metálica. La longitud estirada se suma a lo largo del cable, elemento por elemento, y no se toma de una tensión media.',
        'Un cambio de estado sigue un mismo cable del estado 1 al estado 2: otra carga, otra temperatura, o ambas. Lo que une los dos estados es la longitud sin tensión, que solo cambia con la temperatura, L₀₂ = L₀₁(1 + αΔT), con α el coeficiente de dilatación térmica. Para una parábola a nivel, con q la carga total por unidad de longitud horizontal (el peso del cable incluido, es decir q + w), tomando la longitud cargada como L + q²L³/(24H²) y la deformación como H/EA, longitudes sin tensión iguales dan una cúbica en la nueva tensión horizontal: (K/EA)H₂³ + (K − 1)H₂² − q₂²L²/24 = 0, donde K = (1 + αΔT)(1 + q₁²L²/(24H₁²))/(1 + H₁/EA). Una carga mayor o una temperatura menor aumenta H; una carga menor o una temperatura mayor la disminuye. Para la catenaria y el cable combinado la calculadora resuelve las longitudes exactas de ambos estados, sin esas aproximaciones, y muestra junto a ellas el resultado de la parábola.',
        'Un cable que lleva cargas verticales separadas es recto entre ellas: un polígono funicular. El momento flector M(x) que las mismas cargas causan en una viga simplemente apoyada de luz L es igual a H por la distancia vertical s(x) de la cuerda al cable, H s(x) = M(x). Una sola flecha fija entonces H, H = M(x₀)/s₀ en la posición x₀ donde se da, y x₀ no necesita llevar carga. La flecha en cada carga es luego M/H, la pendiente de cada tramo se deduce de las flechas a uno y otro lado, y su tensión es T = H√(1 + pendiente²). La mayor tensión está en el tramo más empinado, que es el contiguo a un apoyo cuando todas las cargas son hacia abajo. En lugar de una flecha se puede dar H, o la mayor tensión.',
        'Dos casos cuya respuesta se conoce en forma cerrada, para contrastar la página.',
        'Una carga P al centro de una luz L a nivel, con el cable a una flecha d bajo la cuerda justo debajo de ella: H = PL/(4d), cada tramo tiene una componente vertical P/2, y la tensión en ambos es T = √(H² + (P/2)²).',
        'Un cable a nivel de peso w por unidad de longitud, con a = H/w elegido de modo que L/(2a) = 1: la flecha es d = a(cosh 1 − 1), la longitud S = 2a sinh 1, y la tensión en los apoyos T_max = wa cosh 1. Es un caso en que el valor de partida es a y no la flecha.',
      ],
    },
    assumes: {
      title: 'Qué supone',
      items: [
        'Un cable perfectamente flexible: no tiene rigidez a la flexión, de modo que su tensión actúa a lo largo de su curva en cada punto. Un cable grueso o rígido con poca flecha y poca tensión se flexiona cerca de sus apoyos y abrazaderas, y esa flexión no se calcula aquí.',
        'Las cargas son verticales y estáticas. El viento, una carga lateral, la vibración y los efectos dinámicos de cargas móviles no están en la respuesta; el hielo entra solo como una carga que usted da a un estado.',
        'El peso del cable actúa por unidad de su propia longitud, lo que da una catenaria, mientras que la carga de un tablero o una tubería actúa por unidad de longitud horizontal, lo que da una parábola. Usted da cada una en su lugar, y la curva exacta toma las dos.',
        'Los apoyos son puntos que no se mueven, y el cable puede girar libremente en ellos. Una silla, una polea, una abrazadera con radio o un apoyo que se asienta no están modelados.',
        'El material se comporta de forma lineal, con propiedades que son valores típicos. En un cable de alambres el módulo efectivo resulta muy inferior al del acero de sus alambres, por la forma en que se fabrica, de modo que use el valor del fabricante para el cable que tiene. Cada material de la lista tiene su propio valor redondo en cada sistema de unidades, que no es la conversión exacta del otro, de modo que al cambiar de unidades un resultado puede moverse unas pocas partes por mil.',
        'La temperatura es la misma a lo largo de todo el cable y la deformación térmica es α por el cambio. El estiramiento de la primera carga de un cable nuevo, la fluencia y la relajación no están modelados.',
        'Un cable recto tirado según su eje, sin flecha, es materia de la calculadora Tensión y alargamiento de cables del catálogo, y no de esta página.',
      ],
    },
    limits: {
      title: 'Qué no hace',
      items: [
        'Da tensiones, formas y longitudes y se detiene ahí: no aplica ninguna norma, no mayora ninguna carga y no dice si un cable servirá. La resistencia a la rotura, la fatiga, los herrajes de extremo, las sillas y los anclajes los decide usted.',
        'Un solo cable entre dos apoyos, con una sola sección a lo largo de él: una red de cables, un cable sobre sillas en varias luces y un cable cuya sección cambia quedan fuera.',
        'Los cambios elásticos y térmicos son de deformación pequeña. Una advertencia aparece cuando la deformación T/EA en la mayor tensión pasa de 1 %.',
        'Un cable que no se puede alcanzar se rechaza con su razón: una longitud sin estirar dada que no es mayor que la cuerda, una tensión dada menor que la mínima que el cable puede tener, una flecha con el signo contrario al de las cargas, un cable rígido enfriado hasta quedar más corto que la cuerda.',
        'Con una tensión dada como dato pueden existir dos cables, el tenso y el flojo: se devuelve el tenso, y la H y la flecha del flojo van a su lado.',
        'El cambio de estado es para un cable bajo su peso, una carga en la luz, o ambos, entre los mismos dos apoyos en los dos estados. No sigue cargas puntuales y no mueve los apoyos.',
        'El cable con cargas puntuales no tiene elasticidad ni temperatura: su longitud es la longitud geométrica del polígono, y el peso del propio cable queda fuera salvo que usted lo introduzca como cargas sobre los tramos. Una carga que tira hacia arriba se acepta y se marca.',
        'Hasta 12 cargas puntuales, cada una estrictamente entre los apoyos y ninguna en la misma posición que otra. Las tablas de un cambio de estado tienen hasta 41 filas de temperatura y 21 de factor de carga; pedir más se rechaza. Una fila que no se puede resolver se marca en su propia fila y no detiene a las demás.',
        'Los tres modos son casos separados de un mismo formulario. La calculadora no los combina: las cargas puntuales no entran en un cambio de estado, ni un cambio de estado en el cable con cargas puntuales.',
      ],
    },
    signs: {
      title: 'Signos, unidades y cómo leer los resultados',
      items: [
        'x va hacia la derecha desde el apoyo A, y z hacia arriba. El apoyo B está a una distancia horizontal L y a una altura h sobre A, con h negativa cuando B está más bajo y cero para una luz a nivel. El cable cuelga por debajo de la recta que une los apoyos.',
        'Hay dos flechas. La flecha central es la distancia vertical de la cuerda al cable en el medio de la luz, y es la que suele entenderse. La flecha baja es la distancia vertical desde el nivel del apoyo más bajo hasta el punto más bajo del cable. En una luz a nivel son el mismo número; en una inclinada difieren, y la flecha baja es cero cuando el punto más bajo no está dentro de la luz.',
        'H, la pretensión, es la tensión horizontal, la misma a lo largo del cable y siempre positiva. La tensión en un punto es H√(1 + pendiente²), por lo que la mayor está en un apoyo, y la página la da en el apoyo más alto y en el más bajo.',
        'Una reacción es la fuerza vertical que el apoyo ejerce sobre el cable, positiva hacia arriba; la fuerza horizontal es H en cada uno. El cable empuja al apoyo con lo opuesto a estas. Una reacción negativa significa que el cable sale de ese apoyo hacia arriba.',
        'El ángulo en un apoyo se mide en grados bajo la horizontal, hacia el interior de la luz. Es negativo donde el cable sale del apoyo hacia arriba.',
        'La longitud se muestra estirada, bajo carga, y sin estirar, con su diferencia como alargamiento. La longitud sin estirar es a la que se refiere una longitud dada.',
        'q es una carga por unidad de longitud horizontal y w un peso por unidad de longitud de cable. Ambas son cero o positivas y no las dos cero. En la columna de la parábola toda la carga se toma por unidad horizontal, como q + w√(1 + (h/L)²), que es q + w en una luz a nivel.',
        'El estado 2 tiene su propia temperatura, y un aumento respecto al estado 1 alarga el cable sin tensión. El estado 2 lleva la misma carga por longitud horizontal que el estado 1 salvo que se escriba otra para él. La tabla de factores de carga escala lo que el estado 2 añade al estado 1, su hielo y la carga por longitud que supere (o quede por debajo de) la del estado 1, de modo que con el factor 1 se obtiene el propio estado 2 y con el 0 las cargas del estado 1, ambos con la temperatura fijada para el segundo; deja intacto el peso del cable.',
        'En unidades US, las longitudes van en pies, las tensiones en kips, las cargas lineales en libras por pie, las áreas en pulgadas cuadradas y el módulo en ksi; los diámetros en pulgadas. En unidades SI son metros, kilonewtons, kilonewtons por metro, milímetros cuadrados y GPa; los diámetros en milímetros. Las temperaturas van en grados Fahrenheit o Celsius.',
        'La dirección de la página guarda el caso que usted ha armado, escrito después de #g=, y al abrirla se recupera.',
      ],
    },
    disclaimer: beamStrings.es.page.disclaimer,
    sheet: {
      kind: beamStrings.es.page.sheet.kind,
      credit: 'Elaborada con la calculadora de flecha de cables de {firm} — {address}',
      margin: beamStrings.es.page.sheet.margin,
    },
    back: 'Todas las calculadoras',
    noscript: 'Sin scripts solo puede mostrarse el ejemplo resuelto. Con ellos el cable se resuelve en su propio navegador, y lo escrito por usted permanece en su equipo.',
  },
};
