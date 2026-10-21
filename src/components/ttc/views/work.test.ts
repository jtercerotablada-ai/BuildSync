import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { engagementServices, imagery } from '@/lib/ttc/site';
import { WorkView } from './WorkView';

/**
 * /projects while there are no case studies: the typical engagements as one
 * register, then four frames of material.
 *
 * What the page must not drift back to (October 20, 2026):
 *   • a photograph over each profile — big frames of identifiable towers
 *     above a scope of work read as "our projects";
 *   • a "Status: Typical engagement" row on every profile, and a footnote
 *     that says again what the hero's lede says;
 *   • a gallery of finished houses and skylines, with its note after them.
 * And what it must keep: each profile opens with the reader's situation and
 * leads to the service page that answers it, named by its short name.
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function render(lang: Lang): string {
  route.pathname = localePath('/projects', lang);
  return renderToStaticMarkup(h(WorkView, { lang }));
}

describe('/projects: the typical engagements are one register', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const html = render(lang);
    const register = html.match(/<div class="mp-work mp-work--register">[\s\S]*?<\/section>/)?.[0] ?? '';
    const items = register.split(/<div class="[^"]*mp-work__item[^"]*"[^>]*>/).slice(1);

    it(`${lang}: no photograph, no Status row, no footnote`, () => {
      expect(register).not.toBe('');
      expect(html).not.toMatch(/mp-work__photo|mp-work__illus|mp-work__status|mp-work__note/);
    });

    it(`${lang}: one row per profile, each with exactly the four facts`, () => {
      expect(items).toHaveLength(c.engagements.length);
      items.forEach((item, i) => {
        const e = c.engagements[i];
        expect(item.match(/<dt>/g) ?? []).toHaveLength(4);
        for (const v of [e.projectType, e.scope, e.structuralSystem, e.deliverables]) {
          expect(item).toContain(`<dd>${esc(v)}</dd>`);
        }
      });
    });

    // A phone runs each label into its value ("PROJECT TYPE Residential");
    // without a text space the two print as one word.
    it(`${lang}: a space sits between every label and its value`, () => {
      const pairs = register.match(/<\/dt>\s*<dd/g) ?? [];
      expect(pairs).toHaveLength(c.engagements.length * 4);
      for (const p of pairs) expect(p).toBe('</dt> <dd');
    });

    it(`${lang}: the header row is not read out — the labels on every row already are`, () => {
      expect(register).toMatch(/<div class="mp-work__cols" aria-hidden="true">/);
    });

    it(`${lang}: each profile opens with the reader's situation, a sentence with no figure`, () => {
      items.forEach((item, i) => {
        const e = c.engagements[i];
        expect(item).toContain(`<p class="mp-work__need">${esc(e.need)}</p>`);
        expect(e.need).not.toMatch(/\d/);
        // Before the facts, after the title.
        expect(item.indexOf('mp-work__need')).toBeGreaterThan(item.indexOf('mp-work__title'));
        expect(item.indexOf('mp-work__need')).toBeLessThan(item.indexOf('<dl'));
      });
    });

    it(`${lang}: each profile links the service that answers it, by its short name`, () => {
      const bySlug = new Map(c.services.map((s) => [s.slug, s]));
      items.forEach((item, i) => {
        const e = c.engagements[i];
        const links = [...item.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);
        expect(links).toEqual(
          (engagementServices[e.n] ?? []).map((slug) => [
            localePath(`/services/${slug}`, lang),
            text(esc(`${bySlug.get(slug)!.shortTitle} →`)),
          ]),
        );
        // The arrow is drawn, not read.
        expect(item).toMatch(/<i aria-hidden="true">→<\/i>/);
      });
    });

    it(`${lang}: the page says once that these are not past projects, in the lede`, () => {
      const notPast = lang === 'es' ? 'no proyectos anteriores concretos' : 'not specific past projects';
      expect(text(html).split(notPast).length - 1).toBe(1);
      expect(c.workPage.subRepresentative).toContain(notPast);
    });
  }

  it('every profile has its services, and every slug is a service, in both languages', () => {
    for (const lang of LANGS) {
      const c = getContent(lang);
      expect(Object.keys(engagementServices).sort()).toEqual(c.engagements.map((e) => e.n).sort());
      const slugs = new Set(c.services.map((s) => s.slug));
      for (const list of Object.values(engagementServices)) {
        expect(list.length).toBeGreaterThan(0);
        for (const slug of list) expect(slugs.has(slug), slug).toBe(true);
      }
    }
  });
});

describe('/projects: the material is four frames, and the note comes first', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const html = render(lang);
    const gal = html.match(/<section class="[^"]*mp-gal-sec[^"]*"[\s\S]*?<\/section>/)?.[0] ?? '';

    it(`${lang}: four tiles, on paper, each a catalogue photograph`, () => {
      expect(gal).toMatch(/mp-surface--paper/);
      const srcs = [...gal.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1]);
      expect(srcs).toHaveLength(4);
      expect(imagery.gallery).toHaveLength(4);
    });

    it(`${lang}: the note that no image is the firm's is printed once, before the first image`, () => {
      const note = esc(c.ui.galleryNote);
      expect(html.split(note).length - 1).toBe(1);
      expect(gal.indexOf(note)).toBeGreaterThan(-1);
      expect(gal.indexOf(note)).toBeLessThan(gal.indexOf('<img'));
    });

    it(`${lang}: no caption of what the photographs show`, () => {
      expect(gal).not.toMatch(/mp-gal__lede/);
    });
  }
});
