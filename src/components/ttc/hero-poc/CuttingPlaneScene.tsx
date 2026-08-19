'use client';

/**
 * CUTTING PLANE — hero concept POC.
 *
 * One gold blade of light crosses the frame. Behind it the reinforced-concrete
 * beam is poured and cut open, showing a true section face with 45° poché hatch.
 * Ahead of it there is no concrete at all — only the rebar cage and a 1px gold
 * outline of the concrete that is still just a drawing.
 *
 * The whole narrative is produced by ONE THREE.Plane used as a local clipping
 * plane, so it is cheap and can never desync from the visuals.
 *
 * Units: the beam is modelled at 1 unit = 1 ft, so cover / bar sizes are real.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { useReducedMotion } from 'motion/react';
import * as THREE from 'three';

/* ── palette (brand) ─────────────────────────────────────────────────── */
const INK = '#16150f';
const IVORY = '#f7f6f3';
const GOLD = '#c9a84c';
const GOLD_DEEP = '#a5842f';

/* ── beam geometry (feet) ────────────────────────────────────────────── */
const LEN = 10;            // along x
const H = 1.4;             // depth of member (y)
const B = 0.9;             // width (z)
const COVER = 0.125;       // 1½" clear cover
const BAR_R = 0.047;       // ~#9 longitudinal
const TIE_R = 0.021;       // ~#4 tie
const X0 = -LEN / 2;
const X1 = LEN / 2;

const CUT_MIN = -1.9;
const CUT_MAX = 3.4;
const CUT_REST = 0.62;     // the "best still" — half drawing, half built

/* ── procedural concrete maps (no fragile shader-chunk patching) ─────── */
function makeConcreteMaps() {
  const S = 512;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return { c, x: c.getContext('2d')! };
  };

  // bump: aggregate grain + board-form seams + sparse bugholes
  const { c: bumpC, x: bx } = mk();
  bx.fillStyle = '#808080';
  bx.fillRect(0, 0, S, S);
  for (let i = 0; i < 42000; i++) {
    const v = Math.random();
    const g = v > 0.5 ? 255 : 0;
    bx.fillStyle = `rgba(${g},${g},${g},${Math.random() * 0.07})`;
    bx.fillRect(Math.random() * S, Math.random() * S, 1, 1);
  }
  // 1x8 board seams with a little cupping between boards
  const boards = 8;
  for (let i = 0; i <= boards; i++) {
    const y = (i / boards) * S;
    const grad = bx.createLinearGradient(0, y - S / boards / 2, 0, y + S / boards / 2);
    grad.addColorStop(0, 'rgba(128,128,128,0)');
    grad.addColorStop(0.5, 'rgba(150,150,150,0.16)');
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    bx.fillStyle = grad;
    bx.fillRect(0, y - S / boards / 2, S, S / boards);
    bx.fillStyle = 'rgba(40,40,40,0.5)';
    bx.fillRect(0, y - 0.6, S, 1.2);
  }
  // bugholes
  for (let i = 0; i < 130; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 1 + Math.random() * 3.4;
    const g = bx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(28,28,28,0.75)');
    g.addColorStop(1, 'rgba(128,128,128,0)');
    bx.fillStyle = g;
    bx.beginPath(); bx.arc(x, y, r, 0, Math.PI * 2); bx.fill();
  }

  // roughness: soft mottled patches 0.66 → 0.94 (uniform roughness = plastic tell)
  const { c: roughC, x: rx } = mk();
  rx.fillStyle = '#d0d0d0';
  rx.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 150;
    const dark = Math.random() > 0.5;
    const g = rx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, dark ? 'rgba(168,168,168,0.5)' : 'rgba(242,242,242,0.45)');
    g.addColorStop(1, 'rgba(208,208,208,0)');
    rx.fillStyle = g;
    rx.beginPath(); rx.arc(x, y, r, 0, Math.PI * 2); rx.fill();
  }

  const tex = (canvas: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(7, 1.1);
    t.anisotropy = 4;
    return t;
  };
  return { bumpMap: tex(bumpC), roughnessMap: tex(roughC) };
}

/* ── rebar cage: every element is one unit-cylinder instance ─────────── */
type Seg = { a: THREE.Vector3; b: THREE.Vector3; r: number };

function buildCage(): Seg[] {
  const segs: Seg[] = [];
  const yb = H / 2 - COVER - TIE_R - BAR_R;   // longitudinal bar centre
  const zb = B / 2 - COVER - TIE_R - BAR_R;
  const yt = H / 2 - COVER - TIE_R;           // tie centreline
  const zt = B / 2 - COVER - TIE_R;

  // 6 longitudinal bars (4 corners + 2 mid-depth)
  for (const [y, z] of [[yb, zb], [yb, -zb], [-yb, zb], [-yb, -zb], [0, zb], [0, -zb]] as const) {
    segs.push({ a: new THREE.Vector3(X0 + 0.15, y, z), b: new THREE.Vector3(X1 - 0.15, y, z), r: BAR_R });
  }

  // tie spacing densifies toward +x (confinement zone) — visual crescendo
  const xs: number[] = [];
  let x = X0 + 0.35;
  while (x < X1 - 0.3) {
    xs.push(x);
    const t = (x - X0) / LEN;
    x += Math.max(0.42 - 0.27 * t * t, 0.16);
  }

  for (const tx of xs) {
    const c = [
      new THREE.Vector3(tx, yt, zt),
      new THREE.Vector3(tx, yt, -zt),
      new THREE.Vector3(tx, -yt, -zt),
      new THREE.Vector3(tx, -yt, zt),
    ];
    for (let i = 0; i < 4; i++) segs.push({ a: c[i], b: c[(i + 1) % 4], r: TIE_R });
    // 135° seismic hooks with 6db tails, folded into the core
    const tail = 6 * (TIE_R * 2);
    const d = tail / Math.SQRT2;
    segs.push({ a: c[0].clone(), b: new THREE.Vector3(tx, yt - d, zt - d), r: TIE_R });
    segs.push({ a: c[1].clone(), b: new THREE.Vector3(tx, yt - d, -zt + d), r: TIE_R });
  }
  return segs;
}

function Cage({ material }: { material: THREE.Material }) {
  const segs = useMemo(buildCage, []);
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const mid = new THREE.Vector3();
    segs.forEach((s, i) => {
      dir.subVectors(s.b, s.a);
      const len = dir.length();
      mid.addVectors(s.a, s.b).multiplyScalar(0.5);
      q.setFromUnitVectors(up, dir.normalize());
      m.compose(mid, q, new THREE.Vector3(s.r, len, s.r));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [segs]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, segs.length]} material={material} frustumCulled={false}>
      <cylinderGeometry args={[1, 1, 1, 10]} />
    </instancedMesh>
  );
}

/* ── section face (poché) — explicit cap, NOT backface clipping ──────── */
const capVert = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const capFrag = /* glsl */ `
  precision highp float;
  varying vec2 vP;
  uniform vec3 uIvory, uInk, uGold;
  uniform vec2 uHalf;
  void main() {
    // 45° drafting hatch, analytically antialiased so it is a true hairline
    float v = (vP.x + vP.y) * 30.0;
    float d = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-5);
    float a = 1.0 - smoothstep(0.5, 1.5, d);
    // fade to flat ivory where the face is oblique/distant, instead of moiré
    a *= 1.0 - smoothstep(0.30, 0.72, length(vec2(dFdx(v), dFdy(v))));
    vec3 col = mix(uIvory, uInk, a * 0.42);
    // hot gold arris on the cut edge
    vec2 e = uHalf - abs(vP);
    float rim = 1.0 - smoothstep(0.0, 0.030, min(e.x, e.y));
    col = mix(col, uGold, rim);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ── the scene ───────────────────────────────────────────────────────── */
function Scene({ cutRef, reduce }: { cutRef: React.MutableRefObject<number>; reduce: boolean }) {
  const { gl, camera } = useThree();
  const maps = useMemo(() => makeConcreteMaps(), []);
  const group = useRef<THREE.Group>(null);
  const capRef = useRef<THREE.Mesh>(null);
  const bladeRef = useRef<THREE.Mesh>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const cutNow = useRef(CUT_REST);

  // one plane keeps the built side, its mirror keeps the drawing side
  const [cutPlane, invPlane] = useMemo(
    () => [new THREE.Plane(new THREE.Vector3(-1, 0, 0), CUT_REST), new THREE.Plane(new THREE.Vector3(1, 0, 0), -CUT_REST)],
    [],
  );

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const concreteMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#cfc9bb'),
      roughness: 0.86,
      metalness: 0,
      bumpMap: maps.bumpMap,
      bumpScale: 0.012,
      roughnessMap: maps.roughnessMap,
    });
    m.clippingPlanes = [cutPlane];
    return m;
  }, [maps, cutPlane]);

  const steelMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(GOLD_DEEP), metalness: 1, roughness: 0.34 }),
    [],
  );

  const lineMat = useMemo(() => {
    const m = new THREE.LineBasicMaterial({ color: new THREE.Color(GOLD), transparent: true, opacity: 0.62 });
    m.clippingPlanes = [invPlane];
    return m;
  }, [invPlane]);

  // 1px gold outline of the concrete that does not exist yet
  const outline = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(LEN, H, B)), []);

  // dimension line under the drawing side
  const dims = useMemo(() => {
    const p: number[] = [];
    const y = -H / 2 - 0.42, z = B / 2;
    p.push(X0, y, z, X1, y, z);
    for (const x of [X0, X1]) { p.push(x, y - 0.09, z, x, y + 0.09, z); }
    for (const yy of [-H / 2, H / 2]) { p.push(X1 + 0.42, yy, z, X1 + 0.6, yy, z); }
    p.push(X1 + 0.51, -H / 2, z, X1 + 0.51, H / 2, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    return g;
  }, []);

  useFrame((state, dt) => {
    const damp = 1 - Math.pow(0.001, Math.min(dt, 0.05)); // frame-rate independent
    const p = pointer.current;
    p.sx += (p.x - p.sx) * damp;
    p.sy += (p.y - p.sy) * damp;

    // pointer X pours / un-pours the concrete — the discovery hook
    const target = reduce ? CUT_REST : CUT_REST + p.sx * 1.5;
    cutNow.current += (THREE.MathUtils.clamp(target, CUT_MIN, CUT_MAX) - cutNow.current) * damp;
    const cut = cutNow.current;
    cutRef.current = cut;

    cutPlane.constant = cut;
    invPlane.constant = -cut;
    if (capRef.current) capRef.current.position.x = cut;
    if (bladeRef.current) bladeRef.current.position.x = cut;

    if (!reduce && group.current) {
      const t = state.clock.elapsedTime;
      group.current.rotation.y = -0.30 + p.sx * 0.05 + Math.sin(t * 0.09) * 0.012;
      group.current.rotation.x = 0.055 + p.sy * 0.028;
    }
    // pointer rakes the key light across the board-formed face
    if (!reduce && keyRef.current) {
      const az = -0.7 + p.sx * 0.38;
      keyRef.current.position.set(Math.sin(az) * 9, 6.2, Math.cos(az) * 9);
    }
    camera.lookAt(0.2, -0.12, 0);
  });

  return (
    <group ref={group} position={[0.4, 0.05, 0]}>
      {/* poured concrete — clipped at the blade */}
      <mesh material={concreteMat} castShadow={false}>
        <boxGeometry args={[LEN, H, B]} />
      </mesh>

      {/* the section face itself */}
      <mesh ref={capRef} rotation={[0, Math.PI / 2, 0]} renderOrder={2}>
        <planeGeometry args={[B, H]} />
        <shaderMaterial
          vertexShader={capVert}
          fragmentShader={capFrag}
          toneMapped={false}
          uniforms={{
            uIvory: { value: new THREE.Color(IVORY) },
            uInk: { value: new THREE.Color(INK) },
            uGold: { value: new THREE.Color(GOLD) },
            uHalf: { value: new THREE.Vector2(B / 2, H / 2) },
          }}
        />
      </mesh>

      {/* the blade of light */}
      <mesh ref={bladeRef} rotation={[0, Math.PI / 2, 0]} renderOrder={3}>
        <planeGeometry args={[B + 0.5, H + 0.5]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.16} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* rebar cage — hidden inside the pour by depth, exposed once clipped */}
      <Cage material={steelMat} />

      {/* the drawing that has not been built yet */}
      <lineSegments geometry={outline} material={lineMat} />
      <lineSegments geometry={dims} material={lineMat} />
    </group>
  );
}

/* ── canvas ──────────────────────────────────────────────────────────── */
export default function CuttingPlaneScene({ cutRef }: { cutRef: React.MutableRefObject<number> }) {
  const reduce = !!useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <Canvas
      className="hpc-canvas"
      camera={{ position: [7.4, 2.5, 8.2], fov: 26 }}
      dpr={[1, 1.75]}
      frameloop={reduce ? 'demand' : 'always'}
      performance={{ min: 0.5 }}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.08,
      }}
    >
      <Scene cutRef={cutRef} reduce={reduce} />

      {/* baked once — no network request, gives the bars their specular streak */}
      <Environment frames={1} resolution={256}>
        <Lightformer intensity={2.4} color="#fff6e2" position={[-6, 5, 4]} scale={[10, 10, 1]} />
        <Lightformer intensity={3.6} color="#ffffff" position={[6, 1, 3]} scale={[0.4, 9, 1]} />
        <Lightformer intensity={0.9} color="#cfc9bb" position={[0, -5, -4]} scale={[10, 6, 1]} />
      </Environment>
      <directionalLight position={[-6, 6.2, 6]} intensity={2.2} color="#fff4de" />
      <ambientLight intensity={0.16} />

      <EffectComposer multisampling={4}>
        {/* restrained on purpose: only the blade + steel speculars may bloom */}
        <Bloom luminanceThreshold={0.76} intensity={0.3} mipmapBlur />
        <Noise opacity={0.035} />
        <Vignette darkness={0.62} offset={0.32} />
      </EffectComposer>
    </Canvas>
  );
}
