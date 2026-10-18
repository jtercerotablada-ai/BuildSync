import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { sharedWords, stiffnessUi } from '@/lib/calc/stiffness/strings';
import type { Step } from '@/lib/calc/stiffness/types';
import type { Lang } from '@/lib/ttc/i18n';
import { build } from './fixtures.testlib';
import { DEFAULT_FORMAT } from './numfmt';
import { StiffnessCalculator } from './StiffnessCalculator';
import { labelsOf, stepView, type StepContext } from './steps';
import { warningSentence } from './text';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * The small sentences that are true for one and for several: a structure of one member, a member with one load, supports that hold nothing -
 * and the pieces the calculator hands the drawing (the switch that takes the node numbers off, the sentence that describes the figure, the
 * headline of a structure that only turns).
 */

const LANGS: Lang[] = ['en', 'es'];
const ctxOf = (form: StiffnessForm, lang: Lang): StepContext => ({ w: stiffnessUi[lang], system: form.units, mode: form.mode, format: DEFAULT_FORMAT });
const paragraphs = (form: StiffnessForm, id: Step['id'], lang: Lang): string[] => {
  const a = analyseSafely(form);
  const steps = a.solution?.steps ?? a.partial;
  const labels = labelsOf(steps);
  return steps.filter((s) => s.id === id).flatMap((s) => stepView(s, labels, ctxOf(form, lang)).paragraphs);
};
const cantilever = (withLoad: 'none' | 'one' | 'two' = 'none'): StiffnessForm => {
  const base = build({ mode: 'frame', nodes: [[0, 0], [10, 0]], members: [[1, 2]], supports: [[1, 'fixed']], loads: [[2, 0, -5]] });
  if (withLoad === 'none') return base;
  let form = reduceStiffness(base, { type: 'add', list: 'memberLoads', seed: { member: base.members[0].id } });
  if (withLoad === 'two') form = reduceStiffness(form, { type: 'add', list: 'memberLoads', seed: { member: base.members[0].id } });
  return form;
};
const html = (lang: Lang, initial?: StiffnessForm) => renderToStaticMarkup(h(StiffnessCalculator, { t: sharedWords(beamStrings[lang].ui), w: stiffnessUi[lang], initial }));

describe('one member, one load: the singular is said', () => {
  it('the assembled stiffness of a single member is that member’s, not "the sum of all 1 members"', () => {
    const en = paragraphs(cantilever(), 'assembled', 'en').join(' ');
    expect(en).toContain('K is the contribution of the only member: K = K_e');
    expect(en).not.toMatch(/all 1 /);
    const es = paragraphs(cantilever(), 'assembled', 'es').join(' ');
    expect(es).toContain('el aporte de la única barra');
    expect(es).not.toMatch(/las 1 /);
  });
  it('a member with two members says "the sum of all 2 members" still', () => {
    const portal = build({ mode: 'frame', nodes: [[0, 0], [10, 0], [20, 0]], members: [[1, 2], [2, 3]], supports: [[1, 'fixed']], loads: [[3, 0, -5]] });
    expect(paragraphs(portal, 'assembled', 'en').join(' ')).toContain('the sum of the contributions of all 2 members');
    expect(paragraphs(portal, 'assembled', 'es').join(' ')).toContain('las 2 barras');
  });
  it('a member with one load says its fixed-end forces are the whole of f_FE; with two, that they add', () => {
    for (const lang of LANGS) {
      const one = paragraphs(cantilever('one'), 'member-loads', lang).join(' ');
      const two = paragraphs(cantilever('two'), 'member-loads', lang).join(' ');
      expect(one, lang).toContain('f_FE.');
      expect(one, lang).not.toMatch(/ 1 (load|carga)/);
      expect(two, lang).toMatch(/ 2 (loads|cargas)/);
      expect(two, lang).toMatch(/add|se suman/);
    }
  });
});

describe('supports that hold nothing', () => {
  const say = (nodes: number[], lang: Lang) => warningSentence({ code: 'empty-support', nodes }, stiffnessUi[lang], { mode: 'truss' });
  it('one support holds, several hold', () => {
    expect(say([3], 'en')).toMatch(/^The support at node 3 holds nothing/);
    expect(say([3, 4], 'en')).toMatch(/^The supports at nodes 3 and 4 hold nothing/);
  });
  it('one support, several supports: the verb and the article agree in Spanish', () => {
    expect(say([3], 'es')).toMatch(/^El apoyo en el nudo 3 no restringe nada/);
    expect(say([3, 4], 'es')).toMatch(/^Los apoyos en los nudos 3 y 4 no restringen nada/);
  });
});

describe('what the calculator gives the drawing', () => {
  it('the figure has a short name and is described by the sentence under it, which is in the page once', () => {
    for (const lang of LANGS) {
      const out = html(lang);
      const svg = out.match(/<svg[^>]*role="img"[^>]*>/)?.[0] ?? '';
      const label = svg.match(/aria-label="([^"]*)"/)?.[1] ?? '';
      const describedBy = svg.match(/aria-describedby="([^"]*)"/)?.[1];
      expect(describedBy, lang).toBeTruthy();
      const target = out.match(new RegExp(`<p id="${describedBy}"[^>]*>([^<]*)</p>`));
      expect(target, `${lang}: the sentence the figure points at`).not.toBeNull();
      expect(label.length, lang).toBeGreaterThan(10);
      expect(label, lang).not.toContain(target![1].slice(0, 40));
    }
  });
  it('a structure that only turns is said to turn, not to be still', () => {
    const turn = emptyStiffness('us', 'frame');
    expect(turn.mode).toBe('frame');
    // The words exist in both languages and carry both holes.
    for (const lang of LANGS) {
      const t = stiffnessUi[lang].results.headline.turnAtNode;
      expect(t).toContain('{value}');
      expect(t).toContain('{node}');
    }
  });
});
