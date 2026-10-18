import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings, type BeamPage } from '../beam/strings';

/**
 * The words of the stiffness matrix calculator's PAGE
 * (/resources/stiffness-matrix-step-by-step), in English and in Spanish: what a
 * search result shows, the hero, and the notes under the tool. Read by the
 * server view only (StiffnessView). The tool's own words are in strings.ts and
 * travel to the browser as a prop; these never do.
 *
 * THE SAME SHAPE as the first calculator's page text (`BeamPage`,
 * beam/strings.ts), because one view prints all the calculators
 * (CalculatorPage). That shape has four lists of notes, and this page puts its
 * sections in them like this:
 *   - `method`  the direct stiffness method in the order the tool lists its
 *               steps (degrees of freedom, the member matrix in local axes,
 *               the turn to global axes, assembly, loads and fixed-end forces,
 *               partition, elimination, reactions, member end forces, checks),
 *               then a worked case small enough to print in full (the two-bar
 *               truss the page opens with), a second one for bending (a
 *               cantilever), and how to read a stiffness matrix;
 *   - `assumes` what the model takes to be true of the structure;
 *   - `limits`  what the tool leaves out, what it refuses, the limits of size,
 *               and how it stands beside the truss and frame calculators;
 *   - `signs`   signs, units, the end-force convention with a worked case, and
 *               the address.
 * NOT the same sentences: no run of six words here is on any other calculator's
 * page, in its form, or in the catalogue's line for this one
 * (views/stiffness.test.ts compares them).
 *
 * THE LEGAL WORDS ARE SAID ONCE. The disclaimer, what the printed sheet is
 * called and the line in the margin of every printed page are the first
 * calculator's, taken by reference, as the others take them. Only the credit
 * names this calculator.
 *
 * WHAT THE NOTES ARE HELD TO. The engine (lib/calc/stiffness) and the form's
 * model (model.ts): views/stiffness.test.ts SOLVES EVERY CASE PRINTED HERE with
 * the engine (the two-bar truss at each step it prints, the cantilever's
 * multiplier and answers, the fixed-end forces of the sign case drawn both
 * ways, the sway of a portal with a rigid beam, a rigid-body movement taking no
 * force, two collinear bars as a mechanism) and compares each number with the
 * one written here. Every tolerance written in words (a billionth, a millionth,
 * a hundred-millionth) is the number the engine uses (TOLERANCES, analysis.ts),
 * and every limit is the engine's. The test also lists every figure the text
 * may contain: a figure that is not in a formula, a limit or one of those cases
 * is held out.
 *
 * WHAT IT IS NOT IS SAID AS PLAINLY AS WHAT IT IS. A first-order, linear
 * elastic analysis of prismatic members, shown step by step: no buckling, no
 * P–Δ, no shear deformation, no design check. The page gives displacements,
 * reactions and member end forces; it does not size a member, check a
 * connection or apply a code, and it names none. Words of verdict ("adequate",
 * "safe", "passes"), the word "free" in any sense but a free DOF (the
 * engineering term, against a restrained one) and any figure that is not in a
 * formula, a limit or a printed case are held out by the test. (So "pass" is not
 * written: the elimination is "column by column", not "pass by pass".)
 *
 * THE OTHER CALCULATORS are named as the catalogue names them (and the test reads
 * the names from the catalogue): "Truss member forces" and "Plane frame
 * analysis" solve whole structures without printing a matrix; this one prints
 * them.
 *
 * THE FORMULAS are written as the engine writes them in its steps (the alphabet
 * is in engine.ts): `_` for a subscript, `^T` for a transpose, the true minus
 * "−", ², ³ and the symbols of the steps. The font the site sets in has ¹ ² ³
 * only as raised characters, so no other is written: the tolerances are in
 * words, not in powers of ten, and a transpose is `^T`. The page prints plain
 * text (CalculatorPage), so a subscript here is an underscore; the tool's own
 * tables set the same symbols as real subscripts (calc/stiffness).
 *
 * THE STEPS ARE NUMBERED as the tool numbers them, which is the engine's stage
 * (1 to 14, types.ts): "(step 8)" closes the sentence about the partition. The
 * test holds each number to the stage of the step it names.
 *
 * THE SIX-WORD RULE, FOR A TEXT FULL OF FORMULAS. The form and this page explain
 * one method with one set of formulas, and a formula is not a sentence said
 * twice, so views/stiffness.test.ts masks the formulas before it compares runs
 * of six words (the rule is written there, at the top). The prose around them
 * is held to the rule as on every other page.
 *
 * Spanish as a Latin-American structural engineer writes it: "matriz de rigidez",
 * "grados de libertad" (GDL; the formulas of the steps say DOF, and the text
 * says so once), "ensamblaje", "partición", "eliminación de Gauss", "sustitución
 * hacia atrás", "cercha", "pórtico", "barra", "nudo", "empotramiento",
 * "fuerzas de empotramiento perfecto", "cargas nodales equivalentes", "vector de
 * código", "asentamiento", "luz", formal "usted", the decimal point, a narrow
 * no-break space between the thousands of a figure and the true minus "−" in
 * sentences.
 */
export type StiffnessPage = BeamPage;

export const stiffnessPage: Record<Lang, StiffnessPage> = {
  en: {
    title: 'Stiffness Matrix of Trusses and Frames, Every Step Shown',
    description: 'Local and global stiffness matrices of a 2D truss or frame by the direct stiffness method: assembly, displacements, reactions, member forces, every step shown.',
    h1: 'Stiffness matrix, step by step, for plane trusses and frames',
    eyebrow: 'Calculator',
    sub: 'A plane truss or frame of up to 12 nodes, solved with the direct stiffness method and nothing hidden. Each member’s stiffness matrix in its own axes and then in the global axes, the assembled matrix of the structure, the load vector, the split into free and restrained degrees of freedom, the elimination, the reactions and what every member carries at its two ends, all written out with their numbers. Start from one of seven textbook problems, or enter a structure of your own.',
    facts: [
      { k: 'Structure', v: 'Truss or frame, in a plane' },
      { k: 'Shown', v: 'Every matrix, step by step' },
      { k: 'Results', v: 'Displacements, reactions, end forces' },
    ],
    toolHeading: 'The structure and its solution',
    method: {
      label: 'Method',
      title: 'How the solution is built',
      paragraphs: [
        'The direct stiffness method turns a whole structure into one matrix equation, K·u = P + R, and solves it. K is the stiffness matrix of the structure, u the displacements of all its nodes, P the loads put on them and R the forces the supports add. The tool works as a person does on paper and prints every step, with its numbers, its symbols and the cells that matter marked. What follows is the same method, in the order the tool lists it.',
        'Degrees of freedom (DOFs) come first (step 1). A truss node has two, a displacement along x and one along y; a frame node has a third, its rotation. They are numbered node by node: node n has DOFs 2n − 1 and 2n in a truss, and 3n − 2, 3n − 1 and 3n in a frame. That order is the order of the rows and columns of every global matrix and of every global vector, so the number of a row says which movement it is about. A DOF that a support holds is restrained, or held; every other one is free.',
        'Each member is first taken in axes of its own (steps 2 and 3), with x̄ running along it from its first node i to its second node j. A bar, which carries axial force alone, has one movement at each end, and its matrix is k = (EA/L)·[1 −1; −1 1], where E is the modulus, A the area and L the length. A column of any stiffness matrix is the set of forces that hold a member in the shape of one unit movement, every other movement being zero. Here the first column says that shortening the bar by one unit takes a push of EA/L on each end.',
        'A frame member is a beam-column with six movements, a displacement along x̄, one along ȳ and a turn at each end, so its matrix is 6 × 6. It is made of five numbers: EA/L for the axial terms and, for bending, 12EI/L³, 6EI/L², 4EI/L and 2EI/L, each cell taking the sign its position gives. Move the first end sideways by one unit and the member answers with a shear of 12EI/L³ and a moment of 6EI/L² at that end. Turn it by one unit and the moment there is 4EI/L, and 2EI/L at the far end.',
        'Members point every way, so each is turned into the global axes before it is added (steps 4 and 5). With c = cosθ and s = sinθ for the member’s direction, pointing away from node i toward node j, the end movements in global axes give the local ones by u_local = T·u_global. The matrix T holds c and s; for a frame member it is [c s 0; −s c 0; 0 0 1] at each end, since a rotation is the same in every set of axes. The member’s matrix in global axes is K_e = T^T·k·T, with T^T the transpose of T. For a bar it is (EA/L)·[c² cs −c² −cs; cs s² −cs −s²; −c² −cs c² cs; −cs −s² cs s²], which the tool prints beside the product as a second route to the same figures.',
        'Assembly adds the members up (step 6). Each member has a code vector: the numbers of the global DOFs that its own DOFs correspond to, in order, as in [1 2 5 6] for a bar from node 1 to node 3. The entry in row a and column b of K_e is added to K at row code(a) and column code(b), K ← K + K_e. Two members that meet at a node both add into the cells of that node’s DOFs, and their sum is the stiffness the joint offers to that movement. The tool shows each member’s contribution, the running K after it and, last, the whole K with the cells that more than one member reached marked.',
        'Loads come next (step 7). A load at a node goes into the load vector P at the DOF it acts along, and a couple at a node goes to its rotation. A load on a member (frame mode) is a uniform load over its length, a point load or an axial load, each along the member’s own axes, and each is exchanged for its fixed-end forces f_FE: what two clamps would exert to keep both ends from moving. A uniform load w has wL/2 and wL²/12 (in size), an axial load q has qL/2 along the member at each end, and a point load P, with a and b the distances to its first and second ends, has Pb²(3a+b)/L³ and Pab²/L² at the first end and Pa²(a+3b)/L³ and Pa²b/L² at the second. The equivalent nodal loads, −T^T·f_FE, are their opposite in global axes and join P; the member’s end forces take f_FE back when they are found.',
        'The DOFs are then split into free (F) and restrained (R), and K, P and u are cut into blocks to match (step 8). The free rows give K_FF·u_F = P_F − K_FR·u_R (step 9). Here u_R holds what the supports allow: zero, unless a support is given a settlement, which then acts as a load, −K_FR·u_R. The restrained rows are kept for later, when they give the reactions.',
        'This reduced equation is solved by Gaussian elimination, without exchanging rows (step 10). At column k the pivot a_kk is the diagonal entry; for each row i below it, l_ik = a_ik/a_kk is the multiple of row k to take away, a_ij ← a_ij − l_ik·a_kj, which leaves zeros under the pivot. When the matrix is triangular the unknowns come from the bottom up, u_k = (b_k − Σ a_kj·u_j)/a_kk. No exchange is needed because K_FF is symmetric and positive definite when the structure is stable, so every pivot is positive.',
        'A pivot under a billionth of the diagonal entry it started as is taken as zero. It means that nothing in the structure resists some movement: the members can swing without stretching or shortening, and that is a mechanism. The tool stops there, shows the steps worked out until then and names the DOF. A smallest pivot under a millionth of its start, but above a billionth, is solved with a warning: the structure is nearly a mechanism, and its displacements change a great deal if any one stiffness changes even a little.',
        'The free displacements and the prescribed ones make up the whole vector u (step 11). The reactions come from the restrained rows, R = K_RF·u_F + K_RR·u_R − P_R, one for each restrained DOF (step 12). A reaction is the force or moment a support applies to the structure.',
        'Each member then reads its end movements u_e from u through its code vector, turns them to local axes, u_local = T·u_e, and multiplies by its matrix, f = k·u_local, adding f_FE if it carries a load (step 13). For a bar, N = (EA/L)(u_j − u_i) in local axes; the tool also gives the stress N/A and the elongation. For a frame member, N, V and M at both ends follow from f with the signs given further down.',
        'Step 14 tests the answer. Loads and reactions are added up along x, along y and as a moment taken about the centre of the box around the nodes; every joint is balanced against the end forces of the members that meet there; the strain energy U = ½·u^T·K·u is compared with the work ½·u^T·P + ½·u_R^T·R; and K·u − P − R is read at every DOF, with the elimination’s own residual. Each is measured against the size of the terms that make it up, with a limit of a hundred-millionth. A structure for which one of them is missed is refused as ill-conditioned, and no results are given for it.',
        'A first worked case is the two-bar truss the page opens with. Nodes 1, 2 and 3 are at (0, 0), (16, 0) and (8, 6) ft. Bar 1 joins nodes 1 and 3, bar 2 joins nodes 2 and 3, and nodes 1 and 2 are pinned. Both bars have E = 29,000 ksi and A = 10 in², and node 3 carries 20 kip to the right and 30 kip down.',
        'Each bar is 10 ft long, so EA = 290,000 kip and EA/L = 29,000 kip/ft. Bar 1 has c = 0.8 and s = 0.6; bar 2 runs from node 2 up to node 3, so c = −0.8 and s = 0.6. The DOFs are 1 and 2 at node 1, 3 and 4 at node 2, and 5 and 6 at node 3, so the code vectors are [1 2 5 6] and [3 4 5 6]. At DOFs 5 and 6, bar 1 adds 29,000 × [0.64 0.48; 0.48 0.36] and bar 2 adds 29,000 × [0.64 −0.48; −0.48 0.36]. The cross terms cancel, and K_FF = [37,120 0; 0 20,880] kip/ft.',
        'With P_F = [20; −30] kip and the supports not moving, nothing lies under the diagonal to eliminate: u_5 = 20/37,120 and u_6 = −30/20,880, which are 0.00647 in to the right and 0.01724 in down. The reactions are R_1 = 10, R_2 = 7.5, R_3 = −30 and R_4 = 22.5 kip. N = (EA/L)(u_j − u_i) is −12.5 kip in bar 1 and −37.5 kip in bar 2, both in compression, and ΣFx = 20 + 10 − 30 = 0 and ΣFy = −30 + 7.5 + 22.5 = 0. By joint equilibrium at node 3, −0.8·N_1 + 0.8·N_2 + 20 = 0 and −0.6·N_1 − 0.6·N_2 − 30 = 0 give the same two forces.',
        'A frame needs bending, so take one member of length L, fixed at node 1 and loaded by P downward at node 2. The load has no axial part: the axial row holds only EA/L, nothing couples it to the others and its movement comes out zero. The other two free rows, for v_2 and θ_2, are K_FF = [12EI/L³ −6EI/L²; −6EI/L² 4EI/L] with P_F = [−P; 0]. The multiplier is l = (−6EI/L²)/(12EI/L³) = −L/2; taking l times the first row from the second leaves EI/L where 4EI/L stood and −PL/2 on the right. Back-substitution gives θ_2 = −PL²/(2EI) and v_2 = −PL³/(3EI), the textbook rotation and deflection at the tip, and the reactions at node 1 are P upward and PL counter-clockwise.',
        'Reading the matrices. Each matrix and vector has its rows and columns named by DOF: 3y is the y movement of node 3 and 2θ the rotation of node 2. Row d of K is the equation of equilibrium of DOF d. Column d is the set of forces, at every DOF, that hold the structure in the shape of a unit movement of DOF d, every other DOF being held still, so the entry in row a and column b is the force at a when b moves one unit.',
        'The unit of an entry follows from its two DOFs: a force per length between two movements (kip/ft, or kN/m), a force per radian between a movement and a rotation (kip/rad, kN/rad), and a moment per radian between two rotations (kip·ft/rad, kN·m/rad).',
        'K is symmetric: the force at a for a unit movement of b is the force at b for a unit movement of a, which is Maxwell and Betti’s reciprocity, and the tool tests it. No diagonal entry is negative. A zero off the diagonal means that moving one DOF asks no force at the other: no member joins their nodes, or the member that does has no stiffness across that direction (a horizontal bar and a movement across it), or terms cancelled, as the cross terms did in the example. Before supports are applied K has no inverse: a movement of the whole structure as a rigid body takes no force at all, so K·u is zero for it, whatever the loads. The supports remove those movements, and K_FF can be solved.',
        'Within a member matrix the axial terms and the bending terms share no cell in local axes, because stretching a member does not bend it; the turn to global axes mixes them. The tool marks the axial and the bending terms of k, the cells where a member lands in the assembly and those that more than one member reached, and in the elimination the pivot, the cells it reduces to zero and those it changes.',
        'The entries are physical stiffnesses. For a column of height h fixed at its foot, 12EI/h³ is the force that sways its top one unit with the top kept from turning. A beam that cannot turn, on two such columns that cannot shorten, makes a stiffness of 24EI/h³, so a horizontal force H sways it by Hh³/(24EI).',
      ],
    },
    assumes: {
      title: 'What it assumes',
      items: [
        'The material is taken as linear elastic and the analysis as first order. Equilibrium is set up on the geometry as drawn, displacements are treated as small, and second-order effects, P–Δ among them, and buckling are not modelled: a slender member in compression is not flagged.',
        'Each member is prismatic: one section, and so one E, one A and one I, for its whole length. Bending follows the Euler–Bernoulli theory, in which sections stay plane and square to the axis; the distortion shear would cause is left out.',
        'A bar is pinned at both ends and carries axial force alone, so a truss takes its loads at its nodes. Member loads typed in truss mode are kept and not used, and the tool says so.',
        'In frame mode every member is joined rigidly to the nodes at both ends. Hinges and releases, springs and inclined supports are not offered here: a support holds a global movement, along x, along y or the rotation, and no other direction.',
        'In frame mode a member’s own length also changes with its axial force, so a hand solution in which lengths cannot change will not match to the last figure.',
        'Member loads are a uniform load over the whole member, a point load strictly between the ends and a uniform axial load, each along the member’s own axes. A load at an end goes in as a nodal load. There is no temperature load, and no self-weight unless it is entered as a load.',
        'A support may be given a settlement along x, along y or as a rotation, on a DOF that it holds. A value typed on a DOF the support leaves free has no effect, and the tool warns of it.',
        'The two moduli offered as starting points, for steel and for aluminum, are typical values: enter the modulus and the section of what is actually specified.',
        'One static case is analysed at a time. Loads are taken as entered, with no factor and no combination; each combination of loads is a case to enter on its own.',
      ],
    },
    limits: {
      title: 'What it leaves out',
      items: [
        'The results are displacements, reactions and member end forces, and that is all: no design code, no factored load, no member or connection sized. Judging a member is left to you.',
        'Up to 12 nodes, 20 members, 12 supports, 40 nodal loads and 24 member loads, which is at most 36 DOFs. The cap keeps every matrix small, so that it can be read on a screen.',
        'The elimination is printed column by column up to 12 free DOFs; with more, the tool gives its result and its residual and none of the columns.',
        'A structure in which some movement meets no resistance, because the members can swing without stretching or shortening, is refused. The message names the DOF where the elimination broke down and the nodes that move. Two collinear truss bars meeting at a node with no support are the usual case: nothing resists a movement across their line, and a zero stands on the diagonal. To cure it, tie the node into the structure with another member, or hold it with a support.',
        'Fewer than three restrained DOFs is refused before any solving, because a body in a plane needs three to stay in place. Three that still leave a movement of the whole structure, such as reactions on three parallel lines, are found by the elimination as a mechanism of the whole structure.',
        'Each of these is refused, and the entry at fault is named: two nodes in one place; a member that starts and ends at one node; two members joining the same two nodes; a node that no member reaches; a structure in separate pieces; a member whose length is under a hundred-thousandth of the structure’s size; a point load not strictly inside its member; a section left blank where one is needed; and a number too large for the arithmetic.',
        'A very stiff member beside very soft ones can leave the arithmetic short of figures. The checks of the last step measure that, and a structure that misses one is refused as ill-conditioned.',
        'Truss member forces and Plane frame analysis solve the same kinds of structure without printing a matrix, and the second takes hinges, springs, inclined supports, temperature loads and larger structures. This one is for reading the method, and for comparing a small case with those.',
      ],
    },
    signs: {
      title: 'Signs, units and the meaning of each result',
      items: [
        'The global axes run x to the right and y up. Loads and reactions are positive along +x and +y, so gravity is a negative y load; moments, rotations and couples are positive counter-clockwise. Nodes, members and rows are counted from 1.',
        'A DOF is named by its node and its direction: 3x and 3y are the movements of node 3 along x and y, and 3θ is its rotation, in radians. Inside a member the local movements are u, v and θ at each end, named by the node: u1, v1, θ1, u3, v3, θ3.',
        'The local axes of a member: x̄ points along it from its first node toward its second, and ȳ lies 90° counter-clockwise from x̄, on its left, so a horizontal member that runs left to right has ȳ up. The member loads w and P are positive along +ȳ, which makes gravity on such a member negative, and q is positive along +x̄. A point load acts at a, measured from the first node.',
        'f holds what the two nodes apply to the member, in its local axes: [Fx_i, Fy_i, M_i, Fx_j, Fy_j, M_j] for a frame member and [f_i, f_j] for a bar. The forces inside the member, next to each end, follow from it: N = −Fx_i, V = Fy_i and M = −M_i at the first end, and N = Fx_j, V = −Fy_j and M = M_j at the second.',
        'A member in tension has a positive N. V is positive when the forces acting on the part of the member on the first node’s side of the cut together push toward +ȳ. M is positive for tension at the −ȳ face, the underside of a horizontal member that runs left to right: sagging.',
        'Worked case: member 1 runs from node 1 at (0, 0) to node 2 at (10, 0) ft, fixed at both ends, under w = −2 kip/ft. Its fixed-end forces are f_FE = [0, 10, 16.667, 0, 10, −16.667], so at the first end V = 10 kip and M = −16.667 kip·ft, and at the second V = −10 and M = −16.667: tension on the top face at both ends. Drawn from right to left, ȳ points down and the same load is w = +2; then V = −10 at the first end and 10 at the second, and M = 16.667 at both ends, the same top-face tension with the opposite sign.',
        'A reaction is the force or moment a support applies to the structure, along a global axis: positive toward +x and +y, a moment positive counter-clockwise. In a bar, tension gives a positive N, the stress is N/A, and the elongation u_j − u_i, in local axes, is positive when the bar lengthens.',
        'In the US set, a length is in feet and a force in kip; a line load is in kip/ft and a moment in kip·ft; E is in ksi, A in in² and I in in⁴, and a settlement in inches. In the SI set, a length is in metres and a force in kilonewtons; a line load is in kN/m and a moment in kN·m; E is in GPa, A in mm² and I in 10⁶ mm⁴, and a settlement in millimetres. A rotation, a settlement’s included, is in radians in both.',
        'The matrices and vectors of the steps are in calculation units: feet and kip, or metres and kilonewtons, with E in kip/ft² and A in ft² (kN/m² and m²). The results tables show displacements in inches or millimetres and the stress of a bar in ksi or MPa.',
        'A value under a billionth of the largest in its own matrix or vector is printed as 0, since it is rounding; the arithmetic keeps every figure.',
        'The structure is written into the page’s address after #m=; pasting that address into a browser brings it back.',
      ],
    },
    disclaimer: beamStrings.en.page.disclaimer,
    sheet: {
      kind: beamStrings.en.page.sheet.kind,
      credit: 'Produced with the stiffness matrix calculator of {firm} — {address}',
      margin: beamStrings.en.page.sheet.margin,
    },
    back: 'All calculators',
    noscript: 'With scripts turned off this page shows only the structure it opened with and does not recalculate. Turn them on and every step is worked out in your own browser; nothing you enter leaves it.',
  },
  es: {
    title: 'Matriz de rigidez de cerchas y pórticos con cada paso',
    description: 'Matriz de rigidez local y global de cerchas y pórticos 2D por rigidez directa: ensamblaje, desplazamientos, reacciones y fuerzas en las barras, paso a paso.',
    h1: 'Matriz de rigidez, paso a paso, de cerchas y pórticos planos',
    eyebrow: 'Calculadora',
    sub: 'Una cercha o un pórtico plano de hasta 12 nudos, resueltos con el método de rigidez directa y sin ocultar nada. La matriz de rigidez de cada barra en sus propios ejes y luego en los ejes globales, la matriz ensamblada de la estructura, el vector de cargas, la partición en grados de libertad libres y restringidos, la eliminación, las reacciones y lo que soporta cada barra en sus dos extremos, todo escrito con sus números. Parta de uno de siete problemas de libro de texto, o introduzca una estructura propia.',
    facts: [
      { k: 'Estructura', v: 'Cercha o pórtico, en el plano' },
      { k: 'Se muestra', v: 'Cada matriz, paso a paso' },
      { k: 'Resultados', v: 'Desplazamientos, reacciones, fuerzas de extremo' },
    ],
    toolHeading: 'La estructura y su solución',
    method: {
      label: 'Método',
      title: 'Cómo se construye la solución',
      paragraphs: [
        'El método de rigidez directa convierte una estructura entera en una sola ecuación matricial, K·u = P + R, y la resuelve. K es la matriz de rigidez global, la de toda la estructura, u los desplazamientos de todos sus nudos, P las cargas aplicadas en ellos y R las fuerzas que añaden los apoyos. La herramienta trabaja como se hace a mano y muestra cada paso, con sus números, sus símbolos y las celdas que importan señaladas. Lo que sigue es el mismo método, en el orden en que la herramienta lo presenta.',
        'Primero van los grados de libertad (GDL; las fórmulas de la herramienta los llaman DOF), paso 1. Un nudo de cercha tiene dos, un desplazamiento según x y otro según y; uno de pórtico tiene un tercero, su giro. Se numeran nudo por nudo: el nudo n tiene los GDL 2n − 1 y 2n en una cercha, y 3n − 2, 3n − 1 y 3n en un pórtico. Ese orden es el de las filas y las columnas de toda matriz global y de todo vector global, de modo que el número de una fila dice de qué movimiento se trata. Un GDL que un apoyo sujeta es restringido; todos los demás son libres.',
        'Cada barra se toma primero en ejes propios (pasos 2 y 3), con x̄ a lo largo de ella desde su primer nudo i hasta el segundo nudo j. Una barra de cercha, que lleva solo fuerza axial, tiene un movimiento en cada extremo y su matriz es k = (EA/L)·[1 −1; −1 1], donde E es el módulo, A el área y L la longitud. Una columna de cualquier matriz de rigidez es el conjunto de fuerzas que mantiene a la barra en la forma de un movimiento unitario, con todos los demás nulos. Aquí, la primera columna dice que acortar la barra una unidad exige un empuje de EA/L en cada extremo.',
        'Una barra de pórtico es una viga-columna con seis movimientos, un desplazamiento según x̄, otro según ȳ y un giro en cada extremo, y su matriz es de 6 × 6. Se compone de cinco números: EA/L para los términos axiales y, para la flexión, 12EI/L³, 6EI/L², 4EI/L y 2EI/L, y cada celda toma el signo que le da su posición. Si el primer extremo se desplaza una unidad en sentido transversal, la barra responde con un cortante de 12EI/L³ y un momento de 6EI/L² en ese extremo. Si gira una unidad, el momento allí es 4EI/L, y 2EI/L en el extremo lejano.',
        'Las barras apuntan en todas direcciones, así que antes de sumar cada una hay que llevarla a los ejes globales (pasos 4 y 5). Con c = cosθ y s = senθ para la dirección de la barra, que apunta del nudo i hacia el nudo j, los movimientos de extremo en ejes globales dan los locales mediante u_local = T·u_global. La matriz T, de transformación, contiene c y s; para una barra de pórtico es [c s 0; −s c 0; 0 0 1] en cada extremo, pues un giro es el mismo en cualquier juego de ejes. La matriz de la barra en ejes globales es K_e = T^T·k·T, con T^T la transpuesta de T. Para una barra de cercha es (EA/L)·[c² cs −c² −cs; cs s² −cs −s²; −c² −cs c² cs; −cs −s² cs s²], que la herramienta imprime junto al producto como segunda vía hacia las mismas cifras.',
        'El ensamblaje suma las barras (paso 6). Cada barra tiene un vector de código: los números de los GDL globales a que corresponden sus propios GDL, en orden, como [1 2 5 6] para una barra del nudo 1 al nudo 3. El término de la fila a y la columna b de K_e se suma a K en la fila código(a) y la columna código(b), K ← K + K_e. Dos barras que concurren en un nudo suman ambas en las celdas de los GDL de ese nudo, y su suma es la rigidez que el nudo ofrece a ese movimiento. La herramienta muestra la contribución de cada barra, la K acumulada después de ella y, al final, la K completa con señaladas las celdas a las que llegó más de una barra.',
        'Siguen las cargas (paso 7). Una carga en un nudo va al vector de cargas P, en el GDL según el cual actúa, y un par en un nudo va a su giro. Una carga sobre una barra (en modo pórtico) puede ser uniforme en toda su longitud, puntual o axial, cada una según los ejes propios de la barra. Se sustituye por las fuerzas de empotramiento perfecto f_FE: lo que ejercerían dos empotramientos para que ninguno de los extremos se mueva. Una carga uniforme w da wL/2 y wL²/12 (en magnitud), una carga axial q da qL/2 según la barra en cada extremo, y una carga puntual P, con a y b las distancias al primer y al segundo extremo, da Pb²(3a+b)/L³ y Pab²/L² en el primero y Pa²(a+3b)/L³ y Pa²b/L² en el segundo. Las cargas nodales equivalentes, −T^T·f_FE, son su opuesto en ejes globales y se suman a P; las fuerzas de extremo de la barra recuperan f_FE al calcularse.',
        'Los GDL se separan después en libres (F) y restringidos (R), y K, P y u se cortan en bloques acordes (paso 8). Las filas libres dan K_FF·u_F = P_F − K_FR·u_R (paso 9). Aquí u_R contiene lo que permiten los apoyos: cero, salvo que a un apoyo se le dé un asentamiento, que actúa entonces como una carga, −K_FR·u_R. Las filas restringidas se guardan para más adelante, cuando dan las reacciones.',
        'Esta ecuación reducida se resuelve por eliminación de Gauss, sin intercambiar filas (paso 10). En la columna k el pivote a_kk es el término diagonal; para cada fila i inferior, l_ik = a_ik/a_kk es el múltiplo de la fila k que se resta, a_ij ← a_ij − l_ik·a_kj, y deja ceros bajo el pivote. Con la matriz triangular, las incógnitas salen de abajo hacia arriba por sustitución hacia atrás, u_k = (b_k − Σ a_kj·u_j)/a_kk. No hace falta intercambiar filas porque K_FF es simétrica y definida positiva cuando la estructura es estable, y entonces todos los pivotes son positivos.',
        'Un pivote menor que una milmillonésima del término diagonal con que empezó se toma como cero. Significa que nada en la estructura se opone a cierto movimiento: las barras pueden girar sin alargarse ni acortarse, y eso es un mecanismo. La herramienta se detiene allí, muestra los pasos resueltos hasta entonces y nombra el GDL. Si el menor pivote es menor que una millonésima de su valor inicial pero mayor que una milmillonésima, la estructura se resuelve con una advertencia: es casi un mecanismo, y sus desplazamientos varían mucho si una sola rigidez cambia aunque sea poco.',
        'Los desplazamientos de los GDL libres y los impuestos forman el vector u completo (paso 11). Las reacciones salen de las filas restringidas, R = K_RF·u_F + K_RR·u_R − P_R, una por cada GDL restringido (paso 12). Una reacción es la fuerza o el momento que un apoyo aplica a la estructura.',
        'Cada barra toma luego sus movimientos de extremo u_e de u por su vector de código, los lleva a ejes locales, u_local = T·u_e, y los multiplica por su matriz, f = k·u_local, a lo que suma f_FE si lleva carga (paso 13). En una barra de cercha, N = (EA/L)(u_j − u_i) en ejes locales; la herramienta da además el esfuerzo N/A y el alargamiento. En una barra de pórtico, N, V y M en ambos extremos salen de f con los signos que se dan más abajo.',
        'El paso 14 somete la respuesta a prueba. Se suman cargas y reacciones según x, según y y como momento respecto del centro del recuadro que encierra los nudos; se comprueba el equilibrio de cada nudo con las fuerzas de extremo de las barras que concurren en él; la energía de deformación U = ½·u^T·K·u se compara con el trabajo ½·u^T·P + ½·u_R^T·R; y se lee K·u − P − R en cada GDL, junto con el residuo de la propia eliminación. Cada una se mide contra el tamaño de los términos que la componen, con un límite de una cienmillonésima. Una estructura en la que alguna de ellas no se alcanza se rechaza por mal condicionada, y no se dan resultados para ella.',
        'Un primer caso resuelto es la cercha de dos barras que la página muestra al abrirse. Los nudos 1, 2 y 3 están en (0, 0), (16, 0) y (8, 6) ft. La barra 1 une los nudos 1 y 3, la barra 2 une los nudos 2 y 3, y los nudos 1 y 2 son articulados. Ambas barras tienen E = 29 000 ksi y A = 10 in², y el nudo 3 lleva 20 kip hacia la derecha y 30 kip hacia abajo.',
        'Cada barra mide 10 ft, de modo que EA = 290 000 kip y EA/L = 29 000 kip/ft. La barra 1 tiene c = 0.8 y s = 0.6; la barra 2 va del nudo 2 hacia arriba al nudo 3, así que c = −0.8 y s = 0.6. Los GDL son 1 y 2 en el nudo 1, 3 y 4 en el nudo 2, y 5 y 6 en el nudo 3, de modo que los vectores de código son [1 2 5 6] y [3 4 5 6]. En los GDL 5 y 6, la barra 1 suma 29 000 × [0.64 0.48; 0.48 0.36] y la barra 2 suma 29 000 × [0.64 −0.48; −0.48 0.36]. Los términos cruzados se cancelan, y K_FF = [37 120 0; 0 20 880] kip/ft.',
        'Con P_F = [20; −30] kip y los apoyos sin moverse, no hay nada bajo la diagonal que eliminar: u_5 = 20/37 120 y u_6 = −30/20 880, que son 0.00647 in hacia la derecha y 0.01724 in hacia abajo. Las reacciones son R_1 = 10, R_2 = 7.5, R_3 = −30 y R_4 = 22.5 kip. N = (EA/L)(u_j − u_i) vale −12.5 kip en la barra 1 y −37.5 kip en la barra 2, ambas en compresión, y ΣFx = 20 + 10 − 30 = 0 y ΣFy = −30 + 7.5 + 22.5 = 0. Por equilibrio del nudo 3, −0.8·N_1 + 0.8·N_2 + 20 = 0 y −0.6·N_1 − 0.6·N_2 − 30 = 0 dan las mismas dos fuerzas.',
        'Un pórtico exige flexión, así que tome una barra de longitud L, empotrada en el nudo 1 y cargada con P hacia abajo en el nudo 2. La carga no tiene parte axial: la fila axial contiene solo EA/L, nada la acopla a las otras y su movimiento resulta nulo. Las otras dos filas libres, para v_2 y θ_2, son K_FF = [12EI/L³ −6EI/L²; −6EI/L² 4EI/L] con P_F = [−P; 0]. El multiplicador es l = (−6EI/L²)/(12EI/L³) = −L/2; restar l veces la primera fila de la segunda deja EI/L donde estaba 4EI/L y −PL/2 a la derecha. La sustitución hacia atrás da θ_2 = −PL²/(2EI) y v_2 = −PL³/(3EI), el giro y la flecha de libro de texto en el extremo, y las reacciones en el nudo 1 son P hacia arriba y PL en sentido antihorario.',
        'Cómo leer las matrices. Cada matriz y cada vector tiene sus filas y columnas nombradas por GDL: 3y es el movimiento según y del nudo 3 y 2θ el giro del nudo 2. La fila d de K es la ecuación de equilibrio del GDL d. La columna d es el conjunto de fuerzas, en todos los GDL, que mantienen la estructura en la forma de un movimiento unitario del GDL d con todos los demás sujetos, de modo que el término de la fila a y la columna b es la fuerza en a cuando b se mueve una unidad.',
        'La unidad de un término sale de sus dos GDL: una fuerza por longitud entre dos movimientos (kip/ft, o kN/m), una fuerza por radián entre un movimiento y un giro (kip/rad, kN/rad) y un momento por radián entre dos giros (kip·ft/rad, kN·m/rad).',
        'K es simétrica: la fuerza en a por un movimiento unitario de b es la fuerza en b por un movimiento unitario de a, que es la reciprocidad de Maxwell y Betti, y la herramienta lo comprueba. Ningún término de la diagonal es negativo. Un cero fuera de la diagonal significa que mover un GDL no exige fuerza en el otro: ninguna barra une sus nudos, o la barra que los une no tiene rigidez en esa dirección (una barra horizontal y un movimiento transversal a ella), o los términos se cancelaron, como los términos cruzados del ejemplo. Antes de poner los apoyos, K no tiene inversa: un movimiento de toda la estructura como cuerpo rígido no exige fuerza alguna, así que K·u es cero para él, sean cuales sean las cargas. Los apoyos eliminan esos movimientos, y K_FF se puede resolver.',
        'Dentro de la matriz de una barra, los términos axiales y los de flexión no comparten ninguna celda en ejes locales, porque estirar una barra no la flexiona; el giro a ejes globales los mezcla. La herramienta señala los términos axiales y de flexión de k, las celdas donde cae una barra en el ensamblaje y las que recibieron más de una, y en la eliminación el pivote, las celdas que lleva a cero y las que cambia.',
        'Los términos son rigideces físicas. Para una columna de altura h empotrada en el pie, 12EI/h³ es la fuerza que desplaza su cabeza una unidad con la cabeza sin poder girar. Una viga que no gira, sobre dos columnas de ese tipo que no pueden acortarse, da una rigidez de 24EI/h³, así que una fuerza horizontal H desplaza el conjunto Hh³/(24EI).',
      ],
    },
    assumes: {
      title: 'Qué supone',
      items: [
        'El material se toma como lineal elástico y el análisis como de primer orden. Se plantea el equilibrio sobre la geometría dibujada, los desplazamientos se tratan como pequeños, y los efectos de segundo orden, entre ellos P–Δ, y el pandeo no se modelan: una barra esbelta en compresión no se señala.',
        'Cada barra es prismática: una sola sección y, por tanto, un solo valor de E, de A y de I en toda su longitud. La flexión sigue la teoría de Euler–Bernoulli, en la que las secciones siguen planas y normales al eje; se deja fuera la distorsión que causaría el cortante.',
        'Una barra de cercha está articulada en ambos extremos y lleva solo fuerza axial, de modo que una cercha recibe sus cargas en los nudos. Las cargas sobre barras que se escriban en modo cercha se conservan y no se usan, y la herramienta lo advierte.',
        'En modo pórtico cada barra está unida rígidamente a los nudos en ambos extremos. Aquí no se ofrecen rótulas ni liberaciones, resortes ni apoyos inclinados: un apoyo sujeta un movimiento global, según x, según y o el giro, y ninguna otra dirección.',
        'En modo pórtico la longitud de cada barra también cambia con su fuerza axial, de modo que una solución a mano en la que las longitudes no pueden cambiar no coincidirá hasta la última cifra.',
        'Las cargas sobre barras son una carga uniforme en toda la barra, una carga puntual estrictamente entre los extremos y una carga axial uniforme, cada una según los ejes propios de la barra. Una carga en un extremo se introduce como carga nodal. No hay carga de temperatura ni peso propio, salvo que se introduzca como carga.',
        'A un apoyo se le puede dar un asentamiento según x, según y o como giro, en un GDL que sujeta. Un valor escrito en un GDL que el apoyo deja libre no tiene efecto, y la herramienta lo advierte.',
        'Los dos módulos que se ofrecen como punto de partida, para acero y para aluminio, son valores típicos: introduzca el módulo y la sección de lo que realmente se especifique.',
        'Se analiza un caso estático a la vez. Las cargas se toman como se introducen, sin factor ni combinación; cada combinación de cargas es un caso que se introduce por separado.',
      ],
    },
    limits: {
      title: 'Qué deja fuera',
      items: [
        'Los resultados son desplazamientos, reacciones y fuerzas de extremo de las barras, y solo eso: no hay norma de diseño, ni carga mayorada, ni barra o conexión dimensionada. Juzgar una barra le corresponde a usted.',
        'Hasta 12 nudos, 20 barras, 12 apoyos, 40 cargas nodales y 24 cargas en barras, es decir, 36 GDL como máximo. El tope deja cada matriz pequeña como para leerla en una pantalla.',
        'La eliminación se muestra columna por columna hasta 12 GDL libres; con más, la herramienta da su resultado y su residuo, y ninguna de las columnas.',
        'Se rechaza una estructura en la que algún movimiento no encuentra resistencia, porque las barras pueden girar sin alargarse ni acortarse. El mensaje nombra el GDL en que la eliminación se detuvo y los nudos que se mueven. Dos barras de cercha alineadas que concurren en un nudo sin apoyo son el caso habitual: nada se opone a un movimiento transversal a su línea, y hay un cero en la diagonal. Para corregirlo, una el nudo a la estructura con otra barra o sujételo con un apoyo.',
        'Menos de tres GDL restringidos se rechaza antes de resolver, porque un cuerpo en el plano necesita tres para quedar en su sitio. Tres GDL que aun así dejen libre un movimiento de toda la estructura, como reacciones sobre tres rectas paralelas, los detecta la eliminación como un mecanismo de toda la estructura.',
        'Cada una de estas faltas se rechaza, y se nombra la entrada que la causa: dos nudos coincidentes; una barra que empieza y termina en el mismo nudo; dos barras que unen los mismos dos nudos; un nudo sin ninguna barra; una estructura en trozos separados; una barra cuya longitud es menor que una cienmilésima del tamaño de la estructura; una carga puntual que no está estrictamente dentro de su barra; una sección en blanco donde se necesita; y un número demasiado grande para la aritmética.',
        'Una barra muy rígida junto a otras muy blandas puede dejar la aritmética corta de cifras. Las comprobaciones del último paso lo miden, y una estructura en la que alguna no se alcanza se rechaza por mal condicionada.',
        'Fuerzas en barras de cerchas y Análisis de pórticos planos resuelven los mismos tipos de estructura sin imprimir una matriz, y el segundo admite rótulas, resortes, apoyos inclinados, cargas de temperatura y estructuras mayores. Esta herramienta sirve para leer el método y para comparar un caso pequeño con aquellas.',
      ],
    },
    signs: {
      title: 'Signos, unidades y significado de cada resultado',
      items: [
        'Los ejes globales son x creciente a la derecha e y creciente hacia arriba. Las cargas y las reacciones son positivas según +x y +y, así que la gravedad es una carga y negativa; los momentos, los giros y los pares son positivos en sentido antihorario. Los nudos, las barras y las filas se cuentan desde 1.',
        'Un GDL se nombra con su nudo y su dirección: 3x y 3y son los movimientos del nudo 3 según x y según y, y 3θ es su giro, en radianes. Dentro de una barra, los movimientos locales son u, v y θ en cada extremo, nombrados por el nudo: u1, v1, θ1, u3, v3, θ3.',
        'Los ejes locales de una barra: x̄ recorre la barra de punta a punta, del primer nudo al segundo, y ȳ queda a 90° en sentido antihorario de x̄, a su izquierda, de modo que una barra horizontal que va de izquierda a derecha tiene ȳ hacia arriba. Las cargas w y P sobre barras son positivas según +ȳ, lo que hace negativa la gravedad en una barra así, y q es positiva según +x̄. Una carga puntual actúa en a, medida desde el primer nudo.',
        'f contiene lo que los dos nudos aplican a la barra, en sus ejes locales: [Fx_i, Fy_i, M_i, Fx_j, Fy_j, M_j] para una barra de pórtico y [f_i, f_j] para una de cercha. De ahí salen las fuerzas internas junto a cada extremo: N = −Fx_i, V = Fy_i y M = −M_i en el primer extremo, y N = Fx_j, V = −Fy_j y M = M_j en el segundo.',
        'Una barra en tracción tiene una N positiva. V es positiva cuando las fuerzas que actúan sobre la parte de la barra del lado del primer nudo de un corte suman un empuje hacia +ȳ. M es positiva con tracción en la cara −ȳ, que es la inferior en una barra horizontal que va de izquierda a derecha.',
        'Caso resuelto: la barra 1 va del nudo 1, en (0, 0), al nudo 2, en (10, 0) ft, empotrada en ambos extremos, con w = −2 kip/ft. Sus fuerzas de empotramiento perfecto son f_FE = [0, 10, 16.667, 0, 10, −16.667], de modo que en el primer extremo V = 10 kip y M = −16.667 kip·ft, y en el segundo V = −10 y M = −16.667: tracción en la cara superior en ambos. Dibujada de derecha a izquierda, ȳ apunta hacia abajo y la misma carga es w = +2; entonces V = −10 en el primer extremo y 10 en el segundo, y M = 16.667 en ambos, la misma tracción en la cara superior con el signo contrario.',
        'Una reacción es la fuerza o el momento que un apoyo aplica a la estructura, según un eje global: positiva hacia +x y +y, y un momento positivo en sentido antihorario. En una barra de cercha, la tracción da una N positiva, el esfuerzo es N/A, y el alargamiento u_j − u_i, en ejes locales, es positivo si la barra se hace más larga.',
        'En el juego US, una longitud va en pies y una fuerza en kip; una carga lineal va en kip/ft y un momento en kip·ft; E va en ksi, A en in² e I en in⁴, y un asentamiento en pulgadas. En el juego SI, una longitud va en metros y una fuerza en kilonewtons; una carga lineal va en kN/m y un momento en kN·m; E va en GPa, A en mm² e I en 10⁶ mm⁴, y un asentamiento en milímetros. Un giro, el de un asentamiento incluido, va en radianes en ambos.',
        'Las matrices y los vectores de los pasos están en unidades de cálculo: pies y kip, o metros y kilonewtons, con E en kip/ft² y A en ft² (kN/m² y m²). Las tablas de resultados dan los desplazamientos en pulgadas o en milímetros, y el esfuerzo de una barra en ksi o MPa.',
        'Un valor menor que una milmillonésima del mayor de su matriz o vector se imprime como 0, pues es redondeo; la aritmética conserva todas las cifras.',
        'La estructura se guarda en la dirección web de esta página, tras #m=; pegar esa dirección en un navegador la devuelve.',
      ],
    },
    disclaimer: beamStrings.es.page.disclaimer,
    sheet: {
      kind: beamStrings.es.page.sheet.kind,
      credit: 'Elaborado con la calculadora de matriz de rigidez de {firm} — {address}',
      margin: beamStrings.es.page.sheet.margin,
    },
    back: 'Todas las calculadoras',
    noscript: 'Con los scripts apagados, esta página enseña solo la estructura inicial y no recalcula. Enciéndalos y cada paso se calcula en su equipo, sin que lo que usted escriba salga de él.',
  },
};
