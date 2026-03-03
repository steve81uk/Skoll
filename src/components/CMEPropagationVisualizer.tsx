import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CMEProps {
  isActive: boolean;
  speed: number; // km/s from telemetry [cite: 2025-12-11]
  onImpact: (planetName: string) => void;
}

export const CMEPropagationVisualizer: React.FC<CMEProps> = ({ isActive, speed, onImpact }) => {
  const shellRef = useRef<THREE.Mesh>(null!);
  const particlesRef = useRef<THREE.Points>(null!);
  const hasImpactedRef = useRef(false);
  
  // Normalized speed for 3D scale (e.g., 2000km/s translates to 3D units/sec) [cite: 2025-12-11]
  const simSpeed = speed * 0.005;

  // Particle system for leading edge turbulence
  const particleGeometry = useMemo(() => {
    const count = 800;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distributed on hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      
      positions[i * 3] = Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = Math.cos(phi);

      // Small radial variations
      velocities[i * 3] = (Math.random() - 0.5) * 0.2;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;

      sizes[i] = 0.1 + Math.random() * 0.15;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, []);

  const particleMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#ff5500') },
      },
      vertexShader: `
        attribute vec3 velocity;
        attribute float size;
        uniform float uTime;
        varying float vIntensity;
        
        void main() {
          vIntensity = 0.5 + sin(uTime * 4.0 + position.x * 10.0) * 0.5;
          
          vec3 pos = position + velocity * sin(uTime * 2.0);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * 200.0 * (1.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vIntensity;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float intensity = 1.0 - (dist * 2.0);
          intensity = pow(intensity, 1.5);
          
          gl_FragColor = vec4(uColor, vIntensity * intensity * 0.6);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    hasImpactedRef.current = false;
    if (shellRef.current) {
      shellRef.current.scale.setScalar(0.1);
    }
    if (particlesRef.current) {
      particlesRef.current.scale.setScalar(0.1);
    }
  }, [isActive]);

  useFrame((state, delta) => {
    if (!isActive || !shellRef.current || !particlesRef.current) return;

    // 1. Expand the plasma shell outward from the Sun (0,0,0) [cite: 2025-12-11]
    const expansion = simSpeed * delta;
    shellRef.current.scale.addScalar(expansion);
    particlesRef.current.scale.addScalar(expansion);
    
    // 2. Update shader uniforms for the "Plasma Shimmer" [cite: 2025-08-11]
    const shellMaterial = shellRef.current.material as THREE.ShaderMaterial;
    shellMaterial.uniforms.uTime.value = state.clock.elapsedTime;

    const particleMat = particlesRef.current.material as THREE.ShaderMaterial;
    particleMat.uniforms.uTime.value = state.clock.elapsedTime;
    
    // Rotate particles for turbulent effect
    particlesRef.current.rotation.x += delta * 0.5;
    particlesRef.current.rotation.y += delta * 0.3;
    
    // 3. Simple Distance-Based Impact Logic [cite: 2025-11-03]
    // If the shell reaches a planet's radius, trigger the impact event [cite: 2025-12-11]
    const currentRadius = shellRef.current.scale.x;
    if (!hasImpactedRef.current && currentRadius > 50 && currentRadius < 52) {
      hasImpactedRef.current = true;
      onImpact('Earth');
    }
  });

  return (
    <group visible={isActive}>
      {/* Leading edge particles - turbulent plasma */}
      <points ref={particlesRef} geometry={particleGeometry} material={particleMaterial} scale={[0.1, 0.1, 0.1]} />

      {/* Main CME shell */}
      <mesh ref={shellRef} position={[0, 0, 0]} scale={[0.1, 0.1, 0.1]}>
        <sphereGeometry args={[1, 64, 64, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <shaderMaterial
          transparent
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uTime: { value: 0 },
            uColor: { value: new THREE.Color('#ff5500') }
          }}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPosition = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform vec3 uColor;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
              float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
              float pulse = sin(uTime * 2.0 + vPosition.x * 10.0) * 0.5 + 0.5;
              
              // Turbulent patterns
              float turbulence = sin(vPosition.x * 15.0 + uTime * 3.0) * cos(vPosition.y * 12.0 - uTime * 2.0);
              turbulence = turbulence * 0.3 + 0.7;
              
              gl_FragColor = vec4(uColor, intensity * 0.35 * pulse * turbulence);
            }
          `}
        />
      </mesh>
    </group>
  );
};