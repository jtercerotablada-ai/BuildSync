'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useReducedMotion } from 'motion/react';
import * as THREE from 'three';

/**
 * Hero background accent: a slowly rotating gold "rebar cage" wireframe.
 * It reads as reinforced-concrete / structural integrity — the through-line
 * of the firm's three services. Pure line geometry (no lights, no textures)
 * so it stays cheap; reduced-motion holds it static.
 */

const GOLD = '#d4b45a';

function RebarCage() {
  const group = useRef<THREE.Group>(null);
  const reduce = useReducedMotion();

  const { positions, nodePositions } = useMemo(() => {
    const w = 1.15;            // half-width of the cage
    const yTop = 3.1;
    const yBot = -3.1;
    const posts: [number, number][] = [
      [w, w], [w, -w], [-w, -w], [-w, w],           // corners
      [w, 0], [-w, 0], [0, w], [0, -w],             // mid bars
    ];
    const ringY = [-3, -2, -1, 0, 1, 2, 3];
    const seg: number[] = [];
    // vertical bars
    for (const [x, z] of posts) {
      seg.push(x, yBot, z, x, yTop, z);
    }
    // square ties (stirrups) at each level
    const ring: [number, number][] = [[w, w], [w, -w], [-w, -w], [-w, w]];
    for (const y of ringY) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        seg.push(a[0], y, a[1], b[0], y, b[1]);
      }
    }
    // node points where corner posts meet ties
    const nodes: number[] = [];
    for (const y of ringY) for (const [x, z] of ring) nodes.push(x, y, z);

    return {
      positions: new Float32Array(seg),
      nodePositions: new Float32Array(nodes),
    };
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    if (reduce) {
      group.current.rotation.set(0.12, -0.5, 0);
      return;
    }
    group.current.rotation.y = t * 0.16 - 0.5;
    group.current.rotation.x = Math.sin(t * 0.18) * 0.09 + 0.05;
    group.current.position.y = Math.sin(t * 0.28) * 0.12;
  });

  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={GOLD} transparent opacity={0.55} />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nodePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={GOLD} size={0.09} transparent opacity={0.85} sizeAttenuation />
      </points>
    </group>
  );
}

export default function HeroCanvas() {
  // Only mount the WebGL canvas on the client after hydration. Rendering
  // null on the server avoids R3F touching browser APIs during SSR and
  // sidesteps next/dynamic ssr:false hydration quirks.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <Canvas
      className="hero-canvas"
      camera={{ position: [0, 0, 8.4], fov: 42 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop="always"
    >
      <RebarCage />
    </Canvas>
  );
}
