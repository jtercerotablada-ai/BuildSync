'use client';

import React, { useMemo, useState } from 'react';
import { bim, imagery } from '@/lib/ttc/site';
import { BimModel } from './art';
import { Img } from './media';
import {
  AnimatedLine,
  ButtonLink,
  Reveal,
  SectionHeading,
} from './primitives';

type LayerState = Record<string, boolean>;

const ALL_ON: LayerState = bim.layers.reduce<LayerState>((acc, l) => {
  acc[l.id] = true;
  return acc;
}, {});

/**
 * BIM is demonstrated, not listed. The model is a single inline SVG whose
 * layers are toggled with real <button aria-pressed> controls, plus a
 * wireframe / solid switch. No 3D engine, no model download, no WebGL — the
 * interaction costs a few CSS opacity transitions.
 */
export function BIMExperience({ n = '04' }: { n?: string }) {
  const [layers, setLayers] = useState<LayerState>(ALL_ON);
  const [solid, setSolid] = useState(false);

  const activeCount = useMemo(
    () => Object.values(layers).filter(Boolean).length,
    [layers],
  );

  const toggle = (id: string) =>
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section
      className="mp-section mp-section--lg mp-surface--graphite mp-grain"
      aria-labelledby="mp-bim-title"
      style={{ position: 'relative' }}
    >
      <div className="mp-shell" style={{ position: 'relative', zIndex: 1 }}>
        <SectionHeading n={n} label={bim.eyebrow} meta="Interactive" />

        <div className="mp-bim__grid">
          <div>
            <Reveal>
              <h2 id="mp-bim-title" className="mp-bim__title">
                {bim.title}
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mp-bim__body">{bim.body}</p>
            </Reveal>

            <Reveal delay={0.14}>
              <ul className="mp-bim__notes">
                {bim.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </Reveal>

            <div className="mp-cta-row">
              <ButtonLink href="/services/bim-coordination" variant="line">
                BIM coordination in detail
              </ButtonLink>
            </div>
          </div>

          <Reveal delay={0.1}>
            <div className="mp-bim__stage">
              {/* The wireframe used to sit on flat black, which read as an
                  empty viewport rather than a model of something. A darkened
                  photograph of real structure behind it gives it a subject. */}
              <div className="mp-bim__backdrop" aria-hidden="true">
                <Img
                  photo={imagery.sections.bim}
                  sizes="(max-width: 1180px) 100vw, 56vw"
                />
              </div>
              <div className="mp-bim__canvas">
                <BimModel layers={layers} solid={solid} />
              </div>

              <div className="mp-bim__controls">
                <span className="mp-form__hp" id="mp-bim-controls-label">
                  Structural model layers
                </span>
                {bim.layers.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="mp-chip"
                    aria-pressed={layers[l.id]}
                    onClick={() => toggle(l.id)}
                  >
                    {l.label}
                  </button>
                ))}

                <div
                  className="mp-bim__mode"
                  role="group"
                  aria-label="Model display mode"
                >
                  <button
                    type="button"
                    aria-pressed={!solid}
                    onClick={() => setSolid(false)}
                  >
                    Wireframe
                  </button>
                  <button
                    type="button"
                    aria-pressed={solid}
                    onClick={() => setSolid(true)}
                  >
                    Solid
                  </button>
                </div>
              </div>
            </div>

            <p className="mp-bim__hint" role="status">
              {activeCount} of {bim.layers.length} layers visible ·{' '}
              {solid ? 'Solid' : 'Wireframe'}
            </p>
            <AnimatedLine delay={0.2} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
