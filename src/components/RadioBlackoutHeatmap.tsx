/**
 * RadioBlackoutHeatmap.tsx
 *
 * D-RAP (D-Region Absorption Prediction) overlay on Earth's mesh.
 *
 * Rendered as a transparent sphere slightly larger than Earth.
 * The shader:
 *   1. Determines sun-facing hemisphere via dot(normal, -earthWorldPos_normalised)
 *   2. Applies latitudinal weighting (equatorial HF paths longest through ionosphere)
 *   3. Scales absorption intensity by normalised GOES flux (uFlux uniform)
 *   4. Blends orange→red colour as flux rises
 *
 * References:
 *   NOAA SWPC D-RAP model:  https://www.swpc.noaa.gov/products/d-rap
 *   Packet absorption ∝ ∫ electron density along oblique path (Chapman layers)
 */

import { useRef, useMemo } from 'react';
import { extend, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

// ── GLSL ─────────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec3 vLocalNorm;
  varying vec3 vWorldPos;

  void main() {
    vLocalNorm = normalize(normal);
    vec4 wp    = modelMatrix * vec4(position, 1.0);
    vWorldPos  = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uFlux;          // normalised flux 0–1 (C1=0, M1=0.33, X1=0.67, X10=1)
  uniform vec3  uEarthWorldPos; // scene-space Earth centre (sun at origin)
  uniform float uTime;

  varying vec3 vLocalNorm;
  varying vec3 vWorldPos;

  // Soft fbm noise to break up the heatmap into blotchy patches
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  void main() {
    // Sun is at world origin; direction from Earth to Sun:
    vec3  toSun     = normalize(-uEarthWorldPos);

    // Sunlit fraction: positive when facing sun
    float sunDot    = dot(vLocalNorm, toSun);
    float sunlit    = smoothstep(-0.12, 0.18, sunDot);

    // Latitude factor: abs(y) of local normal ≈ sin(lat)
    //  equatorial zone (|lat| small) → longer oblique HF path → higher absorption
    float latAbs    = abs(vLocalNorm.y);
    float latFactor = 1.0 - latAbs * 0.55;   // peaks at equator, falls at poles

    // Scintillation at equatorial boundary (±10° lat)
    float eqBand    = smoothstep(0.15, 0.0, abs(vLocalNorm.y - 0.0)) * 0.35;

    // Temporal noise drift (slow ionospheric drift ~50 m/s)
    vec2 uv         = vec2(atan(vLocalNorm.z, vLocalNorm.x) * 0.15, vLocalNorm.y * 0.8)
                      + vec2(uTime * 0.0018, 0.0);
    float patchNoise= fbm(uv * 2.8) * 0.45 + 0.55;

    // Core absorption term
    float absorption = sunlit * latFactor * uFlux * patchNoise;
    absorption       = clamp(absorption + eqBand * uFlux * sunlit, 0.0, 1.0);

    // Colour: orange (C/M) → deep red (X10+)
    vec3  colLow  = vec3(1.0, 0.62, 0.12);
    vec3  colHigh = vec3(0.95, 0.08, 0.04);
    vec3  col     = mix(colLow, colHigh, clamp(uFlux, 0.0, 1.0));

    // Rim glow adds a faint halo on the day–night terminator
    float rim     = pow(1.0 - abs(sunDot), 3.0) * sunlit * 0.22 * uFlux;

    float alpha   = clamp(absorption * 0.52 + rim, 0.0, 0.78);

    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Shader material ───────────────────────────────────────────────────────────

const DRAPMaterial = shaderMaterial(
  {
    uFlux:           0.0,
    uEarthWorldPos:  new THREE.Vector3(0, 0, 0),
    uTime:           0.0,
  },
  vertexShader,
  fragmentShader,
);

extend({ DRAPMaterial });

// ── TypeScript declaration for JSX ────────────────────────────────────────────

declare module '@react-three/fiber' {
  interface ThreeElements {
    dRAPMaterial: React.PropsWithChildren<{
      uFlux?:          number;
      uEarthWorldPos?: THREE.Vector3;
      uTime?:          number;
      transparent?:    boolean;
      depthWrite?:     boolean;
      side?:           THREE.Side;
      blending?:       THREE.Blending;
      ref?:            React.Ref<THREE.ShaderMaterial & { uFlux: number; uEarthWorldPos: THREE.Vector3; uTime: number }>;
    }>;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Earth radius in PlanetRenderer ≈ 0.8 + 9.8 × 0.045 ≈ 1.241 scene units.
 * Heatmap sphere sits 2.5% above surface.
 */
const HEATMAP_RADIUS = 1.275;

export interface RadioBlackoutHeatmapProps {
  earthPos: [number, number, number];
  /** Live GOES 1–8 Å flux in W/m² (raw value, will be normalised internally) */
  fluxWm2:  number;
  visible?: boolean;
}

/** log10-based normalisation: 0 at C1 (1e-6 W/m²), 1.0 at X10 (1e-3 W/m²) */
function normaliseFlux(f: number): number {
  if (f <= 0) return 0;
  const v = (Math.log10(f) + 6) / 3;
  return Math.max(0, Math.min(1, v));
}

export default function RadioBlackoutHeatmap({ earthPos, fluxWm2, visible = true }: RadioBlackoutHeatmapProps) {
  const matRef = useRef<THREE.ShaderMaterial & { uFlux: number; uEarthWorldPos: THREE.Vector3; uTime: number }>(null);

  const earthVec = useMemo(() => new THREE.Vector3(...earthPos), [earthPos[0], earthPos[1], earthPos[2]]);
  const fluxNorm = normaliseFlux(fluxWm2);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uFlux          = fluxNorm;
    matRef.current.uEarthWorldPos = earthVec;
    matRef.current.uTime          = clock.getElapsedTime();
    matRef.current.needsUpdate    = false; // uniforms update each frame
  });

  if (!visible) return null;

  return (
    <mesh position={earthPos} renderOrder={3}>
      <sphereGeometry args={[HEATMAP_RADIUS, 128, 64]} />
      <dRAPMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
