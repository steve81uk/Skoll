import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const EnhancedStarfield = () => {
  const starsRef = useRef<THREE.Points>(null!);
  const nebulaRef = useRef<THREE.Points>(null!);
  // Frame counter for throttled shader updates.
  // Stars update every 3 frames (twinkling ~20fps is imperceptible at 60fps).
  // Nebula updates every 6 frames (drift is extremely slow, ~10fps sufficient).
  const frameCountRef = useRef(0);

  // Dense star field
  const starGeometry = useMemo(() => {
    const count = 15000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spherical distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 250 + Math.random() * 100;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Star colors - blue, white, yellow, red
      const temp = Math.random();
      if (temp < 0.3) {
        // Blue-white (hot stars)
        colors[i * 3] = 0.7 + Math.random() * 0.3;
        colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
        colors[i * 3 + 2] = 1.0;
      } else if (temp < 0.7) {
        // White-yellow (sun-like)
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.95 + Math.random() * 0.05;
        colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
      } else {
        // Orange-red (cool stars)
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.5 + Math.random() * 0.3;
        colors[i * 3 + 2] = 0.3 + Math.random() * 0.2;
      }

      sizes[i] = Math.random() < 0.05 ? 2.5 + Math.random() : 0.8 + Math.random() * 0.4;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, []);

  // Nebula clouds
  const nebulaGeometry = useMemo(() => {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Clustered in specific regions
      const cluster = Math.floor(Math.random() * 3);
      const theta = (cluster * Math.PI * 2) / 3 + (Math.random() - 0.5) * 1.2;
      const phi = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
      const r = 200 + Math.random() * 80;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Nebula colors - purple, cyan, pink
      const nebulaType = Math.random();
      if (nebulaType < 0.33) {
        // Purple
        colors[i * 3] = 0.5 + Math.random() * 0.3;
        colors[i * 3 + 1] = 0.2 + Math.random() * 0.2;
        colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
      } else if (nebulaType < 0.66) {
        // Cyan
        colors[i * 3] = 0.2 + Math.random() * 0.2;
        colors[i * 3 + 1] = 0.6 + Math.random() * 0.3;
        colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
      } else {
        // Pink
        colors[i * 3] = 0.9 + Math.random() * 0.1;
        colors[i * 3 + 1] = 0.3 + Math.random() * 0.2;
        colors[i * 3 + 2] = 0.5 + Math.random() * 0.3;
      }

      sizes[i] = 8 + Math.random() * 12;
      alphas[i] = 0.1 + Math.random() * 0.15;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    return geo;
  }, []);

  const starMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uTime;
        
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Subtle twinkling
          float twinkle = sin(uTime * 3.0 + position.x * 100.0) * 0.15 + 1.0;
          
          gl_PointSize = size * twinkle * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          // Sharp star points
          float intensity = 1.0 - smoothstep(0.0, 0.5, dist);
          intensity = pow(intensity, 2.0);
          
          gl_FragColor = vec4(vColor, intensity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
  }, []);

  const nebulaMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        
        void main() {
          vColor = color;
          vAlpha = alpha;
          
          // Slow drift
          vec3 pos = position;
          pos.x += sin(uTime * 0.1 + position.y * 0.01) * 2.0;
          pos.y += cos(uTime * 0.15 + position.z * 0.01) * 2.0;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          // Soft, billowy clouds
          float intensity = 1.0 - smoothstep(0.0, 0.5, dist);
          intensity = pow(intensity, 0.8);
          
          gl_FragColor = vec4(vColor, vAlpha * intensity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
  }, []);

  useFrame((state) => {
    frameCountRef.current++;

    if (starsRef.current && frameCountRef.current % 3 === 0) {
      const mat = starsRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
      // Very slow rotation for parallax effect — no per-frame matrix recompute needed.
      starsRef.current.rotation.y += 0.00015; // 3× less frequent = same apparent speed
    }

    if (nebulaRef.current && frameCountRef.current % 6 === 0) {
      const mat = nebulaRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <>
      <points ref={starsRef} geometry={starGeometry} material={starMaterial} />
      <points ref={nebulaRef} geometry={nebulaGeometry} material={nebulaMaterial} />
    </>
  );
};
