import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnimatedLine, Reveal, RevealText, StaggerItem, StaggerList } from './primitives';

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
    h(AnimatedLine, { delay: 0.14 }),
    h(StaggerList, {
      as: 'div',
      className: 'mp-steps',
      children: ['one', 'two'].map((text) =>
        h(StaggerItem, { key: text, as: 'div', className: 'mp-stepcard', children: text }),
      ),
    }),
  ),
);

describe('scroll reveals: the server HTML', () => {
  it('hides nothing: no opacity, no transform, no data-rv', () => {
    expect(html).not.toMatch(/opacity/);
    expect(html).not.toMatch(/transform/);
    expect(html).not.toMatch(/data-rv/);
  });

  it('marks every animated element, for the print and <noscript> resets', () => {
    // 3 blocks + 2 headline lines + the rule + 2 list items.
    expect(html.match(/class="mp-reveal\b/g)).toHaveLength(8);
  });

  it('writes a style only where a block sets its own timing', () => {
    expect(html).toContain('<div class="mp-reveal">plain</div>');
    expect(html).toContain('<p class="mp-reveal mp-sechead" style="--rv-delay:50ms">delayed</p>');
    expect(html).toContain('<div class="mp-reveal" style="--rv-y:24px">far</div>');
    expect(html).toContain('<div class="mp-reveal mp-reveal--rule mp-rule" style="--rv-delay:140ms"></div>');
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
