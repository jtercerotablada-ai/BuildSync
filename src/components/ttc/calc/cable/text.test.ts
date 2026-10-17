import { describe, expect, it } from 'vitest';
import { formatNumber } from '@/lib/calc/format';
import { analyseSafely, type AnalysisIssue, type CableAnalysis, type RegimeLine } from '@/lib/calc/cable/analysis';
import { CABLE_UNITS, convertCable, defaultCase, exampleOf, reduceCable, type CableForm } from '@/lib/calc/cable/model';
import { cableUi } from '@/lib/calc/cable/strings';
import type { Lang } from '@/lib/ttc/i18n';
import {
  angleBetweenLegs,
  bodyReading,
  bodySummary,
  curveReading,
  curveSummary,
  drumReading,
  drumSummary,
  fieldKey,
  fill,
  issueSentence,
  materialForRope,
  regimeSentences,
  ropeFits,
  ropeForMaterial,
  rowUnit,
  signed,
  slingReading,
  slingSummary,
  unitText,
  warningSentence,
  whereOf,
  type Ctx,
} from './text';

/**
 * The little text machinery of the cable calculator's sentences: the holes of a
 * sentence, the sign of a number, the unit as the page sets it, the sentence of
 * every code in both languages with the numbers it carries, the pairing of a
 * rope with its material, and the four drawings in words.
 */

const LANGS: Lang[] = ['en', 'es'];
const ctxOf = (form: CableForm, lang: Lang = 'en'): Ctx => ({ form, units: CABLE_UNITS[form.units], num: (v, sig = 4) => formatNumber(v, sig, lang === 'es' ? ' ' : ',') });
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d|\{[a-z|]+\}/;

describe('fill', () => {
  it('puts a value in its hole, once, and leaves a hole it has no value for', () => {
    expect(fill('Leg {leg} of {count}.', { leg: 2, count: 2 })).toBe('Leg 2 of 2.');
    expect(fill('{missing} stays', {})).toBe('{missing} stays');
  });
  it('chooses the singular for one and the plural for the rest, zero included', () => {
    const s = '{count} {count|turn|turns}';
    expect([0, 1, 2, 11].map((count) => fill(s, { count }))).toEqual(['0 turns', '1 turn', '2 turns', '11 turns']);
  });
  it('does not take what was put into a hole for another hole', () => {
    expect(fill('{a} and {b}', { a: '{b}', b: 'x' })).toBe('{b} and x');
  });
});

describe('signed and unitText', () => {
  it('signs a value with a true minus and writes a zero with none', () => {
    expect(signed('15', 15)).toBe('+15');
    expect(signed('20', -20)).toBe('−20');
    expect(signed('0', 0)).toBe('0');
    expect(signed('0', 3e-14)).toBe('0');
    expect(signed('0', -3e-14)).toBe('0');
  });
  it('writes the coefficient of expansion with a caret, since the page has no raised minus', () => {
    expect(unitText('10⁻⁶/°F')).toBe('10^−6/°F');
    expect(unitText('10⁻⁶/°C')).toBe('10^−6/°C');
    expect(unitText('in²')).toBe('in²');
  });
});

describe('a rope and its material go together', () => {
  it('knows which materials fit each rope type', () => {
    expect(ropeFits('solid', 'steel')).toBe(true);
    expect(ropeFits('solid', 'stainless')).toBe(true);
    expect(ropeFits('solid', 'rope')).toBe(false);
    expect(ropeFits('rope-6x19', 'rope')).toBe(true);
    expect(ropeFits('rope-6x36', 'rope-fibre')).toBe(true);
    expect(ropeFits('rope-6x19', 'steel')).toBe(false);
    expect(ropeFits('strand7', 'strand7')).toBe(true);
    expect(ropeFits('locked', 'rope-spiral')).toBe(true);
    expect(ropeFits('spiral', 'rope')).toBe(false);
  });
  it('takes a typed factor or a typed modulus as fitting anything', () => {
    expect(ropeFits('custom', 'steel')).toBe(true);
    expect(ropeFits('rope-6x19', 'custom')).toBe(true);
    expect(ropeFits('solid', 'custom')).toBe(true);
  });
  it('sets the rope’s usual material when a rope was chosen over a material that does not fit, and nothing otherwise', () => {
    expect(materialForRope('rope-6x19', 'steel', 'rope')).toBe('rope');
    expect(materialForRope('rope-6x36', 'rope-fibre', 'rope')).toBeNull();
    expect(materialForRope('solid', 'rope', 'steel')).toBe('steel');
    expect(materialForRope('solid', 'stainless', 'steel')).toBeNull();
    expect(materialForRope('rope-6x19', 'custom', 'rope')).toBeNull();
  });
  it('sets the material’s usual rope when a material was chosen over a rope that does not fit, and nothing otherwise', () => {
    expect(ropeForMaterial('rope', 'solid', 'rope-6x19')).toBe('rope-6x19');
    expect(ropeForMaterial('rope', 'rope-6x36', 'rope-6x19')).toBeNull();
    expect(ropeForMaterial('steel', 'rope-6x19', 'solid')).toBe('solid');
    expect(ropeForMaterial('custom', 'rope-6x19', 'solid')).toBeNull();
    expect(ropeForMaterial('aluminum', 'custom', 'solid')).toBeNull();
  });
});

describe('the angle between the legs', () => {
  const legs = (a1: number, s1: 'left' | 'right', a2: number, s2: 'left' | 'right'): CableForm => {
    const f = defaultCase();
    return { ...f, load: { ...f.load, leg1: { ...f.load.leg1, angle: a1, side: s1 }, leg2: { ...f.load.leg2, angle: a2, side: s2 } } };
  };
  it('is the difference of the angles on one side and the straight angle less their sum on opposite sides', () => {
    expect(angleBetweenLegs(legs(60, 'left', 60, 'right'))).toBe(60);
    expect(angleBetweenLegs(legs(30, 'left', 70, 'left'))).toBe(40);
    expect(angleBetweenLegs(legs(0, 'left', 0, 'right'))).toBe(180);
    expect(angleBetweenLegs(legs(90, 'left', 90, 'right'))).toBe(0);
    expect(angleBetweenLegs(legs(45, 'right', 45, 'right'))).toBe(0);
  });
});

describe('where a problem is and what it is about', () => {
  it('names the field a row is about, a mass when the block is given by its mass', () => {
    const f = defaultCase();
    expect(fieldKey({ group: 'section', field: 'd' }, f)).toBe('d');
    expect(fieldKey({ group: 'dT' }, f)).toBe('dT');
    expect(fieldKey({ group: 'pull', field: 'W' }, f)).toBe('W');
    expect(fieldKey({ group: 'pull', field: 'W' }, { ...f, pull: { ...f.pull, massInput: true } })).toBe('mass');
    expect(fieldKey(undefined, f)).toBe('value');
  });
  it('gives the unit a row’s value is written in', () => {
    const f = defaultCase();
    const c = ctxOf(f);
    const w = cableUi.en;
    expect(rowUnit({ group: 'section', field: 'd' }, c, w)).toBe('in');
    expect(rowUnit({ group: 'section', field: 'A' }, c, w)).toBe('in²');
    expect(rowUnit({ group: 'section', field: 'E' }, c, w)).toBe('ksi');
    expect(rowUnit({ group: 'section', field: 'alpha' }, c, w)).toBe('10^−6/°F');
    expect(rowUnit({ group: 'load', field: 'W' }, c, w)).toBe('lbf');
    expect(rowUnit({ group: 'leg1', field: 'angle' }, c, w)).toBe('°');
    expect(rowUnit({ group: 'leg2', field: 'length' }, c, w)).toBe('ft');
    expect(rowUnit({ group: 'design', field: 'allowable' }, c, w)).toBe('ksi');
    expect(rowUnit({ group: 'design', field: 'n' }, c, w)).toBe('');
    expect(rowUnit({ group: 'pull', field: 'accel' }, c, w)).toBe('ft/s²');
    expect(rowUnit({ group: 'drum', field: 'wrap' }, c, w)).toBe('turns');
    expect(rowUnit({ group: 'drum', field: 'wrap' }, ctxOf({ ...f, drum: { ...f.drum, wrapUnit: 'deg' } }), w)).toBe('°');
    const si = convertCable({ ...f, forceUnit: 'large' }, 'si');
    expect(rowUnit({ group: 'load', field: 'H' }, ctxOf(si), w)).toBe('kN');
    expect(rowUnit({ group: 'pull', field: 'W' }, ctxOf({ ...si, pull: { ...si.pull, massInput: true } }), w)).toBe('kg');
    expect(whereOf({ group: 'leg2section', field: 'E' }, w)).toBe('Leg 2 section');
    expect(whereOf(undefined, w)).toBeNull();
  });
});

describe('every problem has a sentence, with its numbers', () => {
  const f = defaultCase();
  const at = (issue: Partial<AnalysisIssue> & { code: AnalysisIssue['code'] }): AnalysisIssue => issue as AnalysisIssue;
  const cases: [string, AnalysisIssue, CableForm, Record<Lang, RegExp>][] = [
    ['number', at({ code: 'number', row: { group: 'section', field: 'E' } }), f, { en: /^The modulus \(E\) is empty or is not a number\.$/, es: /^El módulo \(E\) no es un número, o falta\.$/ }],
    ['number on a mass', at({ code: 'number', row: { group: 'pull', field: 'W' } }), { ...f, pull: { ...f.pull, massInput: true } }, { en: /^The mass is empty/, es: /^La masa no es un número, o falta\.$/ }],
    ['range between', at({ code: 'range', row: { group: 'leg1', field: 'angle' }, min: 0, max: 90 }), f, { en: /^The angle must be between 0 and 90°\.$/, es: /^El ángulo debe ser un valor entre 0 y 90°\.$/ }],
    ['range above', at({ code: 'range', row: { group: 'section', field: 'd' }, min: 0, minOpen: true }), f, { en: /^The diameter must be above 0 in\.$/, es: /^El diámetro debe ser mayor que 0 in\.$/ }],
    ['range at least', at({ code: 'range', row: { group: 'load', field: 'W' }, min: 0 }), f, { en: /^The weight must be 0 lbf or more\.$/, es: /^El peso debe ser de 0 lbf o más\.$/ }],
    ['range at most', at({ code: 'range', row: { group: 'drum', field: 'mu' }, max: 100 }), f, { en: /^The friction coefficient must be 100 or less\.$/, es: /^El coeficiente de fricción debe ser de 100 o menos\.$/ }],
    ['range on a field with no bound', at({ code: 'range', row: { group: 'pull', field: 'travel' } }), f, { en: /must be a value the calculation can use\.$/, es: /debe ser un valor que el cálculo pueda usar\.$/ }],
    ['range in turns', at({ code: 'range', row: { group: 'drum', field: 'wrap' }, min: 0, max: 100 }), f, { en: /^The wrap angle must be between 0 and 100 turns\.$/, es: /entre 0 y 100 vueltas\.$/ }],
    ['parallel-legs', at({ code: 'parallel-legs', numbers: [0] }), { ...f, load: { ...f.load, leg1: { ...f.load.leg1, angle: 90 }, leg2: { ...f.load.leg2, angle: 90 } } }, { en: /on one line \(the angle between them is 0°\)/, es: /en una misma recta \(el ángulo entre ellos es de 0°\)/ }],
    ['slack-leg', at({ code: 'slack-leg', leg: 2, numbers: [1200, -350] }), f, { en: /^Equilibrium would need leg 2 to push, with 350 lbf, and a cable cannot push\./, es: /^El equilibrio exigiría que el ramal 2 empujara, con 350 lbf, y un cable no puede empujar\./ }],
    ['size', at({ code: 'size' }), f, { en: /too large/, es: /demasiado grande/ }],
    ['underdetermined', at({ code: 'underdetermined', count: 2 }), f, { en: /^2 of the four quantities are empty\./, es: /^2 de las cuatro cantidades están vacías\./ }],
    ['overdetermined', at({ code: 'overdetermined' }), f, { en: /All four quantities are filled in/, es: /Las cuatro cantidades están llenas/ }],
    ['order', at({ code: 'order', numbers: [300, 800] }), f, { en: /^The large tension, 300 lbf, is below the small one, 800 lbf\./, es: /^La tensión mayor, 300 lbf, es menor que la menor, 800 lbf\./ }],
    ['degenerate mu', at({ code: 'degenerate', unknown: 'mu', numbers: [500, 100] }), f, { en: /^The friction coefficient cannot be found when the wrap is zero.*500 and 100 lbf\)\. Give a wrap above zero\.$/, es: /^El coeficiente de fricción no se puede hallar cuando el ángulo de envolvimiento es cero.*500 y 100 lbf\)/ }],
    ['degenerate beta', at({ code: 'degenerate', unknown: 'beta', numbers: [500, 100] }), f, { en: /^The wrap angle cannot be found when the friction coefficient is zero/, es: /^El ángulo de envolvimiento no se puede hallar cuando el coeficiente de fricción es cero/ }],
    ['overflow', at({ code: 'overflow', numbers: [812.4] }), f, { en: /^μβ is 812, which is past 700/, es: /^μβ vale 812, más de 700/ }],
    ['stopped', at({ code: 'stopped' }), f, { en: /stopped on this case/, es: /interrumpió el cálculo/ }],
  ];
  for (const [name, issue, form, expected] of cases) {
    it(name, () => {
      for (const lang of LANGS) {
        const line = issueSentence(issue, cableUi[lang], ctxOf(form, lang));
        expect(line, `${lang}`).toMatch(expected[lang]);
        expect(line).not.toMatch(noise);
        expect(line).not.toMatch(/ [.,;:)]|\s{2}/);
      }
    });
  }
  it('has a case for every code the analysis can report', () => {
    const covered = new Set(cases.map(([, i]) => i.code));
    for (const code of ['number', 'range', 'parallel-legs', 'slack-leg', 'size', 'underdetermined', 'overdetermined', 'order', 'degenerate', 'overflow', 'stopped']) expect(covered.has(code as AnalysisIssue['code']), code).toBe(true);
  });
});

describe('every warning has a sentence, with its numbers', () => {
  const f = defaultCase();
  it('says each one in both languages', () => {
    const cases: [Parameters<typeof warningSentence>[0], Record<Lang, RegExp>][] = [
      [{ code: 'no-load' }, { en: /^There is no load/, es: /^No hay carga/ }],
      [{ code: 'no-exact-position' }, { en: /cannot meet/, es: /no llegan a encontrarse/ }],
      [{ code: 'no-second-order' }, { en: /first-order tensions stand/, es: /valen las de primer orden/ }],
      [{ code: 'restrained-slack', leg: 2 }, { en: /^In leg 2 the load’s tension plus the thermal force is negative/, es: /^En el ramal 2 la tensión de la carga/ }],
      [{ code: 'large-strain', numbers: [0.0152] }, { en: /^The largest strain is 1\.52 %, above 1 %/, es: /^La mayor deformación unitaria es 1\.52 %, más de 1 %/ }],
      [{ code: 'kinetic-above-static', numbers: [0.3, 0.45] }, { en: /^The kinetic friction 0\.45 is above the static friction 0\.3/, es: /^La fricción cinética 0\.45 es mayor que la estática 0\.3/ }],
      [{ code: 'no-governing' }, { en: /no tension to carry into the cable/, es: /no hay tensión que llevar al cable/ }],
      [{ code: 'no-friction' }, { en: /ratio is 1/, es: /relación es 1/ }],
      [{ code: 'no-wrap' }, { en: /ratio is 1/, es: /relación es 1/ }],
    ];
    expect(cases).toHaveLength(9);
    for (const [warning, expected] of cases) {
      for (const lang of LANGS) {
        const line = warningSentence(warning, cableUi[lang], ctxOf(f, lang));
        expect(line, `${lang} ${warning.code}`).toMatch(expected[lang]);
        expect(line).not.toMatch(noise);
      }
    }
  });
});

describe('every state of a pull has a sentence, with its numbers', () => {
  const pullForm = (patch: Partial<CableForm['pull']>): CableForm => {
    const f = exampleOf('pull');
    return { ...f, pull: { ...f.pull, ...patch } };
  };
  const regimeOf = (form: CableForm, id: 'start' | 'run' | 'accel' = 'run'): RegimeLine => analyseSafely(form).pull!.regimes.find((r) => r.id === id)!;

  it('pull: the tension, the normal force and the friction', () => {
    const r = regimeOf(pullForm({}));
    expect(r.status).toBe('pull');
    expect(regimeSentences(r, cableUi.en, ctxOf(pullForm({})))).toEqual(['To keep it moving: the cable carries 37.52 lbf. The surface pushes back with 81.24 lbf and friction is 32.5 lbf.']);
    expect(regimeSentences(r, cableUi.es, ctxOf(pullForm({}), 'es'))).toEqual(['Para mantenerlo en movimiento: el cable soporta 37.52 lbf. La superficie empuja con 81.24 lbf y la fricción es de 32.5 lbf.']);
  });

  it('slides-on-its-own: and the tension that holds it, from a cable pulling the other way', () => {
    const form = pullForm({ theta: -30, muS: 0.2, muK: 0.1, phi: 0 });
    const r = regimeOf(form);
    expect(r.status).toBe('slides-on-its-own');
    expect(r.hold).not.toBeNull();
    const en = regimeSentences(r, cableUi.en, ctxOf(form));
    expect(en).toHaveLength(2);
    expect(en[0]).toBe('To keep it moving: gravity along the slope beats friction, so the block moves with no pull at all.');
    expect(en[1]).toMatch(/^A cable pulling the other way, 0° above the surface, holds it with [\d.]+ lbf \(normal force [\d.]+ lbf\)\.$/);
    const es = regimeSentences(r, cableUi.es, ctxOf(form, 'es'));
    expect(es[0]).toMatch(/^Para mantenerlo en movimiento: la gravedad a lo largo de la pendiente vence a la fricción/);
    expect(es[1]).toMatch(/^Un cable que tire en sentido contrario, 0° sobre la superficie, lo retiene con/);
    // 100 lb: gravity along the slope is 50, friction 0.1 × 86.6 = 8.66: held with 41.34 lbf.
    expect(en[1]).toContain('holds it with 41.34 lbf');
  });

  it('slides-on-its-own with no cable that holds it says so', () => {
    const form = pullForm({ theta: -30, muS: 0.2, muK: 0.1, phi: 0 });
    const r = { ...regimeOf(form), hold: null };
    const en = regimeSentences(r, cableUi.en, ctxOf(form));
    expect(en).toHaveLength(2);
    expect(en[1]).toBe('No tension of a cable pulling the other way at this angle holds it.');
    expect(regimeSentences(r, cableUi.es, ctxOf(form, 'es'))[1]).toBe('Ninguna tensión de un cable que tire en sentido contrario con este ángulo lo retiene.');
  });

  it('stays-put: a push would be needed', () => {
    const form = pullForm({ theta: 0, travel: 'against', phi: 0 });
    const r = regimeOf(form);
    expect(r.status).toBe('stays-put');
    expect(regimeSentences(r, cableUi.en, ctxOf(form))).toEqual(['To keep it moving: the block does not move this way on its own, and making it move would take a push, which a cable cannot give.']);
    expect(regimeSentences(r, cableUi.es, ctxOf(form, 'es'))[0]).toMatch(/^Para mantenerlo en movimiento: el bloque no se mueve así por sí solo/);
  });

  it('self-locking: the harder the cable pulls the harder friction grips', () => {
    const form = pullForm({ muS: 1, muK: 1, phi: -80 });
    const r = regimeOf(form);
    expect(r.status).toBe('self-locking');
    expect(regimeSentences(r, cableUi.en, ctxOf(form))[0]).toBe('To keep it moving: at this angle the harder the cable pulls the harder friction grips, so no tension moves it. Change the angle.');
    expect(regimeSentences(r, cableUi.es, ctxOf(form, 'es'))[0]).toMatch(/cuanto más tira el cable más agarra la fricción/);
  });

  it('leaves-surface: the tension asked for would lift the block, the case is refused, and where lift-off begins', () => {
    const form = pullForm({ theta: 60, muS: 0.5, muK: 0.5, phi: 60 });
    const r = regimeOf(form);
    expect(r.status).toBe('leaves-surface');
    expect(r.T).toBeNull();
    const en = regimeSentences(r, cableUi.en, ctxOf(form));
    expect(en).toHaveLength(2);
    expect(en[0]).toMatch(/^To keep it moving: the tension this needs, [\d.]+ lbf, would lift the block off the surface \(N would be −?[\d.]+ lbf\), where the friction formula does not apply\. This case is refused\.$/);
    expect(en[1]).toBe('Lift-off begins at a cable angle of 30°.');
    expect(regimeSentences(r, cableUi.es, ctxOf(form, 'es'))[1]).toBe('El bloque empieza a levantarse con un ángulo del cable de 30°.');
    for (const line of en) expect(line).not.toMatch(noise);
  });
});

describe('the drawings in words', () => {
  const sums = (form: CableForm, lang: Lang = 'en') => {
    const a: CableAnalysis = analyseSafely(form);
    const c = ctxOf(form, lang);
    const w = cableUi[lang];
    return { a, c, w };
  };

  it('describes the sling: the loads, each leg, the move and how much it is exaggerated', () => {
    const { a, c, w } = sums(defaultCase());
    expect(slingSummary(a, w, c, true)).toBe(
      'Sling drawing. Load 2,000 lbf. Leg 1 makes 60° with the horizontal, anchored on the left, and carries 1,155 lbf. Leg 2 makes 60° with the horizontal, anchored on the right, and carries 1,155 lbf. The load point moves 0.1124 in down; the drawing exaggerates the move 133 times.',
    );
    expect(slingSummary(a, w, c, false)).toContain('The load point moves 0.1124 in down.');
    expect(slingSummary(a, w, c, false)).not.toContain('exaggerates');
  });

  it('describes a sling with a horizontal force, in Spanish too', () => {
    const f = defaultCase();
    const form = { ...f, load: { ...f.load, H: 300 } };
    const en = sums(form);
    expect(slingSummary(en.a, en.w, en.c, false)).toContain('Load 2,000 lbf with a horizontal force of 300 lbf to the right.');
    const es = sums(form, 'es');
    expect(slingSummary(es.a, es.w, es.c, false)).toMatch(/^Dibujo de la eslinga\. Carga de 2 000 lbf con una fuerza horizontal de 300 lbf hacia la derecha\. El ramal 1 forma/);
  });

  it('describes a single cable, which hangs along the resultant', () => {
    const f = defaultCase();
    const form = { ...f, load: { ...f.load, legs: 1 as const, H: 1500 } };
    const { a, w, c } = sums(form);
    expect(slingSummary(a, w, c, false)).toContain('One cable at 53.13° with the horizontal, anchored on the left, carries 2,500 lbf.');
  });

  it('says a sling that does not move does not move, and one that cannot be solved cannot be drawn', () => {
    const f = defaultCase();
    const still = sums({ ...f, load: { ...f.load, W: 0 } });
    expect(slingSummary(still.a, still.w, still.c, true)).toContain('The load point does not move.');
    const bad = sums({ ...f, load: { ...f.load, W: Number.NaN } });
    expect(slingSummary(bad.a, bad.w, bad.c, true)).toBe(cableUi.en.drawing.slingUnsolved);
  });

  it('describes the free body with its forces, and only the weight where the cable cannot pull', () => {
    const { a, w, c } = sums(exampleOf('pull'));
    const run = a.pull!.regimes.find((r) => r.id === 'run')!;
    expect(bodySummary(a, run, w, c)).toBe('Free body of To keep it moving. A block of weight 100 lbf on a surface inclined 0°, a cable 30° above the surface. Cable tension 37.52 lbf, normal force 81.24 lbf, friction 32.5 lbf.');
    const f = exampleOf('pull');
    const stays = sums({ ...f, pull: { ...f.pull, travel: 'against', phi: 0 } });
    expect(bodySummary(stays.a, stays.a.pull!.regimes[1], stays.w, stays.c)).toContain('The cable cannot pull the block in this case; only the weight is drawn.');
    const bad = sums({ ...f, pull: { ...f.pull, W: -1 } });
    expect(bodySummary(bad.a, null, bad.w, bad.c)).toBe(cableUi.en.drawing.bodyUnsolved);
  });

  it('describes the chart: the least tension of each curve and the chosen angle', () => {
    const { a, w, c } = sums(exampleOf('pull'));
    expect(curveSummary(a, w, c)).toBe('Chart of cable tension against cable angle from −90° to 90°. To start it moving: least tension 44.72 lbf at 26.57°. To keep it moving: least tension 37.14 lbf at 21.8°. Your angle is 30°.');
    const es = sums(exampleOf('pull'), 'es');
    expect(curveSummary(es.a, es.w, es.c)).toMatch(/^Gráfico de la tensión del cable según su ángulo, de −90° a 90°\. Para ponerlo en movimiento: tensión mínima 44\.72 lbf con 26\.57°\./);
    const f = exampleOf('pull');
    const none = sums({ ...f, pull: { ...f.pull, muS: 1, muK: 1, theta: -30, travel: 'against' as const } });
    expect(curveSummary(none.a, none.w, none.c)).not.toMatch(noise);
  });

  it('describes the drum: the wrap, the two tensions, the ratio and the force on the drum', () => {
    const { a, w, c } = sums(exampleOf('drum'));
    expect(drumSummary(a, w, c)).toBe('Drum drawing. A cable wrapped 720° (2 turns) round a drum: 1,000 lbf on the large side, 23.05 lbf on the small side, ratio 43.38. The force on the drum is 976.9 lbf.');
    const f = exampleOf('drum');
    const one = sums({ ...f, drum: { ...f.drum, wrap: 1 } });
    expect(drumSummary(one.a, one.w, one.c)).toContain('(1 turn)');
    const es = sums(exampleOf('drum'), 'es');
    expect(drumSummary(es.a, es.w, es.c)).toMatch(/^Dibujo del tambor\. Un cable enrollado 720° \(2 vueltas\)/);
    const bad = sums({ ...f, drum: { ...f.drum, Tsmall: 10 } });
    expect(drumSummary(bad.a, bad.w, bad.c)).toBe(cableUi.en.drawing.drumUnsolved);
  });

  it('never prints a hole, a minus zero or a NaN in a summary, whatever the case', () => {
    const forms = [defaultCase(), exampleOf('pull'), exampleOf('drum'), exampleOf('pull', 'si'), reduceCable(defaultCase(), { type: 'units', units: 'si' })];
    for (const form of forms) {
      for (const lang of LANGS) {
        const { a, w, c } = sums(form, lang);
        const regime = a.pull?.regimes[0] ?? null;
        for (const text of [slingSummary(a, w, c, true), bodySummary(a, regime, w, c), curveSummary(a, w, c), drumSummary(a, w, c)]) expect(text).not.toMatch(noise);
      }
    }
  });
});

describe('the reading under each drawing', () => {
  const read = (form: CableForm, lang: Lang = 'en') => {
    const a = analyseSafely(form);
    const c = ctxOf(form, lang);
    return { a, c, w: cableUi[lang] };
  };
  const drumForm = (patch: Partial<CableForm['drum']>): CableForm => {
    const f = exampleOf('drum');
    return { ...f, drum: { ...f.drum, ...patch } };
  };
  const pullForm = (patch: Partial<CableForm['pull']>): CableForm => {
    const f = exampleOf('pull');
    return { ...f, pull: { ...f.pull, ...patch } };
  };

  it('drum: reads the capstan in plain words, whichever of the four is the unknown', () => {
    const { a, c, w } = read(drumForm({}));
    expect(drumReading(a, w, c)).toBe('The cable is held at the holding end with 23.05 lbf. A wrap of 2 turns with μ = 0.3 multiplies that by 43.38, so the load end can carry 1,000 lbf.');
    const es = read(drumForm({}), 'es');
    expect(drumReading(es.a, es.w, es.c)).toBe('El cable se sujeta por el extremo que sujeta con 23.05 lbf. Un envolvimiento de 2 vueltas con μ = 0.3 lo multiplica por 43.38, así que el extremo de la carga puede soportar 1 000 lbf.');
    // The large tension unknown: the same relation, with the answer 999.8.
    const big = read(drumForm({ Tbig: null, Tsmall: 23.05 }));
    expect(drumReading(big.a, big.w, big.c)).toBe('The cable is held at the holding end with 23.05 lbf. A wrap of 2 turns with μ = 0.3 multiplies that by 43.38, so the load end can carry 999.8 lbf.');
    // μ unknown.
    const mu = read(drumForm({ mu: null, Tsmall: 23.05 }));
    expect(drumReading(mu.a, mu.w, mu.c)).toMatch(/with μ = 0\.3 multiplies that by 43\.3\d/);
    // The wrap unknown, given in degrees: the answer is read in degrees.
    const wrap = read(drumForm({ wrap: null, Tsmall: 23.05, wrapUnit: 'deg' }));
    expect(drumReading(wrap.a, wrap.w, wrap.c)).toMatch(/^The cable is held at the holding end with 23\.05 lbf\. A wrap of 72\d(\.\d+)?° with μ = 0\.3 multiplies that by 43\.3\d/);
    // In turns: the turns.
    const turns = read(drumForm({ wrap: null, Tsmall: 23.05 }));
    expect(drumReading(turns.a, turns.w, turns.c)).toMatch(/A wrap of 2(\.\d+)? turns with/);
    // One turn is "1 turn"; a quarter turn is read in degrees.
    const one = read(drumForm({ wrap: 1 }));
    expect(drumReading(one.a, one.w, one.c)).toContain('A wrap of 1 turn with');
    const deg = read(drumForm({ wrap: 90, wrapUnit: 'deg' }));
    expect(drumReading(deg.a, deg.w, deg.c)).toContain('A wrap of 90° with μ = 0.3 multiplies that by 1.602');
  });

  it('drum: says that friction gains nothing when it gains nothing, and nothing at all when it cannot be solved', () => {
    for (const patch of [{ mu: 0 }, { wrap: 0 }]) {
      const { a, c, w } = read(drumForm(patch));
      expect(drumReading(a, w, c)).toBe('Friction gains nothing here (the ratio is 1), so both ends carry 1,000 lbf.');
    }
    const es = read(drumForm({ mu: 0 }), 'es');
    expect(drumReading(es.a, es.w, es.c)).toBe('Aquí la fricción no gana nada (la relación es 1), así que los dos extremos soportan 1 000 lbf.');
    const bad = read(drumForm({ Tsmall: 3 }));
    expect(drumReading(bad.a, bad.w, bad.c)).toBe('');
  });

  it('drum: stays clean in every case, with no hole, noise or double space', () => {
    for (const patch of [{}, { Tbig: null, Tsmall: 23.05 }, { mu: null, Tsmall: 23.05 }, { wrap: null, Tsmall: 23.05 }, { wrap: 30, mu: 3 }, { wrap: 5, mu: 0.001 }, { wrap: 360, wrapUnit: 'deg' as const }]) {
      for (const lang of LANGS) {
        const { a, c, w } = read(drumForm(patch), lang);
        const t = drumReading(a, w, c);
        expect(t, JSON.stringify(patch)).not.toBe('');
        expect(t).not.toMatch(noise);
        expect(t).not.toMatch(/ {2}/);
      }
    }
  });

  it('sling: says what each leg pulls with and where the load point goes, drawn how much larger', () => {
    const { a, c, w } = read(defaultCase());
    expect(slingReading(a, w, c, true)).toBe('The legs pull with 1,155 lbf each. When the cable stretches, the load point moves 0.1124 in down (the dashed lines show it, drawn 133 times larger).');
    expect(slingReading(a, w, c, false)).toBe('The legs pull with 1,155 lbf each. When the cable stretches, the load point moves 0.1124 in down.');
    const es = read(defaultCase(), 'es');
    expect(slingReading(es.a, es.w, es.c, true)).toBe('Los ramales tiran con 1 155 lbf cada uno. Cuando el cable se alarga, el punto de carga se mueve 0.1124 in hacia abajo (las líneas discontinuas lo muestran, dibujado 133 veces mayor).');
  });

  it('sling: tells the legs apart when they differ, reads a single cable, a sideways move and a load that does not move', () => {
    const f = defaultCase();
    const unequal = read({ ...f, load: { ...f.load, leg1: { angle: 30, side: 'left', length: 8 }, leg2: { angle: 70, side: 'right', length: 12 } } });
    expect(slingReading(unequal.a, unequal.w, unequal.c, true)).toMatch(/^The legs pull with [\d,.]+ lbf \(leg 1\) and [\d,.]+ lbf \(leg 2\)\./);
    const one = read({ ...f, load: { ...f.load, legs: 1, H: 1500 } });
    expect(slingReading(one.a, one.w, one.c, true)).toMatch(/^The cable pulls with 2,500 lbf\. When the cable stretches, the load point moves [\d.]+ in down and [\d.]+ in to the (left|right) /);
    const still = read({ ...f, load: { ...f.load, W: 0 } });
    expect(slingReading(still.a, still.w, still.c, true)).toMatch(/The load point does not move\.$/);
    const bad = read({ ...f, load: { ...f.load, W: Number.NaN } });
    expect(slingReading(bad.a, bad.w, bad.c, true)).toBe('');
  });

  it('free body: says what the cable must pull with and what the surface and the friction do, in each case', () => {
    const { a, c, w } = read(pullForm({}));
    const [start, run] = a.pull!.regimes;
    expect(bodyReading(a, start, w, c)).toBe('To start the block moving, the cable must pull with 44.8 lbf at 30° above the surface; the surface pushes back with 77.6 lbf and friction is 38.8 lbf.');
    expect(bodyReading(a, run, w, c)).toBe('To keep the block moving at constant speed, the cable must pull with 37.52 lbf at 30° above the surface; the surface pushes back with 81.24 lbf and friction is 32.5 lbf.');
    const acc = read(pullForm({ accel: 3 }));
    expect(bodyReading(acc.a, acc.a.pull!.regimes[2], acc.w, acc.c)).toMatch(/^To speed the block up as asked, the cable must pull with [\d.]+ lbf at 30°/);
    const es = read(pullForm({}), 'es');
    expect(bodyReading(es.a, es.a.pull!.regimes[0], es.w, es.c)).toBe('Para poner el bloque en movimiento, el cable debe tirar con 44.8 lbf a 30° sobre la superficie; la superficie empuja con 77.6 lbf y la fricción es de 38.8 lbf.');
    // A case the cable cannot pull is read with the sentence of its status.
    const stays = read(pullForm({ travel: 'against', theta: 0, phi: 0 }));
    expect(bodyReading(stays.a, stays.a.pull!.regimes[1], stays.w, stays.c)).toContain('does not move this way on its own');
    expect(bodyReading(stays.a, null, stays.w, stays.c)).toBe('');
  });

  it('chart: says what the curves are, where the least tension is and what it takes at the chosen angle', () => {
    const { a, c, w } = read(pullForm({}));
    expect(curveReading(a, w, c)).toBe(
      'Each curve is the cable tension needed at each cable angle to start the block moving (solid line) and to keep it moving (dashed line). The least tension, marked with a diamond, is 44.72 lbf at 26.57° (to start it moving); 37.14 lbf at 21.8° (to keep it moving). At your angle, 30°, it takes 44.8 lbf (to start it moving); 37.52 lbf (to keep it moving).',
    );
    const acc = read(pullForm({ accel: 3 }));
    expect(curveReading(acc.a, acc.w, acc.c)).toMatch(/to start the block moving \(solid line\), to keep it moving \(dashed line\) and to speed it up \(dotted line\)\./);
    const es = read(pullForm({}), 'es');
    expect(curveReading(es.a, es.w, es.c)).toMatch(/^Cada curva es la tensión del cable que hace falta con cada ángulo para poner el bloque en movimiento \(línea continua\) y para mantenerlo en movimiento \(línea de trazos\)\. La tensión mínima, marcada con un rombo, es 44\.72 lbf con 26\.57° \(para ponerlo en movimiento\)/);
    const none = read(pullForm({ travel: 'against', theta: 0, muS: 0, muK: 0, phi: 0 }));
    expect(curveReading(none.a, none.w, none.c)).toMatch(/No cable angle pulls the block in this case\.$/);
    const d = drumForm({});
    expect(curveReading(read(d).a, cableUi.en, ctxOf(d))).toBe('');
  });
});
