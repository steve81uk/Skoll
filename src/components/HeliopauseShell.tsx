import { useRef, useMemo } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

/**
 * HeliopauseShell.tsx
 *
 * Dual-layer volumetric shader visualising the outer boundary of the
 * heliosphere:
 *
 *   Inner shell — Termination Shock (~90 AU)
 *     The supersonic solar wind abruptly slows as it encounters the
 *     interstellar medium.  Colour: electric blue-white.
 *
 *   Outer shell — Heliopause (~120 AU)
 *     The true boundary where solar wind pressure equals interstellar
 *     pressure. Colour: deep indigo-violet.
 *
 * Both shells use an fbm-noise GLSL shader for sub-structure, with
 * depthWrite=false and BackSide rendering so they appear as translucent
 * enclosing volumes.
 *
 * Scene scale: 1 AU = 60 units (AU_SCALE in PlanetRenderer).
 * Artistic radii (compressed for aesthetics/performance):
 *   Termination shock: 1 600 scene units  (~27 AU real → artistic)
 *   Heliopause:        2 400 scene units
 *
 * The asymmetry (nose vs tail) is baked into the shader via a
 * hemisphere-biased opacity term: the sunward side (–z) is brighter
 * than the leeward tail.
 */

// ── Shared GLSL fbm noise ────────────────────────────────────────────────────
const COMMON_GLSL = /* glsl */`
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i+vec3(1,0,0)), u.x),
        mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), u.x), u.y),
    mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), u.x),
        mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), u.x), u.y),
    u.z);
}

float fbm3(vec3 p, int oct) {
  float val=0., amp=0.5, f=1.;
  for(int i=0;i<6;i++){
    if(i>=oct) break;
    val += amp * noise3(p*f);
    amp *= 0.5; f *= 2.1;
  }
  return val;
}
`;

// ── Heliopause vertex shader ──────────────────────────────────────────────────
const HELIO_VERT = /* glsl */`
varying vec3 vWorldPos;
varying vec3 vNorm;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNorm     = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ── Termination Shock fragment ───────────────────────────────────────────────
const TERMSHOCK_FRAG = /* glsl */`
${COMMON_GLSL}

precision mediump float;
uniform float uTime;
uniform float uOpacity;
varying vec3 vWorldPos;
varying vec3 vNorm;

void main() {
  vec3 dir = normalize(vWorldPos);
  float t  = uTime * 0.008;

  // fbm turbulence for filamentary structure
  float n = fbm3(dir * 2.4 + vec3(t, t*0.7, t*0.5), 4);

  // Sunward (−z) is compressed; tail (+z) is elongated
  float asymm = 0.5 + 0.5 * (-dir.z);   // 0 at +z tail, 1 at −z nose

  // Termination shock: electric blue-white
  vec3 innerCol = vec3(0.55, 0.85, 1.0);
  vec3 outerCol = vec3(0.20, 0.55, 0.95);
  vec3 color    = mix(outerCol, innerCol, n);

  float alpha = uOpacity * (0.04 + n * 0.06) * (0.5 + 0.5 * asymm);
  gl_FragColor = vec4(color, alpha);
}
`;

// ── Heliopause fragment ───────────────────────────────────────────────────────
const HELIOPAUSE_FRAG = /* glsl */`
${COMMON_GLSL}

precision mediump float;
uniform float uTime;
uniform float uOpacity;
varying vec3 vWorldPos;

void main() {
  vec3 dir = normalize(vWorldPos);
  float t  = uTime * 0.005;

  float n    = fbm3(dir * 1.6 + vec3(t*0.6, t, t*0.8), 5);
  float fine = fbm3(dir * 4.2 + vec3(t*1.2, t*0.5, t), 3);
  float detail = n * 0.7 + fine * 0.3;

  // Heliopause: deep violet-indigo — boundary between solar and interstellar
  vec3 innerCol = vec3(0.38, 0.22, 0.72);
  vec3 outerCol = vec3(0.58, 0.30, 0.88);
  vec3 color    = mix(innerCol, outerCol, detail);

  float asymm = 0.4 + 0.6 * (0.5 - dir.z * 0.5);
  float alpha  = uOpacity * (0.025 + detail * 0.05) * asymm;
  gl_FragColor = vec4(color, alpha);
}
`;

// ── Shader materials ──────────────────────────────────────────────────────────
const TerminationShockMaterial = shaderMaterial(
  { uTime: 0, uOpacity: 1 },
  HELIO_VERT,
  TERMSHOCK_FRAG,
);

const HeliopauseMaterial = shaderMaterial(
  { uTime: 0, uOpacity: 1 },
  HELIO_VERT,
  HELIOPAUSE_FRAG,
);

extend({ TerminationShockMaterial, HeliopauseMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    terminationShockMaterial: React.PropsWithChildren<{
      ref?: React.Ref<THREE.ShaderMaterial & { uTime: number; uOpacity: number }>;
      uTime?: number;
      uOpacity?: number;
      transparent?: boolean;
      depthWrite?: boolean;
      side?: THREE.Side;
    }>;
    heliopauseMaterial: React.PropsWithChildren<{
      ref?: React.Ref<THREE.ShaderMaterial & { uTime: number; uOpacity: number }>;
      uTime?: number;
      uOpacity?: number;
      transparent?: boolean;
      depthWrite?: boolean;
      side?: THREE.Side;
    }>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export interface HeliopauseShellProps {
  /** Whether heliopause is visible (toggled from menu). */
  visible?: boolean;
}

export default function HeliopauseShell({ visible = true }: HeliopauseShellProps) {
  const tsRef  = useRef<THREE.ShaderMaterial & { uTime: number; uOpacity: number }>(null);
  const hpRef  = useRef<THREE.ShaderMaterial & { uTime: number; uOpacity: number }>(null);

  const tsGeo = useMemo(() => new THREE.SphereGeometry(1_600, 48, 48), []);
  const hpGeo = useMemo(() => new THREE.SphereGeometry(2_400, 48, 48), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (tsRef.current) tsRef.current.uTime = t;
    if (hpRef.current) hpRef.current.uTime = t;
  });

  if (!visible) return null;

  return (
    <group>
      {/* Termination shock — inner boundary */}
      <mesh geometry={tsGeo}>
        <terminationShockMaterial
          ref={tsRef}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Heliopause — outer boundary */}
      <mesh geometry={hpGeo}>
        <heliopauseMaterial
          ref={hpRef}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}
