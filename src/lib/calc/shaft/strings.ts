import type { Lang } from '@/lib/ttc/i18n';
import type { BeamUi } from '../beam/strings';
import type { ShaftAnalysisIssueCode } from './analysis';
import type { ShaftView } from './model';

/**
 * The words of the shaft calculator's FORM AND TABLES, in English and in
 * Spanish (/resources/shaft-on-bearings; the page's own text — its hero, its
 * notes — is page-strings.ts).
 *
 * The tool (ShaftCalculator.tsx) takes two sets of words. `t`, a part of
 * the first calculator's (beam/strings.ts, `ui`): what one calculator says
 * as the next does — how a number is written, the row of actions, "Remove",
 * "Position", "Largest values", "Values at a point", the directions. And
 * `w`, this file: everything that is about a shaft. A phrase the first
 * calculator already has is taken from `t`, never written again here: each
 * text of the site has one home (shaft-calculator.test.ts compares this file
 * with the other calculators' words, six words at a time).
 *
 * NOT EVERY WORD OF THE FIRST CALCULATOR IS THIS PAGE'S TO BORROW. Its
 * sentences say "beam" — the line for a link that cannot be read, the one
 * under the diagrams, "Copy link to this beam", "US (ft, kip)" — and a
 * shaft's page says "shaft", in inches and pounds: those are written here,
 * in other words. `ShaftShared` is the list of what IS borrowed, and
 * `sharedWords` picks exactly that out of the first calculator's set, so
 * that the server view can hand the tool those words and no others.
 *
 * Like every calculator's words they travel to the browser as a prop: the
 * server view picks the language, and the calculator's script carries
 * neither this file nor the other language.
 *
 * NO VERDICT, NO CODE. The page gives reactions, moments, slopes,
 * deflections and a nominal stress under the loads as entered. No word here
 * says whether a value will do, none names a standard, and no limit is
 * quoted as a rule.
 *
 * THE VIEWER. The horizontal plane needs a word for its two directions, and
 * "left" and "right" are taken by the shaft's ends. A viewer stands beside
 * the shaft with its left end on the left (types.ts): a horizontal force
 * points TOWARDS the viewer or AWAY. In the drawing of that plane the shaft
 * is seen from above with the viewer at the foot of the drawing, so
 * "towards the viewer" is down the page — and the page says so by the
 * drawing, which cannot.
 *
 * Spanish as the other calculators write it — "deflexión", "giro",
 * "cortante", "momento flector", "esfuerzo", formal "usted" — and for what
 * is a shaft's: "eje"; "cojinete", as the catalogue names this calculator
 * (never "rodamiento" beside it); "tramo" for a segment between two steps;
 * "diámetro interior" for a bore; "hombro" and "chavetero"; "carga radial";
 * "plano vertical" and "plano horizontal"; "hacia el observador" and "hacia
 * el fondo" for the two ways of a horizontal force. A couple is a "momento
 * aplicado", as on the first calculator: "par" is the torque on a shaft to
 * a Spanish reader, and torque is no load of this page.
 */

/**
 * What this tool borrows of the first calculator's words: the pieces that
 * say the same thing on any calculator. Its shape is `BeamUi`'s, so the
 * whole of that set can be handed in where this is asked for.
 */
export type ShaftShared = {
  numbers: BeamUi['numbers'];
  sheet: Pick<BeamUi['sheet'], 'locale' | 'printed'>;
  toolbar: Pick<BeamUi['toolbar'], 'units' | 'reset' | 'copied' | 'copyFailed' | 'print'>;
  beam: Pick<BeamUi['beam'], 'length'>;
  loads: Pick<BeamUi['loads'], 'couple' | 'moment' | 'at' | 'direction' | 'down' | 'up' | 'cw' | 'ccw' | 'addCouple' | 'none' | 'noneCouple'>;
  section: Pick<BeamUi['section'], 'material' | 'E' | 'I'> & { materials: Pick<BeamUi['section']['materials'], 'steel' | 'aluminum' | 'custom'> };
  row: Pick<BeamUi['row'], 'remove' | 'limit'> & { names: Pick<BeamUi['row']['names'], 'couples'> };
  results: Pick<
    BeamUi['results'],
    'title' | 'shear' | 'moment' | 'deflection' | 'position' | 'upward' | 'downward' | 'unbalanced' | 'maxima' | 'at' | 'point' | 'pointHint' | 'slope' | 'left' | 'right' | 'ownWeight' | 'privacy'
  >;
  issues: Pick<BeamUi['issues'], 'number'>;
  plot: BeamUi['plot'];
};

/** Exactly those words, out of the first calculator's set: what the server view hands the tool as `t`. */
export function sharedWords(ui: BeamUi): ShaftShared {
  const { numbers, plot } = ui;
  const { locale, printed } = ui.sheet;
  const { units, reset, copied, copyFailed, print } = ui.toolbar;
  const { couple, moment, at, direction, down, up, cw, ccw, addCouple, none, noneCouple } = ui.loads;
  const { material, E, I, materials } = ui.section;
  const r = ui.results;
  return {
    numbers,
    sheet: { locale, printed },
    toolbar: { units, reset, copied, copyFailed, print },
    beam: { length: ui.beam.length },
    loads: { couple, moment, at, direction, down, up, cw, ccw, addCouple, none, noneCouple },
    section: { material, E, I, materials: { steel: materials.steel, aluminum: materials.aluminum, custom: materials.custom } },
    row: { remove: ui.row.remove, limit: ui.row.limit, names: { couples: ui.row.names.couples } },
    results: {
      title: r.title,
      shear: r.shear,
      moment: r.moment,
      deflection: r.deflection,
      position: r.position,
      upward: r.upward,
      downward: r.downward,
      unbalanced: r.unbalanced,
      maxima: r.maxima,
      at: r.at,
      point: r.point,
      pointHint: r.pointHint,
      slope: r.slope,
      left: r.left,
      right: r.right,
      ownWeight: r.ownWeight,
      privacy: r.privacy,
    },
    issues: { number: ui.issues.number },
    plot,
  };
}

export type ShaftUi = {
  /** The printed sheet's second line: {url} is the address that opens this very shaft. */
  sheet: { link: string };
  /** The two unit systems as this page has them, and the button that copies the link. */
  toolbar: { us: string; si: string; copy: string };
  /**
   * The segments. `segment` names one ("Segment 2"); `total` is the line
   * under them, with {length}: the shaft's length and its unit; `note` says
   * where a segment starts, what an empty bore means and that no position
   * follows a segment that changes.
   */
  shaft: { title: string; segment: string; diameter: string; bore: string; add: string; limit: string; total: string; note: string };
  /** The two bearings: `name` names one ("Bearing 1"); `note` says what a bearing is to this calculation. */
  bearings: { title: string; name: string; note: string };
  /** A force: its two components, and the two ways the horizontal one points. `note` says where the viewer stands. */
  forces: { title: string; name: string; vertical: string; horizontal: string; towards: string; away: string; add: string; note: string };
  /** The applied moments: what one is on a shaft, and how its sense is read in each plane. */
  couples: { note: string };
  /** The three views, as the switch names them and as a head of a table does. */
  planes: Record<ShaftView, string>;
  /**
   * The material. `weight` is the line under the density when the shaft's
   * own weight is a load, with {weight}: the whole of it and its unit.
   */
  material: { title: string; stainless: string; density: string; ownWeight: string; weight: string; note: string };
  /** The switch of views, over the drawings. */
  view: { title: string };
  results: {
    /** The drawing's title, and after it how the view shown is seen. */
    schematic: string;
    seen: Record<ShaftView, string>;
    /** Under the three diagrams: what is positive in the view shown — or, with both planes together, that every value is a size. */
    signs: Record<ShaftView, string>;
    /**
     * The three diagrams' titles when the view is both planes. Each is then
     * the resultant of the two planes' values — a size, never under its axis —
     * and the title is where a diagram is read: under the plain "Deflection" a
     * shaft pushed down is drawn humped upward. (In one plane the titles are
     * the first calculator's, from `t`.)
     */
    resultant: { shear: string; moment: string; deflection: string };
    /** Heads of the "Bearings" card, and the two ways of a horizontal value. */
    reactionV: string;
    reactionH: string;
    radial: string;
    towards: string;
    away: string;
    /**
     * Under that card: {vertical} and {horizontal} are each plane's FORCES added up - those entered and, in the
     * vertical plane, the shaft's weight when it is a load - a size, its unit and the way it points. "Forces", not
     * "loads": an applied moment is a load and adds nothing to them (its two reactions are a pair), so a shaft
     * under applied moments alone has "0 lbf" here, under two reactions that are not zero.
     */
    balance: string;
    /** The "Segment by segment" card, its heads, and the note that says what a nominal stress is. */
    bySegment: string;
    modulus: string;
    weight: string;
    largestMoment: string;
    stress: string;
    nominal: string;
    /** The "At each force" card and its two heads by plane. */
    atForces: string;
    deflectionV: string;
    deflectionH: string;
    /** Under "Largest values": each is of the two planes together. */
    sizes: string;
    /** In place of the diagrams while the shaft cannot be solved. */
    waiting: string;
  };
  /**
   * The faults. {max} in `stiffness` is how many times stiffer than the most
   * flexible segment the stiffest may be. `stopped` is not a fault of the
   * shaft: the arithmetic itself failed on it (analysis.ts, `analyseSafely`),
   * and the line says no more than is known. ('number' is the first
   * calculator's line, from `t`.)
   */
  issues: Record<Exclude<ShaftAnalysisIssueCode, 'number'>, string>;
  issuesTitle: string;
  /** A shaft was in the address and could not be read. */
  linkError: string;
  /**
   * A shaft is in the address and the script has not opened it yet: shown in
   * place of the tool until it has (calc/ToolFrame.tsx). True for as long as
   * it shows — also if the script never arrives.
   */
  linkOpening: string;
};

export const shaftUi: Record<Lang, ShaftUi> = {
  en: {
    sheet: { link: 'To open this shaft again: {url}' },
    toolbar: { us: 'US (in, lbf)', si: 'SI (mm, N)', copy: 'Copy link to this shaft' },
    shaft: {
      title: 'Shaft',
      segment: 'Segment',
      diameter: 'Diameter',
      bore: 'Bore',
      add: 'Add a segment',
      limit: 'Eight at most.',
      total: 'Length of the shaft: {length}',
      note: 'Segments follow one another from the left end. A bore left empty is a solid segment. Every position below is a distance from that left end, and stays as typed when a segment changes.',
    },
    bearings: {
      title: 'Bearings',
      name: 'Bearing',
      note: 'Each bearing is taken as a simple support: it carries a radial load and no moment, so the shaft can tilt in it.',
    },
    forces: {
      title: 'Forces',
      name: 'Force',
      vertical: 'Vertical',
      horizontal: 'Horizontal',
      towards: 'Towards viewer',
      away: 'Away from viewer',
      add: 'Add a force',
      note: 'A force is entered by its two components. The viewer stands beside the shaft, with its left end on the left.',
    },
    couples: {
      note: 'An applied moment bends the shaft: an axial force on a gear, acting at its radius, makes one. Each sense is as its plane is drawn — the vertical plane from the side, the horizontal plane from above. Torque about the shaft’s axis is not entered.',
    },
    planes: { vertical: 'Vertical plane', horizontal: 'Horizontal plane', both: 'Both planes' },
    material: {
      title: 'Material and own weight',
      stainless: 'Stainless steel',
      density: 'Density',
      ownWeight: 'Include the shaft’s own weight',
      weight: 'The shaft weighs {weight}: a load spread along it, in the vertical plane.',
      note: 'The modulus sets the slopes and the deflections, and nothing else: reactions, shears and moments do not depend on it.',
    },
    view: { title: 'View' },
    results: {
      schematic: 'Shaft, bearings and loads',
      seen: {
        vertical: 'seen from the side',
        horizontal: 'seen from above: down the page is towards the viewer',
        both: 'the two planes’ loads as one size each, with no direction',
      },
      signs: {
        vertical: 'Vertical plane: a positive shear pushes the part left of the cut upward, a positive moment sags the shaft, and a positive deflection is upward.',
        horizontal: 'Horizontal plane: a positive shear pushes the part left of the cut away from the viewer, a positive moment bows the shaft towards the viewer, and a positive deflection is away from the viewer.',
        both: 'Both planes: each diagram is the size of the two planes’ values at that point, √(vertical² + horizontal²). A size is never negative.',
      },
      resultant: { shear: 'Resultant shear', moment: 'Resultant bending moment', deflection: 'Resultant deflection' },
      reactionV: 'Vertical reaction',
      reactionH: 'Horizontal reaction',
      radial: 'Radial load',
      towards: 'towards viewer',
      away: 'away from viewer',
      balance: 'The reactions balance the forces in each plane: {vertical} in the vertical one, {horizontal} in the horizontal one.',
      bySegment: 'Segment by segment',
      modulus: 'Section modulus, Z',
      weight: 'Weight per length',
      largestMoment: 'Largest bending moment',
      stress: 'Nominal bending stress',
      nominal: 'Nominal stress: a segment’s largest moment over that segment’s own section modulus, Z. It holds no stress raiser — not a shoulder’s fillet, a groove or a keyway.',
      atForces: 'At each force',
      deflectionV: 'Vertical deflection',
      deflectionH: 'Horizontal deflection',
      sizes: 'Each is the size of the two planes together.',
      waiting: 'Once the shaft can be solved, its results are shown here.',
    },
    issues: {
      'no-segments': 'The shaft has no segment.',
      length: 'The length of this segment must be a positive number.',
      diameter: 'The diameter must be a positive number.',
      bore: 'The bore must be smaller than the diameter, and not negative.',
      stiffness: 'The stiffest segment is over {max} times as stiff as the most flexible one — for solid segments, about 32 diameters to 1. A shaft like that is not solved.',
      outside: 'This position is off the shaft.',
      bearings: 'The two bearings are at one place, or less than one thousandth of the shaft’s length apart: the shaft is not solved on two that close. Move one of them.',
      'short-segment': 'This segment is shorter than a millionth of the shaft: the shaft is not solved with one that short. Remove it, or make it longer.',
      modulus: 'The modulus of elasticity must be a positive number.',
      density: 'With the shaft’s own weight included, the density must be a positive number.',
      size: 'The calculation does not take a number this large or this small.',
      stopped: 'The calculation broke off on this shaft and has nothing to show. The fault is this calculator’s, not the shaft’s.',
    },
    issuesTitle: 'This shaft cannot be solved yet',
    linkError: 'This link’s shaft could not be read: what is shown is the example, not the shaft that was sent.',
    linkOpening: 'A shaft came with this link. The page opens it when its script has loaded; meanwhile the tool is kept out of sight, because the example in it is another shaft.',
  },
  es: {
    sheet: { link: 'Para abrir este eje de nuevo: {url}' },
    toolbar: { us: 'EE. UU. (in, lbf)', si: 'SI (mm, N)', copy: 'Copiar enlace a este eje' },
    shaft: {
      title: 'Eje',
      segment: 'Tramo',
      diameter: 'Diámetro',
      bore: 'Diámetro interior',
      add: 'Añadir un tramo',
      limit: 'Ocho como máximo.',
      total: 'Longitud del eje: {length}',
      note: 'Los tramos van uno tras otro desde el extremo izquierdo. Si el diámetro interior se deja vacío, el tramo es macizo. Toda posición de más abajo es una distancia a ese extremo izquierdo, y queda como se escribió cuando un tramo cambia.',
    },
    bearings: {
      title: 'Cojinetes',
      name: 'Cojinete',
      note: 'Cada cojinete se toma como un apoyo simple: soporta carga radial y ningún momento, de modo que el eje puede inclinarse en él.',
    },
    forces: {
      title: 'Fuerzas',
      name: 'Fuerza',
      vertical: 'Vertical',
      horizontal: 'Horizontal',
      towards: 'Hacia el observador',
      away: 'Hacia el fondo',
      add: 'Añadir una fuerza',
      note: 'Una fuerza se introduce por sus dos componentes. El observador está junto al eje, con el extremo izquierdo de este a su izquierda; «hacia el fondo» es alejándose de él.',
    },
    couples: {
      note: 'Un momento aplicado flexiona el eje: lo produce la fuerza axial de un engranaje, que actúa en su radio. Cada sentido es el del dibujo de su plano: el vertical, visto de lado; el horizontal, desde arriba. El par de torsión en torno al eje no se introduce.',
    },
    planes: { vertical: 'Plano vertical', horizontal: 'Plano horizontal', both: 'Ambos planos' },
    material: {
      title: 'Material y peso propio',
      stainless: 'Acero inoxidable',
      density: 'Densidad',
      ownWeight: 'Incluir el peso propio del eje',
      weight: 'El eje pesa {weight}: una carga repartida a lo largo de él, en el plano vertical.',
      note: 'El módulo determina los giros y las deflexiones, y nada más: las reacciones, los cortantes y los momentos no dependen de él.',
    },
    view: { title: 'Vista' },
    results: {
      schematic: 'Eje, cojinetes y cargas',
      seen: {
        vertical: 'visto de lado',
        horizontal: 'visto desde arriba: hacia abajo en el dibujo es hacia el observador',
        both: 'las cargas de los dos planos como una sola magnitud cada una, sin dirección',
      },
      signs: {
        vertical: 'Plano vertical: un cortante positivo empuja hacia arriba la parte a la izquierda del corte, un momento positivo comba el eje hacia abajo y una deflexión positiva es hacia arriba.',
        horizontal: 'Plano horizontal: un cortante positivo empuja hacia el fondo la parte a la izquierda del corte, un momento positivo comba el eje hacia el observador y una deflexión positiva es hacia el fondo.',
        both: 'Ambos planos: cada diagrama es la magnitud de los valores de los dos planos en ese punto, √(vertical² + horizontal²). Una magnitud nunca es negativa.',
      },
      resultant: { shear: 'Cortante resultante', moment: 'Momento flector resultante', deflection: 'Deflexión resultante' },
      reactionV: 'Reacción vertical',
      reactionH: 'Reacción horizontal',
      radial: 'Carga radial',
      towards: 'hacia el observador',
      away: 'hacia el fondo',
      balance: 'Las reacciones equilibran las fuerzas en cada plano: {vertical} en el vertical y {horizontal} en el horizontal.',
      bySegment: 'Tramo por tramo',
      modulus: 'Módulo de sección, Z',
      weight: 'Peso por unidad de longitud',
      largestMoment: 'Momento flector máximo',
      stress: 'Esfuerzo nominal de flexión',
      nominal: 'Esfuerzo nominal: el mayor momento de un tramo entre el módulo de sección, Z, de ese mismo tramo. No incluye ningún concentrador de esfuerzos: ni el radio de acuerdo de un hombro, ni una ranura, ni un chavetero.',
      atForces: 'En cada fuerza',
      deflectionV: 'Deflexión vertical',
      deflectionH: 'Deflexión horizontal',
      sizes: 'Cada uno es la magnitud de los dos planos juntos.',
      waiting: 'Cuando el eje se pueda resolver, sus resultados aparecerán aquí.',
    },
    issues: {
      'no-segments': 'El eje no tiene ningún tramo.',
      length: 'La longitud de este tramo debe ser un número positivo.',
      diameter: 'El diámetro debe ser un número positivo.',
      bore: 'El diámetro interior debe ser menor que el diámetro, y no negativo.',
      stiffness: 'El tramo más rígido es más de {max} veces más rígido que el más flexible: en tramos macizos, unos 32 diámetros a 1. Un eje así no se resuelve.',
      outside: 'Esta posición queda fuera del eje.',
      bearings: 'Los dos cojinetes están en el mismo sitio, o separados menos de la milésima parte de la longitud del eje: con dos tan juntos el eje no se resuelve. Mueva uno de ellos.',
      'short-segment': 'Este tramo es más corto que una millonésima del eje: con uno tan corto el eje no se resuelve. Quítelo o hágalo más largo.',
      modulus: 'El módulo de elasticidad debe ser un número positivo.',
      density: 'Si se incluye el peso propio del eje, la densidad debe ser un número positivo.',
      size: 'El cálculo no admite un número tan grande o tan pequeño.',
      stopped: 'El cálculo se interrumpió con este eje y no hay nada que mostrar. El fallo es de esta calculadora, no del eje.',
    },
    issuesTitle: 'Este eje todavía no se puede resolver',
    linkError: 'El eje de este enlace no se ha podido leer: lo que se muestra es el ejemplo, no el eje que se envió.',
    linkOpening: 'Este enlace trae un eje. La página lo abre cuando su script termina de cargar; mientras tanto la herramienta no se muestra, porque el ejemplo que contiene es otro eje.',
  },
};
