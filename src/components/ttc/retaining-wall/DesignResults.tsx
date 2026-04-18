'use client';

import React from 'react';
import type { WallResults } from '@/lib/retaining-wall/types';

interface Props {
  results: WallResults;
}

export function DesignResults({ results }: Props) {
  const { stem, heel, toe } = results;

  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Reinforcement Design (ACI 318)</h3>

      <SectionBlock title="Stem (vertical rebar, back face)">
        <Row label="Mu" value={`${stem.Mu.toFixed(1)} kN·m/m`} />
        <Row label="Vu" value={`${stem.Vu.toFixed(1)} kN/m`} />
        <Row label="d" value={`${stem.d.toFixed(0)} mm`} />
        <Row label="a (block)" value={`${stem.a.toFixed(1)} mm`} />
        <Row label="ρ" value={stem.rho.toFixed(4)} />
        <Row label="As req" value={`${stem.As_req.toFixed(0)} mm²/m`} />
        <Row label="As min" value={`${stem.As_min.toFixed(0)} mm²/m`} />
        <Row label="φMn provided" value={`${stem.phiMn.toFixed(1)} kN·m/m`} />
        <CheckRow label="Shear (Vu ≤ φVc)" ok={stem.shearOk} value={`φVc=${(0.75 * stem.Vc).toFixed(1)}`} />
      </SectionBlock>

      <SectionBlock title="Heel (top reinforcement)">
        <Row label="Mu" value={`${heel.Mu.toFixed(1)} kN·m/m`} />
        <Row label="Vu" value={`${heel.Vu.toFixed(1)} kN/m`} />
        <Row label="d" value={`${heel.d.toFixed(0)} mm`} />
        <Row label="As req" value={`${heel.As_req.toFixed(0)} mm²/m`} />
        <Row label="As min" value={`${heel.As_min.toFixed(0)} mm²/m`} />
        <Row label="φMn" value={`${heel.phiMn.toFixed(1)} kN·m/m`} />
        <CheckRow label="Shear" ok={heel.shearOk} value={`φVc=${(0.75 * heel.Vc).toFixed(1)}`} />
      </SectionBlock>

      <SectionBlock title="Toe (bottom reinforcement)">
        <Row label="Mu" value={`${toe.Mu.toFixed(1)} kN·m/m`} />
        <Row label="Vu" value={`${toe.Vu.toFixed(1)} kN/m`} />
        <Row label="d" value={`${toe.d.toFixed(0)} mm`} />
        <Row label="As req" value={`${toe.As_req.toFixed(0)} mm²/m`} />
        <Row label="As min" value={`${toe.As_min.toFixed(0)} mm²/m`} />
        <Row label="φMn" value={`${toe.phiMn.toFixed(1)} kN·m/m`} />
        <CheckRow label="Shear" ok={toe.shearOk} value={`φVc=${(0.75 * toe.Vc).toFixed(1)}`} />
      </SectionBlock>
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rw-design-section">
      <div className="rw-design-section__title">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rw-row">
      <span className="rw-row__label">{label}</span>
      <span className="rw-row__value">{value}</span>
    </div>
  );
}

function CheckRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`rw-row rw-row--check ${ok ? 'is-ok' : 'is-fail'}`}>
      <span className="rw-row__label">{label}</span>
      <span className="rw-row__value">
        {value}
        <span className="rw-row__flag">{ok ? '✓' : '✗'}</span>
      </span>
    </div>
  );
}
