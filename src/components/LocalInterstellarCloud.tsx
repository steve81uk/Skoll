import { useRef, useMemo } from 'react';
import { extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

/**
 * LocalInterstellarCloud.tsx
 *
 * Volumetric background shell representing the Local Interstellar Cloud
 * (also called the Local Fluff) — a warm (~6 000 K), partially ionised
 * hydrogen/helium cloud roughly 30 ly across that the Sun has been
 * travelling through for ~44 000–150 000 years.
 *
 * Rendered as a large BackSide sphere (~500 scene-units radius) with a
 * custom GLSL fbm-noise fragment shader.  Very low opacity so it blends
 * behind all scene objects without obscuring them.
 *
 * Reference: Linsky et al. (2019), ApJ 886, 41.
 */

// ── GLSL helpers ─────────────────────────────────────────────────────────────
const vertexShader = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  precision mediump float;

  uniform float uTime;
  varying vec3 vWorldPos;

  // ── Pseudo-random hash ──────────────────────────────────────────────────
  float hash(vec3 p) {
    p  = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  // ── Value noise, 3-D ────────────────────────────────────────────────────
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    // Smoothstep interpolation
    vec3 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), u.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), u.x), u.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), u.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), u.x), u.y),
               u.z);
  }

  // ── Fractional Brownian motion — 5 octaves ──────────────────────────────
  float fbm(vec3 p) {
    float v   = 0.0;
    float amp = 0.5;
    float frq = 1.0;
    for (int i = 0; i < 5; i++) {
      v   += amp * noise(p * frq);
      amp *= 0.5;
      frq *= 2.1;
    }
    return v;
  }

  void main() {
    // Normalised direction through the shell
    vec3 dir = normalize(vWorldPos);

    // Slow drift — the Sun moves ~26 km/s relative to LIC
    float t      = uTime * 0.012;
    vec3  offset = vec3(t * 0.07, t * 0.04, t * 0.05);

    // Two-scale fbm for wispy filaments
    float largeScale = fbm(dir * 1.8 + offset);
    float fineDetail = fbm(dir * 5.6 + offset * 1.7 + vec3(3.1, 1.7, 2.4));
    float detail     = largeScale * 0.7 + fineDetail * 0.3;

    // Local Interstellar Cloud: warm (6 000 K) partially-ionised plasma
    // Observer sits inside the cloud — colour is a muted yellow-orange
    // with slight blue-shift at tenuous regions
    vec3  warmYellow  = vec3(0.96, 0.82, 0.42);  // ~5 800 K blackbody
    vec3  coolEdge    = vec3(0.48, 0.62, 0.90);  // cooler neutral hydrogen
    vec3  cloudColor  = mix(coolEdge, warmYellow, smoothstep(0.3, 0.76, detail));

    // Thin-cloud opacity: ranges ~0.03–0.11
    float alpha = 0.03 + detail * 0.08;

    // Soft falloff toward transparent at very low density blobs
    alpha *= smoothstep(0.18, 0.42, detail);

    gl_FragColor = vec4(cloudColor, alpha);
  }
`;

// ── Three.js shader material via Drei's shaderMaterial factory ───────────────
const LICMaterial = shaderMaterial(
  { uTime: 0 },
  vertexShader,
  fragmentShader,
);

extend({ LICMaterial });

// Augment JSX intrinsic elements so TypeScript accepts <lICMaterial />
declare module '@react-three/fiber' {
  interface ThreeElements {
    lICMaterial: React.PropsWithChildren<{
      ref?: React.Ref<THREE.ShaderMaterial & { uTime: number }>;
      uTime?: number;
      transparent?: boolean;
      depthWrite?: boolean;
      side?: THREE.Side;
    }>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LocalInterstellarCloud() {
  const matRef = useRef<THREE.ShaderMaterial & { uTime: number }>(null);

  // Build geometry once — high-poly sphere for smooth noise sampling
  const geometry = useMemo(
    () => new THREE.SphereGeometry(500, 24, 16),
    [],
  );

  return (
    <mesh geometry={geometry}>
      <lICMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
