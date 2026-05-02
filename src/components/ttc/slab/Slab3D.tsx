'use client';

import React, { Suspense, useMemo, useState, useEffect } from 'react';
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
import { buildContours, colorFor, type ContourField } from '@/lib/slab/contour';
import { BAR_CATALOG, type SlabAnalysis, type SlabInput } from '@/lib/slab/types';

type Field = 'concrete' | 'Mx' | 'My' | 'Asx' | 'Asy' | 'deflection';

interface Props {
  result: SlabAnalysis;
  input: SlabInput;
}

// ============================================================================
// Module-level: rib normal map for rebar (created once)
// ============================================================================
let _ribNormalMap: THREE.Texture | null = null;
function getRibNormal(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (_ribNormalMap) return _ribNormalMap;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8080ff'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 4) {
    g.fillStyle = i % 8 === 0 ? '#9090ff' : '#7070ff';
    g.fillRect(0, i, 64, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 1);
  _ribNormalMap = t;
  return t;
}

// ============================================================================
// Main component
// ============================================================================
export function Slab3D({ result, input }: Props) {
  const [field, setField] = useState<Field>('concrete');
  const [showRebar, setShowRebar] = useState(true);
  const [showDeformed, setShowDeformed] = useState(false);
  const [exaggeration, setExaggeration] = useState(50);
  const [cutaway, setCutaway] = useState(true);

  const Lx = result.geometry.Lx;
  const Ly = result.geometry.Ly;
  const h = result.geometry.h / 1000;
  const camDist = Math.max(Lx, Ly) * 1.55;

  return (
    <div className="slab-3d">
      <div className="slab-3d__controls">
        <div className="slab-contour__tabs">
          {([
            ['concrete',   'Concrete'],
            ['Mx',         'Mx'],
            ['My',         'My'],
            ['Asx',        'As (x)'],
            ['Asy',        'As (y)'],
            ['deflection', 'Deflection'],
          ] as const).map(([k, label]) => (
            <button key={k} type="button"
              className={`slab-contour__tab ${k === field ? 'slab-contour__tab--active' : ''}`}
              onClick={() => setField(k as Field)}>{label}</button>
          ))}
        </div>
        <label className="ab-toggle"><input type="checkbox" checked={showRebar}
          onChange={(e) => setShowRebar(e.target.checked)} /> <span>Rebar</span></label>
        <label className="ab-toggle"><input type="checkbox" checked={cutaway}
          onChange={(e) => setCutaway(e.target.checked)} /> <span>Cutaway slab</span></label>
        <label className="ab-toggle"><input type="checkbox" checked={showDeformed}
          onChange={(e) => setShowDeformed(e.target.checked)} /> <span>Deformed</span></label>
        <label className="slab-3d__slider">
          <span>Δ scale ×{exaggeration}</span>
          <input type="range" min="1" max="200" step="1" value={exaggeration}
            disabled={!showDeformed}
            onChange={(e) => setExaggeration(parseInt(e.target.value))} />
        </label>
      </div>
      <div className="slab-3d__canvas">
        <Canvas
          shadows
          camera={{ position: [camDist, camDist * 0.85, camDist], fov: 38, near: 0.05, far: 200 }}
          gl={{ antialias: true, preserveDrawingBuffer: false }}
        >
          <color attach="background" args={['#0a0a0a']} />

          <Suspense fallback={null}>
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.18} />
          </Suspense>

          {/* Lighting — soft fill + a single muted key light, no harsh specular */}
          <ambientLight intensity={0.55} />
          <directionalLight position={[Lx * 2, Lx * 3, Lx * 2]} intensity={0.55} castShadow
            shadow-mapSize-width={1024} shadow-mapSize-height={1024}
            shadow-bias={-0.0005}
          />
          <directionalLight position={[-Lx, Lx * 1.4, -Lx]} intensity={0.18} />

          <Suspense fallback={null}>
            <SlabPlate result={result} field={field}
              showDeformed={showDeformed} exaggeration={exaggeration} cutaway={cutaway} />
          </Suspense>

          {showRebar && <RebarLayout result={result} input={input} />}

          {result.punching && input.punching && (
            <ColumnAssembly result={result} input={input} cutaway={cutaway} />
          )}

          {/* Soft contact shadow under the slab */}
          <ContactShadows
            position={[Lx / 2, -h - 0.01, Ly / 2]}
            opacity={0.55}
            scale={Math.max(Lx, Ly) * 2.5}
            blur={2.4}
            far={3}
            resolution={1024}
            frames={1}
            smooth
          />

          {/* Floor grid */}
          <Grid
            args={[Lx * 6, Ly * 6]}
            cellSize={0.5} cellThickness={0.45}
            cellColor="#3a3320" sectionSize={1}
            sectionThickness={0.9} sectionColor="#5a4f30"
            fadeDistance={Math.max(Lx, Ly) * 8} fadeStrength={1.4}
            position={[Lx / 2, -h - 0.012, Ly / 2]}
            infiniteGrid={false}
          />

          <OrbitControls makeDefault enableDamping
            target={[Lx / 2, -h / 2, Ly / 2]}
            maxDistance={Math.max(Lx, Ly) * 8}
            minDistance={Math.max(Lx, Ly) * 0.4}
            maxPolarAngle={Math.PI / 2 - 0.02} />
          <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
            <GizmoViewport axisColors={['#c9a84c', '#5fb674', '#4a90c9']} labelColor="#fff" />
          </GizmoHelper>

          <Suspense fallback={null}>
            <DimensionLabels Lx={Lx} Ly={Ly} h={result.geometry.h} />
          </Suspense>
        </Canvas>
      </div>
      <p className="slab-3d__hint">
        Drag to rotate · scroll to zoom · right-click drag to pan · toggle Cutaway to see the rebar through the concrete
      </p>
    </div>
  );
}

// ============================================================================
// Slab plate — concrete or vertex-colored field, with optional deformation
// ============================================================================
function SlabPlate({ result, field, showDeformed, exaggeration, cutaway }:
  { result: SlabAnalysis; field: Field; showDeformed: boolean; exaggeration: number; cutaway: boolean }) {

  const Lx = result.geometry.Lx;
  const Ly = result.geometry.Ly;
  const h = result.geometry.h / 1000;
  const isConcrete = field === 'concrete';

  const contours = useMemo(() => buildContours(result), [result]);
  const deflectionGrid = useMemo(() => buildDeflectionGrid(result), [result]);
  const maxDef = useMemo(
    () => Math.max(...deflectionGrid.flat().map(Math.abs), 1e-9),
    [deflectionGrid],
  );

  const activeField: ContourField = field === 'Mx' ? contours.Mx
    : field === 'My' ? contours.My
    : field === 'Asx' ? contours.Asx
    : field === 'Asy' ? contours.Asy
    : field === 'deflection' ? {
        xs: contours.Mx.xs, ys: contours.Mx.ys, values: deflectionGrid,
        vmin: -maxDef, vmax: maxDef, label: 'Deflection', unit: 'mm',
      }
    : contours.Mx;
  const isSigned = field === 'Mx' || field === 'My' || field === 'deflection';

  // Geometry rebuilt whenever inputs change. Cleanup on unmount.
  // Top surface lifted 2mm above the body's top face so the two coplanar
  // meshes don't z-fight when rotating (especially in cutaway/transparent).
  const TOP_LIFT = 0.002;
  const geometry = useMemo(() => {
    const SEG = 60;
    const geo = new THREE.PlaneGeometry(Lx, Ly, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    geo.translate(Lx / 2, TOP_LIFT, Ly / 2);
    const pos = geo.attributes.position;
    const colors = new THREE.Float32BufferAttribute(new Float32Array(pos.count * 3), 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Deformation
      const dy = sampleField({
        xs: contours.Mx.xs, ys: contours.Mx.ys, values: deflectionGrid,
        vmin: -maxDef, vmax: maxDef, label: '', unit: '',
      }, x, z, Lx, Ly);
      pos.setY(i, (showDeformed ? -dy / 1000 : 0) * (exaggeration * 0.04));

      if (isConcrete) {
        // subtle off-white concrete with low-frequency noise
        const noise = 0.05 * (Math.sin(x * 7) * Math.cos(z * 9) * 0.5 + 0.5);
        c.setRGB(0.83 - noise * 0.10, 0.81 - noise * 0.10, 0.78 - noise * 0.10);
      } else {
        const v = sampleField(activeField, x, z, Lx, Ly);
        const hex = colorFor(v, activeField.vmin, activeField.vmax, isSigned);
        c.setStyle(hex);
      }
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    geo.setAttribute('color', colors);
    geo.computeVertexNormals();
    return geo;
  }, [Lx, Ly, isConcrete, activeField, isSigned, showDeformed, exaggeration, deflectionGrid, maxDef, contours.Mx.xs, contours.Mx.ys]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      {/* Top deformed surface — colored by selected field. Matte concrete look
          using MeshStandardMaterial (no clearcoat) so reflections don't flash
          across the surface as the camera rotates. */}
      <mesh geometry={geometry} castShadow receiveShadow renderOrder={1}>
        <meshStandardMaterial vertexColors
          side={THREE.FrontSide}
          roughness={isConcrete ? 0.95 : 0.7}
          metalness={0.0}
          envMapIntensity={isConcrete ? 0.15 : 0.25}
          transparent={cutaway} opacity={cutaway ? 0.30 : 1.0}
          depthWrite={!cutaway}
          polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>

      {/* Slab body — concrete-coloured box. Top face shifted 4mm DOWN so the
          painted top surface above doesn't z-fight with the box's +y face. */}
      <mesh position={[Lx / 2, -h / 2 - 0.002, Ly / 2]} castShadow receiveShadow>
        <boxGeometry args={[Lx, h - 0.004, Ly]} />
        <meshStandardMaterial color="#cdc8bf" roughness={0.95} metalness={0.0}
          envMapIntensity={0.15}
          transparent={cutaway} opacity={cutaway ? 0.18 : 1.0}
          depthWrite={!cutaway}
          side={THREE.FrontSide} />
      </mesh>

      {/* Gold edge rims */}
      <EdgeBand Lx={Lx} Ly={Ly} h={h} />
    </group>
  );
}

function EdgeBand({ Lx, Ly, h }: { Lx: number; Ly: number; h: number }) {
  const w = 0.018;
  const gold = '#c9a84c';
  return (
    <group>
      <mesh position={[Lx / 2, w / 2, 0]}><boxGeometry args={[Lx, w, w]} /><meshStandardMaterial color={gold} metalness={0.55} roughness={0.4} /></mesh>
      <mesh position={[Lx / 2, w / 2, Ly]}><boxGeometry args={[Lx, w, w]} /><meshStandardMaterial color={gold} metalness={0.55} roughness={0.4} /></mesh>
      <mesh position={[0, w / 2, Ly / 2]}><boxGeometry args={[w, w, Ly]} /><meshStandardMaterial color={gold} metalness={0.55} roughness={0.4} /></mesh>
      <mesh position={[Lx, w / 2, Ly / 2]}><boxGeometry args={[w, w, Ly]} /><meshStandardMaterial color={gold} metalness={0.55} roughness={0.4} /></mesh>
      <mesh position={[Lx / 2, -h - w / 2, 0]}><boxGeometry args={[Lx, w, w]} /><meshStandardMaterial color={gold} metalness={0.55} roughness={0.4} /></mesh>
      <mesh position={[Lx / 2, -h - w / 2, Ly]}><boxGeometry args={[Lx, w, w]} /><meshStandardMaterial color={gold} metalness={0.55} roughness={0.4} /></mesh>
      <mesh position={[0, -h - w / 2, Ly / 2]}><boxGeometry args={[w, w, Ly]} /><meshStandardMaterial color={gold} metalness={0.55} roughness={0.4} /></mesh>
      <mesh position={[Lx, -h - w / 2, Ly / 2]}><boxGeometry args={[w, w, Ly]} /><meshStandardMaterial color={gold} metalness={0.55} roughness={0.4} /></mesh>
    </group>
  );
}

// ============================================================================
// Rebar — straight bars and bars with 90° hooks via CatmullRomCurve3 + TubeGeometry
// ============================================================================
function buildRebarPath(start: THREE.Vector3, end: THREE.Vector3, db: number, hookLen: number, hookEnds: 'none' | 'start' | 'end' | 'both'): THREE.CatmullRomCurve3 {
  const dir = new THREE.Vector3().subVectors(end, start).normalize();
  const r = 4 * db;          // bend radius (ACI §25.3)
  const inset = r;
  const sStart = start.clone().add(dir.clone().multiplyScalar(inset));
  const sEnd = end.clone().sub(dir.clone().multiplyScalar(inset));
  const pts: THREE.Vector3[] = [];
  if (hookEnds === 'start' || hookEnds === 'both') {
    const tip = start.clone().add(new THREE.Vector3(0, -hookLen, 0));
    pts.push(tip, start.clone().add(new THREE.Vector3(0, -r, 0)), sStart);
  } else pts.push(start);
  pts.push(sEnd);
  if (hookEnds === 'end' || hookEnds === 'both') {
    const tip = end.clone().add(new THREE.Vector3(0, -hookLen, 0));
    pts.push(end.clone().add(new THREE.Vector3(0, -r, 0)), tip);
  } else pts.push(end);
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.0);
}

function Rebar({ start, end, db, color, hookEnds = 'none', hookLen }:
  { start: [number, number, number]; end: [number, number, number];
    db: number; color: string; hookEnds?: 'none' | 'start' | 'end' | 'both';
    hookLen?: number }) {
  const geo = useMemo(() => {
    if (hookEnds === 'none') {
      // Straight bar — fast path with raw cylinder
      const dir = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
      const len = dir.length();
      const g = new THREE.CylinderGeometry(db / 2, db / 2, len, 12);
      // Cylinder is along Y; rotate to direction
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      m.compose(new THREE.Vector3((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2), q, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      return g;
    }
    const curve = buildRebarPath(
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
      db,
      hookLen ?? 12 * db,        // 12·db hook length per ACI §25.3
      hookEnds,
    );
    const segments = Math.max(40, Math.ceil(curve.getLength() * 60));
    return new THREE.TubeGeometry(curve, segments, db / 2, 10, false);
  }, [start, end, db, hookEnds, hookLen]);
  useEffect(() => () => geo.dispose(), [geo]);

  const ribNormal = getRibNormal();

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        metalness={0.35}
        roughness={0.65}
        envMapIntensity={0.25}
        normalMap={ribNormal ?? undefined}
        normalScale={ribNormal ? new THREE.Vector2(0.3, 0.3) : undefined}
      />
    </mesh>
  );
}

function RebarLayout({ result, input }: { result: SlabAnalysis; input: SlabInput }) {
  const Lx = result.geometry.Lx;
  const Ly = result.geometry.Ly;
  const h = result.geometry.h / 1000;

  const midX = result.reinforcement.find((r) => r.location === 'mid-x');
  const midY = result.reinforcement.find((r) => r.location === 'mid-y');
  const supX = result.reinforcement.find((r) => r.location === 'sup-x');
  const supY = result.reinforcement.find((r) => r.location === 'sup-y');

  const dbOf = (label?: string): number => {
    if (!label) return 12;
    const bar = BAR_CATALOG.find((b) => b.label === label);
    return bar ? bar.db : 12;
  };

  const bars: React.ReactElement[] = [];
  const bottomCoverY_x = (result.geometry.cover_bottom_x ?? 25) / 1000;
  const bottomCoverY_y = (result.geometry.cover_bottom_y ?? 35) / 1000;
  const topCoverY_x = (result.geometry.cover_top_x ?? 25) / 1000;
  const topCoverY_y = (result.geometry.cover_top_y ?? 35) / 1000;

  // Bottom-x bars — RED, parallel to x
  if (midX) {
    const sp = midX.spacing / 1000;
    const db_x = dbOf(midX.bar) / 1000;
    const yPos = -h + bottomCoverY_x + db_x / 2;
    let n = 0;
    for (let z = sp / 2; z < Ly && n < 200; z += sp, n++) {
      bars.push(
        <Rebar key={`bx-${z.toFixed(3)}`}
          start={[0.04, yPos, z]} end={[Lx - 0.04, yPos, z]}
          db={db_x} color="#c94c4c" />,
      );
    }
  }

  // Bottom-y bars — BLUE, parallel to y, stacked above x layer
  if (midY) {
    const sp = midY.spacing / 1000;
    const db_y = dbOf(midY.bar) / 1000;
    const yPos = -h + bottomCoverY_y + dbOf(midX?.bar) / 1000 + db_y / 2 + 0.001;
    let n = 0;
    for (let x = sp / 2; x < Lx && n < 200; x += sp, n++) {
      bars.push(
        <Rebar key={`by-${x.toFixed(3)}`}
          start={[x, yPos, 0.04]} end={[x, yPos, Ly - 0.04]}
          db={db_y} color="#4a90c9" />,
      );
    }
  }

  // Top-x bars — GOLD with 90° hooks pointing down (hook length = 12·db)
  if (supX && Math.abs(result.moments.Mx_neg) > 0.1) {
    const sp = supX.spacing / 1000;
    const db_tx = dbOf(supX.bar) / 1000;
    const yPos = -topCoverY_x - db_tx / 2;
    const stripWidth = Math.min(Ly / 4, 1.5);
    for (const zCenter of [stripWidth / 2, Ly - stripWidth / 2]) {
      let n = 0;
      for (let z = zCenter - stripWidth / 2 + sp / 2; z < zCenter + stripWidth / 2 && n < 60; z += sp, n++) {
        bars.push(
          <Rebar key={`tx-${zCenter.toFixed(2)}-${z.toFixed(3)}`}
            start={[0.04, yPos, z]} end={[Lx - 0.04, yPos, z]}
            db={db_tx} color="#e0c060"
            hookEnds="both" hookLen={Math.max(12 * db_tx, h * 0.6)} />,
        );
      }
    }
  }

  // Top-y bars — GREEN
  if (supY && Math.abs(result.moments.My_neg) > 0.1) {
    const sp = supY.spacing / 1000;
    const db_ty = dbOf(supY.bar) / 1000;
    const yPos = -topCoverY_y - db_ty / 2 - dbOf(supX?.bar) / 1000 - 0.002;
    const stripWidth = Math.min(Lx / 4, 1.5);
    for (const xCenter of [stripWidth / 2, Lx - stripWidth / 2]) {
      let n = 0;
      for (let x = xCenter - stripWidth / 2 + sp / 2; x < xCenter + stripWidth / 2 && n < 60; x += sp, n++) {
        bars.push(
          <Rebar key={`ty-${xCenter.toFixed(2)}-${x.toFixed(3)}`}
            start={[x, yPos, 0.04]} end={[x, yPos, Ly - 0.04]}
            db={db_ty} color="#5fb674"
            hookEnds="both" hookLen={Math.max(12 * db_ty, h * 0.6)} />,
        );
      }
    }
  }

  // ── TOP REINFORCEMENT OVER COLUMN (concentrated, both directions) ──
  // Per ACI §8.7.2.3 / §8.10.5: at slab-column joint, concentrate column-strip
  // negative moment reinforcement in a strip of width c + 2·1.5h on each side.
  // Use the SAME bar size and TIGHTER spacing (~ s/2) of the supX/supY layout
  // so the concentration is visually obvious.
  if (input.punching && (midX || supX) && (midY || supY)) {
    const inp = input.punching;
    const c1 = inp.c1 / 1000;
    const c2 = (inp.c2 ?? inp.c1) / 1000;
    let cx = Lx / 2, cz = Ly / 2;
    if (inp.position === 'edge')   cz = 0;
    if (inp.position === 'corner') { cx = 0; cz = 0; }

    // Strip width per direction: column dim + 2 · 1.5h, capped to panel
    const stripX = Math.min(c1 + 2 * 1.5 * h, Lx);     // along x (top bars run x)
    const stripY = Math.min(c2 + 2 * 1.5 * h, Ly);     // along y (top bars run y)

    // Use the support spacing if defined, else half of mid spacing for concentration
    const refSupX = supX ?? midX;
    const refSupY = supY ?? midY;
    const db_cx = (refSupX ? dbOf(refSupX.bar) : 16) / 1000;
    const db_cy = (refSupY ? dbOf(refSupY.bar) : 16) / 1000;
    const sp_cx = (refSupX ? refSupX.spacing : 150) / 1000;
    const sp_cy = (refSupY ? refSupY.spacing : 150) / 1000;
    const yPosX = -topCoverY_x - db_cx / 2;
    const yPosY = -topCoverY_y - db_cy / 2 - db_cx - 0.002;

    // Top-x over column (run in x direction, spaced in z near column)
    const z0 = Math.max(0, cz - stripY / 2);
    const z1 = Math.min(Ly, cz + stripY / 2);
    let n = 0;
    for (let z = z0 + sp_cx / 2; z < z1 && n < 40; z += sp_cx, n++) {
      bars.push(
        <Rebar key={`colTopX-${z.toFixed(3)}`}
          start={[0.04, yPosX, z]} end={[Lx - 0.04, yPosX, z]}
          db={db_cx} color="#e0c060"
          hookEnds="both" hookLen={Math.max(12 * db_cx, h * 0.6)} />,
      );
    }
    // Top-y over column (run in y direction, spaced in x near column)
    const x0 = Math.max(0, cx - stripX / 2);
    const x1 = Math.min(Lx, cx + stripX / 2);
    n = 0;
    for (let x = x0 + sp_cy / 2; x < x1 && n < 40; x += sp_cy, n++) {
      bars.push(
        <Rebar key={`colTopY-${x.toFixed(3)}`}
          start={[x, yPosY, 0.04]} end={[x, yPosY, Ly - 0.04]}
          db={db_cy} color="#5fb674"
          hookEnds="both" hookLen={Math.max(12 * db_cy, h * 0.6)} />,
      );
    }
  }

  return <group>{bars}</group>;
}

// ============================================================================
// Column + drop panel + stud rails (ACI 421.1R-20 mushroom-headed studs)
// ============================================================================
function ColumnAssembly({ result, input, cutaway }: { result: SlabAnalysis; input: SlabInput; cutaway: boolean }) {
  const Lx = result.geometry.Lx;
  const Ly = result.geometry.Ly;
  const h = result.geometry.h / 1000;
  const inp = input.punching!;
  const c1 = inp.c1 / 1000;
  const c2 = (inp.c2 ?? inp.c1) / 1000;
  const colHeight = Math.max(Lx, Ly) * 0.7;

  let cx = Lx / 2, cz = Ly / 2;
  if (inp.position === 'edge')   cz = 0;
  if (inp.position === 'corner') { cx = 0; cz = 0; }

  return (
    <group>
      <mesh position={[cx, -h - colHeight / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[c1, colHeight, c2]} />
        <meshPhysicalMaterial color="#a8a397" roughness={0.85} metalness={0.0}
          clearcoat={0.12} clearcoatRoughness={0.7} />
      </mesh>
      {result.punching?.dropPanel && (
        <mesh position={[cx, -h - result.punching.dropPanel.thickness / 1000 / 2, cz]} castShadow receiveShadow>
          <boxGeometry args={[
            result.punching.dropPanel.size / 1000,
            result.punching.dropPanel.thickness / 1000,
            result.punching.dropPanel.size / 1000,
          ]} />
          <meshPhysicalMaterial color="#b8b1a3" roughness={0.88} metalness={0.0}
            clearcoat={0.12} transparent={cutaway} opacity={cutaway ? 0.55 : 1.0} />
        </mesh>
      )}
      {result.punching?.studRail && (
        <StudRails cx={cx} cz={cz} h={h}
          numRails={result.punching.studRail.numRails}
          rows={result.punching.studRail.rows}
          spacing={result.punching.studRail.spacing / 1000}
          studDb={result.punching.studRail.studDiameter / 1000}
          c1={c1} c2={c2} />
      )}
      {inp.Vu > 0 && (
        <ForceArrow x={cx} y={Math.max(Lx, Ly) * 0.42} z={cz} Vu={inp.Vu} h={h} />
      )}
    </group>
  );
}

function StudRails({ cx, cz, h, numRails, rows, spacing, studDb, c1, c2 }:
  { cx: number; cz: number; h: number; numRails: number; rows: number; spacing: number;
    studDb: number; c1: number; c2: number }) {
  const r = studDb / 2;
  const headR = studDb * 1.6;        // mushroom head ~ 2.5·db diameter total
  const headT = studDb * 0.8;        // disc thickness
  const startOffset = Math.max(c1, c2) / 2 + spacing / 2;
  const items: React.ReactElement[] = [];

  for (let i = 0; i < numRails; i++) {
    const ang = (i / numRails) * Math.PI * 2;
    const dx = Math.cos(ang); const dz = Math.sin(ang);
    for (let k = 0; k < rows; k++) {
      const dist = startOffset + k * spacing;
      const sx = cx + dx * dist; const sz = cz + dz * dist;
      items.push(
        <group key={`stud-${i}-${k}`} position={[sx, 0, sz]}>
          {/* Shaft (full slab depth) */}
          <mesh position={[0, -h / 2, 0]} castShadow>
            <cylinderGeometry args={[r, r, h, 14]} />
            <meshPhysicalMaterial color="#aaa" metalness={0.85} roughness={0.32} clearcoat={0.5} />
          </mesh>
          {/* Top mushroom head */}
          <mesh position={[0, -headT / 2, 0]} castShadow>
            <cylinderGeometry args={[headR, headR, headT, 18]} />
            <meshPhysicalMaterial color="#999" metalness={0.85} roughness={0.32} clearcoat={0.5} />
          </mesh>
          {/* Bottom mushroom head */}
          <mesh position={[0, -h + headT / 2, 0]} castShadow>
            <cylinderGeometry args={[headR, headR, headT, 18]} />
            <meshPhysicalMaterial color="#999" metalness={0.85} roughness={0.32} clearcoat={0.5} />
          </mesh>
        </group>,
      );
    }
  }
  return <group>{items}</group>;
}

function ForceArrow({ x, y, z, Vu, h }:
  { x: number; y: number; z: number; Vu: number; h: number }) {
  // Anchored: tip just above the slab top, shaft extending up by 'y' units.
  // Proportions: shaft = thin tube, head = wider cone (~3× shaft radius).
  const shaftR = 0.022;
  const headR = 0.085;
  const headLen = 0.22;
  const shaftLen = Math.max(0.4, y - headLen);
  const tipY = 0.005;             // 5 mm above slab top
  return (
    <group position={[x, 0, z]}>
      {/* Glowing arrow shaft (cylinder) */}
      <mesh position={[0, tipY + headLen + shaftLen / 2, 0]} castShadow>
        <cylinderGeometry args={[shaftR, shaftR, shaftLen, 16]} />
        <meshStandardMaterial color="#ff5050" emissive="#a02020" emissiveIntensity={0.6}
          roughness={0.35} metalness={0.2} />
      </mesh>
      {/* Cone head pointing DOWN at the slab/column */}
      <mesh position={[0, tipY + headLen / 2, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[headR, headLen, 24]} />
        <meshStandardMaterial color="#ff5050" emissive="#c02020" emissiveIntensity={0.65}
          roughness={0.3} metalness={0.25} />
      </mesh>
      {/* Bright disc at the tip (where the load 'enters' the slab) */}
      <mesh position={[0, tipY - 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[headR * 0.6, headR * 1.2, 32]} />
        <meshStandardMaterial color="#ff7a3a" emissive="#ff4422" emissiveIntensity={0.8}
          side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      {/* Label with high-contrast outline */}
      <Text position={[headR + 0.05, tipY + headLen + shaftLen + 0.08, 0]}
        fontSize={0.26} color="#ffd6c8" anchorX="left" anchorY="middle"
        outlineWidth={0.012} outlineColor="#1a0b07"
        material-toneMapped={false}>
        {`Vu = ${Vu.toFixed(0)} kN`}
      </Text>
      {/* Sub-label */}
      <Text position={[headR + 0.05, tipY + headLen + shaftLen + 0.06 - 0.16, 0]}
        fontSize={0.13} color="#ff8a72" anchorX="left" anchorY="middle"
        outlineWidth={0.007} outlineColor="#1a0b07"
        material-toneMapped={false}>
        column reaction
      </Text>
      {/* Subtle vertical 'load shadow' below the arrow (a thin glow line continuing under) */}
      <mesh position={[0, -h - 0.05, 0]}>
        <cylinderGeometry args={[shaftR * 0.5, shaftR * 0.5, h * 0.3, 12]} />
        <meshBasicMaterial color="#a02020" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

// ============================================================================
// Dimension labels
// ============================================================================
function DimensionLabels({ Lx, Ly, h }: { Lx: number; Ly: number; h: number }) {
  const fs = Math.max(0.18, Math.min(Lx, Ly) / 22);
  return (
    <group>
      <Text position={[Lx / 2, -h / 2 - 0.5, Ly + 0.55]} fontSize={fs} color="#c9a84c"
        anchorX="center" outlineWidth={0.005} outlineColor="#000">
        {`Lx = ${Lx.toFixed(2)} m`}
      </Text>
      <Text position={[Lx + 0.55, -h / 2 - 0.5, Ly / 2]} fontSize={fs} color="#c9a84c"
        anchorX="center" rotation={[0, -Math.PI / 2, 0]}
        outlineWidth={0.005} outlineColor="#000">
        {`Ly = ${Ly.toFixed(2)} m`}
      </Text>
      <Text position={[Lx + 0.7, -h / 2, 0]} fontSize={fs * 0.85} color="#c9a84c"
        anchorX="left" outlineWidth={0.005} outlineColor="#000">
        {`h = ${h * 1000} mm`}
      </Text>
    </group>
  );
}

// ============================================================================
// Helpers
// ============================================================================
function sampleField(field: ContourField, x: number, z: number, Lx: number, Ly: number): number {
  const fx = Math.max(0, Math.min(1, x / Lx));
  const fy = Math.max(0, Math.min(1, z / Ly));
  const nx = field.xs.length;
  const ny = field.ys.length;
  const ix = Math.min(nx - 2, Math.floor(fx * (nx - 1)));
  const iy = Math.min(ny - 2, Math.floor(fy * (ny - 1)));
  const tx = fx * (nx - 1) - ix;
  const ty = fy * (ny - 1) - iy;
  const v00 = field.values[ix][iy];
  const v10 = field.values[ix + 1][iy];
  const v01 = field.values[ix][iy + 1];
  const v11 = field.values[ix + 1][iy + 1];
  const v0 = v00 * (1 - tx) + v10 * tx;
  const v1 = v01 * (1 - tx) + v11 * tx;
  return v0 * (1 - ty) + v1 * ty;
}

function buildDeflectionGrid(result: SlabAnalysis): number[][] {
  const NX = 41, NY = 41;
  const dMax = Math.abs(result.deflection.delta_immediate ?? 0);
  const sign = -1;
  const grid: number[][] = [];
  for (let i = 0; i < NX; i++) {
    const row: number[] = [];
    const tx = i / (NX - 1);
    const sx = Math.sin(Math.PI * tx);
    for (let j = 0; j < NY; j++) {
      const ty = j / (NY - 1);
      const sy = Math.sin(Math.PI * ty);
      row.push(sign * dMax * sx * sy);
    }
    grid.push(row);
  }
  return grid;
}

// (drei <Instances>/<Instance> reserved for if we need 1000+ rebars later.)
void Instances; void Instance;
