import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { openCalculatorPaths } from '@/lib/ttc/calculator-paths';
import { calculatorFamilies, openCalculatorCount } from '@/lib/ttc/calculators';
import { getContent } from '@/lib/ttc/content';
import { getGuides } from '@/lib/ttc/guide-content';
import { guideSlugs } from '@/lib/ttc/guides';
import type { Lang } from '@/lib/ttc/i18n';
import { localePath } from '@/lib/ttc/i18n';
import { photo, video } from '@/lib/ttc/media';
import { NUMBER_WORD_MAX, numberWord, withNumberWord } from '@/lib/ttc/number-words';
import { HomeView } from './HomeView';
import { SEO } from './seo';

// The sections read the language from the URL where they must (the form, the
// ribbon's links); outside Next there is none, so each render supplies it.
const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

/**
 * THE HOME PAGE'S OWN GUARDS — the owner's rules for the new home (Juan
 * Tercero, 2026-10-24) held against the words, in both languages.
 *
 * The home is a presentation of the firm in black, white and gold. It is NOT
 * about recertification: no notice of any kind, no day count, no "letter", no
 * "package", no lateness, no fine, no urgency, no free-proposal line, no
 * promise of a reply time; no money; the company speaks and never a person;
 * the contractor is named in one card only; the firm designs and inspects and
 * never says it builds. The build specification is
 * `home-concepts/SPEC.md` (§6.4 lists these guards, numbered 1 to 10).
 *
 * THIS FILE HAS TWO HALVES.
 *
 *   1. DATA-LEVEL GUARDS (here, since slice 1): they read the content object
 *      `home` and the few strings the home borrows (`reach.formHome`,
 *      `ui.pauseMotion`, `partner.lede`…) straight from the bundle, so they
 *      need no rendered page and they hold before any component exists.
 *      Spec items 2 and 3 (vocabulary, names, SE, headcount, builds) over
 *      every string; 4 (the order); 6 (each service's line is its own);
 *      8 (the counts said in words); 9 (the Spanish mirror).
 *
 *   2. RENDER-BASED GUARDS (the bottom of this file, since the slice that
 *      rewrote `HomeView`; `renderToStaticMarkup(HomeView)` in both languages
 *      with the same `route` mock the other view tests use): 1 (one h1,
 *      headings ≤ 23), 2 and 3 again over the rendered text, 4 (the eight
 *      services once each; the two program cards in the same component and
 *      size class), 5 (no money, every <img> has an alt, every photograph
 *      with its catalogue alt and aria-hidden, no repairSoffitTrowel), 7 (the
 *      Precision Source logo with its role line and both numbers in one card
 *      and nowhere else), 8 (the numerals printed equal the counts), 10 (no
 *      <script>).
 *
 * Words are matched as WHOLE words (see `words`): the spec's list reads
 * "lien" and "fee", which a plain substring test finds inside "client" and
 * "feel". A guard that cries wolf gets deleted.
 */

const LANGS: Lang[] = ['en', 'es'];

/* ── Reading the content ──────────────────────────────────────────────── */

type Entry = { path: string; text: string };

/** Every string under `value`, with the path it was found at. */
function entries(value: unknown, path: string): Entry[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => entries(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => entries(v, path ? `${path}.${k}` : k));
  }
  return [];
}

/**
 * Everything the home page says in words that is not somebody else's: the
 * `home` object, the two strings of its form, the pause switch's label, the
 * phone bar's cell and WhatsApp line, and the sentence of the credentials
 * plate. (The firm's name, the registry line, the contractor's role line and
 * the county disclaimer are printed from `company`, `partner.construction`
 * and `pricing`, where other tests hold them.)
 */
function homeStrings(lang: Lang): Entry[] {
  const c = getContent(lang);
  return [
    // `home.order` is a list of slugs (addresses), not words said to a reader.
    ...entries(c.home, 'home').filter((e) => !e.path.startsWith('home.order[')),
    ...entries(c.ui.form.home, 'ui.form.home'),
    { path: 'ui.pauseMotion', text: c.ui.pauseMotion },
    { path: 'reach.formHome', text: c.reach.formHome },
    { path: 'reach.whatsappTextHome', text: c.reach.whatsappTextHome },
    { path: 'partner.lede', text: c.partner.lede },
  ];
}

/**
 * The digits a home string may carry, by path. The attachments hint says how
 * big a file may be (a fact of the form); the credentials sentence says how
 * long the two firms have worked together (the owner's approved figure).
 * Nothing else on the home is a number: the two counts are `{n}`, said in
 * words.
 */
const DIGITS_ALLOWED: Record<string, RegExp> = {
  'home.form.attachmentsHint': /25 MB/g,
  'ui.form.home.attachmentsHint': /25 MB/g,
  'partner.lede': /\b30\b/g,
};

/* ── Matching whole words ─────────────────────────────────────────────── */

/** One of the forms, as a whole word: not inside a longer word, either language. */
const words = (...forms: string[]) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms.join('|')})(?![\\p{L}\\p{N}])`, 'iu');

/** Same, case-sensitive: for "SE", which is not "se". */
const wordsExact = (...forms: string[]) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms.join('|')})(?![\\p{L}\\p{N}])`, 'u');

const ENGLISH_COUNTS = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty';
const SPANISH_COUNTS = 'un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|veinte|treinta';

/**
 * The words the owner ruled out of the home page (spec §6.4, item 2), each
 * with the thing it would say. A word is here because a reader of the home
 * must not meet it; the program pages, the guides and the cost page say all
 * of them, and keep saying them.
 */
const NOT_ON_THE_HOME: readonly (readonly [says: string, pattern: RegExp])[] = [
  ['a notice', words('notices?', 'notificaci\\p{L}*', 'avisos?')],
  ['the letter', words('letters?', 'cartas?')],
  ['the package', words('packages?', 'paquetes?')],
  ['a deadline', words('deadlines?', 'plazos?', 'fechas? l[ií]mites?')],
  ['lateness', words('late', 'lately', 'overdue', 'tarde', 'tard[ií][oa]s?', 'atrasad[oa]s?', 'vencid[oa]s?')],
  ['urgency', words('urgen\\p{L}*', 'hurry', 'rush', 'prisa', 'asap', 'immediately', 'inmediatamente')],
  ['a fine, a lien, a vacate order or a hearing', words('fines?', 'fined', 'multas?', 'liens?', 'vacat\\p{L}*', 'desaloj\\p{L}*', 'hearings?', 'audiencias?', 'penalt\\p{L}*', 'penalidad\\p{L}*', 'sanci\\p{L}*')],
  ['a day count', words('days?', 'd[ií]as?', '90', '180')],
  // The old home's hero was "Send us a photo", and the owner's rules name the
  // free offer and the push to act: new words for the same things are still
  // the same things.
  ['a send-a-photo ask', words('send\\s+(?:us\\s+)?(?:a\\s+)?(?:photos?|pictures?)', 'env[ií]\\p{L}*\\s+(?:una\\s+)?fotos?')],
  ['a free offer', words('free\\s+(?:estimates?|consultations?|assessments?|inspections?)', '(?:estimado|consulta|evaluaci[oó]n)\\s+gratuit[oa]s?', 'no\\s+obligation', 'sin\\s+compromiso')],
  ['a call to act now', words('don[\'’]?t\\s+wait', 'act\\s+now', 'call\\s+today', 'no\\s+espere', 'act[uú]e\\s+ahora', 'll[aá]me\\s+hoy')],
  ['a reply time', words('hours?', 'horas?', 'reply', 'replies', 'respond\\p{L}*', 'respuestas?')],
  ['a proposal', words('proposals?', 'propuestas?', 'quotes?', 'cotizaci\\p{L}*', 'presupuestos?')],
  ['a currency sign', /[$€£]/u],
  ['a price', words('usd', 'dollars?', 'd[oó]lares', 'prices?', 'precios?', 'fees?', 'tarifas?', 'costs?', 'costos?', 'honorarios', 'pricing')],
];

/** The people (spec §6.4, item 3): no name, no founder, no "I", no SE license, no headcount, no builder. */
const NOT_A_PERSON: readonly (readonly [says: string, pattern: RegExp])[] = [
  ['a personal name', words('Juan', 'Melvin', 'Rudy', 'Tercero', 'Tablada')],
  ['a founder or a leader', words('led by', 'founders?', 'founded', 'principal', 'owner-operator', 'l[ií]der(?:es)?', 'fundador\\p{L}*', 'fund[oó]', 'dirigid[oa]s? por')],
  ['the first person singular', words('I', 'my', 'mine', 'yo', 'mi', 'mis', 'soy', 'me')],
  ['an SE license', wordsExact('SE', 'S\\.E\\.')],
  ['an SE license, said in words', words('licensed\\s+structural', 'structural\\s+engineers?\\s+licensed', 'estructurales?\\s+con\\s+licencia', 'licenciad[oa]s?\\s+estructural\\p{L}*')],
  ['a headcount', new RegExp(`(?:\\d+|(?<![\\p{L}\\p{N}])(?:${ENGLISH_COUNTS}|${SPANISH_COUNTS})(?![\\p{L}\\p{N}]))\\s+(?:engineers|ingenieros|professionals|profesionales|people|personas|employees|empleados|staff)(?![\\p{L}\\p{N}])`, 'iu')],
  ['a team size', words('team of', 'equipo de')],
  ['one engineer', words('the\\s+engineer', 'el\\s+ingeniero')],
  ['an ampersand', /&/u],
  ['the firm building', words('we build', 'we construct', 'construimos', 'edificamos', 'nuestras obras', 'nuestros proyectos', 'our projects', 'our portfolio', 'builders?', 'constructor\\p{L}*')],
  ['the contractor', words('contractors?', 'contratistas?', 'Precision', 'partners?', 'aliad[oa]s?', 'socios?')],
  ['the second person singular (the site says usted)', words('t[uú]', 'tus?', 'puedes', 'tienes', 'quieres', 'cont[aá]ctanos', 'escr[ií]benos', 'cu[eé]ntanos')],
];

/** The one string of the home that is the visitor's own words, not the firm's. */
const VISITOR_SPEAKS = new Set(['reach.whatsappTextHome']);

/* ═══════════════════════════════════════════════════════════════════════
   1 · DATA-LEVEL GUARDS
   ═══════════════════════════════════════════════════════════════════════ */

describe('the owner’s vocabulary rules, over every string the home says (spec items 2 and 3)', () => {
  for (const lang of LANGS) {
    const all = homeStrings(lang);

    it(`${lang}: reads the home object and what it borrows (not an empty list)`, () => {
      expect(all.length).toBeGreaterThan(80);
      for (const e of all) expect(e.text.trim(), e.path).not.toBe('');
    });

    for (const [says, pattern] of NOT_ON_THE_HOME) {
      it(`${lang}: nothing on the home says ${says}`, () => {
        expect(all.filter((e) => pattern.test(e.text)).map((e) => `${e.path}: ${e.text}`)).toEqual([]);
      });
    }

    for (const [says, pattern] of NOT_A_PERSON) {
      it(`${lang}: nothing on the home says ${says}`, () => {
        // The company speaks and never a person, except in the line a visitor
        // SENDS: the WhatsApp chat opens with a first line already written
        // for them, in their voice ("Hello, I would like to talk about a
        // building."). Nothing else is exempt.
        const spoken = says === 'the first person singular' ? VISITOR_SPEAKS : new Set<string>();
        expect(
          all.filter((e) => !spoken.has(e.path) && pattern.test(e.text)).map((e) => `${e.path}: ${e.text}`),
        ).toEqual([]);
      });
    }

    // A digit is a count of days, a price or a headcount until proved otherwise.
    it(`${lang}: no digit, except the file size in the form and the 30 years`, () => {
      const digits = all
        .map((e) => ({ ...e, text: e.text.replace(DIGITS_ALLOWED[e.path] ?? /(?!)/g, '') }))
        .filter((e) => /\d/.test(e.text));
      expect(digits.map((e) => `${e.path}: ${e.text}`)).toEqual([]);
      // ...and the allowance is spent where it is given.
      for (const [path, re] of Object.entries(DIGITS_ALLOWED)) {
        expect(all.find((e) => e.path === path)?.text, path).toMatch(new RegExp(re.source));
      }
    });

    // The program pages own these words; on the home the two county programs
    // are two of eight service names and nothing more. The words reach the
    // home only through those two cards' lines (and through the services'
    // own names, which are read from `services`, not from this object).
    it(`${lang}: recertification and BSIP are named on their own two cards and nowhere else`, () => {
      const program = words('recertif\\p{L}*', 'BSIP', '40[- ]?(?:year|a[nñ]os?)', 'inspection program', 'programa de inspecci\\p{L}*');
      const ownCards = ['home.services.lines.building-recertification', 'home.services.lines.broward-bsip'];
      const found = all.filter((e) => program.test(e.text)).map((e) => e.path);
      expect(found.filter((p) => !ownCards.includes(p))).toEqual([]);
      expect(found, 'the Miami-Dade card names its program').toContain(ownCards[0]);
    });

    // "Licensed" belongs to the Professional Engineers; the firm is
    // "Registered" (spec §1 S1 wording guard). The hero says it in this order.
    it(`${lang}: "licensed in Florida" is said of the Professional Engineers`, () => {
      const c = getContent(lang);
      expect(c.home.hero.sub).toMatch(
        lang === 'en' ? /^Professional Engineers licensed in Florida\./ : /^Ingenieros Profesionales con licencia en Florida\./,
      );
      // The owner, 2026-10-25: the firm has Professional, Structural and
      // Electrical Engineers and the home names all three. Never an "SE"
      // license (Florida has none): the words are disciplines, and "PE" is
      // the only license printed anywhere.
      expect(c.home.hero.eyebrow).toEqual(
        lang === 'en'
          ? ['Professional Engineers', 'Structural Engineers', 'Electrical Engineers']
          : ['Ingenieros Profesionales', 'Ingenieros Estructurales', 'Ingenieros Eléctricos'],
      );
      expect(c.home.credentials.titleLines).toEqual(
        lang === 'en'
          ? ['Professional Engineers.', 'Structural Engineers.', 'Electrical Engineers.']
          : ['Ingenieros Profesionales.', 'Ingenieros Estructurales.', 'Ingenieros Eléctricos.'],
      );
      expect(c.home.credentials.engineers.scope).toMatch(lang === 'en' ? /structural and electrical/i : /estructural y eléctrica/i);
    });

    // The owner, 2026-10-25: "SE" for the structural engineers. Florida has
    // no SE license, and the structural associate's own site shows a PE and
    // a Special Inspector (threshold buildings), not an SE or an FRSE. The
    // owner then chose: "cámbialo a Special Inspector Threshold Buildings".
    // So the structural line carries that credential, and "SE" and "FRSE" are
    // printed nowhere.
    it(`${lang}: the Structural Engineers line carries the Special Inspector credential, and "SE" and "FRSE" are printed nowhere`, () => {
      const c = getContent(lang);
      expect(c.home.credentials.marks).toEqual([
        'PE',
        lang === 'en' ? 'Special Inspector · Threshold Buildings' : 'Inspector Especial · Edificios Threshold',
        'PE',
      ]);
      expect(JSON.stringify(c.home)).not.toMatch(/\bFRSE\b/);
      expect(c.home.credentials.titleLines[1]).toMatch(lang === 'en' ? /^Structural Engineers\.$/ : /^Ingenieros Estructurales\.$/);
      const texts = JSON.stringify(c.home);
      expect(texts).not.toMatch(/\bSE\b|\bS\.E\./);
      expect(texts).not.toMatch(/licensed structural engineer|ingenieros? estructurales? con licencia|florida SE|SE (?:license|licen)/i);
    });
  }

  it('the walls are not pointed at nothing: each pattern finds what it is for', () => {
    const find = (list: typeof NOT_ON_THE_HOME, text: string) => list.some(([, re]) => re.test(text));
    for (const bad of [
      'Got a recertification notice?',
      'Send us a photo of the letter',
      'The complete package',
      'Within 90 days',
      'Late? That is fine',
      'Free proposal',
      'From $2,500',
      'We reply within two hours',
      'Una multa o un gravamen',
      'Recibió una notificación',
      'Precio fijo',
      'Si ya pasó el plazo',
      'Llegó tarde',
      'Send us a photo of the building',
      'Envíenos una foto',
      'Free estimate',
      'Estimado gratuito',
      'Free consultation',
      'No obligation',
      'Sin compromiso',
      'Don’t wait',
      'Act now',
      'Call today',
      'No espere',
      'Llame hoy',
      // What the page form says after a send, said in the page's words.
      'Your request is in the engineer’s inbox. We usually reply within two hours.',
      'Sending this does not engage us or change your deadline. Nothing starts until you accept a written proposal.',
      'A phone photo of the letter is enough',
    ]) expect(find(NOT_ON_THE_HOME, bad), bad).toBe(true);
    for (const bad of [
      'Juan Tercero founded the firm',
      'I started this practice',
      'Our principal engineer',
      'Licensed Structural Engineers',
      'Ingenieros estructurales con licencia',
      'Our team of eight engineers',
      'Tres ingenieros',
      'The engineer reads your description',
      'Your request is in the engineer’s inbox',
      'El ingeniero lee su descripción',
      'We build foundations',
      'Tercero Tablada & Associates',
      'The contractor builds it',
      'Puedes escribirnos',
    ]) expect(find(NOT_A_PERSON, bad), bad).toBe(true);
    // ...and they do not find what the owner welcomes, or a word inside a word.
    for (const fine of [
      'Professional Engineers licensed in Florida.',
      'Registered Florida Engineering Business',
      'Structural Engineers.',
      'Ingenieros Profesionales con licencia.',
      'A client with a free calculator',
      'Engineering you can use',
      'Photographs, drawings or reports',
      'Se diseña para todo eso',
      'Free to use',
      'De uso gratuito',
      'Nine free engineering calculators',
      'Thank you. We will write back by email.',
    ]) {
      expect(find(NOT_ON_THE_HOME, fine), fine).toBe(false);
      expect(find(NOT_A_PERSON, fine), fine).toBe(false);
    }
  });
});

describe('the one sentence of the credentials plate (partner.lede)', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);

    // The owner's approved sentence, 2026-10-24, in two: the figure is the
    // two firms TOGETHER, and it is never one person's.
    it(`${lang}: more than 30 years of COMBINED experience, and two firms, in one text node`, () => {
      expect(c.partner.lede).toBe(
        lang === 'en'
          ? 'More than 30 years of combined experience. Two licensed firms, working as one team.'
          : 'Más de 30 años de experiencia combinada. Dos empresas con licencia, trabajando como un solo equipo.',
      );
      expect(c.partner.lede).toMatch(lang === 'en' ? /\bcombined\b/ : /\bcombinada\b/);
      expect(c.partner.lede).toMatch(lang === 'en' ? /\bTwo licensed firms\b/ : /\bDos empresas con licencia\b/);
    });
  }
});

describe('the order of the eight services (spec item 4, data part)', () => {
  const ORDER = [
    'reinforced-concrete-design',
    'structural-condition-assessments',
    'structural-analysis',
    'building-recertification',
    'bim-coordination',
    'broward-bsip',
    'peer-review',
    'milestone-inspections',
  ];
  const PROGRAMS = ['building-recertification', 'broward-bsip'];

  for (const lang of LANGS) {
    const c = getContent(lang);
    const order = [...c.home.order];

    it(`${lang}: names each of the eight services once, and no other`, () => {
      expect(order).toHaveLength(8);
      expect(new Set(order).size).toBe(8);
      expect([...order].sort()).toEqual(c.services.map((s) => s.slug).sort());
    });

    it(`${lang}: Reinforced Concrete Design first, the order as decided`, () => {
      expect(order).toEqual(ORDER);
    });

    // Judge 1's blocker: a home that opens with the two county programs is a
    // recertification page. They are 4th and 6th, in the middle of the list.
    it(`${lang}: the first two are not recertification or BSIP; they are the 4th and the 6th`, () => {
      expect(PROGRAMS).not.toContain(order[0]);
      expect(PROGRAMS).not.toContain(order[1]);
      expect(order.indexOf('building-recertification')).toBe(3);
      expect(order.indexOf('broward-bsip')).toBe(5);
    });

    it(`${lang}: new-building and existing-building services alternate, new first`, () => {
      const track = (slug: string) => c.services.find((s) => s.slug === slug)!.track;
      expect(order.map(track)).toEqual(['new', 'existing', 'new', 'existing', 'new', 'existing', 'new', 'existing']);
    });
  }

  it('is the same order in both languages', () => {
    expect([...getContent('es').home.order]).toEqual([...getContent('en').home.order]);
  });
});

describe('each service’s line on the home is its own (spec item 6)', () => {
  /** The words of a sentence, for comparing two of them. */
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

  for (const lang of LANGS) {
    const c = getContent(lang);
    const lines = c.home.services.lines as Record<string, string>;

    it(`${lang}: there is one line per service, under the services’ slugs`, () => {
      expect(Object.keys(lines).sort()).toEqual(c.services.map((s) => s.slug).sort());
      expect(Object.keys(lines).sort()).toEqual([...c.home.order].sort());
    });

    it(`${lang}: no two services share a line`, () => {
      expect(new Set(Object.values(lines).map(norm)).size).toBe(8);
    });

    for (const s of c.services) {
      // Those are printed on /services (summary, card.*) and on the service's
      // own page (heroSub, and everything else): a sentence is printed once
      // (shared-text.test.ts), so a line on the home may not be any of them.
      it(`${lang}: ${s.slug}: the line differs from the summary, the hero sub-line and the card`, () => {
        const line = norm(lines[s.slug]);
        expect(line).not.toBe('');
        for (const [name, other] of [
          ['summary', s.summary],
          ['heroSub', s.heroSub ?? ''],
          ['card.when', s.card.when],
          ['card.receive', s.card.receive],
          ['card.next', s.card.next],
        ] as const) {
          expect(line, name).not.toBe(norm(other));
        }
      });

      it(`${lang}: ${s.slug}: the line is no sentence of the service at all`, () => {
        const own = entries(s, s.slug).filter((e) => norm(e.text) === norm(lines[s.slug]));
        expect(own.map((e) => e.path)).toEqual([]);
      });
    }

    it(`${lang}: no line says who signs, or names the contractor (and no line has a number)`, () => {
      for (const [slug, line] of Object.entries(lines)) {
        expect(line, slug).not.toMatch(/\d/);
        expect(line, slug).not.toMatch(
          /\bsign(?:s|ed)?\b|\bseal(?:s|ed)?\b|\bfirm(?:a|an|ado|ada|amos)\b|\bsell(?:a|o|ado|ada|amos)\b|contractor|contratista/i,
        );
      }
    });
  }
});

describe('a sentence of the home is printed once in the bundle (the site’s rule: one home for each piece of text)', () => {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = (s: string) => (s.match(/\p{L}[\p{L}\p{N}'’-]*/gu) ?? []).length;

  for (const lang of LANGS) {
    const c = getContent(lang);

    it(`${lang}: no block of six words or more is also another string of the bundle`, () => {
      // Where each string of the bundle is, by its words. `home.*` and
      // `ui.form.home` are the same strings under two keys, so neither
      // counts as "somewhere else".
      const where = new Map<string, string[]>();
      for (const e of entries(c, '')) {
        if (e.path.startsWith('home.') || e.path.startsWith('ui.form.home')) continue;
        where.set(norm(e.text), [...(where.get(norm(e.text)) ?? []), e.path]);
      }
      const shared = homeStrings(lang)
        .filter((e) => e.path.startsWith('home.') || e.path === 'reach.formHome' || e.path === 'reach.whatsappTextHome')
        .filter((e) => wordCount(e.text) >= 6)
        .flatMap((e) => (where.get(norm(e.text)) ?? []).filter((p) => p !== e.path).map((p) => `${e.path} = ${p}`));
      expect(shared).toEqual([]);
    });
  }
});

describe('the counts are said in words, never typed (spec item 8, data part)', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);

    it(`${lang}: the two counts are real, and inside the words the page can say`, () => {
      const openEntries = calculatorFamilies.flatMap((f) => f.items).filter((i) => i.href);
      expect(openCalculatorCount).toBe(openEntries.length);
      expect(openCalculatorCount).toBe(openCalculatorPaths.length);
      expect(guideSlugs.length).toBe(getGuides(lang).length);
      for (const n of [openCalculatorCount, guideSlugs.length]) {
        expect(n).toBeGreaterThanOrEqual(1);
        // Past twelve the page would print a numeral where a word belongs.
        expect(n, 'add the next number word to number-words.ts').toBeLessThanOrEqual(NUMBER_WORD_MAX);
        expect(numberWord(n, lang)).not.toMatch(/\d/);
      }
    });

    it(`${lang}: each title is a sentence with the count where {n} is, at its start`, () => {
      for (const title of [c.home.tools.calc.title, c.home.tools.guides.title]) {
        expect(title.split('{n}')).toHaveLength(2);
        expect(title.startsWith('{n} ')).toBe(true);
        expect(title).not.toMatch(/\d/);
      }
      const calc = withNumberWord(c.home.tools.calc.title, openCalculatorCount, lang);
      const guides = withNumberWord(c.home.tools.guides.title, guideSlugs.length, lang);
      expect(calc).toMatch(/^\p{Lu}\p{Ll}+ /u);
      expect(guides).toMatch(/^\p{Lu}\p{Ll}+ /u);
      expect(calc.toLowerCase().startsWith(numberWord(openCalculatorCount, lang))).toBe(true);
      expect(guides.toLowerCase().startsWith(numberWord(guideSlugs.length, lang))).toBe(true);
    });

    it(`${lang}: the calculators’ names the row lists are the open ones, each with a name in this language`, () => {
      const names = calculatorFamilies.flatMap((f) => f.items).filter((i) => i.href).map((i) => i.name[lang]);
      expect(names).toHaveLength(openCalculatorCount);
      for (const n of names) expect(n.trim(), n).not.toBe('');
    });
  }
});

describe('the Spanish mirror has the English home’s shape (spec item 9)', () => {
  const en = getContent('en').home;
  const es = getContent('es').home;

  /** The shape of a value: keys and array lengths, with each string as "string". */
  const shape = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(shape)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
        : typeof v;

  it('has the same keys at every depth and the same list lengths', () => {
    expect(shape(es)).toEqual(shape(en));
  });

  it('writes the three-line headings to the same line count', () => {
    for (const home of [en, es]) {
      expect(home.hero.titleLines).toHaveLength(3);
      expect(home.credentials.titleLines).toHaveLength(3);
      expect(home.statement.lines).toHaveLength(3);
    }
    expect(es.hero.titleLines.length).toBe(en.hero.titleLines.length);
    expect(es.credentials.titleLines.length).toBe(en.credentials.titleLines.length);
    expect(es.statement.lines.length).toBe(en.statement.lines.length);
    expect(es.ribbon.types.length).toBe(en.ribbon.types.length);
  });

  // A string that is the same in both languages is a string nobody
  // translated, unless it is a name (a county, a brand, a slug).
  it('translates every string except names', () => {
    const NAMES = new Set([
      'home.hero.accentWord', // "Florida."
      'home.hero.counties[0]',
      'home.hero.counties[1]',
      'home.ribbon.types[1]', // "Townhouses", the word Miami uses
      'home.contact.whatsapp',
      'home.credentials.marks[0]', // "PE" and "PE": credential marks
      'home.credentials.marks[2]',
    ]);
    const english = new Map(entries(en, 'home').map((e) => [e.path, e.text]));
    const same = entries(es, 'home')
      .filter((e) => english.get(e.path) === e.text)
      .map((e) => e.path)
      .filter((p) => !NAMES.has(p) && !p.startsWith('home.order['));
    expect(same).toEqual([]);
  });

  it('shares the form strings with ui.form.home, in both languages', () => {
    for (const lang of LANGS) {
      const c = getContent(lang);
      expect(c.home.form).toEqual(c.ui.form.home);
      // The form's two strings are not the notice versions they replace.
      expect(c.home.form.messagePlaceholder).not.toBe(c.ui.form.messagePlaceholder);
      expect(c.home.form.attachmentsHint).not.toBe(c.ui.form.attachmentsHint);
    }
    expect(getContent('es').home.form.messagePlaceholder).not.toBe(getContent('en').home.form.messagePlaceholder);
  });
});

describe('each accent word is one phrase of its own heading, once (what the renderer cuts the italic from)', () => {
  /** [path of the accent, the text it is cut from]. */
  const accents = (lang: Lang): [string, string, string][] => {
    const h = getContent(lang).home;
    return [
      ['hero', h.hero.accentWord, h.hero.titleLines.join(' ')],
      ['services', h.services.accentWord, h.services.title],
      ['statement', h.statement.accentWord, h.statement.dim],
      ['bim', h.bim.accentWord, h.bim.title],
      ['types', h.types.accentWord, h.types.title],
      ['pause', h.pause.accentWord, h.pause.title],
      ['credentials', h.credentials.accentWord, h.credentials.titleLines.join(' ')],
      ['where', h.where.accentWord, h.where.title],
      ['tools', h.tools.accentWord, h.tools.title],
      ['contact', h.contact.accentWord, h.contact.title],
    ];
  };

  for (const lang of LANGS) {
    for (const [block, accent, from] of accents(lang)) {
      it(`${lang}: ${block}: "${accent}" is in "${from}" exactly once, as a whole word`, () => {
        const escaped = accent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const hits = from.match(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu')) ?? [];
        expect(hits).toHaveLength(1);
        // One short phrase per heading: a word, or two joined ("mid-rise").
        expect(accent.trim().split(/\s+/).length).toBeLessThanOrEqual(2);
      });
    }
  }
});

describe('the chrome the home changes, and the one name for its one action', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);

    // One action, one name: the hero's button, the header's, the phone bar's
    // main cell and the heading of the contact block say the same words.
    it(`${lang}: the hero button, the header button and the phone bar say the same`, () => {
      expect(c.home.hero.cta).toBe(c.home.chrome.headerCta);
      expect(c.reach.formHome).toBe(c.home.hero.cta);
    });

    it(`${lang}: the call button’s name has its number placed once, and the footer tagline names the place`, () => {
      expect(c.home.chrome.callLabel.split('{phone}')).toHaveLength(2);
      expect(c.home.chrome.footerTag).toMatch(/Florida/);
      expect(c.home.chrome.footerTag).toMatch(/Miami-Dade/);
      expect(c.home.chrome.footerTag).toMatch(/Broward/);
    });

    it(`${lang}: the pause switch says motion, not video, because it stops the ribbon too`, () => {
      expect(c.ui.pauseMotion).toBe(lang === 'en' ? 'Pause motion' : 'Pausar el movimiento');
    });

    it(`${lang}: the WhatsApp chat opens with a line about a building, no notice and no proposal`, () => {
      expect(c.reach.whatsappTextHome).toBe(
        lang === 'en' ? 'Hello, I would like to talk about a building.' : 'Hola, quisiera hablar sobre un edificio.',
      );
    });
  }
});

describe('the home’s search description says who and where, not recertification (spec §6.3)', () => {
  // These are the words the program pages own. The home's description and
  // keywords carry none of them; seo.test.ts holds the pixel limits.
  const PROGRAM_WORDS = words(
    'recertif\\p{L}*', 'BSIP', '40[- ]?(?:year|a[nñ]os?)', 'notices?', 'notificaci\\p{L}*', 'inspection program',
    'deadlines?', 'plazos?', 'proposals?', 'propuestas?', 'urgent', 'urgente', 'fines?', 'multas?',
  );

  for (const lang of LANGS) {
    const home = SEO[lang].home;

    it(`${lang}: the description and the keywords have no program, notice, deadline or price word`, () => {
      expect([home.description, ...(home.keywords ?? [])].filter((s) => PROGRAM_WORDS.test(s) || /[$€£\d]/.test(s))).toEqual([]);
    });

    it(`${lang}: the description names the Professional Engineers and the place`, () => {
      expect(home.description).toMatch(lang === 'en' ? /\bProfessional Engineers\b/ : /\bIngenieros Profesionales\b/);
      expect(home.description).toMatch(/\bSur de Florida\b|\bSouth Florida\b/);
    });

    it(`${lang}: the keywords are the four the spec lists, in this language`, () => {
      const keywords = (home.keywords ?? []).map((k) => k.toLowerCase());
      for (const wanted of lang === 'en'
        ? ['structural engineer south florida', 'professional engineer miami', 'structural engineer broward', 'structural design miami-dade']
        : ['ingeniero estructural sur de florida', 'ingeniero profesional miami', 'ingeniero estructural broward', 'diseño estructural miami-dade']) {
        expect(keywords, wanted).toContain(wanted);
      }
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   2 · RENDER-BASED GUARDS
   ═══════════════════════════════════════════════════════════════════════
   The page as the server sends it: `renderToStaticMarkup(HomeView)`, in both
   languages, read the way a crawler and a screen reader read it. Spec §6.4,
   "New views/home.test.ts", items 1, 2 and 3 (over the rendered text), 4
   (the render part), 5, 7, 8 (the numerals printed) and 10.

   HomeView is the page's own body: the header, the footer and the phone bar
   are the shared chrome (SiteChrome) and are guarded where they live.
   ═══════════════════════════════════════════════════════════════════════ */

const html: Record<Lang, string> = { en: '', es: '' };
for (const lang of LANGS) {
  route.pathname = localePath('/', lang);
  html[lang] = renderToStaticMarkup(h(HomeView, { lang }));
}

/** A string as React prints it in text or in an attribute. */
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
const unescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
/** The text a reader meets: no tags, no style, no script, entities decoded. */
const text = (markup: string) =>
  unescape(
    markup
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
const imgs = (markup: string) => [...markup.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
/** The element that opens at `start` (a `<div`), through its matching `</div>`. */
function divAt(markup: string, start: number): string {
  let depth = 0;
  for (const m of markup.slice(start).matchAll(/<(\/?)div\b/g)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return markup.slice(start, start + m.index! + '</div>'.length);
  }
  throw new Error('unbalanced <div>');
}
/** The contractor's card: the one `div.mp-partner__card`. */
function contractorCard(markup: string): string {
  const at = [...markup.matchAll(/<div class="mp-partner__card\b/g)].map((m) => m.index!);
  expect(at, 'one contractor card on the home page').toHaveLength(1);
  return divAt(markup, at[0]);
}
/** A `<section id="…">`, whole. */
function section(markup: string, id: string): string {
  const open = markup.indexOf(`<section id="${id}"`);
  expect(open, `section #${id}`).toBeGreaterThanOrEqual(0);
  return markup.slice(open, markup.indexOf('</section>', open) + '</section>'.length);
}
/** The places a pattern finds, with a little around each. */
function found(re: RegExp, body: string): string[] {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  return [...body.matchAll(g)].map((m) => `…${body.slice(Math.max(0, m.index! - 32), m.index! + m[0].length + 32)}…`);
}
/** What a reader is told by each attribute that carries words (a photograph's
    description, a button's name). */
const attributeWords = (markup: string) =>
  [...markup.matchAll(/ (?:alt|aria-label|title|placeholder)="([^"]*)"/g)].map((m) => unescape(m[1]));

for (const lang of LANGS) {
  const c = getContent(lang);
  const markup = html[lang];
  const body = text(markup);
  const FIRM = c.company.name;

  describe(`${lang}: the home as rendered`, () => {
    // Spec item 1.
    it('has one h1, which is the hero’s headline, and an outline with no skipped level', () => {
      const headings = [...markup.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({
        level: Number(m[1]),
        text: text(m[2]),
      }));
      const h1 = headings.filter((x) => x.level === 1);
      expect(h1).toHaveLength(1);
      expect(h1[0].text).toBe(c.home.hero.titleLines.join(' '));
      expect(headings[0].level).toBe(1);
      for (let i = 1; i < headings.length; i++) {
        expect(headings[i].level - headings[i - 1].level, `${headings[i - 1].text} → ${headings[i].text}`).toBeLessThanOrEqual(1);
      }
      // The owner's on-page check lists more than 23 headings as too many.
      // One h1, nine h2 (the sections), ten h3 (the eight services and the
      // two counties); cards, credentials and tool rows are not headings.
      expect(headings.length).toBeLessThanOrEqual(23);
      expect(headings.filter((x) => x.level === 2)).toHaveLength(9);
      expect(headings.filter((x) => x.level === 3)).toHaveLength(10);
      expect(headings.filter((x) => x.level > 3)).toEqual([]);
    });

    it('has the five anchors the chrome points at, in order, and none of the old home’s', () => {
      const ids = ['services', 'credentials', 'where', 'tools', 'contact'];
      const at = ids.map((id) => markup.indexOf(`id="${id}"`));
      for (const [i, id] of ids.entries()) expect(at[i], id).toBeGreaterThan(-1);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      // `miami-dade`, `broward`, `new-buildings`, `pricing`, `jurisdictions`
      // and `contractor` were the old home's; links to the first two are
      // sent to the program pages by the first-frame script instead.
      for (const id of ['miami-dade', 'broward', 'new-buildings', 'pricing', 'jurisdictions', 'contractor', 'engineer', 'melvin', 'rudy']) {
        expect(markup, id).not.toContain(`id="${id}"`);
      }
      expect(markup).not.toMatch(/class="mp-team/);
    });

    it('carries the page language on its root, so the headlines are sized per locale', () => {
      // (React hoists HomeAddress's canonical and hreflang links above the root.)
      expect(markup).toContain(`<div class="mp-home" data-lang="${lang}">`);
      expect(markup.match(/class="mp-home"/g)).toHaveLength(1);
    });

    // Spec item 10 (and ads-pages.test.ts: no executable script on any page).
    it('prints no <script>', () => {
      expect(markup).not.toMatch(/<script\b/i);
    });

    // Spec item 2, over what a visitor reads and over what a screen reader or
    // a search engine is told about the pictures and the buttons.
    for (const [says, pattern] of NOT_ON_THE_HOME) {
      it(`says nothing of ${says}`, () => {
        expect(found(pattern, body)).toEqual([]);
        expect(attributeWords(markup).flatMap((w) => found(pattern, w))).toEqual([]);
      });
    }

    // Spec item 3. The firm's own name holds "Tercero Tablada" and the
    // contractor's card holds the contractor: the name is removed before the
    // person patterns are read, the card before the contractor's is.
    it('names the firm in full, and never with an ampersand', () => {
      expect(body).toContain(FIRM);
      // "Tercero Tablada" is only ever the first words of the full name.
      expect(found(/Tercero Tablada(?! Civil and Structural Engineering Inc\.)/, body)).toEqual([]);
      expect(found(/Tablada\s*(?:&|and)\s*(?:Associates|Partners|Co)\b|Civil\s*&\s*Structural/i, body)).toEqual([]);
    });

    const withoutFirm = (t: string) => t.split(FIRM).join(' ');
    for (const [says, pattern] of NOT_A_PERSON) {
      // The services are named "Assessments & Repairs": the ampersand rule is
      // about the firm's name, held above.
      if (says === 'an ampersand') continue;
      it(`says nothing of ${says}`, () => {
        const outside = markup.replace(contractorCard(markup), ' ');
        expect(found(pattern, withoutFirm(text(outside)))).toEqual([]);
        expect(attributeWords(outside).flatMap((w) => found(pattern, withoutFirm(w)))).toEqual([]);
      });
    }

    it('has no digit but the phone number, the two license numbers, the 30 years, the file size and the numerals of the tools and the rail', () => {
      let rest = body;
      for (const a of [
        c.contact.phone!.display,
        ...c.partner.construction.licenses.map((l) => l.number),
      ]) rest = rest.split(a).join(' ');
      // The numerals the page prints are the counts, not typed: the tool rows
      // (the open calculators, the guides) and the rail's counter ("01 / NN",
      // NN the cards it holds). A new calculator changes the first, a new
      // card the last; neither makes this test cry wolf.
      const pad = (n: number) => String(n).padStart(2, '0');
      const cards = (markup.match(/data-motion="rail-card"/g) ?? []).length;
      expect(cards).toBeGreaterThanOrEqual(1);
      for (const a of [
        /\b30\b/g,
        /\b25 MB\b/g,
        new RegExp(`\\b(?:${pad(openCalculatorCount)}|${pad(guideSlugs.length)})\\b`, 'g'),
        new RegExp(`\\b01 / ${pad(cards)}\\b`, 'g'),
      ]) rest = rest.replace(a, ' ');
      expect(found(/\d/, rest)).toEqual([]);
    });

    it('has no money: no currency sign, no figure “from”', () => {
      expect(found(/[$€£]|\bUSD\b/, markup)).toEqual([]);
      expect(found(/\bfrom\s+\d|\bdesde\s+\d/i, body)).toEqual([]);
    });
  });

  describe(`${lang}: the eight services (spec item 4, render part)`, () => {
    const servicesHtml = section(markup, 'services');
    const articles = [...servicesHtml.matchAll(/<article class="([^"]*)" style="([^"]*)">([\s\S]*?)<\/article>/g)].map((m) => ({
      cls: m[1],
      style: m[2],
      inner: m[3],
      slug: m[3].match(/href="[^"]*\/services\/([a-z-]+)"/)?.[1] ?? '',
      title: text(m[3].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? ''),
      h3: m[3].match(/<h3\b[^>]*>/)?.[0] ?? '',
    }));
    const place = (a: (typeof articles)[number]) => Number(a.style.match(/--o:(\d+)/)?.[1]) - 1;
    const ribbonA = markup.match(/<ul class="h-rib__list h-rib__a">[\s\S]*?<\/ul>/)![0];

    it('prints each of the eight services once, as a card whose title is the link', () => {
      expect(articles).toHaveLength(8);
      expect(articles.map((a) => a.slug).sort()).toEqual(c.services.map((s) => s.slug).sort());
      for (const a of articles) {
        const s = c.services.find((x) => x.slug === a.slug)!;
        expect(a.title, a.slug).toBe(s.title);
        // The whole card is the target through the title's link: one link in it.
        expect([...a.inner.matchAll(/<a\b/g)], a.slug).toHaveLength(1);
        expect(a.inner, a.slug).toContain(esc((c.home.services.lines as Record<string, string>)[a.slug]));
      }
    });

    it('puts them in home.order: the first two are not the county programs, which are 4th and 6th', () => {
      const byPlace = [...articles].sort((a, b) => place(a) - place(b)).map((a) => a.slug);
      expect(byPlace).toEqual([...c.home.order]);
      expect(byPlace.indexOf('building-recertification')).toBe(3);
      expect(byPlace.indexOf('broward-bsip')).toBe(5);
      for (const slug of ['building-recertification', 'broward-bsip']) {
        const i = byPlace.indexOf(slug);
        expect(i, `${slug}: services before it`).toBeGreaterThanOrEqual(2);
        expect(byPlace.length - 1 - i, `${slug}: services after it`).toBeGreaterThanOrEqual(2);
      }
      // The ribbon runs the same eight, in the same order.
      const ribbon = [...ribbonA.matchAll(/href="[^"]*\/services\/([a-z-]+)"/g)].map((m) => m[1]);
      expect(ribbon).toEqual([...c.home.order]);
    });

    it('draws the two county programs with the same component, class and title element as the other six', () => {
      expect(new Set(articles.map((a) => a.cls)).size).toBe(1);
      expect(new Set(articles.map((a) => a.h3)).size).toBe(1);
      expect(new Set(articles.map((a) => a.inner.match(/<a class="([^"]*)"/)?.[1])).size).toBe(1);
      // …and the same type in the ribbon: one list, one item class for all eight.
      expect([...ribbonA.matchAll(/<li>/g)]).toHaveLength(8);
    });

    it('prints the words recertification, BSIP and milestone only where the services are named', () => {
      // On the home the programs are two service names: in the ribbon, in
      // their cards and in the form's list of services, nowhere else.
      const outside = text(
        markup
          .replace(servicesHtml, ' ')
          .replace(/<div class="h-rib__rows"[\s\S]*?<\/section>/, ' ')
          .replace(/<select\b[\s\S]*?<\/select>/, ' '),
      );
      expect(found(words('recertif\\p{L}*', 'BSIP', 'milestone', 'hitos'), outside)).toEqual([]);
    });
  });

  describe(`${lang}: photographs and logos (spec item 5)`, () => {
    const tags = imgs(markup);
    const written = new Map<string, { alt: string; altEs: string }>();
    for (const p of Object.values(photo)) written.set(p.src, p);
    for (const clip of Object.values(video)) written.set(clip.poster, clip);

    it('has no <img> without a description', () => {
      expect(tags.length).toBeGreaterThanOrEqual(17);
      for (const tag of tags) expect(attr(tag, 'alt')?.trim(), tag).toBeTruthy();
    });

    it('describes each photograph with its catalogue description, and every image is aria-hidden', () => {
      const catalogued = tags.filter((tag) => written.has(attr(tag, 'src') ?? ''));
      // 8 services, the statement, the pause, 6 building types, the hero poster.
      expect(catalogued.length).toBeGreaterThanOrEqual(17);
      for (const tag of catalogued) {
        const m = written.get(attr(tag, 'src')!)!;
        expect(attr(tag, 'alt'), tag).toBe(esc(lang === 'es' ? m.altEs : m.alt));
      }
      // Decorative: the same words are printed beside each photograph (the
      // types rail) or the photograph illustrates a heading (pages.test.ts:
      // only the footer lockup is read out).
      for (const tag of tags) expect(attr(tag, 'aria-hidden'), tag).toBe('true');
    });

    it('does not use the worker with the trowel, and uses the spare photographs the spec names', () => {
      const stem = (src: string) => src.replace(/\.[a-z]+$/, '');
      expect(markup).not.toContain(stem(photo.repairSoffitTrowel.src));
      for (const p of [photo.midriseBalconies, photo.southFloridaAerial, photo.miamiTowersUp]) {
        expect(markup, p.src).toContain(stem(p.src));
      }
    });

    it('captions each building type with its photograph’s own description', () => {
      const from = markup.indexOf('class="h-types');
      const types = text(markup.slice(from, markup.indexOf('class="h-stack', from)));
      for (const p of [photo.houseConcreteGarden, photo.houseTownhouses, photo.frameCurvedBalconies, photo.frameCraneClean, photo.foundationMatPit, photo.midriseBalconies]) {
        expect(types, p.src).toContain(lang === 'es' ? p.altEs : p.alt);
      }
    });
  });

  describe(`${lang}: the credentials plate and the contractor (spec items 3 and 7)`, () => {
    const plate = section(markup, 'credentials');
    const k = c.partner.construction;
    const dbpr = esc(c.leadership.license!.url);

    it('puts the Precision Source logo, the role line and both license numbers in one card, as links to the state’s search', () => {
      const card = contractorCard(markup);
      expect(markup.split(k.logo.src).length - 1).toBe(1);
      expect(card).toContain(k.logo.src);
      expect(text(card)).toContain(k.role);
      expect(text(card)).toContain(k.name);
      for (const l of k.licenses) {
        const link = [...card.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter((m) => attr(m[1], 'href') === dbpr && text(m[2]).startsWith(l.number));
        expect(link, l.number).toHaveLength(1);
        expect(text(link[0][2]), l.number).toContain(c.ui.engineer.verify);
      }
    });

    it('names the contractor, and says “partner”, nowhere else', () => {
      const card = contractorCard(markup);
      const outside = markup.replace(card, ' ');
      expect(outside).not.toContain(k.logo.src);
      expect(found(words('Precision', k.licenses[0].number, k.licenses[1].number), text(outside))).toEqual([]);
      expect(found(words('contractors?', 'contratistas?', 'partners?', 'aliad[oa]s?', 'socios?'), text(outside))).toEqual([]);
      expect(text(card).match(lang === 'en' ? /\bpartner\b/gi : /\baliad[oa]\b/gi) ?? []).toHaveLength(1);
    });

    it('prints the sentence of the plate once, as one text node, and no engineering license number', () => {
      expect(body.split(c.partner.lede).length - 1).toBe(1);
      expect(markup.split(`>${esc(c.partner.lede)}<`).length - 1).toBe(1);
      for (const no of ['105256', '40285']) expect(body, no).not.toContain(no);
      expect(text(plate)).toContain(c.company.registry);
    });

    it('carries the three disciplines with their marks: PE, the Special Inspector credential and PE, and prints SE and FRSE nowhere', () => {
      const h2 = plate.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)![1];
      const tagTexts = [...h2.matchAll(/<span class="h-cred__tag(?: h-cred__tag--wide)?">([^<]*)<\/span>/g)].map((m) => m[1]);
      expect(tagTexts).toEqual([...c.home.credentials.marks]);
      // (The accent word is a span of its own: the text has a space before
      // the full stop that follows it.)
      const heading = text(h2).replace(/\s+([.,])/g, '$1');
      for (const [i, line] of c.home.credentials.titleLines.entries()) {
        expect(heading, line).toContain(`${line} ${c.home.credentials.marks[i]}`);
      }
      // Never "SE": a license Florida does not have; never "FRSE": the
      // Board's recognition, which nothing public shows the associate holds.
      expect(found(wordsExact('SE', 'S\\.E\\.'), body)).toEqual([]);
      expect(found(/licensed structural engineers?|ingenieros estructurales con licencia/i, body)).toEqual([]);
      expect(body).not.toContain('FRSE');
    });

    it('names the electrical engineers in the hero’s eyebrow and the plate’s headline, and nowhere else', () => {
      const electrical = lang === 'en' ? /\belectrical engineers?\b/gi : /\bingenieros? el[eé]ctricos?\b/gi;
      expect([...body.matchAll(electrical)]).toHaveLength(2);
      expect(text(markup.match(/<p class="h-hero__eyebrow">[\s\S]*?<\/p>/)![0])).toMatch(electrical);
      expect(text(plate.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/)![0])).toMatch(electrical);
    });
  });

  describe(`${lang}: the tools, the offices and the contact block (spec item 8, numerals printed)`, () => {
    it('prints the count of calculators and of guides as a numeral and in words, equal to the real counts', () => {
      const tools = text(section(markup, 'tools'));
      const pad = (n: number) => String(n).padStart(2, '0');
      expect(tools).toContain(`${pad(openCalculatorCount)} ${withNumberWord(c.home.tools.calc.title, openCalculatorCount, lang)}`);
      expect(tools).toContain(`${pad(guideSlugs.length)} ${withNumberWord(c.home.tools.guides.title, guideSlugs.length, lang)}`);
      const names = calculatorFamilies.flatMap((f) => f.items).filter((i) => i.href).map((i) => i.name[lang]);
      for (const n of names) expect(tools, n).toContain(n);
    });

    it('has the real form, with the home’s two strings and no service preset, and four direct lines', () => {
      const contact = section(markup, 'contact');
      expect(contact).toContain('data-variant="home"');
      expect(contact).toContain(esc(c.home.form.messagePlaceholder));
      expect(contact).toContain(esc(c.home.form.attachmentsHint));
      expect(contact).toContain(`href="${c.contact.phone!.href}"`);
      expect(contact).toContain(`href="mailto:${c.contact.email}"`);
      expect(contact).toContain('href="#where"');
      expect(text(contact)).toContain(c.contact.phone!.display);
      expect(text(contact)).toContain(c.contact.serviceAreaLabel);
      // A different form for the home would be a different promise.
      expect(contact).toMatch(/<form\b/);
      expect(contact).not.toContain('?service=');
    });

    it('prints the disclaimer of the county logos once, and the logo of the two counties only', () => {
      expect(body.split(c.pricing.jurisdictions.disclaimer).length - 1).toBe(1);
      expect(markup.match(/\/ttc\/img\/jurisdictions\/[a-z-]+\.webp/g)?.sort()).toEqual([
        '/ttc/img/jurisdictions/broward.webp',
        '/ttc/img/jurisdictions/miami-dade.webp',
      ]);
    });

    // QA finding F1: the form lists the services in the order of the ribbon
    // and the cards, where the two county programs are the 4th and the 6th,
    // not first. The same options as every other form, only the order.
    it('lists the form’s services in home.order, the county programs 4th and 6th, "other" last', () => {
      const select = section(markup, 'contact').match(/<select\b[\s\S]*?<\/select>/)![0];
      const options = [...select.matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/g)].map((m) => unescape(m[1]));
      expect(options[0]).toBe(c.ui.form.selectService);
      const title = (slug: string) => c.services.find((s) => s.slug === slug)!.shortTitle;
      expect(options.slice(1, 9)).toEqual(c.home.order.map(title));
      expect(options[4]).toBe(title('building-recertification'));
      expect(options[6]).toBe(title('broward-bsip'));
      expect(options.slice(9)).toEqual([c.contactServiceOptions[c.contactServiceOptions.length - 1]]);
    });
  });

  // QA findings A3 / F3 (WCAG 1.3.2, 2.4.3): what a keyboard and a screen
  // reader meet is the order of the markup, so the markup is in the order a
  // phone shows it. (home-order.test below holds that no stylesheet rule
  // moves these blocks with `order` again.)
  describe(`${lang}: the order of the markup is the order of the page`, () => {
    it('contact: the form, then the four direct lines', () => {
      const contact = section(markup, 'contact');
      const form = contact.indexOf('<form');
      const lines = contact.indexOf('class="h-contact__lines"');
      expect(form).toBeGreaterThan(-1);
      expect(lines).toBeGreaterThan(form);
    });

    it('BIM: the heading and the link, then the frame and its pause switch', () => {
      const bim = markup.slice(markup.indexOf('aria-labelledby="h-bim-title"'));
      const text = bim.indexOf('class="h-bim__text"');
      const media = bim.indexOf('class="h-bim__media"');
      expect(text).toBeGreaterThan(-1);
      expect(media).toBeGreaterThan(text);
    });

    it('services: each track in turn, the cards of one track in home.order (the phone shows them that way)', () => {
      const cards = [...section(markup, 'services').matchAll(/<article\b[\s\S]*?href="[^"]*\/services\/([a-z-]+)"/g)].map((m) => m[1]);
      const track = (slug: string) => c.services.find((s) => s.slug === slug)!.track;
      expect(cards).toEqual([
        ...c.home.order.filter((slug) => track(slug) === 'new'),
        ...c.home.order.filter((slug) => track(slug) === 'existing'),
      ]);
    });
  });

  // QA finding F2 / A8: the long credential closes its own line in the
  // heading's accessible name, and no mark runs into the next discipline.
  describe(`${lang}: the credentials heading, as it is read out`, () => {
    it('closes each mark with a spoken full stop, outside the visible tag', () => {
      const h2 = section(markup, 'credentials').match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)![1];
      const marks = c.home.credentials.marks;
      for (const m of marks) {
        expect(h2, m).toContain(`${esc(m)}</span><span class="mp-sr-only">. </span>`);
      }
      expect(h2.match(/class="mp-sr-only"/g)).toHaveLength(marks.length);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   3 · WHAT HAPPENS AFTER A SEND (QA finding F1)
   ═══════════════════════════════════════════════════════════════════════
   The success block and its live region are client state, so the render
   guards above never see them: the home form reads its own three texts
   (`ui.form.home.successBody`, `successNote`, `nextSteps`), which the
   data-level guards at the top already hold against the owner's vocabulary
   (`homeStrings` reads every key of `ui.form.home`). What is pinned here is
   that they exist, that they ARE NOT the page form's (which promise a reply
   within two hours and speak of a deadline, a proposal, a fee and the
   engineer), and that the form takes them.
   ═══════════════════════════════════════════════════════════════════════ */

describe('what the home form says after a send, in the firm’s voice', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const home = c.ui.form.home;

    it(`${lang}: has its own success body, note and next steps`, () => {
      for (const t of [home.successBody, home.successNote, ...home.nextSteps]) expect(t.trim(), t).not.toBe('');
      expect(home.successBody).not.toBe(c.ui.form.successBody);
      expect(home.successNote).not.toBe(c.ui.form.successNote);
      expect([...home.nextSteps]).not.toEqual([...c.ui.form.nextSteps]);
      expect(home.nextSteps.length).toBeGreaterThanOrEqual(1);
    });

    it(`${lang}: the page form’s three texts WOULD be refused, so the patterns do see them`, () => {
      const refused = (t: string) =>
        NOT_ON_THE_HOME.some(([, re]) => re.test(t)) || NOT_A_PERSON.some(([, re]) => re.test(t));
      // The body (a reply time, the engineer) and the note (a deadline, a
      // proposal) are each refused; so is at least one of the next steps
      // (the engineer reads, a fee).
      expect(refused(c.ui.form.successBody), c.ui.form.successBody).toBe(true);
      expect(refused(c.ui.form.successNote), c.ui.form.successNote).toBe(true);
      expect(c.ui.form.nextSteps.some(refused)).toBe(true);
      for (const t of [home.successBody, home.successNote, ...home.nextSteps]) {
        expect(NOT_ON_THE_HOME.filter(([, re]) => re.test(t)).map(([says]) => says), t).toEqual([]);
        expect(NOT_A_PERSON.filter(([, re]) => re.test(t)).map(([says]) => says), t).toEqual([]);
      }
    });

    it(`${lang}: keeps the legal substance: sending does not engage the firm, and nothing starts until a written scope`, () => {
      expect(home.successNote).toMatch(lang === 'en' ? /does not engage us/ : /no nos contrata/);
      expect(home.successNote).toMatch(lang === 'en' ? /written scope/ : /alcance por escrito/);
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   4 · THE STYLESHEETS AND THE CLIENT BOUNDARY (QA findings A3, F6)
   ═══════════════════════════════════════════════════════════════════════ */

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** [selector, body] of every rule of a stylesheet, nested ones (@media) too. */
function rules(css: string): { selector: string; body: string }[] {
  return [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));
}

describe('home-order: no stylesheet rule moves the cards, the BIM frame or the contact lines with `order`', () => {
  const dir = join(process.cwd(), 'src/app/(public)');
  for (const file of ['home.css', 'home-lower.css', 'home-motion.css']) {
    it(`${file}`, () => {
      const moved = rules(readFileSync(join(dir, file), 'utf8'))
        .filter(({ selector }) => /h-svc|h-card|h-bim__media|h-bim__text|h-contact__lines|h-contact__form/.test(selector))
        .filter(({ body }) => /(?:^|[;\s])order\s*:/.test(body))
        .map(({ selector }) => selector);
      expect(moved).toEqual([]);
    });
  }
});

describe('the client boundary of the home (spec §5.2: only the islands are client components)', () => {
  const dir = join(process.cwd(), 'src/components/ttc/mp/home');
  const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'));

  it('has client code only in the four islands', () => {
    const client = files.filter((f) => /^\s*['"]use client['"]/.test(readFileSync(join(dir, f), 'utf8'))).sort();
    expect(client).toEqual(['Parallax.tsx', 'RibbonRows.tsx', 'StackFocus.tsx', 'TypesRail.tsx']);
  });

  it('reads no language from the browser: no section uses useContent or useLang', () => {
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/\buse(?:Content|Lang)\b/);
    }
  });
});
