import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SolarFlareParticles } from './SolarFlareParticles';

interface DynamicSunProps {
  intensity: number;
  solarWindSpeed?: number;
  isHistoricalEvent?: boolean;
}

export const DynamicSun = ({ intensity, solarWindSpeed = 450, isHistoricalEvent = false }: DynamicSunProps) => {
  const sunRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const coronaRef = useRef<THREE.Mesh>(null!);
  
  // Extreme events get visual boost
  const eventMultiplier = isHistoricalEvent && solarWindSpeed > 1500 ? 1.5 : 1.0;
  
  // Pulsing animation for active periods
  useFrame((state) => {
    if (!sunRef.current) return;
    
    const t = state.clock.getElapsedTime();
    const pulse = Math.sin(t * 0.8) * 0.15 + 1;
    const flareBoost = solarWindSpeed > 1000 ? Math.sin(t * 2.5) * 0.3 : 0;
    
    // Scale the sun slightly during high activity
    const scale = 1 + (intensity - 1) * 0.08 + flareBoost * 0.05;
    sunRef.current.scale.setScalar(scale);
    
    // Rotate for visual interest
    sunRef.current.rotation.y += 0.0008;
    
    // Outer glow pulsates
    if (glowRef.current) {
      glowRef.current.scale.setScalar(scale * 1.15 * pulse);
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (0.2 + flareBoost * 0.1) * eventMultiplier;
    }

    // Corona rotation - slower, opposite direction
    if (coronaRef.current) {
      coronaRef.current.rotation.z += 0.0003;
      const mat = coronaRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uIntensity.value = intensity;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Core Sun - Reduced size for realistic proportions */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[4, 24, 16]} />
        <meshBasicMaterial color="#ff7a1a" toneMapped={false} />
      </mesh>

      {/* Outer Corona Glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[5, 16, 12]} />
        <meshBasicMaterial
          color={solarWindSpeed > 1500 ? "#ff8800" : "#ffdd00"}
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Animated Corona with Tendrils */}
      <mesh ref={coronaRef} rotation={[0, 0, 0]}>
        <sphereGeometry args={[5.75, 20, 14]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uTime: { value: 0 },
            uIntensity: { value: intensity },
            uColor: { value: new THREE.Color(solarWindSpeed > 1800 ? '#ff4400' : '#ffaa00') },
          }}
          vertexShader={`
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec3 vViewPosition;
            
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vUv = uv;
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              vViewPosition = -mvPosition.xyz;
              gl_Position = projectionMatrix * mvPosition;
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uIntensity;
            uniform vec3 uColor;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec3 vViewPosition;
            
            void main() {
              // Swirling plasma tendrils
              float pattern = sin(vUv.x * 20.0 + uTime * 0.5) * cos(vUv.y * 15.0 - uTime * 0.3);
              pattern += sin(vUv.y * 10.0 + uTime * 0.8);
              pattern = smoothstep(0.2, 0.8, pattern * 0.5 + 0.5);
              
              // Fresnel glow (using view position instead of cameraPosition)
              vec3 viewDir = normalize(vViewPosition);
              float fresnel = 1.0 - abs(dot(viewDir, vNormal));
              fresnel = pow(fresnel, 2.0);
              
              float alpha = fresnel * pattern * 0.15 * uIntensity;
              
              gl_FragColor = vec4(uColor, alpha);
            }
          `}
        />
      </mesh>

      {/* Solar Flare Particles */}
      <SolarFlareParticles 
        intensity={intensity}
        isHistoricalEvent={isHistoricalEvent}
        solarWindSpeed={solarWindSpeed}
      />

      {/* Extreme Event Flare Ring */}
      {isHistoricalEvent && solarWindSpeed > 1800 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[9.5, 12, 40]} />
          <meshBasicMaterial
            color="#ff3300"
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};
