'use client';

import React, { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Grid, GizmoHelper, GizmoViewport, ContactShadows, Environment, Text,
} from '@react-three/drei';
import * as THREE from 'three';
import warehouseHDR from '@pmndrs/assets/hdri/warehouse.exr';
import type { CombinedFootingInput, CombinedFootingAnalysis, CombinedColumn } from '@/lib/combined-footing/types';
import { lookupBar } from '@/lib/rc/types';

const MM_TO_M = 0.001;

interface Props {
  input: CombinedFootingInput;
  result: CombinedFootingAnalysis;
}

/**
 * CombinedFooting3D — three-dimensional viewer for a two-column combined
 * footing.  Mirrors the Footing3D pattern but renders BOTH columns and a
 * full longitudinal+transverse rebar cage.
 *
 *   • Footing pad: B × L × T centered on origin, top of pad at y = 0
 *   • Two columns rising in +y at their respective `position` along L
 *   • Bottom-longitudinal bars (running along L) — coral
 *   • Bottom-transverse bars (running along B) — coral, slightly above
 *     the longitudinal mat
 *   • Top-longitudinal bars (negative-moment region between columns) — sage
 *   • Soil overburden if embedment > 0
 *   • Optional load arrows above each column (red, emissive)
 */
export function CombinedFooting3D({ input, result }: Props) {
  const [cutaway, setCutaway] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [showColumns, setShowColumns] = useState(true);
  const [showSoil, setShowSoil] = useState(true);
  const [showLoads, setShowLoads] = useState(true);

  const g = input.geometry;
  const B = g.B * MM_TO_M;
  const L = g.L * MM_TO_M;
  const T = g.T * MM_TO_M;
  const cover = g.coverClear * MM_TO_M;

  const camDist = Math.max(B, L) * 1.55;

  const concreteMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#cdc8bf',
      roughness: 0.92,
      metalness: 0.0,
      transparent: cutaway,
      opacity: cutaway ? 0.32 : 1.0,
      depthWrite: !cutaway,
      side: cutaway ? THREE.DoubleSide : THREE.FrontSide,
    });
  }, [cutaway]);

  const rebarMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#7a6450', roughness: 0.6, metalness: 0.85,
  }), []);
  const topRebarMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#5e8aa0', roughness: 0.6, metalness: 0.85,
  }), []);

  // Footing left edge in mat-local coordinates (mm); columns positioned in
  // GLOBAL coordinates → convert to footing-local x ∈ [-L/2, L/2]
  const leftEdge = g.leftEdge ?? 0;

  return (
    <div className="rc-3d slab-3d">
      <div className="slab-3d__controls">
        <div className="slab-contour__tabs" style={{ flexWrap: 'wrap' }}>
          <span className="slab-3d__hint" style={{ marginRight: '0.4rem', alignSelf: 'center' }}>VIEW —</span>
          <label className="ab-toggle"><input type="checkbox" checked={cutaway}
            onChange={(e) => setCutaway(e.target.checked)} /> <span>Glass concrete</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showRebar}
            onChange={(e) => setShowRebar(e.target.checked)} /> <span>Rebar (top + bottom + transverse)</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showColumns}
            onChange={(e) => setShowColumns(e.target.checked)} /> <span>Columns above</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showSoil}
            onChange={(e) => setShowSoil(e.target.checked)} /> <span>Soil overburden</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showLoads}
            onChange={(e) => setShowLoads(e.target.checked)} /> <span>Load arrows</span></label>
        </div>
      </div>

      <div className="rc-3d__canvas slab-3d__canvas">
        <Canvas
          shadows
          camera={{ position: [camDist, camDist * 0.85, camDist], fov: 38, near: 0.05, far: 200 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#0a0a0a']} />
          <Suspense fallback={null}>
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.18} />
          </Suspense>
          <ambientLight intensity={0.55} />
          <directionalLight position={[L * 2, L * 3, B * 2]} intensity={0.55} castShadow
            shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0005} />
          <directionalLight position={[-L, L * 1.4, -B]} intensity={0.18} />

          {/* Footing concrete pad — long axis aligned with X (matches L = longitudinal) */}
          <mesh position={[0, -T / 2, 0]} receiveShadow castShadow material={concreteMat}>
            <boxGeometry args={[L, T, B]} />
          </mesh>

          {/* Gold edge bands — wrap the 12 edges of the footing box (slab pattern) */}
          <EdgeBand L={L} B={B} T={T} />

          {/* Dimension labels floating in 3D */}
          <Suspense fallback={null}>
            <DimensionLabels L={L} B={B} T={input.geometry.T} />
          </Suspense>

          {showColumns && [input.column1, input.column2].map((col, i) => (
            <ColumnAbove key={i} col={col} L={L} B={B} cutaway={cutaway}
              colXLocal={(col.position - leftEdge) * MM_TO_M - L / 2} />
          ))}

          {showSoil && (g.embedment ?? 0) > 0 && (
            <SoilOverburden L={L} B={B} T={T} embedment={(g.embedment ?? 0) * MM_TO_M} />
          )}

          {showRebar && (
            <>
              <BottomLongRebar input={input} L={L} B={B} T={T} cover={cover} mat={rebarMat} />
              <BottomTransRebar input={input} L={L} B={B} T={T} cover={cover} mat={rebarMat}
                yOffset={(lookupBar(input.reinforcement.bottomLong.bar)?.db ?? 22) * MM_TO_M} />
              {input.reinforcement.topLong && (
                <TopLongRebar input={input} L={L} B={B} T={T} cover={cover} mat={topRebarMat} />
              )}
            </>
          )}

          {showLoads && showColumns && [input.column1, input.column2].map((col, i) => {
            const Pu = i === 0 ? result.beam.Pu1 : result.beam.Pu2;
            return (
              <LoadArrow key={i} col={col} L={L}
                colXLocal={(col.position - leftEdge) * MM_TO_M - L / 2}
                label={`Pu${i + 1} = ${Pu.toFixed(0)} kN`} />
            );
          })}

          <ContactShadows position={[0, -T - 0.001, 0]}
            opacity={0.55} scale={Math.max(L, B) * 2.5}
            blur={2.4} far={3} resolution={1024} frames={1} smooth />

          <Grid args={[L * 6, B * 6]}
            cellSize={0.5} cellThickness={0.45} cellColor="#3a3320"
            sectionSize={1.0} sectionThickness={0.9} sectionColor="#5a4f30"
            fadeDistance={Math.max(L, B) * 8} fadeStrength={1.4}
            position={[0, -T - 0.012, 0]} infiniteGrid={false} />

          <OrbitControls makeDefault enableDamping
            target={[0, -T / 2, 0]}
            maxDistance={Math.max(L, B) * 8}
            minDistance={Math.max(L, B) * 0.4}
            maxPolarAngle={Math.PI / 2 - 0.02}
          />
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport axisColors={['#c9a84c', '#7fb691', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>
        </Canvas>
      </div>
      <p className="slab-3d__hint">
        Drag to rotate · scroll to zoom · right-click drag to pan · toggle Glass-concrete to see the rebar cage and dowel layout
      </p>
    </div>
  );
}

// ─── COLUMN ABOVE ───────────────────────────────────────────────────────────

// ─── EDGE BANDS (gold trim around the 12 edges of the footing box) ─────────

function EdgeBand({ L, B, T }: { L: number; B: number; T: number }) {
  const w = 0.018;
  const gold = '#c9a84c';
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: gold, metalness: 0.55, roughness: 0.4,
  }), []);
  return (
    <group>
      {/* Top 4 edges (footing top at y = 0) */}
      <mesh position={[0,  w / 2,  B / 2]} material={mat}><boxGeometry args={[L, w, w]} /></mesh>
      <mesh position={[0,  w / 2, -B / 2]} material={mat}><boxGeometry args={[L, w, w]} /></mesh>
      <mesh position={[ L / 2,  w / 2, 0]} material={mat}><boxGeometry args={[w, w, B]} /></mesh>
      <mesh position={[-L / 2,  w / 2, 0]} material={mat}><boxGeometry args={[w, w, B]} /></mesh>
      {/* Bottom 4 edges (footing bottom at y = -T) */}
      <mesh position={[0, -T - w / 2,  B / 2]} material={mat}><boxGeometry args={[L, w, w]} /></mesh>
      <mesh position={[0, -T - w / 2, -B / 2]} material={mat}><boxGeometry args={[L, w, w]} /></mesh>
      <mesh position={[ L / 2, -T - w / 2, 0]} material={mat}><boxGeometry args={[w, w, B]} /></mesh>
      <mesh position={[-L / 2, -T - w / 2, 0]} material={mat}><boxGeometry args={[w, w, B]} /></mesh>
      {/* Vertical 4 edges */}
      <mesh position={[ L / 2, -T / 2,  B / 2]} material={mat}><boxGeometry args={[w, T, w]} /></mesh>
      <mesh position={[-L / 2, -T / 2,  B / 2]} material={mat}><boxGeometry args={[w, T, w]} /></mesh>
      <mesh position={[ L / 2, -T / 2, -B / 2]} material={mat}><boxGeometry args={[w, T, w]} /></mesh>
      <mesh position={[-L / 2, -T / 2, -B / 2]} material={mat}><boxGeometry args={[w, T, w]} /></mesh>
    </group>
  );
}

// ─── DIMENSION LABELS (gold text floating in 3D) ───────────────────────────

function DimensionLabels({ L, B, T }: { L: number; B: number; T: number }) {
  const fs = Math.max(0.18, Math.min(L, B) / 22);
  return (
    <group>
      <Text position={[0, -T / 2 - 0.4, B / 2 + 0.5]} fontSize={fs} color="#c9a84c"
        anchorX="center" outlineWidth={0.005} outlineColor="#000">
        {`L = ${L.toFixed(2)} m`}
      </Text>
      <Text position={[L / 2 + 0.5, -T / 2 - 0.4, 0]} fontSize={fs} color="#c9a84c"
        anchorX="center" rotation={[0, -Math.PI / 2, 0]}
        outlineWidth={0.005} outlineColor="#000">
        {`B = ${B.toFixed(2)} m`}
      </Text>
      <Text position={[L / 2 + 0.6, -T / 2, B / 2 + 0.05]} fontSize={fs * 0.85} color="#c9a84c"
        anchorX="left" outlineWidth={0.005} outlineColor="#000">
        {`T = ${T} mm`}
      </Text>
    </group>
  );
}

function ColumnAbove({
  col, L, B, cutaway, colXLocal,
}: {
  col: CombinedColumn; L: number; B: number; cutaway: boolean; colXLocal: number;
}) {
  void L; void B;
  const cl = col.cl * MM_TO_M;
  const ct = (col.shape === 'circular' ? col.cl : (col.ct ?? col.cl)) * MM_TO_M;
  const colHeight = Math.max(cl, ct) * 5;     // visual height
  const colMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#a8a39a',
    roughness: 0.85, metalness: 0.05,
    transparent: cutaway, opacity: cutaway ? 0.55 : 1.0,
    side: cutaway ? THREE.DoubleSide : THREE.FrontSide,
  }), [cutaway]);
  return (
    <mesh position={[colXLocal, colHeight / 2, 0]} material={colMat} castShadow>
      {col.shape === 'circular'
        ? <cylinderGeometry args={[cl / 2, cl / 2, colHeight, 32]} />
        : <boxGeometry args={[cl, colHeight, ct]} />}
    </mesh>
  );
}

// ─── SOIL OVERBURDEN ────────────────────────────────────────────────────────

function SoilOverburden({ L, B, T, embedment }: { L: number; B: number; T: number; embedment: number }) {
  void T;
  const soilMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#6b5240', roughness: 0.95, metalness: 0.0,
    transparent: true, opacity: 0.40,
  }), []);
  return (
    <mesh position={[0, embedment / 2, 0]} material={soilMat} castShadow={false}>
      <boxGeometry args={[L * 1.4, embedment, B * 1.4]} />
    </mesh>
  );
}

// ─── BOTTOM-LONGITUDINAL REBAR (running along L = X) ────────────────────────

function BottomLongRebar({
  input, L, B, T, cover, mat,
}: {
  input: CombinedFootingInput; L: number; B: number; T: number; cover: number;
  mat: THREE.MeshStandardMaterial;
}) {
  const layer = input.reinforcement.bottomLong;
  const db = (lookupBar(layer.bar)?.db ?? 22) * MM_TO_M;
  const r = db / 2;
  const n = layer.count;
  const usable = B - 2 * cover;
  const dz = n > 1 ? usable / (n - 1) : 0;
  const yPos = -T + cover + r;     // sit at the bottom face, above the cover

  const bars: React.ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const z = -B / 2 + cover + i * dz;
    bars.push(
      <mesh key={`bL-${i}`} position={[0, yPos, z]}
            rotation={[0, 0, Math.PI / 2]} material={mat} castShadow>
        <cylinderGeometry args={[r, r, L - 2 * cover, 12]} />
      </mesh>
    );
  }
  return <>{bars}</>;
}

// ─── BOTTOM-TRANSVERSE REBAR (running along B = Z, sitting above bottom-long) ─

function BottomTransRebar({
  input, L, B, T, cover, mat, yOffset,
}: {
  input: CombinedFootingInput; L: number; B: number; T: number; cover: number;
  mat: THREE.MeshStandardMaterial; yOffset: number;
}) {
  const layer = input.reinforcement.bottomTrans;
  const db = (lookupBar(layer.bar)?.db ?? 22) * MM_TO_M;
  const r = db / 2;
  const n = layer.count;
  const usable = L - 2 * cover;
  const dx = n > 1 ? usable / (n - 1) : 0;
  const yPos = -T + cover + yOffset + r;

  const bars: React.ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + cover + i * dx;
    bars.push(
      <mesh key={`bT-${i}`} position={[x, yPos, 0]}
            rotation={[Math.PI / 2, 0, 0]} material={mat} castShadow>
        <cylinderGeometry args={[r, r, B - 2 * cover, 12]} />
      </mesh>
    );
  }
  return <>{bars}</>;
}

// ─── TOP-LONGITUDINAL REBAR (negative moment region) ────────────────────────

function TopLongRebar({
  input, L, B, T, cover, mat,
}: {
  input: CombinedFootingInput; L: number; B: number; T: number; cover: number;
  mat: THREE.MeshStandardMaterial;
}) {
  const layer = input.reinforcement.topLong;
  if (!layer) return null;
  void T;
  const db = (lookupBar(layer.bar)?.db ?? 22) * MM_TO_M;
  const r = db / 2;
  const n = layer.count;
  const usable = B - 2 * cover;
  const dz = n > 1 ? usable / (n - 1) : 0;
  const yPos = -cover - r;     // sit just below the top face

  const bars: React.ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const z = -B / 2 + cover + i * dz;
    bars.push(
      <mesh key={`tL-${i}`} position={[0, yPos, z]}
            rotation={[0, 0, Math.PI / 2]} material={mat} castShadow>
        <cylinderGeometry args={[r, r, L - 2 * cover, 12]} />
      </mesh>
    );
  }
  return <>{bars}</>;
}

// ─── LOAD ARROW (red emissive) ──────────────────────────────────────────────

// ─── LOAD ARROW (Slab-style: glowing shaft + cone + tip ring + label) ──────

function LoadArrow({ col, L, colXLocal, label }: {
  col: CombinedColumn; L: number; colXLocal: number; label: string;
}) {
  void L;
  const cl = col.cl * MM_TO_M;
  const colHeight = Math.max(cl, (col.ct ?? cl) * MM_TO_M) * 5;
  const shaftR = 0.022;
  const headR = 0.085;
  const headLen = 0.22;
  const shaftLen = Math.max(0.6, cl * 1.2);
  const tipY = colHeight + 0.005;
  return (
    <group position={[colXLocal, 0, 0]}>
      {/* Glowing shaft */}
      <mesh position={[0, tipY + headLen + shaftLen / 2, 0]} castShadow>
        <cylinderGeometry args={[shaftR, shaftR, shaftLen, 16]} />
        <meshStandardMaterial color="#ff5050" emissive="#a02020" emissiveIntensity={0.6}
          roughness={0.35} metalness={0.2} />
      </mesh>
      {/* Cone head pointing DOWN at the column */}
      <mesh position={[0, tipY + headLen / 2, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[headR, headLen, 24]} />
        <meshStandardMaterial color="#ff5050" emissive="#c02020" emissiveIntensity={0.65}
          roughness={0.3} metalness={0.25} />
      </mesh>
      {/* Bright disc at the tip (where load enters the column) */}
      <mesh position={[0, tipY - 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[headR * 0.6, headR * 1.2, 32]} />
        <meshStandardMaterial color="#ff7a3a" emissive="#ff4422" emissiveIntensity={0.8}
          side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      {/* Floating label with high-contrast outline */}
      <Text position={[headR + 0.05, tipY + headLen + shaftLen + 0.08, 0]}
        fontSize={0.24} color="#ffd6c8" anchorX="left" anchorY="middle"
        outlineWidth={0.012} outlineColor="#1a0b07" material-toneMapped={false}>
        {label}
      </Text>
    </group>
  );
}
