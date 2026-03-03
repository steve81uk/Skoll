import { useRef, useState, useEffect, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ChicxulubEvent.tsx
 *
 * A 10 km asteroid on final approach to Yucatán (Earth), followed by an
 * expanding ejecta shockwave and impact flash.
 *
 *   Phase 0  — Approach:  boulder drifts inward from 12 → 0 Earth radii (6 s)
 *   Phase 1  — Impact:    nuclear-bright flash sphere expands (1 s)
 *   Phase 2  — Shockwave: translucent blast ring expands (2 s)
 *   Phase 3  — Fade:      everything dims and disappears (2 s)
 *
 * Fired by DeepTimeSlicer when the user selects the K-Pg (−66 Ma) epoch.
 */

interface ChicxulubEventProps {
  /** World position of Earth (scene units) */
  earthPos: [number, number, number];
  /** Whether the sequence is active */
  active: boolean;
  /** Called when the full sequence ends */
  onComplete?: () => void;
}

const EARTH_RADIUS       = 2.2;
const APPROACH_DURATION  = 5.0;   // seconds: asteroid approaches
const FLASH_DURATION     = 0.8;   // seconds: blinding flash
const SHOCKWAVE_DURATION = 2.0;   // seconds: ring expands
const FADE_DURATION      = 2.5;   // seconds: total fade

type Phase = 'idle' | 'approach' | 'flash' | 'shockwave' | 'fade';

export default function ChicxulubEvent({ earthPos, active, onComplete }: ChicxulubEventProps) {
  const [phase, setPhase]   = useState<Phase>('idle');
  const phaseTimeRef        = useRef(0);
  const asteroidRef         = useRef<THREE.Mesh>(null!);
  const flashRef            = useRef<THREE.Mesh>(null!);
  const shockwaveRef        = useRef<THREE.Mesh>(null!);
  const trailRef            = useRef<THREE.Line>(null!);

  // Trail geometry — reused each frame
  const trailGeo  = useRef(new THREE.BufferGeometry());
  const trailPts  = useRef<THREE.Vector3[]>([]);

  // Approach vector: come from above-right at 45° — glancing trajectory
  const approachStart = useRef(new THREE.Vector3(
    earthPos[0] + EARTH_RADIUS * 12,
    earthPos[1] + EARTH_RADIUS * 6,
    earthPos[2] + EARTH_RADIUS * 4,
  ));

  useEffect(() => {
    if (active && phase === 'idle') {
      phaseTimeRef.current = 0;
      trailPts.current     = [];
      setPhase('approach');
    }
    if (!active) setPhase('idle');
  }, [active, phase]);

  useFrame((_, dt) => {
    if (phase === 'idle') return;
    phaseTimeRef.current += dt;
    const t = phaseTimeRef.current;

    const ep = new THREE.Vector3(...earthPos);

    // ── Approach phase ────────────────────────────────────────────
    if (phase === 'approach') {
      const progress = Math.min(t / APPROACH_DURATION, 1);
      // Ease-in: faster as it gets closer (quadratic)
      const eased = progress * progress;

      if (asteroidRef.current) {
        asteroidRef.current.visible = true;
        const pos = approachStart.current.clone().lerp(ep, eased);
        asteroidRef.current.position.copy(pos);
        // Rotate for tumbling effect
        asteroidRef.current.rotation.x += dt * 0.8;
        asteroidRef.current.rotation.z += dt * 1.3;

        // Brighten as it approaches
        const mat = asteroidRef.current.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.2 + eased * 4;

        // Build trail
        trailPts.current.push(pos.clone());
        if (trailPts.current.length > 80) trailPts.current.shift();
        if (trailRef.current) {
          trailGeo.current.setFromPoints(trailPts.current);
          trailRef.current.geometry = trailGeo.current;
        }
      }

      if (t >= APPROACH_DURATION) {
        phaseTimeRef.current = 0;
        setPhase('flash');
      }
    }

    // ── Flash phase ───────────────────────────────────────────────
    if (phase === 'flash') {
      if (asteroidRef.current) asteroidRef.current.visible = false;
      if (flashRef.current) {
        flashRef.current.visible = true;
        flashRef.current.position.copy(ep);
        const s = 0.1 + (t / FLASH_DURATION) * EARTH_RADIUS * 3;
        flashRef.current.scale.setScalar(s);
        const mat = flashRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 1 - t / FLASH_DURATION;
      }
      if (t >= FLASH_DURATION) {
        phaseTimeRef.current = 0;
        setPhase('shockwave');
      }
    }

    // ── Shockwave phase ───────────────────────────────────────────
    if (phase === 'shockwave') {
      if (flashRef.current) flashRef.current.visible = false;
      if (shockwaveRef.current) {
        shockwaveRef.current.visible = true;
        shockwaveRef.current.position.copy(ep);
        const s = EARTH_RADIUS * (1.2 + (t / SHOCKWAVE_DURATION) * 8);
        shockwaveRef.current.scale.setScalar(s);
        const mat = shockwaveRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 0.45 - t / SHOCKWAVE_DURATION * 0.45);
      }
      if (t >= SHOCKWAVE_DURATION) {
        phaseTimeRef.current = 0;
        setPhase('fade');
      }
    }

    // ── Fade phase ────────────────────────────────────────────────
    if (phase === 'fade') {
      if (shockwaveRef.current) {
        shockwaveRef.current.visible = true;
        const mat = shockwaveRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 0.15 - t / FADE_DURATION * 0.15);
      }
      if (t >= FADE_DURATION) {
        setPhase('idle');
        if (shockwaveRef.current) shockwaveRef.current.visible = false;
        onComplete?.();
      }
    }
  });

  if (phase === 'idle') return null;

  return (
    <group>
      {/* Asteroid */}
      <mesh ref={asteroidRef} visible={false}>
        <dodecahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial
          color="#886644"
          roughness={0.8}
          metalness={0.15}
          emissive="#ff5500"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Trail */}
      <primitive object={
        (() => {
          const line = new THREE.Line(trailGeo.current,
            new THREE.LineBasicMaterial({ color: '#ff9933', opacity: 0.55, transparent: true, linewidth: 2 })
          );
          (trailRef as MutableRefObject<THREE.Line>).current = line;
          return line;
        })()
      } />

      {/* Impact flash */}
      <mesh ref={flashRef} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#ffffee" transparent opacity={1} depthWrite={false} />
      </mesh>

      {/* Shockwave ring — flat torus */}
      <mesh ref={shockwaveRef} visible={false}>
        <torusGeometry args={[1.0, 0.06, 8, 64]} />
        <meshBasicMaterial color="#ff8822" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
