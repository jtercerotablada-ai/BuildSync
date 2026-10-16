import type { Lang } from '@/lib/ttc/i18n';
import type { BeamUi } from '../beam/strings';
import type { AnalysisIssueCode } from './analysis';
import type { TrussList } from './model';
import type { Clamp, SupportLayout, TemplateId } from './templates';
import type { TrussWarningCode, ZeroRule } from './types';

/**
 * The words of the truss calculator's FORM AND TABLES, in English and in
 * Spanish (/resources/truss; the page's own text — its hero, its notes — is
 * page-strings.ts).
 *
 * The tool (TrussCalculator.tsx) takes two sets of words. `t`, a part of the
 * first calculator's (beam/strings.ts, `ui`): what one calculator says as the
 * next does — how a number is written, the row of actions, "Remove", "Results",
 * "Supports", "Loads". And `w`, this file: everything that is about a truss. A
 * phrase the first calculator already has is taken from `t`, never written
 * again here (truss-calculator.test.ts compares this file with the other
 * calculators' words, six words at a time).
 *
 * NOT EVERY WORD OF THE FIRST CALCULATOR IS THIS PAGE'S TO BORROW. Its
 * sentences say "beam" — the line for a link that cannot be read, the one under
 * the diagrams, "Copy link to this beam", "US (ft, kip)" — and a truss's page
 * says "truss". `TrussShared` is the list of what IS borrowed, and
 * `sharedWords` picks exactly that out of the first calculator's set, so that
 * the server view hands the tool those words and no others (what a server view
 * hands a client component travels with the page).
 *
 * NO WORDS IN THE LIBRARY. analysis.ts gives CODES (a problem, a state, a
 * rule, a word for the count) and the numbers a sentence needs; the sentence is
 * written here, once per code, in both languages. A sentence with a number in
 * it has a hole for it: `{count}`. A hole can carry a plural:
 * `{count|motion|motions}` is the first word when the count is 1 and the
 * second otherwise. (text.ts fills them.)
 *
 * NO VERDICT, NO CODE. The page gives forces, reactions, displacements and —
 * where an area is given — N ÷ A. No word here says whether a member will do,
 * none names a standard, none speaks of a factor or a capacity.
 *
 * Spanish as the other calculators write it — formal "usted", "esfuerzo",
 * "deflexión" — and for what is a truss's: "cercha" (never "armadura" beside
 * it), "barra" for a member, "nudo" for a node, "apoyo articulado" and "apoyo
 * de rodillo", "tensión" and "compresión" for the two signs of an axial force,
 * "reacción", "luz" for the span and "altura" for the depth, "panel" for the
 * bay between two verticals.
 */

/** What this tool borrows of the first calculator's words: the pieces that say the same thing on any calculator. Its shape is `BeamUi`'s, so the whole of that set can be handed in where this is asked for. */
export type TrussShared = {
  numbers: BeamUi['numbers'];
  sheet: Pick<BeamUi['sheet'], 'locale' | 'printed'>;
  toolbar: Pick<BeamUi['toolbar'], 'units' | 'reset' | 'copied' | 'copyFailed' | 'print'>;
  beam: Pick<BeamUi['beam'], 'length'>;
  supports: Pick<BeamUi['supports'], 'title'>;
  loads: Pick<BeamUi['loads'], 'title' | 'none'>;
  section: Pick<BeamUi['section'], 'title' | 'material' | 'E' | 'optional'> & { materials: Pick<BeamUi['section']['materials'], 'steel' | 'aluminum' | 'custom'> };
  row: Pick<BeamUi['row'], 'remove'>;
  results: Pick<BeamUi['results'], 'title' | 'reactions' | 'support' | 'privacy' | 'upward' | 'downward'>;
};
/** The name the page's view and the tool's props know it by. */
export type SharedWords = TrussShared;

/** Exactly those words, out of the first calculator's set: what the server view hands the tool as `t`. */
export function sharedWords(ui: BeamUi): TrussShared {
  const { numbers } = ui;
  const { locale, printed } = ui.sheet;
  const { units, reset, copied, copyFailed, print } = ui.toolbar;
  const { title, material, E, optional, materials } = ui.section;
  const r = ui.results;
  return {
    numbers,
    sheet: { locale, printed },
    toolbar: { units, reset, copied, copyFailed, print },
    beam: { length: ui.beam.length },
    supports: { title: ui.supports.title },
    loads: { title: ui.loads.title, none: ui.loads.none },
    section: { title, material, E, optional, materials: { steel: materials.steel, aluminum: materials.aluminum, custom: materials.custom } },
    row: { remove: ui.row.remove },
    results: { title: r.title, reactions: r.reactions, support: r.support, privacy: r.privacy, upward: r.upward, downward: r.downward },
  };
}

export type TrussUi = {
  /** The printed sheet's second line: {url} is the address that opens this very truss. */
  sheet: { link: string };
  /** The two unit systems as this page has them, and the button that copies the link. */
  toolbar: { us: string; si: string; copy: string };

  /**
   * The template group. `done` is said after "Load template" with {template}, {nodes}, {members},
   * {supports} and {loads}; `clamped` has a sentence for each thing a template had to change in what it was
   * asked for, with {asked}, {used} and {unit}.
   */
  template: {
    title: string;
    pick: string;
    names: Record<TemplateId, string>;
    span: string;
    depth: string;
    panels: string;
    load: string;
    layout: string;
    layouts: Record<SupportLayout, string>;
    fixed: string;
    note: string;
    apply: string;
    done: string;
    clamped: Record<Clamp['field'], string>;
  };

  /** The four lists. `name` names one row ("Node 2"); `note` says what the list means. */
  nodes: { title: string; name: string; x: string; y: string; add: string; note: string };
  members: { title: string; name: string; from: string; to: string; area: string; modulus: string; add: string; note: string };
  supports: { name: string; node: string; kind: string; kinds: { pin: string; roller: string }; angle: string; add: string; note: string };
  loads: { name: string; node: string; fx: string; fy: string; add: string; note: string };

  /** Said under a list that is full, with {max} and {list}: the list's name in the plural. */
  limit: string;
  lists: Record<TrussList, string>;
  /** Small words the sentences below are built from. */
  words: { and: string; theNode: string; theNodes: string; nodes: string };

  /** The section group: what it adds to the first calculator's, and the line that says what the section is for. */
  material: { area: string; note: string };

  /** After a node is deleted. {node}; {count} and {list} for the members, supports and loads that went with it. */
  removed: { node: string; members: string; supports: string; loads: string; renumbered: string };

  results: {
    /** The determinacy line. {formula} is the formula as the page writes it. */
    determinacy: {
      formula: string;
      legend: string;
      determinate: { title: string; note: string };
      indeterminate: { title: string; note: string };
      unstable: { title: string; note: string };
    };
    summary: string;
    tension: string;
    compression: string;
    none: string;
    memberOf: string;
    schematic: string;
    options: { title: string; forces: string; numbers: string; deformed: string };
    scale: string;
    waiting: string;
    legend: { tension: string; compression: string; zero: string; load: string; reaction: string; node: string; flagged: string; deformed: string; unsolved: string };
    drawing: { empty: string; truss: string; largest: string; unsolved: string; reactions: string };
    /** The Reactions card. */
    reaction: { node: string; kind: string; pin: string; roller: string; rx: string; ry: string; size: string; along: string; alongNote: string; right: string; left: string };
    /** The Member forces card. */
    forces: {
      title: string;
      member: string;
      nodes: string;
      force: string;
      state: string;
      stress: string;
      elongation: string;
      tension: string;
      compression: string;
      zero: string;
      largestTension: string;
      largestCompression: string;
      order: string;
      orders: { member: string; largest: string; tension: string };
      pick: string;
      signs: string;
      stressNote: string;
    };
    /** The Node displacements card. */
    displacements: { title: string; node: string; ux: string; uy: string; size: string; note: string; equal: string };
    /** The Equilibrium check card. */
    equilibrium: { title: string; loads: string; sumFx: string; sumFy: string; sumM: string; joint: string; balanced: string; unbalanced: string };
    /** The Zero-force members card. */
    zero: { title: string; none: string; rule: Record<ZeroRule, string>; solved: string; note: string };
    /** Over the problems that leave the truss solved. */
    warningsTitle: string;
  };

  /** What is said of each problem that stops a solution; each takes the numbers its code carries. */
  issues: Record<AnalysisIssueCode, string>;
  /** The field a 'number' or a 'section' problem is about. */
  fields: { x: string; y: string; fx: string; fy: string; angle: string; kind: string; E: string; A: string };
  warnings: Record<TrussWarningCode, string>;
  issuesTitle: string;
  /** A truss was in the address and could not be read. */
  linkError: string;
  /** A truss is in the address and the script has not opened it yet: shown in place of the tool until it has (calc/ToolFrame.tsx). */
  linkOpening: string;
};

export const trussUi: Record<Lang, TrussUi> = {
  en: {
    sheet: { link: 'To open this truss again: {url}' },
    toolbar: { us: 'US (ft, kip)', si: 'SI (m, kN)', copy: 'Copy link to this truss' },
    template: {
      title: 'Start from a template',
      pick: 'Template',
      names: {
        triangle: 'Triangle (simple roof truss)',
        'king-post': 'King post',
        'queen-post': 'Queen post',
        pratt: 'Pratt',
        howe: 'Howe',
        warren: 'Warren',
        'warren-verticals': 'Warren with verticals',
        fink: 'Fink',
        cantilever: 'Cantilever truss',
      },
      span: 'Span',
      depth: 'Depth',
      panels: 'Panels',
      load: 'Load per top joint',
      layout: 'Supports',
      layouts: {
        'pin-roller': 'Pin left, roller right',
        'roller-pin': 'Roller left, pin right',
        'two-pins': 'Pin at both ends (indeterminate)',
        wall: 'Held by a wall on the left',
      },
      fixed: 'This shape has a fixed pattern: the number of panels is part of it.',
      note: 'Loading a template replaces the nodes, members, supports and loads below with its own, ready to edit. The units and the section stay. The load is the downward load on a joint in the middle of the top chord; a joint at an end takes half.',
      apply: 'Load template',
      done: '{template} loaded: {nodes} nodes, {members} members, {supports} supports and {loads} loads.',
      clamped: {
        span: 'The span {asked} cannot be used; {used} {unit} was used.',
        height: 'The depth {asked} is outside what a truss of this span can have (a hundredth of the span to twice the span); {used} {unit} was used.',
        panels: 'This shape cannot be built with {asked} panels; {used} was used.',
        load: 'The load {asked} is not a number; {used} {unit} was used.',
        supports: 'This shape does not have the “{asked}” layout; “{used}” was used.',
      },
    },
    nodes: {
      title: 'Nodes',
      name: 'Node',
      x: 'x',
      y: 'y',
      add: 'Add a node',
      note: 'The joints of the truss. Coordinates are measured from any origin: x to the right, y upward. Nodes are numbered by their place in this list, so deleting one renumbers those after it.',
    },
    members: {
      title: 'Members',
      name: 'Member',
      from: 'From node',
      to: 'To node',
      area: 'Area, A',
      modulus: 'Modulus, E',
      add: 'Add a member',
      note: 'Straight bars joined at the nodes by frictionless pins. A member takes the section below unless it has an area or a modulus of its own.',
    },
    supports: {
      name: 'Support',
      node: 'Node',
      kind: 'Type',
      kinds: { pin: 'Pin', roller: 'Roller' },
      angle: 'Line of action',
      add: 'Add a support',
      note: 'A pin holds its node in both directions. A roller holds it along one line only: the angle is that line, counter-clockwise from +x. 90° is the usual roller on a horizontal surface, 0° one against a vertical wall.',
    },
    loads: {
      name: 'Load',
      node: 'Node',
      fx: 'Fx',
      fy: 'Fy',
      add: 'Add a load',
      note: 'Forces at nodes only. Fx is positive to the right and Fy upward, so a weight is a negative Fy. Several loads on one node add up.',
    },
    limit: 'A truss holds {max} {list} at most.',
    lists: { nodes: 'nodes', members: 'members', supports: 'supports', loads: 'loads' },
    words: { and: 'and', theNode: 'node', theNodes: 'nodes', nodes: 'nodes' },
    material: {
      area: 'Area, A',
      note: 'E and A give the stresses, the elongations and the displacements, and they decide the forces of an indeterminate truss. For a determinate one the forces do not depend on them.',
    },
    removed: {
      node: 'Node {node} removed.',
      members: '{count|Member|Members} {list} went with it.',
      supports: '{count} {count|support|supports} went with it.',
      loads: '{count} {count|load|loads} went with it.',
      renumbered: 'The nodes after it move up one number.',
    },
    results: {
      determinacy: {
        formula: 'm + r − 2j',
        legend: 'm members, r reaction components (a pin 2, a roller 1), j nodes',
        determinate: { title: 'Statically determinate', note: 'The forces follow from equilibrium alone.' },
        indeterminate: { title: 'Statically indeterminate to degree {degree}', note: 'Equilibrium alone does not give the forces: they depend on the stiffness, E·A, of the members.' },
        unstable: { title: 'Unstable', note: 'As drawn, the truss cannot carry load.' },
      },
      summary: 'Largest forces',
      tension: 'Largest tension',
      compression: 'Largest compression',
      none: 'none',
      memberOf: 'Member {member}',
      schematic: 'Truss, loads and reactions',
      options: { title: 'On the drawing', forces: 'Force on each member', numbers: 'Member numbers', deformed: 'Deformed shape' },
      scale: 'Deformed shape: displacements are drawn {scale} times larger than they are.',
      waiting: 'The results appear here as soon as the truss has a solution.',
      legend: {
        tension: 'Tension (+): solid line',
        compression: 'Compression (−): hollow line',
        zero: 'No force: dashed grey line',
        load: 'Load',
        reaction: 'Reaction',
        node: 'Node number',
        flagged: 'Node with a problem',
        deformed: 'Deformed shape',
        unsolved: 'Not solved: members are drawn without forces',
      },
      drawing: {
        empty: 'Truss: no nodes yet.',
        truss: 'Truss: {nodes} {nodes|node|nodes}, {members} {members|member|members}, {supports} {supports|support|supports}, {loads} {loads|load|loads}.',
        largest: 'Largest tension: {tension}. Largest compression: {compression}.',
        unsolved: 'It cannot be solved yet; the problems are listed beside the drawing.',
        reactions: 'Reactions: {list}.',
      },
      reaction: {
        node: 'Node',
        kind: 'Type',
        pin: 'Pin',
        roller: 'Roller, {angle}°',
        rx: 'x component',
        ry: 'y component',
        size: 'Size',
        along: 'Along the roller’s line',
        alongNote: 'A reaction is the force the support exerts on the truss. A roller has one: along its line of action, positive in the direction of its angle, counter-clockwise from +x.',
        right: 'to the right',
        left: 'to the left',
      },
      forces: {
        title: 'Member forces',
        member: 'Member',
        nodes: 'Nodes',
        force: 'Force',
        state: 'State',
        stress: 'Stress, N ÷ A',
        elongation: 'Elongation',
        tension: 'Tension',
        compression: 'Compression',
        zero: 'Zero',
        largestTension: 'largest tension',
        largestCompression: 'largest compression',
        order: 'Order',
        orders: { member: 'Member number', largest: 'Largest force first', tension: 'Tension first' },
        pick: 'Mark this member on the drawing',
        signs: 'Tension is positive (+): the member pulls on its nodes. Compression is negative (−): it pushes on them.',
        stressNote: 'Stress is the force over the area under the loads as entered. It is not a check of the member: no capacity, no buckling, no factors.',
      },
      displacements: {
        title: 'Node displacements',
        node: 'Node',
        ux: 'x displacement',
        uy: 'y displacement',
        size: 'Total',
        note: 'Positive to the right and upward. They follow from the members’ stiffness, E·A.',
        equal: 'Not shown: displacements need an area and a modulus for every member.',
      },
      equilibrium: {
        title: 'Equilibrium check',
        loads: 'Loads added up',
        sumFx: 'Σ Fx, loads and reactions',
        sumFy: 'Σ Fy, loads and reactions',
        sumM: 'Σ M about x = {x}, y = {y}',
        joint: 'Largest force left over at a node',
        balanced: 'Balanced: the loads and the reactions are in equilibrium, and so is every node.',
        unbalanced: 'Out of balance: do not use these results.',
      },
      zero: {
        title: 'Members with no force',
        none: 'Every member carries a force under these loads.',
        rule: {
          'two-members': 'Zero by inspection: at node {node} only two members meet, not along one line, and no load or support acts there, so both carry no force.',
          'three-members': 'Zero by inspection: at node {node} three members meet, two of them along one line, and no load or support acts there, so the third carries no force.',
        },
        solved: 'Carries no force under this load.',
        note: 'A member with no force under these loads still braces the members it joins, and carries force if the loading changes.',
      },
      warningsTitle: 'To note',
    },
    issues: {
      'few-nodes': 'A truss needs at least two nodes, and this one has {count}.',
      'no-members': 'The truss has no member. Add members between the nodes.',
      'too-big': 'A truss holds {max} {list} at most, and this one has {count}.',
      number: 'The {field} needs a number the calculation can use.',
      section: 'The {field} must be a number above zero.',
      'member-node': 'This member joins a node that is not in the list. Choose both of its nodes.',
      'zero-length': 'This member goes from a node to itself. Choose two different nodes.',
      'duplicate-node': 'Nodes {a} and {b} are at the same place. Move one of them, or remove it.',
      'short-member': 'This member is under a millionth of the truss in length, too short for a sound solution. Move a node, or remove the member.',
      'duplicate-member': 'Members {a} and {b} join the same two nodes. Remove one of them.',
      'node-unconnected': 'Node {a} has no member. Join it to the truss, or remove it.',
      disconnected: 'The members form separate pieces: {groups}. Join them with a member, or remove the piece that is not part of the truss.',
      'support-node': 'This support is on a node that is not in the list. Choose its node.',
      'duplicate-support': 'Node {a} already has a support. A node holds one: a pin or a roller.',
      'load-node': 'This load is on a node that is not in the list. Choose its node.',
      'few-supports': 'The supports give {count} reaction {count|component|components}, and a truss needs at least 3 to stand (a pin gives 2, a roller 1). Add a support.',
      mechanism: 'The truss is a mechanism: {nodes} can move with no member changing length. Add a member or a support.',
      unrestrained: 'The supports do not hold the truss as a whole: it can move as a rigid body in {count} {count|way|ways}, because their lines of action are all parallel or meet at one point. Change the type, the angle or the place of a support.',
      'ill-conditioned': 'The members’ stiffnesses, E·A ÷ length, differ by a factor of a trillion or more, and the solution does not balance to the figures printed. Use areas and moduli of a similar order.',
      size: 'A number in the results is beyond the range the calculation can hold.',
      stopped: 'This truss made the calculation stop, so no results can be shown. The calculator is at fault here, not the truss.',
    },
    fields: { x: 'x coordinate', y: 'y coordinate', fx: 'Fx', fy: 'Fy', angle: 'angle', kind: 'type', E: 'modulus of elasticity (E)', A: 'area (A)' },
    warnings: {
      'no-load': 'There is no load, or every load is zero: every force and every reaction is zero.',
      'partial-stiffness': 'The truss is statically indeterminate and only some of its members have both an area and a modulus. The forces then depend on how stiff the members are compared with one another, so all of them are taken as equally stiff. Give every member an area and a modulus, here or in its own row, to solve it properly.',
    },
    issuesTitle: 'This truss cannot be solved yet',
    linkError: 'This link’s truss failed to open, so the page shows the example instead of the truss that was sent.',
    linkOpening: 'This link carries a truss. The page opens it once its script has loaded; until then the tool stays out of sight, so nobody mistakes the example for the truss in the link.',
  },
  es: {
    sheet: { link: 'Para abrir esta cercha de nuevo: {url}' },
    toolbar: { us: 'EE. UU. (ft, kip)', si: 'SI (m, kN)', copy: 'Copiar enlace a esta cercha' },
    template: {
      title: 'Partir de una plantilla',
      pick: 'Plantilla',
      names: {
        triangle: 'Triangular (cercha simple de cubierta)',
        'king-post': 'De pendolón',
        'queen-post': 'De dos pendolones',
        pratt: 'Pratt',
        howe: 'Howe',
        warren: 'Warren',
        'warren-verticals': 'Warren con montantes',
        fink: 'Fink',
        cantilever: 'Cercha en voladizo',
      },
      span: 'Luz',
      depth: 'Altura',
      panels: 'Paneles',
      load: 'Carga por nudo superior',
      layout: 'Apoyos',
      layouts: {
        'pin-roller': 'Articulado a la izquierda, rodillo a la derecha',
        'roller-pin': 'Rodillo a la izquierda, articulado a la derecha',
        'two-pins': 'Articulado en ambos extremos (indeterminada)',
        wall: 'Sujeta por un muro a la izquierda',
      },
      fixed: 'Esta forma tiene un patrón fijo: el número de paneles forma parte de él.',
      note: 'Cargar una plantilla sustituye los nudos, las barras, los apoyos y las cargas de abajo por los suyos, listos para editar. Las unidades y la sección se conservan. La carga es la que actúa hacia abajo sobre un nudo del centro del cordón superior; un nudo de un extremo recibe la mitad.',
      apply: 'Cargar plantilla',
      done: 'Plantilla «{template}» cargada: {nodes} nudos, {members} barras, {supports} apoyos y {loads} cargas.',
      clamped: {
        span: 'La luz {asked} no se puede usar; se usó {used} {unit}.',
        height: 'La altura {asked} queda fuera de lo que puede tener una cercha de esta luz (de una centésima de la luz a dos veces la luz); se usó {used} {unit}.',
        panels: 'Esta forma no se puede construir con {asked} paneles; se usaron {used}.',
        load: 'La carga {asked} no es un número; se usó {used} {unit}.',
        supports: 'Esta forma no tiene la disposición «{asked}»; se usó «{used}».',
      },
    },
    nodes: {
      title: 'Nudos',
      name: 'Nudo',
      x: 'x',
      y: 'y',
      add: 'Añadir un nudo',
      note: 'Las uniones de la cercha. Las coordenadas se miden desde un origen cualquiera: x hacia la derecha, y hacia arriba. Los nudos se numeran por su lugar en esta lista, de modo que borrar uno renumera los que le siguen.',
    },
    members: {
      title: 'Barras',
      name: 'Barra',
      from: 'Del nudo',
      to: 'Al nudo',
      area: 'Área, A',
      modulus: 'Módulo, E',
      add: 'Añadir una barra',
      note: 'Barras rectas unidas en los nudos por articulaciones sin fricción. Una barra toma la sección de más abajo, salvo que tenga un área o un módulo propios.',
    },
    supports: {
      name: 'Apoyo',
      node: 'Nudo',
      kind: 'Tipo',
      kinds: { pin: 'Articulado', roller: 'Rodillo' },
      angle: 'Línea de acción',
      add: 'Añadir un apoyo',
      note: 'Un apoyo articulado sujeta su nudo en las dos direcciones. Un rodillo lo sujeta solo a lo largo de una recta: el ángulo es esa recta, en sentido antihorario desde +x. 90° es el rodillo habitual sobre una superficie horizontal; 0°, uno contra un muro vertical.',
    },
    loads: {
      name: 'Carga',
      node: 'Nudo',
      fx: 'Fx',
      fy: 'Fy',
      add: 'Añadir una carga',
      note: 'Fuerzas solo en los nudos. Fx es positiva hacia la derecha y Fy hacia arriba, de modo que un peso es una Fy negativa. Varias cargas en un mismo nudo se suman.',
    },
    limit: 'Una cercha admite {max} {list} como máximo.',
    lists: { nodes: 'nudos', members: 'barras', supports: 'apoyos', loads: 'cargas' },
    words: { and: 'y', theNode: 'el nudo', theNodes: 'los nudos', nodes: 'nudos' },
    material: {
      area: 'Área, A',
      note: 'E y A dan los esfuerzos, los alargamientos y los desplazamientos, y determinan las fuerzas de una cercha indeterminada. En una determinada, las fuerzas no dependen de ellos.',
    },
    removed: {
      node: 'Se quitó el nudo {node}.',
      members: 'Con él {count|se fue la barra|se fueron las barras} {list}.',
      supports: 'Con él {count|se fue|se fueron} {count} {count|apoyo|apoyos}.',
      loads: 'Con él {count|se fue|se fueron} {count} {count|carga|cargas}.',
      renumbered: 'Los nudos siguientes suben un número.',
    },
    results: {
      determinacy: {
        formula: 'b + r − 2n',
        legend: 'b barras, r componentes de reacción (un apoyo articulado 2, un rodillo 1), n nudos',
        determinate: { title: 'Estáticamente determinada', note: 'Las fuerzas se obtienen solo con el equilibrio.' },
        indeterminate: { title: 'Estáticamente indeterminada de grado {degree}', note: 'El equilibrio solo no da las fuerzas: dependen de la rigidez, E·A, de las barras.' },
        unstable: { title: 'Inestable', note: 'Tal como está dibujada, la cercha no puede soportar carga.' },
      },
      summary: 'Fuerzas máximas',
      tension: 'Mayor tensión',
      compression: 'Mayor compresión',
      none: 'ninguna',
      memberOf: 'Barra {member}',
      schematic: 'Cercha, cargas y reacciones',
      options: { title: 'En el dibujo', forces: 'Fuerza en cada barra', numbers: 'Números de barra', deformed: 'Forma deformada' },
      scale: 'Forma deformada: los desplazamientos se dibujan {scale} veces mayores de lo que son.',
      waiting: 'Los resultados aparecerán aquí en cuanto la cercha tenga solución.',
      legend: {
        tension: 'Tensión (+): línea continua',
        compression: 'Compresión (−): línea hueca',
        zero: 'Sin fuerza: línea gris discontinua',
        load: 'Carga',
        reaction: 'Reacción',
        node: 'Número de nudo',
        flagged: 'Nudo con un problema',
        deformed: 'Forma deformada',
        unsolved: 'Sin resolver: las barras se dibujan sin fuerzas',
      },
      drawing: {
        empty: 'Cercha: todavía no hay nudos.',
        truss: 'Cercha: {nodes} {nodes|nudo|nudos}, {members} {members|barra|barras}, {supports} {supports|apoyo|apoyos}, {loads} {loads|carga|cargas}.',
        largest: 'Mayor tensión: {tension}. Mayor compresión: {compression}.',
        unsolved: 'Todavía no se puede resolver; los problemas están en la lista junto al dibujo.',
        reactions: 'Reacciones: {list}.',
      },
      reaction: {
        node: 'Nudo',
        kind: 'Tipo',
        pin: 'Articulado',
        roller: 'Rodillo, {angle}°',
        rx: 'Componente x',
        ry: 'Componente y',
        size: 'Magnitud',
        along: 'A lo largo de la recta del rodillo',
        alongNote: 'Una reacción es la fuerza que el apoyo ejerce sobre la cercha. Un rodillo tiene una sola: a lo largo de su línea de acción, positiva en el sentido de su ángulo, antihorario desde +x.',
        right: 'hacia la derecha',
        left: 'hacia la izquierda',
      },
      forces: {
        title: 'Fuerzas en las barras',
        member: 'Barra',
        nodes: 'Nudos',
        force: 'Fuerza',
        state: 'Estado',
        stress: 'Esfuerzo, N ÷ A',
        elongation: 'Alargamiento',
        tension: 'Tensión',
        compression: 'Compresión',
        zero: 'Nula',
        largestTension: 'mayor tensión',
        largestCompression: 'mayor compresión',
        order: 'Orden',
        orders: { member: 'Número de barra', largest: 'Mayor fuerza primero', tension: 'Tensión primero' },
        pick: 'Marcar esta barra en el dibujo',
        signs: 'La tensión es positiva (+): la barra tira de sus nudos. La compresión es negativa (−): los empuja.',
        stressNote: 'El esfuerzo es la fuerza entre el área bajo las cargas introducidas. No es una verificación de la barra: ni capacidad, ni pandeo, ni factores.',
      },
      displacements: {
        title: 'Desplazamientos de los nudos',
        node: 'Nudo',
        ux: 'Desplazamiento en x',
        uy: 'Desplazamiento en y',
        size: 'Total',
        note: 'Positivos hacia la derecha y hacia arriba. Resultan de la rigidez de las barras, E·A.',
        equal: 'No se muestran: los desplazamientos necesitan un área y un módulo en todas las barras.',
      },
      equilibrium: {
        title: 'Comprobación del equilibrio',
        loads: 'Suma de las cargas',
        sumFx: 'Σ Fx, cargas y reacciones',
        sumFy: 'Σ Fy, cargas y reacciones',
        sumM: 'Σ M respecto a x = {x}, y = {y}',
        joint: 'Mayor fuerza sobrante en un nudo',
        balanced: 'En equilibrio: las cargas y las reacciones se equilibran, y también cada nudo.',
        unbalanced: 'Fuera de equilibrio: no use estos resultados.',
      },
      zero: {
        title: 'Barras sin fuerza',
        none: 'Todas las barras soportan alguna fuerza con estas cargas.',
        rule: {
          'two-members': 'Nula por inspección: en el nudo {node} concurren solo dos barras, no alineadas, y allí no actúa ninguna carga ni hay apoyo, así que ninguna de las dos soporta fuerza.',
          'three-members': 'Nula por inspección: en el nudo {node} concurren tres barras, dos de ellas alineadas, y allí no actúa ninguna carga ni hay apoyo, así que la tercera no soporta fuerza.',
        },
        solved: 'No soporta fuerza con esta carga.',
        note: 'Una barra sin fuerza con estas cargas sigue arriostrando las barras que une, y soporta fuerza si cambia la carga.',
      },
      warningsTitle: 'A tener en cuenta',
    },
    issues: {
      'few-nodes': 'Una cercha necesita al menos dos nudos, y esta tiene {count}.',
      'no-members': 'La cercha no tiene ninguna barra. Añada barras entre los nudos.',
      'too-big': 'Una cercha admite {max} {list} como máximo, y esta tiene {count}.',
      number: '{field} necesita un número que el cálculo pueda usar.',
      section: '{field} debe ser un número mayor que cero.',
      'member-node': 'Esta barra une un nudo que no está en la lista. Elija sus dos nudos.',
      'zero-length': 'Esta barra va de un nudo a sí mismo. Elija dos nudos distintos.',
      'duplicate-node': 'Los nudos {a} y {b} están en el mismo lugar. Mueva uno de ellos o quítelo.',
      'short-member': 'Esta barra es más corta que una millonésima de la cercha: con una tan corta no se resuelve. Mueva un nudo o quite la barra.',
      'duplicate-member': 'Las barras {a} y {b} unen los mismos dos nudos. Quite una de ellas.',
      'node-unconnected': 'El nudo {a} no tiene ninguna barra. Únalo a la cercha o quítelo.',
      disconnected: 'Las barras forman piezas separadas: {groups}. Únalas con una barra o quite la pieza que no forma parte de la cercha.',
      'support-node': 'Este apoyo está en un nudo que no está en la lista. Elija su nudo.',
      'duplicate-support': 'El nudo {a} ya tiene un apoyo. Un nudo admite uno solo: articulado o de rodillo.',
      'load-node': 'Esta carga está en un nudo que no está en la lista. Elija su nudo.',
      'few-supports': 'Los apoyos dan {count} {count|componente|componentes} de reacción, y una cercha necesita al menos 3 para sostenerse (un apoyo articulado da 2; un rodillo, 1). Añada un apoyo.',
      mechanism: 'La cercha es un mecanismo: hay movimiento posible, sin que cambie la longitud de ninguna barra, en {nodes}. Añada una barra o un apoyo.',
      unrestrained: 'Los apoyos no sujetan la cercha en conjunto: puede moverse como un sólido rígido de {count} {count|manera|maneras}, porque sus líneas de acción son todas paralelas o concurren en un punto. Cambie el tipo, el ángulo o el lugar de un apoyo.',
      'ill-conditioned': 'Las rigideces de las barras, E·A entre la longitud, difieren en un factor de un billón o más, y la solución no se equilibra con las cifras que se imprimen. Use áreas y módulos de un orden parecido.',
      size: 'Un número de los resultados queda fuera del rango que el cálculo puede manejar.',
      stopped: 'Con esta cercha el cálculo se detuvo y no se puede mostrar ningún resultado. El error es de la calculadora, no de la cercha.',
    },
    fields: { x: 'La coordenada x', y: 'La coordenada y', fx: 'La Fx', fy: 'La Fy', angle: 'El ángulo', kind: 'El tipo', E: 'El módulo de elasticidad (E)', A: 'El área (A)' },
    warnings: {
      'no-load': 'No hay carga, o todas las cargas son cero: toda fuerza y toda reacción son cero.',
      'partial-stiffness': 'La cercha es estáticamente indeterminada y solo algunas de sus barras tienen área y módulo. Las fuerzas dependen entonces de lo rígidas que sean las barras entre sí, así que se toman todas como igual de rígidas. Dé un área y un módulo a cada barra, aquí o en su propia fila, para resolverla bien.',
    },
    issuesTitle: 'Esta cercha todavía no se puede resolver',
    linkError: 'No se pudo abrir la cercha de este enlace; en pantalla está el ejemplo, no la cercha que se envió.',
    linkOpening: 'Este enlace trae una cercha. La página la abre cuando termina de cargar su script; hasta entonces la herramienta no se muestra, para que nadie confunda el ejemplo con la cercha del enlace.',
  },
};
