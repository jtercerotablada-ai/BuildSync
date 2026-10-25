import { describe, expect, it, vi } from 'vitest';
import { FIRST_FRAME } from './first-frame';

/**
 * The site's first script, run against a stand-in for `document` and
 * `location`: the `js` class is set on every page, and the two anchors of the
 * old recertification home (`#miami-dade`, `#broward`) leave the home page
 * (and only the home page) for the county's own program page.
 */
function run(at: { pathname: string; hash?: string; search?: string }) {
  const add = vi.fn();
  const replace = vi.fn();
  const location = { pathname: at.pathname, hash: at.hash ?? '', search: at.search ?? '', replace };
  const document = { documentElement: { classList: { add } } };
  new Function('document', 'location', FIRST_FRAME)(document, location);
  return { add, replace };
}

describe('first frame: the script class', () => {
  it('turns script on, on every page', () => {
    for (const pathname of ['/', '/es', '/about', '/services/broward-bsip', '/es/contact']) {
      const { add } = run({ pathname });
      expect(add, pathname).toHaveBeenCalledWith('js');
    }
  });

  it('does not write data-county any more', () => {
    expect(FIRST_FRAME).not.toContain('data-county');
    expect(FIRST_FRAME).not.toContain('setAttribute');
  });
});

describe('first frame: the legacy anchors of the old home page', () => {
  it('#miami-dade on the English home goes to the Miami-Dade program', () => {
    const { replace } = run({ pathname: '/', hash: '#miami-dade' });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/services/building-recertification');
  });

  it('#broward on the English home goes to the Broward program', () => {
    const { replace } = run({ pathname: '/', hash: '#broward' });
    expect(replace).toHaveBeenCalledWith('/services/broward-bsip');
  });

  it('on the Spanish home they keep the /es prefix', () => {
    expect(run({ pathname: '/es', hash: '#miami-dade' }).replace).toHaveBeenCalledWith('/es/services/building-recertification');
    expect(run({ pathname: '/es', hash: '#broward' }).replace).toHaveBeenCalledWith('/es/services/broward-bsip');
  });

  it('a trailing slash on the home does not matter', () => {
    expect(run({ pathname: '/es/', hash: '#broward' }).replace).toHaveBeenCalledWith('/es/services/broward-bsip');
  });

  it('carries the query string with the visitor (an ad click id, campaign tags)', () => {
    const search = '?gclid=abc123&utm_source=google';
    expect(run({ pathname: '/', hash: '#miami-dade', search }).replace).toHaveBeenCalledWith(`/services/building-recertification${search}`);
    expect(run({ pathname: '/es', hash: '#broward', search }).replace).toHaveBeenCalledWith(`/es/services/broward-bsip${search}`);
  });

  it('leaves the home alone for any other hash, and for none', () => {
    for (const hash of ['', '#', '#contact', '#services', '#where', '#Miami-Dade', '#miami-dade-x', '#broward2']) {
      expect(run({ pathname: '/', hash }).replace, hash).not.toHaveBeenCalled();
      expect(run({ pathname: '/es', hash }).replace, hash).not.toHaveBeenCalled();
    }
  });

  it('touches no other page, even with the same hash', () => {
    for (const pathname of [
      '/about',
      '/contact',
      '/services',
      '/services/building-recertification',
      '/services/broward-bsip/fort-lauderdale',
      '/es/about',
      '/es/services/broward-bsip',
      '/guides',
    ]) {
      for (const hash of ['#miami-dade', '#broward']) {
        expect(run({ pathname, hash }).replace, `${pathname}${hash}`).not.toHaveBeenCalled();
      }
    }
  });

  it('is one short line: it blocks the parser for as long as it runs', () => {
    expect(FIRST_FRAME.length).toBeLessThan(400);
    expect(FIRST_FRAME).not.toContain('\n');
  });
});
