import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Lang } from '@/lib/ttc/i18n';

/**
 * GOOGLE ADS MEASUREMENT AND THE PAGES, IN BOTH STATES OF THE SWITCH.
 *
 * The switch is four build-time variables read by one module (lib/ttc/ads.ts).
 * It decides two things at once — whether the public shell prints the
 * bootstrap script, and which text the Privacy page prints — and the point of
 * one switch is that the two cannot disagree. So every public page is rendered
 * here twice, inside the real shell, exactly as the layouts mount it:
 *
 *   OFF (no variable set — the state the site is in today): no page carries a
 *       script of any kind beyond its structured data, no page names one of
 *       Google's advertising hosts, and the Privacy page is, to the letter,
 *       the text it had before any of this existed.
 *   ON  (the variables set, as a deployment would): the script is on every
 *       public page, once, in the shell and nowhere else; the staff
 *       application's shell has nothing; and the Privacy page says, in both
 *       languages, who gets Google's tag, what it stores and sends, and how
 *       to be rid of it — and no longer says the pages set no cookies.
 *
 * Everything the earlier releases settled is checked again with the switch
 * on, because that is the state nobody looks at: the heading ceiling of the
 * service pages, the six outside hosts the site may link, no block of six or
 * more words printed on two pages, the same titles and descriptions, and the
 * same rule for the legal pages (what the code does; no legal position).
 *
 * The modules read the variables when they are first imported, so each state
 * is its own import of the whole site (`vi.resetModules`), not a parameter.
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {}, back() {} }),
  useSearchParams: () => new URLSearchParams(),
}));
// next/font is resolved by the Next compiler; outside it the shells only need
// the class names the loaders return.
vi.mock('next/font/google', () => {
  const font = () => ({ variable: 'font-var', className: 'font-class', style: { fontFamily: 'Stub' } });
  return { Geist: font, Geist_Mono: font, Instrument_Serif: font, Inter: font };
});

const LANGS: Lang[] = ['en', 'es'];
const TEST_ID = 'AW-000000000';
const VARS = {
  NEXT_PUBLIC_GOOGLE_ADS_ID: TEST_ID,
  NEXT_PUBLIC_GOOGLE_ADS_LABEL_FORM: 'TestLabel_Form-01',
  NEXT_PUBLIC_GOOGLE_ADS_LABEL_CALL: 'TestLabel_Call-02',
  NEXT_PUBLIC_GOOGLE_ADS_LABEL_WHATSAPP: 'TestLabel_WhatsApp-03',
};
/** Google's tag and advertising hosts — and Analytics, which is never loaded. */
const GOOGLE = /googletagmanager|google-analytics|doubleclick|googleadservices/;

type Page = { lang: Lang; path: string; html: string; body: string };

async function site(on: boolean) {
  vi.resetModules();
  for (const [name, value] of Object.entries(VARS)) vi.stubEnv(name, on ? value : '');
  const [ads, tag, content, i18n, meta, seo, shell, chrome, saas, home, services, existing, about, contact, work, legal, notFound, detail] =
    await Promise.all([
      import('@/lib/ttc/ads'),
      import('@/components/ttc/mp/AdsTag'),
      import('@/lib/ttc/content'),
      import('@/lib/ttc/i18n'),
      import('./meta'),
      import('./seo'),
      import('@/components/ttc/mp/PublicShell'),
      import('@/components/ttc/mp/SiteChrome'),
      import('@/components/layout/saas-shell'),
      import('./HomeView'),
      import('./ServicesView'),
      import('./ExistingView'),
      import('./AboutView'),
      import('./ContactView'),
      import('./WorkView'),
      import('./LegalView'),
      import('./NotFoundView'),
      import('./ServiceDetailView'),
    ]);
  const pages: Page[] = [];
  for (const lang of LANGS) {
    const views: [string, ReactElement][] = [
      ['/', h(home.HomeView, { lang })],
      ['/services', h(services.ServicesView, { lang })],
      ['/existing-buildings', h(existing.ExistingView, { lang })],
      ['/about', h(about.AboutView, { lang })],
      ['/contact', h(contact.ContactView, { lang })],
      ['/projects', h(work.WorkView, { lang })],
      ['/privacy', h(legal.LegalView, { lang, kind: 'privacy' })],
      ['/terms', h(legal.LegalView, { lang, kind: 'terms' })],
      ['/public-not-found', h(notFound.NotFoundView, { lang })],
      ...content.getContent(lang).services.map(
        (s): [string, ReactElement] => [`/services/${s.slug}`, h(detail.ServiceDetailView, { lang, slug: s.slug })],
      ),
    ];
    for (const [path, view] of views) {
      route.pathname = i18n.localePath(path, lang);
      pages.push({
        lang,
        path,
        // As the two (site)/layout.tsx files serve it: the view in the shell.
        html: renderToStaticMarkup(h(shell.PublicShell, null, view)),
        // The same page without the shell: header, main, footer, phone bar.
        body: renderToStaticMarkup(h(chrome.SiteChrome, null, view)),
      });
    }
  }
  route.pathname = '/home';
  return {
    ads,
    pages,
    page: (lang: Lang, path: string) => pages.find((p) => p.lang === lang && p.path === path)!,
    content: content.getContent,
    /** What the tag component prints on its own. */
    tag: renderToStaticMarkup(h(tag.AdsTag)),
    /** The staff application's shell, around a stand-in for one of its pages. */
    staff: renderToStaticMarkup(h(saas.SaasShell, null, h('main', null, 'A staff page'))),
    /** Title, description and addresses of a page, as its route declares them. */
    metaOf: (lang: Lang) =>
      JSON.stringify([
        meta.pageMeta(lang, '/privacy', seo.SEO[lang].privacy),
        meta.pageMeta(lang, '/terms', seo.SEO[lang].terms),
        meta.pageMeta(lang, '/contact', seo.SEO[lang].contact),
        meta.pageMeta(lang, '/', seo.SEO[lang].home),
        ...content.getContent(lang).services.map((s) => [s.slug, s.seo]),
      ]),
  };
}

type Site = Awaited<ReturnType<typeof site>>;
let off: Site;
let on: Site;

beforeAll(async () => {
  off = await site(false);
  on = await site(true);
}, 120_000);

afterAll(() => {
  vi.unstubAllEnvs();
});

/* ── reading the HTML ───────────────────────────────────────────────────── */

const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
/** Every block of running text a page prints, heading or paragraph. */
const blocks = (html: string) =>
  [...html.matchAll(/<(p|li|dd|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(m[2])).filter(Boolean);
const wordCount = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) ?? []).length;
const paragraphsOf = (p: string | readonly string[]) => (typeof p === 'string' ? [p] : [...p]);
/** Every <script> element: its attributes and its code. */
const scripts = (html: string) =>
  [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => ({ attrs: m[1], code: m[2] }));
/** The ones a browser would run (structured data is not one). */
const executable = (html: string) => scripts(html).filter((s) => !/type="application\/ld\+json"/.test(s.attrs));
const headings = (html: string) => html.match(/<h[1-6]\b/g) ?? [];
const outboundHosts = (html: string) =>
  [...html.matchAll(/<a\b[^>]*\shref="(https?:[^"]*)"/g)]
    .map((m) => new URL(m[1].replace(/&amp;/g, '&')).hostname)
    .filter((host) => host !== 'ttcivilstructural.com');
const section = (s: Site, lang: Lang, i: number) => s.content(lang).legal.privacy.sections[i];
/** "Cookies and analytics" is the sixth section of the policy. */
const COOKIES = 5;

/* The Privacy text as it was the day before measurement was added — typed
   here, not imported, so that an edit to site.ts cannot move both at once. */
const TODAY = {
  en: {
    h: 'Cookies and analytics',
    collect: 'The only personal information this website collects is what you submit through the proposal request form: ',
    p: [
      'The public pages of this site set no cookies and run no analytics, advertising or social-media scripts. Their scripts, fonts, photographs and video are served from this site’s own address, and the form uses no outside verification service (CAPTCHA).',
      'One preference is kept in your browser and is never sent to us: if you pause the background video, the site remembers it so that the video stays paused on the next page.',
      'Cookies may be used by the authenticated project-management area of this domain for sign-in purposes; those are strictly necessary to keep a session active and are not used to profile visitors to the public site.',
    ],
  },
  es: {
    h: 'Cookies y analítica',
    collect: 'La única información personal que recopila este sitio web es la que usted envía a través del formulario de solicitud de propuesta: ',
    p: [
      'Las páginas públicas de este sitio no instalan cookies ni ejecutan scripts de analítica, de publicidad o de redes sociales. Sus scripts, tipografías, fotografías y videos se sirven desde la propia dirección de este sitio, y el formulario no usa ningún servicio externo de verificación (CAPTCHA).',
      'Una sola preferencia se guarda en su navegador y nunca se nos envía: si usted pausa el video de fondo, el sitio lo recuerda para que siga en pausa en la página siguiente.',
      'El área autenticada de gestión de proyectos de este dominio puede usar cookies para el inicio de sesión; esas son estrictamente necesarias para mantener una sesión activa y no se usan para perfilar a los visitantes del sitio público.',
    ],
  },
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
   OFF
   ═══════════════════════════════════════════════════════════════════════════ */

describe('measurement off (no variable set): the site is what it was', () => {
  it('the switch is off', () => {
    expect(off.ads.ADS).toEqual({ on: false, why: null });
  });

  // Sixteen pages a language — the thirty-two of the sitemap — and the 404.
  it('every public page is rendered, in both states', () => {
    expect(off.pages).toHaveLength(34);
    expect(on.pages.map((p) => `${p.lang} ${p.path}`)).toEqual(off.pages.map((p) => `${p.lang} ${p.path}`));
  });

  it('no page carries a script a browser would run — only its structured data', () => {
    for (const p of off.pages) {
      expect(scripts(p.html).length, `${p.lang} ${p.path}`).toBeGreaterThan(0);
      expect(executable(p.html), `${p.lang} ${p.path}`).toEqual([]);
    }
  });

  it('no page names one of Google’s tag or advertising hosts, anywhere in its HTML', () => {
    for (const p of off.pages) {
      expect(p.html, `${p.lang} ${p.path}`).not.toMatch(GOOGLE);
      expect(p.html, `${p.lang} ${p.path}`).not.toMatch(/gtag|dataLayer|__ttcAds|_gcl_|AW-\d/);
    }
  });

  it('the tag component prints nothing — no element, no attribute, no comment', () => {
    expect(off.tag).toBe('');
    for (const p of off.pages) expect(p.html, `${p.lang} ${p.path}`).not.toContain('<script>');
  });

  for (const lang of LANGS) {
    it(`${lang} /privacy: the text is today’s, to the letter`, () => {
      const cookies = section(off, lang, COOKIES);
      expect(cookies.h).toBe(TODAY[lang].h);
      expect(paragraphsOf(cookies.p)).toEqual(TODAY[lang].p);
      expect(paragraphsOf(section(off, lang, 0).p)[0].startsWith(TODAY[lang].collect)).toBe(true);
      const html = off.page(lang, '/privacy').html;
      for (const p of TODAY[lang].p) expect(blocks(html)).toContain(p);
      expect(blocks(html)).toContain(TODAY[lang].h);
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ON
   ═══════════════════════════════════════════════════════════════════════════ */

describe('measurement on: the script is in the public shell, and only there', () => {
  it('the switch is on, with the test ID', () => {
    expect(on.ads.ADS).toEqual({
      on: true,
      id: TEST_ID,
      labels: { form: 'TestLabel_Form-01', call: 'TestLabel_Call-02', whatsapp: 'TestLabel_WhatsApp-03' },
    });
  });

  it('every public page carries the bootstrap script, exactly once, and no other', () => {
    const ads = on.ads.ADS;
    if (!ads.on) throw new Error('expected the switch on');
    const boot = on.ads.adsBootScript(ads);
    expect(on.tag).toBe(`<script>${boot}</script>`);
    expect(boot).toContain(`"${TEST_ID}"`);
    expect(boot).toMatch(GOOGLE);
    for (const p of on.pages) {
      expect(executable(p.html).map((s) => s.code), `${p.lang} ${p.path}`).toEqual([boot]);
      // A plain inline script: no src (nothing is fetched until the script
      // itself decides to), no attribute at all.
      expect(executable(p.html)[0].attrs, `${p.lang} ${p.path}`).toBe('');
    }
  });

  it('it is the first thing in the shell, before the page', () => {
    for (const p of on.pages) {
      const open = p.html.indexOf('<div class="mp ');
      expect(open, `${p.lang} ${p.path}`).toBeGreaterThanOrEqual(0);
      const first = p.html.slice(open).match(/^<div class="mp [^"]*">(<script>)/);
      expect(first?.[1], `${p.lang} ${p.path}`).toBe('<script>');
      expect(p.html.indexOf('<script>')).toBeLessThan(p.html.indexOf('<header'));
    }
  });

  // The script names Google's tag as a string it may load later. The HTML
  // itself asks a browser — or a crawler — for nothing from Google: no
  // script src, no preconnect or preload, no image, no frame.
  it('the HTML fetches nothing from Google: no src, no link, no image, no frame', () => {
    for (const p of on.pages) {
      const urls = [...p.html.matchAll(/<(?:script|link|img|iframe|source|video)\b[^>]*?\s(?:src|href|srcset)="([^"]*)"/gi)].map(
        (m) => m[1],
      );
      for (const url of urls) expect(url, `${p.lang} ${p.path}`).not.toMatch(/google|doubleclick|gstatic/i);
    }
  });

  it('nothing below the shell prints it: header, page, footer and phone bar carry no script but structured data', () => {
    for (const p of on.pages) {
      expect(executable(p.body), `${p.lang} ${p.path}`).toEqual([]);
      expect(p.body, `${p.lang} ${p.path}`).not.toMatch(/gtag|dataLayer|__ttcAds|AW-\d/);
    }
  });

  it('apart from the script, every page but /privacy is the page it was', () => {
    const boot = executable(on.pages[0].html)[0].code;
    for (const p of on.pages) {
      if (p.path === '/privacy') continue;
      expect(p.html.replace(`<script>${boot}</script>`, ''), `${p.lang} ${p.path}`).toBe(off.page(p.lang, p.path).html);
    }
  });

  it('the staff application’s shell has nothing — in either state', () => {
    for (const s of [off, on]) {
      expect(s.staff).toContain('A staff page');
      expect(s.staff).not.toMatch(GOOGLE);
      expect(s.staff).not.toMatch(/gtag|dataLayer|__ttcAds|_gcl_|AW-\d/);
    }
    expect(on.staff).toBe(off.staff);
  });
});

describe('measurement on: the Privacy page says so, in both languages', () => {
  for (const lang of LANGS) {
    const es = lang === 'es';

    it(`${lang}: the section is the advertising one, and the two paragraphs that were true either way stay`, () => {
      const cookies = section(on, lang, COOKIES);
      const ps = paragraphsOf(cookies.p);
      expect(cookies.h).toBe(es ? 'Cookies, analítica y publicidad' : 'Cookies, analytics and advertising');
      expect(ps).toHaveLength(7);
      expect(ps.slice(-2)).toEqual(TODAY[lang].p.slice(1));
      const html = on.page(lang, '/privacy').html;
      for (const p of ps) expect(blocks(html)).toContain(p);
      expect(blocks(html)).toContain(cookies.h);
      expect(blocks(html)).not.toContain(TODAY[lang].h);
    });

    it(`${lang}: it no longer says the pages set no cookies, run no advertising scripts or load everything from here`, () => {
      const page = text(on.page(lang, '/privacy').html);
      expect(page).not.toContain(TODAY[lang].p[0]);
      expect(page).not.toMatch(/set no cookies|no cookies|no instalan cookies|ni ejecutan scripts de anal[ií]tica, de publicidad/i);
      expect(page).not.toMatch(/run no analytics, advertising/i);
      // …and "the only personal information" now has its exception in front.
      const collect = paragraphsOf(section(on, lang, 0).p)[0];
      expect(collect.startsWith(TODAY[lang].collect)).toBe(false);
      expect(collect).toContain(es ? 'la única información personal' : 'the only personal information');
      expect(collect).toContain(section(on, lang, COOKIES).h);
      // The rest of that paragraph is the one the OFF page prints.
      const offCollect = paragraphsOf(section(off, lang, 0).p)[0];
      expect(collect.endsWith(offCollect.slice(es ? 'La'.length : 'The only'.length))).toBe(true);
    });

    it(`${lang}: who gets the tag, what it loads, what it keeps and for how long, what it sends and never sends, and how to be rid of it`, () => {
      const ps = paragraphsOf(section(on, lang, COOKIES).p).slice(0, 5).join(' ');
      // who: only a visitor who arrives from one of our Google ads
      expect(ps).toMatch(es ? /uno de nuestros anuncios de Google/ : /one of our Google ads/);
      expect(ps).toMatch(es ? /identificador de clic/ : /click identifier/);
      // what is loaded, and from where
      expect(ps).toContain('googletagmanager.com');
      // what it keeps, where, and for how long — the figure comes from ads.ts
      expect(ps).toContain('“_gcl_”');
      expect(ps).toMatch(es ? /almacenamiento local/ : /local storage/);
      for (const host of ['google.com', 'googleadservices.com', 'doubleclick.net']) expect(ps).toContain(host);
      expect(on.ads.ADS_COOKIE_DAYS).toBe(90);
      expect(ps).toContain(es ? '90 días' : '90 days');
      // what is sent: that one of the three things happened…
      expect(ps).toMatch(es ? /enlace de teléfono.*enlace de WhatsApp.*formulario/ : /phone link.*WhatsApp link.*form/);
      // …and never what the visitor wrote
      for (const word of es
        ? ['nombre', 'correo electrónico', 'teléfono', 'descripción', 'archivos', 'referencia']
        : ['name', 'email address', 'phone number', 'description', 'files', 'reference']) {
        expect(ps, word).toContain(word);
      }
      // Google handles it under its own terms; the way out is the browser's
      // own controls and Google's ad settings page, named and not linked.
      expect(ps).toMatch(es ? /su propia política de privacidad/ : /its own privacy policy and terms/);
      expect(ps).toContain('myadcenter.google.com');
      expect(ps).toMatch(es ? /borre en su navegador las cookies/ : /clear this site’s cookies/);
      // Still true, and still said: no analytics, no social scripts, no CAPTCHA.
      expect(ps).toMatch(es ? /no ejecutan scripts de analítica ni de redes sociales/ : /run no analytics and no social-media scripts/);
      expect(ps).toContain('CAPTCHA');
    });

    it(`${lang}: no legal position, and the one figure is the cookie’s lifetime`, () => {
      const doc = on.content(lang).legal.privacy;
      const all = [doc.h1, doc.sub, doc.contact, ...doc.sections.flatMap((s) => [s.h, ...paragraphsOf(s.p)])].join(' ');
      expect(all).not.toMatch(/GDPR|RGPD|CCPA|HIPAA|COPPA|compl(?:y|iant|iance)|cumpl(?:e|imos|imiento)/i);
      expect(all).not.toMatch(/arbitra|governing law|venue|jurisdicción competente|ley aplicable|tribunal/i);
      expect(all).not.toMatch(/liability|responsabilidad máxima|indemn/i);
      expect(all).not.toMatch(/prevails|prevalece/i);
      const DAYS = /\d+\s*(?:business |working )?(?:days?|hours?|months?|years?|d[ií]as?|horas?|meses|años?)/gi;
      expect(all.match(DAYS)).toEqual([es ? '90 días' : '90 days']);
      // No other number at all in the new text.
      const fresh = paragraphsOf(section(on, lang, COOKIES).p).slice(0, 5).join(' ');
      expect(fresh.match(/\d+/g)).toEqual(['90']);
    });

    it(`${lang}: names Google’s pages and links none of them — the six outside hosts are still the only ones`, () => {
      const html = on.page(lang, '/privacy').html;
      const main = html.match(/<main\b[\s\S]*<\/main>/)![0];
      expect(main).not.toMatch(/<a\b[^>]*href="https?:/);
      expect(main).not.toMatch(/href="[^"]*google/i);
    });

    it(`${lang}: the page keeps its headings, its closing line and its length`, () => {
      const html = on.page(lang, '/privacy').html;
      const doc = on.content(lang).legal.privacy;
      const main = html.match(/<main\b[\s\S]*<\/main>/)![0];
      expect(headings(main).length).toBe(doc.sections.length + 2);
      expect(headings(main).length).toBe(headings(off.page(lang, '/privacy').html.match(/<main\b[\s\S]*<\/main>/)![0]).length);
      expect(headings(main).length).toBeLessThanOrEqual(14);
      expect(doc.h1).toBe(off.content(lang).legal.privacy.h1);
      expect(blocks(main).at(-1)!.startsWith(doc.contact)).toBe(true);
      // Longer than the page it replaces, which is itself over the floor.
      expect(wordCount(text(main))).toBeGreaterThan(wordCount(text(off.page(lang, '/privacy').html.match(/<main\b[\s\S]*<\/main>/)![0])));
    });

    it(`${lang}: no paragraph is printed twice, and none is shared with the terms`, () => {
      const ps = blocks(on.page(lang, '/privacy').html.match(/<main\b[\s\S]*<\/main>/)![0]);
      expect(ps.length).toBe(new Set(ps).size);
      const inTerms = new Set(blocks(on.page(lang, '/terms').html));
      expect(ps.filter((b) => wordCount(b) >= 6 && inTerms.has(b))).toEqual([]);
    });
  }

  it('the two languages have the same sections and the same number of paragraphs in each', () => {
    const en = on.content('en').legal.privacy.sections;
    const es = on.content('es').legal.privacy.sections;
    expect(es.length).toBe(en.length);
    en.forEach((s, i) => expect(paragraphsOf(es[i].p).length, s.h).toBe(paragraphsOf(s.p).length));
  });

  it('the terms of use do not change with the switch', () => {
    for (const lang of LANGS) {
      expect(on.content(lang).legal.terms).toEqual(off.content(lang).legal.terms);
      expect(text(on.page(lang, '/terms').html)).toBe(text(off.page(lang, '/terms').html));
    }
  });
});

describe('measurement on: what the earlier releases settled still holds', () => {
  // The on-page check's ruler: a block of six or more words printed on two
  // pages. The new paragraphs are the only new text on the site; each must
  // be on its own page, in its own language, and nowhere else.
  it('no block of the new Privacy text is printed on any other page, in either language', () => {
    for (const lang of LANGS) {
      const own = on.page(lang, '/privacy');
      const fresh = [
        section(on, lang, COOKIES).h,
        ...paragraphsOf(section(on, lang, COOKIES).p).slice(0, 5),
        paragraphsOf(section(on, lang, 0).p)[0],
      ];
      for (const block of fresh) {
        const elsewhere = on.pages.filter((p) => p !== own && blocks(p.body).includes(block));
        expect(elsewhere.map((p) => `${p.lang} ${p.path}`), block.slice(0, 60)).toEqual([]);
      }
    }
  });

  it('the count of blocks shared between pages is the one the site has with the switch off', () => {
    const shared = (s: Site) => {
      const seen = new Map<string, Set<string>>();
      for (const p of s.pages) {
        const main = p.body.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
        for (const b of new Set(blocks(main))) {
          if (wordCount(b) < 6) continue;
          if (!seen.has(b)) seen.set(b, new Set());
          seen.get(b)!.add(`${p.lang} ${p.path}`);
        }
      }
      return [...seen].filter(([, where]) => where.size > 1).map(([b]) => b).sort();
    };
    expect(shared(on)).toEqual(shared(off));
  });

  it('a service page has at most 23 headings, as before', () => {
    for (const s of [off, on]) {
      for (const p of s.pages.filter((x) => x.path.startsWith('/services/'))) {
        expect(headings(p.html).length, `${p.lang} ${p.path}`).toBeLessThanOrEqual(23);
      }
    }
    for (const p of on.pages) {
      expect(headings(p.html).length, `${p.lang} ${p.path}`).toBe(headings(off.page(p.lang, p.path).html).length);
    }
  });

  it('the site links the same six outside hosts and no other', () => {
    const hosts = (s: Site) => [...new Set(s.pages.flatMap((p) => outboundHosts(p.html)))].sort();
    expect(hosts(on)).toEqual([
      'api.whatsapp.com',
      'library.municode.com',
      'www.broward.org',
      'www.leg.state.fl.us',
      'www.miamidade.gov',
      'www.myfloridalicense.com',
    ]);
    expect(hosts(on)).toEqual(hosts(off));
  });

  it('titles, descriptions and addresses are the same', () => {
    for (const lang of LANGS) expect(on.metaOf(lang)).toBe(off.metaOf(lang));
  });
});
