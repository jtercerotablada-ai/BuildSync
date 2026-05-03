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
  Instances,
  Instance,
} from '@react-three/drei';
import * as THREE from 'three';
import warehouseHDR from '@pmndrs/assets/hdri/warehouse.exr';
import type { BasePlateInput, BasePlateAnalysis } from '@/lib/baseplate/types';

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
// Anchor rod — a vertical cylinder embedded in the pedestal, sticking up
// through the base plate with a hex nut on top.
// ============================================================================
function AnchorRod({ x, z, da, embedment, plateTopY, pedestalTopY }: {
  x: number; z: number; da: number; embedment: number;
  plateTopY: number; pedestalTopY: number;
}) {
  // Total rod length = embedment (in pedestal) + plate clearance + projection above
  const projection = 0.05;     // 50 mm above plate for nut + washer
  const totalLen = embedment + (plateTopY - pedestalTopY) + projection;
  const yMid = pedestalTopY - embedment / 2 + (totalLen / 2) - (plateTopY - pedestalTopY) / 2 + projection / 2;
  // Simplification: render the rod centered between embedded base and top
  const yBottom = pedestalTopY - embedment;
  const yTop = plateTopY + projection;
  const yCenter = (yBottom + yTop) / 2;
  const len = yTop - yBottom;
  void yMid;

  return (
    <group position={[x, 0, z]}>
      {/* Shaft */}
      <mesh position={[0, yCenter, 0]} castShadow>
        <cylinderGeometry args={[da / 2, da / 2, len, 16]} />
        <meshStandardMaterial color="#888" roughness={0.45} metalness={0.9} />
      </mesh>
      {/* Hex nut on top */}
      <mesh position={[0, plateTopY + 0.015, 0]} castShadow>
        <cylinderGeometry args={[da * 0.8, da * 0.8, 0.025, 6]} />
        <meshStandardMaterial color="#5a5a5a" roughness={0.4} metalness={0.95} />
      </mesh>
      {/* Hex nut on embedded end */}
      <mesh position={[0, yBottom + 0.015, 0]} castShadow>
        <cylinderGeometry args={[da * 0.85, da * 0.85, 0.025, 6]} />
        <meshStandardMaterial color="#5a5a5a" roughness={0.4} metalness={0.95} />
      </mesh>
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
