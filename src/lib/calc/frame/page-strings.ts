import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings, type BeamPage } from '../beam/strings';

/**
 * The words of the plane frame calculator's PAGE (/resources/plane-frame-analysis),
 * in English and in Spanish: what a search result shows, the hero, and the
 * notes under the tool. Read by the server view only (FrameView). The tool's
 * own words are in strings.ts and travel to the browser as a prop; these never
 * do.
 *
 * THE SAME SHAPE as the first calculator's page text (`BeamPage`,
 * beam/strings.ts), because one view prints all the calculators
 * (CalculatorPage). That shape has four lists of notes, and this page puts
 * its sections in them like this:
 *   - `method`  how the frame is solved: the member stiffness, the loads along
 *               a member, hinges, supports, the diagrams, the checks and the
 *               count of indeterminacy, and the cases to check the page by hand;
 *   - `assumes` what the model takes to be true of the frame;
 *   - `limits`  what it leaves out, what it refuses and the limits of size;
 *   - `signs`   signs, units, the temperature and settlement conventions, and
 *               how to read the results.
 * NOT the same sentences: no run of six words here is on any other
 * calculator's page, in its form, or in the catalogue's line for this one
 * (views/frame.test.ts compares them).
 *
 * THE LEGAL WORDS ARE SAID ONCE. The disclaimer, what the printed sheet is
 * called and the line in the margin of every printed page are the first
 * calculator's, taken by reference, as the others take them. Only the credit
 * names this calculator.
 *
 * WHAT THE NOTES ARE HELD TO. The engine (lib/calc/frame) and the form's model
 * (model.ts): views/frame.test.ts solves every case printed under "How the
 * frame is solved" with the engine and compares it with the formula written
 * here (the propped cantilever, the fixed-fixed beam, the point load's
 * fixed-end moments, the fixed-base portal with a stiff beam, a settlement, a
 * restrained temperature change, a gradient, the three-hinged gable), the
 * worked example of the signs, the example's numbers against the hand solution,
 * and the limits against the engine's.
 *
 * WHAT IT IS NOT IS SAID AS PLAINLY AS WHAT IT IS. A first-order, linear
 * elastic analysis of prismatic members: no buckling, no P–Δ, no shear
 * deformation, no design check. The page gives forces, moments, reactions and
 * displacements; it does not size a member, check a connection or apply a
 * code, and it names none. Words of verdict ("adequate", "safe", "passes"),
 * the word "free" and any figure that is not in a formula, a limit or the
 * example are held out by the test.
 *
 * THE OTHER CALCULATORS. A frame whose members are all pinned at both ends is
 * a truss, which has a calculator of its own in the catalogue ("Truss member
 * forces"): named as the catalogue names it, and the test reads that name from
 * the catalogue.
 *
 * Spanish as a Latin-American structural engineer writes it: "pórtico", "nudo",
 * "barra", "empotramiento", "rótula", "momento flector", "fuerza cortante",
 * "fuerza axial", "deformada", "luz", "apoyo", formal "usted", and the true
 * minus "−" in sentences.
 */
export type FramePage = BeamPage;

export const framePage: Record<Lang, FramePage> = {
  en: {
    title: 'Plane Frame Analysis: Moment, Shear and Axial Diagrams',
    description:
      'Moment, shear and axial force diagrams, reactions and deflections of a 2D portal frame by direct stiffness; hinges, supports that settle, temperature.',
    h1: 'Plane frame analysis with diagrams, reactions and deflections',
    eyebrow: 'Calculator',
    sub: 'A plane frame of straight members joined at nodes, rigidly or with a hinge at either end, held by fixed, pinned, roller, guided or elastic supports. Load its nodes, load its members, warm them, or let a support settle; read the bending moment, shear and axial force diagrams, the reactions and the deflected shape. Start from a portal, a gable, an L-frame, a column or a beam on columns, or draw your own, up to 50 nodes.',
    facts: [
      { k: 'Frame', v: 'Rigid or hinged joints' },
      { k: 'Loads', v: 'Nodal, member, temperature, settlement' },
      { k: 'Results', v: 'Diagrams, reactions, deflections' },
    ],
    toolHeading: 'The frame',
    method: {
      label: 'Method',
      title: 'How the frame is solved',
      paragraphs: [
        'Direct stiffness, the displacement method in matrix form, solves the frame. Every node has three displacements: one along x, one along y and a rotation. Every member contributes a 6 × 6 stiffness matrix written in its own axes. EA/L ties the two ends axially. 12EI/L³ is the transverse force at one end for a unit transverse displacement of that end, 6EI/L² the transverse force for a unit rotation (or the moment for a unit displacement), 4EI/L the moment at an end for a unit rotation of the same end, and 2EI/L the moment that rotation induces at the far end. The matrix is turned to the global axes by the member’s direction cosines and added into the frame’s matrix at the rows of the member’s two nodes.',
        'A load along a member is first replaced by its fixed-end forces, the forces and moments that would hold both ends of the member against any movement: wL²/12 at each end for a uniform load w over the length L, PL/8 for a point load P at mid-length, and, for P at distances a and b from the first and the second end, Pab²/L² and Pa²b/L² there. Their opposites are applied to the nodes with the nodal loads. A temperature change, a gradient and a couple are carried to the nodes in the same way.',
        'A hinge at the end of a member is handled by static condensation: the member’s own rotation at that end is eliminated from its matrix and from its fixed-end forces, so the member carries no moment into that node and turns there independently of the node. When every member at a node is hinged there, the node’s rotation is undetermined and the analysis warns of it.',
        'Supports are eliminated, not imitated with very stiff springs. A fixed support removes the three displacements of its node, a pin removes the two translations, and a roller removes the translation along one line, the line of its reaction, at any angle you give it: the node’s displacement is rewritten in the direction left unrestrained, which makes an inclined roller as exact as a horizontal one. A guide removes that translation and the rotation, and slides across. A spring adds its stiffness to the frame’s matrix, and a settlement is a displacement prescribed at the node, whose effect on the rest of the frame enters as load.',
        'The reduced system is solved for the node displacements, the end forces of every member follow from its end displacements and its loads, and the reactions come from the equilibrium of the supported nodes. The diagrams are not interpolated between nodes: N, V and M along a member are written from its end forces and its own loads, piece by piece, so that a point load or a couple appears as a jump and a distributed load as a line or a curve of the right degree. The deflected shape of a member is found by integrating M/EI twice along it from its end displacements.',
        'Before any solving the frame is tested for stability, which depends on geometry, hinges and supports and never on E, A or I, and its degree of indeterminacy is counted: 3 for each member plus the reaction components, less 3 equations for each node (2 at a node whose members are all hinged) and less 1 for each hinge. A degree of 0 is determinate: equilibrium alone gives every force, none of them depends on E, A or I, and so without section properties the forces and reactions are still given and the displacements are not. A degree above 0 is indeterminate, and then the forces depend on the stiffness of each member relative to the others. After the solution, the sums ΣFx, ΣFy and ΣM of loads and reactions and the equilibrium of every joint are checked, and a frame whose check is not met is not shown.',
        'Four groups of frames with textbook answers, to compare the calculator’s numbers with.',
        'A beam of length L, held fixed at one end and by a roller at the other, under w per unit length downward: the roller takes 3wL/8, the wall 5wL/8, the moment at the wall is wL²/8 hogging, and the largest sagging moment, 9wL²/128, lies 3L/8 from the roller. With both ends fixed the end moments are wL²/12 hogging and the moment at mid-length wL²/24 sagging.',
        'A portal with fixed feet, equal columns of height h, a span L and a beam so stiff, bending and axially, that its joints do not turn, under a horizontal load H at the beam: each column takes H/2 as shear, the moment is Hh/4 at the foot and at the top of each, and the feet carry vertical reactions of Hh/(2L), one up and one down.',
        'A beam fixed at both ends with one support settled by Δ and no load: the end moments are 6EIΔ/L² and the shear 12EIΔ/L³. A member held at both ends by supports that cannot move, warmed uniformly by ΔT, takes the compression N = −EAαΔT and no bending.',
        'A three-hinged gable, with pins at both feet and a hinge at the crown, of span L and rise f, carrying w on each unit of its horizontal projection: each foot pushes inward with a horizontal thrust of wL²/(8f) and a vertical reaction of wL/2.',
      ],
    },
    assumes: {
      title: 'What it assumes',
      items: [
        'The response is linear elastic and the analysis is first order: equilibrium is written on the undeformed frame and displacements are taken as small. Stiffness does not change with the axial force, so there is no P–Δ effect and no buckling load, and a slender column under a large compression is not flagged.',
        'Members are Euler–Bernoulli beam-columns: plane sections stay plane and perpendicular to the axis, and shear deformation is not included, which matters for deep members on short spans.',
        'Members are straight and prismatic, with one E, A and I over the whole length. A tapered or haunched member is modelled as several members of different sections.',
        'Axial stiffness is included, so members shorten and lengthen under axial force. A hand solution that treats members as inextensible, as moment distribution does, differs slightly. For the frame shown when the page first loads, the solver gives horizontal reactions of 0.311 and 9.689 kip where the inextensible hand solution gives 0.2 and 9.8; with the area made very large (10⁷ in², say) the calculator reproduces the hand answer.',
        'Loads act on nodes and on members, as entered. A member’s self-weight is not added: enter it as a uniform load on the member. Nothing is multiplied by a factor and no combination is formed, so run each combination as a case of its own.',
        'Connections are rigid or hinged. A semi-rigid connection, a panel zone, a joint of finite size and a base with flexibility of its own are not modelled; a spring support is the way to put in a stiffness known at a support.',
        'A temperature change acts as the unrestrained thermal strain of the member, α times the change, and produces force only where supports and the other members hold it back. A gradient needs the depth of the section. A determinate frame moves under temperature or a settlement and develops no force.',
        'The wide-flange sections and the two materials offered are typical values for a first estimate: use the properties of the section and the material actually specified.',
        'A frame whose members are all hinged at both ends is a truss, which has its own calculator in the catalogue, Truss member forces.',
      ],
    },
    limits: {
      title: 'What it leaves out',
      items: [
        'The results are forces, moments, reactions and displacements, and nothing beyond them: it applies no design code, multiplies no load by a factor and does not size a member or a connection. Whether a member will do is for you to decide.',
        'Up to 50 nodes, 100 members, 40 supports, 60 nodal loads and 120 member loads.',
        'A mechanism is refused, and the nodes that move are named. It means that a part of the frame can move with no member deforming, as with a pinned-base portal that has a hinge at the top of both columns. To cure it, brace the part that moves with another member or a support, or take out a hinge.',
        'A frame its supports cannot hold is refused as well: fewer than 3 reaction components, or 3 whose lines are all parallel or all cross at a single point, leave it able to move as a rigid body.',
        'An indeterminate frame is refused unless each member has a modulus, an area and an inertia; a determinate one is solved without them, with forces and reactions but no displacements.',
        'Stiffnesses that differ by many orders of magnitude, such as a nearly rigid member beside very flexible ones, or a very short member beside long ones, can leave the arithmetic with too few figures. The equilibrium check is then not met within its tolerance, and the frame is refused as ill-conditioned instead of being shown. A member shorter than one hundred-thousandth of the frame’s size is refused as too short.',
        'Two nodes in one place, two members between the same pair of nodes, a node with no member, separate pieces of frame, a load placed outside its member and a gradient on a member with no depth are each refused, with the entry named.',
        'A couple applied to a node at which all the members are hinged has nothing to resist it and is refused, unless a support holds the rotation there.',
      ],
    },
    signs: {
      title: 'Sign conventions, units and reading the output',
      items: [
        'Global axes: x to the right, y up. Gravity is a negative y load. An applied moment, a reaction moment and a rotation are positive counter-clockwise. The labels of nodes and members start at 1 and follow the order of their tables.',
        'Each member has axes of its own: x̄ runs from its first node to its second, and ȳ is x̄ turned 90° counter-clockwise, to its left. For a horizontal member drawn from left to right ȳ points up; drawn the other way round, down.',
        'N, the axial force, is positive in tension and negative in compression. V, the shear force, is positive when the loads and reactions on the piece of member between its first node and a cut push that piece toward +ȳ. M, the bending moment, is positive when it puts tension on the −ȳ side of the member, which on a horizontal member drawn left to right is its underside: a sagging moment.',
        'The moment diagram is drawn on the tension side, whichever way the member was drawn. The shear and axial diagrams are drawn on the +ȳ side where positive and on the other where negative.',
        'Worked example: a member from (0, 0) to (10, 0) ft, pinned at both ends, with 2 kip/ft downward. V is +10 kip at the left end, 0 at mid-length and −10 at the right end; M is 0, +25 and 0 kip·ft, and its diagram hangs below the member. Define the same member from its right end to its left and ȳ points down: M at mid-length reads −25 and V changes sign, while the drawn diagram does not change.',
        'A reaction is the force and moment the support exerts on the frame, along the global axes, positive toward +x and +y; a reaction moment is positive counter-clockwise. A roller’s reaction is also given along its own line.',
        'Displacements are positive toward +x and +y and rotations counter-clockwise, in radians. A settlement is entered along the global axes in inches or millimetres: a support that sinks has a negative dy, and dr is a rotation in radians. At a roller only the part of the settlement along its line counts.',
        'A uniform temperature change is the change in degrees, with α the strain per degree. A gradient is the temperature of the +ȳ face minus that of the −ȳ face, and needs the depth h of the member: a warmer +ȳ face bows a member that can deform toward +ȳ, and, held at both ends, gives the sagging moment EIαΔTg/h.',
        'US units: feet and kips, with line loads in kip/ft and moments in kip·ft; A in in², I in in⁴, E in ksi; section depths and settlements in inches; temperatures in °F. SI units: metres and kilonewtons, with kN/m and kN·m; A in mm², I in 10⁶ mm⁴, E in GPa; depths and settlements in millimetres; temperatures in °C.',
        'Everything entered is kept in the address after #f=, so that a copy of the address reopens the same frame.',
      ],
    },
    disclaimer: beamStrings.en.page.disclaimer,
    sheet: {
      kind: beamStrings.en.page.sheet.kind,
      credit: 'Produced with the plane frame calculator of {firm} — {address}',
      margin: beamStrings.en.page.sheet.margin,
    },
    back: 'All calculators',
    noscript: 'With scripts off, this page keeps the frame it opened with and cannot respond. Switch them on and the frame is analysed on your own device; nothing you enter is sent anywhere.',
  },
  es: {
    title: 'Análisis de pórticos planos: momento, cortante y axial',
    description:
      'Diagramas de momento, cortante y fuerza axial, reacciones y deformada de un pórtico 2D por rigidez directa; rótulas, asentamientos de apoyos, temperatura.',
    h1: 'Análisis de pórticos planos con diagramas, reacciones y deformada',
    eyebrow: 'Calculadora',
    sub: 'Un pórtico plano de barras rectas unidas en nudos, de forma rígida o con una rótula en cualquiera de sus extremos, sostenido por apoyos empotrados, articulados, de rodillo, guiados o elásticos. Cargue sus nudos, cargue sus barras, caliéntelas, o deje que un apoyo se asiente; lea los diagramas de momento flector, fuerza cortante y fuerza axial, las reacciones y la deformada. Parta de un pórtico simple, uno a dos aguas, un pórtico en L, una columna o una viga sobre columnas, o dibuje el suyo, hasta 50 nudos.',
    facts: [
      { k: 'Pórtico', v: 'Nudos rígidos o con rótula' },
      { k: 'Cargas', v: 'En nudos, en barras, temperatura, asentamiento' },
      { k: 'Resultados', v: 'Diagramas, reacciones, deformada' },
    ],
    toolHeading: 'El pórtico',
    method: {
      label: 'Método',
      title: 'Cómo se resuelve el pórtico',
      paragraphs: [
        'El pórtico se resuelve por el método de rigidez directa. Cada nudo tiene tres desplazamientos: uno según x, otro según y y un giro. Cada barra aporta una matriz de rigidez de 6 × 6 escrita en sus propios ejes. EA/L une los dos extremos en sentido axial. 12EI/L³ es la fuerza transversal en un extremo para un desplazamiento transversal unitario de ese extremo, 6EI/L² la fuerza transversal para un giro unitario (o el momento para un desplazamiento unitario), 4EI/L el momento en un extremo para un giro unitario del mismo extremo, y 2EI/L el momento que ese giro induce en el extremo lejano. La matriz se gira a los ejes globales con los cosenos directores de la barra y se suma a la matriz del pórtico en las filas de sus dos nudos.',
        'Una carga que actúa sobre una barra se reemplaza primero por sus fuerzas de empotramiento perfecto, las fuerzas y momentos que mantendrían inmóviles ambos extremos de la barra: wL²/12 en cada extremo para una carga uniforme w sobre la longitud L, PL/8 para una carga puntual P a media longitud y, para P a distancias a y b del primer y del segundo extremo, Pab²/L² y Pa²b/L² en ellos. Sus opuestos se aplican a los nudos junto con las cargas nodales. Un cambio de temperatura, un gradiente y un par se llevan a los nudos de la misma manera.',
        'Una rótula en el extremo de una barra se trata por condensación estática: el giro propio de la barra en ese extremo se elimina de su matriz y de sus fuerzas de empotramiento, de modo que la barra no transmite momento a ese nudo y gira allí con independencia de él. Cuando todas las barras de un nudo tienen rótula en él, el giro del nudo queda indeterminado y el análisis lo advierte.',
        'Los apoyos se eliminan, no se imitan con resortes muy rígidos. Un empotramiento quita los tres desplazamientos de su nudo, una articulación quita las dos traslaciones, y un rodillo quita la traslación según una recta, la de su reacción, con el ángulo que usted dé: el desplazamiento del nudo se reescribe en la dirección que queda sin restricción, y por eso un rodillo inclinado es tan exacto como uno horizontal. Una guía quita esa traslación y el giro, y desliza en el sentido transversal. Un resorte suma su rigidez a la matriz del pórtico, y un asentamiento es un desplazamiento impuesto en el nudo, cuyo efecto sobre el resto del pórtico entra como carga.',
        'El sistema reducido se resuelve para los desplazamientos de los nudos, las fuerzas en los extremos de cada barra salen de sus desplazamientos extremos y de sus cargas, y las reacciones salen del equilibrio de los nudos apoyados. Los diagramas no se interpolan entre nudos: N, V y M en cada punto de una barra se escriben a partir de sus fuerzas extremas y de sus propias cargas, tramo por tramo, de modo que una carga puntual o un par aparece como un salto y una carga distribuida como una recta o una curva del grado correcto. La deformada de una barra se obtiene integrando M/EI dos veces a lo largo de ella desde los desplazamientos de sus extremos.',
        'Antes de resolver se comprueba la estabilidad del pórtico, que depende de la geometría, de las rótulas y de los apoyos, no de los valores de E, A o I, y se cuenta su grado de indeterminación: 3 por cada barra más las componentes de reacción, menos 3 ecuaciones por cada nudo (2 en un nudo cuyas barras tienen todas rótula) y menos 1 por cada rótula. Un grado de 0 es isostático: las fuerzas salen del equilibrio solo y no dependen de E, A ni I, de modo que sin propiedades de sección se dan igualmente las fuerzas y las reacciones y no los desplazamientos. Un grado mayor que 0 es hiperestático, y entonces las fuerzas internas varían con la rigidez relativa de cada barra. Después de la solución se comprueban las sumas ΣFx, ΣFy y ΣM de cargas y reacciones y el equilibrio de cada nudo, y un pórtico que no queda en equilibrio dentro de la tolerancia no se muestra.',
        'Cuatro grupos de pórticos con respuesta de libro de texto, para comparar con los números de la calculadora.',
        'Una viga de longitud L empotrada en un extremo y con rodillo en el otro, bajo w por unidad de longitud hacia abajo: el rodillo toma 3wL/8, el empotramiento 5wL/8, el momento en el empotramiento es wL²/8 negativo, y el mayor momento positivo es 9wL²/128, a 3L/8 del rodillo. Con los dos extremos empotrados los momentos extremos son wL²/12 negativos y el momento a media longitud wL²/24 positivo.',
        'Un pórtico con pies empotrados, columnas iguales de altura h, luz L y una viga tan rígida, a flexión y en sentido axial, que sus nudos no giran, bajo una carga horizontal H en la viga: cada columna toma H/2 como cortante, el momento es Hh/4 en el pie y en la cabeza de cada una, y los pies llevan reacciones verticales de Hh/(2L), una hacia arriba y otra hacia abajo.',
        'Una viga empotrada en ambos extremos con un apoyo asentado Δ y sin carga: los momentos extremos son 6EIΔ/L² y el cortante 12EIΔ/L³. Una barra sujeta en sus dos extremos por apoyos que no se mueven, calentada de manera uniforme ΔT, soporta la compresión N = −EAαΔT y ninguna flexión.',
        'Un pórtico a dos aguas con tres rótulas, articulado en ambos pies y con una rótula en la cumbrera, de luz L y flecha f, con w por cada unidad de su proyección horizontal: el empuje horizontal en cada pie es wL²/(8f) y la reacción vertical wL/2.',
      ],
    },
    assumes: {
      title: 'Qué supone',
      items: [
        'La respuesta es lineal elástica y el análisis es de primer orden: el equilibrio se plantea sobre el pórtico sin deformar y los desplazamientos se toman como pequeños. La rigidez no cambia con la fuerza axial, de modo que no hay efecto P–Δ ni carga de pandeo, y una columna esbelta bajo una compresión grande no se señala.',
        'Las barras son vigas-columnas de Euler–Bernoulli: las secciones planas permanecen planas y perpendiculares al eje, y se desprecia la distorsión causada por el cortante, lo que importa en barras de gran peralte y luces cortas.',
        'Las barras son rectas y prismáticas, con un solo E, A e I en toda su longitud. Una barra de sección variable o con cartelas se modela como varias barras de secciones distintas.',
        'La rigidez axial está incluida, de modo que las barras se acortan y se alargan bajo la fuerza axial. Una solución a mano que trata las barras como inextensibles, como lo hace la distribución de momentos, difiere un poco. Para el pórtico que muestra la página al cargarse, el programa da reacciones horizontales de 0.311 y 9.689 kip donde la solución a mano inextensible da 0.2 y 9.8; con el área hecha muy grande (10⁷ in², por ejemplo) la calculadora reproduce la respuesta a mano.',
        'Las cargas actúan sobre nudos y sobre barras, como se escriben. El peso propio de una barra no se añade: introdúzcalo como una carga uniforme sobre la barra. Nada se multiplica por un factor ni se forma combinación alguna, de modo que corra cada combinación como un caso aparte.',
        'Las conexiones son rígidas o articuladas. No se modelan una conexión semirrígida, una zona de panel, un nudo de tamaño finito ni una base con flexibilidad propia; un apoyo elástico es la manera de introducir una rigidez conocida en un apoyo.',
        'La temperatura actúa como la deformación térmica sin restricción de la barra, α por el cambio, y produce fuerza solo donde los apoyos y las demás barras la retienen. Un gradiente necesita el peralte de la sección. Un pórtico isostático se mueve bajo temperatura o un asentamiento y no desarrolla fuerza alguna.',
        'Las secciones de ala ancha y los dos materiales que se ofrecen son valores típicos para una primera estimación: use las propiedades de la sección y del material realmente especificados.',
        'Un pórtico cuyas barras tienen todas rótula en ambos extremos es una cercha, que tiene su propia calculadora en el catálogo, Fuerzas en barras de cerchas.',
      ],
    },
    limits: {
      title: 'Qué deja fuera',
      items: [
        'Los resultados son fuerzas, momentos, reacciones y desplazamientos, y nada más allá de ellos: no aplica ninguna norma de diseño, no multiplica ninguna carga por un factor y no dimensiona una barra ni una conexión. Decidir si una barra servirá le corresponde a usted.',
        'Hasta 50 nudos, 100 barras, 40 apoyos, 60 cargas nodales y 120 cargas en barras.',
        'Un mecanismo se rechaza, y se nombran los nudos que se mueven. Significa que una parte del pórtico puede moverse sin que ninguna barra se deforme, como en un pórtico de base articulada con una rótula en la cabeza de ambas columnas. Para corregirlo, arriostre la parte que se mueve con otra barra o un apoyo, o quite una rótula.',
        'También se rechaza un pórtico que sus apoyos no pueden sujetar: menos de 3 componentes de reacción, o 3 cuyas rectas son todas paralelas o se cortan todas en un solo punto, lo dejan libre de moverse como cuerpo rígido.',
        'Un pórtico hiperestático necesita E, A e I en cada barra y se rechaza sin ellos; uno isostático se resuelve sin ellos, con fuerzas y reacciones pero sin desplazamientos.',
        'Rigideces que difieren en muchos órdenes de magnitud, como una barra casi rígida junto a otras muy flexibles, o una barra muy corta junto a otras largas, pueden dejar la aritmética con muy pocas cifras. Entonces no se logra el equilibrio dentro de la tolerancia, y el pórtico se rechaza por mal condicionado en vez de mostrarse. Una barra de menos de una cienmilésima del tamaño del pórtico se rechaza por demasiado corta.',
        'Dos nudos coincidentes, dos barras entre el mismo par de nudos, un nudo sin barra, trozos de pórtico separados, una carga colocada fuera de su barra y un gradiente en una barra sin peralte se rechazan cada uno, con la entrada nombrada.',
        'Un par aplicado a un nudo en el que todas las barras tienen rótula no tiene nada que lo resista y se rechaza, salvo que un apoyo sujete allí el giro.',
      ],
    },
    signs: {
      title: 'Signos, unidades y cómo se leen los resultados del pórtico',
      items: [
        'Ejes globales: x positivo a la derecha e y positivo hacia arriba. La gravedad es una carga negativa en y. Un momento aplicado, un momento de reacción y un giro son positivos en sentido antihorario. Las etiquetas de nudos y barras empiezan en 1 y siguen el orden de sus tablas.',
        'Cada barra tiene ejes propios: x̄ va de su primer nudo al segundo, y ȳ es x̄ girado 90° en sentido antihorario, a su izquierda. En una barra horizontal dibujada de izquierda a derecha ȳ apunta hacia arriba; dibujada al revés, hacia abajo.',
        'N, la fuerza axial, es positiva en tracción y negativa en compresión. V, la fuerza cortante, es positiva cuando las cargas y reacciones sobre el trozo de barra comprendido entre su primer nudo y un corte lo empujan hacia +ȳ. M, el momento flector, es positivo cuando produce tracción en el lado −ȳ de la barra, que en una barra horizontal dibujada de izquierda a derecha es su cara inferior: un momento positivo de flexión.',
        'El diagrama de momentos se dibuja del lado de la tracción, en el sentido en que se dibujó la barra. Los diagramas de cortante y de fuerza axial se dibujan del lado +ȳ donde son positivos y del otro donde son negativos.',
        'Ejemplo resuelto: una barra de (0, 0) a (10, 0) ft, articulada en ambos extremos, con 2 kip/ft hacia abajo. V vale +10 kip en el extremo izquierdo, 0 a media longitud y −10 en el derecho; M vale 0, +25 y 0 kip·ft, y su diagrama cuelga bajo la barra. Defina la misma barra desde su extremo derecho hacia el izquierdo y ȳ apunta hacia abajo: M a media longitud da −25 y V cambia de signo, mientras el diagrama dibujado no cambia.',
        'Una reacción es lo que el apoyo aplica al pórtico, fuerza y momento, según los ejes globales, positivas hacia +x y +y; un momento de reacción es positivo en sentido antihorario. La reacción de un rodillo se da también según su propia recta.',
        'Los desplazamientos son positivos hacia +x y +y y los giros en sentido antihorario, en radianes. Un asentamiento se introduce según los ejes globales en pulgadas o milímetros: un apoyo que baja tiene dy negativo, y dr es un giro en radianes. En un rodillo solo cuenta la parte del asentamiento según su recta.',
        'Un cambio uniforme de temperatura es el cambio en grados, con α la deformación por grado. Un gradiente es la temperatura de la cara +ȳ menos la de la cara −ȳ, y necesita el peralte h de la barra: una cara +ȳ más caliente curva hacia +ȳ una barra que puede deformarse y, sujeta en ambos extremos, da el momento positivo EIαΔTg/h.',
        'Unidades US: pies y kips, con cargas lineales en kip/ft y momentos en kip·ft; A en in², I en in⁴, E en ksi; peraltes y asentamientos en pulgadas; temperaturas en °F. Unidades SI: metros y kilonewtons, con kN/m y kN·m; A en mm², I en 10⁶ mm⁴, E en GPa; peraltes y asentamientos en milímetros; temperaturas en °C.',
        'Todo lo introducido se guarda en la dirección después de #f=, de modo que una copia de la dirección vuelve a abrir el mismo pórtico.',
      ],
    },
    disclaimer: beamStrings.es.page.disclaimer,
    sheet: {
      kind: beamStrings.es.page.sheet.kind,
      credit: 'Elaborado con la calculadora de pórticos planos de {firm} — {address}',
      margin: beamStrings.es.page.sheet.margin,
    },
    back: 'Todas las calculadoras',
    noscript: 'Con los scripts desactivados, esta página conserva el pórtico con que se abrió y no puede responder. Actívelos y el pórtico se analiza en su propio equipo; nada de lo que usted introduzca se envía a ninguna parte.',
  },
};
