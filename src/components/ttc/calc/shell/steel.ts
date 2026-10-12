'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SteelShape } from '@/lib/calc/beam/model';

/**
 * THE CALCULATORS' SHELL — the table of steel shapes. (What the shell is,
 * and a calculator built on it: index.ts.)
 *
 * NOTHING LEAVES THE BROWSER, and nothing arrives that was not asked for:
 * the table is a static file (lib/steel/aisc-shapes.json), a piece of the
 * page's own script fetched the first time "Steel shape" is chosen — never
 * with the page, where most visitors would carry it for nothing.
 */

/** The table as a calculator holds it: `useSteelShapes` returns one, and the "Section and material" group (SectionGroup.tsx) takes it whole. */
export interface SteelShapes {
  /** The section is a steel shape: the table is wanted. */
  wanted: boolean;
  /** The table, once it has arrived. */
  shapes: SteelShape[] | null;
  /** The table did not arrive. It is not asked for a second time: the page says so, and offers to load itself again. */
  failed: boolean;
  /** The shape in use, as the table has it; `null` while there is no table, or no shape of that name in it. */
  shape: SteelShape | null;
  /** A name the table does not have: no section, and the page says which name. */
  unknown: boolean;
  /** What is typed to find a shape — a tool, not a value of the case: not in the address, not on the printed sheet. */
  filter: string;
  setFilter: (text: string) => void;
  /** The shapes the filter leaves, the first 120 of them: what the list offers. */
  filtered: SteelShape[];
}

/**
 * `wanted`: the section is a steel shape. `name`: the shape's name as the
 * form holds it. `onName`: the form is to hold the table's spelling instead
 * (see below) — it is called from an effect, with that spelling.
 */
export function useSteelShapes({ wanted, name, onName }: { wanted: boolean; name: string; onName: (designation: string) => void }): SteelShapes {
  const [shapes, setShapes] = useState<SteelShape[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState('');

  // The shape table, the first time it is wanted.
  useEffect(() => {
    if (!wanted || shapes || failed) return;
    let live = true;
    void import('@/lib/steel/aisc-shapes.json').then(
      (m) => {
        if (live) setShapes((m.default ?? m).shapes as SteelShape[]);
      },
      // The table is a piece of the page's script, and a piece that did not
      // arrive is not asked for a second time: the page has to be loaded
      // again, and has to say so. Left alone, "Loading…" stayed for the visit.
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [wanted, shapes, failed]);

  // The shape in use: as the table spells it, or in any case — a link typed
  // by hand says w18x50.
  const shape = useMemo(() => {
    if (!wanted || !shapes) return null;
    return shapes.find((s) => s.designation === name) ?? shapes.find((s) => s.designation.toUpperCase() === name.toUpperCase()) ?? null;
  }, [wanted, shapes, name]);
  // The form then holds the table's spelling, and so does the address. (Not
  // capitals: the table has Pipe1/2STD.)
  useEffect(() => {
    if (shape && shape.designation !== name) onName(shape.designation);
  }, [shape, name, onName]);

  const filtered = useMemo(() => {
    if (!shapes) return [];
    const q = filter.trim().toUpperCase().replace(/\s+/g, '');
    const list = q ? shapes.filter((s) => s.designation.toUpperCase().includes(q)) : shapes;
    return list.slice(0, 120);
  }, [shapes, filter]);

  // A name the table does not have: no section, and the page says which name.
  return { wanted, shapes, failed, shape, unknown: wanted && shapes !== null && !shape, filter, setFilter, filtered };
}
