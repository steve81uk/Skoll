/**
 * EarthCoreDynamo — R3F GLSL Earth interior + magnetic dipole field
 *
 * Hierarchy:
 *   <group>  (offset to earthPos)
 *     ├── inner solid core   (slow rotation, hot iron glow)
 *     ├── outer liquid core  (faster rotation, convection GLSL)
 *     └── magnetic field arcs (CatmullRomCurve3 dipole lines, animated)
 *
 * Props
 *   earthPos   – world position of the Earth mesh origin
 *   visible    – show/hide the whole assembly
 *   kpIndex    – 0–9; amplifies field-line glow intensity
 *   scale      – multiplier on the radius (default 1 → matches ~Earth-radius 1 scene unit)
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

// ─── Outer liquid-core shader ────────────────────────────────────────────────

const LiquidCoreMaterial = shaderMaterial(
  { uTime: 0, uKp: 2 },

  /* vertex */ `
    varying vec3 vNormal;
    varying vec3 vPos;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPos    = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  /* fragment */ `
    uniform float uTime;
    uniform float uKp;
    varying vec3 vNormal;
    varying vec3 vPos;

    // Simplex-ish hash noise
    float hash(vec3 p) {
      p = fract(p * vec3(443.8975, 397.2973, 491.1871));
      p += dot(p.zxy, p.yxz + 19.19);
      return fract(p.x * p.y * p.z);
    }
    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i),            hash(i+vec3(1,0,0)), f.x),
            mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)), f.x),
            mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)), f.x), f.y),
        f.z);
    }
    float fbm(vec3 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
      return v;
    }

    void main() {
      vec3 n = normalize(vNormal);
      // convection roll pattern
      float roll = fbm(vPos * 3.5 + vec3(uTime * 0.08, -uTime * 0.05, uTime * 0.06));
      float edge = 1.0 - abs(dot(n, normalize(vPos)));

      // iron orange → copper red colour
      vec3 hot  = vec3(1.0, 0.42, 0.10);   // orange-iron
      vec3 cool = vec3(0.60, 0.12, 0.04);  // deep red
      vec3 col  = mix(cool, hot, roll);

      // kp boost — brightens toward yellow-white
      float kpBoost = clamp(uKp / 9.0, 0.0, 1.0);
      col = mix(col, vec3(1.0, 0.85, 0.4), kpBoost * 0.3);

      float alpha = 0.82 + edge * 0.12;
      gl_FragColor = vec4(col, alpha);
    }
  `,
);

extend({ LiquidCoreMaterial });

// ─── Inner solid-core shader  ────────────────────────────────────────────────

const SolidCoreMaterial = shaderMaterial(
  { uTime: 0, uKp: 2 },

  `varying vec3 vNormal;
   varying vec3 vPos;
   void main() {
     vNormal = normalize(normalMatrix * normal);
     vPos    = position;
     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }`,

  `uniform float uTime;
   uniform float uKp;
   varying vec3 vNormal;
   varying vec3 vPos;
   void main() {
     float rim = 1.0 - max(0.0, dot(normalize(vNormal), vec3(0.0,0.0,1.0)));
     float kpBoost = clamp(uKp / 9.0, 0.0, 1.0);
     vec3  base = vec3(0.95, 0.78, 0.20);          // gold-iron
     vec3  glow = vec3(1.0,  0.94, 0.55);
     float pulse = 0.5 + 0.5 * sin(uTime * 1.4);
     vec3  col  = mix(base, glow, rim * 0.6 + kpBoost * 0.25 + pulse * 0.08);
     gl_FragColor = vec4(col, 1.0);
   }`,
);

extend({ SolidCoreMaterial });

// ─── TypeScript declarations ─────────────────────────────────────────────────
declare module '@react-three/fiber' {
  interface ThreeElements {
    liquidCoreMaterial: React.JSX.IntrinsicElements['shaderMaterial'] & { uTime?: number; uKp?: number };
    solidCoreMaterial:  React.JSX.IntrinsicElements['shaderMaterial'] & { uTime?: number; uKp?: number };
  }
}

// ─── Dipole field arc geometry ───────────────────────────────────────────────
interface ArcDef {
  lat:   number;   // degrees from 0° equator → ±90° poles
  lng:   number;   // rotation around polar axis
  flip:  boolean;  // which magnetic pole it exits from
}

const ARC_DEFS: ArcDef[] = [
  { lat:  8, lng:   0,  flip: false },
  { lat:  8, lng:  60,  flip: false },
  { lat:  8, lng: 120,  flip: false },
  { lat:  8, lng: 180,  flip: false },
  { lat:  8, lng: 240,  flip: false },
  { lat:  8, lng: 300,  flip: false },
  { lat: 20, lng:  30,  flip: true  },
  { lat: 20, lng: 150,  flip: true  },
];

function buildArcPoints(def: ArcDef, r: number, segments = 40): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const sign = def.flip ? -1 : 1;

  for (let i = 0; i <= segments; i++) {
    const t   = i / segments;           // 0 → 1
    // parametric dipole: lat traces from +pole → equator → −pole
    const phi = (t - 0.5) * Math.PI;   // −π/2 … +π/2
    const tht = (def.lng * Math.PI) / 180;

    // stretch outward at equator (dipole bulge)
    const bulge = r * (1 + 1.6 * Math.cos(phi) ** 2);
    const x = sign * bulge * Math.cos(phi) * Math.cos(tht);
    const y = sign * bulge * Math.sin(phi);
    const z = sign * bulge * Math.cos(phi) * Math.sin(tht);
    pts.push(new THREE.Vector3(x, y, z));
  }
  return pts;
}

// ─── FieldArc: single animated magnetic line ─────────────────────────────────
function FieldArc({
  def, r, kpIndex, timeOffset,
}: { def: ArcDef; r: number; kpIndex: number; timeOffset: number }) {
  const geomRef   = useRef<THREE.BufferGeometry>(null);
  const matRef    = useRef<THREE.LineBasicMaterial>(null);
  const clockRef  = useRef(0);

  const curve = useMemo(() => {
    const pts = buildArcPoints(def, r);
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  }, [def, r]);

  useFrame((_, dt) => {
    clockRef.current += dt;
    const t     = ((clockRef.current * 0.18 + timeOffset) % 1);
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(clockRef.current * 0.7 + timeOffset));
    const kpFac = 0.3 + (kpIndex / 9) * 0.7;

    if (matRef.current) {
      matRef.current.opacity = pulse * kpFac;
    }

    // Animate partial visible segment (leading/trailing dash)
    if (geomRef.current) {
      const drawEnd   = t;
      const drawStart = Math.max(0, drawEnd - 0.35);
      const allPts    = curve.getPoints(80);
      const from  = Math.floor(drawStart * allPts.length);
      const to    = Math.ceil(drawEnd   * allPts.length);
      const slice = allPts.slice(from, to);
      const pos   = new Float32Array(slice.length * 3);
      slice.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
      geomRef.current.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geomRef.current.setDrawRange(0, slice.length);
      geomRef.current.computeBoundingSphere();
    }
  });

  return (
    <line>
      <bufferGeometry ref={geomRef} />
      <lineBasicMaterial
        ref={matRef}
        color="#7dd3fc"
        transparent
        opacity={0.7}
        linewidth={1}
      />
    </line>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface EarthCoreDynamoProps {
  earthPos?: [number, number, number];
  visible?: boolean;
  kpIndex?: number;
  scale?: number;
}

export function EarthCoreDynamo({
  earthPos  = [0, 0, 0],
  visible   = true,
  kpIndex   = 2,
  scale     = 1,
}: EarthCoreDynamoProps) {
  const innerRef  = useRef<THREE.Object3D>(null);
  const outerRef  = useRef<THREE.Object3D>(null);
  const innerMatRef = useRef<THREE.ShaderMaterial & { uTime: number; uKp: number }>(null);
  const outerMatRef = useRef<THREE.ShaderMaterial & { uTime: number; uKp: number }>(null);

  const R_OUTER = scale * 0.38;   // outer liquid core radius (fraction of Earth r=1)
  const R_INNER = scale * 0.19;   // inner solid core

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (innerRef.current) innerRef.current.rotation.y = t * 0.04;      // very slow
    if (outerRef.current) outerRef.current.rotation.y = t * 0.11;     // faster
    if (outerRef.current) outerRef.current.rotation.z = t * 0.03;

    if (innerMatRef.current) { innerMatRef.current.uTime = t; innerMatRef.current.uKp = kpIndex; }
    if (outerMatRef.current) { outerMatRef.current.uTime = t; outerMatRef.current.uKp = kpIndex; }
  });

  if (!visible) return null;

  return (
    <group position={earthPos}>
      {/* Outer liquid iron core */}
      <mesh ref={outerRef as React.RefObject<THREE.Mesh>}>
        <sphereGeometry args={[R_OUTER, 48, 48]} />
        <liquidCoreMaterial
          ref={outerMatRef}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Inner solid iron core */}
      <mesh ref={innerRef as React.RefObject<THREE.Mesh>}>
        <sphereGeometry args={[R_INNER, 32, 32]} />
        <solidCoreMaterial ref={innerMatRef} />
      </mesh>

      {/* Magnetic dipole field arcs */}
      {ARC_DEFS.map((def, i) => (
        <FieldArc key={i} def={def} r={scale * 1.1} kpIndex={kpIndex} timeOffset={i * 0.127} />
      ))}
    </group>
  );
}

// ─── DOM info panel ──────────────────────────────────────────────────────────

interface EarthDynamoPanelProps {
  kpIndex?: number;
  visible?: boolean;
}

export function EarthDynamoPanel({ kpIndex = 2, visible = true }: EarthDynamoPanelProps) {
  if (!visible) return null;

  const activity = kpIndex < 3 ? 'Quiet' : kpIndex < 5 ? 'Active' : kpIndex < 7 ? 'Storm' : 'Severe';
  const col      = kpIndex < 3 ? '#00e87a' : kpIndex < 5 ? '#ffd166' : kpIndex < 7 ? '#ff8c42' : '#ff4f52';

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#b0c8d4' }}>
      <div style={{ marginBlockEnd: '8px', textTransform: 'uppercase', letterSpacing: '0.13em', fontSize: '9px', opacity: 0.55 }}>
        Earth Core Dynamo
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
        {[
          ['Inner Core',   '5,100 km depth'],
          ['Temp',         '~5,400 °C'],
          ['Outer Core',   'Liquid iron-nickel'],
          ['Rotation',     'Eastward differential'],
          ['Field Origin', 'Geodynamo effect'],
          ['Kp Activity',  <span key="kp" style={{ color: col }}>{activity} ({kpIndex.toFixed(1)})</span>],
        ].map(([label, val], i) => (
          <div key={i}>
            <div style={{ fontSize: '8px', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
            <div style={{ fontSize: '11px', color: '#e2eff5' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBlockStart: '10px', padding: '6px 8px', background: 'rgba(56,189,248,0.06)', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.15)', fontSize: '9px', opacity: 0.65, lineHeight: 1.6 }}>
        The geodynamo converts convective heat energy in the liquid outer core into the
        geomagnetic field that shields Earth from solar wind. Elevated Kp indicates
        external field compression.
      </div>
    </div>
  );
}

export default EarthCoreDynamo;
