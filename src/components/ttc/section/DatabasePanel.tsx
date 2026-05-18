'use client';

import React, { useMemo, useState } from 'react';
import { AISC_FAMILIES, type AISCFamily, type AISCEntry, searchAISC } from '@/lib/section/aisc-loader';
import {
  INTL_FAMILIES,
  searchIntl,
  type IntlEntry,
  type IntlFamily,
  type IntlStandard,
} from '@/lib/section/international-loader';

export type UnifiedEntry =
  | { source: 'aisc'; entry: AISCEntry }
  | { source: 'intl'; entry: IntlEntry };

type StandardId = 'AISC' | 'EN' | 'BS';

interface Props {
  onSelect: (u: UnifiedEntry) => void;
  activeDesignation?: string;
}

const STANDARDS: Array<{ id: StandardId; label: string; hint: string }> = [
  { id: 'AISC', label: 'AISC (US)',       hint: 'AISC 15th ed. — W, HSS, Pipe, C, L, WT, S' },
  { id: 'EN',   label: 'European (EN)',   hint: 'EN 10365 / EN 10210 — IPE, HEA, HEB, HEM, UPN, CHS, SHS, RHS' },
  { id: 'BS',   label: 'British (BS)',    hint: 'BS 4-1:2005 — UB (Universal Beams) / UC (Universal Columns)' },
];

export function DatabasePanel({ onSelect, activeDesignation }: Props) {
  const [standard, setStandard] = useState<StandardId>('AISC');
  const [family, setFamily] = useState<string>('');
  const [query, setQuery] = useState('');

  // When the standard changes, clear the family filter since each standard has its own families.
  const handleStandardChange = (s: StandardId) => {
    setStandard(s);
    setFamily('');
  };

  const currentStandard = STANDARDS.find((s) => s.id === standard)!;

  const familyOptions = useMemo(() => {
    if (standard === 'AISC') {
      return AISC_FAMILIES.map((f) => ({ id: f.id, label: f.label }));
    }
    return INTL_FAMILIES.filter((f) => f.standard === standard).map((f) => ({
      id: f.id,
      label: f.label,
    }));
  }, [standard]);

  const results = useMemo<UnifiedEntry[]>(() => {
    if (standard === 'AISC') {
      const aisc = searchAISC(query, (family as AISCFamily) || undefined, 40);
      return aisc.map((e) => ({ source: 'aisc', entry: e }));
    }
    const intl = searchIntl(
      query,
      (family as IntlFamily) || undefined,
      standard as IntlStandard,
      60
    );
    return intl.map((e) => ({ source: 'intl', entry: e }));
  }, [query, family, standard]);

  return (
    <div className="sb-panel">
      <h3 className="sb-panel__title">Section Database</h3>
      <p className="sb-panel__hint">{currentStandard.hint}</p>

      <div className="sb-panel__section">
        <div className="sb-std seg" role="group" aria-label="Catalog standard">
          {STANDARDS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={standard === s.id ? 'is-active' : ''}
              onClick={() => handleStandardChange(s.id)}
              title={s.hint}
            >
              {s.label}
            </button>
          ))}
        </div>

        <label className="sb-field">
          <span className="sb-field__label">Family</span>
          <select
            className="sb-field__input"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
          >
            <option value="">All families</option>
            {familyOptions.map((f) => (
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
            placeholder={
              standard === 'AISC'
                ? 'W14X22, HSS, Pipe6...'
                : standard === 'EN'
                ? 'IPE 300, HEB 200, CHS 168.3x8.0...'
                : 'UB 457x191x67, UC 305x305x97...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="sb-db-results" role="listbox">
        {results.length === 0 ? (
          <div className="sb-db-empty">No matching sections.</div>
        ) : (
          results.map((u) => <DatabaseRow key={rowKey(u)} u={u} onSelect={onSelect} active={activeDesignation} />)
        )}
      </div>

      <div className="sb-db-footer">
        Showing {results.length} result{results.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}

function DatabaseRow({
  u,
  onSelect,
  active,
}: {
  u: UnifiedEntry;
  onSelect: (u: UnifiedEntry) => void;
  active?: string;
}) {
  if (u.source === 'aisc') {
    const e = u.entry;
    const isActive = active === e.designation;
    return (
      <button
        type="button"
        role="option"
        aria-selected={isActive}
        className={`sb-db-row ${isActive ? 'is-active' : ''}`}
        onClick={() => onSelect(u)}
      >
        <span className="sb-db-row__desig">{e.designation}</span>
        <span className="sb-db-row__family">{e.family}</span>
        <span className="sb-db-row__weight">{e.weight} lb/ft</span>
        <span className="sb-db-row__dim">
          d={e.d}" × bf={e.bf}"
        </span>
      </button>
    );
  }
  const e = u.entry;
  const isActive = active === e.designation;
  const dim =
    e.kind === 'hollow-circ'
      ? `D=${e.D} mm, t=${e.t} mm`
      : e.kind === 'hollow-rect'
      ? `${e.H}×${e.B}×${e.t} mm`
      : `H=${e.H} mm, B=${e.B} mm`;
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      className={`sb-db-row ${isActive ? 'is-active' : ''}`}
      onClick={() => onSelect(u)}
    >
      <span className="sb-db-row__desig">{e.designation}</span>
      <span className="sb-db-row__family">{e.family}</span>
      <span className="sb-db-row__weight">{e.weight} kg/m</span>
      <span className="sb-db-row__dim">{dim}</span>
    </button>
  );
}

function rowKey(u: UnifiedEntry): string {
  return u.source + ':' + u.entry.designation;
}
