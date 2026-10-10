import type { Lang } from '@/lib/ttc/i18n';
import type { FormIssueCode, MaterialKey, SectionProps, SupportLayout } from './model';
import type { SupportKind } from './solver';

/**
 * Every word of the beam calculator, in English and in Spanish.
 *
 * Its own file, not site.ts: site.ts travels to the browser with every page
 * of the site, and these two hundred strings are for one. The page's text
 * (`page`) is read by the server view; the form's (`ui`) by the client
 * component, which is the only script that carries it.
 *
 * Spanish as an engineer in Florida writes it: "cortante", "momento
 * flector", "deflexión", "apoyo", "rótula", "voladizo"; decimals with a
 * point, as on US drawings.
 */

type Ui = {
  toolbar: { units: string; us: string; si: string; layout: string; layoutPick: string; reset: string; copy: string; copied: string; copyFailed: string; print: string };
  layouts: Record<SupportLayout, string>;
  beam: { title: string; length: string };
  supports: { title: string; kind: string; kinds: Record<SupportKind, string>; position: string; add: string; note: string };
  hinges: { title: string; position: string; add: string; none: string };
  loads: {
    title: string;
    point: string;
    dist: string;
    couple: string;
    load: string;
    at: string;
    from: string;
    to: string;
    start: string;
    end: string;
    moment: string;
    direction: string;
    down: string;
    up: string;
    cw: string;
    ccw: string;
    addPoint: string;
    addDist: string;
    addCouple: string;
    none: string;
    /** "None" for the moments: masculine in Spanish, where the loads are feminine. */
    noneCouple: string;
  };
  section: {
    title: string;
    intro: string;
    mode: string;
    modes: { props: string; rect: string; shape: string };
    material: string;
    materials: Record<MaterialKey, string>;
    E: string;
    I: string;
    S: string;
    Av: string;
    optional: string;
    b: string;
    h: string;
    shape: string;
    filter: string;
    filterHint: string;
    loading: string;
    noMatch: string;
    selfWeight: string;
    computed: string;
  };
  row: { remove: string; limit: string };
  results: {
    title: string;
    schematic: string;
    shear: string;
    moment: string;
    deflection: string;
    reactions: string;
    support: string;
    position: string;
    force: string;
    momentCol: string;
    upward: string;
    downward: string;
    cw: string;
    ccw: string;
    equilibrium: string;
    maxima: string;
    maxShear: string;
    maxSagging: string;
    maxHogging: string;
    maxDeflection: string;
    bendingStress: string;
    shearStress: string;
    at: string;
    none: string;
    spans: string;
    span: string;
    cantilever: string;
    ratio: string;
    ratioNote: string;
    point: string;
    pointHint: string;
    slope: string;
    left: string;
    right: string;
    needEI: string;
    needS: string;
    needAv: string;
    signs: string;
    shearRule: Record<Exclude<SectionProps['shearRule'], 'none'>, string>;
    elastic: string;
    privacy: string;
    waiting: string;
  };
  issues: Record<FormIssueCode, string>;
  issuesTitle: string;
  /** Read out when the results change. */
  solved: string;
  plot: { zero: string; max: string; min: string };
};

type Page = {
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  sub: string;
  facts: { k: string; v: string }[];
  toolHeading: string;
  method: { label: string; title: string; paragraphs: string[] };
  assumes: { title: string; items: string[] };
  limits: { title: string; items: string[] };
  signs: { title: string; items: string[] };
  disclaimer: { title: string; body: string };
  back: string;
  /** Shown in place of the tool where scripts do not run. */
  noscript: string;
};

export const beamStrings: Record<Lang, { ui: Ui; page: Page }> = {
  en: {
    ui: {
      toolbar: {
        units: 'Units',
        us: 'US (ft, kip)',
        si: 'SI (m, kN)',
        layout: 'Support layout',
        layoutPick: 'Choose a layout…',
        reset: 'Start over',
        copy: 'Copy link to this beam',
        copied: 'Link copied',
        copyFailed: 'Copy the address from the browser bar',
        print: 'Print',
      },
      layouts: {
        simple: 'Simply supported',
        cantilever: 'Cantilever',
        propped: 'Propped cantilever',
        fixed: 'Fixed at both ends',
        overhang: 'One overhang',
        'two-span': 'Two spans',
        'three-span': 'Three spans',
      },
      beam: { title: 'Beam', length: 'Length' },
      supports: {
        title: 'Supports',
        kind: 'Type',
        kinds: { pin: 'Pin', roller: 'Roller', fixed: 'Fixed' },
        position: 'Position',
        add: 'Add a support',
        note: 'A pin and a roller act alike here: the beam carries no axial load.',
      },
      hinges: { title: 'Internal hinges', position: 'Position', add: 'Add a hinge', none: 'None.' },
      loads: {
        title: 'Loads',
        point: 'Point loads',
        dist: 'Distributed loads',
        couple: 'Applied moments',
        load: 'Load',
        at: 'At',
        from: 'From',
        to: 'To',
        start: 'At the start',
        end: 'At the end',
        moment: 'Moment',
        direction: 'Direction',
        down: 'Down',
        up: 'Up',
        cw: 'Clockwise',
        ccw: 'Counter-clockwise',
        addPoint: 'Add a point load',
        addDist: 'Add a distributed load',
        addCouple: 'Add a moment',
        none: 'None.',
        noneCouple: 'None.',
      },
      section: {
        title: 'Section and material',
        intro: 'Needed for deflection and stress only. Reactions, shear and moment do not depend on it.',
        mode: 'Section given as',
        modes: { props: 'Properties', rect: 'Rectangle', shape: 'Steel shape' },
        material: 'Material',
        materials: {
          steel: 'Steel',
          aluminum: 'Aluminum',
          concrete: 'Concrete, normalweight',
          wood: 'Wood, Douglas Fir-Larch No. 2',
          custom: 'Other (enter E)',
        },
        E: 'Modulus of elasticity, E',
        I: 'Moment of inertia, I',
        S: 'Section modulus, S',
        Av: 'Shear area',
        optional: 'optional',
        b: 'Width, b',
        h: 'Depth, h',
        shape: 'Shape',
        filter: 'Find a shape',
        filterHint: 'W18, HSS6X4, Pipe5…',
        loading: 'Loading the shape table…',
        noMatch: 'No shape matches.',
        selfWeight: 'Include the beam’s own weight',
        computed: 'From these dimensions',
      },
      row: { remove: 'Remove', limit: 'Twelve at most.' },
      results: {
        title: 'Results',
        schematic: 'Loads and supports',
        shear: 'Shear, V',
        moment: 'Bending moment, M',
        deflection: 'Deflection',
        reactions: 'Reactions',
        support: 'Support',
        position: 'Position',
        force: 'Force',
        momentCol: 'Moment',
        upward: 'upward',
        downward: 'downward',
        cw: 'clockwise',
        ccw: 'counter-clockwise',
        equilibrium: 'The reactions add up to the load:',
        maxima: 'Largest values',
        maxShear: 'Shear',
        maxSagging: 'Sagging moment',
        maxHogging: 'Hogging moment',
        maxDeflection: 'Deflection',
        bendingStress: 'Bending stress',
        shearStress: 'Shear stress',
        at: 'at',
        none: 'none',
        spans: 'Deflection by span',
        span: 'Span',
        cantilever: 'Overhang',
        ratio: 'Length ÷ deflection',
        ratioNote: 'For an overhang the length is taken twice, as building-code deflection limits are written.',
        point: 'Values at a point',
        pointHint: 'Move over a diagram, or type a position.',
        slope: 'Slope',
        left: 'just left',
        right: 'just right',
        needEI: 'Enter E and I to see deflection.',
        needS: 'Enter the section modulus to see bending stress.',
        needAv: 'Enter a shear area to see shear stress.',
        signs: 'Shear is positive when the part of the beam to the left of the cut is pushed up. Moment is positive when the beam sags, with tension at the bottom.',
        shearRule: {
          area: 'Shear divided by the shear area entered.',
          rect: '1.5 × shear ÷ area: the peak of a rectangle’s parabolic distribution.',
          web: 'Shear divided by the web area, d × t_w.',
          hss: 'Shear divided by the area of the two webs, 2 × h × t.',
          round: 'Shear divided by half the area of the section.',
        },
        elastic: 'Elastic stresses from M ÷ S and the shear rule above — not a check of strength.',
        privacy: 'The calculation runs in your browser. Nothing you enter is sent to us.',
        waiting: 'The results appear here once the beam can be solved.',
      },
      issues: {
        length: 'The length of the beam must be a positive number.',
        number: 'A value in this row is not a number.',
        outside: 'This position is off the beam.',
        'no-supports': 'The beam has no supports. Add at least one.',
        'hinge-at-end': 'A hinge at an end of the beam releases nothing. Move it inside the beam.',
        'hinge-at-fixed': 'A hinge cannot sit on a fixed support. Use a pin there instead.',
        'couple-at-hinge': 'A moment cannot be applied exactly at a hinge. Move it to one side.',
        unstable: 'These supports do not hold the beam: it would move as a mechanism. Add a support, fix one, or remove a hinge.',
        section: 'A section value is negative or not a number.',
      },
      issuesTitle: 'This beam cannot be solved yet',
      solved: 'Results updated.',
      plot: { zero: 'zero', max: 'max', min: 'min' },
    },
    page: {
      title: 'Beam Calculator: Reactions, Shear and Moment Diagrams',
      description:
        'Reactions, shear and moment diagrams, deflection and stress for a beam on any supports under point, distributed and moment loads. Runs in your browser.',
      h1: 'Beam reactions and diagrams',
      eyebrow: 'Calculator',
      sub: 'Reactions, shear and moment diagrams, deflection and stress of a beam on any supports, under any set of loads. Determinate or not.',
      facts: [
        { k: 'Supports', v: 'Pin, roller, fixed, hinges' },
        { k: 'Loads', v: 'Point, distributed, moments' },
        { k: 'Units', v: 'US and SI' },
      ],
      toolHeading: 'The beam',
      method: {
        label: 'Method',
        title: 'How the beam is solved',
        paragraphs: [
          'The whole beam is solved as one piece, by the method of initial parameters. The unknowns are the slope and the deflection at the left end, the reaction at each support and the rotation at each hinge; the equations are the support conditions, zero moment at each hinge and the equilibrium of the beam.',
          'Every diagram is then a sum of polynomials, exact at every point. There is no mesh and nothing is interpolated, so a load next to a support, or a short and heavy distributed load, is solved as precisely as any other. A statically indeterminate beam is solved the same way as a determinate one.',
          'Largest values are found where they occur — the moment where the shear crosses zero, the deflection where the slope does — not picked from the nearest plotted point.',
        ],
      },
      assumes: {
        title: 'What it assumes',
        items: [
          'A straight beam with one section along its whole length.',
          'Linear elastic material and small deflections (Euler–Bernoulli bending; shear deformation is not included).',
          'Supports that do not settle or rotate, other than as their type allows.',
          'Vertical loads and moments only: no axial force, which is why a pin and a roller give the same answer.',
        ],
      },
      limits: {
        title: 'What it does not do',
        items: [
          'It does not check strength, lateral-torsional buckling, web crippling or any other limit state of a design code.',
          'It does not combine or factor loads: enter the loads of the combination you are checking.',
          'It does not compare deflection with a limit. It gives the length-to-deflection ratio of each span for you to compare.',
          'For concrete, the deflection is that of the uncracked section entered: cracking and creep are not modelled.',
        ],
      },
      signs: {
        title: 'Signs and units',
        items: [
          'Loads are entered as magnitudes with a direction; a downward load is gravity.',
          'Shear is positive when the part of the beam to the left of the cut is pushed up.',
          'Moment is positive when the beam sags (tension at the bottom) and is drawn above the axis.',
          'Deflection is drawn the way the beam moves: down is down.',
        ],
      },
      disclaimer: {
        title: 'Use it as an engineer would',
        body: 'This calculator is an aid for people qualified to judge its results. It is not an engineering opinion on any structure, and it comes with no warranty. Check the results independently before relying on them in a design.',
      },
      back: 'All calculators',
      noscript: 'This calculator needs JavaScript: it computes in your browser, and sends nothing to a server.',
    },
  },
  es: {
    ui: {
      toolbar: {
        units: 'Unidades',
        us: 'EE. UU. (ft, kip)',
        si: 'SI (m, kN)',
        layout: 'Disposición de apoyos',
        layoutPick: 'Elija una disposición…',
        reset: 'Empezar de nuevo',
        copy: 'Copiar enlace a esta viga',
        copied: 'Enlace copiado',
        copyFailed: 'Copie la dirección de la barra del navegador',
        print: 'Imprimir',
      },
      layouts: {
        simple: 'Simplemente apoyada',
        cantilever: 'En voladizo',
        propped: 'Empotrada y apoyada',
        fixed: 'Empotrada en ambos extremos',
        overhang: 'Con un voladizo',
        'two-span': 'Dos vanos',
        'three-span': 'Tres vanos',
      },
      beam: { title: 'Viga', length: 'Longitud' },
      supports: {
        title: 'Apoyos',
        kind: 'Tipo',
        kinds: { pin: 'Articulado', roller: 'Rodillo', fixed: 'Empotrado' },
        position: 'Posición',
        add: 'Añadir un apoyo',
        note: 'Un apoyo articulado y un rodillo actúan igual aquí: la viga no lleva carga axial.',
      },
      hinges: { title: 'Rótulas internas', position: 'Posición', add: 'Añadir una rótula', none: 'Ninguna.' },
      loads: {
        title: 'Cargas',
        point: 'Cargas puntuales',
        dist: 'Cargas distribuidas',
        couple: 'Momentos aplicados',
        load: 'Carga',
        at: 'En',
        from: 'Desde',
        to: 'Hasta',
        start: 'Al inicio',
        end: 'Al final',
        moment: 'Momento',
        direction: 'Sentido',
        down: 'Hacia abajo',
        up: 'Hacia arriba',
        cw: 'Horario',
        ccw: 'Antihorario',
        addPoint: 'Añadir una carga puntual',
        addDist: 'Añadir una carga distribuida',
        addCouple: 'Añadir un momento',
        none: 'Ninguna.',
        noneCouple: 'Ninguno.',
      },
      section: {
        title: 'Sección y material',
        intro: 'Solo hace falta para la deflexión y los esfuerzos. Las reacciones, el cortante y el momento no dependen de ella.',
        mode: 'Sección dada por',
        modes: { props: 'Propiedades', rect: 'Rectángulo', shape: 'Perfil de acero' },
        material: 'Material',
        materials: {
          steel: 'Acero',
          aluminum: 'Aluminio',
          concrete: 'Concreto de peso normal',
          wood: 'Madera, Douglas Fir-Larch n.º 2',
          custom: 'Otro (introduzca E)',
        },
        E: 'Módulo de elasticidad, E',
        I: 'Momento de inercia, I',
        S: 'Módulo de sección, S',
        Av: 'Área de cortante',
        optional: 'opcional',
        b: 'Ancho, b',
        h: 'Altura, h',
        shape: 'Perfil',
        filter: 'Buscar un perfil',
        filterHint: 'W18, HSS6X4, Pipe5…',
        loading: 'Cargando la tabla de perfiles…',
        noMatch: 'Ningún perfil coincide.',
        selfWeight: 'Incluir el peso propio de la viga',
        computed: 'Con estas dimensiones',
      },
      row: { remove: 'Quitar', limit: 'Doce como máximo.' },
      results: {
        title: 'Resultados',
        schematic: 'Cargas y apoyos',
        shear: 'Cortante, V',
        moment: 'Momento flector, M',
        deflection: 'Deflexión',
        reactions: 'Reacciones',
        support: 'Apoyo',
        position: 'Posición',
        force: 'Fuerza',
        momentCol: 'Momento',
        upward: 'hacia arriba',
        downward: 'hacia abajo',
        cw: 'horario',
        ccw: 'antihorario',
        equilibrium: 'Las reacciones suman la carga:',
        maxima: 'Valores máximos',
        maxShear: 'Cortante',
        maxSagging: 'Momento positivo',
        maxHogging: 'Momento negativo',
        maxDeflection: 'Deflexión',
        bendingStress: 'Esfuerzo de flexión',
        shearStress: 'Esfuerzo cortante',
        at: 'en',
        none: 'ninguno',
        spans: 'Deflexión por vano',
        span: 'Vano',
        cantilever: 'Voladizo',
        ratio: 'Longitud ÷ deflexión',
        ratioNote: 'En un voladizo la longitud se toma dos veces, como están escritos los límites de deflexión de los códigos de construcción.',
        point: 'Valores en un punto',
        pointHint: 'Pase sobre un diagrama o escriba una posición.',
        slope: 'Giro',
        left: 'justo a la izquierda',
        right: 'justo a la derecha',
        needEI: 'Introduzca E e I para ver la deflexión.',
        needS: 'Introduzca el módulo de sección para ver el esfuerzo de flexión.',
        needAv: 'Introduzca un área de cortante para ver el esfuerzo cortante.',
        signs: 'El cortante es positivo cuando la parte de la viga a la izquierda del corte es empujada hacia arriba. El momento es positivo cuando la viga se comba hacia abajo, con tensión en la fibra inferior.',
        shearRule: {
          area: 'Cortante dividido entre el área de cortante introducida.',
          rect: '1.5 × cortante ÷ área: el máximo de la distribución parabólica de un rectángulo.',
          web: 'Cortante dividido entre el área del alma, d × t_w.',
          hss: 'Cortante dividido entre el área de las dos almas, 2 × h × t.',
          round: 'Cortante dividido entre la mitad del área de la sección.',
        },
        elastic: 'Esfuerzos elásticos con M ÷ S y la regla de cortante anterior; no es una comprobación de resistencia.',
        privacy: 'El cálculo se hace en su navegador. Nada de lo que introduce se nos envía.',
        waiting: 'Los resultados aparecen aquí cuando la viga se puede resolver.',
      },
      issues: {
        length: 'La longitud de la viga debe ser un número positivo.',
        number: 'Un valor de esta fila no es un número.',
        outside: 'Esta posición queda fuera de la viga.',
        'no-supports': 'La viga no tiene apoyos. Añada al menos uno.',
        'hinge-at-end': 'Una rótula en un extremo de la viga no libera nada. Colóquela dentro de la viga.',
        'hinge-at-fixed': 'Una rótula no puede estar sobre un empotramiento. Use ahí un apoyo articulado.',
        'couple-at-hinge': 'No se puede aplicar un momento exactamente en una rótula. Muévalo a un lado.',
        unstable: 'Estos apoyos no sostienen la viga: se movería como un mecanismo. Añada un apoyo, empotre uno o quite una rótula.',
        section: 'Un valor de la sección es negativo o no es un número.',
      },
      issuesTitle: 'Esta viga todavía no se puede resolver',
      solved: 'Resultados actualizados.',
      plot: { zero: 'cero', max: 'máx.', min: 'mín.' },
    },
    page: {
      title: 'Calculadora de vigas: reacciones, cortante y momento',
      description:
        'Reacciones, diagramas de cortante y momento, deflexión y esfuerzos de una viga con cualquier apoyo y cualquier carga. Se calcula en su navegador.',
      h1: 'Reacciones y diagramas de vigas',
      eyebrow: 'Calculadora',
      sub: 'Reacciones, diagramas de cortante y de momento, deflexión y esfuerzos de una viga con cualquier disposición de apoyos y cualquier combinación de cargas. Isostática o hiperestática.',
      facts: [
        { k: 'Apoyos', v: 'Articulado, rodillo, empotrado, rótulas' },
        { k: 'Cargas', v: 'Puntuales, distribuidas, momentos' },
        { k: 'Unidades', v: 'EE. UU. y SI' },
      ],
      toolHeading: 'La viga',
      method: {
        label: 'Método',
        title: 'Cómo se resuelve la viga',
        paragraphs: [
          'La viga se resuelve entera, de una sola vez, por el método de los parámetros iniciales. Las incógnitas son el giro y la deflexión en el extremo izquierdo, la reacción de cada apoyo y el giro en cada rótula; las ecuaciones son las condiciones de los apoyos, momento nulo en cada rótula y el equilibrio de la viga.',
          'Cada diagrama es entonces una suma de polinomios, exacta en cualquier punto. No hay malla ni se interpola nada, de modo que una carga junto a un apoyo, o una carga distribuida corta y pesada, se resuelve con la misma precisión que cualquier otra. Las vigas hiperestáticas se resuelven igual que las isostáticas.',
          'Los valores máximos se buscan donde ocurren — el momento donde el cortante cruza por cero, la deflexión donde lo hace el giro — y no se toman del punto dibujado más cercano.',
        ],
      },
      assumes: {
        title: 'Qué supone',
        items: [
          'Una viga recta con una misma sección en toda su longitud.',
          'Material elástico lineal y deflexiones pequeñas (flexión de Euler–Bernoulli; no se incluye la deformación por cortante).',
          'Apoyos que no se asientan ni giran más de lo que su tipo permite.',
          'Solo cargas verticales y momentos: sin fuerza axial, y por eso un apoyo articulado y un rodillo dan el mismo resultado.',
        ],
      },
      limits: {
        title: 'Qué no hace',
        items: [
          'No comprueba la resistencia, el pandeo lateral-torsional, el aplastamiento del alma ni ningún otro estado límite de una norma de diseño.',
          'No combina ni mayora cargas: introduzca las cargas de la combinación que esté comprobando.',
          'No compara la deflexión con un límite. Da la relación entre longitud y deflexión de cada vano para que usted la compare.',
          'En concreto, la deflexión es la de la sección sin fisurar que se introduce: no se modelan la fisuración ni la fluencia lenta.',
        ],
      },
      signs: {
        title: 'Signos y unidades',
        items: [
          'Las cargas se introducen como magnitudes con un sentido; una carga hacia abajo es la gravedad.',
          'El cortante es positivo cuando la parte de la viga a la izquierda del corte es empujada hacia arriba.',
          'El momento es positivo cuando la viga se comba hacia abajo (tensión en la fibra inferior) y se dibuja sobre el eje.',
          'La deflexión se dibuja como se mueve la viga: hacia abajo es hacia abajo.',
        ],
      },
      disclaimer: {
        title: 'Úsela como la usaría un ingeniero',
        body: 'Esta calculadora es una ayuda para quien está capacitado para juzgar sus resultados. No es una opinión de ingeniería sobre ninguna estructura y se ofrece sin garantía. Compruebe los resultados de forma independiente antes de apoyarse en ellos para un diseño.',
      },
      back: 'Todas las calculadoras',
      noscript: 'Esta calculadora necesita JavaScript: calcula en su navegador y no envía nada a un servidor.',
    },
  },
};

export type BeamUi = Ui;
export type BeamPage = Page;
