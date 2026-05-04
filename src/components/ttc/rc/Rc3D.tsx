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

          {/* Skin rebar (h > 900 mm, ACI §9.7.2.3) */}
          {showRebar && <SkinRebar input={input} bw={bw} h={h} L={L} cover={cover} />}

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
// Tension rebar (along the bottom) — placed INSIDE the stirrup inner envelope
// ============================================================================
function TensionRebar({ input, bw, h, L, cover }: {
  input: BeamInput; bw: number; h: number; L: number; cover: number;
}) {
  const total = input.reinforcement.tension.reduce((s, b) => s + b.count, 0);
  const dbT = (input.reinforcement.tension[0]?.bar
    ? lookupBar(input.reinforcement.tension[0].bar)?.db ?? 25 : 25) * MM_TO_M;
  const stirrupDb = (lookupBar(input.reinforcement.stirrup.bar)?.db ?? 10) * MM_TO_M;

  // Bar centerline must be at: (cover) + (stirrupDb) + (dbT/2) from outer face
  const y = -h / 2 + cover + stirrupDb + dbT / 2;
  // Centerline-to-centerline span across width
  const cToCSpan = bw - 2 * (cover + stirrupDb + dbT / 2);
  const sBars = total > 1 ? cToCSpan / (total - 1) : 0;
  const startZ = -cToCSpan / 2;

  return (
    <group>
      {Array.from({ length: total }, (_, i) => (
        <mesh key={i} position={[0, y, total === 1 ? 0 : startZ + i * sBars]}
              rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[dbT / 2, dbT / 2, L * 0.96, 12]} />
          <meshStandardMaterial color="#c94c4c" roughness={0.55} metalness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// Compression / hanger rebar (along the top) — INSIDE stirrup top inner edge
// ============================================================================
function CompressionRebar({ input, bw, L, cover }: {
  input: BeamInput; bw: number; L: number; cover: number;
}) {
  const totalC = (input.reinforcement.compression ?? []).reduce((s, b) => s + b.count, 0);
  const dbC = (input.reinforcement.compression?.[0]?.bar
    ? lookupBar(input.reinforcement.compression[0].bar)?.db ?? 20 : 20) * MM_TO_M;
  const stirrupDb = (lookupBar(input.reinforcement.stirrup.bar)?.db ?? 10) * MM_TO_M;

  const y = input.geometry.h * MM_TO_M / 2 - cover - stirrupDb - dbC / 2;
  const cToCSpan = bw - 2 * (cover + stirrupDb + dbC / 2);
  const sBars = totalC > 1 ? cToCSpan / (totalC - 1) : 0;
  const startZ = -cToCSpan / 2;

  return (
    <group>
      {Array.from({ length: totalC }, (_, i) => (
        <mesh key={i} position={[0, y, totalC === 1 ? 0 : startZ + i * sBars]}
              rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[dbC / 2, dbC / 2, L * 0.96, 12]} />
          <meshStandardMaterial color="#e0c060" roughness={0.55} metalness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// Skin rebar (h > 900 mm) — inside both vertical stirrup legs
// ============================================================================
function SkinRebar({ input, bw, h, L, cover }: {
  input: BeamInput; bw: number; h: number; L: number; cover: number;
}) {
  const sk = input.reinforcement.skin;
  if (!sk || sk.countPerFace === 0) return null;
  const dbS = (lookupBar(sk.bar)?.db ?? 12) * MM_TO_M;
  const stirrupDb = (lookupBar(input.reinforcement.stirrup.bar)?.db ?? 10) * MM_TO_M;
  // z position: just inside the stirrup vertical legs
  const zL = -bw / 2 + cover + stirrupDb + dbS / 2;
  const zR = bw / 2 - cover - stirrupDb - dbS / 2;
  // Skin bars distributed over h/2 from tension face up
  const yBot = -h / 2 + cover + stirrupDb + (input.reinforcement.tension[0]
    ? (lookupBar(input.reinforcement.tension[0].bar)?.db ?? 25) * MM_TO_M : 0) + 0.05;
  const yTop = 0;     // up to mid-height (h/2 from tension face)
  const span = Math.max(yTop - yBot, 0.001);
  const dy = sk.countPerFace > 1 ? span / (sk.countPerFace - 1) : 0;

  return (
    <group>
      {Array.from({ length: sk.countPerFace }, (_, i) => (
        <React.Fragment key={i}>
          <mesh position={[0, yBot + i * dy, zL]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[dbS / 2, dbS / 2, L * 0.96, 10]} />
            <meshStandardMaterial color="#5fa3c9" roughness={0.55} metalness={0.85} />
          </mesh>
          <mesh position={[0, yBot + i * dy, zR]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[dbS / 2, dbS / 2, L * 0.96, 10]} />
            <meshStandardMaterial color="#5fa3c9" roughness={0.55} metalness={0.85} />
          </mesh>
        </React.Fragment>
      ))}
    </group>
  );
}

// ============================================================================
// Stirrup 3D — CLEAN CLOSED-LOOP design (NO hooks in 3D).
//
// Design rationale: at the scale of the beam 3D viewer (a 6 m beam with 30+
// stirrups), trying to render the 135° hooks at the closing corner produces
// visual artifacts (hooks colliding with longitudinal bars, weird perspective).
//
// Professional structural engineering software (CYPECAD, ETABS, RAM Concept,
// Tekla Structures) ALL render stirrups in the beam-level 3D as clean closed
// hoops. The hook geometry detail belongs to the 2D bar bending schedule and
// the cross-section detail drawing — both of which we already render correctly
// (see RcSection2D and the Detailing tab bar schedule).
//
// Implementation: ONE TubeGeometry with a closed perimeter path, rendered via
// THREE.InstancedMesh for all stirrup positions along the beam. A procedural
// normal map adds rebar ribs to the tube surface.
// ============================================================================

function makeRebarNormalMap(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const W = 128, H = 64;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // Neutral normal (RGB 128, 128, 255 → flat surface pointing +Z)
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, W, H);
  // Diagonal helical ribs — alternating bright (rib peak) and dark (groove)
  ctx.lineCap = 'round';
  for (let i = -W; i < W * 2; i += 14) {
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#aaaaff';   // brighter normal: rib peak (raised)
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + H * 1.5, H);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#5060ff';   // darker normal: groove
    ctx.beginPath();
    ctx.moveTo(i + 7, 0); ctx.lineTo(i + 7 + H * 1.5, H);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Curve subclass that samples a manually-built polyline at uniform t along arc length.
class PolylineCurve extends THREE.Curve<THREE.Vector3> {
  private pts: THREE.Vector3[];
  private cumLen: number[];     // cumulative arc length up to point i
  private total: number;
  constructor(pts: THREE.Vector3[]) {
    super();
    this.pts = pts;
    this.cumLen = [0];
    for (let i = 1; i < pts.length; i++) {
      this.cumLen.push(this.cumLen[i - 1] + pts[i].distanceTo(pts[i - 1]));
    }
    this.total = this.cumLen[this.cumLen.length - 1] || 1;
  }
  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const target_d = t * this.total;
    // Binary search for the segment containing target_d
    let lo = 0, hi = this.cumLen.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cumLen[mid] <= target_d) lo = mid;
      else hi = mid;
    }
    const segLen = this.cumLen[hi] - this.cumLen[lo] || 1;
    const local = (target_d - this.cumLen[lo]) / segLen;
    return target.lerpVectors(this.pts[lo], this.pts[hi], local);
  }
}

// Build a closed-rectangle path with smooth rounded corners (in the YZ plane,
// X = 0). The bar comes back to its starting point, so the TubeGeometry is
// rendered with closed=true to produce a continuous loop without seams.
function buildClosedStirrupPath(
  cy: number, cz: number, r: number
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const v = (y: number, z: number) => pts.push(new THREE.Vector3(0, y, z));

  // Top edge: from (cy, -cz+r) right to (cy, cz-r)
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    v(cy, (-cz + r) + 2 * (cz - r) * t);
  }
  // Top-right corner arc (PI/2 → 0)
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const a = Math.PI / 2 - t * Math.PI / 2;
    v((cy - r) + r * Math.sin(a), (cz - r) + r * Math.cos(a));
  }
  // Right edge: from (cy-r, cz) down to (-cy+r, cz)
  for (let i = 0; i < 60; i++) {
    const t = i / 60;
    v((cy - r) - 2 * (cy - r) * t, cz);
  }
  // Bottom-right corner arc (0 → -PI/2)
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const a = -t * Math.PI / 2;
    v((-cy + r) + r * Math.sin(a), (cz - r) + r * Math.cos(a));
  }
  // Bottom edge: from (-cy, cz-r) left to (-cy, -cz+r)
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    v(-cy, (cz - r) - 2 * (cz - r) * t);
  }
  // Bottom-left corner arc (-PI/2 → -PI)
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const a = -Math.PI / 2 - t * Math.PI / 2;
    v((-cy + r) + r * Math.sin(a), (-cz + r) + r * Math.cos(a));
  }
  // Left edge: from (-cy+r, -cz) up to (cy-r, -cz)
  for (let i = 0; i < 60; i++) {
    const t = i / 60;
    v((-cy + r) + 2 * (cy - r) * t, -cz);
  }
  // Top-left corner arc (-PI → -3PI/2)
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const a = -Math.PI - t * Math.PI / 2;
    v((cy - r) + r * Math.sin(a), (-cz + r) + r * Math.cos(a));
  }

  return pts;
}

// ============================================================================
// Stirrups — INSTANCED MESH along the beam length.
//
// One closed-loop tube geometry is generated once and reused at every stirrup
// position via THREE.InstancedMesh. This is the same technique used by
// professional structural-engineering 3D tools to render reinforcement at
// scale efficiently.
// ============================================================================
function Stirrups({ input, bw, h, L, cover }: {
  input: BeamInput; bw: number; h: number; L: number; cover: number;
}) {
  const stirrupDb = (lookupBar(input.reinforcement.stirrup.bar)?.db ?? 10) * MM_TO_M;
  const sSpacing = input.reinforcement.stirrup.spacing * MM_TO_M;

  // Build the unit-stirrup geometry (one closed loop, in the YZ plane at X=0)
  const tubeGeom = useMemo(() => {
    const cz = bw / 2 - cover - stirrupDb / 2;
    const cy = h / 2 - cover - stirrupDb / 2;
    const r = Math.min(2.5 * stirrupDb, Math.min(cy, cz) * 0.4);
    const visRadius = (stirrupDb / 2) * 1.65;
    const pts = buildClosedStirrupPath(cy, cz, r);
    const curve = new PolylineCurve(pts);
    // closed=true → tube end joins back to start (clean seamless loop)
    return new THREE.TubeGeometry(curve, 320, visRadius, 12, true);
  }, [bw, h, cover, stirrupDb]);

  const ribsTexture = useMemo(() => makeRebarNormalMap(), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#5aa86c',
    roughness: 0.55,
    metalness: 0.75,
    normalMap: ribsTexture ?? undefined,
    normalScale: ribsTexture ? new THREE.Vector2(0.8, 0.8) : undefined,
  }), [ribsTexture]);

  // Stirrup positions along the beam length
  const positions = useMemo(() => {
    const xs: number[] = [];
    const startX = -L / 2 + cover;
    const n = Math.max(2, Math.floor(L / sSpacing) + 1);
    for (let i = 0; i < n; i++) {
      const x = startX + i * sSpacing;
      if (x > L / 2 - cover) break;
      xs.push(x);
    }
    return xs;
  }, [L, cover, sSpacing]);

  // Configure the InstancedMesh once positions/geometry change
  const meshRef = React.useRef<THREE.InstancedMesh | null>(null);
  React.useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const tmp = new THREE.Object3D();
    positions.forEach((x, i) => {
      tmp.position.set(x, 0, 0);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[tubeGeom, material, positions.length]}
      castShadow
      receiveShadow
    />
  );
}

// ============================================================================
// Load arrows (UDL representation) — placed entirely ABOVE the beam top face,
// arrowhead tip touching the concrete (not piercing it).
// ============================================================================
function LoadArrows({ L, h }: { L: number; h: number }) {
  const arrows = useMemo(() => {
    const items: React.ReactElement[] = [];
    const n = 9;
    const startX = -L / 2 + L * 0.1;
    const span = L * 0.8;
    const topY = h / 2;          // beam top face
    const headHeight = 0.08;     // cone height
    const stemLen = 0.40;        // stem length

    // Arrowhead: tip at topY (just above), base at topY + headHeight
    // ConeGeometry default points +Y. Rotation [Math.PI, 0, 0] flips it to point -Y.
    // After rotation, cone's tip is at -headHeight/2 from cone center.
    // To put tip exactly at topY, cone center must be at topY + headHeight/2.
    const headCenterY = topY + headHeight / 2 + 0.005;     // tiny offset to avoid z-fighting
    // Stem: cylinder extends UP from arrowhead base. Base at headCenterY + headHeight/2.
    const stemBottomY = headCenterY + headHeight / 2;
    const stemCenterY = stemBottomY + stemLen / 2;

    for (let i = 0; i <= n; i++) {
      const x = startX + (i / n) * span;
      items.push(
        <group key={i}>
          {/* Stem (cylinder, vertical) */}
          <mesh position={[x, stemCenterY, 0]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, stemLen, 10]} />
            <meshStandardMaterial color="#e25b5b" emissive="#c94c4c" emissiveIntensity={0.5} />
          </mesh>
          {/* Arrowhead (cone pointing down) */}
          <mesh position={[x, headCenterY, 0]} rotation={[Math.PI, 0, 0]} castShadow>
            <coneGeometry args={[0.022, headHeight, 14]} />
            <meshStandardMaterial color="#e25b5b" emissive="#c94c4c" emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
    }
    return items;
  }, [L, h]);
  return <group>{arrows}</group>;
}
