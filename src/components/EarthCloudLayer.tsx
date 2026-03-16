import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
const EARTH_SIDEREAL_SECONDS = 86164.0905;

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
  currentDate?: Date;
  isLiveMode?: boolean;
}

export default function EarthCloudLayer({
  earthPos = new THREE.Vector3(60, 0, 0),
  visible = true,
  owmApiKey,
  opacity = 0.55,
  currentDate,
  isLiveMode = true,
}: EarthCloudLayerProps) {
  const { camera } = useThree();
  const meshRef    = useRef<THREE.Mesh>(null!);
  const matRef     = useRef<THREE.ShaderMaterial>(null!);
  const loaderRef = useRef(new THREE.TextureLoader());
  const textureRef = useRef<THREE.Texture | null>(null);

  const buildCloudUrl = useMemo(() => {
    if (!owmApiKey) {
      return () => FALLBACK_CLOUD_URL;
    }
    return () => {
      const raw = `https://tile.openweathermap.org/map/clouds_new/0/0/0.png?appid=${owmApiKey}&ts=${Date.now()}`;
      return `https://api.allorigins.win/raw?url=${encodeURIComponent(raw)}`;
    };
  }, [owmApiKey]);

  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const lodFadeRef = useRef(1);

  useEffect(() => {
    let mounted = true;
    const loadTexture = () => {
      const nextUrl = buildCloudUrl();
      loaderRef.current.load(nextUrl, (nextTex) => {
        if (!mounted) {
          nextTex.dispose();
          return;
        }
        nextTex.colorSpace = THREE.SRGBColorSpace;
        nextTex.wrapS = THREE.RepeatWrapping;
        nextTex.wrapT = THREE.ClampToEdgeWrapping;
        setTexture((prev) => {
          if (prev) {
            prev.dispose();
          }
          textureRef.current = nextTex;
          return nextTex;
        });
      });
    };

    loadTexture();
    const refreshMs = owmApiKey ? 10 * 60 * 1000 : 30 * 60 * 1000;
    const id = window.setInterval(loadTexture, refreshMs);
    return () => {
      mounted = false;
      window.clearInterval(id);
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, [buildCloudUrl, owmApiKey]);

  useFrame((_, delta) => {
    if (!meshRef.current || !visible) return;
    const motionTimeMs = isLiveMode ? Date.now() : (currentDate?.getTime() ?? Date.now());
    const turns = (motionTimeMs / 1000) / EARTH_SIDEREAL_SECONDS;
    meshRef.current.rotation.y = (turns % 1) * Math.PI * 2;
    meshRef.current.position.copy(earthPos);

    const distance = camera.position.distanceTo(earthPos);
    const targetFade = 1 - THREE.MathUtils.smoothstep(distance, 130, 460);
    const smooth = 1 - Math.exp(-delta * 6.5);
    lodFadeRef.current = THREE.MathUtils.lerp(lodFadeRef.current, targetFade, smooth);

    if (texture && matRef.current) {
      matRef.current.uniforms.uCloudTex.value = texture;
      matRef.current.uniforms.uOpacity.value = opacity * lodFadeRef.current;
    }
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} position={earthPos} renderOrder={8}>
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
        depthTest
        depthWrite={false}
        alphaTest={0.02}
        polygonOffset
        polygonOffsetFactor={-3}
        polygonOffsetUnits={-3}
        side={THREE.FrontSide}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}
