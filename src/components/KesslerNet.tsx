/**
 * SKÖLL-TRACK — KESSLER NET
 * Three.js InstancedMesh orbital debris visualiser.
 *
 * Simulates the Kessler Syndrome debris environment using population models
 * derived from the ESA MASTER-2009 and NASA ORDEM 3.1 catalogues.
 *
 * Orbital shells:
 *   LEO-A  180–600 km     — ~3,000+ trackable objects (dense)
 *   LEO-B  600–1200 km    — Iridium/COSMOS collision remnants
 *   LEO-C  1200–2000 km   — GPS/Molniya transition
 *   MEO    2000–20000 km  — navigation constellation band
 *   GEO    35786 km ±200  — geostationary ring
 *
 * Three.js coordinate: 1 unit = 100 km (so Earth R_e ≈ 63.71 units)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

// ─── Orbital shell definitions ────────────────────────────────────────────────
const DEBRIS_SHELLS = [
  { name:'LEO-A',  altKmMin: 180,  altKmMax:  600, count:1400, color:0xef4444, riskLevel:'CRITICAL',  opacity:0.85 },
  { name:'LEO-B',  altKmMin: 600,  altKmMax: 1200, count: 900, color:0xf97316, riskLevel:'HIGH',      opacity:0.75 },
  { name:'LEO-C',  altKmMin:1200,  altKmMax: 2000, count: 400, color:0xeab308, riskLevel:'MODERATE',  opacity:0.65 },
  { name:'MEO',    altKmMin:2000,  altKmMax:20000, count: 150, color:0x84cc16, riskLevel:'LOW',       opacity:0.50 },
  { name:'GEO',    altKmMin:35586, altKmMax:35986, count: 120, color:0x60c8ff, riskLevel:'MONITORED', opacity:0.80 },
];

const R_EARTH_KM = 6371;
const KM_PER_UNIT = 100;

function kmToUnits(km: number) { return km / KM_PER_UNIT; }

// ─── Deterministic pseudo-random (no re-seeding on re-render) ────────────────
function pcgNext(state: { s: number }): number {
  state.s = (state.s * 1664525 + 1013904223) >>> 0;
  return (state.s >>> 16) / 65536;
}

// ─── Build instance matrices for a shell ─────────────────────────────────────
function buildDebrisMatrices(
  count: number,
  rMinKm: number,
  rMaxKm: number,
  seed: number,
): Float32Array {
  const rng   = { s: seed };
  const mats  = new Float32Array(count * 16);
  const mat4  = new THREE.Matrix4();
  const pos   = new THREE.Vector3();
  const quat  = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < count; i++) {
    const rKm = rMinKm + pcgNext(rng) * (rMaxKm - rMinKm);
    const r   = kmToUnits(R_EARTH_KM + rKm);
    // Random uniform point on sphere
    const theta = Math.acos(1 - 2 * pcgNext(rng));
    const phi   = pcgNext(rng) * Math.PI * 2;
    pos.set(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.cos(theta),
      r * Math.sin(theta) * Math.sin(phi),
    );
    mat4.compose(pos, quat, scale);
    mat4.toArray(mats, i * 16);
  }
  return mats;
}

// ─── Shell Component ──────────────────────────────────────────────────────────
interface ShellProps {
  altKmMin: number;
  altKmMax: number;
  count:    number;
  color:    number;
  opacity:  number;
  seed:     number;
  rotateRad: number; // drift per frame
}

function DebrisShell({ altKmMin, altKmMax, count, color, opacity, seed, rotateRad }: ShellProps) {
  const meshRef   = useRef<THREE.InstancedMesh>(null);
  const groupRef  = useRef<THREE.Group>(null);
  const matrices  = useMemo(() => buildDebrisMatrices(count, altKmMin, altKmMax, seed), [count, altKmMin, altKmMax, seed]);

  // Apply pre-built matrices to InstancedMesh
  useEffect(() => {
    if (!meshRef.current) return;
    const mat4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      mat4.fromArray(matrices, i * 16);
      meshRef.current.setMatrixAt(i, mat4);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices, count]);

  // Differential orbital drift (inner orbits rotate faster)
  const periodDays = Math.pow((R_EARTH_KM + (altKmMin + altKmMax) / 2) / R_EARTH_KM, 1.5) * 1.658;
  const driftRad   = rotateRad / (periodDays * 100);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += driftRad;
      groupRef.current.rotation.x += driftRad * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.15, 3, 3]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

// ─── Earth wireframe reference sphere ────────────────────────────────────────
function EarthReference() {
  return (
    <mesh>
      <sphereGeometry args={[kmToUnits(R_EARTH_KM), 24, 24]} />
      <meshBasicMaterial color={0x0055aa} wireframe transparent opacity={0.28} />
    </mesh>
  );
}

// ─── GEO ring ─────────────────────────────────────────────────────────────────
function GeoRing() {
  const r = kmToUnits(R_EARTH_KM + 35786);
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r - kmToUnits(200), r + kmToUnits(200), 128]} />
      <meshBasicMaterial color={0x60c8ff} transparent opacity={0.12} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── HUD overlay (HTML) ───────────────────────────────────────────────────────
interface KesslerHUDProps {
  kpIndex:   number;
  cmeActive: boolean;
}

function KesslerHUD({ kpIndex, cmeActive }: KesslerHUDProps) {
  const totalDebris = DEBRIS_SHELLS.reduce((s, d) => s + d.count, 0);
  const collisionRisk = Math.min(100, (kpIndex / 9 * 40) + (cmeActive ? 35 : 0));
  const dangerLevel = collisionRisk >= 60 ? 'CRITICAL' : collisionRisk >= 35 ? 'ELEVATED' : 'NOMINAL';
  const dangerColor = collisionRisk >= 60 ? '#ef4444' : collisionRisk >= 35 ? '#f97316' : '#22c55e';

  return (
    <Html position={[kmToUnits(R_EARTH_KM + 2500), kmToUnits(R_EARTH_KM + 2500), 0]} style={{ pointerEvents: 'none' }}>
      <div style={{
        background:    'rgba(3,10,25,0.92)',
        border:        `1px solid ${dangerColor}55`,
        borderRadius:  '8px',
        padding:       '10px 14px',
        fontFamily:    '"Rajdhani","Share Tech Mono",monospace',
        minWidth:      '180px',
        backdropFilter:'blur(8px)',
      }}>
        <div style={{ fontSize:'11px', color:'#60c8ff', marginBottom:'6px' }}>KESSLER NET  /  DEBRIS FIELD</div>
        <div style={{ fontSize:'24px', fontWeight:900, color:'#cce8ff', lineHeight:1, fontFamily:'"Rajdhani",monospace' }}>
          {totalDebris.toLocaleString()}
        </div>
        <div style={{ fontSize:'9px', color:'#7fa8c8', fontFamily:'monospace', marginBottom:'8px' }}>
          TRACKED OBJECTS  (modelled)
        </div>

        {DEBRIS_SHELLS.map((sh) => (
          <div key={sh.name} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%',
              background:`#${sh.color.toString(16).padStart(6,'0')}`, flexShrink:0 }} />
            <span style={{ fontSize:'10px', color:'#aac8e8', fontFamily:'monospace', flex:1 }}>{sh.name}</span>
            <span style={{ fontSize:'10px', color:'#cce8ff', fontFamily:'monospace' }}>{sh.count}</span>
          </div>
        ))}

        <div style={{ marginTop:'8px', padding:'6px', background:`${dangerColor}18`,
          borderRadius:'4px', border:`1px solid ${dangerColor}44` }}>
          <div style={{ fontSize:'9px', color:'rgba(150,200,255,0.7)', fontFamily:'monospace' }}>COLLISION RISK</div>
          <div style={{ fontSize:'16px', fontWeight:700, color:dangerColor, fontFamily:'"Rajdhani",monospace' }}>
            {dangerLevel}  {collisionRisk.toFixed(0)}%
          </div>
          {cmeActive && (
            <div style={{ fontSize:'9px', color:'#ef4444', fontFamily:'monospace', marginTop:'2px' }}>
              ⚠ CME IMPACT — IONOSPHERE CHARGED
            </div>
          )}
        </div>
      </div>
    </Html>
  );
}

// ─── Main 3D Component ────────────────────────────────────────────────────────
export interface KesslerNetProps {
  visible?:   boolean;
  kpIndex?:   number;
  cmeActive?: boolean;
}

export function KesslerNet({ visible = true, kpIndex = 0, cmeActive = false }: KesslerNetProps) {
  if (!visible) return null;

  return (
    <group>
      <EarthReference />
      <GeoRing />

      {DEBRIS_SHELLS.map((sh, i) => (
        <DebrisShell
          key={sh.name}
          altKmMin={sh.altKmMin}
          altKmMax={sh.altKmMax}
          count={sh.count}
          color={sh.color}
          opacity={sh.opacity}
          seed={i * 7919 + 31337}
          rotateRad={0.0004 * (1 - i * 0.15)}
        />
      ))}

      <KesslerHUD kpIndex={kpIndex} cmeActive={cmeActive} />
    </group>
  );
}

// ─── HUD-only 2D version (for SlateTile panels) ───────────────────────────────
export function KesslerNetStats({ kpIndex = 0, cmeActive = false }: { kpIndex?: number; cmeActive?: boolean }) {
  const totalDebris = DEBRIS_SHELLS.reduce((s, d) => s + d.count, 0);
  const collisionRisk = Math.min(100, (kpIndex / 9 * 40) + (cmeActive ? 35 : 0));
  const dangerLevel = collisionRisk >= 60 ? 'CRITICAL' : collisionRisk >= 35 ? 'ELEVATED' : 'NOMINAL';
  const dangerColor = collisionRisk >= 60 ? '#ef4444' : collisionRisk >= 35 ? '#f97316' : '#22c55e';

  return (
    <div style={{ fontFamily:'"Rajdhani","Share Tech Mono",monospace', padding:'4px 0' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
        <div>
          <div style={{ fontSize:'28px', fontWeight:900, color:'#cce8ff', lineHeight:1, fontFamily:'"Rajdhani",monospace' }}>
            {totalDebris.toLocaleString()}
          </div>
          <div style={{ fontSize:'9px', color:'#7fa8c8', fontFamily:'monospace' }}>TRACKED ORBITAL OBJECTS</div>
        </div>
        <div style={{ textAlign:'right', padding:'6px 10px', background:`${dangerColor}18`,
          border:`1px solid ${dangerColor}44`, borderRadius:'6px' }}>
          <div style={{ fontSize:'9px', color:'rgba(150,200,255,0.7)', fontFamily:'monospace' }}>RISK LEVEL</div>
          <div style={{ fontSize:'16px', fontWeight:700, color:dangerColor }}>{dangerLevel}</div>
          <div style={{ fontSize:'13px', color:dangerColor, fontFamily:'monospace' }}>{collisionRisk.toFixed(0)}%</div>
        </div>
      </div>

      {/* Shell bars */}
      <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
        {DEBRIS_SHELLS.map((sh) => {
          const pct = sh.count / 1400;
          const col = `#${sh.color.toString(16).padStart(6,'0')}`;
          return (
            <div key={sh.name}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}>
                <span style={{ fontSize:'10px', color:col, fontFamily:'monospace' }}>{sh.name}</span>
                <span style={{ fontSize:'10px', color:'#cce8ff', fontFamily:'monospace',
                  display:'flex', gap:'8px' }}>
                  <span style={{ color:'rgba(100,150,200,0.7)' }}>
                    {sh.altKmMin}–{sh.altKmMax < 40000 ? sh.altKmMax : '~36K'} km
                  </span>
                  <span>{sh.count} obj</span>
                  <span style={{ color:col, fontSize:'9px', border:`1px solid ${col}44`,
                    borderRadius:'2px', padding:'0 3px' }}>{sh.riskLevel}</span>
                </span>
              </div>
              <div style={{ height:'5px', background:'rgba(0,20,50,0.8)', borderRadius:'3px', overflow:'hidden' }}>
                <div style={{ width:`${pct * 100}%`, height:'100%', background:`linear-gradient(90deg,${col},${col}88)`,
                  borderRadius:'3px', transition:'width 0.6s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Kessler cascade probability */}
      <div style={{ marginTop:'10px', padding:'8px', background:'rgba(0,20,50,0.6)',
        borderRadius:'6px', border:'1px solid rgba(0,200,255,0.12)' }}>
        <div style={{ fontSize:'10px', color:'#7fa8c8', fontFamily:'monospace', marginBottom:'4px' }}>
          KESSLER CASCADE THRESHOLD
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {[
            { label:'LEO Density', val:`${(1400/2e6*100).toFixed(3)}%`, color:'#ef4444' },
            { label:'Rel. Velocity', val:'~7.5 km/s',   color:'#f97316' },
            { label:'Est. Growth', val:'+5%/yr',         color:'#eab308' },
            { label:'Iridium Zone', val:'LEO-B: SATU',   color:'#60c8ff' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ flex:1, minWidth:'80px', background:'rgba(0,10,30,0.6)',
              borderRadius:'4px', padding:'4px 6px' }}>
              <div style={{ fontSize:'9px', color:'rgba(100,150,200,0.7)', fontFamily:'monospace' }}>{label}</div>
              <div style={{ fontSize:'12px', color, fontFamily:'monospace' }}>{val}</div>
            </div>
          ))}
        </div>
        {cmeActive && (
          <div style={{ marginTop:'6px', fontSize:'10px', color:'#ef4444', fontFamily:'monospace',
            padding:'4px 6px', background:'rgba(239,68,68,0.1)', borderRadius:'4px' }}>
            ⚠ ACTIVE CME: Atmospheric drag increase in LEO — orbital decay rate elevated
          </div>
        )}
      </div>
    </div>
  );
}

export default KesslerNet;
