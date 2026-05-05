'use client';

import React, { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Grid, GizmoHelper, GizmoViewport, ContactShadows, Environment,
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
  void result;

  const g = input.geometry;
  const B = g.B * MM_TO_M;
  const L = g.L * MM_TO_M;
  const T = g.T * MM_TO_M;
  const cover = g.coverClear * MM_TO_M;

  const camDist = Math.max(B, L) * 1.6;

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
          camera={{ position: [camDist, camDist * 0.7, camDist], fov: 38, near: 0.05, far: 200 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#0a0a0a']} />
          <Suspense fallback={null}>
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.55} />
          </Suspense>
          <ambientLight intensity={0.4} />
          <directionalLight position={[L * 4, T * 8, B * 4]} intensity={0.7} castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0005} />
          <directionalLight position={[-L * 2, T * 3, -B * 2]} intensity={0.25} />

          {/* Footing concrete pad — long axis aligned with X (matches L = longitudinal) */}
          <mesh position={[0, -T / 2, 0]} receiveShadow castShadow material={concreteMat}>
            <boxGeometry args={[L, T, B]} />
          </mesh>

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

          {showLoads && showColumns && [input.column1, input.column2].map((col, i) => (
            <LoadArrow key={i} col={col} L={L}
              colXLocal={(col.position - leftEdge) * MM_TO_M - L / 2} />
          ))}

          <Grid args={[L * 6, B * 6]}
            cellSize={0.2} cellThickness={0.45} cellColor="#3a3320"
            sectionSize={1.0} sectionThickness={0.9} sectionColor="#5a4f30"
            fadeDistance={Math.max(L, B) * 8} fadeStrength={1.4}
            position={[0, -T - 0.005, 0]} infiniteGrid={false} />

          <ContactShadows position={[0, -T - 0.001, 0]}
            opacity={0.55} scale={Math.max(L, B) * 2}
            blur={2.4} far={3} resolution={1024} frames={1} smooth />

          <OrbitControls makeDefault enableDamping
            target={[0, -T / 2, 0]}
            maxDistance={Math.max(L, B) * 8}
            minDistance={Math.max(L, B) * 0.4}
          />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['#c9a84c', '#7fb691', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>
        </Canvas>
      </div>
      <p className="slab-3d__hint" style={{ fontSize: '0.86rem', marginTop: '0.4rem' }}>
        X = longitudinal length L · Y = thickness T (vertical) · Z = transverse width B.
        Glass-concrete cutaway exposes the rebar cage; toggle off for the cast view.
      </p>
    </div>
  );
}

// ─── COLUMN ABOVE ───────────────────────────────────────────────────────────

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

function LoadArrow({ col, L, colXLocal }: { col: CombinedColumn; L: number; colXLocal: number }) {
  void L;
  const cl = col.cl * MM_TO_M;
  const arrowLen = Math.max(cl, 0.5) * 2.5;
  const arrowY = Math.max(cl, (col.ct ?? cl) * MM_TO_M) * 5 + arrowLen;
  const arrowMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff6a55', emissive: '#ff6a55', emissiveIntensity: 0.5,
    roughness: 0.4, metalness: 0.3,
  }), []);
  const headSize = arrowLen * 0.18;
  return (
    <group position={[colXLocal, arrowY, 0]}>
      <mesh material={arrowMat}>
        <cylinderGeometry args={[arrowLen * 0.045, arrowLen * 0.045, arrowLen * 0.85, 16]} />
      </mesh>
      <mesh position={[0, -arrowLen * 0.55, 0]} material={arrowMat}>
        <coneGeometry args={[headSize, headSize * 1.8, 24]} />
      </mesh>
    </group>
  );
}
