import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AtmosphericGlowProps {
  radius: number;
  color: string;
  intensity?: number;
  hasAtmosphere?: boolean;
}

export const AtmosphericGlow = ({ 
  radius, 
  color, 
  intensity = 1.0,
  hasAtmosphere = true 
}: AtmosphericGlowProps) => {
  const glowRef = useRef<THREE.Mesh>(null!);
  
  if (!hasAtmosphere) return null;

  useFrame((state) => {
    if (!glowRef.current) return;
    
    // Gentle pulsing
    const pulse = Math.sin(state.clock.elapsedTime * 0.8) * 0.08 + 1;
    glowRef.current.scale.setScalar(pulse);
    
    const mat = glowRef.current.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={glowRef}>
      <sphereGeometry args={[radius * 1.12, 32, 32]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uIntensity: { value: intensity },
        }}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          varying vec3 vPosition;
          
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          varying vec3 vPosition;
          
          void main() {
            // Fresnel effect - glow at edges
            vec3 viewDir = normalize(vViewPosition);
            float fresnel = 1.0 - abs(dot(viewDir, vNormal));
            fresnel = pow(fresnel, 3.0);
            
            // Subtle atmospheric shimmer
            float shimmer = sin(vPosition.x * 5.0 + uTime * 2.0) * 0.1 + 1.0;
            shimmer *= sin(vPosition.y * 3.0 - uTime * 1.5) * 0.1 + 1.0;
            
            float alpha = fresnel * uIntensity * shimmer * 0.4;
            
            gl_FragColor = vec4(uColor, alpha);
          }
        `}
      />
    </mesh>
  );
};
