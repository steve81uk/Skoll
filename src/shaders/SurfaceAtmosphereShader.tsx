import * as THREE from 'three';
import { useMemo } from 'react';

const ATMOSPHERE_VERTEX_SHADER = `varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const ATMOSPHERE_FRAGMENT_SHADER = `uniform float uTime;
uniform vec3 uColor;
uniform float uDensity;
uniform float uAtmosphereType;
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  float horizon = smoothstep(-5.0, 20.0, vPosition.y);
  vec3 skyColor = mix(uColor * 0.1, uColor, horizon);

  if (uAtmosphereType > 0.5 && uAtmosphereType < 1.5) {
    skyColor = mix(vec3(0.1, 0.05, 0.05), vec3(0.5, 0.2, 0.1), horizon);
  }

  float shimmer = sin(uTime * 0.5 + vPosition.x * 0.1) * 0.05 * uDensity;
  gl_FragColor = vec4(skyColor + shimmer, 1.0);
}`;

export const SurfaceAtmosphere = ({ color, type, density }: any) => {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uDensity: { value: density },
      uAtmosphereType: { value: type === 'CO2' ? 1.0 : 0.0 },
    }),
    [color, density, type],
  );

  return (
    <mesh position={[0, 45, 0]}>
      <sphereGeometry args={[100, 32, 32]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={ATMOSPHERE_VERTEX_SHADER}
        fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
        side={THREE.BackSide}
        transparent
      />
    </mesh>
  );
};