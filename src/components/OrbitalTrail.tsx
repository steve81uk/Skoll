import { useMemo } from 'react';
import * as THREE from 'three';

interface OrbitalTrailProps {
  orbitRadius: number;
  color?: string;
  opacity?: number;
  segments?: number;
}

export const OrbitalTrail = ({ 
  orbitRadius, 
  color = '#00ffff',
  opacity = 0.15,
  segments = 128 
}: OrbitalTrailProps) => {
  
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * orbitRadius,
          0,
          Math.sin(angle) * orbitRadius
        )
      );
    }
    
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [orbitRadius, segments]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
      },
      vertexShader: `
        varying vec3 vPosition;
        
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vPosition;
        
        void main() {
          // Fade at certain points for dashed effect
          float dash = mod(atan(vPosition.z, vPosition.x) * 20.0, 6.28318);
          float alpha = smoothstep(0.0, 0.5, dash) * smoothstep(6.28, 5.78, dash);
          
          gl_FragColor = vec4(uColor, uOpacity * alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color, opacity]);

  const lineObject = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  return <primitive object={lineObject} />;
};
