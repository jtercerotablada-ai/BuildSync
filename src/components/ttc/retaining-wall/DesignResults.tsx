'use client';

import React from 'react';
import type { WallResults, StemDesignResult, SlabDesignResult, KeyDesignResult, CrackControl } from '@/lib/retaining-wall/types';
import type { UnitSystem, Quantity } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';

interface Props {
  results: WallResults;
  unitSystem: UnitSystem;
}

export function DesignResults({ results, unitSystem }: Props) {
  const { stem, heel, toe, key } = results;

  return (
    <div className="rw-results-grid">
      <MemberBlock title="Stem (back face rebar)" member={stem} unitSystem={unitSystem} />
      <MemberBlock title="Heel (top rebar)" member={heel} unitSystem={unitSystem} />
      <MemberBlock title="Toe (bottom rebar)" member={toe} unitSystem={unitSystem} />
      {key.enabled && <KeyBlock keyResult={key} unitSystem={unitSystem} />}
    </div>
  );
}

function MemberBlock({
  title,
  member,
  unitSystem,
}: {
  title: string;
  member: StemDesignResult | SlabDesignResult;
  unitSystem: UnitSystem;
}) {
  const f = (si: number, q: Quantity, dig = 1) => fromSI(si, q, unitSystem).toFixed(dig);
  const forceU = unitLabel('forcePerLength', unitSystem);
  const momU = unitLabel('momentPerLength', unitSystem);
  const dimU = unitLabel('dimension', unitSystem);
  const areaU = unitLabel('areaPerLength', unitSystem);
  return (
    <section className="rw-results-block">
      <h4 className="rw-results-block__title">{title}</h4>
      <Row label="Mu" value={`${f(member.Mu, 'momentPerLength')} ${momU}`} />
      <Row label="Vu" value={`${f(member.Vu, 'forcePerLength')} ${forceU}`} />
      <Row label="d" value={`${f(member.d, 'dimension', 0)} ${dimU}`} />
      <Row label="a" value={`${f(member.a, 'dimension', 1)} ${dimU}`} />
      <Row label="As req" value={`${f(member.As_req, 'areaPerLength', 0)} ${areaU}`} />
      <Row label="As min" value={`${f(member.As_min, 'areaPerLength', 0)} ${areaU}`} />
      <Row label="φMn" value={`${f(member.phiMn, 'momentPerLength')} ${momU}`} />
      <CheckRow label="Shear Vu ≤ φVc" ok={member.shearOk} value={`φVc=${f(0.75 * member.Vc, 'forcePerLength')} ${forceU}`} />
      <CrackRow crack={member.crack} unitSystem={unitSystem} />
    </section>
  );
}

function KeyBlock({
  keyResult,
  unitSystem,
}: {
  keyResult: KeyDesignResult;
  unitSystem: UnitSystem;
}) {
  const f = (si: number, q: Quantity, dig = 1) => fromSI(si, q, unitSystem).toFixed(dig);
  const forceU = unitLabel('forcePerLength', unitSystem);
  const momU = unitLabel('momentPerLength', unitSystem);
  const dimU = unitLabel('dimension', unitSystem);
  const areaU = unitLabel('areaPerLength', unitSystem);
  return (
    <section className="rw-results-block rw-results-block--key">
      <h4 className="rw-results-block__title">Shear Key</h4>
      <Row label="Hp (passive on key)" value={`${f(keyResult.Hp_key, 'forcePerLength')} ${forceU}`} />
      <Row label="Mu" value={`${f(keyResult.Mu, 'momentPerLength')} ${momU}`} />
      <Row label="Vu" value={`${f(keyResult.Vu, 'forcePerLength')} ${forceU}`} />
      <Row label="d" value={`${f(keyResult.d, 'dimension', 0)} ${dimU}`} />
      <Row label="As req" value={`${f(keyResult.As_req, 'areaPerLength', 0)} ${areaU}`} />
      <Row label="As min" value={`${f(keyResult.As_min, 'areaPerLength', 0)} ${areaU}`} />
      <Row label="φMn" value={`${f(keyResult.phiMn, 'momentPerLength')} ${momU}`} />
      <CheckRow label="Shear Vu ≤ φVc" ok={keyResult.shearOk} value={`φVc=${f(0.75 * keyResult.Vc, 'forcePerLength')} ${forceU}`} />
      <CrackRow crack={keyResult.crack} unitSystem={unitSystem} />
    </section>
  );
}

function CrackRow({ crack, unitSystem }: { crack: CrackControl; unitSystem: UnitSystem }) {
  const f = (si: number, q: Quantity, dig = 0) => fromSI(si, q, unitSystem).toFixed(dig);
  const dimU = unitLabel('dimension', unitSystem);
  const value = `${crack.bar.id} @ ${f(crack.s_req, 'dimension')} ${dimU}  (max ${f(crack.s_max, 'dimension')})`;
  return (
    <div className={`rw-row rw-row--check ${crack.ok ? 'is-ok' : 'is-fail'}`}>
      <span className="rw-row__label">Crack ACI §24.3.2</span>
      <span className="rw-row__value">
        {value}
        <span className="rw-row__flag">{crack.ok ? '✓' : '✗'}</span>
      </span>
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
