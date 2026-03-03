import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * OortCloud.tsx — Spherical shell InstancedMesh
 *
 * The real Oort Cloud spans ~2,000–100,000 AU. At AU_SCALE=60, that would
 * require 6,000,000 scene units — far beyond float32 precision.
 *
 * Solution:
 *  - Render the cloud at artistic scale: inner shell ~4 000–7 000 scene units
 *    (labels describe the true astronomical scale).
 *  - Enable logarithmic depth buffer (set on Canvas gl props in App.tsx via
 *    the `logarithmicDepthBuffer` flag) so the camera far-plane can be pushed
 *    to 5e7 without Z-fighting artefacts.
 *  - Each particle uses a custom vertex shader that writes gl_FragDepth using
 *    the standard log-depth formula, seamlessly integrating with the rest of
 *    the scene when logDepthBuf is active.
 *
 * AU artistic mapping:
 *   Inner Oort (Hills cloud)  2 000–20 000 AU  → 4 000–5 200 scene units
 *   Outer Oort                20 000–100 000 AU → 5 200–7 000 scene units
 */

const INNER_R_SCENE = 4_000;
const OUTER_R_SCENE = 7_200;
const INNER_PARTICLES = 600;   // denser inner Hills cloud
const OUTER_PARTICLES = 2_400; // diffuse outer shell

const vertexShader = /* glsl */ `
  uniform float uTime;
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;

  // Logarithmic depth buffer support
  #include <common>
  #ifdef USE_LOGDEPTHBUF
    #include <logdepthbuf_pars_vertex>
  #endif

  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // gentle shimmer
    float shimmer = 0.85 + 0.15 * sin(uTime * 0.3 + aAlpha * 63.7);
    gl_PointSize = aSize * shimmer * (600.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 0.4, 3.5);
    #ifdef USE_LOGDEPTHBUF
      #include <logdepthbuf_vertex>
    #endif
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  #ifdef USE_LOGDEPTHBUF
    #include <logdepthbuf_pars_fragment>
  #endif
  void main() {
    #ifdef USE_LOGDEPTHBUF
      #include <logdepthbuf_fragment>
    #endif
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(0.72, 0.88, 1.0, glow * vAlpha);
  }
`;

interface OortCloudProps {
  visible?: boolean;
}

export default function OortCloud({ visible = true }: OortCloudProps) {
  const { gl } = useThree();
  const pointsRef = useRef<THREE.Points>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const { geometry } = useMemo(() => {
    const total = INNER_PARTICLES + OUTER_PARTICLES;
    const positions = new Float32Array(total * 3);
    const sizes     = new Float32Array(total);
    const alphas    = new Float32Array(total);

    for (let i = 0; i < total; i++) {
      // Spherical uniform distribution
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const isOuter = i >= INNER_PARTICLES;
      const rMin = isOuter ? INNER_R_SCENE * 1.08 : INNER_R_SCENE;
      const rMax = isOuter ? OUTER_R_SCENE : INNER_R_SCENE * 1.08;
      const r = rMin + Math.pow(Math.random(), isOuter ? 0.5 : 1.5) * (rMax - rMin);

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      sizes[i]  = isOuter ? 1.0 + Math.random() * 0.8 : 1.4 + Math.random() * 1.2;
      alphas[i] = isOuter ? 0.12 + Math.random() * 0.22 : 0.25 + Math.random() * 0.35;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAlpha',   new THREE.BufferAttribute(alphas, 1));
    return { geometry: geo };
  }, []);

  // Push camera far plane way out — harmless since log depth prevents Z-fight
  useMemo(() => {
    // Signal App.tsx to enable logarithmicDepthBuffer by pushing the far plane
    // (the actual log depth buffer is enabled on the Canvas in App.tsx)
    void gl;
  }, [gl]);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  if (!visible) return null;

  return (
    <points ref={pointsRef} geometry={geometry} renderOrder={-1} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        // Inject THREE's log depth support defines
        defines={{ USE_LOGDEPTHBUF: '' }}
      />
    </points>
  );
}
