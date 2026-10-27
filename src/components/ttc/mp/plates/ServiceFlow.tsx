import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';

/**
 * Who does what, step by step — the two county programs (2026-10-27, after
 * the competitor's swimlane the owner called "bien claro"). A table: one row
 * per step of the service's `process` (its names, in its order), four lanes
 * — the authority, the owner, our team, the contractor. Our team's lane is
 * marked, so a board sees at a glance how much of the work leaves its hands.
 *
 * A real <table> with row and column headers, so a screen reader reads each
 * cell with its step and its lane. From 900px down it becomes one card per
 * step (dark.css): the step, then each lane that acts at it, its name drawn
 * from the cell's own label (the header row is not shown there, so no lane
 * is named twice); an empty cell is not drawn. No cell repeats the other
 * county's cell word for word (programs-own-words.test.ts counts table
 * cells too).
 *
 * The data and its sources: `serviceFlow` in site.ts. A SERVER component.
 */
export function ServiceFlow({ lang, slug, steps }: { lang: Lang; slug: string; steps: readonly string[] }) {
  const c = getContent(lang);
  const f = c.serviceFlow[slug];
  if (!f || f.rows.length !== steps.length) return null;

  return (
    <div className="h-flow">
      <table className="h-flow__t">
        <caption className="h-flow__cap">{f.caption}</caption>
        <thead>
          <tr>
            <td className="h-flow__corner" />
            {f.lanes.map((lane, j) => (
              <th key={lane} scope="col" className={j === 2 ? 'is-us' : undefined}>
                {lane}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {f.rows.map((row, i) => (
            <tr key={steps[i]}>
              <th scope="row">
                <span className="h-flow__n">{String(i + 1).padStart(2, '0')}</span> {steps[i]}
              </th>
              {row.map((cell, j) => (
                <td
                  key={f.lanes[j]}
                  data-lane={f.lanes[j]}
                  className={[j === 2 ? 'is-us' : '', cell ? '' : 'is-empty'].filter(Boolean).join(' ') || undefined}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
