import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * LiveISS.tsx
 *
 * Plots the International Space Station in real-time 3D around Earth using
 * the free wheretheiss.at API (no auth required, CORS-enabled).
 *
 * API endpoint: https://api.wheretheiss.at/v1/satellites/25544
 * Returns: { latitude, longitude, altitude (km), velocity (km/h), ... }
 *
 * The ISS is mapped to a sphere of radius EARTH_RADIUS + altitude_scaled
 * at the correct lat/lon, converted to Earth-body XYZ in scene space.
 *
 * Earth centre in the scene is tracked via an `earthPos` prop (same as BowShock).
 * EARTH_RADIUS_SCENE ≈ 2.2 units (as used in ACTIVE_OBJECTS in App.tsx).
 */

const EARTH_RADIUS_SCENE = 2.2;
const POLL_INTERVAL_MS    = 3_000;   // ISS updates every ~5s; poll every 3s
const TRAIL_MAX_POINTS    = 180;     // ~9 min of 3s-interval points = one full orbit strip
const ALLORIGINS          = 'https://api.allorigins.win/raw?url=';

// Convert geodetic lat/lon/alt to 3D unit sphere coords
function latLonAltToVec3(lat: number, lon: number, altKm: number, earthPos: THREE.Vector3): THREE.Vector3 {
  const ALT_SCALE = 0.0005;             // 1 km → 0.0005 scene units (artistic; Earth ~6371km → 2.2u)
  const r = EARTH_RADIUS_SCENE + altKm * ALT_SCALE;
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    earthPos.x + r * Math.sin(phi) * Math.cos(theta),
    earthPos.y + r * Math.cos(phi),
    earthPos.z + r * Math.sin(phi) * Math.sin(theta),
  );
}

interface ISSData {
  latitude: number;
  longitude: number;
  altitude: number;   // km
  velocity: number;   // km/h
  timestamp: number;
  visibility: string;
}

interface LiveISSProps {
  earthPos?: THREE.Vector3;
  visible?: boolean;
}

// ── 2D HUD overlay (rendered as a DOM element via R3F Html or directly in UI) ──
export function LiveISSHUD({ data, visible }: { data: ISSData | null; visible: boolean }) {
  if (!visible || !data) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: '36px',
        right: '16px',
        zIndex: 80,
        background: 'rgba(5,15,30,0.82)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(100,255,180,0.22)',
        borderRadius: '8px',
        padding: '8px 14px',
        minWidth: '180px',
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#80ffcc',
        letterSpacing: '0.08em',
      }}
    >
      <div style={{ fontSize: '8px', color: 'rgba(128,255,200,0.6)', marginBottom: '4px', textTransform: 'uppercase' }}>
        🛰 ISS LIVE TRACK
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px' }}>
        <span style={{ opacity: 0.6 }}>LAT</span>
        <span>{data.latitude.toFixed(2)}°</span>
        <span style={{ opacity: 0.6 }}>LON</span>
        <span>{data.longitude.toFixed(2)}°</span>
        <span style={{ opacity: 0.6 }}>ALT</span>
        <span>{data.altitude.toFixed(0)} km</span>
        <span style={{ opacity: 0.6 }}>VEL</span>
        <span>{(data.velocity / 3.6).toFixed(0)} m/s</span>
        <span style={{ opacity: 0.6 }}>VIS</span>
        <span style={{ color: data.visibility === 'daylight' ? '#ffe066' : '#7090d0' }}>
          {data.visibility}
        </span>
      </div>
    </div>
  );
}

// ── 3D R3F component ──────────────────────────────────────────────────────────
export default function LiveISS({ earthPos = new THREE.Vector3(60, 0, 0), visible = true }: LiveISSProps) {
  const [issData, setIssData] = useState<ISSData | null>(null);
  const dotRef     = useRef<THREE.Mesh>(null!);
  const trailRef   = useRef<THREE.Line>(null!);
  const trailPts   = useRef<THREE.Vector3[]>([]);
  const targetPos  = useRef<THREE.Vector3>(new THREE.Vector3(60, 2.5, 0));
  const currentPos = useRef<THREE.Vector3>(new THREE.Vector3(60, 2.5, 0));

  // Trail geometry + line object — created once
  const trailGeo  = useMemo(() => new THREE.BufferGeometry(), []);
  const trailLine = useMemo(() => {
    const mat  = new THREE.LineBasicMaterial({ color: '#40ddaa', transparent: true, opacity: 0.55, depthWrite: false });
    const line = new THREE.Line(trailGeo, mat);
    line.renderOrder = 2;
    trailRef.current = line;
    return line;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the ISS API
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const fetchISS = async () => {
      try {
        const url = `${ALLORIGINS}${encodeURIComponent('https://api.wheretheiss.at/v1/satellites/25544')}`;
        const res = await fetch(url);
        const json: ISSData = await res.json();
        if (!cancelled) setIssData(json);
      } catch {
        // Silent fail — use last known position
      }
    };

    fetchISS();
    const id = setInterval(fetchISS, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [visible]);

  // Update target position when data arrives
  useEffect(() => {
    if (!issData) return;
    const pos = latLonAltToVec3(issData.latitude, issData.longitude, issData.altitude, earthPos);
    targetPos.current.copy(pos);
    trailPts.current.push(pos.clone());
    if (trailPts.current.length > TRAIL_MAX_POINTS) trailPts.current.shift();
  }, [issData, earthPos]);

  // Trail geometry
  useFrame(() => {
    if (!visible) return;

    // Smooth lerp toward target
    currentPos.current.lerp(targetPos.current, 0.08);

    if (dotRef.current) {
      dotRef.current.position.copy(currentPos.current);
    }

    // Update trail
    if (trailRef.current && trailPts.current.length >= 2) {
      const pts = trailPts.current;
      trailGeo.setFromPoints(pts);
      trailRef.current.geometry = trailGeo;
    }
  });

  if (!visible) return null;

  return (
    <group>
      {/* ISS position dot */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#80ffcc" toneMapped={false} />
      </mesh>

      {/* Orbital trail — use primitive to avoid SVGLineElement TS conflict */}
      <primitive object={trailLine} />

      {/* Glow halo */}
      <mesh position={currentPos.current}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshBasicMaterial color="#40ffcc" transparent opacity={0.10} depthWrite={false} />
      </mesh>
    </group>
  );
}
