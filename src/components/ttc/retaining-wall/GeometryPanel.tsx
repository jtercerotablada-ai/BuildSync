'use client';

// Geometry router. Mounts the per-kind sub-panel based on geometry.kind.
// Each sub-panel lives in `geometry-panels.tsx` and shares Field / RawField
// helpers from that file.

import React from 'react';
import type { WallGeometry } from '@/lib/retaining-wall/types';
import type { UnitSystem } from '@/lib/beam/units';
import {
  CantileverGeometryPanel,
  GravityGeometryPanel,
  SemiGravityGeometryPanel,
  LShapedGeometryPanel,
  CounterfortGeometryPanel,
  ButtressedGeometryPanel,
  BasementGeometryPanel,
  AbutmentGeometryPanel,
} from './geometry-panels';

interface Props {
  geometry: WallGeometry;
  unitSystem: UnitSystem;
  onChange: (g: WallGeometry) => void;
}

export function GeometryPanel({ geometry, unitSystem, onChange }: Props) {
  switch (geometry.kind) {
    case 'cantilever':
      return <CantileverGeometryPanel geometry={geometry} unitSystem={unitSystem} onChange={onChange} />;
    case 'gravity':
      return <GravityGeometryPanel geometry={geometry} unitSystem={unitSystem} onChange={onChange} />;
    case 'semi-gravity':
      return <SemiGravityGeometryPanel geometry={geometry} unitSystem={unitSystem} onChange={onChange} />;
    case 'l-shaped':
      return <LShapedGeometryPanel geometry={geometry} unitSystem={unitSystem} onChange={onChange} />;
    case 'counterfort':
      return <CounterfortGeometryPanel geometry={geometry} unitSystem={unitSystem} onChange={onChange} />;
    case 'buttressed':
      return <ButtressedGeometryPanel geometry={geometry} unitSystem={unitSystem} onChange={onChange} />;
    case 'basement':
      return <BasementGeometryPanel geometry={geometry} unitSystem={unitSystem} onChange={onChange} />;
    case 'abutment':
      return <AbutmentGeometryPanel geometry={geometry} unitSystem={unitSystem} onChange={onChange} />;
  }
}
