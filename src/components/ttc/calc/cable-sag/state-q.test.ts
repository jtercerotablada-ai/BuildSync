import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { defaultCase, defaultCaseFor, reduceCableSag, type CableSagForm } from '@/lib/calc/cable-sag/model';
import { cableSagUi, sharedWords } from '@/lib/calc/cable-sag/strings';
import type { Lang } from '@/lib/ttc/i18n';
import { CableSagCalculator } from './CableSagCalculator';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/** Review finding A6, on the page: state 2's load per length is an EMPTY field that says what it stands for. */

const show = (lang: Lang, initial: CableSagForm) => renderToStaticMarkup(h(CableSagCalculator, { t: sharedWords(beamStrings[lang].ui), w: cableSagUi[lang], initial }));
const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
/** The value shown in the state-2 load field (the label differs by language) and the note under the row. */
const stateQ = (html: string, lang: Lang) => {
  const label = cableSagUi[lang].state.q;
  const m = html.match(new RegExp(`<span class="mp-num__label">${label}</span><span class="mp-num__box"><input[^>]*?value="([^"]*)"`));
  const note = html.match(/<p class="mp-app__note" data-state-q="(same|own)">([^<]*)<\/p>/);
  return { value: m ? m[1] : null, kind: note?.[1], note: note ? plain(note[2]) : null };
};

describe('state 2’s load field', () => {
  for (const lang of ['en', 'es'] as Lang[]) {
    it(`${lang}: empty by default, with the line that says it is the same as state 1 and how to give it a load of its own`, () => {
      const hanging = reduceCableSag(defaultCase(), { type: 'mode', mode: 'state' });
      const r = stateQ(show(lang, hanging), lang);
      expect(r.value).toBe('');
      expect(r.kind).toBe('same');
      // The hanging example's 100 lb/ft is the number the line names.
      expect(r.note).toContain('100 lb/ft');
      expect(r.note).toContain(lang === 'en' ? 'same load as state 1' : 'misma carga que el estado 1');
      expect(r.note).toContain(lang === 'en' ? '0 for none' : '0 para ninguna');
    });

    it(`${lang}: a typed number shows in the field, 0 included, and the line names state 1's and the way back`, () => {
      for (const q of [0, 25]) {
        const f = reduceCableSag(defaultCaseFor('state'), { type: 'state', patch: { q } });
        const r = stateQ(show(lang, f), lang);
        expect(r.value).toBe(String(q));
        expect(r.kind).toBe('own');
        expect(r.note).toContain(lang === 'en' ? 'Clear the field' : 'Vacíe el campo');
      }
    });
  }

  it('SI shows the value it names in kN/m', () => {
    const f = reduceCableSag(reduceCableSag(defaultCase(), { type: 'mode', mode: 'state' }), { type: 'units', units: 'si' });
    const r = stateQ(show('en', f), 'en');
    expect(r.value).toBe('');
    expect(r.note).toMatch(/1\.459 kN\/m/);
  });

  it('the reading sentence and the results state the load used in state 2: the carried-over 100 lb/ft plus the ice', () => {
    const f = reduceCableSag(defaultCase(), { type: 'mode', mode: 'state' });
    const html = show('en', f);
    const reading = plain(html.match(/<p class="mp-cs__reading">([^<]*)<\/p>/)?.[1] ?? '');
    // Same temperature, only the ice: the load goes from 100 to 101 lb/ft, not to 1 lb/ft.
    expect(reading).toMatch(/the load per length goes from 100 lb\/ft to 101 lb\/ft/);
    expect(plain(html)).not.toMatch(/NaN|undefined/);
  });
});
