'use client';

import React, { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Grid, GizmoHelper, GizmoViewport, ContactShadows, Environment,
} from '@react-three/drei';
import * as THREE from 'three';
import warehouseHDR from '@pmndrs/assets/hdri/warehouse.exr';
import type { BeamInput, BeamAnalysis, DemandSource } from '@/lib/rc/types';
import { lookupBar } from '@/lib/rc/types';

const MM_TO_M = 0.001;

interface Props {
  input: BeamInput;
  result: BeamAnalysis;
  /** Optional — when present, the 3D viewer renders the FULL multi-span beam
   *  with COLUMNS at each support location (column-beam-column-beam-column).
   *  Without this, the viewer renders a single beam segment as before. */
  demand?: DemandSource;
}

export function Rc3D({ input, result, demand }: Props) {
  const [cutaway, setCutaway] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [showStirrups, setShowStirrups] = useState(true);
  const [showLoad, setShowLoad] = useState(true);
  const [showColumns, setShowColumns] = useState(true);
  void result;

  // For continuous beams: extract support locations (in mm from left end) and
  // total beam length. Each support gets a column rendered above/below the beam.
  const isContinuous = demand?.kind === 'continuous';
  const supportXs_mm: number[] = isContinuous && demand
    ? (() => {
        const out: number[] = [0];
        let off = 0;
        for (const sp of demand.model.spans) { off += sp.L; out.push(off); }
        return out;
      })()
    : [0, input.geometry.L];     // single-span: 2 columns (left + right ends)
  const supportTypes: string[] = isContinuous && demand
    ? demand.model.supports
    : ['pin', 'roller'];

  const g = input.geometry;
  const bw = g.bw * MM_TO_M;
  const h = g.h * MM_TO_M;
  const L = g.L * MM_TO_M;
  const cover = g.coverClear * MM_TO_M;
  const bf = (g.bf ?? g.bw) * MM_TO_M;
  const hf = (g.hf ?? 0) * MM_TO_M;

  const camDist = Math.max(L, bw * 4) * 1.5;

  // ── Shared PBR material for all reinforcement bars (steel / oxidized rust look) ──
  const rebarMaterial = useMemo(() => {
    const normal = makeRebarNormalMap();
    const rough = makeRebarRoughnessMap();
    if (normal) { normal.repeat.set(60, 1); }
    if (rough) { rough.repeat.set(60, 1); }
    return new THREE.MeshPhysicalMaterial({
      color: '#7a6450',          // dark steel with warm rust tint
      roughness: 0.6,
      metalness: 0.85,
      clearcoat: 0.15,            // very subtle clearcoat — slight mill scale gloss
      clearcoatRoughness: 0.7,
      normalMap: normal ?? undefined,
      normalScale: normal ? new THREE.Vector2(1.0, 1.0) : undefined,
      roughnessMap: rough ?? undefined,
    });
  }, []);
  const rebarStirrupMaterial = useMemo(() => {
    const m = rebarMaterial.clone();
    m.color = new THREE.Color('#5e5040');     // slightly darker for visual distinction
    return m;
  }, [rebarMaterial]);

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
          <label className="ab-toggle"><input type="checkbox" checked={showColumns}
            onChange={(e) => setShowColumns(e.target.checked)} />
            <span>{isContinuous ? 'Columns at supports' : 'Support columns'}</span>
          </label>
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
            <Environment files={warehouseHDR} background={false} environmentIntensity={0.55} />
          </Suspense>
          <ambientLight intensity={0.4} />
          <directionalLight position={[L, h * 4, bw * 4]} intensity={0.7} castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0005} />
          <directionalLight position={[-L / 2, h * 3, -bw * 2]} intensity={0.25} />

          {/* Beam concrete (centered on Y=0 axis, length along X) */}
          <BeamConcrete bw={bw} h={h} L={L} bf={bf} hf={hf}
                        shape={g.shape} cutaway={cutaway} />

          {/* Columns at each support — column-beam-column-beam-column for
              continuous beams; left+right end columns for single-span. */}
          {showColumns && (
            <SupportColumns
              supportXs_mm={supportXs_mm}
              supportTypes={supportTypes}
              beamLengthTotal_m={L}
              bw={bw}
              h={h}
              cutaway={cutaway}
            />
          )}

          {/* Layered rebar — Phase 6: when reinforcement.layers is present
              (continuous-beam mode), render each layer at its proper xStart/
              xEnd / position. Otherwise fall back to legacy tension /
              compression / skin rendering. */}
          {showRebar && (input.reinforcement.layers?.length ?? 0) > 0 ? (
            <LayeredRebar input={input} bw={bw} h={h} L={L} cover={cover} mat={rebarMaterial} />
          ) : (
            <>
              {/* Tension rebar */}
              {showRebar && <TensionRebar input={input} bw={bw} h={h} L={L} cover={cover} mat={rebarMaterial} />}
              {/* Compression rebar */}
              {showRebar && (input.reinforcement.compression?.length ?? 0) > 0 && (
                <CompressionRebar input={input} bw={bw} L={L} cover={cover} mat={rebarMaterial} />
              )}
              {/* Skin rebar (h > 900 mm, ACI §9.7.2.3) */}
              {showRebar && <SkinRebar input={input} bw={bw} h={h} L={L} cover={cover} mat={rebarMaterial} />}
            </>
          )}

          {/* Stirrups */}
          {showStirrups && <Stirrups input={input} bw={bw} h={h} L={L} cover={cover} mat={rebarStirrupMaterial} />}

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
// ============================================================================
// Support columns (Phase 6.1) — render columns at each support location so
// continuous beams look like the real frame: column → beam → column → beam.
// ============================================================================
//
// Convention:
//   • Columns are 1.2× the beam web width (square cross-section), height
//     1.5 m above + 1.5 m below the beam to suggest a typical floor.
//   • Pin / roller / fix → solid concrete column. Free → no column.
//   • Color matches the beam concrete for a unified look.
//   • Origin: beam X coords are translated so x=0 is the LEFT support and
//     x=Ltotal is the RIGHT support. The beam itself is centered on (Lt/2),
//     so columns at support i sit at (supportX_mm/1000 - Lt/2) on the X
//     axis.
//
function SupportColumns({
  supportXs_mm, supportTypes, beamLengthTotal_m, bw, h, cutaway,
}: {
  supportXs_mm: number[];
  supportTypes: string[];
  beamLengthTotal_m: number;
  bw: number;
  h: number;
  cutaway: boolean;
}) {
  const opacity = cutaway ? 0.85 : 1.0;
  // Column cross-section: square, slightly bigger than beam web
  const colSize = bw * 1.2;
  // Column height above and below beam (typical 1 floor each direction)
  const colAbove = 1.5;        // 1.5 m above beam top
  const colBelow = 1.5;        // 1.5 m below beam bottom

  return (
    <group>
      {supportXs_mm.map((x_mm, i) => {
        const supType = supportTypes[i] ?? 'roller';
        if (supType === 'free') return null;        // cantilever end — no column

        const xLocal = (x_mm * MM_TO_M) - beamLengthTotal_m / 2;
        const colHeight = colAbove + h + colBelow;
        const colCenterY = (colAbove - colBelow) / 2;     // adjusted so column extends evenly

        return (
          <group key={`sup-${i}`} position={[xLocal, colCenterY, 0]}>
            {/* Column above + below the beam */}
            <mesh receiveShadow castShadow>
              <boxGeometry args={[colSize, colHeight, colSize]} />
              <meshStandardMaterial
                color="#9a9286"
                roughness={0.92}
                metalness={0.0}
                transparent={cutaway}
                opacity={opacity}
                depthWrite={!cutaway}
                side={cutaway ? THREE.DoubleSide : THREE.FrontSide}
              />
            </mesh>
            {/* Visual support indicator: triangular plate at column base */}
            <mesh position={[0, -colHeight / 2 - 0.05, 0]}>
              <coneGeometry args={[colSize * 0.45, 0.1, 4]} />
              <meshStandardMaterial color="#5a4f30" roughness={0.95} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

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
          color="#a8a39a" roughness={0.95} metalness={0.0}
          transparent={cutaway} opacity={opacity}
          depthWrite={!cutaway} side={cutaway ? THREE.DoubleSide : THREE.FrontSide} />
      </mesh>
    );
  }
  // T-beam, L-beam, inverted-T — each rendered as flange + web boxes
  // Top of beam = +h/2, bottom = -h/2 in local frame
  if (shape === 'inverted-T') {
    // Flange at the BOTTOM, web on top (centered)
    return (
      <group>
        <mesh position={[0, -h / 2 + hf / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[L, hf, bf]} />
          <meshStandardMaterial color="#cdc8bf" roughness={0.92} metalness={0.0}
            transparent={cutaway} opacity={opacity}
            depthWrite={!cutaway} side={cutaway ? THREE.DoubleSide : THREE.FrontSide} />
        </mesh>
        <mesh position={[0, hf / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[L, h - hf, bw]} />
          <meshStandardMaterial color="#cdc8bf" roughness={0.92} metalness={0.0}
            transparent={cutaway} opacity={opacity}
            depthWrite={!cutaway} side={cutaway ? THREE.DoubleSide : THREE.FrontSide} />
        </mesh>
      </group>
    );
  }
  if (shape === 'L-beam') {
    // Asymmetric: flange extends only to one side (-Z direction) of the web.
    // Web is centered on Z=0. Flange sits flush on +Z edge of web and extends in +Z.
    // Effective flange width = bf, web width = bw → flange overhang = bf - bw
    const overhang = Math.max(bf - bw, 0);
    const flangeZcenter = bw / 2 + overhang / 2;       // flange shifted to +Z side
    return (
      <group>
        <mesh position={[0, h / 2 - hf / 2, flangeZcenter]} receiveShadow castShadow>
          <boxGeometry args={[L, hf, overhang]} />
          <meshStandardMaterial color="#cdc8bf" roughness={0.92} metalness={0.0}
            transparent={cutaway} opacity={opacity}
            depthWrite={!cutaway} side={cutaway ? THREE.DoubleSide : THREE.FrontSide} />
        </mesh>
        <mesh position={[0, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[L, h, bw]} />
          <meshStandardMaterial color="#cdc8bf" roughness={0.92} metalness={0.0}
            transparent={cutaway} opacity={opacity}
            depthWrite={!cutaway} side={cutaway ? THREE.DoubleSide : THREE.FrontSide} />
        </mesh>
      </group>
    );
  }
  // Default: T-beam — flange on top, web below, both centered
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
// ============================================================================
// Layered rebar (Phase 6) — render each layer with its xStart/xEnd
// ============================================================================
//
// Beam frame in 3D:
//   X = beam length (along beam axis), origin at midspan
//   Y = beam height (positive = up), origin at mid-height
//   Z = beam width, origin at midwidth
//
// xStart/xEnd in Reinforcement.layers are in mm from LEFT support. Convert
// to local X by subtracting L_total/2 and dividing by 1000 (m).
//
function LayeredRebar({ input, bw, h, L, cover, mat }: {
  input: BeamInput; bw: number; h: number; L: number; cover: number;
  mat: THREE.Material;
}) {
  const layers = input.reinforcement.layers ?? [];
  if (layers.length === 0) return null;

  const stirrupDb = (lookupBar(input.reinforcement.stirrup.bar)?.db ?? 9.5) * MM_TO_M;
  const Ltot_m = L;          // L is already in m here (L = g.L * MM_TO_M)
  void cover;

  return (
    <group>
      {layers.map((layer, layerIdx) => {
        const dbBar = (lookupBar(layer.bar)?.db ?? 25) * MM_TO_M;
        const layerLen_m = (layer.xEnd - layer.xStart) / 1000;
        const xStart_m = layer.xStart / 1000;
        const xCenter_m = xStart_m + layerLen_m / 2 - Ltot_m / 2;     // local X (origin at mid-beam)

        // Y position: top vs bottom face
        // For 'top': y = h/2 - topBotDistance (measure DOWN from top face)
        // For 'bottom': y = -h/2 + topBotDistance (measure UP from bottom face)
        const topBotDistance_m = layer.topBotDistance / 1000;
        const yPos = layer.position === 'top'
          ? h / 2 - topBotDistance_m
          : -h / 2 + topBotDistance_m;

        // Distribute bars across width (between stirrup inner faces)
        const innerWidth = bw - 2 * (cover + stirrupDb + dbBar);
        const dx = layer.count > 1 ? innerWidth / (layer.count - 1) : 0;
        const xLeft = -innerWidth / 2;       // Z coordinate (across width)

        return (
          <group key={`layer-${layerIdx}`}>
            {Array.from({ length: layer.count }, (_, i) => {
              const zPos = layer.count === 1 ? 0 : xLeft + i * dx;
              return (
                <mesh
                  key={`bar-${layerIdx}-${i}`}
                  position={[xCenter_m, yPos, zPos]}
                  rotation={[0, 0, Math.PI / 2]}
                  material={mat}
                  castShadow
                  receiveShadow
                >
                  <cylinderGeometry args={[dbBar / 2, dbBar / 2, layerLen_m, 16]} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function TensionRebar({ input, bw, h, L, cover, mat }: {
  input: BeamInput; bw: number; h: number; L: number; cover: number;
  mat: THREE.Material;
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
              rotation={[0, 0, Math.PI / 2]} castShadow material={mat}>
          <cylinderGeometry args={[dbT / 2, dbT / 2, L * 0.96, 12]} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// Compression / hanger rebar (along the top) — INSIDE stirrup top inner edge
// ============================================================================
function CompressionRebar({ input, bw, L, cover, mat }: {
  input: BeamInput; bw: number; L: number; cover: number;
  mat: THREE.Material;
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
              rotation={[0, 0, Math.PI / 2]} castShadow material={mat}>
          <cylinderGeometry args={[dbC / 2, dbC / 2, L * 0.96, 12]} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// Skin rebar (h > 900 mm) — inside both vertical stirrup legs
// ============================================================================
function SkinRebar({ input, bw, h, L, cover, mat }: {
  input: BeamInput; bw: number; h: number; L: number; cover: number;
  mat: THREE.Material;
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
          <mesh position={[0, yBot + i * dy, zL]} rotation={[0, 0, Math.PI / 2]} castShadow material={mat}>
            <cylinderGeometry args={[dbS / 2, dbS / 2, L * 0.96, 10]} />
          </mesh>
          <mesh position={[0, yBot + i * dy, zR]} rotation={[0, 0, Math.PI / 2]} castShadow material={mat}>
            <cylinderGeometry args={[dbS / 2, dbS / 2, L * 0.96, 10]} />
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
// Established structural-engineering software typically renders stirrups in
// the beam-level 3D as clean closed hoops. The hook geometry detail belongs
// to the 2D bar bending schedule and the cross-section detail drawing — both
// of which we already render correctly (see RcSection2D and the Detailing
// tab bar schedule).
//
// Implementation: ONE TubeGeometry with a closed perimeter path, rendered via
// THREE.InstancedMesh for all stirrup positions along the beam. A procedural
// normal map adds rebar ribs to the tube surface.
// ============================================================================

function makeRebarNormalMap(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const W = 256, H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // Neutral normal background
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, W, H);
  // Helical ribs — paired ridges with a transverse rib pattern, like real ASTM A615 rebar
  ctx.lineCap = 'round';
  // Diagonal ribs (every direction)
  for (let i = -W; i < W * 2; i += 18) {
    // Rib body — a soft gradient from groove to peak to groove
    const grad = ctx.createLinearGradient(i, 0, i + H * 1.5, H);
    grad.addColorStop(0, '#7080ff');
    grad.addColorStop(0.5, '#a0a8ff');
    grad.addColorStop(1, '#7080ff');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + H * 1.5, H);
    ctx.stroke();
    // Sharp peak highlight
    ctx.strokeStyle = '#b8c0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + H * 1.5, H);
    ctx.stroke();
  }
  // Two longitudinal "running" ridges on opposite sides (real rebar has these)
  ctx.fillStyle = '#9098ff';
  ctx.fillRect(0, H * 0.10, W, 3);
  ctx.fillRect(0, H * 0.90, W, 3);
  ctx.fillStyle = '#aab0ff';
  ctx.fillRect(0, H * 0.10 + 1, W, 1);
  ctx.fillRect(0, H * 0.90 + 1, W, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function makeRebarRoughnessMap(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const W = 256, H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // Slightly varying roughness for real-steel oxidation feel
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const v = 110 + Math.random() * 40;
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
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

// ============================================================================
// Build the centerline of ONE continuous bent rebar that traces a closed
// rectangular stirrup with two 135° hooks at the closing corner (top-right).
//
// Path: hook1 line (X=-ε) → bend1 arc 135° (X transitions -ε → 0)
//       → top edge (X=0) → TL corner 90° → left edge → BL corner 90°
//       → bottom edge → BR corner 90° → right edge
//       → bend2 arc 135° (X transitions 0 → +ε) → hook2 line (X=+ε).
//
// Bend1 and bend2 are 135° circular arcs centered at the same point as the
// rectangle's TR corner-curve center: (cy-r, cz-r). The arc parameterization
// is point(θ) = (Cy + r·sinθ, Cz + r·cosθ); θ=0 at right-edge entry,
// θ=π/2 at top-edge entry, θ=-π/4 at hook1 entry, θ=3π/4 at hook2 exit.
//
// X transitions during the bends use a smoothstep so the two hooks emerge
// at distinctly different depths (one in front, one behind).
// ============================================================================
function buildStirrupWithHooks(
  cy: number, cz: number, r: number, stirrupDb: number
): THREE.Vector3[] {
  const hookLen = Math.max(6 * stirrupDb, 0.075);
  const c = 1 / Math.SQRT2;
  const eps = 0.65 * stirrupDb;            // depth offset between front and back hooks

  // TR corner-curve center (also the center for both 135° hook bends)
  const Cy = cy - r;
  const Cz = cz - r;

  // Bend1 START: θ = -π/4 (point above-and-outside TR corner)
  const bend1_start_y = Cy + r * Math.sin(-Math.PI / 4);     // = cy - r - r/√2
  const bend1_start_z = Cz + r * Math.cos(-Math.PI / 4);     // = cz - r + r/√2
  // Hook1 inner end: continue tangent direction (-Y, -Z)/√2 from bend1_start by hookLen
  const h1_inner_y = bend1_start_y - hookLen * c;
  const h1_inner_z = bend1_start_z - hookLen * c;

  // Bend2 END: θ = 3π/4 (point below-and-outside TR corner)
  const bend2_end_y = Cy + r * Math.sin(3 * Math.PI / 4);    // = cy - r + r/√2
  const bend2_end_z = Cz + r * Math.cos(3 * Math.PI / 4);    // = cz - r - r/√2
  // Hook2 inner end: continue tangent direction (-Y, -Z)/√2 from bend2_end by hookLen
  const h2_inner_y = bend2_end_y - hookLen * c;
  const h2_inner_z = bend2_end_z - hookLen * c;

  const pts: THREE.Vector3[] = [];
  const push = (x: number, y: number, z: number) => pts.push(new THREE.Vector3(x, y, z));
  // Smoothstep for X transitions during bends
  const smooth = (t: number) => t * t * (3 - 2 * t);

  // ── 1. HOOK 1 LINE (X = -ε): from inner end up-right toward bend1 start ──
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    push(-eps, h1_inner_y + (bend1_start_y - h1_inner_y) * t,
              h1_inner_z + (bend1_start_z - h1_inner_z) * t);
  }

  // ── 2. BEND 1: 135° arc, θ from -π/4 to π/2; X transitions -ε → 0 ──
  for (let i = 1; i <= 36; i++) {
    const t = i / 36;
    const theta = -Math.PI / 4 + t * (3 * Math.PI / 4);
    const y = Cy + r * Math.sin(theta);
    const z = Cz + r * Math.cos(theta);
    const x = -eps * (1 - smooth(t));
    push(x, y, z);
  }

  // ── 3. TOP EDGE (X = 0) ───────────────────────────────────────────────
  for (let i = 1; i <= 36; i++) {
    const t = i / 36;
    push(0, cy, (cz - r) - 2 * (cz - r) * t);
  }

  // ── 4. TL CORNER (90° arc, θ from π/2 to π around (cy-r, -cz+r)) ──────
  {
    const TLCy = cy - r, TLCz = -cz + r;
    for (let i = 1; i <= 18; i++) {
      const t = i / 18;
      const theta = Math.PI / 2 + t * Math.PI / 2;
      push(0, TLCy + r * Math.sin(theta), TLCz + r * Math.cos(theta));
    }
  }

  // ── 5. LEFT EDGE ──────────────────────────────────────────────────────
  for (let i = 1; i <= 50; i++) {
    const t = i / 50;
    push(0, (cy - r) - 2 * (cy - r) * t, -cz);
  }

  // ── 6. BL CORNER (90° arc, θ from π to 3π/2 around (-cy+r, -cz+r)) ────
  {
    const BLCy = -cy + r, BLCz = -cz + r;
    for (let i = 1; i <= 18; i++) {
      const t = i / 18;
      const theta = Math.PI + t * Math.PI / 2;
      push(0, BLCy + r * Math.sin(theta), BLCz + r * Math.cos(theta));
    }
  }

  // ── 7. BOTTOM EDGE ────────────────────────────────────────────────────
  for (let i = 1; i <= 36; i++) {
    const t = i / 36;
    push(0, -cy, (-cz + r) + 2 * (cz - r) * t);
  }

  // ── 8. BR CORNER (90° arc, θ from 3π/2 to 2π around (-cy+r, cz-r)) ────
  {
    const BRCy = -cy + r, BRCz = cz - r;
    for (let i = 1; i <= 18; i++) {
      const t = i / 18;
      const theta = 3 * Math.PI / 2 + t * Math.PI / 2;
      push(0, BRCy + r * Math.sin(theta), BRCz + r * Math.cos(theta));
    }
  }

  // ── 9. RIGHT EDGE ─────────────────────────────────────────────────────
  for (let i = 1; i <= 50; i++) {
    const t = i / 50;
    push(0, (-cy + r) + 2 * (cy - r) * t, cz);
  }

  // ── 10. BEND 2: 135° arc, θ from 0 to 3π/4; X transitions 0 → +ε ─────
  for (let i = 1; i <= 36; i++) {
    const t = i / 36;
    const theta = t * (3 * Math.PI / 4);
    const y = Cy + r * Math.sin(theta);
    const z = Cz + r * Math.cos(theta);
    const x = eps * smooth(t);
    push(x, y, z);
  }

  // ── 11. HOOK 2 LINE (X = +ε): from bend2 end down-left to inner end ──
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    push(eps, bend2_end_y + (h2_inner_y - bend2_end_y) * t,
              bend2_end_z + (h2_inner_z - bend2_end_z) * t);
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
function Stirrups({ input, bw, h, L, cover, mat }: {
  input: BeamInput; bw: number; h: number; L: number; cover: number;
  mat: THREE.Material;
}) {
  const stirrupDb = (lookupBar(input.reinforcement.stirrup.bar)?.db ?? 10) * MM_TO_M;
  const sSpacing = input.reinforcement.stirrup.spacing * MM_TO_M;

  // Build the unit-stirrup geometry — ONE continuous bent rebar with two 135°
  // hooks at the closing corner (top-right), at slightly different X depths.
  const tubeGeom = useMemo(() => {
    const cz = bw / 2 - cover - stirrupDb / 2;
    const cy = h / 2 - cover - stirrupDb / 2;
    const r = Math.min(2.5 * stirrupDb, Math.min(cy, cz) * 0.4);
    const visRadius = (stirrupDb / 2) * 1.6;
    const pts = buildStirrupWithHooks(cy, cz, r, stirrupDb);
    const curve = new PolylineCurve(pts);
    // closed=false → the path is OPEN (hook ends are the bar termini, not joined)
    return new THREE.TubeGeometry(curve, 480, visRadius, 14, false);
  }, [bw, h, cover, stirrupDb]);

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
      args={[tubeGeom, mat, positions.length]}
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
