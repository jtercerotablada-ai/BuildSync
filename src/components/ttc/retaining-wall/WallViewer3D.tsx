'use client';

// WallViewer3D — three-dimensional viewer for ALL 8 retaining-wall kinds.
//
// Each kind renders its characteristic geometry:
//   • Cantilever     — tapered stem + footing (toe + heel), shear key option
//   • Gravity        — trapezoidal mass concrete on a footing
//   • Semi-gravity   — slim cantilever, light steel
//   • L-shaped       — stem + heel only (B_toe = 0)
//   • Counterfort    — stem + heel + 4 rear buttresses
//   • Buttressed     — stem + toe + 4 front buttresses
//   • Basement       — stem + footing + top slab/diaphragm + waterproofing
//   • Abutment       — stem + bridge seat (cap) + backwall + wing walls
//
// Every kind also renders:
//   • Drainage gravel (gray pebbled polygon behind the rear face of the stem)
//   • Perforated drainage pipe at the base of the gravel
//   • Soil mass (foundation + backfill) with grass on top
//   • Gold edge bands around the concrete + dimension labels in Spanish

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

  // Common cross-section dims (m)
  const Hstem  = g.H_stem * MM_TO_M;
  const t_top  = g.t_stem_top * MM_TO_M;
  const t_bot  = g.t_stem_bot * MM_TO_M;
  const Btoe   = g.B_toe * MM_TO_M;
  const Bheel  = g.B_heel * MM_TO_M;
  const Hfoot  = g.H_foot * MM_TO_M;
  const Bfoot  = Btoe + t_bot + Bheel; // total footing width
  const drainage = input.drainage ?? { enabled: true, gravelThickness: 300, pipeDiameter: 100 };
  const gravelT = drainage.enabled ? drainage.gravelThickness * MM_TO_M : 0;
  const pipeD   = drainage.enabled ? drainage.pipeDiameter   * MM_TO_M : 0;

  // Wall length along Z (perpendicular to the section). For counterfort/buttressed
  // we render multiple ribs so we need a longer wall length.
  const isMulti = g.kind === 'counterfort' || g.kind === 'buttressed';
  const spacing_m = isMulti
    ? ((g.kind === 'counterfort' ? g.counterfortSpacing : g.buttressSpacing) ?? 3000) * MM_TO_M
    : 0;
  const cThick_m = isMulti
    ? ((g.kind === 'counterfort' ? g.counterfortThickness : g.buttressThickness) ?? 300) * MM_TO_M
    : 0;
  const wallL = isMulti ? 3 * spacing_m : Math.max(2.5, Bfoot * 1.4);

  // Frame of reference — origin at the center of the FOOTING TOP, x along section,
  // y vertical up, z along the wall length.
  // Stem rear face is at xRear = (-Bfoot/2 + Btoe + t_bot)
  const xStemFront = -Bfoot / 2 + Btoe;
  const xStemBack  = -Bfoot / 2 + Btoe + t_bot;

  // Materials — created once per kind change
  const concreteMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cdc8bf', roughness: 0.92, metalness: 0.0,
  }), []);
  const concreteEdgeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c9a84c', emissive: '#c9a84c', emissiveIntensity: 0.18,
    roughness: 0.45, metalness: 0.85,
  }), []);
  const buttressMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#bcb5a8', roughness: 0.9, metalness: 0.05,
  }), []);
  const soilMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#7a5634', roughness: 1.0, metalness: 0.0,
  }), []);
  const grassMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#5aae3a', roughness: 0.95, metalness: 0.0,
  }), []);
  const gravelMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#8d8d8a', roughness: 0.88, metalness: 0.05,
  }), []);
  const pipeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ececec', roughness: 0.45, metalness: 0.1,
  }), []);
  const waterproofMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1a1a', roughness: 0.65, metalness: 0.05,
  }), []);
  const bridgeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#a8a39a', roughness: 0.88, metalness: 0.1,
  }), []);

  const camDist = Math.max(Bfoot, wallL, Hstem + Hfoot) * 1.5;

  return (
    <div className="rw-3d slab-3d">
      <div className="slab-3d__controls">
        <span className="slab-3d__hint">
          {kindCaption(g.kind)} · B = {(Bfoot).toFixed(2)} m · H = {(Hstem + Hfoot).toFixed(2)} m
          {isMulti && ` · S = ${(spacing_m).toFixed(2)} m`}
        </span>
      </div>
      <div className="rc-3d__canvas slab-3d__canvas">
        <Canvas
          shadows
          camera={{ position: [camDist * 0.85, camDist * 0.7, camDist], fov: 38, near: 0.05, far: 400 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          <color attach="background" args={['#0a0a0a']} />
          <Suspense fallback={null}>
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.18} />
          </Suspense>
          <ambientLight intensity={0.32} />
          <directionalLight position={[Bfoot * 4, Hstem * 4, wallL * 4]} intensity={0.85} castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0005} />
          <directionalLight position={[-Bfoot * 2, Hstem * 2, -wallL * 2]} intensity={0.22} />

          {/* ──────── FOOTING (always present except gravity-walls have a smaller pedestal) ──────── */}
          <mesh position={[0, -Hfoot / 2, 0]} receiveShadow castShadow material={concreteMat}>
            <boxGeometry args={[Bfoot, Hfoot, wallL]} />
          </mesh>

          {/* ──────── KIND-SPECIFIC STEM / WALL BODY ──────── */}
          {renderStem({ kind: g.kind, geom: g, Hstem, t_top, t_bot, Bfoot, Btoe, wallL,
                       concreteMat, bridgeMat })}

          {/* ──────── COUNTERFORTS / BUTTRESSES ──────── */}
          {(g.kind === 'counterfort' || g.kind === 'buttressed') && (
            <CounterfortRibs
              g={g} Hstem={Hstem} Bheel={Bheel} Btoe={Btoe} t_bot={t_bot}
              spacing_m={spacing_m} cThick_m={cThick_m} mat={buttressMat}
            />
          )}

          {/* ──────── BASEMENT TOP SLAB (propping diaphragm) ──────── */}
          {g.kind === 'basement' && (
            <BasementTopSlab Hstem={Hstem} t_bot={t_bot} Bfoot={Bfoot} Btoe={Btoe}
                             wallL={wallL} mat={concreteMat} />
          )}

          {/* ──────── ABUTMENT BRIDGE-SEAT + BACKWALL + WING WALLS ──────── */}
          {g.kind === 'abutment' && (
            <AbutmentCap g={g} Hstem={Hstem} t_bot={t_bot} xStemBack={xStemBack}
                         wallL={wallL} mat={bridgeMat} />
          )}

          {/* ──────── DRAINAGE SYSTEM (every kind) ──────── */}
          {drainage.enabled && (
            <DrainageSystem3D
              xStemBack={xStemBack} Hstem={Hstem} wallL={wallL}
              gravelT={gravelT} pipeD={pipeD}
              gravelMat={gravelMat} pipeMat={pipeMat}
              waterproofingForBasement={g.kind === 'basement'} waterproofMat={waterproofMat}
              t_bot={t_bot} t_top={t_top}
            />
          )}

          {/* ──────── BACKFILL SOIL MASS ──────── */}
          <BackfillSoil
            xStemBack={xStemBack} gravelT={gravelT}
            Hstem={Hstem} wallL={wallL} Bfoot={Bfoot}
            soilMat={soilMat} grassMat={grassMat}
          />

          {/* ──────── EDGE BANDS (gold trim around the concrete) ──────── */}
          <EdgeBands Bfoot={Bfoot} Hstem={Hstem} Hfoot={Hfoot} wallL={wallL}
                     xStemFront={xStemFront} xStemBack={xStemBack}
                     mat={concreteEdgeMat} />

          {/* ──────── SPANISH CALLOUT LABELS ──────── */}
          <Callouts3D g={g} Bfoot={Bfoot} Hstem={Hstem} Hfoot={Hfoot} wallL={wallL}
                      xStemFront={xStemFront} xStemBack={xStemBack}
                      gravelT={gravelT} pipeD={pipeD} drainage={drainage} />

          {/* Ground grid + contact shadows */}
          <Grid args={[Bfoot * 4, wallL * 4]}
            cellSize={0.5} cellThickness={0.45} cellColor="#3a3320"
            sectionSize={2.5} sectionThickness={0.9} sectionColor="#5a4f30"
            fadeDistance={Math.max(Bfoot, wallL) * 6} fadeStrength={1.4}
            position={[0, -Hfoot - 0.005, 0]} infiniteGrid={false} />

          <ContactShadows position={[0, -Hfoot - 0.001, 0]}
            opacity={0.55} scale={Math.max(Bfoot, wallL) * 2.5}
            blur={2.4} far={3} resolution={1024} frames={1} smooth />

          <OrbitControls makeDefault enableDamping
            target={[0, Hstem / 4, 0]}
            maxDistance={Math.max(Bfoot, wallL) * 8}
            minDistance={Math.max(Bfoot, wallL) * 0.3}
          />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['#c9a84c', '#7fb691', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>
        </Canvas>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stem renderer — per kind
function renderStem({
  kind, geom, Hstem, t_top, t_bot, Bfoot, Btoe, wallL, concreteMat,
}: {
  kind: WallInput['geometry']['kind'];
  geom: WallInput['geometry'];
  Hstem: number; t_top: number; t_bot: number; Bfoot: number; Btoe: number; wallL: number;
  concreteMat: THREE.MeshStandardMaterial;
  bridgeMat: THREE.MeshStandardMaterial;
}) {
  // Centreline at top vs bottom (bot is centred on stem, top shifts back as the front face is plumb)
  // Stem front face is plumb at xStemFront, rear face tapers from xStemBack at base inward to xStemBack-(t_bot-t_top) at top.
  const xCenterBot = -Bfoot / 2 + Btoe + t_bot / 2;
  const xCenterTop = -Bfoot / 2 + Btoe + t_top / 2;

  if (kind === 'gravity') {
    // Trapezoidal mass-concrete: render as a tapered prism using BufferGeometry
    const gShape = geom as Extract<WallInput['geometry'], { kind: 'gravity' }>;
    void gShape;
    return <TaperedPrism y0={0} y1={Hstem} xCenterBot={xCenterBot} xCenterTop={xCenterTop}
                         tBot={t_bot} tTop={t_top} z={wallL} mat={concreteMat} />;
  }
  if (kind === 'semi-gravity') {
    return <TaperedPrism y0={0} y1={Hstem} xCenterBot={xCenterBot} xCenterTop={xCenterTop}
                         tBot={t_bot} tTop={t_top} z={wallL} mat={concreteMat} />;
  }
  if (kind === 'l-shaped') {
    // Stem may lean forward — treat as plumb for now (lean is small)
    return <TaperedPrism y0={0} y1={Hstem} xCenterBot={xCenterBot} xCenterTop={xCenterTop}
                         tBot={t_bot} tTop={t_top} z={wallL} mat={concreteMat} />;
  }
  if (kind === 'basement') {
    return <TaperedPrism y0={0} y1={Hstem} xCenterBot={xCenterBot} xCenterTop={xCenterTop}
                         tBot={t_bot} tTop={t_top} z={wallL} mat={concreteMat} />;
  }
  // Cantilever / counterfort / buttressed / abutment — same envelope
  return <TaperedPrism y0={0} y1={Hstem} xCenterBot={xCenterBot} xCenterTop={xCenterTop}
                       tBot={t_bot} tTop={t_top} z={wallL} mat={concreteMat} />;
}

/**
 * Tapered prism — a stem that varies thickness linearly from tBot at y=y0
 * to tTop at y=y1.  Built from 8 vertices.
 */
function TaperedPrism({
  y0, y1, xCenterBot, xCenterTop, tBot, tTop, z, mat,
}: {
  y0: number; y1: number; xCenterBot: number; xCenterTop: number;
  tBot: number; tTop: number; z: number;
  mat: THREE.MeshStandardMaterial;
}) {
  const geometry = useMemo(() => {
    const xFB = xCenterBot - tBot / 2;
    const xRB = xCenterBot + tBot / 2;
    const xFT = xCenterTop - tTop / 2;
    const xRT = xCenterTop + tTop / 2;
    const halfZ = z / 2;
    const verts = new Float32Array([
      // bottom face (y0)
      xFB, y0, -halfZ,  xRB, y0, -halfZ,  xRB, y0,  halfZ,  xFB, y0,  halfZ,
      // top face (y1)
      xFT, y1, -halfZ,  xRT, y1, -halfZ,  xRT, y1,  halfZ,  xFT, y1,  halfZ,
    ]);
    const indices = [
      // bottom
      0, 1, 2,  0, 2, 3,
      // top
      4, 6, 5,  4, 7, 6,
      // front (-z)
      0, 4, 5,  0, 5, 1,
      // back (+z)
      3, 2, 6,  3, 6, 7,
      // front-x face
      0, 3, 7,  0, 7, 4,
      // rear-x face
      1, 5, 6,  1, 6, 2,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [y0, y1, xCenterBot, xCenterTop, tBot, tTop, z]);
  return <mesh geometry={geometry} material={mat} castShadow receiveShadow />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Counterfort / buttress ribs
function CounterfortRibs({
  g, Hstem, Bheel, Btoe, t_bot, spacing_m, cThick_m, mat,
}: {
  g: WallInput['geometry'];
  Hstem: number; Bheel: number; Btoe: number; t_bot: number;
  spacing_m: number; cThick_m: number;
  mat: THREE.MeshStandardMaterial;
}) {
  const cWidthRender = g.kind === 'counterfort' ? Bheel : Btoe;
  const stemRearX = -((Btoe + t_bot + Bheel)) / 2 + Btoe + t_bot;
  const stemFrontX = -((Btoe + t_bot + Bheel)) / 2 + Btoe;
  // 4 ribs symmetric around z = 0
  const positions = [-1.5, -0.5, 0.5, 1.5].map((k) => k * spacing_m);
  return (
    <>
      {positions.map((z, i) => {
        const cX = g.kind === 'counterfort'
          ? stemRearX + cWidthRender / 2
          : stemFrontX - cWidthRender / 2;
        return (
          <mesh key={`c-${i}`} position={[cX, Hstem / 2, z]} material={mat} castShadow receiveShadow>
            <boxGeometry args={[cWidthRender, Hstem, cThick_m]} />
          </mesh>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Basement top slab — propping diaphragm
function BasementTopSlab({
  Hstem, t_bot, Bfoot, Btoe, wallL, mat,
}: {
  Hstem: number; t_bot: number; Bfoot: number; Btoe: number; wallL: number;
  mat: THREE.MeshStandardMaterial;
}) {
  // A horizontal slab extends INTO the room (toward toe side), 2.0 m deep
  const slabDepth = 2.0;
  const slabT = 0.20;
  const slabX = -Bfoot / 2 + Btoe / 2 - slabDepth / 2 + Btoe / 2;
  void slabX;
  // Place slab against the front face of the stem — front face is plumb at xStemFront
  const xStemFront = -Bfoot / 2 + Btoe;
  return (
    <mesh position={[xStemFront - slabDepth / 2, Hstem - slabT / 2, 0]}
          material={mat} castShadow receiveShadow>
      <boxGeometry args={[slabDepth + t_bot, slabT, wallL]} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Abutment cap — bridge seat + backwall (a stepped block on top of the stem)
function AbutmentCap({
  g, Hstem, t_bot, xStemBack, wallL, mat,
}: {
  g: WallInput['geometry']; Hstem: number; t_bot: number; xStemBack: number; wallL: number;
  mat: THREE.MeshStandardMaterial;
}) {
  if (g.kind !== 'abutment') return null;
  const a = g;
  const seatW = a.bridgeSeat.width * MM_TO_M;
  const bwH   = a.backwall.H * MM_TO_M;
  const bwT   = a.backwall.t * MM_TO_M;
  // Bridge seat platform — extends FORWARD from rear face of stem
  const seatT = 0.4;     // 400 mm typical seat height
  const seatX = xStemBack - t_bot - seatW / 2; // slot above stem on the toe side
  return (
    <group>
      {/* Seat platform */}
      <mesh position={[seatX, Hstem + seatT / 2, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[seatW, seatT, wallL]} />
      </mesh>
      {/* Backwall — extends UP behind the seat, retains roadway fill */}
      <mesh position={[xStemBack - bwT / 2, Hstem + seatT + bwH / 2, 0]}
            material={mat} castShadow receiveShadow>
        <boxGeometry args={[bwT, bwH, wallL]} />
      </mesh>
      {/* Optional wing wall — perpendicular to abutment */}
      {a.wingWall && (() => {
        const wL = a.wingWall.length * MM_TO_M;
        const wH = a.wingWall.H     * MM_TO_M;
        const wT = a.wingWall.t     * MM_TO_M;
        const zEdge = wallL / 2 - wT / 2;
        return (
          <mesh position={[xStemBack + wL / 2, wH / 2, zEdge]}
                material={mat} castShadow receiveShadow>
            <boxGeometry args={[wL, wH, wT]} />
          </mesh>
        );
      })()}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Drainage system — gravel pack + perforated pipe (and optional waterproofing
// membrane for basement walls).
function DrainageSystem3D({
  xStemBack, Hstem, wallL, gravelT, pipeD,
  gravelMat, pipeMat, waterproofingForBasement, waterproofMat,
  t_bot, t_top,
}: {
  xStemBack: number; Hstem: number; wallL: number;
  gravelT: number; pipeD: number;
  gravelMat: THREE.MeshStandardMaterial;
  pipeMat: THREE.MeshStandardMaterial;
  waterproofingForBasement: boolean;
  waterproofMat: THREE.MeshStandardMaterial;
  t_bot: number; t_top: number;
}) {
  void t_top;
  if (gravelT <= 0) return null;
  // The gravel band hugs the rear face of the stem from y=0 (footing top) to y=Hstem
  const gravelXc = xStemBack + gravelT / 2;
  return (
    <group>
      {/* Optional waterproofing membrane for basement walls */}
      {waterproofingForBasement && (
        <mesh position={[xStemBack + 0.012, Hstem / 2, 0]} material={waterproofMat}>
          <boxGeometry args={[0.025, Hstem, wallL * 0.96]} />
        </mesh>
      )}
      {/* Gravel pack */}
      <mesh position={[gravelXc, Hstem / 2, 0]} material={gravelMat} castShadow receiveShadow>
        <boxGeometry args={[gravelT, Hstem, wallL]} />
      </mesh>
      {/* Perforated pipe — runs along the wall length at the base of the gravel */}
      <mesh position={[gravelXc, pipeD / 2 + 0.03, 0]} material={pipeMat}
            rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[pipeD / 2, pipeD / 2, wallL * 0.95, 18]} />
      </mesh>
      {/* Pipe perforation marks — small dimples along the pipe length */}
      {Array.from({ length: 6 }).map((_, i) => {
        const z = (i - 2.5) * (wallL * 0.95) / 6;
        return (
          <mesh key={`hole-${i}`}
            position={[gravelXc + pipeD * 0.45, pipeD / 2 + 0.03, z]}
            material={waterproofMat}>
            <sphereGeometry args={[pipeD * 0.08, 8, 6]} />
          </mesh>
        );
      })}
      void t_bot;
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Backfill soil mass (and toe-side foundation soil + grass on top).
function BackfillSoil({
  xStemBack, gravelT, Hstem, wallL, Bfoot, soilMat, grassMat,
}: {
  xStemBack: number; gravelT: number; Hstem: number; wallL: number; Bfoot: number;
  soilMat: THREE.MeshStandardMaterial;
  grassMat: THREE.MeshStandardMaterial;
}) {
  // Backfill block — behind the gravel, full stem height plus a strip above
  const xBackStart = xStemBack + gravelT;
  const backWidth = (Bfoot / 2 + 1.5) - xBackStart;
  const xBackCenter = xBackStart + backWidth / 2;
  const grassT = 0.05;
  return (
    <group>
      <mesh position={[xBackCenter, Hstem / 2, 0]} material={soilMat} castShadow receiveShadow>
        <boxGeometry args={[backWidth, Hstem, wallL * 0.99]} />
      </mesh>
      {/* Grass strip on top of the backfill */}
      <mesh position={[xBackCenter, Hstem + grassT / 2, 0]} material={grassMat}>
        <boxGeometry args={[backWidth + 0.04, grassT, wallL * 0.99]} />
      </mesh>
      {/* Foundation soil under and around the footing (visible as a base) */}
      <mesh position={[0, -1.0, 0]} material={soilMat} receiveShadow>
        <boxGeometry args={[Bfoot * 1.6, 1.5, wallL * 1.4]} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gold edge bands around the slab + stem
function EdgeBands({
  Bfoot, Hstem, Hfoot, wallL, xStemFront, xStemBack, mat,
}: {
  Bfoot: number; Hstem: number; Hfoot: number; wallL: number;
  xStemFront: number; xStemBack: number;
  mat: THREE.MeshStandardMaterial;
}) {
  const t = 0.025;
  return (
    <group>
      {/* Footing top edges (4) */}
      {[0, -Hfoot].map((y) => (
        <group key={y}>
          <mesh position={[0, y, +wallL / 2]} material={mat}>
            <boxGeometry args={[Bfoot + t * 2, t, t]} />
          </mesh>
          <mesh position={[0, y, -wallL / 2]} material={mat}>
            <boxGeometry args={[Bfoot + t * 2, t, t]} />
          </mesh>
          <mesh position={[+Bfoot / 2, y, 0]} material={mat}>
            <boxGeometry args={[t, t, wallL]} />
          </mesh>
          <mesh position={[-Bfoot / 2, y, 0]} material={mat}>
            <boxGeometry args={[t, t, wallL]} />
          </mesh>
        </group>
      ))}
      {/* Stem front + back top edges */}
      <mesh position={[xStemFront, Hstem, +wallL / 2]} material={mat}>
        <boxGeometry args={[t, t, t]} />
      </mesh>
      <mesh position={[xStemBack, Hstem, -wallL / 2]} material={mat}>
        <boxGeometry args={[t, t, t]} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spanish callout labels in 3D — point to each element with a glowing gold dot.
function Callouts3D({
  g, Bfoot, Hstem, Hfoot, wallL, xStemFront, xStemBack, gravelT, pipeD, drainage,
}: {
  g: WallInput['geometry'];
  Bfoot: number; Hstem: number; Hfoot: number; wallL: number;
  xStemFront: number; xStemBack: number; gravelT: number; pipeD: number;
  drainage: { enabled: boolean };
}) {
  const fs = Math.max(Hstem, Bfoot) * 0.06;
  const off = 0.4;
  const stemMid = Hstem * 0.5;
  // Position labels at the +z edge so they don't overlap the side view
  const z = wallL / 2 + 0.4;
  return (
    <group>
      <Text position={[xStemFront - off, stemMid, z]} fontSize={fs}
            color="#c9a84c" anchorX="right" anchorY="middle"
            outlineWidth={fs * 0.05} outlineColor="#000">
        {kindCaption(g.kind)}
      </Text>
      <Text position={[+Bfoot / 2 + off, -Hfoot / 2, z]} fontSize={fs * 0.85}
            color="#c9a84c" anchorX="left" anchorY="middle"
            outlineWidth={fs * 0.05} outlineColor="#000">
        Talón
      </Text>
      {g.B_toe > 0 && (
        <Text position={[-Bfoot / 2 - off, -Hfoot / 2, z]} fontSize={fs * 0.85}
              color="#c9a84c" anchorX="right" anchorY="middle"
              outlineWidth={fs * 0.05} outlineColor="#000">
          Punta
        </Text>
      )}
      {drainage.enabled && (
        <>
          <Text position={[xStemBack + gravelT + off, stemMid * 1.3, z]} fontSize={fs * 0.85}
                color="#c9a84c" anchorX="left" anchorY="middle"
                outlineWidth={fs * 0.05} outlineColor="#000">
            Grava drenante
          </Text>
          {pipeD > 0 && (
            <Text position={[xStemBack + gravelT + off, pipeD, z]} fontSize={fs * 0.85}
                  color="#c9a84c" anchorX="left" anchorY="middle"
                  outlineWidth={fs * 0.05} outlineColor="#000">
              Tubo de drenaje
            </Text>
          )}
        </>
      )}
      <Text position={[+Bfoot / 2 + off, Hstem * 0.7, z]} fontSize={fs * 0.85}
            color="#c9a84c" anchorX="left" anchorY="middle"
            outlineWidth={fs * 0.05} outlineColor="#000">
        Relleno
      </Text>
      <Text position={[0, -Hfoot - 0.6, z]} fontSize={fs * 0.85}
            color="#c9a84c" anchorX="center" anchorY="middle"
            outlineWidth={fs * 0.05} outlineColor="#000">
        Suelo de cimentación
      </Text>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function kindCaption(kind: WallInput['geometry']['kind']): string {
  switch (kind) {
    case 'cantilever':   return 'Fuste (muro cantilever)';
    case 'gravity':      return 'Muro de gravedad';
    case 'semi-gravity': return 'Muro semi-gravedad';
    case 'l-shaped':     return 'Muro en L';
    case 'counterfort':  return 'Muro de contrafuertes (rear)';
    case 'buttressed':   return 'Muro con contrafuertes (front)';
    case 'basement':     return 'Muro de sótano';
    case 'abutment':     return 'Estribo de puente';
  }
}
