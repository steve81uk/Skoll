import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EarthWeatherLayersProps {
  earthPos?: THREE.Vector3;
  visible?: boolean;
  owmApiKey?: string;
  opacityPrecip?: number;
  opacitySnow?: number;
  opacityWind?: number;
  showPrecip?: boolean;
  showSnow?: boolean;
  showWind?: boolean;
  currentDate?: Date;
  isLiveMode?: boolean;
}

const EARTH_RADIUS = 2.2;
const EARTH_SIDEREAL_SECONDS = 86164.0905;

type LayerKey = 'precip' | 'snow' | 'wind';

type LayerState = Record<LayerKey, THREE.Texture | null>;

const LAYER_META: Record<LayerKey, { map: string; radius: number; opacity: number; color: string }> = {
  precip: { map: 'precipitation_new', radius: EARTH_RADIUS + 0.1, opacity: 0.45, color: '#73ffb3' },
  snow: { map: 'snow', radius: EARTH_RADIUS + 0.12, opacity: 0.55, color: '#dff6ff' },
  wind: { map: 'wind_new', radius: EARTH_RADIUS + 0.14, opacity: 0.36, color: '#8ed4ff' },
};

function buildLayerUrl(apiKey: string, map: string) {
  const raw = `https://tile.openweathermap.org/map/${map}/0/0/0.png?appid=${apiKey}&ts=${Date.now()}`;
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(raw)}`;
}

export default function EarthWeatherLayers({
  earthPos = new THREE.Vector3(60, 0, 0),
  visible = true,
  owmApiKey,
  opacityPrecip,
  opacitySnow,
  opacityWind,
  showPrecip = true,
  showSnow = true,
  showWind = true,
  currentDate,
  isLiveMode = true,
}: EarthWeatherLayersProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const loaderRef = useRef(new THREE.TextureLoader());
  const [layers, setLayers] = useState<LayerState>({ precip: null, snow: null, wind: null });

  useEffect(() => {
    if (!owmApiKey) {
      return;
    }

    let mounted = true;
    const active: THREE.Texture[] = [];

    const loadAll = () => {
      (Object.keys(LAYER_META) as LayerKey[]).forEach((key) => {
        const nextUrl = buildLayerUrl(owmApiKey, LAYER_META[key].map);
        loaderRef.current.load(nextUrl, (nextTex) => {
          if (!mounted) {
            nextTex.dispose();
            return;
          }
          nextTex.colorSpace = THREE.SRGBColorSpace;
          nextTex.wrapS = THREE.RepeatWrapping;
          nextTex.wrapT = THREE.ClampToEdgeWrapping;
          active.push(nextTex);
          setLayers((prev) => {
            prev[key]?.dispose();
            return { ...prev, [key]: nextTex };
          });
        });
      });
    };

    loadAll();
    const id = window.setInterval(loadAll, 10 * 60 * 1000);
    return () => {
      mounted = false;
      window.clearInterval(id);
      active.forEach((tex) => tex.dispose());
    };
  }, [owmApiKey]);

  useFrame(() => {
    if (!groupRef.current || !visible) return;
    groupRef.current.position.copy(earthPos);

    const motionTimeMs = isLiveMode ? Date.now() : (currentDate?.getTime() ?? Date.now());
    const turns = (motionTimeMs / 1000) / EARTH_SIDEREAL_SECONDS;
    groupRef.current.rotation.y = (turns % 1) * Math.PI * 2;
  });

  if (!visible || !owmApiKey) return null;

  return (
    <group ref={groupRef} renderOrder={3}>
      {(Object.keys(LAYER_META) as LayerKey[]).map((key) => {
        if ((key === 'precip' && !showPrecip) || (key === 'snow' && !showSnow) || (key === 'wind' && !showWind)) {
          return null;
        }
        const tex = layers[key];
        if (!tex) return null;
        const layer = LAYER_META[key];
        const alpha = key === 'precip'
          ? (opacityPrecip ?? layer.opacity)
          : key === 'snow'
            ? (opacitySnow ?? layer.opacity)
            : (opacityWind ?? layer.opacity);
        return (
          <mesh key={key} renderOrder={key === 'precip' ? 9 : key === 'snow' ? 10 : 11}>
            <sphereGeometry args={[layer.radius, 64, 32]} />
            <meshBasicMaterial
              map={tex}
              color={layer.color}
              transparent
              opacity={alpha}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        );
      })}
    </group>
  );
}
