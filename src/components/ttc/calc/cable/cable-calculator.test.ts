import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Heavy by design (whole-tool renders of every mode, state and language): a loaded machine runs a full suite past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely } from '@/lib/calc/cable/analysis';
import { CABLE_KEY, MAX_LINK, convertCable, convertForceUnit, decodeCable, defaultCase, encodeCable, exampleOf, reduceCable, type CableForm } from '@/lib/calc/cable/model';
import { cableUi, sharedWords } from '@/lib/calc/cable/strings';
import type { Lang } from '@/lib/ttc/i18n';
import { CableCalculator } from './CableCalculator';

afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE CABLE CALCULATOR - the tool of /resources/cable, as the server sends it:
 * what a visitor sees before the script arrives, or without it.
 *
 * The arithmetic is held where it is done (lib/calc/cable). This is the
 * component: the three modes' forms and results cell by cell, every state of
 * the case (each problem on its row and in the box, each pull status), the units,
 * the two languages, and the shell's rules as they stand in its source.
 *
 * What only a browser can show - typing, the deferred solve, the radio choices
 * and the rope/material pairing, the address after the #, the printed sheet,
 * the phone's layout - is listed in the report that goes with this file.
 */

const LANGS: Lang[] = ['en', 'es'];
const SRC = resolve(__dirname, '..', '..', '..', '..');
const source = (file: string) => readFileSync(join(SRC, file), 'utf8').replace(/\r\n/g, '\n');

const text = (html: string) =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t\n\r\f\v]+/g, ' ')
    .replace(/ ,/g, ',')
    .trim();
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d|\{[a-z|]+\}/;

const show = (form: CableForm | undefined, lang: Lang = 'en') => renderToStaticMarkup(h(CableCalculator, { t: sharedWords(beamStrings[lang].ui), w: cableUi[lang], initial: form }));

const HEAD = /<span class="mp-cable__head" aria-hidden="true">(?:[^<]|<span class="mp-plot__unit">[^<]*<\/span>)*<\/span>/g;
const cardsOf = (html: string) => {
  const cards = html.split(/<div class="mp-app__card[^"]*">/).slice(1);
  const title = (c: string) => text(c.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '');
  return { titles: cards.map(title), of: (name: string) => cards.find((c) => title(c) === name) ?? '' };
};
const cells = (row: string) => [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1].replace(HEAD, '')));
const headOf = (card: string) => cells(card.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)?.[1] ?? '');
const rowsOf = (card: string) => [...(card.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => cells(r[1]));
const pairsOf = (card: string) => [...card.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]);
const issueList = (html: string) => [...(html.match(/<div class="mp-app__issues"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
/** The groups of the form. A group holds fieldsets of its own (the radio choices), so it runs to the next group, or to the actions. */
const groupsOf = (html: string) =>
  html
    .split('<fieldset class="mp-app__group')
    .slice(1)
    .map((part) => {
      const m = part.match(/^[^"]*"><legend>([\s\S]*?)<\/legend>([\s\S]*)$/)!;
      return { legend: text(m[1]), html: m[2].split('<div class="mp-app__actions"')[0] };
    });
const fieldsOf = (part: string) =>
  [...part.matchAll(/<label class="mp-num[^"]*"([^>]*)>([\s\S]*?)<\/label>/g)]
    .filter((m) => /<input\b/.test(m[2]))
    .map((m) => {
      const input = m[2].match(/<input\b[^>]*>/)?.[0] ?? '';
      return {
        label: text(m[2].match(/<span class="mp-num__label">([\s\S]*?)<\/span><span class="mp-num__box">/)?.[1] ?? ''),
        value: attr(input, 'value') ?? '',
        unit: text(m[2].match(/<span class="mp-num__unit">([\s\S]*?)<\/span>/)?.[1] ?? ''),
        invalid: attr(input, 'aria-invalid') === 'true',
        describedBy: attr(input, 'aria-describedby'),
      };
    });
const selectsOf = (part: string) =>
  [...part.matchAll(/<label class="mp-num mp-num--select[^"]*"[^>]*>([\s\S]*?)<\/label>/g)].map((m) => ({
    label: text(m[1].match(/<span class="mp-num__label">([\s\S]*?)<\/span>/)?.[1] ?? ''),
    chosen: text(m[1].match(/<option[^>]* selected=""[^>]*>([\s\S]*?)<\/option>/)?.[1] ?? ''),
    options: [...m[1].matchAll(/<option[^>]*>([\s\S]*?)<\/option>/g)].map((o) => text(o[1])),
  }));
const checkedRadios = (html: string) => [...html.matchAll(/<input type="radio" name="([^"]*)" checked=""\/><span>([\s\S]*?)<\/span>/g)].map((m) => [m[1], text(m[2])]);
const messageOf = (html: string, id: string | undefined) => text(html.match(new RegExp(`<p class="mp-app__row-error" id="${id}">([\\s\\S]*?)</p>`))?.[1] ?? '');
const label = (html: string) => attr(html.match(/<svg class="mp-plot__svg mp-cable-fig__svg[^"]*"[^>]*>/)![0], 'aria-label');

const withLoad = (patch: Partial<CableForm['load']>): CableForm => {
  const f = defaultCase();
  return { ...f, load: { ...f.load, ...patch } };
};
const withPull = (patch: Partial<CableForm['pull']>): CableForm => {
  const f = exampleOf('pull');
  return { ...f, pull: { ...f.pull, ...patch } };
};
const withDrum = (patch: Partial<CableForm['drum']>): CableForm => {
  const f = exampleOf('drum');
  return { ...f, drum: { ...f.drum, ...patch } };
};
const withSection = (patch: Partial<CableForm['section']>, base: CableForm = defaultCase()): CableForm => ({ ...base, section: { ...base.section, ...patch } });

describe('the example, as the server sends it: a load on a cable', () => {
  const html = show(undefined);

  it('opens on the sling of the hand answer, solved', () => {
    expect(issueList(html)).toEqual([]);
    expect(html).toContain('<section class="mp-app__out" aria-label="Results"');
    expect(checkedRadios(html).map((r) => r[1])).toEqual(expect.arrayContaining(['Load on a cable A weight on one cable or a two-leg sling', 'US (ft, in)', 'lbf', 'Two-leg sling', 'Diameter']));
    expect(pairsOf(html.match(/<dl class="mp-app__dl">[\s\S]*?<\/dl>/)![0])).toEqual([
      ['Tension in each leg', '1: 1,155 lbf · 2: 1,155 lbf'],
      ['Stress', '1: 23.52 ksi · 2: 23.52 ksi'],
      ['Total stretch', '1: +0.09734 in · 2: +0.09734 in'],
      ['The load point moves', '0.1124 in down'],
    ]);
  });

  it('puts the mode first in the form, then the units and the force unit, then the load, then the section, then the actions', () => {
    expect(html.indexOf('What to work out')).toBeLessThan(html.indexOf('>Units<'));
    expect(html.indexOf('>Units<')).toBeLessThan(html.indexOf('>Force unit<'));
    expect(groupsOf(html).map((g) => g.legend)).toEqual(['Load on the cable', 'Cable section and material']);
    for (const mode of ['Load on a cable', 'Pulling a load against friction', 'Cable over a drum']) expect(text(html)).toContain(mode);
    for (const label of ['Copy link to this case', 'Print', 'Start over']) expect(text(html)).toContain(label);
  });

  it('gives the weight, the horizontal force, the two legs and the section with the units shown', () => {
    const load = groupsOf(html)[0].html;
    expect(fieldsOf(load).map((f) => [f.label, f.value, f.unit])).toEqual([
      ['Weight, W', '2000', 'lbf'],
      ['Horizontal force, H', '0', 'lbf'],
      ['Angle from the horizontal', '60', '°'],
      ['Length', '10', 'ft'],
      ['Angle from the horizontal', '60', '°'],
      ['Length', '10', 'ft'],
    ]);
    expect(selectsOf(load).map((s) => [s.label, s.chosen])).toEqual([['Anchor on the', 'Left'], ['Anchor on the', 'Right']]);
    const section = groupsOf(html)[1].html;
    expect(fieldsOf(section).map((f) => [f.label, f.value, f.unit])).toEqual([
      ['Nominal diameter, d', '0.25', 'in'],
      ['Modulus, E', '29000', 'ksi'],
      ['Thermal coefficient, α', '6.5', '10^−6/°F'],
      ['Minimum breaking force, MBF (optional)', '', 'lbf'],
      ['Temperature change, ΔT', '0', '°F'],
      ['Design factor, n (optional)', '', ''],
      ['Allowable stress (optional)', '', 'ksi'],
    ]);
    expect(selectsOf(section).map((s) => [s.label, s.chosen])).toEqual([['Cable type', 'Solid round bar or rod'], ['Material', 'Steel']]);
    expect(text(section)).toContain('Area worked out: A = 0.049087 in².');
  });

  it('prints the numbers of the hand answer: 1,154.70 lbf, 23.52 ksi, 8.1115e-4, 0.09734 in, a drop of 0.1124 in', () => {
    const legs = cardsOf(html).of('Tension, stress and stretch');
    expect(headOf(legs)).toEqual(['Leg', 'Angle (°)', 'Tension, T (lbf)', 'Stress, σ (ksi)', 'Strain, ε', 'Elastic stretch (in)', 'Thermal stretch (free) (in)', 'Total stretch (in)', 'Length after (ft)']);
    expect(rowsOf(legs)).toEqual([
      ['Leg 1', '60', '1,155', '23.52', '0.0008112', '0.09734', '0', '+0.09734', '10.01'],
      ['Leg 2', '60', '1,155', '23.52', '0.0008112', '0.09734', '0', '+0.09734', '10.01'],
    ]);
    const move = cardsOf(html).of('Where the load point goes');
    expect(headOf(move)).toEqual(['Method', 'Horizontal (in)', 'Vertical (in)', 'Size (in)']);
    expect(rowsOf(move).slice(0, 2)).toEqual([
      ['Linear (usual hand method)', '0', '−0.1124', '0.1124'],
      ['Exact (stretched legs)', '0', '−0.1124', '0.1124'],
    ]);
    expect(rowsOf(move)[2][0]).toBe('Difference');
    const second = cardsOf(html).of('Tensions after the geometry changes');
    expect(rowsOf(second)[0].slice(0, 3)).toEqual(['Leg 1', '1,155', '1,154']);
  });

  it('says what a breaking force and a design factor ask once they are given, and the restrained force once ΔT is', () => {
    expect(text(cardsOf(html).of('Breaking force and size'))).toContain('Give the minimum breaking force, a design factor or an allowable stress');
    expect(cardsOf(html).titles).not.toContain('Temperature change with the ends held');
    const f = withSection({ mbf: 5000 });
    const form = { ...f, n: 3, allowable: 20, dT: -40 };
    const out = show(form);
    const size = cardsOf(out).of('Breaking force and size');
    expect(headOf(size)).toEqual(['Leg', 'MBF ÷ T', 'MBF ÷ combined T', 'MBF that n × T asks for (lbf)', 'Area T asks for (in²)', 'Smallest solid round bar (in)']);
    const a = analyseSafely(form).load!;
    expect(rowsOf(size)[0][1]).toBe(String(Number(a.legs[0].mbfRatio!.toPrecision(4))).replace(/^(\d)(\d{3})\./, '$1,$2.'));
    expect(rowsOf(size)[0][3]).toBe('3,464');
    const held = cardsOf(out).of('Temperature change with the ends held');
    expect(headOf(held)).toEqual(['Leg', 'Force if the ends cannot move (lbf)', 'Stress (ksi)', 'Load tension plus that force (lbf)', 'Combined stress (ksi)', 'State']);
    // A fall of 40 °F with the ends held: E·A·α·ΔT = 29,000 × 0.049087 × 6.5e-6 × 40 ksi·in² = 370.1 lbf of tension.
    expect(rowsOf(held)[0][1]).toBe('+370.1');
    expect(rowsOf(held)[0][5]).toBe('Taut');
    // …and a rise puts it into compression: the cable goes slack, and the page says so.
    const hot = show({ ...form, dT: 200 });
    expect(rowsOf(cardsOf(hot).of('Temperature change with the ends held'))[0][5]).toBe('Slack');
    expect(text(hot)).toContain('In leg 1 the load’s tension plus the thermal force is negative');
  });

  it('checks the equilibrium and ends with the privacy line and the one sentence that says it gives no verdict', () => {
    expect(text(cardsOf(html).of('Equilibrium check'))).toContain('Balanced: the tensions hold the loads.');
    expect(html).toContain(beamStrings.en.ui.results.privacy);
    expect(html.match(new RegExp(cableUi.en.notes.noVerdict.slice(0, 40), 'g'))).toHaveLength(1);
  });

  it('describes the drawing in a sentence a screen reader can use, and prints nothing noisy', () => {
    expect(label(html)).toContain('Sling drawing. Load 2,000 lbf. Leg 1 makes 60° with the horizontal');
    for (const lang of LANGS) {
      const t = text(show(undefined, lang));
      expect(t).not.toMatch(noise);
    }
  });

  it('has a head to every column, every row of the numbers headed, and no table without one', () => {
    for (const table of html.match(/<table\b[\s\S]*?<\/table>/g)!) {
      expect(table).toMatch(/<thead>/);
      expect(table.match(/<th scope="col">/g)!.length).toBeGreaterThanOrEqual(3);
      for (const row of table.match(/<tbody>[\s\S]*<\/tbody>/)![0].match(/<tr\b[\s\S]*?<\/tr>/g)!) expect(row).toMatch(/^<tr[^>]*><th scope="row">/);
    }
  });
});

describe('the sling in its other forms', () => {
  it('one cable hangs along the resultant, and says what angle it came out at', () => {
    const html = show(withLoad({ legs: 1, H: 1500 }));
    expect(text(html)).toContain('It comes out at 53.13° from the horizontal, anchored to the left.');
    expect(rowsOf(cardsOf(html).of('Tension, stress and stretch'))[0].slice(0, 3)).toEqual(['Cable', '53.13', '2,500']);
    expect(cardsOf(html).titles).not.toContain('Tensions after the geometry changes');
    expect(groupsOf(html)[0].html).not.toContain('Leg 2');
    expect(fieldsOf(groupsOf(html)[0].html).map((f) => f.label)).toEqual(['Weight, W', 'Horizontal force, H', 'Length']);
  });

  it('a horizontal force moves the load point sideways, and the sentence says which way', () => {
    const html = show(withLoad({ H: 600 }));
    expect(pairsOf(html.match(/<dl class="mp-app__dl">[\s\S]*?<\/dl>/)![0])[3][1]).toMatch(/^[\d.]+ in down and [\d.]+ in to the (left|right)$/);
    expect(label(html)).toContain('with a horizontal force of 600 lbf to the right');
  });

  it('unequal legs with a section of their own for leg 2 print each its own stress', () => {
    const f = defaultCase();
    const form: CableForm = { ...f, load: { ...f.load, own2: { ...f.section, d: 0.5 } } };
    const html = show(form);
    const rows = rowsOf(cardsOf(html).of('Tension, stress and stretch'));
    // A quarter of the stress in the leg whose diameter is doubled.
    expect(Number(rows[0][3])).toBeCloseTo(Number(rows[1][3]) * 4, 1);
    const g = groupsOf(html);
    expect(g.map((x) => x.legend)).toEqual(['Load on the cable', 'Leg 2: section and material', 'Cable section and material']);
    expect(text(html)).toContain('Leg 1 uses the section below. Leg 2 uses this one.');
    expect(html).toMatch(/type="checkbox" checked=""\/><span>Leg 2 has a section and material of its own/);
  });

  it('a rope prints the typical-values line and says plainly that its modulus is about half of steel’s', () => {
    const rope = reduceCable(reduceCable(defaultCase(), { type: 'rope', rope: 'rope-6x19' }), { type: 'material', material: 'rope' });
    const html = show(rope);
    expect(text(html)).toContain('Typical values: use the manufacturer’s.');
    expect(text(html)).toContain('A wire rope’s effective modulus is about half of steel’s (13,000 ksi against 29,000 ksi)');
    expect(text(html)).toContain('constructional');
    expect(fieldsOf(groupsOf(html)[1].html).map((f) => f.label)).toContain('Area factor, A ÷ d²');
    expect(text(show(defaultCase()))).not.toContain('Typical values');
    expect(text(show(rope, 'es'))).toContain('Valores típicos: use los del fabricante.');
    expect(text(show(rope, 'es'))).toContain('cerca de la mitad del acero');
    // A rope stretches more than twice as far as the same area of steel.
    const steel = analyseSafely(withSection({ by: 'area', A: 0.1 })).load!.legs[0].elastic!;
    const wire = analyseSafely(withSection({ by: 'area', A: 0.1, material: 'rope', E: 13000, rope: 'rope-6x19', factor: 0.4 })).load!.legs[0].elastic!;
    expect(wire / steel).toBeCloseTo(29000 / 13000, 6);
  });

  it('shows the area factor of a rope given by its area, the area a diameter comes to, and a custom one', () => {
    const byArea = show(withSection({ by: 'area', A: 0.2 }));
    expect(fieldsOf(groupsOf(byArea)[1].html)[0]).toMatchObject({ label: 'Metallic area, A', value: '0.2', unit: 'in²' });
    expect(text(byArea)).not.toContain('Area worked out');
    const custom = show(withSection({ rope: 'custom', factor: 0.5, d: 1 }));
    expect(text(custom)).toContain('Area worked out: A = 0.5 in².');
  });
});

describe('pulling a load against friction', () => {
  const form = exampleOf('pull');
  const html = show(form);

  it('opens on the crate of the hand answer: 37.52 lbf to keep it going and 44.80 to start it', () => {
    expect(checkedRadios(html)[0]).toEqual(['cable-mode', 'Pulling a load against friction A cable dragging a block over a surface']);
    expect(groupsOf(html).map((g) => g.legend)).toEqual(['Block, surface and cable', 'Cable section and material']);
    expect(pairsOf(html.match(/<dl class="mp-app__dl">[\s\S]*?<\/dl>/)![0])).toEqual([
      ['Greatest tension asked of the cable', '44.8 lbf (To start it moving)'],
      ['To start it moving', '44.8 lbf'],
      ['To keep it moving', '37.52 lbf'],
      ['Best cable angle', '+26.57° → 44.72 lbf'],
    ]);
    const matrix = cardsOf(html).of('The three cases');
    expect(headOf(matrix)).toEqual(['Quantity', 'To start it moving', 'To keep it moving']);
    const rows = Object.fromEntries(rowsOf(matrix).map((r) => [r[0], r.slice(1)]));
    expect(rows['Result']).toEqual(['Pull', 'Pull']);
    expect(rows['Cable tension, T (lbf)']).toEqual(['44.8', '37.52']);
    expect(rows['Normal force, N (lbf)']).toEqual(['+77.6', '+81.24']);
    expect(rows['Friction force, F (lbf)']).toEqual(['38.8', '32.5']);
    expect(rows['Best cable angle, φ* (°)']).toEqual(['+26.57', '+21.8']);
    expect(rows['Least tension, at φ* (lbf)']).toEqual(['44.72', '37.14']);
    expect(rows['Cable angle at which the block lifts off (°)']).toEqual(['90', '90']);
  });

  it('says what happens in each case, and gives the cable its stress under the greatest tension', () => {
    expect(text(cardsOf(html).of('What happens'))).toContain('To keep it moving: the cable carries 37.52 lbf. The surface pushes back with 81.24 lbf and friction is 32.5 lbf.');
    const cable = cardsOf(html).of('The cable under the greatest tension');
    expect(text(cable)).toContain('Governing case: To start it moving');
    // 44.80 lbf over 0.049087 in²: 0.9127 ksi; the stretch of 20 ft: 44.80 × 240 / (0.049087 × 29e6) = 0.007553 in.
    expect(pairsOf(cable).slice(0, 2)).toEqual([['Tension, T', '44.8 lbf'], ['Stress, σ', '0.9127 ksi']]);
    expect(pairsOf(cable).find((p) => p[0] === 'Elastic stretch')).toEqual(['Elastic stretch', '0.007553 in']);
  });

  it('draws the free body and the chart, with their words and a table of the curve', () => {
    expect(html).toContain('Free body of');
    expect(html.match(/<svg class="mp-plot__svg mp-cable-fig__svg[^"]*"/g)).toHaveLength(2);
    expect(html).toContain('Free body of To start it moving');
    expect(html).toContain('Chart of cable tension against cable angle from −90° to 90°');
    const table = cardsOf(html).of('Cable tension against cable angle (table)');
    expect(headOf(table)).toEqual(['Cable angle, φ (°)', 'To start it moving (lbf)', 'To keep it moving (lbf)']);
    const rows = rowsOf(table);
    expect(rows).toHaveLength(19);
    expect(rows[0]).toEqual(['−90', '—', '—']);
    expect(rows[12]).toEqual(['+30', '44.8', '37.52']);
    expect(rows[18]).toEqual(['+90', '100', '100']);
    expect(html).toContain('mp-cable__curve-table');
  });

  it('adds a third case, with its own curve and its own free body, when there is an acceleration', () => {
    const out = show(withPull({ accel: 3 }));
    expect(headOf(cardsOf(out).of('The three cases'))).toEqual(['Quantity', 'To start it moving', 'To keep it moving', 'Accelerating']);
    expect(rowsOf(cardsOf(out).of('Cable tension against cable angle (table)'))[0]).toHaveLength(4);
    expect(out).toContain('data-regime="accel"');
    expect(out).toContain('Free body of');
  });

  it('gives the block by its mass and turns it into a weight', () => {
    const f = exampleOf('pull');
    const mass = { ...f, pull: { ...f.pull, massInput: true, W: 100 / 4.4482216152605 / 2.2046226218 * 2.2046226218 } };
    const out = show(mass);
    expect(fieldsOf(groupsOf(out)[0].html)[0]).toMatchObject({ label: 'Mass, m', unit: 'lb' });
    expect(fieldsOf(groupsOf(out)[0].html).find((x) => x.label === 'Slope angle, θ')?.unit).toBe('°');
    expect(checkedRadios(out).map((r) => r[1])).toContain('Mass');
  });

  it('says a status for every state the block can be in, and why, in both languages', () => {
    const cases: [string, CableForm, RegExp, RegExp][] = [
      ['slides-on-its-own', withPull({ theta: -30, muS: 0.2, muK: 0.1, phi: 0 }), /gravity along the slope beats friction.*holds it with 41\.34 lbf/, /la gravedad a lo largo de la pendiente vence a la fricción.*lo retiene con 41\.34 lbf/],
      ['stays-put', withPull({ travel: 'against', theta: 0, phi: 0 }), /does not move this way on its own.*a push, which a cable cannot give/, /no se mueve así por sí solo.*un empuje/],
      ['self-locking', withPull({ muS: 1, muK: 1, phi: -80 }), /the harder the cable pulls the harder friction grips/, /cuanto más tira el cable más agarra la fricción/],
      ['leaves-surface', withPull({ theta: 60, muS: 0.5, muK: 0.5, phi: 60 }), /would lift the block off the surface.*This case is refused\. Lift-off begins at a cable angle of 30°\./, /levantaría el bloque de la superficie.*Este caso se rechaza\. El bloque empieza a levantarse con un ángulo del cable de 30°\./],
    ];
    for (const [status, f, en, es] of cases) {
      const a = analyseSafely(f).pull!;
      expect(a.regimes.some((r) => r.status === status), status).toBe(true);
      expect(text(cardsOf(show(f)).of('What happens')), status).toMatch(en);
      expect(text(cardsOf(show(f, 'es')).of('Qué ocurre')), status).toMatch(es);
    }
  });

  it('a case in which no cable can pull the block says so in the numbers, the headline and the drawings', () => {
    const f = withPull({ travel: 'against', theta: 0, muS: 0, muK: 0, phi: 0 });
    const out = show(f);
    expect(analyseSafely(f).pull!.governing).toBeNull();
    expect(text(out)).toContain('No cable tension moves the block at this angle');
    expect(text(cardsOf(out).of('The cable under the greatest tension'))).toContain('No case has a cable that can pull the block');
    expect(text(out)).toContain('To note');
    expect(out).toContain('only the weight is drawn');
    expect(text(out)).not.toMatch(noise);
  });

  it('warns of a kinetic friction above the static one, and keeps the case solved', () => {
    const out = show(withPull({ muS: 0.3, muK: 0.45 }));
    expect(text(out)).toContain('The kinetic friction 0.45 is above the static friction 0.3, which is unusual: check both.');
    expect(cardsOf(out).titles).toContain('The three cases');
  });

  it('keeps the numbers of the pull when the cable’s own are missing, and ties the fault to its field', () => {
    const f = withSection({ d: null }, exampleOf('pull'));
    const out = show(f);
    expect(issueList(out)).toEqual([]);
    expect(cardsOf(out).titles).toContain('The three cases');
    expect(text(out)).toContain('The cable’s numbers cannot be shown yet');
    expect(text(out)).toContain('Cable section: The diameter is empty or is not a number.');
    const section = groupsOf(out).find((g) => g.legend === 'Cable section and material')!;
    const bad = fieldsOf(section.html).find((x) => x.invalid)!;
    expect(bad.label).toBe('Nominal diameter, d');
    expect(messageOf(section.html, bad.describedBy)).toBe('The diameter is empty or is not a number.');
    expect(text(cardsOf(out).of('The cable under the greatest tension'))).toContain('The cable’s own numbers are missing');
  });
});

describe('a cable round a drum', () => {
  const html = show(exampleOf('drum'));

  it('opens on 1,000 lbf held by two turns at μ 0.3: the ratio 43.38, 23.05 lbf in the hand, 976.9 lbf on the drum', () => {
    expect(groupsOf(html).map((g) => g.legend)).toEqual(['Cable round a drum', 'Cable section and material']);
    expect(pairsOf(html.match(/<dl class="mp-app__dl">[\s\S]*?<\/dl>/)![0])).toEqual([
      ['Found: the small tension', '23.05 lbf'],
      ['Tension ratio, e^(μβ)', '43.38'],
      ['Held by', '23.05 lbf'],
      ['Force on the drum', '976.9 lbf'],
    ]);
    const card = cardsOf(html).of('The drum');
    expect(Object.fromEntries(pairsOf(card))).toMatchObject({
      'Large tension, T big': '1,000 lbf',
      'Small tension, T small': '23.05 lbf · found',
      'Friction coefficient, μ': '0.3',
      'Wrap angle, β': '720°',
      'Wrap in turns': '2',
      'Ratio, T big ÷ T small = e^(μβ)': '43.38',
      'Force on the drum': '976.9 lbf',
    });
    expect(text(card)).toContain('The small tension was the empty one.');
    expect(label(html)).toContain('A cable wrapped 720° (2 turns) round a drum: 1,000 lbf on the large side, 23.05 lbf on the small side, ratio 43.38.');
  });

  it('shows the blank field empty and says which one is found, and the stress at the large tension', () => {
    const drum = groupsOf(html)[0].html;
    const f = fieldsOf(drum);
    expect(f.map((x) => [x.label, x.value])).toEqual([
      ['Large tension, T big (empty: found)', '1000'],
      ['Small tension, T small (empty: found)', ''],
      ['Friction coefficient, μ (empty: found)', '0.3'],
      ['Wrap angle, β (empty: found)', '2'],
    ]);
    expect(f[3].unit).toBe('turns');
    expect(text(drum)).toContain('The empty one is the small tension.');
    const cable = cardsOf(html).of('The cable under the large tension');
    expect(pairsOf(cable).slice(0, 2)).toEqual([['Tension, T', '1,000 lbf'], ['Stress, σ', '20.37 ksi']]);
    expect(text(cable)).toContain('The stretch needs a cable length');
  });

  it('finds any of the four: the large tension, μ and the wrap', () => {
    const big = show(withDrum({ Tbig: null, Tsmall: 23.05 }));
    expect(pairsOf(big.match(/<dl class="mp-app__dl">[\s\S]*?<\/dl>/)![0])[0][0]).toBe('Found: the large tension');
    const mu = analyseSafely(withDrum({ mu: null, Tsmall: 23.05 })).drum!;
    expect(mu.mu).toBeCloseTo(0.3, 3);
    expect(text(show(withDrum({ mu: null, Tsmall: 23.05 })))).toContain('Found: the friction coefficient');
    const wrap = show(withDrum({ wrap: null, Tsmall: 23.05, wrapUnit: 'deg' }));
    expect(pairsOf(wrap.match(/<dl class="mp-app__dl">[\s\S]*?<\/dl>/)![0])[0]).toEqual(['Found: the wrap angle', '720° (2 turns)']);
  });

  it('warns of no friction and of no wrap, and has no force to draw where the tensions cancel', () => {
    expect(text(show(withDrum({ mu: 0, Tsmall: null })))).toContain('The friction coefficient is zero, so the ratio is 1 and both tensions are equal.');
    expect(text(show(withDrum({ wrap: 0, Tsmall: null })))).toContain('The wrap is zero, so the ratio is 1');
  });
});

describe('every problem, on its row and in the box', () => {
  const f = defaultCase();
  const PROBLEMS: { name: string; code: string; form: CableForm; en: RegExp; es: RegExp; field?: string; row?: string }[] = [
    { name: 'a weight that is not a number', code: 'number', form: withLoad({ W: Number.NaN }), en: /^Load: The weight is empty or is not a number\.$/, es: /^Carga: El peso no es un número, o falta\.$/, field: 'Weight, W' },
    { name: 'a leg at 120°', code: 'range', form: withLoad({ leg1: { ...f.load.leg1, angle: 120 } }), en: /^Leg 1: The angle must be between 0 and 90°\.$/, es: /^Ramal 1: El ángulo debe ser un valor entre 0 y 90°\.$/, field: 'Angle from the horizontal' },
    { name: 'a length of zero', code: 'range', form: withLoad({ leg2: { ...f.load.leg2, length: 0 } }), en: /^Leg 2: The length must be above 0 ft\.$/, es: /^Ramal 2: La longitud debe ser mayor que 0 ft\.$/, field: 'Length' },
    { name: 'two legs on one line', code: 'parallel-legs', form: withLoad({ leg1: { ...f.load.leg1, angle: 90 }, leg2: { ...f.load.leg2, angle: 90 } }), en: /on one line \(the angle between them is 0°\)/, es: /en una misma recta/ },
    { name: 'a leg that would have to push', code: 'slack-leg', form: withLoad({ leg1: { angle: 30, side: 'left', length: 10 }, leg2: { angle: 70, side: 'left', length: 10 } }), en: /would need leg \d to push, with [\d.,]+ lbf, and a cable cannot push/, es: /exigiría que el ramal \d empujara/ },
    { name: 'a modulus of zero', code: 'range', form: withSection({ E: 0 }), en: /^Cable section: The modulus \(E\) must be above 0 ksi\.$/, es: /^Sección del cable: El módulo \(E\) debe ser mayor que 0 ksi\.$/, field: 'Modulus, E' },
    { name: 'a negative design factor', code: 'range', form: { ...defaultCase(), n: -2 }, en: /^Design values: The design factor must be above 0\.$/, es: /^Valores de diseño: El factor de diseño debe ser mayor que 0\.$/, field: 'Design factor, n (optional)' },
    { name: 'a leg 2 section with no diameter', code: 'number', form: { ...f, load: { ...f.load, own2: { ...f.section, d: null } } }, en: /^Leg 2 section: The diameter is empty or is not a number\.$/, es: /^Sección del ramal 2: El diámetro no es un número, o falta\.$/, field: 'Nominal diameter, d' },
    { name: 'a slope of 80°', code: 'range', form: withPull({ theta: 80 }), en: /^Block and cable: The slope angle must be between -30 and 60°\.$/, es: /^Bloque y cable: El ángulo de la pendiente debe ser un valor entre -30 y 60°\.$/, field: 'Slope angle, θ' },
    { name: 'a friction that is not a number', code: 'number', form: withPull({ muS: Number.NaN }), en: /^Block and cable: The static friction is empty or is not a number\.$/, es: /^Bloque y cable: La fricción estática no es un número, o falta\.$/, field: 'Static friction, μs' },
    { name: 'two drum quantities empty', code: 'underdetermined', form: withDrum({ mu: null }), en: /^2 of the four quantities are empty\./, es: /^2 de las cuatro cantidades están vacías\./ },
    { name: 'no drum quantity empty', code: 'overdetermined', form: withDrum({ Tsmall: 23 }), en: /^All four quantities are filled in/, es: /^Las cuatro cantidades están llenas/ },
    { name: 'the large tension below the small', code: 'order', form: withDrum({ Tbig: 10, Tsmall: 20, mu: null }), en: /^The large tension, 10 lbf, is below the small one, 20 lbf\./, es: /^La tensión mayor, 10 lbf, es menor que la menor, 20 lbf\./ },
    { name: 'a wrap of zero with μ to find', code: 'degenerate', form: withDrum({ wrap: 0, mu: null, Tsmall: 500 }), en: /^Drum: The friction coefficient cannot be found when the wrap is zero/, es: /^Tambor: El coeficiente de fricción no se puede hallar cuando el ángulo de envolvimiento es cero/ },
    { name: 'μβ past 700', code: 'overflow', form: withDrum({ mu: 50, wrap: 10, Tsmall: 1, Tbig: null }), en: /^μβ is 3,140, which is past 700/, es: /^μβ vale 3 140, más de 700/ },
    { name: 'a negative friction coefficient', code: 'range', form: withDrum({ mu: -1 }), en: /^Drum: The friction coefficient must be between 0 and 100\.$/, es: /^Tambor: El coeficiente de fricción debe ser un valor entre 0 y 100\.$/, field: 'Friction coefficient, μ (empty: found)' },
  ];

  for (const p of PROBLEMS) {
    it(`${p.name}: ${p.code}`, () => {
      const a = analyseSafely(p.form);
      expect(a.issues.map((i) => i.code), 'the analysis reports the code').toContain(p.code);
      const html = show(p.form);
      const box = issueList(html);
      expect(box.filter((line) => p.en.test(line)), box.join(' | ')).toHaveLength(1);
      expect(text(html.match(/<p class="mp-app__issues-title">([\s\S]*?)<\/p>/)![1])).toBe('This case cannot be solved yet');
      // Nothing is solved: no cards of numbers, and the drawing says so.
      expect(cardsOf(html).titles).toEqual([]);
      expect(text(html)).toContain(cableUi.en.results.waiting);
      expect(label(html)).toMatch(/not solved yet|Chart: not solved yet/);
      expect(text(html)).not.toMatch(noise);
      // The field at fault is marked, and its message, in the group it is in, is tied to it.
      if (p.field) {
        const group = groupsOf(html).find((g) => fieldsOf(g.html).some((x) => x.invalid && x.label === p.field))!;
        expect(group, `${p.field} is marked`).toBeTruthy();
        const bad = fieldsOf(group.html).filter((x) => x.invalid);
        const ids = new Set(bad.map((x) => x.describedBy));
        expect(ids.size).toBe(1);
        expect(messageOf(group.html, [...ids][0])).not.toBe('');
      }
      // The Spanish page says the same, in Spanish, with no hole left.
      const es = show(p.form, 'es');
      const lines = issueList(es);
      expect(lines.filter((line) => p.es.test(line)), lines.join(' | ')).toHaveLength(1);
      for (const line of lines) {
        expect(line).not.toMatch(/[{}]/);
        expect(line).not.toMatch(/\b(the|and|must|is|cannot)\b/);
      }
      expect(text(es.match(/<p class="mp-app__issues-title">([\s\S]*?)<\/p>/)![1])).toBe('Este caso todavía no se puede resolver');
    });
  }

  it('marks the legs’ fields of a sling that cannot be told apart, all under one message', () => {
    const html = show(PROBLEMS[3].form);
    const legs = groupsOf(html)[0].html;
    const bad = fieldsOf(legs).filter((x) => x.invalid);
    expect(bad.length).toBeGreaterThanOrEqual(2);
    expect(new Set(bad.map((x) => x.describedBy)).size).toBe(1);
    expect(messageOf(legs, bad[0].describedBy)).toMatch(/on one line/);
  });

  it('says every problem once in the box, even when two rows have it', () => {
    const f2 = withLoad({ leg1: { ...f.load.leg1, angle: Number.NaN }, leg2: { ...f.load.leg2, angle: Number.NaN } });
    expect(issueList(show(f2))).toEqual(['Leg 1: The angle is empty or is not a number.', 'Leg 2: The angle is empty or is not a number.']);
  });

  it('never leaves the drawing blank: an unsolved case still has its drawings, empty, with a name', () => {
    for (const p of PROBLEMS.slice(0, 3)) {
      const out = show(p.form);
      expect(out).toContain('<svg class="mp-plot__svg mp-cable-fig__svg"');
      expect(label(out)).toContain('Sling drawing: the legs as entered, not solved yet');
    }
  });
});

describe('the units', () => {
  it('prints the sling in newtons and millimetres, in the unit shown, with the same numbers', () => {
    const si = convertCable(defaultCase(), 'si');
    const html = show(si);
    expect(headOf(cardsOf(html).of('Tension, stress and stretch'))).toEqual(['Leg', 'Angle (°)', 'Tension, T (N)', 'Stress, σ (MPa)', 'Strain, ε', 'Elastic stretch (mm)', 'Thermal stretch (free) (mm)', 'Total stretch (mm)', 'Length after (m)']);
    const row = rowsOf(cardsOf(html).of('Tension, stress and stretch'))[0];
    // 2,000 lbf is 8,896 N: 4,448 N in each leg at 60°, a hair under 1,154.7 lbf × 4.4482.
    expect(Number(row[2].replace(/,/g, ''))).toBeCloseTo(1154.7 * 4.4482216152605, -1);
    expect(Number(row[5])).toBeCloseTo(0.09734 * 25.4, 2);
    expect(text(html)).toContain('SI (m, mm)');
    expect(fieldsOf(groupsOf(html)[1].html).map((f) => f.unit).slice(0, 3)).toEqual(['mm', 'GPa', '10^−6/°C']);
    expect(text(html).replace(/US \(ft, in\)/, '')).not.toMatch(/\bkip\b|\bksi\b|\bft\b|\blbf\b|\bin²/);
    expect(text(html)).not.toMatch(noise);
  });

  it('prints kips and kilonewtons when the force unit is the large one, with the same stress', () => {
    const big = convertForceUnit(defaultCase(), 'large');
    const html = show(big);
    expect(rowsOf(cardsOf(html).of('Tension, stress and stretch'))[0].slice(2, 4)).toEqual(['1.155', '23.52']);
    expect(fieldsOf(groupsOf(html)[0].html)[0]).toMatchObject({ value: '2', unit: 'kip' });
    const kn = show(convertForceUnit(convertCable(defaultCase(), 'si'), 'large'));
    expect(headOf(cardsOf(kn).of('Tension, stress and stretch'))[2]).toBe('Tension, T (kN)');
  });

  it('comes back to the same printed numbers after a round trip through the other system, in every mode', () => {
    for (const mode of ['load', 'pull', 'drum'] as const) {
      const f = exampleOf(mode);
      const back = convertCable(convertCable(f, 'si'), 'us');
      for (const lang of LANGS) {
        const a = cardsOf(show(f, lang));
        const b = cardsOf(show(back, lang));
        expect(b.titles).toEqual(a.titles);
        for (const title of a.titles) {
          if (title.includes('(table)') || title.includes('(tabla)')) continue;
          expect(rowsOf(b.of(title)), `${mode} ${title}`).toEqual(rowsOf(a.of(title)));
          expect(pairsOf(b.of(title)), `${mode} ${title}`).toEqual(pairsOf(a.of(title)));
        }
      }
    }
  });
});

describe('the two languages', () => {
  it('writes the whole tool in Spanish, with the decimals as a point and the thousands set apart by a narrow space', () => {
    for (const mode of ['load', 'pull', 'drum'] as const) {
      const html = show(exampleOf(mode), 'es');
      const t = text(html);
      expect(t).not.toMatch(noise);
      expect(t).not.toMatch(/\b(the|and|with|Tension|Leg|Weight|Results)\b/);
      expect(html).toContain('<section class="mp-app__out" aria-label="Resultados"');
    }
    const es = show(undefined, 'es');
    expect(text(es)).toContain('1 155 lbf');
    expect(rowsOf(cardsOf(es).of('Tensión, esfuerzo y alargamiento'))[0].slice(0, 4)).toEqual(['Ramal 1', '60', '1 155', '23.52']);
    expect(text(es)).toContain('Son solo números: sin veredicto ni verificación de diseño.');
    expect(text(show(exampleOf('drum'), 'es'))).toContain('Hallado: la tensión menor');
    expect(text(show(exampleOf('pull'), 'es'))).toContain('Mayor tensión que se le pide al cable');
  });

  it('puts a label on every field and a name on every list, with no empty description', () => {
    for (const lang of LANGS) {
      for (const mode of ['load', 'pull', 'drum'] as const) {
        const out = show(exampleOf(mode), lang);
        const labels = [...out.matchAll(/<label class="mp-num[^"]*"[^>]*>([\s\S]*?)<\/label>/g)];
        expect(labels.length).toBeGreaterThan(8);
        for (const l of labels) expect(text(l[1].match(/<span class="mp-num__label">([\s\S]*?)<\/span><span class="mp-num__box">/)?.[1] ?? '')).not.toBe('');
        expect(out).not.toMatch(/aria-describedby=""/);
        for (const radio of out.matchAll(/<fieldset class="mp-seg[^"]*"><legend class="mp-num__label">([^<]+)<\/legend>/g)) expect(radio[1].trim()).not.toBe('');
      }
    }
  });
});

describe('the address, at component level', () => {
  const src = source('components/ttc/calc/cable/CableCalculator.tsx');

  it('is written for this calculator’s key, read from the page’s address, and the example leaves it bare', () => {
    expect(CABLE_KEY).toBe('k');
    expect(src).toMatch(/useAddress<CableForm>\(\{\s*key: CABLE_KEY,\s*example: EXAMPLE,/);
    expect(src).toContain('const EXAMPLE = encodeCable(defaultCase());');
    expect(src).toContain('address.take(EXAMPLE)');
    expect(src).toContain('new RegExp(`^#${CABLE_KEY}=(.*)$`)');
    expect(src).toContain('return decodeCable(text);');
    expect(src).toMatch(/blank: defaultCase,/);
  });

  it('leaves the field with the focus FIRST when a case arrives, then loads it, whole', () => {
    const open = src.slice(src.indexOf('open: (found) =>'), src.indexOf('const { linkError }'));
    expect(open.indexOf('focused.blur()')).toBeGreaterThan(-1);
    expect(open.indexOf('focused.blur()')).toBeLessThan(open.indexOf("dispatch({ type: 'load', form: found })"));
    expect(open).toContain('root.current?.contains(focused)');
    expect(open).toContain('setWhole(found)');
  });

  it('solves a case opened whole in the render that shows it, and defers only the typing of numbers', () => {
    expect(src).toContain('const behind = useDeferredValue(form);');
    expect(src).toMatch(/const solved = onPaper \|\| form === whole \|\| choicesOf\(behind\) !== choicesOf\(form\) \? form : behind;/);
    expect(src).toContain("typeof value === 'number' ? 0 : value");
  });

  it('brings the address to the case on screen before copying, and before Start over throws one away', () => {
    expect(src).toMatch(/address\.take\(encodeCable\(form\)\);\s*return address\.link\(encodeCable\(form\)\);/);
    expect(src).toContain('window.history.pushState');
    expect(src).toContain('setWhole(example)');
  });

  it('prints through the shell’s sheet, with the address that reopens the case', () => {
    expect(src).toContain('useSheet({ locale: t.sheet.locale, url: () => address.link(encodeCable(form)) })');
    expect(src).toContain('<SheetStamp stamp={stamp} t={{ printed: t.sheet.printed, link: w.sheet.link }} />');
    expect(src).toContain('const width = onPaper ? PAPER_WIDTH : windowWidth;');
  });

  it('round-trips every mode and a case with everything switched on through its address into the very same page', () => {
    const full: CableForm = { ...withLoad({ own2: { ...defaultCase().section, d: 0.5, mbf: 9000 } }), n: 3, allowable: 20, dT: -30 };
    for (const f of [defaultCase(), exampleOf('pull'), exampleOf('drum'), full, withPull({ accel: 2, massInput: true, W: 40 }), withDrum({ wrap: 90, wrapUnit: 'deg' })]) {
      const code = encodeCable(f);
      expect(code.length).toBeLessThan(MAX_LINK);
      const read = decodeCable(code)!;
      expect(read).toEqual(f);
      const a = cardsOf(show(f));
      const b = cardsOf(show(read));
      expect(b.titles).toEqual(a.titles);
      for (const title of a.titles) expect(rowsOf(b.of(title)), title).toEqual(rowsOf(a.of(title)));
    }
  });

  it('opens a case the link cannot give as nothing at all', () => {
    expect(decodeCable('')).toBeNull();
    expect(decodeCable('garbage')).toBeNull();
    expect(decodeCable(encodeCable(defaultCase()).slice(0, -3))).toBeNull();
    expect(text(show(undefined))).not.toContain(cableUi.en.linkError);
  });
});

describe('the rules of the tool, as they stand in its source', () => {
  const src = source('components/ttc/calc/cable/CableCalculator.tsx');
  const css = source('components/ttc/calc/cable/cable.css');

  it('carries neither language: its words are props, and the strings are imported as types only', () => {
    expect(src).not.toMatch(/import (?!type)[^;]*from '@\/lib\/calc\/cable\/strings'/);
    expect(src).not.toMatch(/from '@\/lib\/calc\/(beam|shaft|continuous|truss)\/strings'/);
    expect(src).toContain("'use client';");
    expect(src).toContain("import './cable.css';");
  });

  it('solves through the door that never throws, and decides no number of its own', () => {
    expect(src).toContain('analyseSafely(solved)');
    expect(src).not.toMatch(/\b(solveLoad|solvePull|solveDrum)\b/);
    expect(src).not.toMatch(/\bMath\.(sqrt|hypot|atan2|exp|log|sin|cos|pow)\b/);
  });

  it('uses the shell’s pieces and not copies of them', () => {
    for (const piece of ["from '../shell/Actions'", "from '../shell/address'", "from '../shell/layout'", "from '../shell/sheet'", "from '../NumField'"]) expect(src).toContain(piece);
  });

  it('takes the switches and the table of the curve off the sheet, and holds the drawings whole on one page', () => {
    const print = css.slice(css.indexOf('@media print'));
    expect(print).toContain('.mp-cable .mp-cable__options');
    expect(print).toContain('.mp-cable .mp-cable__curve-table');
    expect(print).toContain('.mp-cable .mp-app__plots {\n    break-inside: avoid;');
    // The bar with the mode and the units is the shared sheet’s to hide (calc.css), and the case is named in the results.
    expect(src).toContain('className="mp-app__bar mp-cable__bar"');
    expect(src).toContain('className="mp-cable__case"');
  });

  it('keeps every rule of its sheet at the weight of two classes, so that it holds whichever sheet is read last', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g)!;
    const single = rules.map((r) => r.trim()).filter((r) => /^\.mp-[\w-]+$/.test(r) && !r.startsWith('.mp-cable-fig__') && r !== '.mp-cable');
    expect(single).toEqual([]);
  });

  it('keeps the Greek letters of a label as they are, and gives every control 44px to be pressed with', () => {
    expect(css).toMatch(/\.mp-cable \.mp-num__label,[\s\S]*?\{\s*text-transform: none;/);
    // The shared sheet gives a radio tab, a switch and a field 44px (calc.css); the mode's own tabs keep it.
    const shared = source('components/ttc/calc/calc.css');
    expect(shared).toMatch(/\.mp-seg__item span \{[^}]*min-height: 44px;/);
    expect(css).not.toMatch(/min-height: (?!44px)\d+px/);
    expect(css).toContain('.mp-cable .mp-cable__modes .mp-seg__item span');
  });

  it('keeps the table of a phone to two cells a line and the cards from overflowing the screen', () => {
    expect(css).toMatch(/@media screen and \(max-width: 640px\)[\s\S]*?\.mp-cable__table--stack tbody th,[\s\S]*?flex: 0 0 50%;/);
    expect(css).toMatch(/@media screen \{\s*\.mp-cable \.mp-app__card--wide \{\s*overflow-x: auto;/);
  });
});
