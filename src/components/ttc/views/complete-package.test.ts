import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent, type SiteContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { serviceLd, siteGraph } from '@/lib/ttc/structured-data';
import { JUMP_ID } from '@/components/ttc/mp/JumpLinks';
import { AboutView } from './AboutView';
import { ContactView } from './ContactView';
import { ExistingView } from './ExistingView';
import { HomeView } from './HomeView';
import { LegalView } from './LegalView';
import { ServiceDetailView } from './ServiceDetailView';
import { ServicesView } from './ServicesView';
import { WorkView } from './WorkView';
import { SEO } from './seo';

/**
 * ONE TEAM DELIVERS THE COMPLETE PACKAGE — the owner's decision of October
 * 7, 2026 ("es completo que hacemos nosotros": structural, electrical,
 * parking lot illumination, thermography, parking lot guardrail).
 *
 * Until that day every page said the firm's part of a recertification was
 * "the structural side". The copy now says the team delivers every report
 * and certificate the county asks for — and WHAT a county asks for is not
 * the same in the two counties (read at the primary sources that day; the
 * header of site.ts has the list). Three things can go wrong from here, and
 * none of them breaks a build:
 *
 *   • an editor "corrects" a sentence back to "the structural report";
 *   • Miami-Dade's parking-lot certificates or its thermography rule are
 *     pasted onto the Broward page, whose Board asks for neither;
 *   • a condition is sharpened into a number (amperes, foot-candles) or
 *     dropped ("thermography" with no "where…"), or the copy starts saying
 *     who signs which part.
 *
 * So the pages are rendered here, as pages.test.ts renders them, and read.
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const RECERT = 'building-recertification';
const BSIP = 'broward-bsip';

function views(lang: Lang): [path: string, view: ReactElement][] {
  return [
    ['/', h(HomeView, { lang })],
    ['/services', h(ServicesView, { lang })],
    ['/existing-buildings', h(ExistingView, { lang })],
    ['/about', h(AboutView, { lang })],
    ['/contact', h(ContactView, { lang })],
    ['/projects', h(WorkView, { lang })],
    ['/privacy', h(LegalView, { lang, kind: 'privacy' })],
    ['/terms', h(LegalView, { lang, kind: 'terms' })],
    ...getContent(lang).services.map(
      (s): [string, ReactElement] => [`/services/${s.slug}`, h(ServiceDetailView, { lang, slug: s.slug })],
    ),
  ];
}

const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
/** The page as a reader gets it: no scripts (so no JSON-LD), no tags. */
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
/** Every paragraph, list item and table cell of a page, as text. */
const blocks = (html: string) =>
  [...html.matchAll(/<(p|li|dd)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(m[2])).filter(Boolean);
/** Every string of a piece of content, wherever it sits. */
const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : value && typeof value === 'object'
      ? Object.values(value).flatMap(strings)
      : [];

const html = new Map<string, string>();
for (const lang of LANGS) {
  for (const [path, view] of views(lang)) {
    route.pathname = localePath(path, lang);
    html.set(`${lang} ${path}`, renderToStaticMarkup(view));
  }
}
const page = (lang: Lang, path: string) => html.get(`${lang} ${path}`)!;
const svc = (c: SiteContent, slug: string) => c.services.find((s) => s.slug === slug)!;

/* What Miami-Dade's package has and Broward's does not, in the words either
   language would print it with. "Guardrails" alone is not on the list: they
   are an item of Broward's structural inspection, and its page says so. */
const MIAMI_DADE_ONLY: Record<Lang, RegExp> = {
  en: /illumination certif|parking[- ]lot illumination|guardrail certif|parking[- ]lot (?:certif|guardrail)|light levels?|8C-/i,
  es: /iluminación del estacionamiento|certificados? de (?:iluminación|barandas)|certificados? del estacionamiento|niveles de iluminación|8C-/i,
};
const THERMOGRAPHY = /thermograph|termograf/i;
/* What Broward's package has and Miami-Dade's does not. */
const BROWARD_ONLY: Record<Lang, RegExp> = {
  en: /narrative report|completion letter|Safety Inspection Report Form|Policy #05-05/i,
  es: /informe narrativo|carta de finalización|Safety Inspection Report Form|Política n\.º 05-05/i,
};

describe('each program page lays out its own county’s package, part by part', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    for (const slug of [RECERT, BSIP]) {
      const service = svc(c, slug);
      const own = page(lang, `/services/${slug}`);
      const packet = service.packet!;

      it(`${slug} (${lang}): one block, a definition list with a row per part`, () => {
        const found = own.match(/<div class="[^"]*mp-packet[^"]*"[^>]*>([\s\S]*?)<\/dl>/g) ?? [];
        expect(found).toHaveLength(1);
        const block = found[0] ?? '';
        expect(block).toContain(`<p class="mp-packet__label">${esc(packet.label)}</p>`);
        expect(block).toContain(`<p class="mp-packet__lede">${esc(packet.lede)}</p>`);
        const rows = [...block.matchAll(/<div><dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd><\/div>/g)].map((m) => [m[1], m[2]]);
        expect(rows).toEqual(packet.parts.map((p) => [esc(p.k), esc(p.v)]));
        expect(own).toContain(`<p class="mp-packet__note">${esc(packet.note)}</p>`);
        // A part of a packet is not a section of the page: the block adds no
        // heading (the page is at its ceiling — pages.test.ts).
        expect(block).not.toMatch(/<h[1-6]\b/);
      });

      // Under "What you receive", whose first line names the package, and
      // before the table of ages and deadlines.
      it(`${slug} (${lang}): it follows “What you receive”, whose first line names the complete package`, () => {
        const receive = own.indexOf(`id="${JUMP_ID.receive}"`);
        const block = own.indexOf('mp-packet__label');
        const applies = own.indexOf(`id="${JUMP_ID.applies}"`);
        expect(receive).toBeGreaterThan(-1);
        expect(block).toBeGreaterThan(receive);
        expect(applies).toBeGreaterThan(block);
        expect(service.deliverables[0]).toMatch(/complete|completo/i);
      });

      it(`${slug} (${lang}): every row has a name and a whole sentence, and types no number`, () => {
        expect(packet.parts.length).toBeGreaterThanOrEqual(6);
        expect(new Set(packet.parts.map((p) => p.k)).size).toBe(packet.parts.length);
        for (const p of packet.parts) {
          expect(p.k.trim(), p.k).not.toBe('');
          expect(p.v.endsWith('.'), p.v).toBe(true);
          expect(p.v.split(/\s+/).length, p.v).toBeGreaterThanOrEqual(8);
        }
        for (const s of [packet.label, packet.lede, packet.note, ...packet.parts.flatMap((p) => [p.k, p.v])]) {
          expect(s, s).not.toMatch(/\d/);
        }
      });

      // The first screen: the line under the H1 says it, with no list of who
      // does what.
      it(`${slug} (${lang}): the first line under the H1 says complete, and one team`, () => {
        expect(service.heroSub).toMatch(/\bcomplet[eoa]\b/i);
        expect(service.heroSub).toMatch(/one team|un solo equipo/i);
        expect(own).toContain(esc(service.heroSub!));
        // The line sits between the H1 and the button: it was measured on a
        // phone at this length (site.ts), and a longer one pushes the button
        // off the first screen.
        expect(service.heroSub!.length, service.heroSub).toBeLessThanOrEqual(170);
      });
    }

    it(`${lang}: the Spanish mirror has the same rows, in the same order`, () => {
      for (const slug of [RECERT, BSIP]) {
        expect(svc(c, slug).packet!.parts).toHaveLength(svc(getContent('en'), slug).packet!.parts.length);
      }
    });

    it(`${lang}: only the two county programs carry a package`, () => {
      expect(c.services.filter((s) => s.packet).map((s) => s.slug)).toEqual([RECERT, BSIP]);
    });
  }
});

describe('Miami-Dade: every part the county asks for is named, each with its condition', () => {
  /* The parts verified on October 7, 2026 (county recertification page,
     upload guidelines, the two report forms, the two parking-lot forms). */
  const PARTS: Record<Lang, RegExp[]> = {
    en: [
      /structural report/i,
      /electrical report/i,
      /infrared thermography/i,
      /parking-lot illumination certificate/i,
      /parking-lot guardrail certificate/i,
      /cover letter/i,
      /photographs/i,
      /site plan/i,
      /survey/i,
    ],
    es: [
      /informe estructural/i,
      /informe eléctrico/i,
      /termografía infrarroja/i,
      /certificado de iluminación del estacionamiento/i,
      /certificado de barandas \(guardrails\) del estacionamiento/i,
      /carta de presentación/i,
      /fotografías/i,
      /plano del sitio/i,
      /levantamiento/i,
    ],
  };

  for (const lang of LANGS) {
    const own = page(lang, `/services/${RECERT}`);
    const service = svc(getContent(lang), RECERT);

    it(`(${lang}) the package names all of them`, () => {
      const packet = strings(service.packet).join(' ');
      for (const part of PARTS[lang]) expect(packet, String(part)).toMatch(part);
    });

    // "Required where X" must never become "always". Every sentence block
    // of the page that names thermography says when it applies.
    it(`(${lang}) thermography is never named without its condition`, () => {
      const naming = blocks(own).filter((b) => THERMOGRAPHY.test(b));
      expect(naming.length).toBeGreaterThanOrEqual(3);
      for (const b of naming) expect(b, b).toMatch(/where|donde|dónde|cuándo aplica/i);
      // …and it is an attachment to the electrical report, not a certificate.
      const row = service.packet!.parts.find((p) => THERMOGRAPHY.test(p.k))!;
      expect(row.v).toMatch(/attached to the electrical report|se adjunta al informe eléctrico/i);
      expect(strings(service).join(' ')).not.toMatch(/thermography certificate|certificado de termograf/i);
    });

    // The two parking-lot forms record a measurement and a finding.
    it(`(${lang}) no parking-lot certificate is said to be due for every building, or to pass`, () => {
      for (const s of strings(service)) {
        expect(s, s).not.toMatch(/certif\w+ (?:that )?the (?:parking )?lot (?:complies|passes|meets)|certificamos que/i);
        expect(s, s).not.toMatch(/(?:illumination|guardrail)[^.]*(?:every|all) buildings?|(?:iluminación|barandas)[^.]*todos los edificios/i);
      }
      const guardrail = service.packet!.parts.find((p) => /guardrail/i.test(p.k))!;
      expect(guardrail.v).toMatch(/whether|sobre si/i);
    });

    it(`(${lang}) the page prints nothing of Broward’s package`, () => {
      expect(text(own)).not.toMatch(BROWARD_ONLY[lang]);
    });
  }
});

describe('Broward: the BSIP’s own parts, and none of Miami-Dade’s certificates', () => {
  /* The parts verified on October 7, 2026 (Policy #05-05, its guidelines and
     the Board's two report forms, as posted that day). */
  const PARTS: Record<Lang, RegExp[]> = {
    en: [
      /narrative report/i,
      /Structural Safety Inspection Report Form/,
      /Electrical Safety Inspection Report Form/,
      /color photographs/i,
      /guardrails/i,
      /parking garage/i,
      /wiring at parking lots and garages/i,
      /drawings or sketches/i,
      /summary of the report/i,
      /cover sheet/i,
    ],
    es: [
      /informe narrativo/i,
      /Structural Safety Inspection Report Form/,
      /Electrical Safety Inspection Report Form/,
      /fotografías a color/i,
      /barandas/i,
      /garaje de estacionamiento/i,
      /cableado de estacionamientos y garajes/i,
      /planos o croquis/i,
      /resumen del informe/i,
      /hoja de portada/i,
    ],
  };

  for (const lang of LANGS) {
    const own = page(lang, `/services/${BSIP}`);
    const service = svc(getContent(lang), BSIP);

    it(`(${lang}) the package names all of them`, () => {
      const packet = strings(service.packet).join(' ');
      for (const part of PARTS[lang]) expect(packet, String(part)).toMatch(part);
    });

    // The Board asks for no parking-lot illumination certificate and no
    // guardrail certificate: neither is printed here, not even to say so.
    it(`(${lang}) no Miami-Dade certificate is printed on the page or held in its content`, () => {
      expect(text(own)).not.toMatch(MIAMI_DADE_ONLY[lang]);
      expect(strings(service).join(' ')).not.toMatch(MIAMI_DADE_ONLY[lang]);
    });

    // The Board's current policy does not ask for thermography. The page may
    // say exactly that, once, and nothing that makes it a requirement.
    it(`(${lang}) thermography is named only to say the Board does not ask for it`, () => {
      const naming = blocks(own).filter((b) => THERMOGRAPHY.test(b));
      expect(naming).toEqual([text(esc(service.packet!.note))]);
      expect(service.packet!.note).toMatch(/does not ask for|no pide/i);
      expect(own.split(/thermograph|termograf/i).length - 1).toBe(1);
    });
  }
});

describe('the whole site: the firm’s part no longer ends at the structural report', () => {
  /* The sentences the site used to print, in the forms they took. A
     structural THING is still structural ("structural inspection of the
     frame", "their structural report must come from…"): what must not come
     back is the firm's share described as the structural half. */
  const STRUCTURAL_ONLY: Record<Lang, RegExp> = {
    en: /structural side|structural part of (?:it|the)|prepare the structural report|proposal for the inspection and the structural report|files? the structural report|(?:only|just) the structural (?:report|part|side)|structural report on the (?:official form|county|program)/i,
    es: /parte estructural|preparamos el informe estructural|propuesta para la inspección y el informe estructural|presenta el informe estructural|solo (?:el|la) (?:informe|parte) estructural|informe estructural en el formulario/i,
  };

  /* Only the pages that describe the county programs: "the structural side
     of the model" on the BIM page is not the firm's share of a
     recertification. */
  const PROGRAM_PAGES = [
    '/',
    '/services',
    '/existing-buildings',
    '/projects',
    `/services/${RECERT}`,
    `/services/${BSIP}`,
    '/services/milestone-inspections',
  ];

  for (const lang of LANGS) {
    for (const [path] of views(lang).filter(([p]) => PROGRAM_PAGES.includes(p))) {
      it(`${lang} ${path}: no sentence says so`, () => {
        expect(text(page(lang, path))).not.toMatch(STRUCTURAL_ONLY[lang]);
      });
    }

    it(`${lang}: nor does a title, a description or the structured data`, () => {
      const c = getContent(lang);
      const meta = [
        ...Object.values(SEO[lang]).flatMap((s) => [s.title, s.description]),
        ...c.services.flatMap((s) => [s.seo.title, s.seo.description, s.summary]),
        ...strings(siteGraph(lang, { url: '/card.jpg', width: 1200, height: 630 })),
        ...c.services.flatMap((s) => strings(serviceLd(lang, s))),
      ];
      for (const s of meta) {
        expect(s, s).not.toMatch(STRUCTURAL_ONLY[lang]);
        expect(s, s).not.toMatch(/P\.E\. inspects and files|P\.E\. de Florida (?:inspecciona y )?presenta/i);
      }
    });

    // What a search engine is told about the two programs is what the page
    // says: the description of each Service node names the electrical half.
    it(`${lang}: the two programs’ descriptions name the electrical half`, () => {
      const c = getContent(lang);
      for (const slug of [RECERT, BSIP]) {
        const s = svc(c, slug);
        expect(serviceLd(lang, s).description).toBe(s.seo.description);
        expect(s.seo.description).toMatch(/electrical|eléctric/i);
        expect(s.seo.description).toMatch(/complete|complet[oa]|one team|un solo equipo/i);
        // The catalogue entry of the site-wide graph carries the card's line.
        expect(s.summary).toMatch(/complete|complet[oa]/i);
        expect(s.summary).toMatch(/one team|un solo equipo/i);
      }
    });

    // Where a page speaks of both counties at once, it says "the complete
    // package each county asks for" and names no certificate: Miami-Dade's
    // are not Broward's.
    it(`${lang}: the pages that speak of both counties name no county’s certificate`, () => {
      const c = getContent(lang);
      for (const path of ['/', '/existing-buildings', '/projects', '/services/milestone-inspections']) {
        const t = text(page(lang, path));
        expect(t, path).not.toMatch(MIAMI_DADE_ONLY[lang]);
        expect(t, path).not.toMatch(THERMOGRAPHY);
      }
      expect(c.existingPage.timeline.lede).toMatch(/each county asks for|pide cada condado/i);
      // On /services each card is one county's: Broward's names none.
      const card = c.services.find((s) => s.slug === BSIP)!;
      for (const line of [card.summary, card.card.when, card.card.receive, card.card.next, ...card.capabilities]) {
        expect(line, line).not.toMatch(MIAMI_DADE_ONLY[lang]);
        expect(line, line).not.toMatch(THERMOGRAPHY);
      }
    });
  }
});

describe('the whole site: conditions in words, and no word on who signs which part', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const all = strings(c);

    // No ampere rating, no foot-candle level, no thermographer's grade: the
    // numbers behind "where the electrical service requires it" and "the
    // county's standard" stay in the county's own texts.
    it(`${lang}: no amperes and no foot-candles are typed anywhere`, () => {
      const unit = /\bamp(?:s|eres?)?\b|\bamperios?\b|foot[- ]?candles?|pie[- ]?candelas?|\bcandelas?\b|\blux\b/i;
      expect(all.filter((s) => unit.test(s))).toEqual([]);
    });

    // "We" / "our team" / "one team" delivers the package. No sentence says
    // which person or which firm prepares, signs or seals a part, and no
    // credential is claimed that the site does not show.
    it(`${lang}: no part is assigned to a person, a trade or a firm`, () => {
      const who = /electrical engineer|certified thermographer|thermographer|licensed electrician|ingenier[oa] (?:eléctric[oa]|electricista)|termógraf[oa]|electricista/i;
      expect(all.filter((s) => who.test(s))).toEqual([]);
      // With the package complete, "signed by the same person" on the home
      // teaser or on /about reads as one engineer signing every part.
      expect([c.leadership.teaser, ...c.leadership.forYou.flatMap((r) => [r.v, r.teaser])].join(' ')).not.toMatch(
        /signed by|signs the report|firma la misma persona|firma el informe/i,
      );
      for (const slug of [RECERT, BSIP]) {
        const own = strings(svc(c, slug)).join(' ');
        expect(own).not.toMatch(/Precision Source/i);
        expect(own).not.toMatch(/both reports, one engineer|los dos informes, un (?:solo )?ingeniero/i);
      }
      // The new block and the new lines say "signed and sealed" of a
      // document, never of a person: no "signed by", no "we sign".
      for (const slug of [RECERT, BSIP]) {
        const s = svc(c, slug);
        const fresh = [...strings(s.packet), s.heroSub ?? '', s.summary, ...Object.values(s.card), s.program!.lede].join(' ');
        expect(fresh).not.toMatch(/signed by|sealed by|we sign|we seal|firmad[oa]s? por|sellad[oa]s? por|firmamos|sellamos/i);
      }
    });

    // "Complete" is the package, never the outcome: each program page says
    // so under "Good to know", in its own words.
    it(`${lang}: each program page says a complete package is not a closed file`, () => {
      const caveat = /complete package is not yet a closed|paquete completo todavía no es/i;
      for (const slug of [RECERT, BSIP]) {
        expect(svc(c, slug).considerations.filter((x) => caveat.test(x))).toHaveLength(1);
      }
      expect(all.join(' ')).not.toMatch(/guarantee[sd]? (?:the )?recertification|garantizamos la recertificación/i);
    });
  }
});
