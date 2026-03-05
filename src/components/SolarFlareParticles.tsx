import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Constants ────────────────────────────────────────────────────────────────
const SUN_RADIUS = 4.0;
const ARC_COUNT  = 8;    // distinct flare arc loops
const ARC_SEGS   = 80;   // particles per arc
const ARC_TOTAL  = ARC_COUNT * ARC_SEGS;

interface SolarFlareParticlesProps {
  intensity: number;
  isHistoricalEvent?: boolean;
  solarWindSpeed?: number;
}

export const SolarFlareParticles = ({ 
  intensity, 
  isHistoricalEvent = false,
  solarWindSpeed = 450 
}: SolarFlareParticlesProps) => {
  const particlesRef = useRef<THREE.Points>(null!);
  const arcRef = useRef<THREE.Points>(null!);
  
  const particleCount = isHistoricalEvent ? 800 : 400;
  const flareActive = intensity > 1.5 || solarWindSpeed > 800;

  // Create particle geometry
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const lifetimes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Spawn near sun surface (sun radius now 8)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 8 + Math.random() * 1.5;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Radial velocity with some randomness
      const speed = 0.8 + Math.random() * 1.2;
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      velocities[i * 3 + 2] = Math.cos(phi) * speed;

      sizes[i] = 0.15 + Math.random() * 0.25;
      lifetimes[i] = Math.random(); // Random starting life phase
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: intensity },
        uFlareActive: { value: flareActive ? 1.0 : 0.0 },
      },
      vertexShader: `
        attribute vec3 velocity;
        attribute float size;
        attribute float lifetime;
        uniform float uTime;
        uniform float uIntensity;
        varying float vAlpha;
        
        void main() {
          // Particle lifecycle
          float life = mod(lifetime + uTime * 0.3, 1.0);
          vAlpha = sin(life * 3.14159) * uIntensity;
          
          // Expand outward from sun
          vec3 pos = position + velocity * life * 35.0;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * 100.0 * (1.0 / -mvPosition.z) * (1.0 - life * 0.5);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uFlareActive;
        varying float vAlpha;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float intensity = 1.0 - (dist * 2.0);
          intensity = pow(intensity, 1.5);
          
          // Color shifts from yellow to orange-red during flares
          vec3 baseColor = mix(
            vec3(1.0, 0.85, 0.3),
            vec3(1.0, 0.4, 0.1),
            uFlareActive
          );
          
          gl_FragColor = vec4(baseColor, vAlpha * intensity * 0.6);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    return { geometry: geo, material: mat };
  }, [particleCount, intensity, flareActive]);

  // ─── Arc emitter system (Rodrigues-rotation flare loops) ──────────────────
  const arcSystem = useMemo(() => {
    const positions = new Float32Array(ARC_TOTAL * 3);
    const arcAxes   = new Float32Array(ARC_TOTAL * 3);
    const arcHeights = new Float32Array(ARC_TOTAL);
    const arcSpeeds  = new Float32Array(ARC_TOTAL);
    const lifetimes  = new Float32Array(ARC_TOTAL);

    const tmpDir  = new THREE.Vector3();
    const tmpUp   = new THREE.Vector3();
    const tmpAxis = new THREE.Vector3();

    for (let a = 0; a < ARC_COUNT; a++) {
      // Random origin direction on sun surface
      const theta = (a / ARC_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const phi   = (Math.random() - 0.5) * Math.PI * 0.7;
      tmpDir.set(
        Math.cos(phi) * Math.cos(theta),
        Math.sin(phi),
        Math.cos(phi) * Math.sin(theta),
      ).normalize();

      // Perpendicular axis (tangential, so arc loops back to surface)
      tmpUp.set(
        -(Math.random() - 0.5),
        1 - Math.abs(tmpDir.y) * 0.5,
        -(Math.random() - 0.5),
      ).normalize();
      tmpAxis.crossVectors(tmpDir, tmpUp).normalize();

      const arcH = 2.2 + Math.random() * 3.8; // arc apex height above surface
      const arcSp = 0.18 + Math.random() * 0.22;

      for (let s = 0; s < ARC_SEGS; s++) {
        const idx = a * ARC_SEGS + s;
        // Seed position = origin direction × sun surface
        positions[idx * 3]     = tmpDir.x * SUN_RADIUS;
        positions[idx * 3 + 1] = tmpDir.y * SUN_RADIUS;
        positions[idx * 3 + 2] = tmpDir.z * SUN_RADIUS;

        arcAxes[idx * 3]     = tmpAxis.x;
        arcAxes[idx * 3 + 1] = tmpAxis.y;
        arcAxes[idx * 3 + 2] = tmpAxis.z;

        arcHeights[idx] = arcH;
        arcSpeeds[idx]  = arcSp;
        lifetimes[idx]  = s / ARC_SEGS; // stagger particles along the arc
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',  new THREE.BufferAttribute(positions,  3));
    geo.setAttribute('arcAxis',   new THREE.BufferAttribute(arcAxes,    3));
    geo.setAttribute('arcHeight', new THREE.BufferAttribute(arcHeights, 1));
    geo.setAttribute('arcSpeed',  new THREE.BufferAttribute(arcSpeeds,  1));
    geo.setAttribute('lifetime',  new THREE.BufferAttribute(lifetimes,  1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uIntensity:  { value: intensity },
        uFlareActive:{ value: flareActive ? 1.0 : 0.0 },
      },
      vertexShader: `
        attribute vec3  arcAxis;
        attribute float arcHeight;
        attribute float arcSpeed;
        attribute float lifetime;
        uniform float uTime;
        uniform float uIntensity;
        varying float vAlpha;
        varying float vHeight;

        // Rodrigues rotation of v around unit axis k by angle a
        vec3 rodrigues(vec3 v, vec3 k, float a) {
          return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a));
        }

        void main() {
          // Each particle marches along its arc parameterised by t
          float t   = mod(lifetime + uTime * arcSpeed, 1.0);
          float ang = t * 3.14159265;

          // Rotate origin unit dir around arcAxis
          vec3 dir0 = normalize(position); // origin on sun surface
          vec3 rotated = rodrigues(dir0, arcAxis, ang);

          // Height: parabolic profile peaks at t=0.5
          float h = sin(t * 3.14159265) * arcHeight;
          vHeight = h / arcHeight;

          vec3 pos = normalize(rotated) * (${SUN_RADIUS.toFixed(1)} + h);

          vAlpha = sin(t * 3.14159265) * uIntensity * 0.9;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 80.0 * (1.0 / -mvPosition.z) * mix(1.2, 0.6, t);
          gl_Position  = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uFlareActive;
        varying float vAlpha;
        varying float vHeight;

        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;

          float soft = 1.0 - (d * 2.0);
          soft = pow(soft, 1.8);

          // White-hot at apex, orange at roots
          vec3 col = mix(
            vec3(1.0, 0.55, 0.15),   // root: orange
            vec3(1.0, 0.95, 0.75),   // apex: near-white
            clamp(vHeight, 0.0, 1.0)
          );

          gl_FragColor = vec4(col, vAlpha * soft * mix(0.35, 0.7, uFlareActive));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    return { geometry: geo, material: mat };
   
  }, [intensity, flareActive]);

  useFrame((state) => {
    if (particlesRef.current) {
      const mat = particlesRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
      mat.uniforms.uIntensity.value = intensity;
      mat.uniforms.uFlareActive.value = flareActive ? 1.0 : 0.0;
    }
    if (arcRef.current) {
      const mat = arcRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
      mat.uniforms.uIntensity.value = intensity;
      mat.uniforms.uFlareActive.value = flareActive ? 1.0 : 0.0;
    }
  });

  if (!flareActive && !isHistoricalEvent) return null;

  return (
    <>
      <points ref={particlesRef} geometry={geometry} material={material} />
      <points ref={arcRef} geometry={arcSystem.geometry} material={arcSystem.material} />
    </>
  );
};
