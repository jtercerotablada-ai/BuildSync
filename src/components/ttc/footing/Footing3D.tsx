'use client';

import React, { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Grid, GizmoHelper, GizmoViewport, ContactShadows, Environment,
} from '@react-three/drei';
import * as THREE from 'three';
import warehouseHDR from '@pmndrs/assets/hdri/warehouse.exr';
import type { FootingInput, FootingAnalysis } from '@/lib/footing/types';
import { lookupBar } from '@/lib/rc/types';

const MM_TO_M = 0.001;

interface Props {
  input: FootingInput;
  result: FootingAnalysis;
}

export function Footing3D({ input, result }: Props) {
  const [cutaway, setCutaway] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [showColumn, setShowColumn] = useState(true);
  const [showSoil, setShowSoil] = useState(true);
  const [showLoad, setShowLoad] = useState(true);
  void result;

  const g = input.geometry;
  const B = g.B * MM_TO_M;
  const Lx = g.L * MM_TO_M;        // length along Y (renamed to avoid collision with light L)
  const T = g.T * MM_TO_M;
  const cover = g.coverClear * MM_TO_M;

  const camDist = Math.max(B, Lx) * 1.6;

  // Concrete material (warm grey, slight roughness)
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

  // Rebar material (dark steel)
  const rebarMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#7a6450',
      roughness: 0.6,
      metalness: 0.85,
    });
  }, []);

  // Top rebar material (lighter — distinguish from bottom)
  const topRebarMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#5e8aa0',
      roughness: 0.6,
      metalness: 0.85,
    });
  }, []);

  return (
    <div className="rc-3d slab-3d">
      <div className="slab-3d__controls">
        <div className="slab-contour__tabs" style={{ flexWrap: 'wrap' }}>
          <span className="slab-3d__hint" style={{ marginRight: '0.4rem', alignSelf: 'center' }}>VIEW —</span>
          <label className="ab-toggle"><input type="checkbox" checked={cutaway}
            onChange={(e) => setCutaway(e.target.checked)} /> <span>Glass concrete</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showRebar}
            onChange={(e) => setShowRebar(e.target.checked)} /> <span>Rebar (top + bottom)</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showColumn}
            onChange={(e) => setShowColumn(e.target.checked)} /> <span>Column above</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showSoil}
            onChange={(e) => setShowSoil(e.target.checked)} /> <span>Soil overburden</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showLoad}
            onChange={(e) => setShowLoad(e.target.checked)} /> <span>Load arrow</span></label>
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
          <directionalLight position={[B * 4, T * 8, Lx * 4]} intensity={0.7} castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0005} />
          <directionalLight position={[-B * 2, T * 3, -Lx * 2]} intensity={0.25} />

          {/* Footing concrete pad — centered on origin, top at y = 0, bottom at y = -T */}
          <mesh position={[0, -T / 2, 0]} receiveShadow castShadow material={concreteMat}>
            <boxGeometry args={[B, T, Lx]} />
          </mesh>

          {/* Column above */}
          {showColumn && (
            <ColumnAbove input={input} B={B} Lx={Lx} cutaway={cutaway} />
          )}

          {/* Soil overburden if embedded */}
          {showSoil && (g.embedment ?? 0) > 0 && (
            <SoilOverburden input={input} B={B} Lx={Lx} T={T} />
          )}

          {/* Bottom rebar grids */}
          {showRebar && (
            <>
              <BottomRebar
                direction="X"
                input={input}
                B={B} Lx={Lx} T={T} cover={cover}
                mat={rebarMat}
              />
              <BottomRebar
                direction="Y"
                input={input}
                B={B} Lx={Lx} T={T} cover={cover}
                mat={rebarMat}
                yOffset={(lookupBar(input.reinforcement.bottomX.bar)?.db ?? 16) * MM_TO_M}
              />
            </>
          )}

          {/* Top rebar grids if present */}
          {showRebar && input.reinforcement.topX && (
            <>
              <TopRebar
                direction="X"
                input={input}
                B={B} Lx={Lx} cover={cover}
                mat={topRebarMat}
              />
              {input.reinforcement.topY && (
                <TopRebar
                  direction="Y"
                  input={input}
                  B={B} Lx={Lx} cover={cover}
                  mat={topRebarMat}
                  yOffset={(lookupBar(input.reinforcement.topX.bar)?.db ?? 12) * MM_TO_M}
                />
              )}
            </>
          )}

          {/* Pu force arrow (red) entering top of column */}
          {showLoad && showColumn && (
            <LoadArrow input={input} />
          )}

          {/* Floor grid */}
          <Grid args={[B * 6, Lx * 6]}
            cellSize={0.2} cellThickness={0.45} cellColor="#3a3320"
            sectionSize={1.0} sectionThickness={0.9} sectionColor="#5a4f30"
            fadeDistance={Math.max(B, Lx) * 8} fadeStrength={1.4}
            position={[0, -T - 0.005, 0]} infiniteGrid={false} />

          <ContactShadows position={[0, -T - 0.001, 0]}
            opacity={0.55} scale={Math.max(B, Lx) * 2}
            blur={2.4} far={3} resolution={1024} frames={1} smooth />

          <OrbitControls makeDefault enableDamping
            target={[0, -T / 2, 0]}
            maxDistance={Math.max(B, Lx) * 8}
            minDistance={Math.max(B, Lx) * 0.4}
            maxPolarAngle={Math.PI / 2 - 0.02} />
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport axisColors={['#c9a84c', '#5fb674', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>
        </Canvas>
      </div>
      <p className="slab-3d__hint">
        X = footing width B · Y = thickness T (vertical) · Z = footing length L · Drag to rotate · scroll to zoom · concrete becomes glassy when toggled
      </p>
    </div>
  );
}

// ─── Column above the footing ──────────────────────────────────────────────

function ColumnAbove({
  input, B, Lx, cutaway,
}: {
  input: FootingInput; B: number; Lx: number; cutaway: boolean;
}) {
  const g = input.geometry;
  const cx = g.cx * MM_TO_M;
  const cy = g.columnShape === 'circular' ? g.cx * MM_TO_M : (g.cy ?? g.cx) * MM_TO_M;
  const ex = (g.ex ?? 0) * MM_TO_M;
  const ey = (g.ey ?? 0) * MM_TO_M;
  const colHeight = Math.max(B, Lx) * 0.7;        // ~1 floor visual
  void Lx;

  if (g.columnShape === 'circular') {
    const radius = cx / 2;
    return (
      <mesh position={[ex, colHeight / 2, ey]} receiveShadow castShadow>
        <cylinderGeometry args={[radius, radius, colHeight, 32]} />
        <meshStandardMaterial
          color="#a09687" roughness={0.85} metalness={0.0}
          transparent={cutaway} opacity={cutaway ? 0.65 : 1.0}
          depthWrite={!cutaway}
          side={cutaway ? THREE.DoubleSide : THREE.FrontSide}
        />
      </mesh>
    );
  }
  return (
    <mesh position={[ex, colHeight / 2, ey]} receiveShadow castShadow>
      <boxGeometry args={[cx, colHeight, cy]} />
      <meshStandardMaterial
        color="#a09687" roughness={0.85} metalness={0.0}
        transparent={cutaway} opacity={cutaway ? 0.65 : 1.0}
        depthWrite={!cutaway}
        side={cutaway ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}

// ─── Soil overburden ───────────────────────────────────────────────────────

function SoilOverburden({
  input, B, Lx, T,
}: {
  input: FootingInput; B: number; Lx: number; T: number;
}) {
  const embedment_m = (input.geometry.embedment ?? 0) * MM_TO_M;
  if (embedment_m <= 0) return null;
  // Four prisms wrapping the footing top to grade
  const margin = 0.3;       // m beyond footing edges
  const totalSize = Math.max(B, Lx) + 2 * margin;
  // Just show as a translucent shell
  return (
    <group>
      <mesh position={[0, embedment_m / 2, 0]}>
        <boxGeometry args={[totalSize, embedment_m, totalSize]} />
        <meshStandardMaterial
          color="#8a6c4a" roughness={0.95} metalness={0.0}
          transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[B - 0.001, 0.001, Lx - 0.001]} />
        <meshStandardMaterial color="#5a4f30" />
      </mesh>
      {/* Hide for cleanliness — overburden is "inside" the soil shell */}
      <mesh position={[0, -T / 2, 0]} visible={false}>
        <boxGeometry args={[B, T, Lx]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

// ─── Bottom rebar grid ─────────────────────────────────────────────────────

function BottomRebar({
  direction, input, B, Lx, T, cover, mat, yOffset = 0,
}: {
  direction: 'X' | 'Y';
  input: FootingInput; B: number; Lx: number; T: number; cover: number;
  mat: THREE.Material; yOffset?: number;
}) {
  const layer = direction === 'X' ? input.reinforcement.bottomX : input.reinforcement.bottomY;
  const dbBar = (lookupBar(layer.bar)?.db ?? 16) * MM_TO_M;
  const n = layer.count;

  // Y position: at bottom of footing, offset by cover + dbBar/2 + yOffset (for layer stacking)
  const yPos = -T + cover + dbBar / 2 + yOffset;

  if (direction === 'X') {
    // Bars run along X (length = B), distributed across Z (= Lx)
    const innerLen = Lx - 2 * cover;
    const dz = n > 1 ? innerLen / (n - 1) : 0;
    const zStart = -innerLen / 2;
    return (
      <group>
        {Array.from({ length: n }, (_, i) => (
          <mesh key={`bX-${i}`}
                position={[0, yPos, zStart + i * dz]}
                rotation={[0, 0, Math.PI / 2]}
                material={mat} castShadow receiveShadow>
            <cylinderGeometry args={[dbBar / 2, dbBar / 2, B - 2 * cover, 16]} />
          </mesh>
        ))}
      </group>
    );
  }
  // direction === 'Y': bars run along Z (length = Lx), distributed across X
  const innerLen = B - 2 * cover;
  const dx = n > 1 ? innerLen / (n - 1) : 0;
  const xStart = -innerLen / 2;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={`bY-${i}`}
              position={[xStart + i * dx, yPos, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              material={mat} castShadow receiveShadow>
          <cylinderGeometry args={[dbBar / 2, dbBar / 2, Lx - 2 * cover, 16]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Top rebar grid ────────────────────────────────────────────────────────

function TopRebar({
  direction, input, B, Lx, cover, mat, yOffset = 0,
}: {
  direction: 'X' | 'Y';
  input: FootingInput; B: number; Lx: number; cover: number;
  mat: THREE.Material; yOffset?: number;
}) {
  const layer = direction === 'X' ? input.reinforcement.topX : input.reinforcement.topY;
  if (!layer) return null;
  const dbBar = (lookupBar(layer.bar)?.db ?? 12) * MM_TO_M;
  const n = layer.count;

  // Y position: at top of footing, offset DOWN by cover + dbBar/2 + yOffset
  const yPos = 0 - cover - dbBar / 2 - yOffset;

  if (direction === 'X') {
    const innerLen = Lx - 2 * cover;
    const dz = n > 1 ? innerLen / (n - 1) : 0;
    const zStart = -innerLen / 2;
    return (
      <group>
        {Array.from({ length: n }, (_, i) => (
          <mesh key={`tX-${i}`}
                position={[0, yPos, zStart + i * dz]}
                rotation={[0, 0, Math.PI / 2]}
                material={mat} castShadow receiveShadow>
            <cylinderGeometry args={[dbBar / 2, dbBar / 2, B - 2 * cover, 16]} />
          </mesh>
        ))}
      </group>
    );
  }
  const innerLen = B - 2 * cover;
  const dx = n > 1 ? innerLen / (n - 1) : 0;
  const xStart = -innerLen / 2;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={`tY-${i}`}
              position={[xStart + i * dx, yPos, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              material={mat} castShadow receiveShadow>
          <cylinderGeometry args={[dbBar / 2, dbBar / 2, Lx - 2 * cover, 16]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Load arrow (Pu) entering top of column ────────────────────────────────

function LoadArrow({ input }: { input: FootingInput }) {
  const ex = (input.geometry.ex ?? 0) * MM_TO_M;
  const ey = (input.geometry.ey ?? 0) * MM_TO_M;
  const B = input.geometry.B * MM_TO_M;
  const Lx = input.geometry.L * MM_TO_M;
  const colHeight = Math.max(B, Lx) * 0.7;
  const arrowLen = colHeight * 0.4;
  const arrowY = colHeight + arrowLen / 2 + 0.1;
  return (
    <group position={[ex, arrowY, ey]}>
      {/* Shaft */}
      <mesh>
        <cylinderGeometry args={[0.025, 0.025, arrowLen, 16]} />
        <meshStandardMaterial color="#ff6a55" emissive="#ff6a55" emissiveIntensity={0.3} />
      </mesh>
      {/* Cone (downward) */}
      <mesh position={[0, -arrowLen / 2 - 0.06, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.08, 0.15, 16]} />
        <meshStandardMaterial color="#ff6a55" emissive="#ff6a55" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
