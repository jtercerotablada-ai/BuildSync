import { describe, expect, it } from 'vitest';
import { openCalculatorPaths } from '@/lib/ttc/calculator-paths';
import { calculatorFamilies, openCalculatorCount } from '@/lib/ttc/calculators';
import { getContent } from '@/lib/ttc/content';
import { getGuides } from '@/lib/ttc/guide-content';
import { guideSlugs } from '@/lib/ttc/guides';
import type { Lang } from '@/lib/ttc/i18n';
import { NUMBER_WORD_MAX, numberWord, withNumberWord } from '@/lib/ttc/number-words';
import { SEO } from './seo';

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
 *   2. RENDER-BASED GUARDS (to be added by the slice that rewrites
 *      `HomeView`, under the heading at the bottom of this file, in their
 *      own `describe` blocks, with `renderToStaticMarkup(HomeView)` and the
 *      same `route` mock the other view tests use): 1 (one h1, headings
 *      ≤ 23), 2 and 3 again over the rendered text, 4 (the eight services
 *      once each; the two program cards in the same component and size
 *      class), 5 (no money, every <img> has an alt, every photograph with
 *      its catalogue alt and aria-hidden, no repairSoffitTrowel), 7 (the
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
    // no SE license; it has the board's recognition, FRSE (Florida Board
    // Recognized Structural Engineer, s. 471.055 F.S.), which its holders "may
    // identify ... in marketing and advertising". So the structural line
    // carries "FRSE" as its mark, and "SE" itself is printed nowhere.
    it(`${lang}: the Structural Engineers line carries FRSE, and "SE" is printed nowhere`, () => {
      const c = getContent(lang);
      expect(c.home.credentials.marks).toEqual(['PE', 'FRSE', 'PE']);
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
    ]) expect(find(NOT_ON_THE_HOME, bad), bad).toBe(true);
    for (const bad of [
      'Juan Tercero founded the firm',
      'I started this practice',
      'Our principal engineer',
      'Licensed Structural Engineers',
      'Ingenieros estructurales con licencia',
      'Our team of eight engineers',
      'Tres ingenieros',
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

  /**
   * Strings the new home shares with the OLD home's, for now. Both are lines
   * the owner approved and the new home keeps; the old sections that print
   * them go in the slice that rewrites HomeView, and these two keys go (or
   * stay as unprinted data) with them. DELETE THIS LIST WITH THE OLD HOME.
   *
   *   • `newBuildings.title` — "From a single house to a mid-rise concrete
   *     frame." is `home.types.title`.
   *   • `pricing.jurisdictions.title` — "The offices we file with." is
   *     `home.where.title` (the JurisdictionsSection of the old home).
   */
  const UNTIL_THE_OLD_HOME_GOES = new Set(['newBuildings.title', 'pricing.jurisdictions.title']);

  for (const lang of LANGS) {
    const c = getContent(lang);

    it(`${lang}: no block of six words or more is also another string of the bundle`, () => {
      // Where each string of the bundle is, by its words. `home.*` and
      // `ui.form.home` are the same strings under two keys, so neither
      // counts as "somewhere else".
      const where = new Map<string, string[]>();
      for (const e of entries(c, '')) {
        if (e.path.startsWith('home.') || e.path.startsWith('ui.form.home')) continue;
        if (UNTIL_THE_OLD_HOME_GOES.has(e.path)) continue;
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
      'home.credentials.marks[0]', // "PE", "FRSE", "PE": credential marks
      'home.credentials.marks[1]',
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
   2 · RENDER-BASED GUARDS — added by the slice that rewrites HomeView
   ═══════════════════════════════════════════════════════════════════════
   Spec §6.4, "New views/home.test.ts", items 1, 2 and 3 (over the rendered
   text, with tags and attributes stripped; reuse NOT_ON_THE_HOME and
   NOT_A_PERSON above, whitelisting the phone number, the two license
   numbers, "30", "25 MB", the copyright year and the two tool numerals),
   4 (render part), 5, 7, 8 (render part) and 10. Each in its own `describe`,
   in both languages, with `renderToStaticMarkup(h(HomeView, { lang }))`.
   ═══════════════════════════════════════════════════════════════════════ */
