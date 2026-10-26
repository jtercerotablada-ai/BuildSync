import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { SiteChrome } from './SiteChrome';
import { whatsappHomeHref } from './ReachRow';

/**
 * THE SHARED CHROME ON THE HOME, AND ONLY THERE. The header, the phone bar and
 * the footer are the same components on every page; the home (the canonical
 * path "/", after stripLang, so "/es" too) differs in a handful of named ways
 * (SiteHeader, MobileActionBar, SiteFooter) and every other page must print
 * exactly what it printed before. Static markup, as the server sends it: the
 * scripted behaviour (the header sliding away, the menu) is header-hide.test.ts
 * and the browser.
 */
const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);

function chrome(path: string, lang: Lang) {
  route.pathname = localePath(path, lang);
  const html = renderToStaticMarkup(h(SiteChrome, null, h('p', null, 'page')));
  const part = (re: RegExp) => html.match(re)?.[0] ?? '';
  return {
    html,
    header: part(/<header\b[\s\S]*?<\/header>/),
    bar: part(/<nav class="mp-bar[\s\S]*?<\/nav>/),
    tag: part(/<p class="mp-footer__tag">[\s\S]*?<\/p>/),
  };
}

const INNER = ['/about', '/contact', '/services', '/existing-buildings', '/guides', '/services/threshold-inspections', '/services/building-recertification', '/projects'];

describe('the home page chrome', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const phone = c.contact.phone!;
    const { html, header, bar, tag } = chrome('/', lang);

    // The owner, 2026-10-26: no button and no Call in the home's header; the
    // menu's foot keeps "Get in touch", and the phone bar carries the rest.
    it(`${lang}: the home's header has no button and no Call`, () => {
      expect(header).not.toContain('mp-header__cta');
      expect(header).not.toContain('mp-header__call');
      expect(header).not.toContain(esc(c.primaryCta.label));
    });

    it(`${lang}: the phone bar says "${c.reach.formHome}" to #contact and WhatsApp, and no Call`, () => {
      expect(bar).toContain(`<a class="mp-bar__item mp-bar__item--main" href="#contact">${esc(c.reach.formHome)}</a>`);
      expect(bar).toContain(esc(whatsappHomeHref(c)!));
      for (const never of [c.reach.form, c.reach.formPlain, c.primaryCta.label]) expect(bar).not.toContain(`>${esc(never)}<`);
      // The owner, 2026-10-26: no Call item on a phone.
      expect(bar).not.toContain(`href="${phone.href}"`);
      expect(bar).not.toContain(`>${esc(c.reach.call)}<`);
    });

    // The footer prints no tagline and no P.E. badge on any page since
    // 2026-10-26 (the owner: "eso ya lo dejamos claro en la web").
    it(`${lang}: the footer carries no tagline and no P.E. badge`, () => {
      expect(tag).toBe('');
      expect(html).not.toContain('mp-footer__pe');
      expect(html).not.toContain(esc(c.company.description));
    });
  }
});

describe('every other page keeps the chrome it had', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    for (const path of INNER) {
      it(`${lang} ${path}: "${c.primaryCta.label}" to ${c.primaryCta.href}, no Call button, no footer tagline`, () => {
        const { html, header, tag } = chrome(path, lang);
        expect(header).toContain(
          `<a class="mp-btn mp-btn--solid mp-header__cta" href="${localePath(c.primaryCta.href, lang)}"><span>${esc(c.primaryCta.label)}</span></a>`,
        );
        expect(header).not.toContain(esc(c.home.chrome.headerCta));
        expect(html).not.toContain('mp-header__call');
        expect(tag).toBe('');
        expect(html).not.toContain('mp-footer__pe');
      });
    }
  }
});
