'use client';

import React, { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Grid, GizmoHelper, GizmoViewport, ContactShadows, Environment,
} from '@react-three/drei';
import * as THREE from 'three';
import warehouseHDR from '@pmndrs/assets/hdri/warehouse.exr';
import type { MatFoundationInput, MatFoundationAnalysis, MatColumn } from '@/lib/mat-foundation/types';
import { lookupBar } from '@/lib/rc/types';

const MM_TO_M = 0.001;

interface Props {
  input: MatFoundationInput;
  result: MatFoundationAnalysis;
}

/**
 * MatFoundation3D — three-dimensional viewer for a multi-column mat
 * (raft) foundation. Renders the mat slab, all N columns rising, the
 * four rebar mats (top X/Y + bottom X/Y), soil overburden, and load
 * arrows over each column.
 */
export function MatFoundation3D({ input, result }: Props) {
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
  const camDist = Math.max(B, L) * 1.4;

  const concreteMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cdc8bf',
    roughness: 0.92,
    metalness: 0.0,
    transparent: cutaway,
    opacity: cutaway ? 0.32 : 1.0,
    depthWrite: !cutaway,
    side: cutaway ? THREE.DoubleSide : THREE.FrontSide,
  }), [cutaway]);

  const bottomRebarMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#7a6450', roughness: 0.6, metalness: 0.85,
  }), []);
  const topRebarMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#5e8aa0', roughness: 0.6, metalness: 0.85,
  }), []);

  return (
    <div className="rc-3d slab-3d">
      <div className="slab-3d__controls">
        <div className="slab-contour__tabs" style={{ flexWrap: 'wrap' }}>
          <span className="slab-3d__hint" style={{ marginRight: '0.4rem', alignSelf: 'center' }}>VIEW —</span>
          <label className="ab-toggle"><input type="checkbox" checked={cutaway}
            onChange={(e) => setCutaway(e.target.checked)} /> <span>Glass concrete</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showRebar}
            onChange={(e) => setShowRebar(e.target.checked)} /> <span>Rebar (4 mats: top + bottom × 2 dirs)</span></label>
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
          camera={{ position: [camDist, camDist * 0.7, camDist], fov: 38, near: 0.05, far: 400 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#0a0a0a']} />
          <Suspense fallback={null}>
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.55} />
          </Suspense>
          <ambientLight intensity={0.4} />
          <directionalLight position={[B * 4, T * 8, L * 4]} intensity={0.7} castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0005} />
          <directionalLight position={[-B * 2, T * 3, -L * 2]} intensity={0.25} />

          {/* Mat slab — top at y = 0, bottom at y = -T. Centred at origin. */}
          <mesh position={[0, -T / 2, 0]} receiveShadow castShadow material={concreteMat}>
            <boxGeometry args={[B, T, L]} />
          </mesh>

          {showColumns && input.columns.map((col, i) => (
            <ColumnAbove key={i} col={col} B={g.B} L={g.L} cutaway={cutaway} />
          ))}

          {showSoil && (g.embedment ?? 0) > 0 && (
            <SoilOverburden B={B} L={L} embedment={(g.embedment ?? 0) * MM_TO_M} />
          )}

          {showRebar && (
            <>
              <BottomMatX input={input} B={B} L={L} T={T} cover={cover} mat={bottomRebarMat} />
              <BottomMatY input={input} B={B} L={L} T={T} cover={cover} mat={bottomRebarMat}
                yOffset={(lookupBar(input.reinforcement.bottomX.bar)?.db ?? 16) * MM_TO_M} />
              <TopMatX input={input} B={B} L={L} cover={cover} mat={topRebarMat} />
              <TopMatY input={input} B={B} L={L} cover={cover} mat={topRebarMat}
                yOffset={(lookupBar(input.reinforcement.topX.bar)?.db ?? 16) * MM_TO_M} />
            </>
          )}

          {showLoads && showColumns && input.columns.map((col, i) => (
            <LoadArrow key={i} col={col} B={g.B} L={g.L} />
          ))}

          <Grid args={[B * 4, L * 4]}
            cellSize={0.5} cellThickness={0.45} cellColor="#3a3320"
            sectionSize={2.5} sectionThickness={0.9} sectionColor="#5a4f30"
            fadeDistance={Math.max(B, L) * 6} fadeStrength={1.4}
            position={[0, -T - 0.005, 0]} infiniteGrid={false} />

          <ContactShadows position={[0, -T - 0.001, 0]}
            opacity={0.55} scale={Math.max(B, L) * 1.6}
            blur={2.4} far={3} resolution={1024} frames={1} smooth />

          <OrbitControls makeDefault enableDamping
            target={[0, -T / 2, 0]}
            maxDistance={Math.max(B, L) * 6}
            minDistance={Math.max(B, L) * 0.3}
          />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['#c9a84c', '#7fb691', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>
        </Canvas>
      </div>

      <p className="slab-3d__hint" style={{ fontSize: '0.86rem', marginTop: '0.4rem' }}>
        X = mat width B · Y = thickness T (vertical) · Z = mat length L. {input.columns.length} columns rendered;
        {result.punching.filter((p) => !p.ok).length > 0 && (
          <span style={{ color: '#e8836a', fontWeight: 600 }}> {result.punching.filter((p) => !p.ok).length} column(s) failing punching.</span>
        )}
      </p>
    </div>
  );
}

// ─── COLUMN ABOVE ───────────────────────────────────────────────────────────

function ColumnAbove({ col, B, L, cutaway }: { col: MatColumn; B: number; L: number; cutaway: boolean }) {
  // Convert column position from mat-local (origin at lower-left) to centred coords
  const cx_centred = (col.x - B / 2) * MM_TO_M;
  const cz_centred = -(col.y - L / 2) * MM_TO_M;     // SVG-style flip vs Z
  const cl = col.cx * MM_TO_M;
  const ct = (col.shape === 'circular' ? col.cx : (col.cy ?? col.cx)) * MM_TO_M;
  const colHeight = Math.max(cl, ct) * 5;
  const colMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#a8a39a', roughness: 0.85, metalness: 0.05,
    transparent: cutaway, opacity: cutaway ? 0.55 : 1.0,
    side: cutaway ? THREE.DoubleSide : THREE.FrontSide,
  }), [cutaway]);
  return (
    <mesh position={[cx_centred, colHeight / 2, cz_centred]} material={colMat} castShadow>
      {col.shape === 'circular'
        ? <cylinderGeometry args={[cl / 2, cl / 2, colHeight, 32]} />
        : <boxGeometry args={[cl, colHeight, ct]} />}
    </mesh>
  );
}

// ─── SOIL OVERBURDEN ────────────────────────────────────────────────────────

function SoilOverburden({ B, L, embedment }: { B: number; L: number; embedment: number }) {
  const soilMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#6b5240', roughness: 0.95, metalness: 0.0,
    transparent: true, opacity: 0.40,
  }), []);
  return (
    <mesh position={[0, embedment / 2, 0]} material={soilMat}>
      <boxGeometry args={[B * 1.3, embedment, L * 1.3]} />
    </mesh>
  );
}

// ─── REBAR MATS (4 layers: bottom-X, bottom-Y, top-X, top-Y) ────────────────

function BottomMatX({
  input, B, L, T, cover, mat,
}: { input: MatFoundationInput; B: number; L: number; T: number; cover: number; mat: THREE.MeshStandardMaterial }) {
  const layer = input.reinforcement.bottomX;
  const db = (lookupBar(layer.bar)?.db ?? 16) * MM_TO_M;
  const r = db / 2;
  const usable = L - 2 * cover;
  const spacing = layer.spacing * MM_TO_M;
  const n = Math.max(2, Math.floor(usable / spacing) + 1);
  const dz = usable / (n - 1);
  const yPos = -T + cover + r;
  const bars: React.ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const z = -L / 2 + cover + i * dz;
    bars.push(
      <mesh key={`bx-${i}`} position={[0, yPos, z]}
            rotation={[0, 0, Math.PI / 2]} material={mat} castShadow>
        <cylinderGeometry args={[r, r, B - 2 * cover, 12]} />
      </mesh>
    );
  }
  return <>{bars}</>;
}

function BottomMatY({
  input, B, L, T, cover, mat, yOffset,
}: { input: MatFoundationInput; B: number; L: number; T: number; cover: number; mat: THREE.MeshStandardMaterial; yOffset: number }) {
  const layer = input.reinforcement.bottomY;
  const db = (lookupBar(layer.bar)?.db ?? 16) * MM_TO_M;
  const r = db / 2;
  const usable = B - 2 * cover;
  const spacing = layer.spacing * MM_TO_M;
  const n = Math.max(2, Math.floor(usable / spacing) + 1);
  const dx = usable / (n - 1);
  const yPos = -T + cover + yOffset + r;
  const bars: React.ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const x = -B / 2 + cover + i * dx;
    bars.push(
      <mesh key={`by-${i}`} position={[x, yPos, 0]}
            rotation={[Math.PI / 2, 0, 0]} material={mat} castShadow>
        <cylinderGeometry args={[r, r, L - 2 * cover, 12]} />
      </mesh>
    );
  }
  return <>{bars}</>;
}

function TopMatX({
  input, B, L, cover, mat,
}: { input: MatFoundationInput; B: number; L: number; cover: number; mat: THREE.MeshStandardMaterial }) {
  const layer = input.reinforcement.topX;
  const db = (lookupBar(layer.bar)?.db ?? 16) * MM_TO_M;
  const r = db / 2;
  const usable = L - 2 * cover;
  const spacing = layer.spacing * MM_TO_M;
  const n = Math.max(2, Math.floor(usable / spacing) + 1);
  const dz = usable / (n - 1);
  const yPos = -cover - r;
  const bars: React.ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const z = -L / 2 + cover + i * dz;
    bars.push(
      <mesh key={`tx-${i}`} position={[0, yPos, z]}
            rotation={[0, 0, Math.PI / 2]} material={mat} castShadow>
        <cylinderGeometry args={[r, r, B - 2 * cover, 12]} />
      </mesh>
    );
  }
  return <>{bars}</>;
}

function TopMatY({
  input, B, L, cover, mat, yOffset,
}: { input: MatFoundationInput; B: number; L: number; cover: number; mat: THREE.MeshStandardMaterial; yOffset: number }) {
  const layer = input.reinforcement.topY;
  const db = (lookupBar(layer.bar)?.db ?? 16) * MM_TO_M;
  const r = db / 2;
  const usable = B - 2 * cover;
  const spacing = layer.spacing * MM_TO_M;
  const n = Math.max(2, Math.floor(usable / spacing) + 1);
  const dx = usable / (n - 1);
  const yPos = -cover - yOffset - r;
  const bars: React.ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const x = -B / 2 + cover + i * dx;
    bars.push(
      <mesh key={`ty-${i}`} position={[x, yPos, 0]}
            rotation={[Math.PI / 2, 0, 0]} material={mat} castShadow>
        <cylinderGeometry args={[r, r, L - 2 * cover, 12]} />
      </mesh>
    );
  }
  return <>{bars}</>;
}

// ─── LOAD ARROWS ────────────────────────────────────────────────────────────

function LoadArrow({ col, B, L }: { col: MatColumn; B: number; L: number }) {
  const cx_centred = (col.x - B / 2) * MM_TO_M;
  const cz_centred = -(col.y - L / 2) * MM_TO_M;
  const cl = col.cx * MM_TO_M;
  const ct = (col.shape === 'circular' ? col.cx : (col.cy ?? col.cx)) * MM_TO_M;
  const colHeight = Math.max(cl, ct) * 5;
  const arrowLen = Math.max(cl, 0.5) * 2.5;
  const arrowY = colHeight + arrowLen;
  const arrowMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff6a55', emissive: '#ff6a55', emissiveIntensity: 0.5,
    roughness: 0.4, metalness: 0.3,
  }), []);
  const headSize = arrowLen * 0.18;
  return (
    <group position={[cx_centred, arrowY, cz_centred]}>
      <mesh material={arrowMat}>
        <cylinderGeometry args={[arrowLen * 0.045, arrowLen * 0.045, arrowLen * 0.85, 16]} />
      </mesh>
      <mesh position={[0, -arrowLen * 0.55, 0]} material={arrowMat}>
        <coneGeometry args={[headSize, headSize * 1.8, 24]} />
      </mesh>
    </group>
  );
}
