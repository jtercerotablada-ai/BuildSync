'use client';

// CantileverViewer3D — CYPE-style structural visualization for cantilever
// retaining walls. The 3D view focuses on the STRUCTURE: ghost concrete +
// prominent rebar cages. Soil, gravel and grass live in the 2D section
// view (WallCanvas) where they convey context cleanly.
//
// Visual language (matches CYPE Architecture / Reinforcement views):
//   • Concrete: translucent white-gray (opacity ~0.22), with bold gold edges
//     in the TTC brand accent (#c9a84c).
//   • Rebar: solid, thick, two colors so the cages read at a glance:
//       – Stem rebar  → green  (#7fb691)
//       – Footing rebar → orange (#e89478)
//   • Background: TTC dark (#0e0e10) — the brand fond.
//   • Spanish callouts on the structure (Fuste, Punta, Talón).
//
// All bar layouts are derived from the calculated As (mm²/m) using a
// standard #4–#10 catalog with spacing in [80, sMax] mm.

import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, ContactShadows, Environment, Text,
  Instances, Instance, RoundedBox, Edges,
  GizmoHelper, GizmoViewport,
} from '@react-three/drei';
import * as THREE from 'three';
import warehouseHDR from '@pmndrs/assets/hdri/warehouse.exr';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import type { WallInput, WallResults, CantileverGeometry } from '@/lib/retaining-wall/types';

const MM_TO_M = 0.001;

// TTC brand palette
const C = {
  fond:        '#0e0e10',
  concrete:    '#e8e6df',  // light bone — concrete fantasma
  edge:        '#c9a84c',  // TTC gold — edges of the concrete elements
  stemRebar:   '#7fb691',  // green — stem rebar
  footRebar:   '#e89478',  // orange — footing rebar
  longitRebar: '#ffd166',  // amber — longitudinal distribution bars
  callout:     '#f2efe4',  // cream — labels
  calloutBg:   '#000000',
};

interface Props {
  input: WallInput;
  result: WallResults;
}

/**
 * Pick a rebar diameter (mm) and spacing (mm) given a required area
 * As_req (mm²/m). Walks a standard bar catalog and picks the smallest
 * diameter that gives a spacing in [80, sMax] mm.
 */
function pickBarLayout(As_req: number, sMax: number = 300):
  { db: number; ab: number; spacing: number; label: string } {
  const catalog: Array<{ db: number; ab: number; label: string }> = [
    { db: 12.7, ab: 129, label: '#4' },
    { db: 15.9, ab: 199, label: '#5' },
    { db: 19.1, ab: 284, label: '#6' },
    { db: 22.2, ab: 387, label: '#7' },
    { db: 25.4, ab: 510, label: '#8' },
    { db: 28.7, ab: 645, label: '#9' },
    { db: 32.3, ab: 819, label: '#10' },
  ];
  for (const bar of catalog) {
    const s = (1000 * bar.ab) / Math.max(As_req, 1);
    if (s <= sMax && s >= 80) {
      return { db: bar.db, ab: bar.ab, spacing: s, label: bar.label };
    }
  }
  const last = catalog[catalog.length - 1];
  return { db: last.db, ab: last.ab, spacing: 80, label: last.label };
}

export function CantileverViewer3D({ input, result }: Props) {
  if (input.geometry.kind !== 'cantilever') {
    return (
      <div className="rw-3d__placeholder">
        CantileverViewer3D: kind must be &apos;cantilever&apos;.
      </div>
    );
  }
  const g = input.geometry as CantileverGeometry;

  // Dimensions in metres (R3F native)
  const Hstem = g.H_stem * MM_TO_M;
  const t_top = g.t_stem_top * MM_TO_M;
  const t_bot = g.t_stem_bot * MM_TO_M;
  const Btoe  = g.B_toe * MM_TO_M;
  const Bheel = g.B_heel * MM_TO_M;
  const Hfoot = g.H_foot * MM_TO_M;
  const cover = input.concrete.cover * MM_TO_M;
  const Bfoot = Btoe + t_bot + Bheel;

  // Wall length along Z — 4 m so longitudinal bars and spacing read clearly
  const wallL = 4.0;

  // Reference x-coordinates (origin centered on footing)
  const xStemFront = -Bfoot / 2 + Btoe;
  const xStemBack  = -Bfoot / 2 + Btoe + t_bot;
  const xStemBackTop = xStemFront + t_top; // taper the rear face

  // ──────── Pick rebar layouts from calculated As ────────
  const stemVert = pickBarLayout(result.stem.As_req, 300);
  const As_horiz = result.stem.horizontalReinforcement?.As_horizontal_per_m ?? 0.0020 * 1000 * g.t_stem_bot;
  const sMax_horiz = result.stem.horizontalReinforcement?.s_max ?? Math.min(3 * g.t_stem_bot, 450);
  const stemHoriz = pickBarLayout(As_horiz, sMax_horiz);
  const heelTop = pickBarLayout(result.heel.As_req, 300);
  const toeBot = pickBarLayout(result.toe.As_req, 300);

  return (
    <div className="rw-3d slab-3d cantilever-3d">
      <div className="slab-3d__controls">
        <span className="slab-3d__hint">
          Muro cantilever · B = {Bfoot.toFixed(2)} m · H = {(Hstem + Hfoot).toFixed(2)} m ·
          Fuste: {stemVert.label}@{stemVert.spacing.toFixed(0)} mm ·
          Talón: {heelTop.label}@{heelTop.spacing.toFixed(0)} mm ·
          Punta: {toeBot.label}@{toeBot.spacing.toFixed(0)} mm
        </span>
      </div>
      <div className="rc-3d__canvas slab-3d__canvas">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          camera={{ position: [Bfoot * 1.6, Hstem * 0.7, wallL * 1.6], fov: 38, near: 0.05, far: 200 }}
        >
          <color attach="background" args={[C.fond]} />

          <Suspense fallback={null}>
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.55} />
          </Suspense>

          {/* Lighting: ambient + key + fill */}
          <ambientLight intensity={0.45} />
          <directionalLight
            position={[Bfoot * 3, Hstem * 4, wallL * 3]} intensity={1.5}
            castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048}
            shadow-bias={-0.0005}
            shadow-camera-left={-Bfoot * 2}  shadow-camera-right={Bfoot * 2}
            shadow-camera-top={Hstem * 2}    shadow-camera-bottom={-Hfoot * 3}
            shadow-camera-near={0.1} shadow-camera-far={Bfoot * 12}
          />
          <directionalLight position={[-Bfoot * 2, Hstem * 1.5, -wallL * 2]} intensity={0.5} />

          {/* ──────── CONCRETE — ghost (translucent) with gold edges ──────── */}
          <ConcreteFooting Bfoot={Bfoot} Hfoot={Hfoot} wallL={wallL} />
          <ConcreteStem
            xFront={xStemFront} xBack={xStemBack}
            xBackTop={xStemBackTop} xFrontTop={xStemFront}
            Hstem={Hstem} t_bot={t_bot} t_top={t_top} wallL={wallL}
          />

          {/* ──────── REBAR — protagonista ──────── */}
          <StemVerticalBars
            xRear={xStemBack} xFrontTop={xStemBackTop}
            Hstem={Hstem} Hfoot={Hfoot} wallL={wallL} cover={cover}
            db={stemVert.db * MM_TO_M} spacing={stemVert.spacing * MM_TO_M}
          />
          <StemHorizontalBars
            xFront={xStemFront} xBack={xStemBack}
            xFrontTop={xStemFront} xBackTop={xStemBackTop}
            Hstem={Hstem} wallL={wallL} cover={cover}
            db={stemHoriz.db * MM_TO_M} spacing={stemHoriz.spacing * MM_TO_M}
          />
          <FootingTopBars
            Bfoot={Bfoot} Hfoot={Hfoot} wallL={wallL} cover={cover}
            db={heelTop.db * MM_TO_M} spacing={heelTop.spacing * MM_TO_M}
          />
          <FootingBottomBars
            Bfoot={Bfoot} Hfoot={Hfoot} wallL={wallL} cover={cover}
            db={toeBot.db * MM_TO_M} spacing={toeBot.spacing * MM_TO_M}
          />
          <FootingLongitudinalBars
            Bfoot={Bfoot} Hfoot={Hfoot} wallL={wallL} cover={cover}
          />

          {/* ──────── CALLOUTS — Spanish structure labels ──────── */}
          <Callouts
            Bfoot={Bfoot} Hstem={Hstem} Hfoot={Hfoot} wallL={wallL}
            xStemFront={xStemFront}
          />

          {/* Contact shadow under the wall to ground the structure */}
          <ContactShadows position={[0, -Hfoot - 0.001, 0]}
            opacity={0.55} scale={Bfoot * 5} blur={2.2} far={3.5}
            resolution={1024} frames={1} smooth />

          <OrbitControls makeDefault enableDamping
            target={[0, Hstem / 4, 0]}
            maxPolarAngle={Math.PI / 2.05}
            minDistance={Bfoot * 0.5}
            maxDistance={Bfoot * 8}
          />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['#c9a84c', '#7fb691', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>

          {/* ──────── POST-PROCESSING — Bloom + ACES tone mapping ──────── */}
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.18} luminanceThreshold={0.82} luminanceSmoothing={0.7} mipmapBlur />
            <ToneMapping />
          </EffectComposer>
        </Canvas>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCRETE — ghost (translucent) with bold gold edges (TTC accent)

function ConcreteMaterial() {
  return (
    <meshPhysicalMaterial
      color={C.concrete}
      transparent
      opacity={0.22}
      roughness={0.55}
      metalness={0.0}
      transmission={0.35}
      thickness={0.4}
      ior={1.45}
      clearcoat={0.2}
      depthWrite={false}
      side={THREE.DoubleSide}
    />
  );
}

function ConcreteFooting({ Bfoot, Hfoot, wallL }: { Bfoot: number; Hfoot: number; wallL: number }) {
  return (
    <group position={[0, -Hfoot / 2, 0]}>
      <RoundedBox args={[Bfoot, Hfoot, wallL]} radius={0.012} smoothness={4} castShadow receiveShadow>
        <ConcreteMaterial />
        <Edges scale={1.001} threshold={20} color={C.edge} />
      </RoundedBox>
    </group>
  );
}

function ConcreteStem({
  xFront, xBack, xBackTop, xFrontTop, Hstem, t_bot, t_top, wallL,
}: {
  xFront: number; xBack: number; xBackTop: number; xFrontTop: number;
  Hstem: number; t_bot: number; t_top: number; wallL: number;
}) {
  const geometry = useMemo(() => {
    const halfZ = wallL / 2;
    const verts = new Float32Array([
      // bottom face (y = 0)
      xFront,    0, -halfZ,  xBack,    0, -halfZ,  xBack,    0,  halfZ,  xFront,    0,  halfZ,
      // top face (y = Hstem)
      xFrontTop, Hstem, -halfZ,  xBackTop, Hstem, -halfZ,
      xBackTop,  Hstem,  halfZ,  xFrontTop, Hstem,  halfZ,
    ]);
    const indices = [
      0, 1, 2,  0, 2, 3,                    // bottom
      4, 6, 5,  4, 7, 6,                    // top
      0, 4, 5,  0, 5, 1,                    // front (-z)
      3, 2, 6,  3, 6, 7,                    // back (+z)
      0, 3, 7,  0, 7, 4,                    // -x face
      1, 5, 6,  1, 6, 2,                    // +x face
    ];
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    void t_bot; void t_top;
    return geom;
  }, [xFront, xBack, xBackTop, xFrontTop, Hstem, wallL, t_bot, t_top]);
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <ConcreteMaterial />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geometry, 20]} />
        <lineBasicMaterial color={C.edge} linewidth={2} />
      </lineSegments>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REBAR — instanced cylinders, two materials so cages read at a glance.

function StemRebarMaterial() {
  return <meshStandardMaterial color={C.stemRebar} roughness={0.35} metalness={0.55}
                                emissive={C.stemRebar} emissiveIntensity={0.08} />;
}

function FootingRebarMaterial() {
  return <meshStandardMaterial color={C.footRebar} roughness={0.35} metalness={0.55}
                                emissive={C.footRebar} emissiveIntensity={0.08} />;
}

function LongitudinalRebarMaterial() {
  return <meshStandardMaterial color={C.longitRebar} roughness={0.35} metalness={0.6}
                                emissive={C.longitRebar} emissiveIntensity={0.05} />;
}

function StemVerticalBars({
  xRear, xFrontTop, Hstem, Hfoot, wallL, cover, db, spacing,
}: {
  xRear: number; xFrontTop: number;
  Hstem: number; Hfoot: number; wallL: number; cover: number;
  db: number; spacing: number;
}) {
  void xFrontTop;
  const bars = useMemo(() => {
    const out: { x: number; y: number; z: number; len: number }[] = [];
    const xBar = xRear - cover - db / 2;
    const len = Hstem + Hfoot * 0.6;          // extend down INTO the footing for development
    const yBar = -Hfoot * 0.6 + len / 2;       // centered: from -0.6·Hfoot to +Hstem
    const nBars = Math.max(2, Math.floor(wallL / spacing) + 1);
    const zStart = -wallL / 2 + cover * 2;
    const dz = (wallL - 4 * cover) / (nBars - 1);
    for (let i = 0; i < nBars; i++) {
      out.push({ x: xBar, y: yBar, z: zStart + i * dz, len });
    }
    return out;
  }, [xRear, Hstem, Hfoot, wallL, cover, db, spacing]);
  return (
    <Instances limit={500} castShadow receiveShadow>
      <cylinderGeometry args={[db / 2, db / 2, 1, 12]} />
      <StemRebarMaterial />
      {bars.map((b, i) => (
        <Instance key={i} position={[b.x, b.y, b.z]} scale={[1, b.len, 1]} />
      ))}
    </Instances>
  );
}

function StemHorizontalBars({
  xFront, xBack, xFrontTop, xBackTop, Hstem, wallL, cover, db, spacing,
}: {
  xFront: number; xBack: number; xFrontTop: number; xBackTop: number;
  Hstem: number; wallL: number; cover: number;
  db: number; spacing: number;
}) {
  const bars = useMemo(() => {
    const out: { x: number; y: number; z: number; len: number }[] = [];
    const nBars = Math.max(2, Math.floor(Hstem / spacing) + 1);
    const yStart = cover * 2;
    const dy = (Hstem - 3 * cover) / (nBars - 1);
    const len = wallL - 2 * cover;
    for (let i = 0; i < nBars; i++) {
      const y = yStart + i * dy;
      // Linear interpolation of stem face x at this height
      const t = y / Math.max(Hstem, 1e-6);
      const xF = xFront + (xFrontTop - xFront) * t;
      const xB = xBack + (xBackTop - xBack) * t;
      out.push({ x: xF + cover + db / 2, y, z: 0, len });
      out.push({ x: xB - cover - db / 2, y, z: 0, len });
    }
    return out;
  }, [xFront, xBack, xFrontTop, xBackTop, Hstem, wallL, cover, db, spacing]);
  return (
    <Instances limit={500} castShadow receiveShadow>
      <cylinderGeometry args={[db / 2, db / 2, 1, 12]} />
      <StemRebarMaterial />
      {bars.map((b, i) => (
        // Cylinder default axis = Y. Rotate around X by π/2 so the bar
        // runs along Z (the wall length).
        <Instance key={i} position={[b.x, b.y, b.z]} scale={[1, b.len, 1]}
                  rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </Instances>
  );
}

function FootingTopBars({
  Bfoot, Hfoot, wallL, cover, db, spacing,
}: {
  Bfoot: number; Hfoot: number; wallL: number; cover: number;
  db: number; spacing: number;
}) {
  const bars = useMemo(() => {
    const out: { x: number; y: number; z: number }[] = [];
    const len = Bfoot - 2 * cover;
    const y = -cover - db / 2; // top of footing minus cover
    const nBars = Math.max(2, Math.floor(wallL / spacing) + 1);
    const zStart = -wallL / 2 + cover * 2;
    const dz = (wallL - 4 * cover) / (nBars - 1);
    for (let i = 0; i < nBars; i++) {
      out.push({ x: 0, y, z: zStart + i * dz });
    }
    void Hfoot;
    return { out, len };
  }, [Bfoot, Hfoot, wallL, cover, db, spacing]);
  return (
    <Instances limit={400} castShadow receiveShadow>
      <cylinderGeometry args={[db / 2, db / 2, 1, 12]} />
      <FootingRebarMaterial />
      {bars.out.map((b, i) => (
        // Cylinder default axis = Y. Rotate around Z by π/2 so the bar
        // runs along X (across the footing).
        <Instance key={i} position={[b.x, b.y, b.z]} scale={[1, bars.len, 1]}
                  rotation={[0, 0, Math.PI / 2]} />
      ))}
    </Instances>
  );
}

function FootingBottomBars({
  Bfoot, Hfoot, wallL, cover, db, spacing,
}: {
  Bfoot: number; Hfoot: number; wallL: number; cover: number;
  db: number; spacing: number;
}) {
  const bars = useMemo(() => {
    const out: { x: number; y: number; z: number }[] = [];
    const len = Bfoot - 2 * cover;
    const y = -Hfoot + cover + db / 2;
    const nBars = Math.max(2, Math.floor(wallL / spacing) + 1);
    const zStart = -wallL / 2 + cover * 2;
    const dz = (wallL - 4 * cover) / (nBars - 1);
    for (let i = 0; i < nBars; i++) {
      out.push({ x: 0, y, z: zStart + i * dz });
    }
    return { out, len };
  }, [Bfoot, Hfoot, wallL, cover, db, spacing]);
  return (
    <Instances limit={400} castShadow receiveShadow>
      <cylinderGeometry args={[db / 2, db / 2, 1, 12]} />
      <FootingRebarMaterial />
      {bars.out.map((b, i) => (
        <Instance key={i} position={[b.x, b.y, b.z]} scale={[1, bars.len, 1]}
                  rotation={[0, 0, Math.PI / 2]} />
      ))}
    </Instances>
  );
}

function FootingLongitudinalBars({
  Bfoot, Hfoot, wallL, cover,
}: {
  Bfoot: number; Hfoot: number; wallL: number; cover: number;
}) {
  // Longitudinal distribution bars run along the wall length, top + bottom mat.
  const db = 0.013; // #4 default
  const spacing = 0.30;
  const bars = useMemo(() => {
    const out: { x: number; y: number; len: number }[] = [];
    const len = wallL - 2 * cover;
    const nBars = Math.max(2, Math.floor((Bfoot - 2 * cover) / spacing) + 1);
    const xStart = -Bfoot / 2 + cover * 2;
    const dx = (Bfoot - 4 * cover) / (nBars - 1);
    for (let i = 0; i < nBars; i++) {
      out.push({ x: xStart + i * dx, y: -cover - db / 2,            len }); // top mat
      out.push({ x: xStart + i * dx, y: -Hfoot + cover + db / 2,    len }); // bottom mat
    }
    return { out, len };
  }, [Bfoot, Hfoot, wallL, cover, db, spacing]);
  return (
    <Instances limit={400} castShadow receiveShadow>
      <cylinderGeometry args={[db / 2, db / 2, 1, 12]} />
      <LongitudinalRebarMaterial />
      {bars.out.map((b, i) => (
        <Instance key={i} position={[b.x, b.y, 0]} scale={[1, bars.len, 1]}
                  rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </Instances>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALLOUTS — Spanish structure labels (Fuste / Punta / Talón)

function Callouts({
  Bfoot, Hstem, Hfoot, wallL, xStemFront,
}: {
  Bfoot: number; Hstem: number; Hfoot: number; wallL: number;
  xStemFront: number;
}) {
  const fs = Math.max(Hstem, Bfoot) * 0.06;
  const z = wallL / 2 + 0.5;
  return (
    <group>
      <Text position={[xStemFront - 0.6, Hstem * 0.55, z]} fontSize={fs}
            color={C.callout} anchorX="right" anchorY="middle"
            outlineWidth={fs * 0.07} outlineColor={C.calloutBg}>
        Fuste
      </Text>
      <Text position={[+Bfoot / 2 + 0.4, -Hfoot / 2, z]} fontSize={fs * 0.85}
            color={C.callout} anchorX="left" anchorY="middle"
            outlineWidth={fs * 0.07} outlineColor={C.calloutBg}>
        Talón
      </Text>
      <Text position={[-Bfoot / 2 - 0.4, -Hfoot / 2, z]} fontSize={fs * 0.85}
            color={C.callout} anchorX="right" anchorY="middle"
            outlineWidth={fs * 0.07} outlineColor={C.calloutBg}>
        Punta
      </Text>
    </group>
  );
}
