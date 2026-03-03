import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * EarthCloudLayer.tsx
 *
 * Renders a semi-transparent cloud shell just above the Earth sphere.
 *
 * TWO cloud sources (priority order):
 *  1. Live: composited from OpenWeatherMap "clouds/new" tile layer
 *     GET https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=API_KEY
 *     (uses allorigins proxy for CORS)
 *
 *  2. Fallback: static NASA visible-earth cloud texture from the public CDN,
 *     animated with a gentle east–west drift to simulate daily rotation.
 *
 * The cloud layer sits at EARTH_RADIUS_SCENE + CLOUD_OFFSET above the surface.
 *
 * Props:
 *   earthPos       — scene position of Earth (matches BowShock/ISS)
 *   visible        — toggle
 *   owmApiKey      — optional OpenWeatherMap API key
 *   opacity        — overall cloud opacity (0–1, default 0.55)
 */

const EARTH_RADIUS    = 2.2;
const CLOUD_OFFSET    = 0.08;          // just above surface
const CLOUD_RADIUS    = EARTH_RADIUS + CLOUD_OFFSET;
const DRIFT_SPEED     = 0.0005;        // radians/s — eastward drift

// Static fallback cloud texture (NASA visible earth, public domain)
const FALLBACK_CLOUD_URL =
  'https://api.allorigins.win/raw?url=' +
  encodeURIComponent('https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg');

// Thin cloud-shader that composites R-channel as alpha
const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragmentShader = /* glsl */ `
  uniform sampler2D uCloudTex;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 texel = texture2D(uCloudTex, vUv);
    // Cloud density from red channel (works for both OWM and NASA texture)
    float cloud = texel.r;
    if (cloud < 0.08) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, cloud * uOpacity);
  }
`;

interface EarthCloudLayerProps {
  earthPos?: THREE.Vector3;
  visible?: boolean;
  owmApiKey?: string;
  opacity?: number;
}

export default function EarthCloudLayer({
  earthPos = new THREE.Vector3(60, 0, 0),
  visible = true,
  owmApiKey,
  opacity = 0.55,
}: EarthCloudLayerProps) {
  const meshRef    = useRef<THREE.Mesh>(null!);
  const matRef     = useRef<THREE.ShaderMaterial>(null!);
  const driftAngle = useRef(0);

  // Load cloud texture — OWM if key provided, else NASA fallback
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const url = owmApiKey
      ? `https://api.allorigins.win/raw?url=${encodeURIComponent(
          `https://tile.openweathermap.org/map/clouds_new/1/0/0.png?appid=${owmApiKey}`,
        )}`
      : FALLBACK_CLOUD_URL;

    const tex = loader.load(url, () => {
      if (matRef.current) {
        matRef.current.uniforms.uCloudTex.value = tex;
        matRef.current.needsUpdate = true;
      }
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [owmApiKey]);

  // Refresh texture every 15 minutes when OWM key provided
  useEffect(() => {
    if (!owmApiKey) return;
    const id = setInterval(() => {
      texture.needsUpdate = true;
    }, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [owmApiKey, texture]);

  useFrame((_state, delta) => {
    if (!meshRef.current || !visible) return;
    // Gentle eastward drift (one full rotation ≈ 35 min in real time)
    driftAngle.current += delta * DRIFT_SPEED;
    meshRef.current.rotation.y = driftAngle.current;
    meshRef.current.position.copy(earthPos);
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} position={earthPos} renderOrder={2}>
      <sphereGeometry args={[CLOUD_RADIUS, 64, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={cloudVertexShader}
        fragmentShader={cloudFragmentShader}
        uniforms={{
          uCloudTex: { value: texture },
          uOpacity:  { value: opacity },
        }}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}
