import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { photo } from '@/lib/ttc/media';
import { Img } from '../media';
import { Reveal } from '../primitives';
import { Words } from './Words';

/**
 * S7 · THE PAUSE PHOTOGRAPH, and the wrapper of the plates that follow it.
 *
 * HomeView renders `<HomeStack lang>` around the credentials plate and the
 * snow plate ("where we work"), so this prints the pause plate first and its
 * children after it, in one box:
 *
 *   div.h-stack
 *     section.h-pause        the photograph and its one line (the h2)
 *     {children}             HomeCredentials, HomeWhere
 *
 * THE SLIDE-OVER (E15) is pure CSS (home-motion.css §05): at 901 x 720 and up,
 * without reduced motion, the pause plate is pinned while the credentials
 * plate slides over it, and the snow plate over both. The wrapper's hooks are
 * `data-motion` attributes; anywhere else the three plates are one under the
 * other. `StackFocus` (mounted by HomeView) puts the page back at the end of
 * the pause when the keyboard reaches the credentials plate.
 *
 * THE PHOTOGRAPH IS A PLACE, NOT A PROJECT: the spare aerial of the South
 * Florida coast, `aria-hidden`, black and white, with a black gradient over
 * its top and bottom so the line at the foot always reads. The line is the
 * section's <h2>.
 *
 * A SERVER COMPONENT; the only client code is `Img`, already on the page.
 */
export function HomeStack({ lang, children }: { lang: Lang; children?: React.ReactNode }) {
  const c = getContent(lang);
  const h = c.home.pause;

  return (
    /* E15, the slide-over stack. At (min-width: 901px) and
       (min-height: 720px), without reduced motion, the CSS pins
       `.h-pause` (sticky, top 0, 100svh), pins the credentials plate over it
       and lets the snow plate slide over both; the covered plate dims with
       `animation-timeline: view()` where supported. `data-motion="stack"` is
       the hook. No script, no per-frame writes. */
    <div className="h-stack" data-motion="stack">
      <section className="h-pause mp-surface--graphite" aria-labelledby="h-pause-h" data-motion="stack-pause">
        {/* E14, parallax ±9 % of the frame on fine pointers
            ≥ 900 px (`Parallax` island; transform only, from this
            element's position). The frame is 18 % taller than the plate so
            the shift never shows an edge. */}
        <div className="h-pause__px" data-parallax="pause">
          <Img photo={photo.southFloridaAerial} className="h-pause__img" sizes="100vw" />
        </div>
        <div className="h-pause__copy">
          {/* The gold hairline draws across (E11), then the words rise out of
              their masks (E8). */}
          <Reveal fx="line" className="h-pause__line" />
          <Reveal as="h2" fx="words" id="h-pause-h" className="h-pause__h">
            <Words text={h.title} accent={h.accentWord} />
          </Reveal>
        </div>
      </section>
      {children}
    </div>
  );
}
