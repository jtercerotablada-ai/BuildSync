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

const INNER = ['/about', '/contact', '/services', '/existing-buildings', '/guides', '/services/structural-analysis', '/services/building-recertification', '/projects'];

describe('the home page chrome', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const phone = c.contact.phone!;
    const { html, header, bar, tag } = chrome('/', lang);

    it(`${lang}: the header's button is "${c.home.chrome.headerCta}" to the page's own contact block`, () => {
      const btn = header.match(/<a href="#contact" class="mp-btn mp-btn--solid mp-header__cta">[\s\S]*?<\/a>/)?.[0];
      expect(btn).toBe(`<a href="#contact" class="mp-btn mp-btn--solid mp-header__cta"><span>${esc(c.home.chrome.headerCta)}</span></a>`);
      // No second, site-wide button beside it: "Contact" in the nav is the
      // nav's, and the proposal button is not printed at all.
      expect(header).not.toContain(esc(c.primaryCta.label));
      expect(header.match(/mp-header__cta/g)).toHaveLength(1);
    });

    it(`${lang}: a Call button sits in the header's actions, named "Call" and the number`, () => {
      const call = header.match(/<a class="mp-header__call"[\s\S]*?<\/a>/)?.[0] ?? '';
      expect(call).toContain(`href="${phone.href}"`);
      expect(call).toContain(`<span class="mp-sr-only">${esc(c.home.chrome.callLabel.replace('{phone}', phone.display))}</span>`);
      expect(call).toContain('aria-hidden="true"');
      // …before the burger, inside the actions.
      const actions = header.match(/<div class="mp-header__actions">[\s\S]*<\/div>/)?.[0] ?? '';
      expect(actions.indexOf('mp-header__call')).toBeGreaterThan(actions.indexOf('mp-header__cta'));
      expect(actions.indexOf('mp-header__call')).toBeLessThan(actions.indexOf('mp-burger'));
    });

    it(`${lang}: the phone bar says "${c.reach.formHome}" to #contact, and its WhatsApp line names no notice`, () => {
      expect(bar).toContain(`<a class="mp-bar__item mp-bar__item--main" href="#contact">${esc(c.reach.formHome)}</a>`);
      expect(bar).toContain(esc(whatsappHomeHref(c)!));
      for (const never of [c.reach.form, c.reach.formPlain, c.primaryCta.label]) expect(bar).not.toContain(`>${esc(never)}<`);
      expect(bar).toContain(`href="${phone.href}"`);
    });

    it(`${lang}: the footer's tagline is the home's own line, not the firm's description`, () => {
      expect(tag).toBe(`<p class="mp-footer__tag">${esc(c.home.chrome.footerTag)}</p>`);
      expect(html).not.toContain(esc(c.company.description));
    });
  }
});

describe('every other page keeps the chrome it had', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    for (const path of INNER) {
      it(`${lang} ${path}: "${c.primaryCta.label}" to ${c.primaryCta.href}, no Call button, the firm's description`, () => {
        const { html, header, tag } = chrome(path, lang);
        expect(header).toContain(
          `<a class="mp-btn mp-btn--solid mp-header__cta" href="${localePath(c.primaryCta.href, lang)}"><span>${esc(c.primaryCta.label)}</span></a>`,
        );
        expect(header).not.toContain(esc(c.home.chrome.headerCta));
        expect(html).not.toContain('mp-header__call');
        expect(tag).toBe(`<p class="mp-footer__tag">${esc(c.company.description)}</p>`);
        expect(html).not.toContain(esc(c.home.chrome.footerTag));
      });
    }
  }
});
