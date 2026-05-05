'use client';

// WallViewer3D — three-dimensional viewer for wall types whose geometry has
// out-of-plane variation (counterfort, buttressed). The 2D WallCanvas is
// excellent for cantilever / gravity / basement etc. but cannot show a
// row of rear buttresses or front buttresses. This viewer shows them.
//
// Mounted only when `kind ∈ {counterfort, buttressed}` by RetainingWallCalculator.

import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Grid, GizmoHelper, GizmoViewport, ContactShadows, Environment, Text,
} from '@react-three/drei';
import * as THREE from 'three';
import warehouseHDR from '@pmndrs/assets/hdri/warehouse.exr';
import type { WallInput } from '@/lib/retaining-wall/types';

const MM_TO_M = 0.001;

interface Props {
  input: WallInput;
}

export function WallViewer3D({ input }: Props) {
  const g = input.geometry;
  const isCounter = g.kind === 'counterfort' || g.kind === 'buttressed';
  if (!isCounter) {
    return (
      <div className="rw-3d__placeholder">
        3D viewer is only shown for counterfort / buttressed walls.
      </div>
    );
  }

  // Shape parameters (mm)
  const Hstem = g.H_stem;
  const t_top = g.t_stem_top;
  const t_bot = g.t_stem_bot;
  const Btoe  = g.B_toe;
  const Bheel = g.B_heel;
  const Hfoot = g.H_foot;
  const B = Btoe + t_bot + Bheel;

  // Counterfort / buttress spacing + thickness
  const spacing = (g.kind === 'counterfort' ? g.counterfortSpacing : g.buttressSpacing) ?? 3000;
  const cThick  = (g.kind === 'counterfort' ? g.counterfortThickness : g.buttressThickness) ?? 300;
  // Render 4 counterforts (3 spans) for the visualization; total wall length
  // shown = 3 × spacing.
  const wallLength = 3 * spacing;

  // SI-metres dimensions for r3f
  const Hstem_m = Hstem * MM_TO_M;
  const t_bot_m = t_bot * MM_TO_M;
  const t_top_m = t_top * MM_TO_M;
  void t_top_m;
  const Btoe_m  = Btoe * MM_TO_M;
  const Bheel_m = Bheel * MM_TO_M;
  const Hfoot_m = Hfoot * MM_TO_M;
  const B_m     = B * MM_TO_M;
  const wallLen_m = wallLength * MM_TO_M;
  const spacing_m = spacing * MM_TO_M;
  const cThick_m  = cThick * MM_TO_M;

  // Counterfort tapers from full B_heel at base to ~t_bot at top of stem
  // (rear face of stem). For visualisation we render it as a vertical slab
  // of width = B_heel projected behind the stem.
  const cWidth_m = Bheel_m;

  // Position of counterforts along the wall length (Z axis).  4 counterforts
  // at z = −1.5·S, −0.5·S, +0.5·S, +1.5·S — symmetric about origin.
  const cPositions: number[] = [-1.5, -0.5, 0.5, 1.5].map((k) => k * spacing_m);

  const concreteMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cdc8bf', roughness: 0.92, metalness: 0.0,
  }), []);
  const counterfortMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#bcb5a8', roughness: 0.9, metalness: 0.05,
  }), []);
  const edgeBandMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c9a84c', emissive: '#c9a84c', emissiveIntensity: 0.18,
    roughness: 0.45, metalness: 0.85,
  }), []);

  const camDist = Math.max(B_m, wallLen_m, Hstem_m + Hfoot_m) * 1.4;

  return (
    <div className="rw-3d slab-3d">
      <div className="slab-3d__controls">
        <span className="slab-3d__hint">
          {g.kind === 'counterfort' ? 'Counterfort wall — rear buttresses' : 'Buttressed wall — front buttresses'}
          · {(spacing/1000).toFixed(2)} m spacing · {(cThick).toFixed(0)} mm thick
        </span>
      </div>
      <div className="rc-3d__canvas slab-3d__canvas">
        <Canvas
          shadows
          camera={{ position: [camDist, camDist * 0.85, camDist], fov: 38, near: 0.05, far: 400 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#0a0a0a']} />
          <Suspense fallback={null}>
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.18} />
          </Suspense>
          <ambientLight intensity={0.32} />
          <directionalLight position={[B_m * 4, Hstem_m * 4, wallLen_m * 4]} intensity={0.85} castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0005} />
          <directionalLight position={[-B_m * 2, Hstem_m * 2, -wallLen_m * 2]} intensity={0.22} />

          {/* Footing (centered at origin, top at y = 0) */}
          <mesh position={[0, -Hfoot_m / 2, 0]} receiveShadow castShadow material={concreteMat}>
            <boxGeometry args={[B_m, Hfoot_m, wallLen_m]} />
          </mesh>

          {/* Stem — at the front (toward toe direction is +X if Btoe > 0).
              Stem centerline X = (Btoe + t_bot/2) − B/2 (centered on footing) */}
          {(() => {
            const stemX = -B_m / 2 + Btoe_m + t_bot_m / 2;
            return (
              <mesh position={[stemX, Hstem_m / 2, 0]} receiveShadow castShadow material={concreteMat}>
                <boxGeometry args={[t_bot_m, Hstem_m, wallLen_m]} />
              </mesh>
            );
          })()}

          {/* Counterforts (one per cPosition).  For 'counterfort': behind the stem.
              For 'buttressed': in front of the stem. */}
          {cPositions.map((z, i) => {
            const stemRearX = -B_m / 2 + Btoe_m + t_bot_m;          // rear face of stem
            const stemFrontX = -B_m / 2 + Btoe_m;                    // front face of stem
            // Counterfort/buttress width (along X): for counterfort, runs from rear face of
            // stem to back of heel — width = B_heel. For buttressed, from front face of
            // stem to back of toe — width = B_toe.
            const cX = g.kind === 'counterfort'
              ? stemRearX + cWidth_m / 2
              : stemFrontX - Btoe_m / 2;
            const cWidthRender = g.kind === 'counterfort' ? cWidth_m : Btoe_m;
            return (
              <mesh
                key={`c-${i}`}
                position={[cX, Hstem_m / 2, z]}
                material={counterfortMat}
                castShadow receiveShadow
              >
                <boxGeometry args={[cWidthRender, Hstem_m, cThick_m]} />
              </mesh>
            );
          })}

          {/* Glowing gold edge bands around the wall outline (footing top + bottom) */}
          {[0, -Hfoot_m].map((y) => (
            <group key={y}>
              <mesh position={[0, y, +wallLen_m / 2]} material={edgeBandMat}>
                <boxGeometry args={[B_m + 0.02, 0.02, 0.02]} />
              </mesh>
              <mesh position={[0, y, -wallLen_m / 2]} material={edgeBandMat}>
                <boxGeometry args={[B_m + 0.02, 0.02, 0.02]} />
              </mesh>
              <mesh position={[+B_m / 2, y, 0]} material={edgeBandMat}>
                <boxGeometry args={[0.02, 0.02, wallLen_m]} />
              </mesh>
              <mesh position={[-B_m / 2, y, 0]} material={edgeBandMat}>
                <boxGeometry args={[0.02, 0.02, wallLen_m]} />
              </mesh>
            </group>
          ))}

          {/* Floating dimension labels */}
          <Text position={[0, -Hfoot_m - 0.5, +wallLen_m / 2 + 0.3]} fontSize={0.25}
                color="#c9a84c" anchorX="center" anchorY="middle"
                outlineWidth={0.012} outlineColor="#000">
            B = {(B/1000).toFixed(2)} m
          </Text>
          <Text position={[+B_m / 2 + 0.3, Hstem_m / 2, 0]} fontSize={0.25}
                color="#c9a84c" anchorX="center" anchorY="middle"
                rotation={[0, -Math.PI / 2, 0]}
                outlineWidth={0.012} outlineColor="#000">
            S = {(spacing/1000).toFixed(2)} m
          </Text>

          <Grid args={[B_m * 4, wallLen_m * 4]}
            cellSize={0.5} cellThickness={0.45} cellColor="#3a3320"
            sectionSize={2.5} sectionThickness={0.9} sectionColor="#5a4f30"
            fadeDistance={Math.max(B_m, wallLen_m) * 6} fadeStrength={1.4}
            position={[0, -Hfoot_m - 0.005, 0]} infiniteGrid={false} />

          <ContactShadows position={[0, -Hfoot_m - 0.001, 0]}
            opacity={0.55} scale={Math.max(B_m, wallLen_m) * 2.5}
            blur={2.4} far={3} resolution={1024} frames={1} smooth />

          <OrbitControls makeDefault enableDamping
            target={[0, Hstem_m / 4, 0]}
            maxDistance={Math.max(B_m, wallLen_m) * 6}
            minDistance={Math.max(B_m, wallLen_m) * 0.3}
          />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['#c9a84c', '#7fb691', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>
        </Canvas>
      </div>
    </div>
  );
}
