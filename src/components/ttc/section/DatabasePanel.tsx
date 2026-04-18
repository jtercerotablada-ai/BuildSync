'use client';

import React, { useMemo, useState } from 'react';
import { AISC_FAMILIES, type AISCFamily, type AISCEntry, searchAISC } from '@/lib/section/aisc-loader';

interface Props {
  onSelect: (entry: AISCEntry) => void;
  activeDesignation?: string;
}

export function DatabasePanel({ onSelect, activeDesignation }: Props) {
  const [family, setFamily] = useState<AISCFamily | ''>('');
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => searchAISC(query, family || undefined, 40),
    [query, family]
  );

  return (
    <div className="sb-panel">
      <h3 className="sb-panel__title">AISC Database</h3>
      <p className="sb-panel__hint">
        AISC 15th ed. shapes — search by designation (e.g. W14X22, HSS6X6X1/4, Pipe6Std).
      </p>

      <div className="sb-panel__section">
        <label className="sb-field">
          <span className="sb-field__label">Family</span>
          <select
            className="sb-field__input"
            value={family}
            onChange={(e) => setFamily(e.target.value as AISCFamily | '')}
          >
            <option value="">All families</option>
            {AISC_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="sb-field">
          <span className="sb-field__label">Search</span>
          <input
            className="sb-field__input"
            type="search"
            placeholder="W14X22, HSS, Pipe6..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="sb-db-results" role="listbox">
        {results.length === 0 ? (
          <div className="sb-db-empty">No matching sections.</div>
        ) : (
          results.map((e) => (
            <button
              key={e.designation}
              type="button"
              role="option"
              aria-selected={activeDesignation === e.designation}
              className={`sb-db-row ${activeDesignation === e.designation ? 'is-active' : ''}`}
              onClick={() => onSelect(e)}
            >
              <span className="sb-db-row__desig">{e.designation}</span>
              <span className="sb-db-row__family">{e.family}</span>
              <span className="sb-db-row__weight">{e.weight} lb/ft</span>
              <span className="sb-db-row__dim">
                d={e.d}" × bf={e.bf}"
              </span>
            </button>
          ))
        )}
      </div>

      <div className="sb-db-footer">Showing {results.length} result{results.length === 1 ? '' : 's'}</div>
    </div>
  );
}
