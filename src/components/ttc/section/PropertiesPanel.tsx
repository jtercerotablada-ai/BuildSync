'use client';

import React from 'react';
import type { SectionProperties } from '@/lib/section/types';
import { formatValue, unitLabel, type UnitSystem, type Quantity } from '@/lib/beam/units';

interface Props {
  props: SectionProperties;
  unitSystem: UnitSystem;
  weightPerLength?: number; // SI kg/m
}

export function PropertiesPanel({ props, unitSystem, weightPerLength }: Props) {
  return (
    <div className="sb-panel">
      <h3 className="sb-panel__title">Section Properties</h3>

      <Section title="Geometric">
        <Row label="Area A" value={props.A} q="A" system={unitSystem} />
        <Row label="Perimeter" value={props.perimeter} q="dimension" system={unitSystem} />
        <Row label="x̄ (centroid)" value={props.xbar} q="dimension" system={unitSystem} />
        <Row label="ȳ (centroid)" value={props.ybar} q="dimension" system={unitSystem} />
      </Section>

      <Section title="Moments of Inertia">
        <Row label="Ix" value={props.Ix} q="I" system={unitSystem} />
        <Row label="Iy" value={props.Iy} q="I" system={unitSystem} />
        <Row label="Ixy" value={props.Ixy} q="I" system={unitSystem} />
      </Section>

      <Section title="Section Moduli (Elastic)">
        <Row label="Sx (top)" value={props.Sx_top} q="sectionModulus" system={unitSystem} />
        <Row label="Sx (bot)" value={props.Sx_bot} q="sectionModulus" system={unitSystem} />
        <Row label="Sy (left)" value={props.Sy_left} q="sectionModulus" system={unitSystem} />
        <Row label="Sy (right)" value={props.Sy_right} q="sectionModulus" system={unitSystem} />
      </Section>

      <Section title="Plastic Moduli">
        <Row label="Zx" value={props.Zx} q="sectionModulus" system={unitSystem} />
        <Row label="Zy" value={props.Zy} q="sectionModulus" system={unitSystem} />
      </Section>

      <Section title="Principal Axes">
        <Row label="I₁ (major)" value={props.I1} q="I" system={unitSystem} />
        <Row label="I₂ (minor)" value={props.I2} q="I" system={unitSystem} />
        <RawRow label="α (angle)" value={`${((props.alpha * 180) / Math.PI).toFixed(2)}°`} />
      </Section>

      <Section title="Radii of Gyration">
        <Row label="rx" value={props.rx} q="dimension" system={unitSystem} />
        <Row label="ry" value={props.ry} q="dimension" system={unitSystem} />
        <Row label="r₁" value={props.r1} q="dimension" system={unitSystem} />
        <Row label="r₂" value={props.r2} q="dimension" system={unitSystem} />
      </Section>

      <Section title="Torsion">
        <Row label="J (St-Venant)" value={props.J} q="torsion" system={unitSystem} />
        <Row label="Cw (warping)" value={props.Cw} q="warping" system={unitSystem} />
      </Section>

      <Section title="Shear">
        <Row label="Qx,max (first moment)" value={props.Qx_max} q="sectionModulus" system={unitSystem} />
        <Row label="Shear center x" value={props.shearCenterX} q="dimension" system={unitSystem} />
        <Row label="Shear center y" value={props.shearCenterY} q="dimension" system={unitSystem} />
      </Section>

      {weightPerLength !== undefined && weightPerLength > 0 && (
        <Section title="Weight">
          <Row label="Weight / length" value={weightPerLength} q="massPerLength" system={unitSystem} digits={2} />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sb-props__section">
      <div className="sb-props__group">{title}</div>
      <dl className="sb-props__list">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  q,
  system,
  digits = 3,
}: {
  label: string;
  value: number;
  q: Quantity;
  system: UnitSystem;
  digits?: number;
}) {
  return (
    <>
      <dt className="sb-props__dt">{label}</dt>
      <dd className="sb-props__dd">
        <span className="sb-props__num">{formatValue(value, q, system, digits)}</span>
        <span className="sb-props__unit">{unitLabel(q, system)}</span>
      </dd>
    </>
  );
}

function RawRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="sb-props__dt">{label}</dt>
      <dd className="sb-props__dd">
        <span className="sb-props__num">{value}</span>
      </dd>
    </>
  );
}
