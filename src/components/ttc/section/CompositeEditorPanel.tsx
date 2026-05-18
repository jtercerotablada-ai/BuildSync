'use client';

import React from 'react';
import type {
  CompositeOperand,
  CompositeParams,
  ShapeKind,
  TemplateParams,
} from '@/lib/section/types';
import { fromSI, toSI, unitLabel, type UnitSystem } from '@/lib/beam/units';
import { defaultsFor } from './ShapeTemplatesPanel';

interface Props {
  params: CompositeParams;
  onChange: (p: CompositeParams) => void;
  unitSystem: UnitSystem;
  activeOperandId: string | null;
  setActiveOperandId: (id: string | null) => void;
}

const SHAPES: Array<{ id: ShapeKind; label: string }> = [
  { id: 'rectangular', label: 'Rect' },
  { id: 'hollow-rect', label: 'Hollow R' },
  { id: 'circular', label: 'Circ' },
  { id: 'hollow-circ', label: 'Hollow C' },
  { id: 'i-shape', label: 'I/W' },
  { id: 't-shape', label: 'T/WT' },
  { id: 'angle', label: 'Angle L' },
  { id: 'channel', label: 'Channel' },
  { id: 'box-girder', label: 'Box' },
];

export function CompositeEditorPanel({
  params,
  onChange,
  unitSystem,
  activeOperandId,
  setActiveOperandId,
}: Props) {
  const dimLabel = unitLabel('dimension', unitSystem);

  const addOperand = (op: 'add' | 'subtract') => {
    const operand: CompositeOperand = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      params: defaultsFor(op === 'add' ? 'rectangular' : 'circular'),
      dx: 0,
      dy: 0,
      op,
    };
    onChange({ operands: [...params.operands, operand] });
    setActiveOperandId(operand.id);
  };

  const removeOperand = (id: string) => {
    onChange({ operands: params.operands.filter((o) => o.id !== id) });
    if (activeOperandId === id) setActiveOperandId(null);
  };

  const updateOperand = (id: string, patch: Partial<CompositeOperand>) => {
    onChange({
      operands: params.operands.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  };

  const setOperandShape = (id: string, kind: ShapeKind) => {
    updateOperand(id, { params: defaultsFor(kind) });
  };

  const setOperandParam = (id: string, key: string, siValue: number) => {
    const target = params.operands.find((o) => o.id === id);
    if (!target) return;
    updateOperand(id, {
      params: { ...target.params, [key]: siValue } as TemplateParams,
    });
  };

  const preset = (name: 'plate-I' | '2C' | 'box-plates') => {
    if (name === 'plate-I') {
      const I: CompositeOperand = {
        id: `op-${Date.now()}-i`,
        params: { kind: 'i-shape', H: 300, B: 150, tw: 10, tf: 15 },
        dx: 0,
        dy: 0,
        op: 'add',
      };
      const plate: CompositeOperand = {
        id: `op-${Date.now()}-p`,
        params: { kind: 'rectangular', b: 200, h: 20 },
        dx: -25,
        dy: 300,
        op: 'add',
      };
      onChange({ operands: [I, plate] });
      setActiveOperandId(plate.id);
    } else if (name === '2C') {
      const left: CompositeOperand = {
        id: `op-${Date.now()}-l`,
        params: { kind: 'channel', H: 250, B: 100, tw: 8, tf: 12 },
        dx: 0,
        dy: 0,
        op: 'add',
      };
      const right: CompositeOperand = {
        id: `op-${Date.now()}-r`,
        params: { kind: 'channel', H: 250, B: 100, tw: 8, tf: 12 },
        dx: 200,
        dy: 0,
        op: 'add',
      };
      onChange({ operands: [left, right] });
      setActiveOperandId(left.id);
    } else if (name === 'box-plates') {
      const top: CompositeOperand = {
        id: `op-${Date.now()}-t`,
        params: { kind: 'rectangular', b: 400, h: 20 },
        dx: 0,
        dy: 380,
        op: 'add',
      };
      const bot: CompositeOperand = {
        id: `op-${Date.now()}-b`,
        params: { kind: 'rectangular', b: 400, h: 20 },
        dx: 0,
        dy: 0,
        op: 'add',
      };
      const leftWeb: CompositeOperand = {
        id: `op-${Date.now()}-lw`,
        params: { kind: 'rectangular', b: 15, h: 360 },
        dx: 0,
        dy: 20,
        op: 'add',
      };
      const rightWeb: CompositeOperand = {
        id: `op-${Date.now()}-rw`,
        params: { kind: 'rectangular', b: 15, h: 360 },
        dx: 385,
        dy: 20,
        op: 'add',
      };
      onChange({ operands: [bot, leftWeb, rightWeb, top] });
      setActiveOperandId(bot.id);
    }
  };

  return (
    <div className="sb-panel">
      <h3 className="sb-panel__title">Composite / Built-Up</h3>
      <p className="sb-panel__hint">
        Combine templates with (dx, dy) offsets. Add (+) joins; Subtract (−) cuts.
        Properties computed via parallel axis theorem.
      </p>

      <div className="sb-panel__section">
        <div className="sb-panel__subtitle">Presets</div>
        <div className="sb-presets">
          <button type="button" className="sb-preset" onClick={() => preset('plate-I')}>
            I + Cover Plate
          </button>
          <button type="button" className="sb-preset" onClick={() => preset('2C')}>
            2C Back-to-Back
          </button>
          <button type="button" className="sb-preset" onClick={() => preset('box-plates')}>
            Built-Up Box
          </button>
        </div>

        <div className="sb-composite-actions">
          <button
            type="button"
            className="btn btn--ghost sb-composite-add"
            onClick={() => addOperand('add')}
          >
            + Add Shape
          </button>
          <button
            type="button"
            className="btn btn--ghost sb-composite-sub"
            onClick={() => addOperand('subtract')}
          >
            − Subtract Shape
          </button>
        </div>
      </div>

      <div className="sb-panel__section">
        <div className="sb-panel__subtitle">
          Operands ({params.operands.length})
        </div>
        {params.operands.length === 0 ? (
          <div className="sb-db-empty">No operands. Use a preset or add a shape.</div>
        ) : (
          <div className="sb-composite-list">
            {params.operands.map((o, idx) => (
              <OperandCard
                key={o.id}
                index={idx}
                operand={o}
                isActive={activeOperandId === o.id}
                unitSystem={unitSystem}
                dimLabel={dimLabel}
                onToggleActive={() =>
                  setActiveOperandId(activeOperandId === o.id ? null : o.id)
                }
                onShapeChange={(k) => setOperandShape(o.id, k)}
                onParamChange={(key, v) => setOperandParam(o.id, key, v)}
                onOffsetChange={(key, v) => updateOperand(o.id, { [key]: v })}
                onOpChange={(op) => updateOperand(o.id, { op })}
                onRemove={() => removeOperand(o.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OperandCard({
  index,
  operand,
  isActive,
  unitSystem,
  dimLabel,
  onToggleActive,
  onShapeChange,
  onParamChange,
  onOffsetChange,
  onOpChange,
  onRemove,
}: {
  index: number;
  operand: CompositeOperand;
  isActive: boolean;
  unitSystem: UnitSystem;
  dimLabel: string;
  onToggleActive: () => void;
  onShapeChange: (k: ShapeKind) => void;
  onParamChange: (key: string, siValue: number) => void;
  onOffsetChange: (key: 'dx' | 'dy', siValue: number) => void;
  onOpChange: (op: 'add' | 'subtract') => void;
  onRemove: () => void;
}) {
  const display = (si: number) => {
    if (!isFinite(si)) return 0;
    return Math.round(fromSI(si, 'dimension', unitSystem) * 10000) / 10000;
  };
  const toSI_ = (v: number) => toSI(v, 'dimension', unitSystem);

  return (
    <div className={`sb-composite-card ${isActive ? 'is-active' : ''} sb-composite-card--${operand.op}`}>
      <div className="sb-composite-card__header">
        <button
          type="button"
          className="sb-composite-card__toggle"
          onClick={onToggleActive}
          aria-expanded={isActive}
        >
          <span className={`sb-composite-badge sb-composite-badge--${operand.op}`}>
            {operand.op === 'add' ? '+' : '−'}
          </span>
          <span className="sb-composite-card__title">
            #{index + 1} {SHAPES.find((s) => s.id === operand.params.kind)?.label ?? operand.params.kind}
          </span>
          <span className="sb-composite-card__offset">
            ({display(operand.dx)}, {display(operand.dy)}) {dimLabel}
          </span>
        </button>
        <button
          type="button"
          className="sb-composite-card__remove"
          onClick={onRemove}
          aria-label="Remove operand"
          title="Remove operand"
        >
          ×
        </button>
      </div>

      {isActive && (
        <div className="sb-composite-card__body">
          <div className="sb-composite-op seg" role="group" aria-label="Operand op">
            <button
              type="button"
              className={operand.op === 'add' ? 'is-active' : ''}
              onClick={() => onOpChange('add')}
            >
              + Add
            </button>
            <button
              type="button"
              className={operand.op === 'subtract' ? 'is-active' : ''}
              onClick={() => onOpChange('subtract')}
            >
              − Subtract
            </button>
          </div>

          <label className="sb-field">
            <span className="sb-field__label">Shape</span>
            <select
              className="sb-field__input"
              value={operand.params.kind}
              onChange={(e) => onShapeChange(e.target.value as ShapeKind)}
            >
              {SHAPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <div className="sb-composite-card__fields">
            {renderParamFields(operand.params, onParamChange, display, toSI_)}
          </div>

          <div className="sb-panel__subtitle">Offset ({dimLabel})</div>
          <div className="sb-composite-card__fields">
            <label className="sb-field">
              <span className="sb-field__label">dx</span>
              <input
                className="sb-field__input"
                type="number"
                step="any"
                value={display(operand.dx)}
                onChange={(e) => onOffsetChange('dx', toSI_(parseFloat(e.target.value) || 0))}
              />
            </label>
            <label className="sb-field">
              <span className="sb-field__label">dy</span>
              <input
                className="sb-field__input"
                type="number"
                step="any"
                value={display(operand.dy)}
                onChange={(e) => onOffsetChange('dy', toSI_(parseFloat(e.target.value) || 0))}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function renderParamFields(
  p: TemplateParams,
  onParamChange: (key: string, siValue: number) => void,
  display: (si: number) => number,
  toSI_: (v: number) => number
): React.ReactElement {
  const F = ({ label, field, value }: { label: string; field: string; value: number }) => (
    <label className="sb-field">
      <span className="sb-field__label">{label}</span>
      <input
        className="sb-field__input"
        type="number"
        min={0}
        step="any"
        value={display(value)}
        onChange={(e) => onParamChange(field, toSI_(parseFloat(e.target.value) || 0))}
      />
    </label>
  );

  switch (p.kind) {
    case 'rectangular':
      return (
        <>
          <F label="b" field="b" value={p.b} />
          <F label="h" field="h" value={p.h} />
        </>
      );
    case 'hollow-rect':
    case 'box-girder':
      return (
        <>
          <F label="B" field="B" value={p.B} />
          <F label="H" field="H" value={p.H} />
          <F label="tw" field="tw" value={p.tw} />
          <F label="tf" field="tf" value={p.tf} />
        </>
      );
    case 'circular':
      return <F label="D" field="D" value={p.D} />;
    case 'hollow-circ':
      return (
        <>
          <F label="D" field="D" value={p.D} />
          <F label="d" field="d" value={p.d} />
        </>
      );
    case 'i-shape':
    case 't-shape':
    case 'channel':
      return (
        <>
          <F label="H" field="H" value={p.H} />
          <F label="B" field="B" value={p.B} />
          <F label="tw" field="tw" value={p.tw} />
          <F label="tf" field="tf" value={p.tf} />
        </>
      );
    case 'angle':
      return (
        <>
          <F label="H" field="H" value={p.H} />
          <F label="B" field="B" value={p.B} />
          <F label="t" field="t" value={p.t} />
        </>
      );
  }
}
