'use client';

import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  ContactShadows,
  Environment,
  Text,
} from '@react-three/drei';
import * as THREE from 'three';
import warehouseHDR from '@pmndrs/assets/hdri/warehouse.exr';
import type { BasePlateInput, BasePlateAnalysis } from '@/lib/baseplate/types';

// ============================================================================
// MODULE-LEVEL: thread normal map for anchor rod shafts (created once)
// Tiled vertically along the rod, gives the visual impression of UNC threads.
// ============================================================================
let _threadNormalMap: THREE.Texture | null = null;
function getThreadNormalMap(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (_threadNormalMap) return _threadNormalMap;
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const g = c.getContext('2d')!;
  // Flat blue (no normal change)
  g.fillStyle = '#8080ff';
  g.fillRect(0, 0, c.width, c.height);
  // Alternating bright/dark stripes = thread peak / valley
  for (let y = 0; y < c.height; y += 4) {
    g.fillStyle = '#a8a8ff';        // peak (slight +Z)
    g.fillRect(0, y, c.width, 1);
    g.fillStyle = '#5858ff';        // valley (slight -Z)
    g.fillRect(0, y + 2, c.width, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  _threadNormalMap = t;
  return t;
}

// ============================================================================
// MODULE-LEVEL: galvanized-steel base color map (subtle dappling)
// ============================================================================
let _galvMap: THREE.Texture | null = null;
function getGalvMap(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (_galvMap) return _galvMap;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9b9da0';
  g.fillRect(0, 0, c.width, c.height);
  // Random dappled spangles
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r = Math.random() * 2 + 0.5;
    const shade = 140 + Math.random() * 80;
    g.fillStyle = `rgb(${shade},${shade + 4},${shade + 8})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  _galvMap = t;
  return t;
}

interface Props {
  input: BasePlateInput;
  result: BasePlateAnalysis;
}

// All scene units in METRES (THREE convention). The model uses inches internally;
// we convert here for visual rendering only.
const IN_TO_M = 0.0254;

export function BasePlate3D({ input, result }: Props) {
  const B = input.plate.B * IN_TO_M;
  const N = input.plate.N * IN_TO_M;
  const tp = input.plate.tp * IN_TO_M;
  const colD = input.column.d * IN_TO_M;
  const colBf = input.column.bf * IN_TO_M;
  const colTf = input.column.tf * IN_TO_M;
  const colTw = input.column.tw * IN_TO_M;
  const colHeight = Math.max(B, N) * 1.6;       // visual column stub height

  const pedB = input.concrete.B2 * IN_TO_M;
  const pedN = input.concrete.N2 * IN_TO_M;
  const pedH = Math.max(0.4, input.anchors.hef * IN_TO_M * 1.4);

  const da = input.anchors.da * IN_TO_M;
  const hef = input.anchors.hef * IN_TO_M;
  const sx = input.anchors.sx * IN_TO_M;
  const sy = input.anchors.sy * IN_TO_M;
  const edge = input.anchors.edgeDist * IN_TO_M;
  void edge;

  // Anchor positions (4-rod rectangular pattern centred under plate)
  const anchorPositions = useMemo<[number, number][]>(() => {
    const N_anchors = input.anchors.N;
    if (N_anchors === 4) {
      return [
        [-sx / 2, -sy / 2],
        [+sx / 2, -sy / 2],
        [-sx / 2, +sy / 2],
        [+sx / 2, +sy / 2],
      ];
    }
    // Fallback: distribute around perimeter
    const positions: [number, number][] = [];
    const nx = Math.ceil(Math.sqrt(N_anchors));
    const ny = Math.ceil(N_anchors / nx);
    const dx = N_anchors > 1 ? sx / Math.max(nx - 1, 1) : 0;
    const dy = N_anchors > 1 ? sy / Math.max(ny - 1, 1) : 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        if (positions.length < N_anchors) {
          positions.push([(i - (nx - 1) / 2) * dx, (j - (ny - 1) / 2) * dy]);
        }
      }
    }
    return positions;
  }, [input.anchors.N, sx, sy]);

  const overallOk = result.ok;

  const camDist = Math.max(B, N, pedB, pedN) * 3.5;

  return (
    <div className="bp-3d slab-3d">
      <div className="bp-3d__canvas slab-3d__canvas">
        <Canvas
          shadows
          camera={{ position: [camDist, camDist * 0.85, camDist], fov: 38, near: 0.05, far: 200 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#0a0a0a']} />

          <Suspense fallback={null}>
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.18} />
          </Suspense>

          {/* Lighting */}
          <ambientLight intensity={0.55} />
          <directionalLight position={[B * 4, B * 6, B * 4]} intensity={0.6} castShadow
            shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0005} />
          <directionalLight position={[-B * 2, B * 3, -B * 2]} intensity={0.18} />

          {/* Concrete pedestal */}
          <Pedestal w={pedB} d={pedN} h={pedH} />

          {/* Base plate (above pedestal top) */}
          <BasePlateMesh B={B} N={N} t={tp} y={pedH / 2 + tp / 2} ok={overallOk} />

          {/* Column stub (above plate) */}
          <ColumnW d={colD} bf={colBf} tf={colTf} tw={colTw}
            yBase={pedH / 2 + tp} height={colHeight} />

          {/* Anchor rods (embedded into pedestal, sticking up through plate) */}
          {anchorPositions.map((p, i) => (
            <AnchorRod key={i}
              x={p[0]} z={p[1]}
              da={da}
              embedment={hef}
              plateTopY={pedH / 2 + tp}
              pedestalTopY={pedH / 2}
            />
          ))}

          {/* Force arrow (axial load on top of column) */}
          {input.loads.Pu !== 0 && (
            <ForceArrow yTop={pedH / 2 + tp + colHeight + 0.2}
              magnitude={input.loads.Pu}
              labelText={`Pu = ${input.loads.Pu.toFixed(0)} k`} />
          )}

          {/* Moment arrow */}
          {Math.abs(input.loads.Mu) > 1e-6 && (
            <Text position={[0, pedH / 2 + tp + colHeight + 0.55, 0]}
              fontSize={0.06} color="#c9a84c" anchorX="center" anchorY="middle">
              {`Mu = ${input.loads.Mu.toFixed(0)} k·in`}
            </Text>
          )}

          {/* Floor grid */}
          <Grid args={[pedB * 6, pedN * 6]}
            cellSize={0.1} cellThickness={0.45} cellColor="#3a3320"
            sectionSize={0.5} sectionThickness={0.9} sectionColor="#5a4f30"
            fadeDistance={Math.max(pedB, pedN) * 8} fadeStrength={1.4}
            position={[0, -pedH / 2 - 0.005, 0]} infiniteGrid={false} />

          {/* Soft contact shadow */}
          <ContactShadows
            position={[0, -pedH / 2 - 0.001, 0]}
            opacity={0.55} scale={Math.max(pedB, pedN) * 2.5}
            blur={2.4} far={3} resolution={1024} frames={1} smooth />

          <OrbitControls makeDefault enableDamping
            target={[0, 0, 0]}
            maxDistance={Math.max(B, N) * 12}
            minDistance={Math.max(B, N) * 0.6}
            maxPolarAngle={Math.PI / 2 - 0.02} />
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport axisColors={['#c9a84c', '#5fb674', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>
        </Canvas>
      </div>
      <p className="slab-3d__hint">
        Drag to rotate · scroll to zoom · right-click drag to pan · column +
        plate + anchors shown in true scale (1 in = 25.4 mm)
      </p>
    </div>
  );
}

// ============================================================================
// Pedestal (concrete)
// ============================================================================
function Pedestal({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <mesh position={[0, 0, 0]} receiveShadow castShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color="#cdc8bf" roughness={0.92} metalness={0.0} />
    </mesh>
  );
}

// ============================================================================
// Base plate
// ============================================================================
function BasePlateMesh({ B, N, t, y, ok }: { B: number; N: number; t: number; y: number; ok: boolean }) {
  return (
    <mesh position={[0, y, 0]} receiveShadow castShadow>
      <boxGeometry args={[B, t, N]} />
      <meshStandardMaterial
        color={ok ? '#7a7a7a' : '#9a4040'}
        roughness={0.55} metalness={0.85} envMapIntensity={0.4} />
    </mesh>
  );
}

// ============================================================================
// W-shape column — box approximation made of 3 boxes (2 flanges + web)
// ============================================================================
function ColumnW({ d, bf, tf, tw, yBase, height }: {
  d: number; bf: number; tf: number; tw: number; yBase: number; height: number;
}) {
  const yMid = yBase + height / 2;
  const webD = d - 2 * tf;
  return (
    <group>
      {/* Top flange */}
      <mesh position={[0, yBase + height - tf / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[bf, tf, d]} />
        <meshStandardMaterial color="#6a6a6a" roughness={0.5} metalness={0.85} envMapIntensity={0.4} />
      </mesh>
      {/* Bottom flange (the one welded to the base plate) */}
      <mesh position={[0, yBase + tf / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[bf, tf, d]} />
        <meshStandardMaterial color="#6a6a6a" roughness={0.5} metalness={0.85} envMapIntensity={0.4} />
      </mesh>
      {/* Web */}
      <mesh position={[0, yMid, 0]} castShadow receiveShadow>
        <boxGeometry args={[tw, height - 2 * tf, webD]} />
        <meshStandardMaterial color="#6a6a6a" roughness={0.5} metalness={0.85} envMapIntensity={0.4} />
      </mesh>
    </group>
  );
}

// ============================================================================
// MEGA-PRO Anchor rod assembly — true engineering detail
// ============================================================================
//
// Top of plate (going UP from plate top surface):
//   1) Round washer (SAE flat washer) just on top of plate
//   2) Square plate washer above round washer
//   3) Heavy hex nut threaded on
//   4) Rod thread projection above nut
//
// Bottom (embedded in concrete):
//   1) Heavy hex nut at the very tip (anchor head)
//
// Shaft visualization:
//   • Smooth shaft on the embedded portion + middle (for grout adhesion)
//   • Threaded portion on the top ~3" with thread normal map
//
// Real engineering proportions per ASME B18.2.2 Heavy Hex:
//   Nut across-flats  F ≈ 1.625·da
//   Nut height        H ≈ da
//   Plate washer side ≈ 3·da (or ≥ 3" min)
//   Plate washer thk  ≈ da/2 (or ≥ 1/4")
//   Round washer OD   ≈ 2.25·da
//   Round washer thk  ≈ da/8
// ============================================================================

// Hex-nut geometry helper — flat-side facing X axis
const HEX_R_FROM_F = 1 / Math.sqrt(3);     // r (vertex distance) = F·(1/√3) for flat-side hex
function makeHexShape(acrossFlats: number): THREE.Shape {
  const r = acrossFlats * HEX_R_FROM_F;
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    // Vertices at 30°, 90°, 150°, ... (flats parallel to axes)
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function HeavyHexNut({ da, y }: { da: number; y: number }) {
  // ASME B18.2.2 heavy hex nut proportions
  const F = 1.625 * da;       // across flats
  const H = da;               // nut height (heavy hex ≈ da)
  const shape = useMemo(() => makeHexShape(F), [F]);

  const extrudeSettings = useMemo(() => ({
    depth: H,
    bevelEnabled: true,
    bevelThickness: H * 0.10,
    bevelSize: F * 0.025,
    bevelOffset: 0,
    bevelSegments: 2,
    curveSegments: 1,
  }), [F, H]);

  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color="#6a6a6a" roughness={0.42} metalness={0.95}
        envMapIntensity={0.6}
      />
    </mesh>
  );
}

function PlateWasher({ da, y }: { da: number; y: number }) {
  // Square plate washer with central hole 1/8" oversize for the rod
  const side = Math.max(0.0762, 3 * da);    // ≥ 3" or 3·da, in metres if da is metres
  const thk = Math.max(0.00635, da / 2);    // ≥ 1/4"
  const hole = da * 1.125;                  // 1/8" oversize

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const half = side / 2;
    s.moveTo(-half, -half);
    s.lineTo(+half, -half);
    s.lineTo(+half, +half);
    s.lineTo(-half, +half);
    s.closePath();
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, hole / 2, 0, Math.PI * 2, false);
    s.holes.push(holePath);
    return s;
  }, [side, hole]);

  const extrudeSettings = useMemo(() => ({
    depth: thk,
    bevelEnabled: true,
    bevelThickness: thk * 0.15,
    bevelSize: thk * 0.15,
    bevelOffset: 0,
    bevelSegments: 1,
    curveSegments: 16,
  }), [thk]);

  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color="#7a7a7a" roughness={0.55} metalness={0.92}
        envMapIntensity={0.5}
      />
    </mesh>
  );
}

function RoundWasher({ da, y }: { da: number; y: number }) {
  // SAE flat washer
  const od = 2.25 * da;
  const id = da * 1.0625;     // 1/16" oversize
  const thk = Math.max(0.00318, da / 8);  // ≥ 1/8"

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, od / 2, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, id / 2, 0, Math.PI * 2, false);
    s.holes.push(holePath);
    return s;
  }, [od, id]);

  const extrudeSettings = useMemo(() => ({
    depth: thk,
    bevelEnabled: false,
    curveSegments: 32,
  }), [thk]);

  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color="#8a8a8a" roughness={0.50} metalness={0.95}
        envMapIntensity={0.5}
      />
    </mesh>
  );
}

function ThreadedShaft({
  da, yBottom, yTop, threadStartY, threadEndY,
}: {
  da: number; yBottom: number; yTop: number; threadStartY: number; threadEndY: number;
}) {
  const totalLen = yTop - yBottom;
  const threadLen = Math.max(0, threadEndY - threadStartY);
  const smoothLen = totalLen - threadLen;
  const r = da / 2;
  const galv = useMemo(() => getGalvMap(), []);
  const threadMap = useMemo(() => getThreadNormalMap(), []);
  // Repeat thread texture vertically based on length so threads are visible
  const threadMapClone = useMemo(() => {
    if (!threadMap) return null;
    const t = threadMap.clone();
    t.repeat.set(2, threadLen / (da * 0.4));   // ~2.5 visible threads per da
    t.needsUpdate = true;
    return t;
  }, [threadMap, threadLen, da]);

  return (
    <group>
      {/* SMOOTH portion (embedded + middle, below the threaded top) */}
      {smoothLen > 0 && (
        <mesh position={[0, yBottom + smoothLen / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, smoothLen, 24]} />
          <meshStandardMaterial
            color="#909090"
            roughness={0.45} metalness={0.92}
            envMapIntensity={0.6}
            map={galv ?? undefined}
          />
        </mesh>
      )}
      {/* THREADED portion (top, where the nut engages) */}
      {threadLen > 0 && (
        <mesh position={[0, threadStartY + threadLen / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, threadLen, 24]} />
          <meshStandardMaterial
            color="#888"
            roughness={0.55} metalness={0.92}
            envMapIntensity={0.55}
            normalMap={threadMapClone ?? undefined}
            normalScale={threadMapClone ? new THREE.Vector2(1.4, 1.4) : undefined}
          />
        </mesh>
      )}
      {/* Slight chamfer at top of rod */}
      <mesh position={[0, yTop, 0]} castShadow>
        <coneGeometry args={[r * 0.96, r * 0.25, 24, 1, true]} />
        <meshStandardMaterial color="#888" roughness={0.55} metalness={0.92} />
      </mesh>
    </group>
  );
}

function AnchorRod({ x, z, da, embedment, plateTopY, pedestalTopY }: {
  x: number; z: number; da: number; embedment: number;
  plateTopY: number; pedestalTopY: number;
}) {
  // VERTICAL ASSEMBLY (in metres):
  //   yBottom              = pedestal top - embedment        (anchor head plane)
  //   yPedestalTop         = pedestal top
  //   yPlateBottom         = pedestal top  (no grout in viz)
  //   yPlateTop            = plate top surface
  //   yRoundWasherTop      = plate top + roundWasherThk
  //   yPlateWasherTop      = ... + plateWasherThk
  //   yNutTop              = ... + nutHeight
  //   yRodTop              = nutTop + thread projection (~1/4" beyond nut)
  // The threaded portion of the rod covers the topmost ~4·da above the plate.

  const yBottom = pedestalTopY - embedment;
  const roundWasherThk = Math.max(0.00318, da / 8);
  const plateWasherThk = Math.max(0.00635, da / 2);
  const nutH = da;
  const projection = 0.25 * 0.0254;        // 1/4" thread projection above nut

  const yRoundWasherBase = plateTopY;
  const yPlateWasherBase = yRoundWasherBase + roundWasherThk;
  const yNutBase = yPlateWasherBase + plateWasherThk;
  const yRodTop = yNutBase + nutH + projection;

  // Threaded portion: from just below the round washer through the rod tip,
  // so the threads engage the nut visibly. Use ~4·da above the plate.
  const threadEndY = yRodTop;
  const threadStartY = Math.max(yBottom, plateTopY - 0.5 * da);

  return (
    <group position={[x, 0, z]}>
      {/* Shaft (smooth bottom + middle, threaded top) */}
      <ThreadedShaft
        da={da}
        yBottom={yBottom}
        yTop={yRodTop}
        threadStartY={threadStartY}
        threadEndY={threadEndY}
      />

      {/* TOP assembly: round washer, plate washer, heavy hex nut */}
      <RoundWasher da={da} y={yRoundWasherBase} />
      <PlateWasher da={da} y={yPlateWasherBase} />
      <HeavyHexNut  da={da} y={yNutBase} />

      {/* BOTTOM (embedded): heavy hex nut as anchor head */}
      <HeavyHexNut da={da} y={yBottom} />
    </group>
  );
}

// ============================================================================
// Force arrow on top of column
// ============================================================================
function ForceArrow({ yTop, magnitude, labelText }: { yTop: number; magnitude: number; labelText: string }) {
  // Compression: arrow pointing DOWN from above. Tension: arrow pointing UP.
  const isComp = magnitude > 0;
  const length = 0.5;
  return (
    <group position={[0, yTop, 0]}>
      <mesh position={[0, isComp ? length / 2 : length / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, length, 12]} />
        <meshStandardMaterial color={isComp ? '#c94c4c' : '#4ca0c9'} emissive={isComp ? '#c94c4c' : '#4ca0c9'} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, isComp ? 0 : length, 0]} rotation={[0, 0, isComp ? Math.PI : 0]}>
        <coneGeometry args={[0.04, 0.08, 12]} />
        <meshStandardMaterial color={isComp ? '#c94c4c' : '#4ca0c9'} emissive={isComp ? '#c94c4c' : '#4ca0c9'} emissiveIntensity={0.4} />
      </mesh>
      <Text position={[0, length + 0.12, 0]} fontSize={0.07} color="#fff" anchorX="center" anchorY="middle">
        {labelText}
      </Text>
    </group>
  );
}
