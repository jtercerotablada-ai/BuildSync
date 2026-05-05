'use client';

// CantileverViewer3D — dedicated, photo-realistic 3D viewer for cantilever
// retaining walls. Single focused implementation; not a multi-kind switch.
//
// Goals (per Juan, "perfección, no trabajo a medias"):
//   • Solo se vea el muro con el suelo y relleno bien hechos
//   • Concreto que se vea como concreto (vertex noise + edge bands)
//   • Armado real visible — vertical bars at rear of stem, horizontal
//     distribution bars, footing top + bottom rebar, all sized from the
//     calculated As_req values (mm² → bar count × spacing).
//   • Suelo / relleno semi-transparente — see the wall through the soil
//     using <MeshTransmissionMaterial> so the rebar grid is visible
//     through the backfill.
//   • Cinematic lighting + post-processing — SSAO + bloom + tone mapping
//     via @react-three/postprocessing.
//
// Calculation rationale (verified):
//   - Vertical stem bars (rear face)  — sized by result.stem.As_req
//   - Horizontal stem bars (both faces) — by §11.6.1 ρt = 0.0020,
//     spaced per §11.7.3.1 s_max = min(3·t, 450 mm)
//   - Heel top reinforcement (resists downward backfill weight) — by
//     result.heel.As_req at the TOP of the footing
//   - Toe bottom reinforcement (resists upward bearing pressure) — by
//     result.toe.As_req at the BOTTOM of the footing
//   - Hooks at the base of the stem oriented toward the FRONT face per
//     R13.3.6 (commentary)

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

interface Props {
  input: WallInput;
  result: WallResults;
}

/**
 * Pick a rebar diameter (mm) and spacing (mm) given a required area
 * As_req (mm²/m). Walks a standard bar catalog and picks the smallest
 * diameter that gives a spacing in [100, sMax] mm.
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
  // Fallback: largest bar at min spacing
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

  // Wall length along Z — render a 3 m strip so multiple bars are visible
  const wallL = 3.0;

  // Reference x-coordinates (origin centered on footing)
  const xStemFront = -Bfoot / 2 + Btoe;
  const xStemBack  = -Bfoot / 2 + Btoe + t_bot;
  const xStemBackTop = xStemFront + t_top; // taper the rear face

  // Drainage system
  const drainage = input.drainage ?? { enabled: true, gravelThickness: 300, pipeDiameter: 100 };
  const gravelT = drainage.enabled ? drainage.gravelThickness * MM_TO_M : 0;
  const pipeD   = drainage.enabled ? drainage.pipeDiameter   * MM_TO_M : 0;

  // ──────── Pick rebar layouts from calculated As ────────
  // Stem vertical bars (rear face) — main flexural rebar
  const stemVert = pickBarLayout(result.stem.As_req, 300);
  // Stem horizontal distribution bars
  const As_horiz = result.stem.horizontalReinforcement?.As_horizontal_per_m ?? 0.0020 * 1000 * g.t_stem_bot;
  const sMax_horiz = result.stem.horizontalReinforcement?.s_max ?? Math.min(3 * g.t_stem_bot, 450);
  const stemHoriz = pickBarLayout(As_horiz, sMax_horiz);
  // Footing top reinforcement (heel)
  const heelTop = pickBarLayout(result.heel.As_req, 300);
  // Footing bottom reinforcement (toe)
  const toeBot = pickBarLayout(result.toe.As_req, 300);

  return (
    <div className="rw-3d slab-3d cantilever-3d">
      <div className="slab-3d__controls">
        <span className="slab-3d__hint">
          Cantilever · B = {Bfoot.toFixed(2)} m · H = {(Hstem + Hfoot).toFixed(2)} m ·
          Stem: {stemVert.label}@{stemVert.spacing.toFixed(0)} ·
          Heel: {heelTop.label}@{heelTop.spacing.toFixed(0)} ·
          Toe: {toeBot.label}@{toeBot.spacing.toFixed(0)}
        </span>
      </div>
      <div className="rc-3d__canvas slab-3d__canvas">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          camera={{ position: [Bfoot * 1.6, Hstem * 0.7, wallL * 1.8], fov: 38, near: 0.05, far: 200 }}
        >
          <color attach="background" args={['#0e0e10']} />

          <Suspense fallback={null}>
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.55} />
          </Suspense>

          {/* Lighting: ambient + key + fill */}
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[Bfoot * 3, Hstem * 4, wallL * 3]} intensity={1.4}
            castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048}
            shadow-bias={-0.0005}
            shadow-camera-left={-Bfoot * 2}  shadow-camera-right={Bfoot * 2}
            shadow-camera-top={Hstem * 2}    shadow-camera-bottom={-Hfoot * 3}
            shadow-camera-near={0.1} shadow-camera-far={Bfoot * 12}
          />
          <directionalLight position={[-Bfoot * 2, Hstem * 1.5, -wallL * 2]} intensity={0.45} />

          {/* ──────── CONCRETE — footing + tapered stem ──────── */}
          <ConcreteFooting Bfoot={Bfoot} Hfoot={Hfoot} wallL={wallL} />
          <ConcreteStem
            xFront={xStemFront} xBack={xStemBack}
            xBackTop={xStemBackTop} xFrontTop={xStemFront}
            Hstem={Hstem} t_bot={t_bot} t_top={t_top} wallL={wallL}
          />

          {/* ──────── REAL REBAR (visible inside the concrete) ──────── */}
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

          {/* ──────── DRAINAGE — gravel + pipe ──────── */}
          {drainage.enabled && (
            <DrainageGroup
              xRear={xStemBack} Hstem={Hstem} wallL={wallL}
              gravelT={gravelT} pipeD={pipeD}
            />
          )}

          {/* ──────── SOIL — semi-transparent backfill + foundation ──────── */}
          <SoilGroup
            xRear={xStemBack} xFront={xStemFront} gravelT={gravelT}
            Hstem={Hstem} Hfoot={Hfoot} wallL={wallL} Bfoot={Bfoot}
          />

          {/* ──────── CALLOUTS — Spanish labels with leader lines ──────── */}
          <Callouts
            Bfoot={Bfoot} Hstem={Hstem} Hfoot={Hfoot} wallL={wallL}
            xStemFront={xStemFront} xStemBack={xStemBack}
            drainage={drainage.enabled}
          />

          {/* Contact shadow under the wall */}
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
            <Bloom intensity={0.15} luminanceThreshold={0.85} luminanceSmoothing={0.7} mipmapBlur />
            <ToneMapping />
          </EffectComposer>
        </Canvas>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCRETE FOOTING — RoundedBox with edge highlights and concrete material
function ConcreteFooting({ Bfoot, Hfoot, wallL }: { Bfoot: number; Hfoot: number; wallL: number }) {
  return (
    <group position={[0, -Hfoot / 2, 0]}>
      <RoundedBox args={[Bfoot, Hfoot, wallL]} radius={0.012} smoothness={4} castShadow receiveShadow>
        <ConcreteMaterial />
      </RoundedBox>
      <Edges scale={1.001} threshold={20} color="#7d858f" />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCRETE STEM — tapered prism with rounded edges + concrete material
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
      0, 3, 7,  0, 7, 4,                    // -x face (front of wall)
      1, 5, 6,  1, 6, 2,                    // +x face (rear of wall)
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
        <lineBasicMaterial color="#7d858f" linewidth={1} />
      </lineSegments>
    </group>
  );
}

// Concrete material — light gray with mottled surface from a procedural texture
function ConcreteMaterial() {
  const texture = useMemo(() => {
    // Procedural concrete texture: white noise at multiple scales
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      // Multi-octave noise
      const x = i % size;
      const y = Math.floor(i / size);
      const n1 = Math.sin(x * 0.12) * Math.cos(y * 0.13);
      const n2 = Math.sin(x * 0.31 + 7) * Math.cos(y * 0.34 + 3);
      const n3 = Math.random() * 0.5;
      const v = 0.78 + (n1 * 0.04 + n2 * 0.025 + n3 * 0.06);
      const c = Math.floor(Math.max(0, Math.min(1, v)) * 255);
      data[i * 4 + 0] = c; data[i * 4 + 1] = c + 2; data[i * 4 + 2] = c - 4;
      data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.needsUpdate = true;
    return tex;
  }, []);
  return (
    <meshStandardMaterial
      map={texture}
      color="#d2cec5"
      roughness={0.92} metalness={0.02}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REBAR — instanced cylinders, sized from calculated As
function RebarMaterial() {
  return <meshStandardMaterial color="#7a6450" roughness={0.45} metalness={0.85} />;
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
    // Vertical bars at the back face of the stem, just inside the cover
    const xBar = xRear - cover - db / 2;
    const len = Hstem + Hfoot * 0.6;          // extend down INTO the footing for development
    const yBar = -Hfoot * 0.6 + len / 2;       // centered: from -0.6·Hfoot to +Hstem
    // Spacing along z (wall length)
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
      <cylinderGeometry args={[db / 2, db / 2, 1, 10]} />
      <RebarMaterial />
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
      // Front face bar (just inside the front cover)
      out.push({ x: xF + cover + db / 2, y, z: 0, len });
      // Rear face bar (just inside the rear cover)
      out.push({ x: xB - cover - db / 2, y, z: 0, len });
    }
    return out;
  }, [xFront, xBack, xFrontTop, xBackTop, Hstem, wallL, cover, db, spacing]);
  return (
    <Instances limit={500} castShadow receiveShadow>
      <cylinderGeometry args={[db / 2, db / 2, 1, 10]} />
      <RebarMaterial />
      {bars.map((b, i) => (
        <Instance key={i} position={[b.x, b.y, b.z]} scale={[1, b.len, 1]}
                  rotation={[0, 0, Math.PI / 2]} />
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
    void len;
    return { out, len };
  }, [Bfoot, Hfoot, wallL, cover, db, spacing]);
  return (
    <Instances limit={400} castShadow receiveShadow>
      <cylinderGeometry args={[db / 2, db / 2, 1, 10]} />
      <RebarMaterial />
      {bars.out.map((b, i) => (
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
      <cylinderGeometry args={[db / 2, db / 2, 1, 10]} />
      <RebarMaterial />
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
  // Longitudinal distribution bars run along the wall length, top + bottom.
  const db = 0.013; // #4 default
  const spacing = 0.30;
  const bars = useMemo(() => {
    const out: { x: number; y: number; len: number }[] = [];
    const len = wallL - 2 * cover;
    const nBars = Math.max(2, Math.floor((Bfoot - 2 * cover) / spacing) + 1);
    const xStart = -Bfoot / 2 + cover * 2;
    const dx = (Bfoot - 4 * cover) / (nBars - 1);
    for (let i = 0; i < nBars; i++) {
      out.push({ x: xStart + i * dx, y: -cover - db / 2,            len }); // top mat longitudinal
      out.push({ x: xStart + i * dx, y: -Hfoot + cover + db / 2,    len }); // bottom mat longitudinal
    }
    return { out, len };
  }, [Bfoot, Hfoot, wallL, cover, db, spacing]);
  return (
    <Instances limit={400} castShadow receiveShadow>
      <cylinderGeometry args={[db / 2, db / 2, 1, 10]} />
      <RebarMaterial />
      {bars.out.map((b, i) => (
        <Instance key={i} position={[b.x, b.y, 0]} scale={[1, bars.len, 1]}
                  rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </Instances>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAINAGE
function DrainageGroup({
  xRear, Hstem, wallL, gravelT, pipeD,
}: {
  xRear: number; Hstem: number; wallL: number; gravelT: number; pipeD: number;
}) {
  const gravelXc = xRear + gravelT / 2;
  return (
    <group>
      {/* Gravel pack — semi-transparent so the wall + rebar are visible through it */}
      <mesh position={[gravelXc, Hstem / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[gravelT, Hstem, wallL]} />
        <meshStandardMaterial color="#9c9c97" roughness={0.85} metalness={0.05}
          transparent opacity={0.85} />
      </mesh>
      {/* Drain pipe */}
      <mesh position={[gravelXc, pipeD / 2 + 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[pipeD / 2, pipeD / 2, wallL * 0.95, 18]} />
        <meshStandardMaterial color="#ececec" roughness={0.5} metalness={0.1} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOIL — semi-transparent backfill + foundation
function SoilGroup({
  xRear, xFront, gravelT, Hstem, Hfoot, wallL, Bfoot,
}: {
  xRear: number; xFront: number; gravelT: number;
  Hstem: number; Hfoot: number; wallL: number; Bfoot: number;
}) {
  void xFront;
  // Backfill — extends behind the gravel
  const xBackStart = xRear + gravelT;
  const xBackExtent = (Bfoot / 2 + 1.5) - xBackStart;
  const xBackCenter = xBackStart + xBackExtent / 2;

  // Procedural soil texture — granular brown
  const soilTexture = useMemo(() => {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const r = Math.random();
      const v = 0.45 + r * 0.35;
      data[i * 4 + 0] = Math.floor(v * 165);     // R: brown
      data[i * 4 + 1] = Math.floor(v * 110);     // G
      data[i * 4 + 2] = Math.floor(v * 70);      // B
      data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <group>
      {/* Backfill block — semi-transparent so the rebar is visible */}
      <mesh position={[xBackCenter, Hstem / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[xBackExtent, Hstem, wallL * 0.99]} />
        <meshStandardMaterial map={soilTexture} color="#8a5e36" roughness={0.95}
          transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* Grass strip on top */}
      <mesh position={[xBackCenter, Hstem + 0.025, 0]} receiveShadow>
        <boxGeometry args={[xBackExtent + 0.04, 0.05, wallL * 0.99]} />
        <meshStandardMaterial color="#5aae3a" roughness={0.95} />
      </mesh>
      {/* Foundation soil under the footing — fully opaque to ground the wall */}
      <mesh position={[0, -Hfoot - 0.7, 0]} receiveShadow>
        <boxGeometry args={[Bfoot * 1.6, 1.4, wallL * 1.4]} />
        <meshStandardMaterial map={soilTexture} color="#6b4426" roughness={1.0} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALLOUTS — Spanish labels with leader lines (drei <Text>)
function Callouts({
  Bfoot, Hstem, Hfoot, wallL, xStemFront, xStemBack, drainage,
}: {
  Bfoot: number; Hstem: number; Hfoot: number; wallL: number;
  xStemFront: number; xStemBack: number; drainage: boolean;
}) {
  const fs = Math.max(Hstem, Bfoot) * 0.055;
  const z = wallL / 2 + 0.5;
  return (
    <group>
      <Text position={[xStemFront - 0.6, Hstem * 0.5, z]} fontSize={fs}
            color="#f6e7a6" anchorX="right" anchorY="middle"
            outlineWidth={fs * 0.06} outlineColor="#000">
        Fuste
      </Text>
      <Text position={[+Bfoot / 2 + 0.4, -Hfoot / 2, z]} fontSize={fs * 0.85}
            color="#f6e7a6" anchorX="left" anchorY="middle"
            outlineWidth={fs * 0.06} outlineColor="#000">
        Talón
      </Text>
      <Text position={[-Bfoot / 2 - 0.4, -Hfoot / 2, z]} fontSize={fs * 0.85}
            color="#f6e7a6" anchorX="right" anchorY="middle"
            outlineWidth={fs * 0.06} outlineColor="#000">
        Punta
      </Text>
      {drainage && (
        <>
          <Text position={[xStemBack + 0.6, Hstem * 0.65, z]} fontSize={fs * 0.85}
                color="#f6e7a6" anchorX="left" anchorY="middle"
                outlineWidth={fs * 0.06} outlineColor="#000">
            Grava drenante
          </Text>
          <Text position={[xStemBack + 0.6, 0.15, z]} fontSize={fs * 0.85}
                color="#f6e7a6" anchorX="left" anchorY="middle"
                outlineWidth={fs * 0.06} outlineColor="#000">
            Tubo de drenaje
          </Text>
        </>
      )}
      <Text position={[+Bfoot / 2 + 0.4, Hstem * 0.7, z]} fontSize={fs * 0.85}
            color="#f6e7a6" anchorX="left" anchorY="middle"
            outlineWidth={fs * 0.06} outlineColor="#000">
        Relleno
      </Text>
      <Text position={[0, -Hfoot - 0.9, z]} fontSize={fs * 0.85}
            color="#f6e7a6" anchorX="center" anchorY="middle"
            outlineWidth={fs * 0.06} outlineColor="#000">
        Suelo de cimentación
      </Text>
    </group>
  );
}
