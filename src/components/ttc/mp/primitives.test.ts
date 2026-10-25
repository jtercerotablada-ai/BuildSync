import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Reveal, RevealText, StaggerItem, StaggerList } from './primitives';

/**
 * What the SERVER sends for a scroll-revealed block. This is the markup a
 * visitor reads before React hydrates, and all they ever get when a script
 * chunk fails — so it must not hide anything. (It used to: Motion wrote its
 * `initial` state into it, an inline opacity:0 or an off-screen transform on
 * every one of these elements.) The hidden state now exists only as
 * `data-rv`, set in the browser by reveal.ts.
 */
const html = renderToStaticMarkup(
  h(
    'main',
    null,
    h(Reveal, { children: 'plain' }),
    h(Reveal, { delay: 0.05, as: 'p', className: 'mp-sechead', children: 'delayed' }),
    h(Reveal, { y: 24, children: 'far' }),
    h(RevealText, { lines: ['Line one', 'line two'], className: 'mp-intro__title' }),
    h(StaggerList, {
      as: 'div',
      className: 'mp-steps',
      children: ['one', 'two'].map((text) =>
        h(StaggerItem, { key: text, as: 'div', className: 'mp-stepcard', children: text }),
      ),
    }),
  ),
);

/**
 * The home page's variants (`fx`, spec E8 to E12). Same promise as above: the
 * server HTML hides nothing. What is new is the attribute that selects each
 * look (`data-fx`, styled in home-motion.css under `.mp-home`) and that these
 * blocks do NOT carry the `mp-reveal` class, whose 14 px fade in mp.css would
 * fight them.
 */
const fxHtml = renderToStaticMarkup(
  h(
    'main',
    null,
    h(Reveal, { fx: 'up', delay: 0.1, children: 'block' }),
    h(Reveal, { fx: 'words', as: 'h2', id: 'x-h', className: 'h-h2', children: 'Heading' }),
    h(Reveal, { fx: 'line', className: 'h-pause__line' }),
    h(Reveal, { fx: 'left', as: 'li', delay: 0.2, children: 'row' }),
    h(Reveal, { fx: 'img', className: 'h-ph', children: 'photo' }),
  ),
);

describe('Reveal fx: the server HTML', () => {
  it('writes the variant as data-fx and nothing hidden', () => {
    expect(fxHtml).not.toMatch(/opacity/);
    expect(fxHtml).not.toMatch(/transform/);
    expect(fxHtml).not.toMatch(/data-rv/);
    for (const fx of ['up', 'words', 'line', 'left', 'img']) {
      expect(fxHtml).toContain(`data-fx="${fx}"`);
    }
  });

  it('does not take the mp-reveal class', () => {
    expect(fxHtml).not.toMatch(/mp-reveal/);
  });

  it('keeps the element type, the id, the classes and the timing', () => {
    expect(fxHtml).toContain('<h2 id="x-h" class="h-h2" data-fx="words">Heading</h2>');
    expect(fxHtml).toContain('<div data-fx="up" style="--rv-delay:100ms">block</div>');
    expect(fxHtml).toContain('<li data-fx="left" style="--rv-delay:200ms">row</li>');
  });

  it('lets a rule have no children', () => {
    expect(fxHtml).toContain('<div class="h-pause__line" data-fx="line"></div>');
  });

  it('leaves a block without fx exactly as it was', () => {
    expect(html).not.toMatch(/data-fx/);
  });
});

describe('scroll reveals: the server HTML', () => {
  it('hides nothing: no opacity, no transform, no data-rv', () => {
    expect(html).not.toMatch(/opacity/);
    expect(html).not.toMatch(/transform/);
    expect(html).not.toMatch(/data-rv/);
  });

  it('marks every animated element, for the print and <noscript> resets', () => {
    // 3 blocks + 2 headline lines + 2 list items.
    expect(html.match(/class="mp-reveal\b/g)).toHaveLength(7);
  });

  it('writes a style only where a block sets its own timing', () => {
    expect(html).toContain('<div class="mp-reveal">plain</div>');
    expect(html).toContain('<p class="mp-reveal mp-sechead" style="--rv-delay:50ms">delayed</p>');
    expect(html).toContain('<div class="mp-reveal" style="--rv-y:24px">far</div>');
  });

  it('keeps the headline readable as text, one line after the other', () => {
    expect(html).toMatch(/<h2 class="mp-intro__title">.*Line one.*<\/span> <span.*line two.*<\/h2>/);
    // The second line follows the first by 70 ms; the first carries no delay.
    expect(html.match(/--rv-delay:70ms/g)).toHaveLength(1);
  });

  it('renders stagger items as direct children of their list', () => {
    expect(html).toContain(
      '<div class="mp-steps"><div class="mp-reveal mp-reveal--item mp-stepcard">one</div>' +
        '<div class="mp-reveal mp-reveal--item mp-stepcard">two</div></div>',
    );
  });
});
