import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface MagneticTailVisualizerProps {
  planetPosition: THREE.Vector3;
  color: string;
  standoffDistance: number;
}

export const MagneticTailVisualizer = ({
  planetPosition,
  color,
  standoffDistance,
}: MagneticTailVisualizerProps) => {
  const groupRef = useRef<THREE.Group>(null!);
  const streamersRef = useRef<Array<THREE.Points<any> | null>>([]);
  const coreRef = useRef<THREE.Mesh>(null!);

  // Create particle streamers - wispy plasma trails [cite: 2025-11-03]
  const streamers = useMemo(() => {
    const streamerCount = 12; // Number of plasma streams
    const particlesPerStreamer = 80; // Particles per stream
    const streamerData = [];

    for (let s = 0; s < streamerCount; s++) {
      const positions = new Float32Array(particlesPerStreamer * 3);
      const sizes = new Float32Array(particlesPerStreamer);
      const alphas = new Float32Array(particlesPerStreamer);

      // Spread streamers around magnetotail in cone pattern
      const angle = (s / streamerCount) * Math.PI * 2;
      const radiusVariation = 0.4 + Math.random() * 0.3;

      for (let i = 0; i < particlesPerStreamer; i++) {
        const t = i / particlesPerStreamer;
        
        // Particles flow from planet outward in expanding cone
        const z = -t * 25; // Tail extends behind planet
        const spreadFactor = Math.pow(t, 1.5) * 1.8; // Exponential spread
        const wobble = Math.sin(t * 8 + s * 0.5) * 0.15; // Sinusoidal wave
        
        const radius = radiusVariation * spreadFactor;
        const x = Math.cos(angle) * radius + wobble;
        const y = Math.sin(angle) * radius + wobble * 0.5;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Size decreases along tail
        sizes[i] = (1 - t * 0.7) * (0.08 + Math.random() * 0.06);
        
        // Alpha fades at extremes
        alphas[i] = Math.sin(t * Math.PI) * (0.6 + Math.random() * 0.3);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

      streamerData.push({
        geometry,
        offset: Math.random() * Math.PI * 2, // Random phase offset
        speed: 0.3 + Math.random() * 0.4, // Varying flow speeds
      });
    }

    return streamerData;
  }, []);

  // Create shader material for plasma particles
  const particleMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uCompression: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        varying float vAlpha;
        uniform float uTime;
        uniform float uCompression;
        
        void main() {
          vAlpha = alpha;
          vec3 pos = position;
          
          // Pulsing motion along tail
          float wave = sin(pos.z * 0.5 + uTime * 2.0) * 0.1;
          pos.x += wave * (1.0 + uCompression);
          pos.y += wave * 0.5 * (1.0 + uCompression);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * 150.0 * (1.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uCompression;
        varying float vAlpha;
        
        void main() {
          // Soft circular particles
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float intensity = 1.0 - (dist * 2.0);
          intensity = pow(intensity, 2.0);
          
          // Brighter during compression events
          float boost = 1.0 + uCompression * 0.8;
          
          gl_FragColor = vec4(uColor, vAlpha * intensity * boost);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }, [color]);

  useFrame((state) => {
    if (!groupRef.current) return;

    const direction = planetPosition.clone().normalize();
    const compression = Math.max(0, Math.min(1, (6 - standoffDistance) / 6));
    const tailLength = Math.max(2, standoffDistance * 2) * (1 + compression * 1.2);

    // Position tail behind planet
    const tailOffset = direction.multiplyScalar(standoffDistance * 0.15);
    groupRef.current.position.copy(planetPosition.clone().add(tailOffset));
    groupRef.current.lookAt(planetPosition);

    // Scale based on compression
    const lateralScale = 1 - compression * 0.45;
    const longitudinalScale = tailLength / 15;
    groupRef.current.scale.set(lateralScale, lateralScale, longitudinalScale);

    // Update particle material uniforms
    particleMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    particleMaterial.uniforms.uCompression.value = compression;
    particleMaterial.uniforms.uColor.value.set(color);

    // Animate each streamer with flowing motion
    streamersRef.current.forEach((points, index) => {
      if (!points) return;
      const data = streamers[index];
      const flowPhase = state.clock.elapsedTime * data.speed + data.offset;
      
      // Rotate streamers for dynamic swirling effect
      points.rotation.z = flowPhase * 0.15;
    });

    // Pulse core glow during high compression
    if (coreRef.current) {
      const pulseMaterial = coreRef.current.material as THREE.MeshBasicMaterial;
      pulseMaterial.opacity = (0.15 + compression * 0.15) * (0.8 + Math.sin(state.clock.elapsedTime * 2) * 0.2);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Core glow - subtle plasma accumulation point */}
      <mesh ref={coreRef} position={[0, 0, -2]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Particle streamers - wispy plasma flows */}
      {streamers.map((data, index) => (
        <points
          key={index}
          ref={(el) => {
            if (el) streamersRef.current[index] = el;
          }}
          geometry={data.geometry}
          material={particleMaterial}
        />
      ))}

      {/* Ethereal plasma cone — AdditiveBlending, no depth write, no wireframe */}
      <mesh position={[0, 0, -8]}>
        <coneGeometry args={[1.2, 16, 32, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};
