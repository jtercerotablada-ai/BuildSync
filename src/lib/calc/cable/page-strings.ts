import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings, type BeamPage } from '../beam/strings';

/**
 * The words of the cable calculator's PAGE (/resources/cable-tension-elongation),
 * in English and in Spanish: what a search result shows, the hero, and the
 * notes under the tool. Read by the server view only (CableView). The tool's
 * own words are in strings.ts and travel to the browser as a prop; these never
 * do.
 *
 * THE SAME SHAPE as the first calculator's page text (`BeamPage`,
 * beam/strings.ts), because one view prints all the calculators
 * (CalculatorPage). That shape has four lists of notes, and this page puts
 * its sections in them like this:
 *   - `method`  how each of the three problems is solved (the sling, the pull
 *               against friction, the cable on a drum), the stress and the
 *               stretch, the typical values, and three cases to check the
 *               page by hand;
 *   - `assumes` what the model takes to be true of the cable;
 *   - `limits`  what it leaves out, what it refuses and what the three
 *               problems cannot do;
 *   - `signs`   signs, units, and how to read each block of results.
 * NOT the same sentences: no run of six words here is on any other
 * calculator's page, in its form, or in the catalogue's line for this one
 * (views/cable.test.ts compares them).
 *
 * THE LEGAL WORDS ARE SAID ONCE. The disclaimer, what the printed sheet is
 * called and the line in the margin of every printed page are the first
 * calculator's, taken by reference, as the others take them. Only the credit
 * names this calculator.
 *
 * WHAT THE NOTES ARE HELD TO. The engine (engine.ts): views/cable.test.ts
 * solves the three cases printed under "How the cable is solved" with it and
 * compares them with the formulas written here, and derives the pull against
 * friction from the two equilibrium equations to check the closed form.
 *
 * WHAT IT IS NOT IS SAID AS PLAINLY AS WHAT IT IS. A straight, weightless
 * cable, linear elastic, in first-order geometry, is an idealisation. The page
 * gives tensions, stresses and stretches; it does not size a cable, a sling
 * or a fitting, and it applies no code and names none. Words of verdict
 * ("adequate", "safe", "passes") and any figure that is not in a formula are
 * held out by the test. The typical values of the materials and ropes are in
 * the form, not here; this page only says that they are typical.
 *
 * Spanish as a Latin-American structural engineer writes it: "cable",
 * "eslinga" with its "ramales", "tensión" for the force in the cable,
 * "esfuerzo" for stress, "alargamiento", "cabrestante", "tambor", "fricción"
 * (the catalogue's own word, not "rozamiento"), formal "usted".
 */
export type CablePage = BeamPage;

export const cablePage: Record<Lang, CablePage> = {
  en: {
    title: 'Cable Tension and Elongation Calculator: Sling and Pull',
    description:
      'Tension and stress in a cable or a two-legged sling, elastic and thermal elongation, load movement, pull against friction on a slope, and the capstan equation.',
    h1: 'Cable tension and elongation under a load',
    eyebrow: 'Calculator',
    sub: 'A straight cable with a weight hung from it, a load dragged along a surface, or a line wound round a drum. The tension in the cable, or in each leg of a two-leg sling; its stress; how far it lengthens under the load and with a change of temperature, and where the load ends up; the pull that moves a block against friction and the best angle to pull at; and the ratio between the two ends of a cable on a drum.',
    facts: [
      { k: 'Cable', v: 'Straight, no weight' },
      { k: 'Problems', v: 'Sling, pull, drum' },
      { k: 'Results', v: 'Tension, stress, elongation' },
    ],
    toolHeading: 'The cable',
    method: {
      label: 'Method',
      title: 'How the cable is solved',
      paragraphs: [
        'A cable that is straight and has no weight carries one thing, a tension T along its length, the same at every point. It cannot push, so T is never negative; where equilibrium would ask a cable to push, the page says so and gives no number. The three problems are solved separately and share one cable, described by its area A, its modulus E and its coefficient of thermal expansion α.',
        'In a sling a weight W hangs from the point where two legs meet, each leg a cable running up to its anchor at an angle from the horizontal. The point is in equilibrium when the two tensions, the weight and any horizontal force H sum to nothing along x and along y: two equations for two tensions. They come from statics alone, and the size and the material of the cable never enter them. For two legs at the same angle θ from the horizontal, with no H, each carries T = W/(2 sin θ). That grows without limit as the legs flatten: at 30° each leg carries the whole of W, and the nearer the legs come to vertical the nearer each tension comes to half of W. Two legs exactly vertical lie on one line and the load cannot be split between them, so they are refused. With unequal angles, or with an H, the same two equations are solved for the two tensions. A single leg has no second equation to meet: it takes the direction of the combined pull of the weight and the horizontal force, so its angle comes out of the calculation and T = √(W² + H²).',
        'With its tension known, the rest is elastic arithmetic. The stress is σ = T/A and the strain ε = σ/E. Over a length L the cable lengthens by δ = TL/(AE), which is εL. For a rope, A is the metallic area, a fraction of the circle its diameter draws: the page takes A = kd², with a factor k for each construction, and πd²/4 for a solid round.',
        'The materials, ropes and strands offered carry typical values of modulus, coefficient of expansion and metallic-area factor. They are for a first estimate and no more; the value to use is the manufacturer’s for the cable you have, typed in place of the typical one. A wire rope is the case to watch: with a steel core its modulus in service is about half that of the steel of its wires, and with a fibre core about two fifths, because the strands straighten and bed against each other as the load comes on. With the modulus of the steel, the stretch of a steel-core wire rope comes out about half of what it really is, and less than half for a fibre-core rope.',
        'A change of temperature ΔT lengthens a cable that is unrestrained by δ = αLΔT, and the stretch the page gives is that plus the elastic one. If both ends cannot move at all, the cable cannot change its length and the change of temperature shows up as a force, EAαΔT: compression when it warms, which a cable cannot carry, so it goes slack, and tension when it cools. The page gives this force for each cable as if the ends of that cable were held, and adds it to the tension from the load to show what the cable would carry.',
        'Each leg of a sling lengthens by its own δ, and the load point moves. To first order the move d obeys −u · d = δ for each leg, where u is the unit vector from the load point to the anchor: the distance from an anchor grows by the stretch of its leg. The page also gives the exact position, the point where two circles meet, centred on the anchors with the stretched lengths of the legs as radii, the one near the starting point. The two agree when the stretch is small beside the legs, and their difference is the error of the first-order method. Because the legs have turned, the tensions are no longer those of the first geometry; the page works them out again in the displaced position, as a second-order result, and gives the change. A single leg moves along itself by its stretch, exactly.',
        'To pull a block against friction, the block weighs W and rests on a surface that rises at θ along the direction of the pull; the cable pulls it at an angle φ above the surface, which is not the angle above the horizontal (that is θ + φ). The cable lifts the block by T sin φ, so the force pressing it on the surface is N = W cos θ − T sin φ, and friction is μN. Along the surface, with the block about to move or moving at constant speed, T cos φ = W sin θ + μN. Eliminating N gives T = (sin θ + μ cos θ)W/(cos φ + μ sin φ). Two coefficients are used: the static one for the pull that starts the motion and the kinetic one for the pull that keeps it going. With an acceleration a along the path, the inertia a/g joins the friction term in the numerator: T = (sin θ + μ cos θ + a/g)W/(cos φ + μ sin φ). Where the cable holds the block back as it moves the other way, down a slope for instance, friction acts the other way too, the terms in μ and in a/g change sign, and a is taken in the direction of travel: T = (sin θ − μ cos θ − a/g)W/(cos φ − μ sin φ). That tension is the one that holds the block: with less the block slides, with more it is held. So for a block going against the pull the three cases below are the tension that keeps it from starting to slide, the one that lowers it at constant speed and the one that lets it speed up.',
        'Only the denominator depends on φ, and it is greatest where tan φ = μ. The pull is least, then, with the cable at the friction angle above the surface, φ = arctan μ, whatever the slope and whatever the acceleration, as long as the block stays on the surface there. At that angle the denominator is √(1 + μ²) and T = (sin θ + μ cos θ)W/√(1 + μ²). Where μ(sin θ + a/g) is more than cos θ, that angle would lift the block off (N would be negative): the least tension that keeps it on the surface is then at the lift-off angle itself, where N is zero and T = W cos θ / sin φ, and the page gives that angle and that tension in place of φ = arctan μ. A cable that restrains a block going down does best the same angle below the surface, φ = −arctan μ. The curve of T against φ that the page draws is flat near that minimum, so a few degrees either way change little.',
        'Some cases make the formula mean nothing, or make it unnecessary, and the page says which. If the T it asks for makes N negative, the block would come off the surface and there is no friction to speak of: the case is refused, with the angle past which the cable lifts the block, which at rest or at constant speed is the angle at which the cable is vertical. If cos φ + μ sin φ is zero or less, as when the cable presses the block into the surface at a steep angle, the harder it pulls the harder friction grips, no tension moves the block, and the page says the cable jams. That is for a block pulled along. For a block going against the pull the same sign means the opposite: the cable lifts the block as it pulls, friction grips less, and a block that slides by itself cannot be held at that angle by any tension, which the page says. And where gravity along the surface already beats friction in the direction of travel, no pull is needed and the block moves by itself: the page then gives the tension of a cable that holds it back. Where nothing opposes the motion at all, as on level ground without friction, the page says that no pull is needed.',
        'The page solves up to three pulls: the one that starts the motion (static coefficient), the one that keeps it moving at constant speed (kinetic coefficient) and, when an acceleration is entered, the one that gives it that acceleration. The largest is the one that governs, and the stress and the stretch of the cable are worked out at that tension, with the section, the length and the temperature change given.',
        'A cable wrapped over a drum that does not turn, through a wrap angle β in radians, is on the point of slipping when the tensions at its ends obey T_big = e^(μβ) T_small. It comes from one small element: over an arc dβ the tension changes by dT = μT dβ, and adding up the arcs gives the exponential. The radius of the drum does not appear, only the angle wrapped and the friction coefficient, static where the cable is about to slip and kinetic where it slides. Any ratio up to that one is held by friction; it is the limit. Every full turn multiplies the ratio by the same factor, e^(2πμ). Exactly one of the four quantities, the two tensions, μ and the wrap, is left blank and the page solves for it. The force of the cable on the drum is the vector sum of the two tensions.',
        'Three cases that have a closed form, for checking the answers by hand.',
        'A cable of length L, area A and modulus E hangs vertically with a weight W: T = W, σ = W/A and δ = WL/(AE). Held at both ends and cooled by ΔT, the same cable carries a tension EAαΔT. In a sling of two legs at θ above the horizontal, one each side, T = W/(2 sin θ) in each leg, and at 30° that is W.',
        'A block pulled along level ground at the best angle, φ = arctan μ, takes T = μW/√(1 + μ²), and the force pressing it on the ground is N = W/(1 + μ²).',
        'On a drum the ratio for n turns is e^(2πnμ): the ratio for two turns is the square of the ratio for one.',
      ],
    },
    assumes: {
      title: 'What it assumes',
      items: [
        'The cable is straight between its ends and has no weight. It does not sag, and its own weight counts as a load only when you enter it. A cable that hangs in a curve under its own weight is another problem, the one the calculator for cable sag and pretension in the list is for.',
        'The material is linear elastic: stress is proportional to strain, with one modulus. The area and the modulus are those of the cable as a whole, which for a rope means the metallic area and the modulus in service, not the steel’s.',
        'Geometry is first order, the angles and lengths as entered, except where the page says exact: the position of the load point of a sling, and the tensions worked out again there.',
        'The cable is flexible and its ends turn freely, so it carries tension and nothing else. Bending over a sheave, a pin or a fitting is not modelled.',
        'A change of temperature is the same along the whole cable and in every leg, and it is a difference between two temperatures, not a reading.',
        'The friction coefficient is a number you enter. It is Coulomb friction, a force proportional to the normal force and independent of speed and of contact area. It belongs to a pair of surfaces in a given condition, wet or dry, clean or rusted, and not to a surface by itself, so the value to use is yours to find. The static coefficient is usually the larger of the two, and the page warns when it is not.',
        'The load is static, or accelerates uniformly along the surface if you enter an acceleration. Shock, snatch, swinging and vibration are not in the answer.',
        'The drum is rigid and fixed, the cable does not stretch on it, and the friction is the same all along the wrap.',
      ],
    },
    limits: {
      title: 'What it leaves out',
      items: [
        'It gives numbers and no verdict. No code is applied and no factor is put on a load. Where you enter a breaking force, the page gives the ratio of it to the tension, and the breaking force that a factor you choose asks for; choosing the cable, the sling or the fitting for the job is yours and the manufacturer’s.',
        'No end fittings, no terminations and no sheaves. A termination, a clamp, or a bend round a pin changes what a cable can carry, and none of it is modelled, nor any loss of efficiency. The working load limit and the least bend diameter are the manufacturer’s.',
        'Only the elastic stretch is given, at the modulus in service. The stretch a new rope takes the first time it is loaded, as its strands settle, and which pre-stretching removes, is not modelled, nor is creep.',
        'A strain of more than one per cent is flagged, since the first-order results are least reliable there.',
        'A sling has two legs at most, meeting at one point, with one weight and one horizontal force on it. Three or four legs sharing a load depend on how long and how stiff each is, and the page does not solve them, nor a cable over a pulley, nor a load that is not hung from a single point.',
        'The pull is of one block on one straight surface, the cable making a fixed angle with it. The block is not followed as the cable changes direction, and nothing rolls, tips, or sticks and slips.',
        'The drum is one fixed drum with one coefficient all the way round. Several drums in a row, a grooved sheave, where the groove adds to the grip, and a cable that crosses itself are not solved.',
        'The force that a restrained cable would carry from a change of temperature is that of a cable whose two ends are held, which the legs of a sling are not, since the load point moves. The tensions of a sling after the move are given separately, in the displaced geometry.',
        'A case with no answer is not solved, and the page says why: two legs on one line, a leg that would have to push, a pull that would lift the block, a cable that jams, a drum with none of the four quantities blank or with more than one. A value out of its range is flagged on its field, and results wait for it to be put right.',
      ],
    },
    signs: {
      title: 'Signs, units and how to read the results',
      items: [
        'Tension is positive. A cable is never in compression: a tension of zero, or a note that a cable goes slack, is how a cable that would have to push shows up.',
        'In a sling, x is positive to the right of the load point and y upward from it. A leg is given by its angle from the horizontal, from 0 to 90 degrees, and by the side of the load point its anchor is on. The weight acts downward, and a positive horizontal force pushes the load point to the right, so a lone leg then slopes up to the left.',
        'A stretch is positive when the cable lengthens, and a change of temperature is positive for a rise. The move of the load point has a part in x and a part in y, y positive upward: a load that drops has a negative y.',
        'In the pull, the surface angle θ is positive when the surface rises in the direction of the pull and negative when it falls. The cable angle φ is measured from the surface, positive when the cable lifts the block and negative when it presses it down. Whether the block travels with the pull or against it decides which way friction acts, and an acceleration is taken in the direction of travel, positive when the block speeds up.',
        'For the start, the run and the acceleration, the pull gives the tension, the normal force N, the friction force μN, and the parts of the tension that lift the block and that drag it along. A block that moves by itself, a block that cannot be held, a cable that jams, a case that needs no pull and a pull that would lift the block are each named, with the numbers that matter.',
        'On the drum, the wrap is entered in degrees or in turns and turned into radians before the exponent is formed. The larger tension is on the side of the load, and the smaller on the side held by hand.',
        'Where a breaking force is entered, the page gives its ratio to the tension; a factor n asks for a breaking force n times the tension; and a stress limit that you enter asks for an area T over that stress, and the diameter of the solid round with that area. They are arithmetic on what you enter and not a finding.',
        'Forces come in a small unit and a large one, pounds-force and kips or newtons and kilonewtons. Lengths of cable are in feet or metres, diameters, areas and stretches in inches or millimetres, and stress and modulus in ksi, or in megapascals and gigapascals, whichever force unit is chosen. A change of temperature is in degrees Fahrenheit or Celsius.',
        'What you enter is written after #k= in the web address, and the same address brings the case back. Each of the three problems keeps its own entries, so that switching from one to another loses nothing.',
      ],
    },
    disclaimer: beamStrings.en.page.disclaimer,
    sheet: {
      kind: beamStrings.en.page.sheet.kind,
      credit: 'Produced with the cable calculator of {firm} — {address}',
      margin: beamStrings.en.page.sheet.margin,
    },
    back: 'All calculators',
    noscript: 'This page needs scripts to calculate; without them it shows only its example. With scripts on, the cable is worked out on your own computer and what you type stays there.',
  },
  es: {
    title: 'Calculadora de cables y eslingas: tensión y alargamiento',
    description:
      'Tensión y esfuerzo en un cable o una eslinga de dos ramales, alargamiento elástico y térmico, arrastre con fricción en una pendiente y ecuación del cabrestante.',
    h1: 'Tensión y alargamiento de cables bajo una carga',
    eyebrow: 'Calculadora',
    sub: 'Un cable recto del que cuelga un peso, una carga arrastrada sobre una superficie o una línea enrollada en un tambor. La tensión en el cable, o en cada ramal de una eslinga de dos ramales; su esfuerzo; cuánto se alarga con la carga y con un cambio de temperatura, y dónde queda la carga; el tiro que mueve un bloque contra la fricción y el mejor ángulo para jalarlo; y la relación entre los dos extremos de un cable en un tambor.',
    facts: [
      { k: 'Cable', v: 'Recto, sin peso' },
      { k: 'Problemas', v: 'Eslinga, tiro, tambor' },
      { k: 'Resultados', v: 'Tensión, esfuerzo, alargamiento' },
    ],
    toolHeading: 'El cable',
    method: {
      label: 'Método',
      title: 'Cómo se resuelve el cable',
      paragraphs: [
        'Un cable recto y sin peso transmite una sola cosa, una tensión T a lo largo de su longitud, igual en todos sus puntos. No puede empujar, de modo que T nunca es negativa; cuando el equilibrio le pediría a un cable que empujara, la página lo dice y no da ningún número. Los tres problemas se resuelven por separado y comparten un mismo cable, descrito por su área A, su módulo E y su coeficiente de dilatación térmica α.',
        'En una eslinga, un peso W cuelga del punto donde se unen dos ramales, cada uno un cable que sube hasta su anclaje con un ángulo respecto a la horizontal. El punto está en equilibrio cuando las dos tensiones, el peso y cualquier fuerza horizontal H se anulan entre sí según x y según y: dos ecuaciones para dos tensiones. Salen de la estática sola, y el tamaño y el material del cable no intervienen en ellas. Con dos ramales del mismo ángulo θ respecto a la horizontal y sin H, cada uno lleva T = W/(2 sen θ). Eso crece sin límite a medida que los ramales se aplanan: a 30° cada ramal lleva todo W, y cuanto más cerca de la vertical están los ramales, más se acerca cada tensión a la mitad de W. Dos ramales exactamente verticales están en una misma recta y la carga no puede repartirse entre ellos, así que se rechazan. Con ángulos distintos, o con una H, las mismas dos ecuaciones se resuelven para las dos tensiones. Un ramal solo no tiene una segunda ecuación que cumplir: toma la dirección del tirón combinado del peso y de la fuerza horizontal, por lo que su ángulo sale del cálculo y T = √(W² + H²).',
        'Con su tensión conocida, el resto es aritmética elástica. El esfuerzo es σ = T/A y la deformación unitaria ε = σ/E. Sobre una longitud L el cable se alarga δ = TL/(AE), que es εL. En un cable de acero, A es el área metálica, una fracción del círculo que dibuja su diámetro: la página toma A = kd², con un factor k para cada construcción, y πd²/4 para una barra redonda maciza.',
        'Los materiales, cables de acero y torones que se ofrecen traen valores típicos de módulo, coeficiente de dilatación y factor de área metálica. Son para una primera estimación y nada más; el valor que debe usarse es el del fabricante del cable que usted tiene, escrito en lugar del típico. Un cable de acero es el caso que hay que vigilar: con alma de acero su módulo en servicio ronda la mitad del acero de sus alambres, y con alma de fibra unos dos quintos, porque al entrar la carga los torones se alinean y se acomodan entre sí. Con el módulo del acero, el alargamiento de un cable con alma de acero sale cerca de la mitad del real, y menos de la mitad con alma de fibra.',
        'Un cambio de temperatura ΔT alarga un cable que no está restringido en δ = αLΔT, y el alargamiento que da la página es ese más el elástico. Si los dos extremos no pueden moverse en absoluto, el cable no puede cambiar de longitud y el cambio de temperatura aparece como una fuerza, EAαΔT: de compresión cuando se calienta, que un cable no puede llevar y por eso se afloja, y de tensión cuando se enfría. La página da esa fuerza para cada cable como si los extremos de ese cable estuvieran sujetos, y la suma a la tensión de la carga para mostrar lo que el cable llevaría.',
        'Cada ramal de una eslinga se alarga su propio δ, y el punto de carga se desplaza. A primer orden, el desplazamiento d obedece a −u · d = δ para cada ramal, donde u es el vector unitario del punto de carga al anclaje: la distancia a un anclaje crece lo que se alarga su ramal. La página da también la posición exacta, el punto donde se cortan dos circunferencias con centro en los anclajes y como radios las longitudes alargadas de los ramales, el más cercano al punto inicial. Las dos coinciden cuando el alargamiento es pequeño frente a los ramales, y su diferencia es el error del método de primer orden. Como los ramales han girado, las tensiones ya no son las de la primera geometría; la página las calcula de nuevo en la posición desplazada, como resultado de segundo orden, y da el cambio. Un ramal solo se mueve a lo largo de sí mismo lo que se alarga, de forma exacta.',
        'Para jalar un bloque contra la fricción, el bloque pesa W y descansa sobre una superficie que sube un ángulo θ en la dirección del tiro; el cable lo jala con un ángulo φ sobre la superficie, que no es el ángulo sobre la horizontal (ese es θ + φ). El cable levanta el bloque con T sen φ, así que la fuerza que lo aprieta contra la superficie es N = W cos θ − T sen φ, y la fricción es μN. A lo largo de la superficie, con el bloque a punto de moverse o moviéndose a velocidad constante, T cos φ = W sen θ + μN. Eliminando N queda T = (sen θ + μ cos θ)W/(cos φ + μ sen φ). Se usan dos coeficientes: el estático para el tiro que inicia el movimiento y el cinético para el que lo mantiene. Con una aceleración a a lo largo de la trayectoria, la inercia a/g se suma al término de fricción del numerador: T = (sen θ + μ cos θ + a/g)W/(cos φ + μ sen φ). Cuando el cable retiene al bloque mientras este se mueve en sentido contrario, cuesta abajo por ejemplo, la fricción también actúa al revés, los términos en μ y en a/g cambian de signo, y a se toma en el sentido del movimiento: T = (sen θ − μ cos θ − a/g)W/(cos φ − μ sen φ). Esa tensión es la que retiene al bloque: con menos se desliza, con más queda retenido. Así, para un bloque que va contra el tiro, los tres casos de más abajo son la tensión que evita que empiece a deslizar, la que lo baja a velocidad constante y la que lo deja acelerar.',
        'Solo el denominador depende de φ, y es máximo donde tan φ = μ. El tiro es mínimo, entonces, con el cable en el ángulo de fricción sobre la superficie, φ = arctan μ, sea cual sea la pendiente y sea cual sea la aceleración, mientras el bloque siga apoyado en la superficie con ese ángulo. Ahí el denominador es √(1 + μ²) y T = (sen θ + μ cos θ)W/√(1 + μ²). Donde μ(sen θ + a/g) es mayor que cos θ, ese ángulo despegaría el bloque (N sería negativa): la menor tensión que lo mantiene apoyado está entonces en el propio ángulo de despegue, donde N es cero y T = W cos θ / sen φ, y la página da ese ángulo y esa tensión en lugar de φ = arctan μ. Un cable que frena un bloque que baja rinde mejor con el mismo ángulo por debajo de la superficie, φ = −arctan μ. La curva de T contra φ que dibuja la página es plana cerca de ese mínimo, de modo que unos grados a un lado u otro cambian poco.',
        'Algunos casos hacen que la fórmula no signifique nada, o que no haga falta, y la página dice cuál. Si la T que pide hace negativa a N, el bloque se despegaría de la superficie y ya no hay fricción de la que hablar: el caso se rechaza, con el ángulo a partir del cual el cable levanta el bloque, que en reposo o a velocidad constante es el ángulo en que el cable está vertical. Si cos φ + μ sen φ es cero o menos, como cuando el cable aprieta el bloque contra la superficie con un ángulo pronunciado, cuanto más jala más agarra la fricción, ninguna tensión mueve el bloque y la página dice que el cable se autobloquea. Eso es para un bloque que se jala hacia delante. En un bloque que va contra el tiro el mismo signo significa lo contrario: el cable levanta el bloque al jalar, la fricción agarra menos, y un bloque que se desliza solo no puede retenerse con ese ángulo con ninguna tensión, y la página lo dice. Y donde la componente del peso paralela a la superficie ya vence a la fricción en el sentido del movimiento, no hace falta tiro y el bloque se mueve solo: la página da entonces la tensión de un cable que lo retiene. Donde nada se opone al movimiento, como en suelo horizontal sin fricción, la página dice que no hace falta tiro.',
        'La página resuelve hasta tres tiros: el que inicia el movimiento (coeficiente estático), el que lo mantiene a velocidad constante (coeficiente cinético) y, cuando se escribe una aceleración, el que le da esa aceleración. El mayor es el que gobierna, y el esfuerzo y el alargamiento del cable se calculan con esa tensión, con la sección, la longitud y el cambio de temperatura dados.',
        'Un cable enrollado sobre un tambor que no gira, con un ángulo de envolvimiento β en radianes, está a punto de deslizar cuando las tensiones en sus extremos guardan la relación T_mayor = e^(μβ) T_menor. Sale de un elemento pequeño: en un arco dβ la tensión cambia dT = μT dβ, y sumando los arcos resulta la exponencial. El radio del tambor no aparece, solo el ángulo de envolvimiento y el coeficiente de fricción, estático donde el cable está a punto de deslizar y cinético donde desliza. Cualquier relación hasta esa la sostiene la fricción; es el límite. Cada vuelta completa multiplica la relación por el mismo factor, e^(2πμ). Exactamente una de las cuatro cantidades, las dos tensiones, μ y el ángulo de envolvimiento, se deja en blanco y la página la resuelve. La fuerza del cable sobre el tambor es la suma vectorial de las dos tensiones.',
        'Tres casos de solución cerrada, para comprobar las respuestas a mano.',
        'Un cable de longitud L, área A y módulo E cuelga en vertical con un peso W: T = W, σ = W/A y δ = WL/(AE). Sujeto por los dos extremos y enfriado ΔT, el mismo cable lleva una tensión EAαΔT. Una eslinga con dos ramales a θ sobre la horizontal, uno a cada lado, tiene T = W/(2 sen θ) en cada ramal, y a 30° eso es W.',
        'Un bloque jalado sobre suelo horizontal con el mejor ángulo, φ = arctan μ, necesita T = μW/√(1 + μ²), y la fuerza que lo aprieta contra el suelo es N = W/(1 + μ²).',
        'En un tambor la relación para n vueltas es e^(2πnμ): la relación de dos vueltas es el cuadrado de la de una.',
      ],
    },
    assumes: {
      title: 'Qué supone',
      items: [
        'El cable es recto entre sus extremos y no tiene peso. No se comba, y su propio peso es una carga solo si usted lo introduce. Un cable que cuelga en curva bajo su propio peso es otro problema, el de la calculadora de flecha y pretensión de cables de la lista.',
        'El material es elástico lineal: el esfuerzo es proporcional a la deformación, con un solo módulo. El área y el módulo son los del cable entero, lo que en un cable de acero significa el área metálica y el módulo en servicio, no el del acero.',
        'La geometría es de primer orden, con los ángulos y las longitudes como se escriben, salvo donde la página dice exacta: la posición del punto de carga de una eslinga, y las tensiones calculadas de nuevo allí.',
        'El cable es flexible y sus extremos giran con libertad, de modo que lleva tensión y nada más. La flexión sobre una polea, un pasador o un herraje no se modela.',
        'Un cambio de temperatura es igual a lo largo de todo el cable y en cada ramal, y es una diferencia entre dos temperaturas, no una lectura.',
        'El coeficiente de fricción es un número que usted escribe. Es fricción de Coulomb, una fuerza proporcional a la fuerza normal e independiente de la velocidad y del área de contacto. Pertenece a un par de superficies en una condición dada, mojadas o secas, limpias u oxidadas, y no a una superficie sola, de modo que el valor que debe usarse lo tiene que encontrar usted. El coeficiente estático suele ser el mayor de los dos, y la página avisa cuando no lo es.',
        'La carga es estática, o se acelera de modo uniforme a lo largo de la superficie si usted escribe una aceleración. El choque, el tirón brusco, el balanceo y la vibración no están en la respuesta.',
        'El tambor es rígido y fijo, el cable no se estira sobre él y la fricción es la misma a todo lo largo del envolvimiento.',
      ],
    },
    limits: {
      title: 'Qué no hace',
      items: [
        'Da números y ningún veredicto. No se aplica ninguna norma y no se mayora ninguna carga. Donde usted escribe una carga de rotura, la página da su relación con la tensión y la carga de rotura a que obliga un factor que usted elija; elegir el cable, la eslinga o el herraje para el trabajo les corresponde a usted y al fabricante.',
        'Sin herrajes de extremo, sin terminales y sin poleas. Un terminal, una abrazadera o una curva alrededor de un pasador cambian lo que un cable puede llevar, y nada de eso se modela, como tampoco ninguna pérdida de eficiencia. La carga de trabajo límite y el diámetro mínimo de curvatura son los del fabricante.',
        'Solo se da el alargamiento elástico, con el módulo en servicio. El alargamiento que toma un cable nuevo la primera vez que se carga, al asentarse sus torones, y que el preestirado elimina, no se modela, ni tampoco la fluencia lenta.',
        'Una deformación unitaria de más de uno por ciento se señala, porque los resultados de primer orden son menos fiables ahí.',
        'Una eslinga tiene dos ramales como máximo, que se unen en un punto, con un peso y una fuerza horizontal sobre él. Tres o cuatro ramales que comparten una carga dependen de lo largo y lo rígido que sea cada uno, y la página no los resuelve, ni un cable sobre una polea, ni una carga que no cuelgue de un solo punto.',
        'El tiro es el de un bloque sobre una superficie recta, con el cable formando con ella un ángulo fijo. No se sigue al bloque mientras el cable cambia de dirección, y nada rueda, se vuelca ni se pega y se suelta.',
        'El tambor es un tambor fijo con un solo coeficiente en todo el envolvimiento. Varios tambores seguidos, una polea acanalada, donde la ranura aumenta el agarre, y un cable que se cruza consigo mismo no se resuelven.',
        'La fuerza que llevaría un cable restringido por un cambio de temperatura es la de un cable con los dos extremos sujetos, y los ramales de una eslinga no lo están, pues el punto de carga se desplaza. Las tensiones de una eslinga después del desplazamiento se dan aparte, en la geometría desplazada.',
        'Un caso sin respuesta no se resuelve, y la página dice por qué: dos ramales en una misma recta, un ramal que tendría que empujar, un tiro que despegaría el bloque, un cable que se autobloquea, un tambor con ninguna de las cuatro cantidades en blanco o con más de una. Un valor fuera de su rango lleva una marca en su campo, y no hay resultados hasta que se corrija.',
      ],
    },
    signs: {
      title: 'Signos, unidades y cómo leer los resultados',
      items: [
        'La tensión es positiva. Un cable nunca está a compresión: una tensión cero, o un aviso de que un cable se afloja, es como aparece un cable que tendría que empujar.',
        'En una eslinga, x es positiva a la derecha del punto de carga e y hacia arriba desde él. Un ramal se da por su ángulo respecto a la horizontal, de 0 a 90 grados, y por el lado del punto de carga en que está su anclaje. El peso actúa hacia abajo, y una fuerza horizontal positiva empuja el punto de carga hacia la derecha, de modo que un ramal solo sube entonces hacia la izquierda.',
        'Un alargamiento es positivo cuando el cable se alarga, y un cambio de temperatura es positivo si sube. El desplazamiento del punto de carga tiene una parte en x y otra en y, con y positiva hacia arriba: una carga que baja tiene una y negativa.',
        'En el tiro, el ángulo de la superficie θ es positivo cuando la superficie sube en la dirección del tiro y negativo cuando baja. El ángulo del cable φ se mide desde la superficie, positivo cuando el cable levanta el bloque y negativo cuando lo aprieta hacia abajo. Que el bloque se mueva con el tiro o contra él decide hacia dónde actúa la fricción, y una aceleración se toma en el sentido del movimiento, positiva cuando el bloque acelera.',
        'Para el arranque, la marcha y la aceleración, el tiro da la tensión, la fuerza normal N, la fuerza de fricción μN y las partes de la tensión que levantan el bloque y que lo arrastran. Un bloque que se mueve solo, un bloque que no puede retenerse, un cable que se autobloquea, un caso que no necesita tiro y un tiro que despegaría el bloque se nombran cada uno, con los números que importan.',
        'En el tambor, el ángulo de envolvimiento se escribe en grados o en vueltas y se pasa a radianes antes de formar el exponente. La tensión mayor está del lado de la carga, y la menor del lado que se sostiene a mano.',
        'Donde se escribe una carga de rotura, la página da su relación con la tensión; un factor n pide una carga de rotura n veces la tensión; y un límite de esfuerzo que usted escriba pide un área igual a T entre ese esfuerzo, y el diámetro de la barra redonda maciza con esa área. Son aritmética sobre lo que usted escribe y no un hallazgo.',
        'Las fuerzas vienen en una unidad pequeña y una grande, libras-fuerza y kips o newtons y kilonewtons. Las longitudes del cable van en pies o metros, los diámetros, las áreas y los alargamientos en pulgadas o milímetros, y el esfuerzo y el módulo en ksi, o en megapascales y gigapascales, sea cual sea la unidad de fuerza elegida. Un cambio de temperatura va en grados Fahrenheit o Celsius.',
        'Lo que usted escribe se anota tras #k= en la dirección web, y con esa misma dirección el caso vuelve a abrirse. Cada uno de los tres problemas conserva sus propios datos, de modo que pasar de uno a otro no pierde nada.',
      ],
    },
    disclaimer: beamStrings.es.page.disclaimer,
    sheet: {
      kind: beamStrings.es.page.sheet.kind,
      credit: 'Elaborada con la calculadora de cables de {firm} — {address}',
      margin: beamStrings.es.page.sheet.margin,
    },
    back: 'Todas las calculadoras',
    noscript: 'Esta página necesita scripts para calcular; sin ellos solo muestra su ejemplo. Con ellos, su propio navegador resuelve el cable y lo que usted escribe se queda en él.',
  },
};
