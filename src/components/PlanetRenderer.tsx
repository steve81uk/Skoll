import { useMemo, useRef, useEffect, useCallback, type MutableRefObject } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import planetData from '../ml/planet_facts.json';
import { useCameraFocus } from '../hooks/useCameraFocus';
import { useMagneticDrift } from '../hooks/useMagneticDrift';
import { SYSTEM_CONSTANTS } from '../ml/ExoPhysics';
import { MagneticAxisVisualizer } from './MagneticAxisVisualizer';
import { MagneticTailVisualizer } from './MagneticTailVisualizer';
import { OrbitalTrail } from './OrbitalTrail';
import { AtmosphericGlow } from './AtmosphericGlow';
import { AsteroidBelt } from './AsteroidBelt';
import KesslerThreatNet from './KesslerThreatNet';
import { calculateOrbitalPosition, calculateOrbitalPositionByT, epochYearToT } from '../ml/OrbitalMechanics';
import { usePlanetTooltip } from './CosmicTooltip';
import { SlateErrorBoundary } from './SlateErrorBoundary';
import type { KesslerCascadeForecast } from '../ml/types';

const EarthMaterial = ({ dayMap, nightMap }: { dayMap: THREE.Texture; nightMap: THREE.Texture }) => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  return (
    <shaderMaterial
      ref={shaderRef}
      // CRITICAL FIX: Removed the buggy lights={true} and UniformsLib [cite: 2025-12-11]
      uniforms={{
        dayTexture: { value: dayMap },
        nightTexture: { value: nightMap }
      }}
      vertexShader={`
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `}
      fragmentShader={`
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        
        void main() {
          // The Sun is physically located at [0,0,0]. We calculate the light direction from the pixel to the Sun [cite: 2025-12-11]
          vec3 sunDir = normalize(vec3(0.0) - vWorldPosition); 
          float intensity = dot(vNormal, sunDir);
          
          // Smooth blend (-0.1 to 0.2) for a realistic sunset terminator transition [cite: 2025-11-03]
          float mixVal = smoothstep(-0.1, 0.2, intensity);
          
          vec4 dayColor = texture2D(dayTexture, vUv);
          vec4 nightColor = texture2D(nightTexture, vUv);
          
          // Multiply night lights so they glow beautifully in the dark, blending into the sunlit continents [cite: 2025-12-11]
          vec3 finalColor = mix(nightColor.rgb * 2.0, dayColor.rgb * (0.1 + max(0.0, intensity)), mixVal);
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `}
    />
  );
};

// Texture path mapping for actual filenames in /public/textures/
const TEXTURE_MAP: Record<string, string> = {
  mercury: '/textures/2k_mercury.jpg',
  venus: '/textures/2k_venus_surface.jpg',
  earth: '/textures/8k_earth_daymap.jpg',
  moon: '/textures/2k_moon.jpg',
  mars: '/textures/2k_mars.jpg',
  jupiter: '/textures/2k_jupiter.jpg',
  saturn: '/textures/2k_saturn.jpg',
  uranus: '/textures/2k_uranus.jpg',
  neptune: '/textures/2k_neptune.jpg',
  pluto: '/textures/2k_mercury.jpg', // Fallback - Pluto texture missing, use Mercury
  io: '/textures/2k_moon.jpg',      // Fallback - use Moon texture
  europa: '/textures/2k_moon.jpg',  // Fallback - use Moon texture
  titan: '/textures/2k_moon.jpg',   // Fallback - use Moon texture
};

interface PlanetFact {
  name: string;
  rotationSpeed: number;
  gravity: number;
  averageTemp: number;
  auroraColors: string[];
}

interface PlanetFactsPayload {
  planets: PlanetFact[];
}

type BodyName = keyof typeof SYSTEM_CONSTANTS;

const MOON_PARENT_MAP: Record<'Moon' | 'Io' | 'Europa' | 'Titan', 'Earth' | 'Jupiter' | 'Saturn'> = {
  Moon: 'Earth',
  Io: 'Jupiter',
  Europa: 'Jupiter',
  Titan: 'Saturn',
};

const MOON_ORBIT_AU: Record<'Moon' | 'Io' | 'Europa' | 'Titan', number> = {
  Moon: 0.0026,
  Io: 0.0028,
  Europa: 0.0045,
  Titan: 0.0082,
};

const MOON_ORBITAL_PERIOD_DAYS: Record<'Moon' | 'Io' | 'Europa' | 'Titan', number> = {
  Moon: 27.321661,
  Io: 1.769137786,
  Europa: 3.551181,
  Titan: 15.945,
};

const PRIMARY_BODIES: BodyName[] = [
  'Mercury',
  'Venus',
  'Earth',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
];

const MOONS: Array<keyof typeof MOON_PARENT_MAP> = ['Moon', 'Io', 'Europa', 'Titan'];
// Realistic scale for proper visualization - 1 AU = 60 units
// This makes Earth ~60 units from Sun, Jupiter ~312 units (realistic spacing)
const AU_SCALE = 60;

const SIDEREAL_ROTATION_HOURS: Record<string, number> = {
  Mercury: 1407.6,
  Venus: 5832.5,
  Earth: 23.9345,
  Moon: 655.728,
  Mars: 24.6229,
  Jupiter: 9.925,
  Io: 42.46,
  Europa: 85.23,
  Saturn: 10.656,
  Titan: 382.68,
  Uranus: 17.24,
  Neptune: 16.11,
  Pluto: 153.2928,
};

/**
 * AuroraOval (RC-safe) — dual-hemisphere ring mesh using MeshStandardMaterial.
 * This intentionally avoids custom GLSL to remove shader compile risk.
 *
 * OVATION-Prime colatitude model (simplified):
 *   colatitude (° from pole) = 20 + kpIndex × 2
 *   → quiet (Kp 2): ~66° latitude;  storm (Kp 7): ~56° latitude
 *
 * Each ring is a flat RingGeometry lying in the XZ plane, offset along Y
 * by radius × sin(latitude) so it hugs the sphere at the correct latitude.
 */
const AuroraOval = ({
  radius,
  color,
  intensity,
  kpIndex = 2,
}: {
  radius: number;
  color: THREE.Color;
  intensity: number;
  kpIndex?: number;
}) => {
  const { camera } = useThree();
  const northRef = useRef<THREE.Mesh>(null);
  const northMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const southMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lodFadeRef = useRef(1);
  const tmpWorldPos = useMemo(() => new THREE.Vector3(), []);

  const auroraColor = useMemo(() => {
    const quiet = new THREE.Color('#00ff66');
    const storm = new THREE.Color('#66ccff');
    const kpT = THREE.MathUtils.clamp(kpIndex / 9, 0, 1);
    return quiet.clone().lerp(storm, kpT).lerp(color, 0.2);
  }, [color, kpIndex]);

  // Colatitude from magnetic pole → geomagnetic latitude
  const colatDeg   = Math.min(38, 20 + kpIndex * 2);
  const latRad     = THREE.MathUtils.degToRad(90 - colatDeg);
  const Rs         = radius * 1.018;
  const ovalRadius = Rs * Math.cos(latRad);
  const yOffset    = Rs * Math.sin(latRad);
  const bandW      = ovalRadius * (0.12 + intensity * 0.07);
  const innerR     = Math.max(0.01, ovalRadius - bandW * 0.5);
  const outerR     = ovalRadius + bandW * 0.5;

  useFrame((_, delta) => {
    const north = northRef.current;
    if (!north) return;

    north.getWorldPosition(tmpWorldPos);
    const distance = camera.position.distanceTo(tmpWorldPos);
    const targetFade = 1 - THREE.MathUtils.smoothstep(distance, 140, 520);
    const alpha = 1 - Math.exp(-delta * 7.5);
    lodFadeRef.current = THREE.MathUtils.lerp(lodFadeRef.current, targetFade, alpha);

    const effectiveIntensity = intensity * lodFadeRef.current;
    const nextOpacity = THREE.MathUtils.clamp(0.06 + effectiveIntensity * 0.14, 0.02, 0.55);
    const nextEmissive = THREE.MathUtils.clamp(0.12 + effectiveIntensity * 0.46, 0.1, 0.95);

    if (northMatRef.current) {
      northMatRef.current.opacity = nextOpacity;
      northMatRef.current.emissiveIntensity = nextEmissive;
    }
    if (southMatRef.current) {
      southMatRef.current.opacity = nextOpacity;
      southMatRef.current.emissiveIntensity = nextEmissive;
    }
  });

  return (
    <>
      {/* Northern auroral oval — positive Y = geographical north */}
      <mesh ref={northRef} position={[0, yOffset, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={14}>
        <ringGeometry args={[innerR, outerR, 96]} />
        <meshStandardMaterial
          ref={northMatRef}
          color={auroraColor}
          emissive={auroraColor}
          emissiveIntensity={THREE.MathUtils.clamp(0.2 + intensity * 0.4, 0.2, 0.85)}
          transparent
          opacity={THREE.MathUtils.clamp(0.14 + intensity * 0.12, 0.14, 0.5)}
          depthTest
          depthWrite={false}
          alphaTest={0.015}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
          side={THREE.DoubleSide}
          roughness={0.7}
          metalness={0.0}
        />
      </mesh>
      {/* Southern auroral oval — mirror at negative Y */}
      <mesh position={[0, -yOffset, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={14}>
        <ringGeometry args={[innerR, outerR, 96]} />
        <meshStandardMaterial
          ref={southMatRef}
          color={auroraColor}
          emissive={auroraColor}
          emissiveIntensity={THREE.MathUtils.clamp(0.2 + intensity * 0.4, 0.2, 0.85)}
          transparent
          opacity={THREE.MathUtils.clamp(0.14 + intensity * 0.12, 0.14, 0.5)}
          depthTest
          depthWrite={false}
          alphaTest={0.015}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
          side={THREE.DoubleSide}
          roughness={0.7}
          metalness={0.0}
        />
      </mesh>
    </>
  );
};

// ─── Earth Atmospheric Blue Halo (Fresnel-based) ──────────────────────────────
// World-space approach: mirrors the confirmed-working EarthMaterial pattern.
// projectionMatrix * viewMatrix * worldPos avoids any modelViewMatrix precision
// issues on WebGL2 drivers. cameraPosition is auto-injected by Three.js for
// all ShaderMaterials, giving a reliable world-space Fresnel view vector.
const EARTH_HALO_VERT = `
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
void main() {
  // mat3(modelMatrix) is valid for uniform-scale objects (sphere is always uniform).
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const EARTH_HALO_FRAG = `
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
uniform float uTime;
void main() {
  // Full world-space Fresnel: bright at the limb, transparent at the face.
  vec3 viewDir  = normalize(cameraPosition - vWorldPosition);
  float cosAngle = max(dot(vWorldNormal, viewDir), 0.0);
  float fresnel  = pow(1.0 - cosAngle, 4.2);
  vec3 deep  = vec3(0.04, 0.20, 0.70);
  vec3 rim   = vec3(0.38, 0.82, 1.00);
  vec3 color = mix(deep, rim, fresnel);
  float pulse = 0.88 + 0.12 * sin(uTime * 0.65);
  gl_FragColor = vec4(color, fresnel * 0.80 * pulse);
}
`;

const EarthAtmosphericHalo = ({ radius }: { radius: number }) => {
  const haloRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (haloRef.current) {
      haloRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[radius * 1.065, 64, 64]} />
      <shaderMaterial
        ref={haloRef}
        key="earth-atm-halo"
        vertexShader={EARTH_HALO_VERT}
        fragmentShader={EARTH_HALO_FRAG}
        uniforms={{ uTime: { value: 0 } }}
        transparent
        depthWrite={false}
        toneMapped={false}
        side={THREE.FrontSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

const MoonBody = ({
  name,
  currentIntensity,
  cmeOverdrive,
  onFocus,
  onFocusComplete,
  moonIndex,
  datePhase,
  motionTimeMs,
  isLiveMode,
  registerRef,
  parentPositionAuRef,
  positionOverrideAu,
}: {
  name: keyof typeof MOON_PARENT_MAP;
  currentIntensity: number;
  cmeOverdrive: boolean;
  onFocus: (name: string) => void;
  onFocusComplete?: () => void;
  moonIndex: number;
  datePhase: number;
  motionTimeMs: number;
  isLiveMode: boolean;
  registerRef?: (name: string, ref: THREE.Group) => void;
  parentPositionAuRef?: MutableRefObject<THREE.Vector3>;
  positionOverrideAu?: { x: number; y: number; z: number };
}) => {
  void currentIntensity;
  void cmeOverdrive;

  const moonMeshRef = useRef<THREE.Mesh>(null!);
  const moonGroupRef = useRef<THREE.Group>(null!);
  const { focusOnPlanet } = useCameraFocus();
  const moonConstant = SYSTEM_CONSTANTS[name];
  const moonRadius = 0.25 + moonIndex * 0.08;
  const moonOrbitRadius = MOON_ORBIT_AU[name] * AU_SCALE * 45;
  const moonColor = new THREE.Color(moonConstant.colour);
  const tooltipHandlers = usePlanetTooltip(name);
  const texturePath = TEXTURE_MAP[name.toLowerCase()] || '/textures/2k_moon.jpg';
  const moonTexture = useLoader(THREE.TextureLoader, texturePath);
  const orbitalPeriodDays = MOON_ORBITAL_PERIOD_DAYS[name] ?? 27.321661;
  const moonTargetPosRef = useRef(new THREE.Vector3());

  // Register this moon with the tracking system
  useEffect(() => {
    if (registerRef && moonGroupRef.current) {
      registerRef(name, moonGroupRef.current);
    }
  }, [name, registerRef]);

  useFrame((_state, delta) => {
    const frameTimeMs = isLiveMode ? Date.now() : motionTimeMs;
    const dayIndex = frameTimeMs / 86_400_000;
    const orbitTurns = dayIndex / orbitalPeriodDays;
    const orbitAngle = ((orbitTurns + datePhase * 0.0002 + moonIndex * 0.17) % 1) * Math.PI * 2;
    const periodHours = SIDEREAL_ROTATION_HOURS[name] ?? 655.728;
    const radiansPerSecond = (Math.PI * 2) / (periodHours * 3600);
    moonMeshRef.current.rotation.y += delta * radiansPerSecond;

    if (positionOverrideAu && parentPositionAuRef) {
      const parent = parentPositionAuRef.current;
      moonTargetPosRef.current.set(
        (positionOverrideAu.x - parent.x) * AU_SCALE,
        (positionOverrideAu.y - parent.y) * AU_SCALE,
        (positionOverrideAu.z - parent.z) * AU_SCALE,
      );
    } else {
      moonTargetPosRef.current.set(
        Math.cos(orbitAngle) * moonOrbitRadius,
        0,
        Math.sin(orbitAngle) * moonOrbitRadius,
      );
    }

    const smooth = 1 - Math.exp(-delta * 10.5);
    if (moonGroupRef.current.position.distanceToSquared(moonTargetPosRef.current) > 900) {
      moonGroupRef.current.position.copy(moonTargetPosRef.current);
    } else {
      moonGroupRef.current.position.lerp(moonTargetPosRef.current, smooth);
    }
  });

  return (
    <group ref={moonGroupRef}>
      <mesh
        ref={moonMeshRef}
        onClick={(e) => {
          e.stopPropagation(); // CRITICAL: Stops the click from passing through to the Sun [cite: 2025-11-03]
          onFocus(name);
          const worldPosition = new THREE.Vector3();
          moonGroupRef.current.getWorldPosition(worldPosition); // Gets the true moving position [cite: 2025-12-11]
          focusOnPlanet(worldPosition, moonRadius, onFocusComplete);
        }}
        {...tooltipHandlers}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[moonRadius, 24, 24]} />
        <meshStandardMaterial map={moonTexture} color={moonColor} roughness={0.85} metalness={0.08} />
      </mesh>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onFocus(name);
          const worldPosition = new THREE.Vector3();
          moonGroupRef.current.getWorldPosition(worldPosition);
          focusOnPlanet(worldPosition, moonRadius, onFocusComplete);
        }}
        {...tooltipHandlers}
      >
        <sphereGeometry args={[moonRadius * 1.8, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Moons have no significant magnetosphere — no aurora oval */}
    </group>
  );
};

const PlanetBody = ({
  name,
  currentIntensity,
  cmeOverdrive,
  onFocus,
  onFocusComplete,
  facts,
  datePhase,
  currentDate,
  isLiveMode,
  standoffDistance,
  registerRef,
  epochYearRef,
  positionOverridesAu,
  suppressTooltip,
  kpIndex,
  kesslerCascade,
  auroraEnabled,
}: {
  name: BodyName;
  currentIntensity: number;
  cmeOverdrive: boolean;
  onFocus: (name: string) => void;
  onFocusComplete?: () => void;
  facts: Map<string, PlanetFact>;
  datePhase: number;
  currentDate: Date;
  isLiveMode: boolean;
  standoffDistance: number;
  registerRef?: (name: string, ref: THREE.Group) => void;
  epochYearRef?: MutableRefObject<number>;
  positionOverridesAu?: Record<string, { x: number; y: number; z: number }>;
  suppressTooltip?: boolean;
  kpIndex?: number;
  kesslerCascade?: KesslerCascadeForecast | null;
  auroraEnabled?: boolean;
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const saturnRingRef = useRef<THREE.Mesh>(null);
  const { focusOnPlanet } = useCameraFocus();
  const tooltipHandlers = usePlanetTooltip(name, suppressTooltip);
  const constants = SYSTEM_CONSTANTS[name];
  const fact = facts.get(name);
  const texturePath = TEXTURE_MAP[name.toLowerCase()] || '/textures/2k_mercury.jpg';
  const texture = useLoader(THREE.TextureLoader, texturePath);
  const nightTexture = useLoader(THREE.TextureLoader, '/textures/8k_earth_nightmap.jpg');
  const drift = useMagneticDrift(name, currentDate);
  const parentPositionAuRef = useRef(new THREE.Vector3());
  const planetTargetPosRef = useRef(new THREE.Vector3());

  // Register this planet's ref with the parent
  useEffect(() => {
    if (groupRef.current && registerRef) {
      registerRef(name, groupRef.current);
    }
  }, [name, registerRef]);

  const radius = useMemo(() => {
    const base = fact?.gravity ?? 7;
    return name === 'Pluto' ? 0.55 : 0.8 + base * 0.045;
  }, [fact?.gravity, name]);

  const moons = MOONS.filter((moon) => MOON_PARENT_MAP[moon] === name);
  const primaryAuroraColor = useMemo(() => new THREE.Color(constants.colour), [constants.colour]);

  // Fallback orbital position for static use (click handler needs a position)
  const baseOrbitalPosition = useMemo(() => {
    const pos = calculateOrbitalPosition(name, currentDate);
    return new THREE.Vector3(pos.x * AU_SCALE, pos.y * AU_SCALE, pos.z * AU_SCALE);
  }, [name, currentDate]);

  useFrame((_, delta) => {
    // Planet self-rotation
    const periodHours = SIDEREAL_ROTATION_HOURS[name] ?? 24;
    const radiansPerSecond = (Math.PI * 2) / (periodHours * 3600);
    meshRef.current.rotation.y += delta * radiansPerSecond;

    // ── Temporal Keplerian position update ────────────────────────────────────
    // If a live epochYearRef is provided, compute position from interpolated T
    // every frame (cheap trig — 9 planets total). Falls back to useMemo value.
    if (epochYearRef) {
      const T = epochYearToT(epochYearRef.current);
      const pos = calculateOrbitalPositionByT(name, T);
      parentPositionAuRef.current.set(pos.x, pos.y, pos.z);
      planetTargetPosRef.current.set(pos.x * AU_SCALE, pos.y * AU_SCALE, pos.z * AU_SCALE);
    } else if (positionOverridesAu?.[name]) {
      const pos = positionOverridesAu[name];
      parentPositionAuRef.current.set(pos.x, pos.y, pos.z);
      planetTargetPosRef.current.set(pos.x * AU_SCALE, pos.y * AU_SCALE, pos.z * AU_SCALE);
    } else {
      planetTargetPosRef.current.copy(baseOrbitalPosition);
    }

    const smooth = 1 - Math.exp(-delta * 8.5);
    if (groupRef.current.position.lengthSq() === 0 || groupRef.current.position.distanceToSquared(planetTargetPosRef.current) > 220_000) {
      groupRef.current.position.copy(planetTargetPosRef.current);
    } else {
      groupRef.current.position.lerp(planetTargetPosRef.current, smooth);
    }

    parentPositionAuRef.current.set(
      groupRef.current.position.x / AU_SCALE,
      groupRef.current.position.y / AU_SCALE,
      groupRef.current.position.z / AU_SCALE,
    );

    if (saturnRingRef.current) {
      saturnRingRef.current.rotation.z += 0.0003;
    }
  });

  return (
    <group ref={groupRef}>
      <MagneticTailVisualizer
        planetPosition={groupRef.current ? groupRef.current.position : new THREE.Vector3()}
        color={constants.colour}
        standoffDistance={standoffDistance}
      />

      <group
        rotation={[
          drift.x,
          drift.y,
          THREE.MathUtils.degToRad(constants.tiltDegrees || 0) + drift.z,
        ]}
      >
        <MagneticAxisVisualizer radius={radius} tilt={0} color={primaryAuroraColor.getStyle()} />
      </group>

      {/* Atmospheric Glow - for planets with atmospheres */}
      <AtmosphericGlow
        radius={radius}
        color={constants.colour}
        intensity={currentIntensity}
        hasAtmosphere={['Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].includes(name)}
      />

      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation(); // Stops accidental click-throughs [cite: 2025-11-03]
          onFocus(name);
          focusOnPlanet(groupRef.current.position.clone(), radius, onFocusComplete);
        }}
        {...tooltipHandlers}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[radius, 48, 48]} />
        {name === 'Earth' ? (
          <EarthMaterial dayMap={texture} nightMap={nightTexture} />
        ) : (
          <meshStandardMaterial 
            map={texture} 
            roughness={0.9} 
            metalness={0.1}
            emissive={constants.colour} 
            emissiveIntensity={0.05} 
          />
        )}
      </mesh>

      {/* Fresnel atmospheric blue halo — Earth only */}
      {name === 'Earth' && <EarthAtmosphericHalo radius={radius} />}
      {/* Auroral ovals — spherical polar coordinates, N+S hemispheres */}
      {/* Only rendered for magnetically active planets */}
      {auroraEnabled !== false && (name === 'Earth' || name === 'Jupiter' || name === 'Saturn') && (
        <SlateErrorBoundary
          moduleName="AuroraOval"
          fallback={
            /* Safe MeshStandardMaterial ring fallback — renders if GLSL compile fails */
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[radius * 1.02, radius * 1.06, 96]} />
              <meshStandardMaterial
                color="#00ffaa"
                transparent
                opacity={0.18}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          }
        >
          <AuroraOval
            radius={radius}
            color={cmeOverdrive ? new THREE.Color('#ff4400') : primaryAuroraColor}
            intensity={cmeOverdrive ? 1.8 : Math.max(0.3, currentIntensity)}
            kpIndex={Math.max(0, Math.min(9, kpIndex !== undefined ? (cmeOverdrive ? 8 : kpIndex) : (cmeOverdrive ? 8 : Math.min(9, currentIntensity * 3))))}
          />
        </SlateErrorBoundary>
      )}

      {name === 'Earth' && (
        <SlateErrorBoundary moduleName="KesslerThreatNet" fallback={null}>
          <KesslerThreatNet earthRadius={radius} cascade={kesslerCascade} visible />
        </SlateErrorBoundary>
      )}

      {name === 'Saturn' && (
        <mesh ref={saturnRingRef} rotation={[Math.PI / 2.15, 0, 0]}>
          <ringGeometry args={[radius * 1.35, radius * 2.2, 128]} />
          <meshStandardMaterial color="#d7c3a1" transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}

      {moons.map((moon, moonIndex) => (
        <MoonBody
          key={moon}
          name={moon}
          moonIndex={moonIndex}
          currentIntensity={currentIntensity}
          cmeOverdrive={cmeOverdrive}
          onFocus={onFocus}
          onFocusComplete={onFocusComplete}
          datePhase={datePhase}
          motionTimeMs={currentDate.getTime()}
          isLiveMode={isLiveMode}
          registerRef={registerRef}
          parentPositionAuRef={parentPositionAuRef}
          positionOverrideAu={positionOverridesAu?.[moon]}
        />
      ))}
    </group>
  );
};

export const PlanetRenderer = ({
  onPlanetSelect,
  onFocusAnimationComplete,
  currentIntensity,
  currentDate,
  isLiveMode,
  cmeOverdrive,
  standoffDistance,
  onPlanetRefsReady,
  epochYear,
  positionOverridesAu,
  focusedPlanetName,
  kpIndex,
  kesslerCascade,
  auroraEnabled,
}: {
  onPlanetSelect: (name: string) => void;
  onFocusAnimationComplete?: () => void;
  currentIntensity: number;
  currentDate: Date;
  isLiveMode?: boolean;
  cmeOverdrive: boolean;
  standoffDistance: number;
  onPlanetRefsReady?: (refs: Map<string, THREE.Group>) => void;
  epochYear?: number;
  positionOverridesAu?: Record<string, { x: number; y: number; z: number }>;
  /** Real planetary Kp index — drives aurora color gradient and latitudinal spread. */
  kpIndex?: number;
  /** Latest cascade forecast from kesslerWorker (fallback: LSTM cascade). */
  kesslerCascade?: KesslerCascadeForecast | null;
  /** When set, the matching planet's 3D hover tooltip is suppressed (camera already focused on it). */
  focusedPlanetName?: string | null;
  /** Global aurora shader toggle (Eco Mode disables auroral rendering entirely). */
  auroraEnabled?: boolean;
}) => {
  const payload = planetData as PlanetFactsPayload;
  const facts = useMemo(() => new Map(payload.planets.map((planet) => [planet.name, planet])), [payload.planets]);
  const datePhase = useMemo(() => currentDate.getTime() / 86_400_000, [currentDate]);
  const planetRefsMap = useRef(new Map<string, THREE.Group>());
  const hasEpochOverride = epochYear !== undefined;

  // ── Temporal interpolation state (useFrame, not React state → 60 FPS) ────────────
  // epochYearRef.current is the smoothly interpolated year fed into Kepler solver
  const epochYearRef = useRef<number>(epochYear ?? currentDate.getFullYear());
  const targetEpochYearRef = useRef<number>(epochYear ?? currentDate.getFullYear());

  useEffect(() => {
    if (hasEpochOverride && epochYear !== undefined) {
      targetEpochYearRef.current = epochYear;
    }
  }, [epochYear, hasEpochOverride]);

  useFrame(() => {
    if (!hasEpochOverride) {
      return;
    }

    const target = targetEpochYearRef.current;
    const curr   = epochYearRef.current;
    const diff   = target - curr;
    if (Math.abs(diff) > 0.5) {
      // Adaptive speed: faster for larger jumps (deep-time) — arrives in ~3s
      const speed = Math.min(0.12, Math.max(0.025, Math.abs(diff) / 1_000_000));
      epochYearRef.current = curr + diff * speed;
    } else {
      epochYearRef.current = target;
    }
  });

  // Callback to register planet refs
  const registerRef = useCallback((name: string, ref: THREE.Group) => {
    planetRefsMap.current.set(name, ref);
  }, []);

  // Notify parent when refs are ready
  useEffect(() => {
    if (onPlanetRefsReady && planetRefsMap.current.size > 0) {
      onPlanetRefsReady(planetRefsMap.current);
    }
  }, [onPlanetRefsReady]);

  // Safety check: prevent crash if JSON load is delayed or corrupted [cite: 2025-11-03, 2025-12-11]
  if (!facts || facts.size === 0) {
    console.warn('[PlanetRenderer] No planet facts available — skipping render');
    return null;
  }

  return (
    <>
      {/* Orbital Trails */}
      {PRIMARY_BODIES.map((name, index) => {
        // Different colors for inner vs outer planets
        const isInnerPlanet = index < 4;
        const trailColor = isInnerPlanet ? '#00ccff' : '#8844ff';
        const trailOpacity = isInnerPlanet ? 0.12 : 0.08;

        return (
          <OrbitalTrail
            key={`trail-${name}`}
            bodyName={name}
            auScale={AU_SCALE}
            currentDate={currentDate}
            epochYear={hasEpochOverride ? epochYearRef.current : undefined}
            color={trailColor}
            opacity={trailOpacity}
          />
        );
      })}

      {/* Asteroid Belt (Main belt: 2.2–3.3 AU between Mars and Jupiter) */}
      <AsteroidBelt />

      {/* Planets */}
      {PRIMARY_BODIES.map((name) => (
        <PlanetBody
          key={name}
          name={name}
          facts={facts}
          currentIntensity={currentIntensity}
          cmeOverdrive={cmeOverdrive}
          onFocus={onPlanetSelect}
          onFocusComplete={onFocusAnimationComplete}
          datePhase={datePhase}
          currentDate={currentDate}
          isLiveMode={Boolean(isLiveMode)}
          standoffDistance={standoffDistance}
          registerRef={registerRef}
          epochYearRef={hasEpochOverride ? epochYearRef : undefined}
          positionOverridesAu={positionOverridesAu}
          suppressTooltip={name === focusedPlanetName}
          kpIndex={kpIndex}
          kesslerCascade={kesslerCascade}
          auroraEnabled={auroraEnabled}
        />
      ))}
    </>
  );
};
