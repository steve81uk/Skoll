import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EarthWindStreamlinesProps {
  earthPos?: THREE.Vector3;
  visible?: boolean;
  opacity?: number;
  streamCount?: number;
  speedScale?: number;
  currentDate?: Date;
  isLiveMode?: boolean;
}

const EARTH_RADIUS = 2.2;
const STREAM_RADIUS = EARTH_RADIUS + 0.17;
const EARTH_SIDEREAL_SECONDS = 86164.0905;
const TRAIL_POINTS = 10;

type StreamState = {
  lat: number;
  lon: number;
  history: THREE.Vector3[];
};

function wrapLon(lon: number) {
  let out = lon;
  while (out > 180) out -= 360;
  while (out < -180) out += 360;
  return out;
}

function toXYZ(latDeg: number, lonDeg: number, radius: number) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const cosLat = Math.cos(lat);
  return new THREE.Vector3(
    radius * cosLat * Math.cos(lon),
    radius * Math.sin(lat),
    radius * cosLat * Math.sin(lon),
  );
}

function sampleWind(latDeg: number, lonDeg: number, t: number) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);

  const zonal =
    18 * Math.sin(2.2 * lat + t * 0.08) +
    10 * Math.cos(3.1 * lon - t * 0.06) +
    6 * Math.sin((lat + lon) * 1.4 + t * 0.03);

  const meridional =
    9 * Math.cos(1.7 * lat - t * 0.05) +
    6 * Math.sin(2.8 * lon + t * 0.04);

  return { zonal, meridional };
}

export default function EarthWindStreamlines({
  earthPos = new THREE.Vector3(60, 0, 0),
  visible = true,
  opacity = 0.52,
  streamCount = 140,
  speedScale = 1,
  currentDate,
  isLiveMode = true,
}: EarthWindStreamlinesProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const lineRef = useRef<THREE.LineSegments>(null!);

  const streams = useMemo<StreamState[]>(() => {
    return Array.from({ length: streamCount }, () => {
      const lat = THREE.MathUtils.randFloatSpread(150);
      const lon = THREE.MathUtils.randFloatSpread(360);
      const seed = toXYZ(lat, lon, STREAM_RADIUS);
      return {
        lat,
        lon,
        history: Array.from({ length: TRAIL_POINTS }, () => seed.clone()),
      };
    });
  }, [streamCount]);

  const positionAttr = useMemo(() => {
    const segmentCount = streamCount * (TRAIL_POINTS - 1);
    return new Float32Array(segmentCount * 2 * 3);
  }, [streamCount]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positionAttr, 3));
    return g;
  }, [positionAttr]);

  useFrame((_, delta) => {
    if (!visible || !groupRef.current || !lineRef.current) return;

    groupRef.current.position.copy(earthPos);
    const motionTimeMs = isLiveMode ? Date.now() : (currentDate?.getTime() ?? Date.now());
    const turns = (motionTimeMs / 1000) / EARTH_SIDEREAL_SECONDS;
    groupRef.current.rotation.y = (turns % 1) * Math.PI * 2;

    const t = motionTimeMs / 1000;
    const dt = Math.min(0.05, Math.max(0.008, delta));

    for (let i = 0; i < streams.length; i++) {
      const s = streams[i];
      const wind = sampleWind(s.lat, s.lon, t);
      const latRad = THREE.MathUtils.degToRad(s.lat);
      const cosLat = Math.max(0.12, Math.cos(latRad));

      const dLat = wind.meridional * dt * 0.018 * speedScale;
      const dLon = (wind.zonal * dt * 0.018 * speedScale) / cosLat;

      s.lat = THREE.MathUtils.clamp(s.lat + dLat, -82, 82);
      s.lon = wrapLon(s.lon + dLon);

      const head = toXYZ(s.lat, s.lon, STREAM_RADIUS);
      for (let p = TRAIL_POINTS - 1; p > 0; p--) {
        s.history[p].copy(s.history[p - 1]);
      }
      s.history[0].copy(head);

      const base = i * (TRAIL_POINTS - 1) * 6;
      for (let p = 0; p < TRAIL_POINTS - 1; p++) {
        const a = s.history[p];
        const b = s.history[p + 1];
        const idx = base + p * 6;
        positionAttr[idx] = a.x;
        positionAttr[idx + 1] = a.y;
        positionAttr[idx + 2] = a.z;
        positionAttr[idx + 3] = b.x;
        positionAttr[idx + 4] = b.y;
        positionAttr[idx + 5] = b.z;
      }
    }

    (lineRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} renderOrder={4}>
      <lineSegments ref={lineRef} geometry={geometry}>
        <lineBasicMaterial
          color="#8ee6ff"
          transparent
          opacity={opacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
