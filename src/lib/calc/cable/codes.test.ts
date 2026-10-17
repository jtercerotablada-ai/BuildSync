import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* Every code the contract lists is in types.ts and has a test; no code is tested that the contract does not list. */
const read = (file: string) => readFileSync(join(__dirname, file), 'utf8').replace(/\r\n/g, '\n');
const types = read('types.ts');
const tests = read('engine.test.ts') + read('engine.physics.test.ts') + read('analysis.test.ts');

const CODES = {
  load: ['number', 'range', 'parallel-legs', 'slack-leg', 'size'],
  loadWarnings: ['no-load', 'no-exact-position', 'no-second-order', 'restrained-slack', 'large-strain', 'shrinks-past-zero'],
  pull: ['number', 'range', 'size'],
  pullWarnings: ['kinetic-above-static', 'no-governing'],
  pullStatus: ['pull', 'slides-on-its-own', 'stays-put', 'self-locking', 'leaves-surface', 'cannot-hold', 'no-pull-needed'],
  drum: ['number', 'range', 'underdetermined', 'overdetermined', 'order', 'degenerate', 'overflow'],
  drumWarnings: ['no-friction', 'no-wrap', 'beyond-limit'],
  analysis: ['stopped'],
};

describe('the codes', () => {
  for (const [group, codes] of Object.entries(CODES)) {
    for (const code of codes) {
      it(`${group}: '${code}' is in the contract and is tested`, () => {
        expect(group === 'analysis' ? read('analysis.ts') : types, `the contract does not list '${code}'`).toContain(`'${code}'`);
        expect(tests, `no test names '${code}'`).toContain(`'${code}'`);
      });
    }
  }
  it('types.ts declares exactly the codes listed here', () => {
    const declared = (name: string): string[] => {
      const m = types.match(new RegExp(`export type ${name} =([^;]+);`));
      return m ? [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]) : [];
    };
    expect(declared('LoadIssueCode').sort()).toEqual([...CODES.load].sort());
    expect(declared('LoadWarningCode').sort()).toEqual([...CODES.loadWarnings].sort());
    expect(declared('PullIssueCode').sort()).toEqual([...CODES.pull].sort());
    expect(declared('PullWarningCode').sort()).toEqual([...CODES.pullWarnings].sort());
    expect(declared('PullStatus').sort()).toEqual([...CODES.pullStatus].sort());
    expect(declared('DrumIssueCode').sort()).toEqual([...CODES.drum].sort());
    expect(declared('DrumWarningCode').sort()).toEqual([...CODES.drumWarnings].sort());
  });
  it('the engine and the analysis hold no words: no sentence in a string literal', () => {
    for (const file of ['engine.ts', 'analysis.ts', 'model.ts']) {
      const source = read(file)
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n');
      const literals = [...source.matchAll(/'([^'\n]{12,})'/g)].map((m) => m[1]).filter((s) => /^[A-Za-z]/.test(s) && /\s[a-z]+\s/.test(s));
      expect(literals, file).toEqual([]);
    }
  });
});
