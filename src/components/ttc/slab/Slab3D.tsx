'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Text } from '@react-three/drei';
import * as THREE from 'three';
import { buildContours, colorFor, type ContourField } from '@/lib/slab/contour';
import type { SlabAnalysis, SlabInput } from '@/lib/slab/types';

type Field = 'Mx' | 'My' | 'Asx' | 'Asy' | 'deflection';

interface Props {
  result: SlabAnalysis;
  input: SlabInput;
}

export function Slab3D({ result, input }: Props) {
  const [field, setField] = useState<Field>('Mx');
  const [showRebar, setShowRebar] = useState(true);
  const [showDeformed, setShowDeformed] = useState(true);
  const [exaggeration, setExaggeration] = useState(50);   // multiplier for deformed shape

  const Lx = result.geometry.Lx;
  const Ly = result.geometry.Ly;
  const h = result.geometry.h / 1000;        // m

  return (
    <div className="slab-3d">
      <div className="slab-3d__controls">
        <div className="slab-contour__tabs">
          {([
            ['Mx', 'Mx'], ['My', 'My'],
            ['Asx', 'As (x)'], ['Asy', 'As (y)'],
            ['deflection', 'Deflection'],
          ] as const).map(([k, label]) => (
            <button key={k} type="button"
              className={`slab-contour__tab ${k === field ? 'slab-contour__tab--active' : ''}`}
              onClick={() => setField(k as Field)}>{label}</button>
          ))}
        </div>
        <label className="ab-toggle"><input type="checkbox" checked={showDeformed}
          onChange={(e) => setShowDeformed(e.target.checked)} /> <span>Deformed</span></label>
        <label className="ab-toggle"><input type="checkbox" checked={showRebar}
          onChange={(e) => setShowRebar(e.target.checked)} /> <span>Rebar layout</span></label>
        <label className="slab-3d__slider">
          <span>Exaggeration ×{exaggeration}</span>
          <input type="range" min="1" max="200" step="1" value={exaggeration}
            onChange={(e) => setExaggeration(parseInt(e.target.value))} />
        </label>
      </div>
      <div className="slab-3d__canvas">
        <Canvas
          shadows
          camera={{ position: [Lx * 1.4, Ly * 1.6, Lx * 1.6], fov: 35, near: 0.1, far: 200 }}
          gl={{ antialias: true, preserveDrawingBuffer: false }}
        >
          <color attach="background" args={['#0c0c0c']} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[Lx * 2, Lx * 3, Lx * 2]} intensity={0.85} castShadow
            shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
          <directionalLight position={[-Lx, Lx, -Lx]} intensity={0.25} />

          <SlabMesh result={result} field={field}
            showDeformed={showDeformed} exaggeration={exaggeration} />

          {result.punching && input.punching && <ColumnMesh result={result} input={input} />}
          {showRebar && <RebarLayout result={result} />}

          {/* Floor grid for spatial reference */}
          <Grid args={[Lx * 4, Ly * 4]} cellSize={0.5} cellThickness={0.5}
            cellColor="rgba(201, 168, 76, 0.18)" sectionSize={1}
            sectionThickness={1.0} sectionColor="rgba(201, 168, 76, 0.30)"
            fadeDistance={Lx * 6} fadeStrength={1.5}
            position={[Lx / 2, -h, Ly / 2]} infiniteGrid={false} />

          <OrbitControls enableDamping target={[Lx / 2, 0, Ly / 2]} maxDistance={Lx * 8} minDistance={Lx * 0.5} />
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport axisColors={['#c9a84c', '#5fb674', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>

          <DimensionLabels Lx={Lx} Ly={Ly} h={result.geometry.h} />
        </Canvas>
      </div>
      <p className="slab-3d__hint">
        Drag to rotate · scroll to zoom · right-click drag to pan · gizmo (bottom right) shows axes
      </p>
    </div>
  );
}

// =============================================================================
// Slab plate mesh with deformation + vertex colors
// =============================================================================
function SlabMesh({ result, field, showDeformed, exaggeration }:
  { result: SlabAnalysis; field: Field; showDeformed: boolean; exaggeration: number }) {

  const Lx = result.geometry.Lx;
  const Ly = result.geometry.Ly;
  const h = result.geometry.h / 1000;

  const contours = useMemo(() => buildContours(result), [result]);

  // Deflection shape factor at (x, y) using same shape functions as contour
  // (build a small lookup grid for w(x,y) using the deflection sample shape)
  const deflectionGrid = useMemo(() => buildDeflectionGrid(result), [result]);
  const maxDef = Math.max(...deflectionGrid.flat().map(Math.abs), 1e-9);

  // Build geometry once
  const geometry = useMemo(() => {
    const SEG = 60;
    const geo = new THREE.PlaneGeometry(Lx, Ly, SEG, SEG);
    // PlaneGeometry is in xy plane facing +z. We want it in xz plane (y up).
    geo.rotateX(-Math.PI / 2);
    geo.translate(Lx / 2, 0, Ly / 2);
    return geo;
  }, [Lx, Ly]);

  // Pick the active field for vertex coloring
  const activeField: ContourField = field === 'Mx' ? contours.Mx
    : field === 'My' ? contours.My
    : field === 'Asx' ? contours.Asx
    : field === 'Asy' ? contours.Asy
    : { xs: contours.Mx.xs, ys: contours.Mx.ys,
        values: deflectionGrid,
        vmin: -maxDef, vmax: maxDef,
        label: 'Deflection', unit: 'mm' };
  const isSigned = field === 'Mx' || field === 'My' || field === 'deflection';

  // Apply per-vertex colors and deformation
  useMemo(() => {
    const pos = geometry.attributes.position;
    const colorAttr = geometry.attributes.color as THREE.BufferAttribute | undefined;
    const vCount = pos.count;
    const colors = colorAttr ?? new THREE.Float32BufferAttribute(new Float32Array(vCount * 3), 3);
    const c = new THREE.Color();
    const defScale = (showDeformed ? (exaggeration / 100) : 0) * h * 4;     // visual scale

    for (let i = 0; i < vCount; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Sample at (x, z) → use field grid
      const v = sampleField(activeField, x, z, Lx, Ly);
      const dy = sampleField({
        xs: contours.Mx.xs, ys: contours.Mx.ys, values: deflectionGrid,
        vmin: -maxDef, vmax: maxDef, label: '', unit: '',
      }, x, z, Lx, Ly);
      pos.setY(i, (showDeformed ? -dy / 1000 : 0) * (exaggeration * 0.04));

      const hex = colorFor(v, activeField.vmin, activeField.vmax, isSigned);
      c.setStyle(hex);
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true;
    if (!colorAttr) geometry.setAttribute('color', colors);
    else (colorAttr as THREE.BufferAttribute).needsUpdate = true;
    geometry.computeVertexNormals();
    void defScale;
  }, [activeField, isSigned, showDeformed, exaggeration, geometry, h, Lx, Ly, deflectionGrid, maxDef, contours.Mx.xs, contours.Mx.ys]);

  return (
    <group>
      {/* Top deformed surface */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide}
          roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Bottom flat plate to suggest thickness */}
      <mesh position={[Lx / 2, -h, Ly / 2]} castShadow receiveShadow>
        <boxGeometry args={[Lx, h, Ly]} />
        <meshStandardMaterial color="#2a2418" transparent opacity={0.35}
          roughness={0.9} />
      </mesh>
      {/* Edge band — thin gold rim around the plate */}
      <EdgeBand Lx={Lx} Ly={Ly} />
    </group>
  );
}

function EdgeBand({ Lx, Ly }: { Lx: number; Ly: number }) {
  const w = 0.02;
  const gold = '#c9a84c';
  return (
    <group>
      <mesh position={[Lx / 2, w / 2, 0]}><boxGeometry args={[Lx, w, w]} /><meshStandardMaterial color={gold} /></mesh>
      <mesh position={[Lx / 2, w / 2, Ly]}><boxGeometry args={[Lx, w, w]} /><meshStandardMaterial color={gold} /></mesh>
      <mesh position={[0, w / 2, Ly / 2]}><boxGeometry args={[w, w, Ly]} /><meshStandardMaterial color={gold} /></mesh>
      <mesh position={[Lx, w / 2, Ly / 2]}><boxGeometry args={[w, w, Ly]} /><meshStandardMaterial color={gold} /></mesh>
    </group>
  );
}

// =============================================================================
// Column + drop panel
// =============================================================================
function ColumnMesh({ result, input }: { result: SlabAnalysis; input: SlabInput }) {
  const Lx = result.geometry.Lx;
  const Ly = result.geometry.Ly;
  const h = result.geometry.h / 1000;
  const inp = input.punching!;
  const c1 = inp.c1 / 1000;
  const c2 = (inp.c2 ?? inp.c1) / 1000;
  const colHeight = Math.max(Lx, Ly) * 0.7;

  let cx = Lx / 2, cz = Ly / 2;
  if (inp.position === 'edge')   { cz = 0; }
  if (inp.position === 'corner') { cx = 0; cz = 0; }

  return (
    <group>
      <mesh position={[cx, -h - colHeight / 2, cz]} castShadow>
        <boxGeometry args={[c1, colHeight, c2]} />
        <meshStandardMaterial color="#888" roughness={0.6} />
      </mesh>
      {result.punching?.dropPanel && (
        <mesh position={[cx, -result.punching.dropPanel.thickness / 1000 / 2, cz]} castShadow>
          <boxGeometry args={[
            result.punching.dropPanel.size / 1000,
            result.punching.dropPanel.thickness / 1000,
            result.punching.dropPanel.size / 1000,
          ]} />
          <meshStandardMaterial color="#3d3424" transparent opacity={0.85} />
        </mesh>
      )}
      {inp.Vu > 0 && (
        <ForceArrow x={cx} y={Math.max(Lx, Ly) * 0.4} z={cz} Vu={inp.Vu} />
      )}
    </group>
  );
}

function ForceArrow({ x, y, z, Vu }: { x: number; y: number; z: number; Vu: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, y / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, y, 12]} />
        <meshStandardMaterial color="#c94c4c" />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.05, 0.12, 12]} />
        <meshStandardMaterial color="#c94c4c" />
      </mesh>
      <Text position={[0, y, 0]} fontSize={0.18} color="#ff8a72" anchorX="center">
        {`Vu = ${Vu} kN`}
      </Text>
    </group>
  );
}

// =============================================================================
// Reinforcement layout — top + bottom bars in both directions
// =============================================================================
function RebarLayout({ result }: { result: SlabAnalysis }) {
  const Lx = result.geometry.Lx;
  const Ly = result.geometry.Ly;
  const h = result.geometry.h / 1000;

  const midX = result.reinforcement.find((r) => r.location === 'mid-x');
  const midY = result.reinforcement.find((r) => r.location === 'mid-y');
  const supX = result.reinforcement.find((r) => r.location === 'sup-x');
  const supY = result.reinforcement.find((r) => r.location === 'sup-y');

  const bottomCoverY = (result.geometry.cover_bottom_x ?? 25) / 1000;
  const topCoverY = (result.geometry.cover_top_x ?? 25) / 1000;

  const bars: React.ReactElement[] = [];
  const barRadius = 0.008;

  // Bottom bars in x-direction (run along x at constant y position, spaced in z)
  if (midX) {
    const sp = midX.spacing / 1000;
    const yPos = -h + bottomCoverY;
    for (let z = sp / 2; z < Ly; z += sp) {
      bars.push(
        <mesh key={`bx-${z.toFixed(3)}`} position={[Lx / 2, yPos, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[barRadius, barRadius, Lx, 8]} />
          <meshStandardMaterial color="#5fb674" metalness={0.5} roughness={0.4} />
        </mesh>
      );
    }
  }
  // Bottom bars in y-direction
  if (midY) {
    const sp = midY.spacing / 1000;
    const yPos = -h + bottomCoverY + 2 * barRadius + 0.005;
    for (let x = sp / 2; x < Lx; x += sp) {
      bars.push(
        <mesh key={`by-${x.toFixed(3)}`} position={[x, yPos, Ly / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[barRadius, barRadius, Ly, 8]} />
          <meshStandardMaterial color="#4a90c9" metalness={0.5} roughness={0.4} />
        </mesh>
      );
    }
  }
  // Top bars at edges (only if non-zero negative moment)
  if (supX && Math.abs(result.moments.Mx_neg) > 0.1) {
    const sp = supX.spacing / 1000;
    const yPos = -topCoverY;
    // Top bars only at the 2 long edges (where the negative moment is)
    const stripWidth = Math.min(Ly / 4, 1.5);
    const zPositions = [stripWidth / 2, Ly - stripWidth / 2];
    for (const zCenter of zPositions) {
      for (let z = zCenter - stripWidth / 2 + sp / 2; z < zCenter + stripWidth / 2; z += sp) {
        bars.push(
          <mesh key={`tx-${z.toFixed(3)}`} position={[Lx / 2, yPos, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[barRadius, barRadius, Lx, 8]} />
            <meshStandardMaterial color="#c9a84c" metalness={0.6} roughness={0.3} />
          </mesh>
        );
      }
    }
  }
  return <group>{bars}</group>;
}

// =============================================================================
// Dimension labels
// =============================================================================
function DimensionLabels({ Lx, Ly, h }: { Lx: number; Ly: number; h: number }) {
  const fs = Math.max(0.18, Math.min(Lx, Ly) / 25);
  return (
    <group>
      <Text position={[Lx / 2, -h / 2 - 0.4, Ly + 0.4]} fontSize={fs} color="#c9a84c"
        anchorX="center">{`Lx = ${Lx.toFixed(2)} m`}</Text>
      <Text position={[Lx + 0.4, -h / 2 - 0.4, Ly / 2]} fontSize={fs} color="#c9a84c"
        anchorX="center" rotation={[0, -Math.PI / 2, 0]}>{`Ly = ${Ly.toFixed(2)} m`}</Text>
      <Text position={[Lx + 0.6, -h / 2, 0]} fontSize={fs} color="#c9a84c"
        anchorX="left">{`h = ${h.toFixed(0)} mm`}</Text>
    </group>
  );
}

// =============================================================================
// Helpers
// =============================================================================
function sampleField(field: ContourField, x: number, z: number, Lx: number, Ly: number): number {
  const fx = Math.max(0, Math.min(1, x / Lx));
  const fy = Math.max(0, Math.min(1, z / Ly));
  const nx = field.xs.length;
  const ny = field.ys.length;
  const ix = Math.min(nx - 2, Math.floor(fx * (nx - 1)));
  const iy = Math.min(ny - 2, Math.floor(fy * (ny - 1)));
  const tx = fx * (nx - 1) - ix;
  const ty = fy * (ny - 1) - iy;
  const v00 = field.values[ix][iy];
  const v10 = field.values[ix + 1][iy];
  const v01 = field.values[ix][iy + 1];
  const v11 = field.values[ix + 1][iy + 1];
  const v0 = v00 * (1 - tx) + v10 * tx;
  const v1 = v01 * (1 - tx) + v11 * tx;
  return v0 * (1 - ty) + v1 * ty;
}

function buildDeflectionGrid(result: SlabAnalysis): number[][] {
  // Approximate deflected shape in mm using SS-style sin·sin shape scaled by max delta
  const NX = 41, NY = 41;
  const Lx = result.geometry.Lx;
  const Ly = result.geometry.Ly;
  const dMax = Math.abs(result.deflection.delta_immediate ?? 0);
  const sign = -1;        // downward = negative y
  const grid: number[][] = [];
  for (let i = 0; i < NX; i++) {
    const row: number[] = [];
    const tx = i / (NX - 1);
    const sx = Math.sin(Math.PI * tx);
    for (let j = 0; j < NY; j++) {
      const ty = j / (NY - 1);
      const sy = Math.sin(Math.PI * ty);
      row.push(sign * dMax * sx * sy);
    }
    grid.push(row);
  }
  void Lx; void Ly;
  return grid;
}
