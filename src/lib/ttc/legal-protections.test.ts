import { describe, expect, it } from 'vitest';
import { en } from './site';
import { es } from './site.es';

/**
 * What the legal audit of October 21, 2026 asked for, kept from slipping
 * away in a later copy edit. These are not legal conclusions — the words
 * are the assistant's, a Florida attorney should read them — only a guard
 * that each protection is still on the site, in both languages.
 */
const bundles = [
  ['en', en, { merch: 'MERCHANTABILITY', other: /separate company/i, files: 'Files you send' }],
  ['es', es, { merch: 'COMERCIABILIDAD', other: /empresa independiente/i, files: 'Archivos que usted envía' }],
] as const;

const section = (b: typeof en | typeof es, h: string | RegExp) =>
  b.legal.terms.sections.find((s) => (typeof h === 'string' ? s.h === h : h.test(s.h)));
const paragraphs = (s: { p: string | readonly string[] } | undefined) => (s ? ([] as string[]).concat(s.p as string | string[]) : []);

describe('legal protections, October 21, 2026', () => {
  for (const [lang, b, w] of bundles) {
    it(`${lang}: the limitation of liability is conspicuous (capitals), names merchantability and negligence`, () => {
      const s = section(b, /^(Limitation of liability|Limitación de responsabilidad)$/);
      const first = paragraphs(s)[0];
      expect(first, lang).toBe(first.toUpperCase());
      expect(first).toContain(w.merch);
      expect(first).toMatch(/NEGLIGENCE|NEGLIGENCIA/);
      expect(first).toMatch(/AS IS|TAL COMO ESTÁN/);
    });

    it(`${lang}: Precision Source is said to be a separate company, with no task or signer named`, () => {
      const text = paragraphs(section(b, /^(Other companies|Otras empresas)$/)).join(' ');
      expect(text).toContain('Precision Source Inc.');
      expect(text).toMatch(w.other);
      // No one is said to sign or seal anything ("firm" / "firma" is the company here).
      expect(text).not.toMatch(/\bsign(s|ed)?\b|\bseal(s|ed)?\b|\bfirma(n|r|do|dos)\b|\bsella(n|r|do|dos)\b/i);
    });

    it(`${lang}: the terms say who may send a file, that it is not confidential, and that the code and tables are the firm's`, () => {
      expect(paragraphs(section(b, w.files)).join(' ')).toMatch(/confidential|confidencial/);
      expect(paragraphs(section(b, /^(Intellectual property|Propiedad intelectual)$/)).join(' ')).toMatch(/calculators|calculadoras/);
    });

    it(`${lang}: a notice sits over the calculators, and sending the form is said not to hire the firm`, () => {
      expect(b.legal.calcNotice.text.length).toBeGreaterThan(60);
      expect(b.legal.calcNotice.link.length).toBeGreaterThan(5);
      expect(b.ui.form.successNote).toMatch(/Nothing starts|Nada comienza/);
    });
  }
});
