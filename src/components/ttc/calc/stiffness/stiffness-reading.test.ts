import { describe, expect, it, vi } from 'vitest';
import { formatNumber } from '@/lib/calc/format';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { decodeStiffness, defaultStiffness, emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/stiffness/templates';
import type { Lang } from '@/lib/ttc/i18n';
import { build } from './fixtures.testlib';
import { scaleNote } from './Schematic';
import { stiffnessLayout, type Looks } from './layout';
import { jacobi, movingNodes } from './mechanism';
import { cautionLine, contract, fill, flaggedNodes, issueSentence, largestRotation, mechanismNodes, movementShare, nodesOf, raised, readingSentence, sayFactor, scalePhrase, signed } from './text';

vi.setConfig({ testTimeout: 120_000 });

/**
 * THE SENTENCES THAT GO WITH THE DRAWING, in both languages: the one under it (what to read in it), the notes about the deformed shape and about
 * movements that are not small, and the grammar of the ones that name nodes. Each is built from the numbers of the structure and from what is
 * drawn, and must be true in the branch it is written for: no load, no movement, a turn without a translation, a drawing without node numbers, a
 * mechanism of one node and of several, a factor under 1.
 */

const num = (v: number, sig = 4) => formatNumber(v, sig, ',').replace(/^-/, '−');
const val = (v: number, sig = 4) => signed(formatNumber(Math.abs(v), sig, ','), v);
const how = (mode: 'truss' | 'frame' = 'truss') => ({ num, val, mode });
const tpl = (id: TemplateId, units: 'us' | 'si' = 'us') => reduceStiffness(emptyStiffness(units), { type: 'template', template: id });
const say = (form: StiffnessForm, drawn: { deformed: boolean; nodeNumbers?: boolean } = { deformed: true }, lang: Lang = 'en') => {
  const a = analyseSafely(form);
  return readingSentence(a, drawn, stiffnessUi[lang], how(form.mode));
};
const looks = (rest: Partial<Looks> = {}): Looks => ({ loads: true, reactions: true, deformed: true, dofs: true, nodeNumbers: true, memberNumbers: true, values: true, group: ',', ...rest });

const base = defaultStiffness();
const unloaded = reduceStiffness(base, { type: 'patch', list: 'loads', id: base.loads[0].id, patch: { fx: 0, fy: 0 } });
// Two bars on one line, pinned at both ends, with a load across the middle node: one node can move.
const mech1 = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [20, 0]], members: [[1, 2], [2, 3]], supports: [[1, 'pin'], [3, 'pin']], loads: [[2, 0, -5]] });
// Three bars on one line: two nodes can move.
const mech2 = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [20, 0], [30, 0]], members: [[1, 2], [2, 3], [3, 4]], supports: [[1, 'pin'], [4, 'pin']], loads: [[2, 0, -5]] });
// Three rollers on parallel lines: the whole structure can slide or turn.
const rigid = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [10, 5]], members: [[1, 2], [2, 3], [1, 3]], supports: [[1, 'roller'], [2, 'roller'], [3, 'roller']], loads: [[3, 5, -5]] });
// Loads that sit on supports only: nothing moves, and there is a load.
const onSupports = build({ mode: 'truss', nodes: [[0, 0], [20, 0], [10, 8]], members: [[1, 3], [2, 3], [1, 2]], supports: [[1, 'pin'], [2, 'pin'], [3, 'pin']], loads: [[1, 0, -10]] });

describe('a structure that does not move says so, and nothing is said of a shape that is not drawn', () => {
  it('no load at all: it does not speak of "these loads", and no deformed shape "lies on the structure"', () => {
    const a = analyseSafely(unloaded);
    expect(a.drawing.deformed?.factor ?? null).toBeNull();
    const withShape = say(unloaded, { deformed: true });
    expect(withShape).toContain('No load is applied, so nothing moves and no deformed shape is drawn.');
    expect(withShape).not.toMatch(/These loads|lies on the structure/);
    expect(say(unloaded, { deformed: false })).toContain('No load is applied, so nothing moves.');
    expect(say(unloaded, { deformed: false })).not.toContain('deformed shape');
    // The note beside the drawing says the same thing in other words, not another thing.
    const l = stiffnessLayout(a.drawing, { ...looks(), width: 650 });
    expect(l.factor).toBeNull();
    expect(scaleNote(l, looks(), a.drawing, { notes: stiffnessUi.en.drawing.notes }, { displacement: 'in' })).toBe('Nothing moves, so no deformed shape is drawn.');
    expect(l.legend).not.toContain('deformed');
  });
  it('loads that sit on supports move nothing: the loads exist, and the sentence says nothing moves under them', () => {
    const a = analyseSafely(onSupports);
    expect(a.results).not.toBeNull();
    expect(a.drawing.loads.length).toBeGreaterThan(0);
    expect(a.drawing.deformed?.factor ?? null).toBeNull();
    expect(say(onSupports, { deformed: true })).toContain('Nothing moves under the loads, so no deformed shape is drawn.');
    expect(say(onSupports, { deformed: false })).toContain('Nothing moves under the loads.');
    expect(say(onSupports, { deformed: true })).not.toMatch(/These loads|lies on/);
  });
  it('and in Spanish', () => {
    expect(say(unloaded, { deformed: true }, 'es')).toContain('No hay ninguna carga, así que nada se mueve y no se dibuja ninguna deformada.');
    expect(say(onSupports, { deformed: true }, 'es')).toContain('Nada se mueve con las cargas, así que no se dibuja ninguna deformada.');
    expect(say(unloaded, { deformed: true }, 'es')).not.toMatch(/Estas cargas|queda sobre la estructura/);
  });
});

describe('a node that turns while none translates is said to turn (a propped cantilever)', () => {
  it('names the rotation, in radians, and does not say that no node moves and stop', () => {
    const f = tpl('frame-propped');
    const a = analyseSafely(f);
    expect(a.results!.displacements.every((d) => d.magnitude === 0)).toBe(true);
    const turn = largestRotation(a);
    expect(turn).not.toBeNull();
    expect(turn!.node).toBe(2);
    const s = say(f, { deformed: true });
    expect(s).toContain(`No node moves, but node 2 turns most, by ${num(turn!.value)} rad.`);
    expect(s).not.toContain('No node moves, but the loaded members bend');
    expect(say(f, { deformed: true }, 'es')).toContain(`Ningún nudo se mueve, pero el nudo 2 es el que más gira: ${num(turn!.value)} rad.`);
  });
  it('a truss has no rotation to name, and a beam fixed at both ends has none either', () => {
    expect(largestRotation(analyseSafely(base))).toBeNull();
    const fixed = analyseSafely(tpl('frame-fixed-point'));
    expect(largestRotation(fixed)).toBeNull();
    expect(say(tpl('frame-fixed-point'), { deformed: true })).toContain('No node moves, but the loaded members bend between their nodes.');
  });
});

describe('the nodes of every motion of a mechanism are found from its stiffness matrix', () => {
  it('Jacobi finds the eigenvalues of a symmetric matrix (2 - √2, 2, 2 + √2) and orthonormal vectors', () => {
    const { values, vectors } = jacobi([[2, 1, 0], [1, 2, 1], [0, 1, 2]]);
    expect([...values].sort((a, b) => a - b).map((v) => Number(v.toFixed(9)))).toEqual([Number((2 - Math.SQRT2).toFixed(9)), 2, Number((2 + Math.SQRT2).toFixed(9))]);
    for (const [i, u] of vectors.entries()) for (const [j, w] of vectors.entries()) expect(Math.abs(u.reduce((s, x, k) => s + x * w[k], 0) - (i === j ? 1 : 0))).toBeLessThan(1e-9);
  });
  it('three bars on a line with a pin at each end: nodes 2 and 3 (two independent motions); a frame with a loose joint: its node', () => {
    const a = analyseSafely(mech2);
    expect(movingNodes(a.partial, a.drawing.side)).toEqual([2, 3]);
    const b = analyseSafely(mech1);
    expect(movingNodes(b.partial, b.drawing.side)).toEqual([2]);
    expect(movingNodes([], 1)).toBeNull();
  });
});

describe('the sentence follows the node numbers switch', () => {
  it('with numbers: circles with their numbers; without: dots, and the node it names is said to be in the tables', () => {
    const on = say(tpl('frame-portal'), { deformed: true, nodeNumbers: true });
    expect(on).toContain('circles are nodes with their numbers');
    expect(on).not.toContain('Node numbers are off');
    const off = say(tpl('frame-portal'), { deformed: true, nodeNumbers: false });
    expect(off).toContain('dots are nodes');
    expect(off).not.toMatch(/circles|with their numbers/);
    expect(off).toContain('Node 3 moves most');
    expect(off).toContain('Node numbers are off on the drawing: the tables number the nodes.');
    // (omitted: the page's own default, numbers on)
    expect(say(tpl('frame-portal'), { deformed: true })).toBe(on);
  });
  it('a sentence that names no node does not add the caveat; a mechanism that names one does', () => {
    expect(say(unloaded, { deformed: true, nodeNumbers: false })).not.toMatch(/Node numbers are off/);
    expect(say(mech1, { deformed: false, nodeNumbers: false })).toContain('Node numbers are off on the drawing');
    expect(say(rigid, { deformed: false, nodeNumbers: false })).not.toContain('Node numbers are off');
  });
  it('in Spanish', () => {
    const off = say(tpl('frame-portal'), { deformed: true, nodeNumbers: false }, 'es');
    expect(off).toContain('los puntos son nudos');
    expect(off).not.toMatch(/círculos|con sus números/);
    expect(off).toContain('Los números de nudo están desactivados en el dibujo: las tablas numeran los nudos.');
    expect(say(tpl('frame-portal'), { deformed: true }, 'es')).toContain('los círculos son nudos con sus números');
  });
});

describe('a verb, a noun and a pronoun agree with how many nodes there are', () => {
  it('one node that can move, and the ring that marks it', () => {
    expect(mechanismNodes(analyseSafely(mech1), analyseSafely(mech1).issues.find((i) => i.code === 'mechanism')!)).toEqual([2]);
    expect(say(mech1, { deformed: true })).toContain('Node 2 is free to move. A ring marks it on the drawing.');
    expect(say(mech1, { deformed: true }, 'es')).toContain('El nudo 2 puede moverse. Un círculo lo marca en el dibujo.');
  });
  it('two nodes that can move, and the rings that mark them', () => {
    const a2 = analyseSafely(mech2);
    const issue = a2.issues.find((i) => i.code === 'mechanism')!;
    // The engine names the nodes of one motion and counts two: the drawing names the nodes of both.
    expect(issue.count).toBe(2);
    expect(mechanismNodes(a2, issue)).toEqual([2, 3]);
    expect(say(mech2, { deformed: true })).toContain('Nodes 2 and 3 are free to move. Rings mark them on the drawing.');
    expect(say(mech2, { deformed: true }, 'es')).toContain('Los nudos 2 y 3 pueden moverse. Unos círculos los marcan en el dibujo.');
  });
  it('the whole structure is one: "puede deslizarse", not "pueden", and no ring', () => {
    expect(say(rigid, { deformed: true })).toContain('The whole structure is free to slide or turn as one piece.');
    expect(say(rigid, { deformed: true })).not.toContain('Rings mark');
    expect(say(rigid, { deformed: true }, 'es')).toContain('Toda la estructura puede deslizarse o girar como una sola pieza.');
    expect(say(rigid, { deformed: true }, 'es')).not.toContain('pueden');
  });
  it('every node that can move is ringed (the ring and the sentence are of the same nodes)', () => {
    expect(flaggedNodes(analyseSafely(mech2))).toEqual([2, 3]);
    expect(flaggedNodes(analyseSafely(mech1))).toEqual([2]);
  });
  it('the contraction of "a el" and "de el" is made where the node is named after a preposition (Spanish only)', () => {
    expect(contract('Nada está unido a el nudo 4. Fuera de el borde.', stiffnessUi.es.words.contractions)).toBe('Nada está unido al nudo 4. Fuera del borde.');
    expect(contract('Nada está unido a el nudo 4.', stiffnessUi.en.words.contractions)).toBe('Nada está unido a el nudo 4.');
    expect(contract('Una cosa a elegir.', stiffnessUi.es.words.contractions)).toBe('Una cosa a elegir.');
    expect(nodesOf([4], stiffnessUi.es.words)).toBe('el nudo 4');
  });
  it('"Nothing is attached to node 4": al nudo 4 in Spanish, a los nudos 4 y 5 for two', () => {
    const one = reduceStiffness(base, { type: 'add', list: 'nodes' });
    const issue = analyseSafely(one).issues.find((i) => i.code === 'node-unconnected')!;
    expect(issueSentence(issue, stiffnessUi.es, { mode: 'truss' })).toBe('Nada está unido al nudo 4. Únalo a la estructura o quítelo.');
    expect(issueSentence(issue, stiffnessUi.en, { mode: 'truss' })).toBe('Nothing is attached to node 4. Attach it to the structure, or remove it.');
    const two = { ...issue, nodes: [4, 5] };
    expect(issueSentence(two, stiffnessUi.es, { mode: 'truss' })).toBe('Nada está unido a los nudos 4 y 5. Únalos a la estructura o quítelos.');
    expect(issueSentence(two, stiffnessUi.en, { mode: 'truss' })).toBe('Nothing is attached to nodes 4 and 5. Attach them to the structure, or remove them.');
  });
});

describe('a reduction is not called a magnification, and a number is not rounded twice', () => {
  const notes = (lang: Lang) => stiffnessUi[lang].drawing.notes;
  it('over 1 magnified, 1 the true size, under 1 shrunk to a percentage of its size (1/2.5 is not a number of parts), and never 0', () => {
    expect(scalePhrase({ factor: 600 }, num, notes('en'))).toBe('magnified 600 times');
    expect(scalePhrase({ factor: 1 }, num, notes('en'))).toBe('drawn at its true size');
    expect(scalePhrase({ factor: 0.4, shrink: 2.5 }, num, notes('en'))).toBe('shrunk to 40 % of its size');
    expect(scalePhrase({ factor: 0.5 }, num, notes('en'))).toBe('shrunk to 50 % of its size');
    expect(scalePhrase({ factor: 1 / 1.5, shrink: 1.5 }, num, notes('en'))).toBe('shrunk to 66.7 % of its size');
    expect(scalePhrase({ factor: 1 / 8, shrink: 8 }, num, notes('en'))).toBe('shrunk to 12.5 % of its size');
    // where a percentage would be a row of zeros the share is said as 1/N, and a power of ten is raised
    expect(scalePhrase({ factor: 0.005, shrink: 200 }, num, notes('en'))).toBe('shrunk to 1/200 of its size');
    expect(scalePhrase({ factor: 3e-14 }, num, notes('en'))).toBe('shrunk to 1/(3.33 × 10¹³) of its size');
    expect(sayFactor(4e-5, num)).toBe('4 × 10⁻⁵');
    expect(sayFactor(2.5e20, num)).toBe('2.5 × 10²⁰');
    expect(scalePhrase({ factor: 600 }, num, notes('es'))).toBe('ampliada 600 veces');
    expect(scalePhrase({ factor: 1 }, num, notes('es'))).toBe('dibujada a su tamaño real');
    expect(scalePhrase({ factor: 0.4, shrink: 2.5 }, num, notes('es'))).toBe('reducida al 40 % de su tamaño');
    expect(scalePhrase({ factor: 3e-14 }, num, notes('es'))).toBe('reducida a 1/(3.33 × 10¹³) de su tamaño');
    expect(raised('4.5 × 10^−12 and 1 × 10^13')).toBe('4.5 × 10⁻¹² and 1 × 10¹³');
  });
  it('the sentence, the legend and the note of a shape drawn smaller than it is say so', () => {
    for (const key of ['flat50', 'tall'] as const) {
      const form = key === 'flat50' ? flat50() : tall();
      const a = analyseSafely(form);
      const f = a.drawing.deformed!.factor!;
      expect(f, key).toBeLessThan(1);
      const pct = num(100 / (a.drawing.deformed!.shrink ?? 1 / f), 3);
      const s = say(form, { deformed: true });
      expect(s, key).toContain(`shrunk to ${pct} % of its size`);
      expect(s, key).not.toMatch(/magnified 0|magnified [0-9.]+ times|drawn at [0-9.]+ of|shrunk to 1\//);
      const l = stiffnessLayout(a.drawing, { ...looks(), width: 650 });
      expect(scaleNote(l, looks(), a.drawing, { notes: notes('en') }, { displacement: 'in' }), key).toContain(`shrunk to ${pct} % of its size`);
    }
  });
  it('a factor too small to print as a number is written as a power of ten, raised', () => {
    const a = analyseSafely(hugeLoad());
    const f = a.drawing.deformed!.factor!;
    expect(f).toBeLessThan(1e-9);
    const s = say(hugeLoad(), { deformed: true });
    expect(s).not.toContain('magnified 0 times');
    expect(s).toContain('shrunk to 1/(3 × 10¹⁰) of its size');
    expect(s).not.toContain('^');
  });
  it('the movement quoted in the sentence and in the note is the same figure, to the same rounding', () => {
    for (const id of TEMPLATE_IDS) {
      const form = tpl(id);
      const a = analyseSafely(form);
      const far = a.results!.displacements.reduce((m, d) => (d.magnitude > m.magnitude ? d : m));
      if (!(far.magnitude > 0)) continue;
      const l = stiffnessLayout(a.drawing, { ...looks(), width: 650 });
      const note = scaleNote(l, looks(), a.drawing, { notes: stiffnessUi.en.drawing.notes }, { displacement: 'in' });
      // The largest movement of any point is the node's own wherever no member bends further: then both lines quote one number.
      if (Math.abs(a.drawing.deformed!.maxDisplacement - far.magnitude) < 1e-12 * far.magnitude) {
        expect(note, id).toContain(`is ${num(far.magnitude)} in`);
        expect(say(form), id).toContain(`by ${num(far.magnitude)} in`);
      } else {
        expect(note, id).toMatch(/is [0-9.,]+ (in|mm)\.$/);
      }
    }
  });
  it('in Spanish a movement follows its name without a comma between them', () => {
    const s = say(base, { deformed: true }, 'es');
    expect(s).toContain('El nudo 3 es el que más se mueve: 0.01841 in.');
    expect(s).not.toMatch(/se mueve, 0/);
  });
});

describe('a movement that is no longer small beside the structure is said, once, under the drawing', () => {
  const words = (lang: Lang) => stiffnessUi[lang].drawing.notes;
  it('a truss that moves 11 % of its size, and one that moves four times its size', () => {
    const f = analyseSafely(flat50());
    const share = movementShare(f.drawing)!;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.13);
    expect(cautionLine(f.drawing, words('en'), num)).toBe('A member’s chord turns by more than 0.1 rad, and the biggest movement is 11 % of the structure’s size. This analysis assumes movements small beside the structure, so read these numbers as first-order ones.');
    const big = analyseSafely(ratio1000());
    expect(movementShare(big.drawing)!).toBeGreaterThan(1);
    expect(cautionLine(big.drawing, words('en'), num)).toMatch(/^A member’s chord turns by more than 0\.1 rad, and the biggest movement is [0-9.,]+ times the structure’s size\./);
    expect(cautionLine(f.drawing, words('es'), num)).toMatch(/^La cuerda de una barra gira más de 0\.1 rad, y el mayor movimiento es 11 % del tamaño de la estructura\./);
  });
  it('and nothing for a structure that moves a little (every template)', () => {
    for (const id of TEMPLATE_IDS) expect(cautionLine(analyseSafely(tpl(id)).drawing, words('en'), num), id).toBe('');
    expect(cautionLine(analyseSafely(unloaded).drawing, words('en'), num)).toBe('');
    expect(movementShare(analyseSafely(unloaded).drawing)).toBeNull();
  });
});

/* The structures the review of the drawing used (addresses of the page). */
function addr(a: string): StiffnessForm {
  const f = decodeStiffness(a);
  if (!f) throw new Error('bad address');
  return f;
}
// a flat truss 100 ft long whose biggest movement is 136 in
function flat50(): StiffnessForm {
  return addr('Kbb8cnl012u;1;t;us;s,29000,10,100;0,0_25,0.5_50,0_75,0.5_100,0;1,2_2,3_3,4_4,5_2,4_1,3_3,5;1,3_5,2;3,0,-10_2,0,-5;');
}
// two bars 1,000 ft long under a 10 kip load: 51,700 in
function ratio1000(): StiffnessForm {
  return addr('K0bm5qujo1v;1;t;us;s,29000,10,100;0,0_1000,0_500,1;1,2_1,3_2,3;1,3_2,2;3,0,-10;');
}
// a mast, 120 ft tall
function tall(): StiffnessForm {
  return build({ mode: 'frame', nodes: [[0, 0], [0, 40], [0, 80], [0, 120]], members: [[1, 2], [2, 3], [3, 4]], supports: [[1, 'fixed']], loads: [[4, 5, 0]] });
}
// a load of 1e12 on a beam: the shape is drawn a billionth of its size
function hugeLoad(): StiffnessForm {
  return addr('K7dcszc5j2l;1;f;us;s,29000,10,100;0,0_20,0;1,2;1,7_2,2;2,0,1000000000000,1000000000000;u,1,-1000000000000');
}
void fill;
