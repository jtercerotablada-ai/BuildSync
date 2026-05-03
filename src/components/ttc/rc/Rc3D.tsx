'use client';

import React, { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Grid, GizmoHelper, GizmoViewport, ContactShadows, Environment,
} from '@react-three/drei';
import * as THREE from 'three';
import warehouseHDR from '@pmndrs/assets/hdri/warehouse.exr';
import type { BeamInput, BeamAnalysis } from '@/lib/rc/types';
import { lookupBar } from '@/lib/rc/types';

const MM_TO_M = 0.001;

interface Props {
  input: BeamInput;
  result: BeamAnalysis;
}

export function Rc3D({ input, result }: Props) {
  const [cutaway, setCutaway] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [showStirrups, setShowStirrups] = useState(true);
  const [showLoad, setShowLoad] = useState(true);
  void result;

  const g = input.geometry;
  const bw = g.bw * MM_TO_M;
  const h = g.h * MM_TO_M;
  const L = g.L * MM_TO_M;
  const cover = g.coverClear * MM_TO_M;
  const bf = (g.bf ?? g.bw) * MM_TO_M;
  const hf = (g.hf ?? 0) * MM_TO_M;

  const camDist = Math.max(L, bw * 4) * 1.5;

  return (
    <div className="rc-3d slab-3d">
      <div className="slab-3d__controls">
        <div className="slab-contour__tabs" style={{ flexWrap: 'wrap' }}>
          <span className="slab-3d__hint" style={{ marginRight: '0.4rem', alignSelf: 'center' }}>VIEW —</span>
          <label className="ab-toggle"><input type="checkbox" checked={cutaway}
            onChange={(e) => setCutaway(e.target.checked)} /> <span>Glass concrete</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showRebar}
            onChange={(e) => setShowRebar(e.target.checked)} /> <span>Tension/comp rebar</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showStirrups}
            onChange={(e) => setShowStirrups(e.target.checked)} /> <span>Stirrups</span></label>
          <label className="ab-toggle"><input type="checkbox" checked={showLoad}
            onChange={(e) => setShowLoad(e.target.checked)} /> <span>Loads (Mu/Vu)</span></label>
        </div>
      </div>
      <div className="rc-3d__canvas slab-3d__canvas">
        <Canvas
          shadows
          camera={{ position: [camDist, camDist * 0.6, camDist], fov: 38, near: 0.05, far: 200 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#0a0a0a']} />
          <Suspense fallback={null}>
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.18} />
          </Suspense>
          <ambientLight intensity={0.55} />
          <directionalLight position={[L, h * 4, bw * 4]} intensity={0.55} castShadow
            shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0005} />
          <directionalLight position={[-L / 2, h * 3, -bw * 2]} intensity={0.18} />

          {/* Beam concrete (centered on Y=0 axis, length along X) */}
          <BeamConcrete bw={bw} h={h} L={L} bf={bf} hf={hf}
                        shape={g.shape} cutaway={cutaway} />

          {/* Tension rebar */}
          {showRebar && <TensionRebar input={input} bw={bw} h={h} L={L} cover={cover} />}

          {/* Compression rebar */}
          {showRebar && (input.reinforcement.compression?.length ?? 0) > 0 && (
            <CompressionRebar input={input} bw={bw} L={L} cover={cover} />
          )}

          {/* Stirrups */}
          {showStirrups && <Stirrups input={input} bw={bw} h={h} L={L} cover={cover} />}

          {/* Load arrow (UDL representation) */}
          {showLoad && input.loads.Mu > 0 && (
            <LoadArrows L={L} h={h} />
          )}

          {/* Floor grid */}
          <Grid args={[L * 4, bw * 8]}
            cellSize={0.1} cellThickness={0.45} cellColor="#3a3320"
            sectionSize={0.5} sectionThickness={0.9} sectionColor="#5a4f30"
            fadeDistance={L * 6} fadeStrength={1.4}
            position={[0, -h / 2 - 0.005, 0]} infiniteGrid={false} />

          <ContactShadows position={[0, -h / 2 - 0.001, 0]}
            opacity={0.55} scale={Math.max(L, bw * 4) * 1.5}
            blur={2.4} far={3} resolution={1024} frames={1} smooth />

          <OrbitControls makeDefault enableDamping
            target={[0, 0, 0]}
            maxDistance={Math.max(L, bw) * 8}
            minDistance={Math.max(L, bw) * 0.4}
            maxPolarAngle={Math.PI / 2 - 0.02} />
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport axisColors={['#c9a84c', '#5fb674', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>
        </Canvas>
      </div>
      <p className="slab-3d__hint">
        Drag to rotate · scroll to zoom · concrete becomes glassy when toggled · X = beam length, Y = height, Z = width
      </p>
    </div>
  );
}

// ============================================================================
// Beam concrete (rectangular or T-shape)
// ============================================================================
function BeamConcrete({ bw, h, L, bf, hf, shape, cutaway }: {
  bw: number; h: number; L: number; bf: number; hf: number;
  shape: BeamInput['geometry']['shape']; cutaway: boolean;
}) {
  const opacity = cutaway ? 0.28 : 1.0;
  if (shape === 'rectangular') {
    return (
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <boxGeometry args={[L, h, bw]} />
        <meshStandardMaterial
          color="#cdc8bf" roughness={0.92} metalness={0.0}
          transparent={cutaway} opacity={opacity}
          depthWrite={!cutaway} side={cutaway ? THREE.DoubleSide : THREE.FrontSide} />
      </mesh>
    );
  }
  // T-beam: flange on top + web below
  return (
    <group>
      <mesh position={[0, h / 2 - hf / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[L, hf, bf]} />
        <meshStandardMaterial color="#cdc8bf" roughness={0.92} metalness={0.0}
          transparent={cutaway} opacity={opacity}
          depthWrite={!cutaway} side={cutaway ? THREE.DoubleSide : THREE.FrontSide} />
      </mesh>
      <mesh position={[0, -hf / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[L, h - hf, bw]} />
        <meshStandardMaterial color="#cdc8bf" roughness={0.92} metalness={0.0}
          transparent={cutaway} opacity={opacity}
          depthWrite={!cutaway} side={cutaway ? THREE.DoubleSide : THREE.FrontSide} />
      </mesh>
    </group>
  );
}

// ============================================================================
// Tension rebar (along the bottom)
// ============================================================================
function TensionRebar({ input, bw, h, L, cover }: {
  input: BeamInput; bw: number; h: number; L: number; cover: number;
}) {
  const total = input.reinforcement.tension.reduce((s, b) => s + b.count, 0);
  const dbT = (input.reinforcement.tension[0]?.bar
    ? lookupBar(input.reinforcement.tension[0].bar)?.db ?? 25 : 25) * MM_TO_M;
  const stirrupDb = (input.reinforcement.stirrup.bar
    ? lookupBar(input.reinforcement.stirrup.bar)?.db ?? 10 : 10) * MM_TO_M;

  // y position: bottom side, at d_t = h - cover - stirrup - db/2
  const y = -h / 2 + cover + stirrupDb + dbT / 2;
  const usableW = bw - 2 * (cover + stirrupDb);
  const sBars = total > 1 ? usableW / (total - 1) : 0;
  const startZ = -usableW / 2;

  return (
    <group>
      {Array.from({ length: total }, (_, i) => (
        // Rotate cylinder to lie along the X axis (beam length)
        <mesh key={i} position={[0, y, startZ + i * sBars]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[dbT / 2, dbT / 2, L * 0.96, 12]} />
          <meshStandardMaterial color="#c94c4c" roughness={0.55} metalness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// Compression rebar (along the top, doubly reinforced)
// ============================================================================
function CompressionRebar({ input, bw, L, cover }: {
  input: BeamInput; bw: number; L: number; cover: number;
}) {
  const totalC = (input.reinforcement.compression ?? []).reduce((s, b) => s + b.count, 0);
  const dbC = (input.reinforcement.compression?.[0]?.bar
    ? lookupBar(input.reinforcement.compression[0].bar)?.db ?? 20 : 20) * MM_TO_M;
  const stirrupDb = (input.reinforcement.stirrup.bar
    ? lookupBar(input.reinforcement.stirrup.bar)?.db ?? 10 : 10) * MM_TO_M;

  const y = input.geometry.h * MM_TO_M / 2 - cover - stirrupDb - dbC / 2;
  const usableW = bw - 2 * (cover + stirrupDb);
  const sBars = totalC > 1 ? usableW / (totalC - 1) : 0;
  const startZ = -usableW / 2;

  return (
    <group>
      {Array.from({ length: totalC }, (_, i) => (
        <mesh key={i} position={[0, y, startZ + i * sBars]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[dbC / 2, dbC / 2, L * 0.96, 12]} />
          <meshStandardMaterial color="#e0c060" roughness={0.55} metalness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// Stirrups (closed rectangular hoops at intervals)
// ============================================================================
function Stirrups({ input, bw, h, L, cover }: {
  input: BeamInput; bw: number; h: number; L: number; cover: number;
}) {
  const stirrupDb = (lookupBar(input.reinforcement.stirrup.bar)?.db ?? 10) * MM_TO_M;
  const sSpacing = input.reinforcement.stirrup.spacing * MM_TO_M;
  const innerW = bw - 2 * cover;
  const innerH = h - 2 * cover;

  // Number of stirrups along the beam
  const nStirrups = Math.max(2, Math.floor(L / sSpacing) + 1);
  const stirrups = useMemo(() => {
    const items: React.ReactElement[] = [];
    const startX = -L / 2 + cover;
    for (let i = 0; i < nStirrups; i++) {
      const xPos = startX + i * sSpacing;
      if (xPos > L / 2 - cover) break;
      // Render stirrup as 4 thin rods forming a rectangle
      // Top
      items.push(
        <mesh key={`top-${i}`} position={[xPos, h / 2 - cover - stirrupDb / 2, 0]} castShadow>
          <boxGeometry args={[stirrupDb, stirrupDb, innerW]} />
          <meshStandardMaterial color="#5fb674" roughness={0.55} metalness={0.85} />
        </mesh>
      );
      // Bottom
      items.push(
        <mesh key={`bot-${i}`} position={[xPos, -h / 2 + cover + stirrupDb / 2, 0]} castShadow>
          <boxGeometry args={[stirrupDb, stirrupDb, innerW]} />
          <meshStandardMaterial color="#5fb674" roughness={0.55} metalness={0.85} />
        </mesh>
      );
      // Left side
      items.push(
        <mesh key={`L-${i}`} position={[xPos, 0, -innerW / 2 + stirrupDb / 2]} castShadow>
          <boxGeometry args={[stirrupDb, innerH, stirrupDb]} />
          <meshStandardMaterial color="#5fb674" roughness={0.55} metalness={0.85} />
        </mesh>
      );
      // Right side
      items.push(
        <mesh key={`R-${i}`} position={[xPos, 0, innerW / 2 - stirrupDb / 2]} castShadow>
          <boxGeometry args={[stirrupDb, innerH, stirrupDb]} />
          <meshStandardMaterial color="#5fb674" roughness={0.55} metalness={0.85} />
        </mesh>
      );
    }
    return items;
  }, [bw, h, L, cover, sSpacing, stirrupDb, nStirrups, innerW, innerH]);

  return <group>{stirrups}</group>;
}

// ============================================================================
// Load arrows (UDL representation)
// ============================================================================
function LoadArrows({ L, h }: { L: number; h: number }) {
  const arrows = useMemo(() => {
    const items: React.ReactElement[] = [];
    const n = 9;
    const startX = -L / 2 + L * 0.1;
    const span = L * 0.8;
    for (let i = 0; i <= n; i++) {
      const x = startX + (i / n) * span;
      items.push(
        <group key={i} position={[x, h / 2 + 0.3, 0]}>
          {/* Arrow stem */}
          <mesh position={[0, -0.2, 0]} castShadow>
            <cylinderGeometry args={[0.005, 0.005, 0.4, 8]} />
            <meshStandardMaterial color="#c94c4c" emissive="#c94c4c" emissiveIntensity={0.4} />
          </mesh>
          {/* Arrowhead */}
          <mesh position={[0, -0.4, 0]} rotation={[Math.PI, 0, 0]} castShadow>
            <coneGeometry args={[0.02, 0.08, 12]} />
            <meshStandardMaterial color="#c94c4c" emissive="#c94c4c" emissiveIntensity={0.4} />
          </mesh>
        </group>
      );
    }
    return items;
  }, [L, h]);
  return <group>{arrows}</group>;
}
