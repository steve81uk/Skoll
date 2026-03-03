/**
 * SKÖLL-TRACK — SAGITTARIUS A* (Sgr A*)
 * Real metrics:
 *   Mass:         4.154 × 10⁶ M☉
 *   Schwarzschild radius: ~0.08 AU  → ~4.8 scene units (unresolvable; visualised symbolically)
 *   Distance:     26,000 ly         → placed at fixed background position (not to scale)
 *
 * Renders:
 *  1. Event horizon sphere (deep black)
 *  2. Gravitational lensing halo (distortion fringe shader)
 *  3. Accretion disk (animated ShaderMaterial torus with magnetic field spiralisation)
 *  4. Relativistic jets (two particle cones along z-axis)
 *  5. Particle heat-bath (InstancedMesh hot gas cloud)
 *
 * Positioned directly "above" the scene (y = 3000) so it appears as a prominent
 * feature in the upper sky without interfering with the solar system plane.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Constants ────────────────────────────────────────────────────────────────
// Symbolic scaling:  Schwarzschild radius of 4M M☉ ≈ 0.08 AU → we visualise at 28 scene units
const HORIZON_RADIUS   = 18;   // event horizon sphere
const LENS_RADIUS      = 38;   // gravitational lens halo
const DISK_INNER       = 22;   // accretion disk inner edge
const DISK_OUTER       = 70;   // accretion disk outer edge
const JET_LENGTH       = 160;  // relativistic jet cone length
const SCENE_POSITION   = new THREE.Vector3(2400, 800, -1800);

// Real Sgr A* mass in solar masses (informational, used to scale effects)
export const SGR_A_MASS_SOLAR = 4_154_000;

// ─── Deterministic PRNG ───────────────────────────────────────────────────────
function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

// ─── Accretion Disk Material ──────────────────────────────────────────────────
function createDiskMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      varying float vDist;
      uniform float uTime;

      void main() {
        vUv  = uv;
        vDist = length(position.xz);
        // Relativistic frame dragging: inner disk rotates faster
        float speed = 0.15 / max(0.01, vDist * 0.012);
        float twist = uTime * speed;
        mat2 rot = mat2(cos(twist), -sin(twist), sin(twist), cos(twist));
        vec3 pos = position;
        pos.xz = rot * pos.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vDist;
      uniform float uTime;

      void main() {
        // Radial gradient: white-hot at inner edge, red/orange mid, transparent outer
        float t = clamp((vDist - ${DISK_INNER.toFixed(1)}) / ${(DISK_OUTER - DISK_INNER).toFixed(1)}, 0.0, 1.0);

        // Turbulent plasma bands
        float band  = sin(vUv.x * 18.0 + uTime * 2.3) * 0.5 + 0.5;
        float band2 = sin(vUv.x * 6.0  - uTime * 0.9) * 0.5 + 0.5;
        float plasma = mix(band, band2, 0.4) * (1.0 - t * 0.7);

        // Colour ramp: near-white → orange → red → transparent
        vec3 col = mix(
          mix(vec3(1.0, 0.95, 0.75), vec3(1.0, 0.42, 0.08), t * 1.4),
          vec3(0.6, 0.05, 0.02),
          clamp(t * 1.8 - 0.8, 0.0, 1.0)
        );
        col *= 1.2 + plasma * 0.6;

        float alpha = (1.0 - smoothstep(0.75, 1.0, t)) * (0.65 + plasma * 0.25);

        // Thin the disk vertically: vUv.y centred at 0.5
        float vert = 1.0 - abs(vUv.y - 0.5) * 4.0;
        alpha *= clamp(vert, 0.0, 1.0);

        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
      }
    `,
  });
}

// ─── Gravitational Lens Halo Material ────────────────────────────────────────
function createLensMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    toneMapped: false,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPos    = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPos;

      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(-vPos))), 3.2);
        // Animated ring arcs (Einstein rings)
        float ring = sin(fresnel * 14.0 + uTime * 0.6) * 0.5 + 0.5;
        ring *= fresnel;

        vec3 col = mix(vec3(0.95, 0.70, 0.10), vec3(0.6, 0.9, 1.0), fresnel);
        gl_FragColor = vec4(col, ring * 0.55);
      }
    `,
  });
}

// ─── Relativistic Jet Material ────────────────────────────────────────────────
function createJetMaterial(dir: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDir: { value: dir } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDir;
      varying vec2 vUv;
      void main() {
        // vUv.y = 0 at apex (black hole), 1 at tip
        float axi  = vUv.y;
        float ring = sin(axi * 24.0 + uTime * uDir * 4.0) * 0.5 + 0.5;
        vec3 col   = mix(vec3(0.3, 0.6, 1.0), vec3(0.9, 0.95, 1.0), 1.0 - axi);
        float a    = (1.0 - axi) * 0.5 * ring;
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.7));
      }
    `,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export const SagittariusA: React.FC = () => {
  const diskRef    = useRef<THREE.Mesh>(null!);
  const lensRef    = useRef<THREE.Mesh>(null!);
  const jetUpRef   = useRef<THREE.Mesh>(null!);
  const jetDnRef   = useRef<THREE.Mesh>(null!);
  const cloudRef   = useRef<THREE.InstancedMesh>(null!);

  // Disk geometry (ring)
  const diskGeo = useMemo(() => {
    return new THREE.RingGeometry(DISK_INNER, DISK_OUTER, 128, 8);
  }, []);

  const diskMat = useMemo(createDiskMaterial, []);
  const lensMat = useMemo(createLensMaterial, []);
  const jetUpMat = useMemo(() => createJetMaterial(1), []);
  const jetDnMat = useMemo(() => createJetMaterial(-1), []);

  // Hot gas cloud (InstancedMesh points around the disk)
  const { cloudGeo, cloudMat, cloudData } = useMemo(() => {
    const rng = mkRng(0xc0ffee);
    const N = 380;
    const positions: number[] = [];
    const data: Array<{ r: number; theta: number; y: number; speed: number }> = [];

    for (let i = 0; i < N; i++) {
      const r    = DISK_INNER * 1.1 + rng() * (DISK_OUTER * 0.9 - DISK_INNER * 1.1);
      const th   = rng() * Math.PI * 2;
      const y    = (rng() - 0.5) * 18;
      const speed= 0.04 + rng() * 0.12;
      positions.push(Math.cos(th) * r, y, Math.sin(th) * r);
      data.push({ r, theta: th, y, speed });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: '#ff8844',
      size: 1.8,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    // InstancedMesh for clickable hot-gas puffs
    const iGeo = new THREE.SphereGeometry(0.8, 4, 4);
    const iMat = new THREE.MeshBasicMaterial({
      color: '#ff5500',
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });

    return { cloudGeo: geo, cloudMat: mat, cloudData: data, iGeo, iMat };
  }, []);

  // Animate
  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Disk rotation
    if (diskRef.current) {
      (diskRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    }
    // Lens
    if (lensRef.current) {
      (lensRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      lensRef.current.rotation.y = t * 0.04;
    }
    // Jets
    if (jetUpRef.current)
      (jetUpRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    if (jetDnRef.current)
      (jetDnRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;

    // Animate cloud points
    if (cloudRef.current) {
      const posAttr = cloudRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      cloudData.forEach((p, i) => {
        const theta = p.theta + t * p.speed;
        posAttr.setXYZ(i, Math.cos(theta) * p.r, p.y + Math.sin(t * 0.3 + i) * 0.8, Math.sin(theta) * p.r);
      });
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group position={SCENE_POSITION.toArray()}>
      {/* Event Horizon — pure black sphere */}
      <mesh>
        <sphereGeometry args={[HORIZON_RADIUS, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Photon sphere — very thin bright ring at 1.5× horizon */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[HORIZON_RADIUS * 1.52, 0.8, 12, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
      </mesh>

      {/* Gravitational lens halo */}
      <mesh ref={lensRef}>
        <sphereGeometry args={[LENS_RADIUS, 48, 48]} />
        <primitive object={lensMat} attach="material" />
      </mesh>

      {/* Accretion disk */}
      <mesh ref={diskRef} rotation={[Math.PI * 0.12, 0, 0]}>
        <primitive object={diskGeo} attach="geometry" />
        <primitive object={diskMat} attach="material" />
      </mesh>

      {/* Relativistic jet — upward */}
      <mesh ref={jetUpRef} rotation={[0, 0, 0]}>
        <coneGeometry args={[14, JET_LENGTH, 32, 1, true]} />
        <primitive object={jetUpMat} attach="material" />
      </mesh>

      {/* Relativistic jet — downward */}
      <mesh ref={jetDnRef} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[14, JET_LENGTH, 32, 1, true]} />
        <primitive object={jetDnMat} attach="material" />
      </mesh>

      {/* Hot gas cloud points */}
      <points ref={cloudRef} geometry={cloudGeo} material={cloudMat} />
    </group>
  );
};
