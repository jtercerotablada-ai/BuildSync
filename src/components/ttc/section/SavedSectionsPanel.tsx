'use client';

import React from 'react';
import type { SavedSection } from '@/lib/section/types';
import { formatValue, unitLabel, type UnitSystem } from '@/lib/beam/units';

interface Props {
  sections: SavedSection[];
  onLoad: (s: SavedSection) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  unitSystem: UnitSystem;
  activeId: string | null;
}

export function SavedSectionsPanel({
  sections,
  onLoad,
  onRename,
  onDelete,
  unitSystem,
  activeId,
}: Props) {
  return (
    <div className="sb-panel">
      <h3 className="sb-panel__title">My Sections</h3>
      <p className="sb-panel__hint">Saved locally in this browser. Click to load into the canvas.</p>

      {sections.length === 0 ? (
        <div className="sb-empty">
          <p>No saved sections yet.</p>
          <p className="sb-empty__hint">Build a section and click Save to keep it here.</p>
        </div>
      ) : (
        <div className="sb-saved-list">
          {sections.map((s) => {
            const active = activeId === s.id;
            return (
              <div key={s.id} className={`sb-saved-row ${active ? 'is-active' : ''}`}>
                <button
                  type="button"
                  className="sb-saved-row__main"
                  onClick={() => onLoad(s)}
                  title="Load this section"
                >
                  <span className="sb-saved-row__name">{s.name}</span>
                  <span className="sb-saved-row__meta">
                    {s.source.type === 'database' && s.source.ref.designation}
                    {s.source.type === 'template' && s.source.params.kind}
                    {s.source.type === 'polygon' && `polygon (${s.source.params.vertices.length} pts)`}
                    {' · '}
                    A={formatValue(s.props.A, 'A', unitSystem, 2)} {unitLabel('A', unitSystem)}
                  </span>
                </button>
                <div className="sb-saved-row__actions">
                  <button
                    type="button"
                    className="sb-icon-btn"
                    onClick={() => {
                      const name = prompt('Rename section', s.name);
                      if (name && name.trim()) onRename(s.id, name.trim());
                    }}
                    aria-label="Rename"
                    title="Rename"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="sb-icon-btn sb-icon-btn--danger"
                    onClick={() => {
                      if (confirm(`Delete "${s.name}"?`)) onDelete(s.id);
                    }}
                    aria-label="Delete"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
