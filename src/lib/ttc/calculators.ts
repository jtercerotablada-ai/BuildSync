import type { Lang } from './i18n';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CALCULATORS — the catalogue at /resources (and /es/resources)
 * ─────────────────────────────────────────────────────────────────────────────
 * The owner's request of October 9, 2026: one page that will hold every
 * calculator, with all of them LISTED and none of them built yet ("solo
 * ponlas sin crearlas aún"). So this is a list of what is planned, by
 * family, and the page says so in its first line: nothing here opens.
 *
 * WHEN A CALCULATOR IS BUILT: give its entry an `href` (CalculatorsView
 * prints the name as a link), then make the page indexable and list it in
 * the sitemap — see the route file. Until then the page is in the header
 * and the footer (the owner asked for that the same day) but noindex and
 * out of the sitemap: a list of things that do not exist yet is not
 * something to be found for in a search.
 *
 * THE FAMILIES AND THEIR ICONS. The owner drew sixteen icons, one per
 * general subject ("los 16 iconos corresponden a temas generales; varios
 * pueden representar distintas calculadoras"), and said which calculators
 * each stands for. So the catalogue is cut the way his icons cut it: a
 * family is the calculators one icon stands for. Steel connections are made
 * of bolts and of welds and carry both of those icons; no other family has
 * two, and none has an icon he did not draw. The files are his artwork,
 * untouched — cut to the drawing, centred on one common canvas at one scale
 * and resized (public/ttc/img/calc, 240px palette PNG, about 3 KB each).
 * NEVER redraw one, recolour one or add one of our own.
 *
 * THE NAMES ARE OURS. The owner asked for the titles to be named
 * differently, and better, than the list he started from. The rule: a name
 * says what is solved — the element and what is found for it ("Column
 * buckling load", "Bolt group in eccentric shear") — and never carries the
 * word "calculator": the page already says that ninety-seven times over.
 * Where the thing has one name in the trade ("Poisson's ratio",
 * "Gust-effect factor"), that is its name.
 *
 * WHAT AN ENTRY SAYS. The name, one line on what it computes, and the design
 * standards it is planned for. Where several standards are listed, each is a
 * version of the same calculator. A standard is named by its designation
 * only — no edition is promised unless it is part of the name people search
 * for ("ASCE 7-22").
 *
 * WHAT IT DOES NOT SAY: when a calculator will be ready, that any of them
 * is free, or anything about another company's product — no vendor's name,
 * and no vendor's client-specific tool, belongs in it.
 *
 * NOT IN THE CLIENT BUNDLE: read by CalculatorsView (a server component)
 * only. Do not import it from a 'use client' file.
 *
 * Both languages sit side by side in each entry, so one cannot be added
 * without the other (calculators.test.ts checks every pair).
 */

type T = Record<Lang, string>;

/** The owner's sixteen icons: the file, and what the drawing shows. */
export const calculatorIcons = {
  beam: {
    src: '/ttc/img/calc/beam.png',
    alt: { en: 'Line drawing of a beam on two supports with a load at midspan', es: 'Dibujo de una viga sobre dos apoyos con una carga al centro' },
  },
  truss: {
    src: '/ttc/img/calc/truss.png',
    alt: { en: 'Line drawing of a roof truss on two supports', es: 'Dibujo de una cercha de techo sobre dos apoyos' },
  },
  frame: {
    src: '/ttc/img/calc/frame.png',
    alt: { en: 'Line drawing of a portal frame with a load on its beam', es: 'Dibujo de un pórtico con una carga sobre su viga' },
  },
  buckling: {
    src: '/ttc/img/calc/buckling.png',
    alt: { en: 'Line drawing of a column bowing under an axial load', es: 'Dibujo de una columna que se curva bajo una carga axial' },
  },
  section: {
    src: '/ttc/img/calc/section.png',
    alt: { en: 'Line drawing of an I-shaped section with its two axes', es: 'Dibujo de una sección en I con sus dos ejes' },
  },
  steel: {
    src: '/ttc/img/calc/steel.png',
    alt: { en: 'Line drawing of a steel I-beam', es: 'Dibujo de una viga I de acero' },
  },
  timber: {
    src: '/ttc/img/calc/timber.png',
    alt: { en: 'Line drawing of a timber member showing its grain', es: 'Dibujo de una pieza de madera con su veta' },
  },
  concrete: {
    src: '/ttc/img/calc/concrete.png',
    alt: { en: 'Line drawing of a concrete section with its reinforcing bars', es: 'Dibujo de una sección de concreto con sus barras de refuerzo' },
  },
  footing: {
    src: '/ttc/img/calc/footing.png',
    alt: { en: 'Line drawing of a column on a spread footing', es: 'Dibujo de una columna sobre una zapata' },
  },
  retainingWall: {
    src: '/ttc/img/calc/retaining-wall.png',
    alt: { en: 'Line drawing of a retaining wall holding back soil', es: 'Dibujo de un muro de contención que retiene el suelo' },
  },
  bolts: {
    src: '/ttc/img/calc/bolts.png',
    alt: { en: 'Line drawing of a bolted plate pulled sideways', es: 'Dibujo de una placa con pernos sometida a una fuerza lateral' },
  },
  weld: {
    src: '/ttc/img/calc/weld.png',
    alt: { en: 'Line drawing of a plate joined to its base by a fillet weld', es: 'Dibujo de una placa unida a su base con soldadura de filete' },
  },
  wind: {
    src: '/ttc/img/calc/wind.png',
    alt: { en: 'Line drawing of wind flowing over a building', es: 'Dibujo del viento pasando sobre un edificio' },
  },
  snow: {
    src: '/ttc/img/calc/snow.png',
    alt: { en: 'Line drawing of a snowflake over a roof', es: 'Dibujo de un copo de nieve sobre un techo' },
  },
  seismic: {
    src: '/ttc/img/calc/seismic.png',
    alt: { en: 'Line drawing of a building over a ground-motion trace', es: 'Dibujo de un edificio sobre un trazo del movimiento del suelo' },
  },
  pitch: {
    src: '/ttc/img/calc/pitch.png',
    alt: { en: 'Line drawing of a triangle with its base angle marked', es: 'Dibujo de un triángulo con el ángulo de su base marcado' },
  },
} satisfies Record<string, { src: string; alt: T }>;

export type CalculatorIcon = keyof typeof calculatorIcons;

/** Side of the icon files, in pixels (they are square). */
export const CALCULATOR_ICON_PX = 240;

export type Calculator = {
  name: T;
  /** What it computes, in one line. */
  does: T;
  /** Design standards planned, the US one first. */
  codes?: string[];
  /** Canonical path of the calculator, once it exists. */
  href?: string;
};

export type CalculatorFamily = {
  /** The anchor on the page, the same in both languages. */
  id: string;
  title: T;
  /** The owner's icon for the family; two for steel connections only. */
  icons: CalculatorIcon[];
  items: Calculator[];
};

export const calculatorsPage: Record<
  Lang,
  {
    eyebrow: string;
    h1: string;
    sub: string;
    title: string;
    description: string;
    crumb: string;
    families: string;
    planned: string;
    index: string;
    codes: string;
    note: string;
  }
> = {
  en: {
    eyebrow: 'Tools',
    h1: 'Structural engineering calculators',
    sub: 'The calculators we are building, by subject. None is open yet: this page is the list, and each one will be linked from here on the day it is released.',
    title: 'Structural Engineering Calculators',
    description:
      'The structural engineering calculators we are building: analysis, steel, concrete, timber, foundations, connections and loads. None is open yet.',
    crumb: 'Calculators',
    families: 'Subjects',
    planned: 'planned',
    index: 'Calculators by subject',
    codes: 'Standards',
    note: 'Where an entry names several design standards, each one is a version of the same calculator.',
  },
  es: {
    eyebrow: 'Herramientas',
    h1: 'Calculadoras de ingeniería estructural',
    sub: 'Las calculadoras que estamos construyendo, por tema. Ninguna está abierta todavía: esta página es la lista, y cada una se enlazará desde aquí el día en que se publique.',
    title: 'Calculadoras de ingeniería estructural',
    description:
      'Calculadoras de ingeniería estructural en construcción: análisis, acero, concreto, madera, cimentaciones, conexiones y cargas. Aún no hay ninguna abierta.',
    crumb: 'Calculadoras',
    families: 'Temas',
    planned: 'previstas',
    index: 'Calculadoras por tema',
    codes: 'Normas',
    note: 'Donde una entrada nombra varias normas de diseño, cada una es una versión de la misma calculadora.',
  },
};

export const calculatorFamilies: CalculatorFamily[] = [
  {
    id: 'beams',
    title: { en: 'Beams', es: 'Vigas' },
    icons: ['beam'],
    items: [
      { name: { en: 'Beam reactions and diagrams', es: 'Reacciones y diagramas de vigas' }, does: { en: 'Reactions, shear and moment diagrams, deflection and stress of a beam under any set of loads.', es: 'Reacciones, diagramas de cortante y de momento, deflexión y esfuerzos de una viga con cualquier combinación de cargas.' } },
      { name: { en: 'Single-span beam', es: 'Viga de un solo vano' }, does: { en: 'The simply supported case, under point and distributed loads.', es: 'El caso simplemente apoyado, con cargas puntuales y distribuidas.' } },
      { name: { en: 'Continuous beam', es: 'Viga continua' }, does: { en: 'A beam over several supports, solved by finite elements.', es: 'Una viga sobre varios apoyos, resuelta por elementos finitos.' } },
      { name: { en: 'Shaft on bearings', es: 'Eje sobre cojinetes' }, does: { en: 'Reactions, bending and deflection of a mechanical shaft.', es: 'Reacciones, flexión y deflexión de un eje mecánico.' } },
    ],
  },
  {
    id: 'trusses',
    title: { en: 'Trusses and cables', es: 'Cerchas y cables' },
    icons: ['truss'],
    items: [
      { name: { en: 'Truss member forces', es: 'Fuerzas en barras de cerchas' }, does: { en: 'Axial force in every member, tension or compression, and the reactions of a 2D truss.', es: 'Fuerza axial en cada barra, a tensión o a compresión, y reacciones de una cercha 2D.' } },
      { name: { en: 'Cable tension and elongation', es: 'Tensión y alargamiento de cables' }, does: { en: 'Tension, stress and elastic and thermal stretch of a cable; pulling a load against friction.', es: 'Tensión, esfuerzo y estiramiento elástico y térmico de un cable; arrastre de una carga con fricción.' } },
      { name: { en: 'Cable sag and pretension', es: 'Flecha y pretensión de cables' }, does: { en: 'The pretension a cable needs to hang with a given sag.', es: 'La pretensión que necesita un cable para colgar con una flecha dada.' } },
    ],
  },
  {
    id: 'frames',
    title: { en: 'Frames', es: 'Pórticos' },
    icons: ['frame'],
    items: [
      { name: { en: 'Plane frame analysis', es: 'Análisis de pórticos planos' }, does: { en: 'Moments, shears, axial forces and reactions of a 2D frame.', es: 'Momentos, cortantes, fuerzas axiales y reacciones de un pórtico 2D.' } },
      { name: { en: 'Stiffness matrix, step by step', es: 'Matriz de rigidez, paso a paso' }, does: { en: 'Local and global stiffness matrices, displacements and reactions of 2D members, with every step shown.', es: 'Matrices de rigidez locales y globales, desplazamientos y reacciones de elementos 2D, con cada paso a la vista.' } },
    ],
  },
  {
    id: 'buckling',
    title: { en: 'Buckling', es: 'Pandeo' },
    icons: ['buckling'],
    items: [
      { name: { en: 'Column buckling load', es: 'Carga de pandeo de columnas' }, does: { en: 'Critical load from the length, the end conditions, the material and the section.', es: 'Carga crítica según la longitud, los apoyos, el material y la sección.' } },
      { name: { en: 'Plate buckling stress', es: 'Esfuerzo de pandeo de placas' }, does: { en: 'Critical stress of a plate in compression.', es: 'Esfuerzo crítico de una placa comprimida.' } },
      { name: { en: 'Column with lateral load', es: 'Columna con carga lateral' }, does: { en: 'A column that carries axial and transverse load at the same time.', es: 'Una columna que recibe carga axial y carga transversal a la vez.' } },
    ],
  },
  {
    id: 'sections',
    title: { en: 'Sections and materials', es: 'Secciones y materiales' },
    icons: ['section'],
    items: [
      { name: { en: 'Inertia and centroid of any shape', es: 'Inercia y centroide de cualquier forma' }, does: { en: 'Moments of inertia, centroid, section moduli and the other geometric properties of a custom section.', es: 'Momentos de inercia, centroide, módulos de sección y las demás propiedades geométricas de una sección a medida.' } },
      { name: { en: 'Properties of standard sections', es: 'Propiedades de secciones estándar' }, does: { en: 'Area, centroid, inertia and section modulus of I, T, C, L, hollow and solid shapes.', es: 'Área, centroide, inercia y módulo resistente de perfiles I, T, C, L, tubulares y macizos.' } },
      { name: { en: 'Rolled steel shape lookup', es: 'Consulta de perfiles laminados de acero' }, does: { en: 'Dimensions and properties of rolled shapes, found by designation.', es: 'Dimensiones y propiedades de perfiles laminados, buscadas por designación.' } },
      { name: { en: 'Modulus of elasticity', es: 'Módulo de elasticidad' }, does: { en: 'Young’s modulus from stress and strain, or from a test curve.', es: 'Módulo de Young a partir del esfuerzo y la deformación, o de una curva de ensayo.' } },
      { name: { en: 'Poisson’s ratio', es: 'Coeficiente de Poisson' }, does: { en: 'From measured strains, or from the elastic and shear moduli.', es: 'A partir de deformaciones medidas, o de los módulos elástico y de cortante.' } },
      { name: { en: 'Spring force and stiffness', es: 'Fuerza y rigidez de resortes' }, does: { en: 'Hooke’s law: the force in a spring from its stiffness and its extension or compression.', es: 'Ley de Hooke: la fuerza de un resorte según su rigidez y su extensión o compresión.' } },
    ],
  },
  {
    id: 'steel',
    title: { en: 'Steel and aluminum', es: 'Acero y aluminio' },
    icons: ['steel'],
    items: [
      { name: { en: 'Steel member strength', es: 'Resistencia de miembros de acero' }, does: { en: 'Flexure, shear, tension, compression and combined loading of a steel member.', es: 'Flexión, cortante, tensión, compresión y cargas combinadas de un miembro de acero.' }, codes: ['AISC 360', 'CSA S16', 'EN 1993-1-1', 'AS 4100', 'NZS 3404'] },
      { name: { en: 'Wide-flange beam capacity', es: 'Capacidad de vigas de ala ancha' }, does: { en: 'A quick check of the load an I-shape carries over a given span and bracing.', es: 'Comprobación rápida de la carga que lleva un perfil I con un vano y un arriostramiento dados.' }, codes: ['AISC 360'] },
      { name: { en: 'Single-angle capacity', es: 'Capacidad de ángulos simples' }, does: { en: 'Capacity and utilization of single-angle members.', es: 'Capacidad y aprovechamiento de perfiles angulares L.' }, codes: ['AISC 360', 'EN 1993-1-1', 'AS 4100', 'NZS 3404'] },
      { name: { en: 'Steel channel capacity', es: 'Capacidad de canales de acero' }, does: { en: 'Flexure, shear and axial capacity of C shapes.', es: 'Capacidad a flexión, a cortante y a carga axial de perfiles C.' }, codes: ['AISC 360'] },
      { name: { en: 'HSS and pipe capacity', es: 'Capacidad de perfiles tubulares' }, does: { en: 'Rectangular, square and round hollow sections under flexure, shear and axial load.', es: 'Tubulares rectangulares, cuadrados y circulares a flexión, cortante y carga axial.' }, codes: ['AISC 360'] },
      { name: { en: 'Plate bending and shear', es: 'Flexión y cortante de placas' }, does: { en: 'Out-of-plane bending and shear capacity of a steel plate, and its weight per length.', es: 'Capacidad a flexión fuera del plano y a cortante de una placa de acero, y su peso por longitud.' }, codes: ['AISC 360', 'EN 1993-1-1', 'AS 4100'] },
      { name: { en: 'Cold-formed steel members', es: 'Miembros de acero conformado en frío' }, does: { en: 'Strength and load interaction of cold-formed shapes, buckling modes included.', es: 'Resistencia e interacción de cargas en perfiles conformados en frío, con sus modos de pandeo.' }, codes: ['AISI S100', 'CSA S136', 'EN 1993-1-3', 'AS/NZS 4600'] },
      { name: { en: 'C and Z purlins', es: 'Correas C y Z' }, does: { en: 'Capacity, span and spacing of purlins: flexure, shear and deflection.', es: 'Capacidad, vano y separación de correas: flexión, cortante y deflexión.' }, codes: ['AISI S100', 'EN 1993-1-3', 'AS/NZS 4600'] },
      { name: { en: 'Aluminum members', es: 'Miembros de aluminio' }, does: { en: 'Flexure, shear, tension, compression and combined actions in aluminum shapes.', es: 'Flexión, cortante, tensión, compresión y acciones combinadas en perfiles de aluminio.' }, codes: ['ADM', 'CSA S157', 'Eurocode 9', 'AS/NZS 1664'] },
      { name: { en: 'Scaffold tubes and couplers', es: 'Tubos y acoples de andamio' }, does: { en: 'Capacity under axial load, bending and shear.', es: 'Capacidad ante carga axial, flexión y cortante.' }, codes: ['AISC 360', 'BS EN 12811', 'AS/NZS 1576'] },
      { name: { en: 'Steel deck spans', es: 'Vanos de lámina de acero' }, does: { en: 'Capacity of a roof deck, and the unshored span of a floor deck.', es: 'Capacidad de la lámina de techo y vano sin apuntalar de la lámina de entrepiso.' }, codes: ['SDI'] },
    ],
  },
  {
    id: 'timber',
    title: { en: 'Timber', es: 'Madera' },
    icons: ['timber'],
    items: [
      { name: { en: 'Wood beams and columns', es: 'Vigas y columnas de madera' }, does: { en: 'Flexure, shear, tension, compression and interaction in wood members.', es: 'Flexión, cortante, tensión, compresión e interacción en miembros de madera.' }, codes: ['NDS', 'CSA O86', 'EN 1995-1-1', 'AS 1720.1', 'NZS AS 1720.1'] },
      { name: { en: 'Bearing at wood supports', es: 'Aplastamiento en apoyos de madera' }, does: { en: 'Local crushing of the wood where a member sits on its support.', es: 'Aplastamiento local de la madera donde un miembro descansa en su apoyo.' }, codes: ['AS 1720.1'] },
      { name: { en: 'Wood connections with fasteners', es: 'Uniones de madera con fijaciones' }, does: { en: 'Capacity of fastened connections, by type of fastener and direction of load.', es: 'Capacidad de uniones con fijaciones, según el tipo de fijación y la dirección de la carga.' }, codes: ['EN 1995-1-1', 'AS 1720.1'] },
      { name: { en: 'Maximum joist span', es: 'Vano máximo de viguetas' }, does: { en: 'The longest span of a floor joist for the loads, the spacing and the species and grade.', es: 'El mayor vano de una vigueta de piso según las cargas, la separación y la especie y el grado.' }, codes: ['AWC'] },
      { name: { en: 'Roof rafters', es: 'Cabios de techo' }, does: { en: 'Strength of a rafter from its section, its material and its loads.', es: 'Resistencia de un cabio según su sección, su material y sus cargas.' }, codes: ['NDS'] },
      { name: { en: 'Wood shear walls', es: 'Muros de corte de madera' }, does: { en: 'Segmented walls: unit shear, hold-down and chord forces, plate bearing and drift.', es: 'Muros segmentados: cortante unitario, fuerzas en anclajes (hold-downs) y cordones, aplastamiento de la solera y deriva.' }, codes: ['NDS', 'SDPWS'] },
    ],
  },
  {
    id: 'concrete',
    title: { en: 'Reinforced concrete', es: 'Concreto reforzado' },
    icons: ['concrete'],
    items: [
      { name: { en: 'Concrete beam capacity', es: 'Capacidad de vigas de concreto' }, does: { en: 'Capacity of rectangular and T-shaped reinforced beams.', es: 'Capacidad de vigas reforzadas rectangulares y en T.' }, codes: ['ACI 318'] },
      { name: { en: 'Column interaction diagram', es: 'Diagrama de interacción de columnas' }, does: { en: 'Rectangular and circular columns: the axial–moment diagram and the design checks.', es: 'Columnas rectangulares y circulares: el diagrama axial-momento y las comprobaciones de diseño.' }, codes: ['ACI 318', 'CSA A23.3', 'Eurocode 2', 'AS 3600', 'NZS 3101'] },
      { name: { en: 'Concrete wall strength', es: 'Resistencia de muros de concreto' }, does: { en: 'Strength and utilization of structural walls.', es: 'Resistencia y aprovechamiento de muros estructurales.' }, codes: ['ACI 318', 'AS 3600'] },
      { name: { en: 'Short corbels', es: 'Ménsulas cortas' }, does: { en: 'Design of reinforced concrete corbels.', es: 'Diseño de ménsulas de concreto reforzado.' }, codes: ['ACI 318'] },
      { name: { en: 'Slab flexure and shear', es: 'Flexión y cortante de losas' }, does: { en: 'Flexural and shear resistance of a reinforced slab.', es: 'Resistencia a flexión y a cortante de una losa reforzada.' }, codes: ['CSA A23.3'] },
      { name: { en: 'Punching shear at columns', es: 'Punzonamiento en columnas' }, does: { en: 'Punching capacity of a slab around a column or a concentrated load.', es: 'Capacidad a punzonamiento de una losa alrededor de una columna o de una carga concentrada.' }, codes: ['ACI 318', 'CSA A23.3', 'Eurocode 2', 'AS 3600'] },
      { name: { en: 'Bar development and splices', es: 'Desarrollo y traslape de barras' }, does: { en: 'Development, anchorage and lap-splice lengths of reinforcing bars.', es: 'Longitudes de desarrollo, de anclaje y de traslape de las barras de refuerzo.' }, codes: ['ACI 318', 'Eurocode 2', 'AS 3600', 'NZS 3101'] },
      { name: { en: 'Crack width estimate', es: 'Estimación del ancho de fisuras' }, does: { en: 'Expected crack width of a section under the loads entered.', es: 'Ancho esperado de las fisuras de una sección con las cargas introducidas.' }, codes: ['BS 8007'] },
      { name: { en: 'Concrete members in fire', es: 'Elementos de concreto ante el fuego' }, does: { en: 'Capacity of a member under fire exposure.', es: 'Capacidad de un elemento expuesto al fuego.' }, codes: ['EN 1992-1-2'] },
      { name: { en: 'Fire rating of columns', es: 'Resistencia al fuego de columnas' }, does: { en: 'Fire-resistance period of a reinforced column.', es: 'Periodo de resistencia al fuego de una columna reforzada.' }, codes: ['AS 3600'] },
      { name: { en: 'Cover and durability', es: 'Recubrimiento y durabilidad' }, does: { en: 'Nominal cover and minimum concrete class for the exposure.', es: 'Recubrimiento nominal y clase mínima del concreto según la exposición.' }, codes: ['Eurocode 2'] },
      { name: { en: 'Stiffened slab on ground', es: 'Losa rigidizada sobre terreno' }, does: { en: 'Slabs on expansive or compressible soils: flexure, shear and deformation.', es: 'Losas sobre suelos expansivos o compresibles: flexión, cortante y deformación.' }, codes: ['ACI 360'] },
      { name: { en: 'House slab on ground', es: 'Losa de vivienda sobre terreno' }, does: { en: 'Residential slabs sized for the soil class and the layout of the house.', es: 'Losas residenciales dimensionadas según la clase de suelo y la distribución de la vivienda.' }, codes: ['AS 2870'] },
      { name: { en: 'Confined concrete stress–strain', es: 'Esfuerzo-deformación del concreto confinado' }, does: { en: 'Stress–strain curves with and without confinement, by Mander’s model.', es: 'Curvas esfuerzo-deformación con y sin confinamiento, por el modelo de Mander.' } },
    ],
  },
  {
    id: 'foundations',
    title: { en: 'Foundations', es: 'Cimentaciones' },
    icons: ['footing'],
    items: [
      { name: { en: 'Footing pressure and reinforcement', es: 'Presiones y refuerzo de zapatas' }, does: { en: 'Soil pressure and stability, one-way and punching shear, flexure and steel of a footing.', es: 'Presiones y estabilidad, cortante en una dirección y punzonamiento, flexión y acero de una zapata.' } },
      { name: { en: 'Isolated footings', es: 'Zapatas aisladas' }, does: { en: 'Pad footings under axial load, uplift, shear and biaxial moment.', es: 'Zapatas bajo carga axial, levantamiento, cortante y momento biaxial.' }, codes: ['ACI 318', 'Eurocode 2', 'AS 3600'] },
      { name: { en: 'Wall footings', es: 'Zapatas corridas' }, does: { en: 'Continuous footings under walls.', es: 'Zapatas continuas bajo muros.' }, codes: ['ACI 318', 'AS 3600'] },
      { name: { en: 'Helical piles', es: 'Pilotes helicoidales' }, does: { en: 'Structural and geotechnical capacity of screw piles in tension and compression.', es: 'Capacidad estructural y geotécnica de pilotes de hélice a tensión y a compresión.' } },
      { name: { en: 'Laterally loaded piles', es: 'Pilotes con carga lateral' }, does: { en: 'Required embedment, lateral resistance and shear and moment diagrams, by Broms or Brinch Hansen.', es: 'Empotramiento requerido, resistencia lateral y diagramas de cortante y momento, por Broms o Brinch Hansen.' } },
      { name: { en: 'Axial pile capacity', es: 'Capacidad axial de pilotes' }, does: { en: 'Piles sized for the axial load they carry.', es: 'Pilotes dimensionados para la carga axial que reciben.' }, codes: ['IBC'] },
    ],
  },
  {
    id: 'soil',
    title: { en: 'Retaining walls and soil', es: 'Muros de contención y suelos' },
    icons: ['retainingWall'],
    items: [
      { name: { en: 'Retaining wall stability', es: 'Estabilidad de muros de contención' }, does: { en: 'Cantilever and gravity walls: sliding, overturning and bearing.', es: 'Muros en voladizo y de gravedad: deslizamiento, volcamiento y presión en la base.' } },
      { name: { en: 'Soil bearing capacity', es: 'Capacidad portante del suelo' }, does: { en: 'By Terzaghi, Meyerhof, Hansen and Vesic, with a sensitivity study.', es: 'Por Terzaghi, Meyerhof, Hansen y Vesic, con análisis de sensibilidad.' }, codes: ['Eurocode 7', 'AS 4678', 'AS 5100'] },
      { name: { en: 'CPT soil profile', es: 'Perfil de suelo por CPT' }, does: { en: 'Cone penetration readings turned into a soil profile and its physical and mechanical properties.', es: 'Lecturas de penetración de cono convertidas en un perfil de suelo y sus propiedades físicas y mecánicas.' } },
      { name: { en: 'SPT correlations', es: 'Correlaciones del SPT' }, does: { en: 'Standard penetration test data and the soil parameters correlated from it.', es: 'Datos del ensayo de penetración estándar y los parámetros del suelo que se correlacionan con ellos.' } },
    ],
  },
  {
    id: 'bolts',
    title: { en: 'Bolts and anchors', es: 'Pernos y anclajes' },
    icons: ['bolts'],
    items: [
      { name: { en: 'Bolt group forces', es: 'Fuerzas en grupos de pernos' }, does: { en: 'Force per bolt, shear, tension and their interaction, bearing, tear-out and spacing.', es: 'Fuerza por perno, cortante, tensión y su interacción, aplastamiento, desgarro y separaciones.' }, codes: ['AISC 360', 'CSA S16', 'EN 1993-1-8', 'AS 4100', 'NZS 3404'] },
      { name: { en: 'Bolt group in eccentric shear', es: 'Grupo de pernos con cortante excéntrico' }, does: { en: 'Instantaneous center of rotation and coefficient C of the group.', es: 'Centro instantáneo de rotación y coeficiente C del grupo.' }, codes: ['AISC 360'] },
      { name: { en: 'Bolt bearing in cold-formed steel', es: 'Aplastamiento de pernos en acero conformado en frío' }, does: { en: 'Bearing strength at bolted connections of thin steel.', es: 'Resistencia por aplastamiento en conexiones atornilladas de lámina delgada.' }, codes: ['AISI S100'] },
      { name: { en: 'Bolt tightening torque', es: 'Torque de apriete de pernos' }, does: { en: 'Torque, or clamp force, from the diameter and the friction condition.', es: 'Torque, o fuerza de sujeción, según el diámetro y la condición de fricción.' } },
      { name: { en: 'Column base plate and anchors', es: 'Placa base y anclajes de columna' }, does: { en: 'Plate, anchor rods, welds and the supporting concrete under the applied actions.', es: 'Placa, pernos de anclaje, soldaduras y concreto de soporte ante las acciones aplicadas.' } },
      { name: { en: 'Shear lug under a base plate', es: 'Llave de cortante bajo la placa base' }, does: { en: 'The lug, and the transfer of its force into the concrete.', es: 'La llave, y la transferencia de su fuerza al concreto.' } },
    ],
  },
  {
    id: 'welds',
    title: { en: 'Welds', es: 'Soldaduras' },
    icons: ['weld'],
    items: [
      { name: { en: 'Fillet weld group strength', es: 'Resistencia de grupos de soldadura de filete' }, does: { en: 'Strength and utilization of a weld group from its geometry and its loads.', es: 'Resistencia y aprovechamiento de un grupo de soldaduras según su geometría y sus cargas.' }, codes: ['AISC 360', 'EN 1993-1-8', 'AS 4100', 'NZS 3404'] },
      { name: { en: 'Weld group in eccentric load', es: 'Grupo de soldaduras con carga excéntrica' }, does: { en: 'Coefficient C and capacity of a group loaded off its centroid.', es: 'Coeficiente C y capacidad de un grupo cargado fuera de su centroide.' }, codes: ['AISC 360'] },
      { name: { en: 'Lifting lugs', es: 'Orejas de izaje' }, does: { en: 'Tension, bearing, shear, tear-out and the weld of a lug.', es: 'Tensión, aplastamiento, cortante, arrancamiento y soldadura de una oreja.' } },
    ],
  },
  {
    id: 'connections',
    title: { en: 'Steel connections', es: 'Conexiones de acero' },
    // Made of both: the one family with two of the owner's icons.
    icons: ['bolts', 'weld'],
    items: [
      { name: { en: 'Beam-end shear connections', es: 'Conexiones a cortante en extremo de viga' }, does: { en: 'A beam’s shear carried to its support: plates, angles, bolts and welds checked.', es: 'El cortante de una viga llevado a su apoyo: comprobación de placas, ángulos, pernos y soldaduras.' } },
      { name: { en: 'Shear tabs, single or double', es: 'Placas de cortante, simples o dobles' }, does: { en: 'Web connections made with one plate or with two.', es: 'Conexiones de alma hechas con una placa o con dos.' } },
      { name: { en: 'Clip angles, single or double', es: 'Ángulos de conexión, simples o dobles' }, does: { en: 'Connections made with one angle or with two, eccentricity included.', es: 'Conexiones hechas con un ángulo o con dos, con sus efectos de excentricidad.' } },
      { name: { en: 'Shear end plates', es: 'Placas de extremo a cortante' }, does: { en: 'End-plate connections and their fasteners.', es: 'Conexiones con placa de extremo y sus fijaciones.' } },
      { name: { en: 'Directly welded beam web', es: 'Alma de viga soldada directamente' }, does: { en: 'The weld, the web and the base metal checked.', es: 'Comprobación de la soldadura, del alma y del metal base.' } },
      { name: { en: 'Beam-to-support moment connections', es: 'Conexiones a momento entre viga y apoyo' }, does: { en: 'Moment, shear and axial force passed between a beam and its support.', es: 'Momento, cortante y fuerza axial transmitidos entre una viga y su apoyo.' } },
      { name: { en: 'Flange plates and welded flanges', es: 'Placas de ala y alas soldadas' }, does: { en: 'Moment carried through plates on the flanges or through flanges welded directly.', es: 'Momento transmitido por placas en las alas o por alas soldadas directamente.' } },
      { name: { en: 'Moment end plates, flush or extended', es: 'Placas de extremo a momento, enrasadas o extendidas' }, does: { en: 'Bolted end plates that carry the moment of the beam.', es: 'Placas de extremo atornilladas que transmiten el momento de la viga.' } },
      { name: { en: 'Bolted beam splices', es: 'Empalmes atornillados de vigas' }, does: { en: 'Splices that carry moment, shear and axial force.', es: 'Empalmes que transmiten momento, cortante y fuerza axial.' } },
      { name: { en: 'Column splices', es: 'Empalmes de columnas' }, does: { en: 'Compression, tension, moment and shear across the splice.', es: 'Compresión, tensión, momento y cortante a través del empalme.' } },
      { name: { en: 'Vertical brace gussets', es: 'Cartelas de arriostramiento vertical' }, does: { en: 'Diagonal brace connections and their gussets, in tension and in compression.', es: 'Conexiones de diagonales y sus cartelas, a tensión y a compresión.' } },
      { name: { en: 'Horizontal brace connections', es: 'Conexiones de arriostramiento horizontal' }, does: { en: 'Horizontal bracing connected with plates or with angles.', es: 'Arriostramiento horizontal conectado con placas o con ángulos.' } },
      { name: { en: 'Chevron brace gussets', es: 'Cartelas de arriostramiento en V' }, does: { en: 'V-brace connections made through a gusset.', es: 'Conexiones de diagonales en V hechas con cartela.' } },
      { name: { en: 'Knee braces and truss joints', es: 'Arriostres de rodilla y nudos de cercha' }, does: { en: 'Knee braces, and the gusseted joints of a truss.', es: 'Arriostres de rodilla, y los nudos con cartela de una cercha.' } },
      { name: { en: 'Seat angles and WT connections', es: 'Ángulos de asiento y conexiones con WT' }, does: { en: 'Bearing and shear connections made with a seat angle or with a WT.', es: 'Conexiones de apoyo y de cortante hechas con un ángulo de asiento o con un perfil WT.' } },
      { name: { en: 'Angle kicker braces', es: 'Puntales angulares (kickers)' }, does: { en: 'Angle braces connected to W shapes, in tension and in compression.', es: 'Puntales angulares conectados a perfiles W, a tensión y a compresión.' } },
    ],
  },
  {
    id: 'wind',
    title: { en: 'Wind', es: 'Viento' },
    icons: ['wind'],
    items: [
      { name: { en: 'Design wind pressures', es: 'Presiones de viento de diseño' }, does: { en: 'Wind speed, pressures and design loads for the site, the structure and the standard.', es: 'Velocidad del viento, presiones y cargas de diseño según el sitio, la estructura y la norma.' }, codes: ['ASCE 7'] },
      { name: { en: 'Gust-effect factor', es: 'Factor de efecto de ráfaga' }, does: { en: 'The factor for a rigid or a flexible structure, in metric and in imperial units.', es: 'El factor para una estructura rígida o flexible, en unidades métricas e imperiales.' }, codes: ['ASCE 7-16', 'ASCE 7-22'] },
      { name: { en: 'Wind on houses', es: 'Viento en viviendas' }, does: { en: 'Wind class of a house and the pressures on its walls, roof and tie-downs.', es: 'Clase de viento de una vivienda y presiones sobre sus muros, techo y anclajes.' }, codes: ['AS 4055'] },
    ],
  },
  {
    id: 'snow',
    title: { en: 'Snow', es: 'Nieve' },
    icons: ['snow'],
    items: [
      { name: { en: 'Roof snow load', es: 'Carga de nieve en cubiertas' }, does: { en: 'Snow load at the site and on the roof.', es: 'Carga de nieve en el sitio y sobre la cubierta.' }, codes: ['ASCE 7'] },
      { name: { en: 'Snow drift at roof steps', es: 'Acumulación de nieve en desniveles de techo' }, does: { en: 'Drift where roofs meet at different levels.', es: 'Acumulación donde se encuentran techos de distinto nivel.' }, codes: ['NBCC'] },
    ],
  },
  {
    id: 'seismic',
    title: { en: 'Seismic', es: 'Sismo' },
    icons: ['seismic'],
    items: [
      { name: { en: 'Seismic design parameters', es: 'Parámetros sísmicos de diseño' }, does: { en: 'Site parameters and the design actions that follow from them.', es: 'Parámetros del sitio y las acciones de diseño que se derivan de ellos.' }, codes: ['ASCE 7'] },
      { name: { en: 'Earthquake design actions', es: 'Acciones sísmicas de diseño' }, does: { en: 'Earthquake actions on a structure.', es: 'Acciones sísmicas sobre una estructura.' }, codes: ['AS 1170.4'] },
    ],
  },
  {
    id: 'general',
    title: { en: 'General tools', es: 'Herramientas generales' },
    icons: ['pitch'],
    items: [
      { name: { en: 'Roof pitch and rafter length', es: 'Pendiente de techo y longitud del cabio' }, does: { en: 'Pitch in degrees, percent and ratio, and how long the rafter is.', es: 'Pendiente en grados, porcentaje y relación, y cuánto mide el cabio.' } },
      { name: { en: 'Load combination builder', es: 'Generador de combinaciones de carga' }, does: { en: 'Combinations, factors and patterns for strength and for service.', es: 'Combinaciones, factores y patrones para resistencia y para servicio.' }, codes: ['ASCE 7', 'NBCC', 'Eurocode', 'AS/NZS 1170', 'IS 875'] },
      { name: { en: 'Tributary areas and member loads', es: 'Áreas tributarias y carga por elemento' }, does: { en: 'The area, and the load, each member takes in one-way and two-way systems.', es: 'El área, y la carga, que recibe cada elemento en sistemas de una y de dos direcciones.' } },
      { name: { en: 'Engineering unit converter', es: 'Conversor de unidades de ingeniería' }, does: { en: 'Units of length, force, temperature and section properties.', es: 'Unidades de longitud, fuerza, temperatura y propiedades de sección.' } },
      { name: { en: 'Flooring quantity and cost', es: 'Cantidad y costo de piso' }, does: { en: 'Floor area, material with its waste allowance, and what that material costs.', es: 'Área de piso, material con su desperdicio, y lo que cuesta ese material.' } },
      { name: { en: 'Sheet-metal bend K-factor', es: 'Factor K para doblado de lámina' }, does: { en: 'Position of the neutral axis when sheet metal is bent.', es: 'Posición del eje neutro al doblar lámina metálica.' } },
    ],
  },
];

/** How many calculators the catalogue lists. */
export const calculatorCount = calculatorFamilies.reduce((n, g) => n + g.items.length, 0);
