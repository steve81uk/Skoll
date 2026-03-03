import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { Orbit, Radio, BarChart2, Zap, Mic, MicOff } from 'lucide-react';
import * as THREE from 'three';
import { useCameraFocus } from './hooks/useCameraFocus';
import { useSolarFlareAudio } from './hooks/useSolarFlareAudio';
import { useSpeechCommands } from './hooks/useSpeechCommands';
import type { SpeechAction } from './hooks/useSpeechCommands';
import { NeuralBoot } from './components/NeuralBoot';
import { TelemetryRibbon } from './components/TelemetryRibbon';
import { PlanetDiagnosticsSlate } from './components/PlanetDiagnosticsSlate';
import { LandingSlate } from './components/LandingSlate';
import { SlateTile } from './components/SlateTile';
import { MagneticReversalAlert } from './components/MagneticReversalAlert';
import { SlateErrorBoundary } from './components/SlateErrorBoundary';
import type { ActiveObject } from './components/HangarModule';
import { SatelliteOrbitalTracker } from './components/SatelliteOrbitalTracker';
import { useCMEImpactFlicker } from './hooks/useCMEImpactFlicker';
import { useGlobalTelemetry } from './hooks/useGlobalTelemetry';
import { calculateExoTelemetry, SYSTEM_CONSTANTS } from './ml/ExoPhysics';
import { SurfaceAtmosphere } from './shaders/SurfaceAtmosphereShader';
import { CameraTracker } from './components/CameraTracker';
import { DynamicSun } from './components/DynamicSun';
import { EnhancedStarfield } from './components/EnhancedStarfield';
import { ForecastRadarSlate } from './components/ForecastRadarSlate';
import { FireballTrackerSlate } from './components/FireballTrackerSlate';
import { NOAAFeedHUD } from './components/NOAAFeedHUD';
import { SagittariusA } from './components/SagittariusA';
import { LSTMPredictiveGraph } from './components/LSTMPredictiveGraph';
import { GlobalMagneticGrid } from './components/GlobalMagneticGrid';
import { DSNLiveLink } from './components/DSNLiveLink';
import { KesslerNetStats } from './components/KesslerNet';
import { DataAlchemistDashboard } from './components/DataAlchemistDashboard';
import { LiveSyncBadge } from './components/LiveSyncBadge';
import LocationSwitcher, { LOCATION_PRESETS } from './components/LocationSwitcher';
import type { LocationPreset } from './components/LocationSwitcher';
import KuiperBelt from './components/KuiperBelt';
import EarthBowShock from './components/EarthBowShock';
import OortCloud from './components/OortCloud';
import LiveISS, { LiveISSHUD } from './components/LiveISS';
import SuperMAGPanel from './components/SuperMAGPanel';
import ProgressionGraph from './components/ProgressionGraph';
import SolarThreatSimulator from './components/SolarThreatSimulator';
import type { SyntheticCME } from './components/SolarThreatSimulator';
import EarthCloudLayer from './components/EarthCloudLayer';
import DeepTimeSlicer from './components/DeepTimeSlicer';
import type { DeepTimeEpoch } from './components/DeepTimeSlicer';
import ChicxulubEvent from './components/ChicxulubEvent';
import CarringtonSim, { CarringtonPanel } from './components/CarringtonSim';
import ApophisTracker, { ApophisPanel } from './components/ApophisTracker';
import TerminalLogHUD from './components/TerminalLogHUD';
import EarthCoreDynamo, { EarthDynamoPanel } from './components/EarthCoreDynamo';
import ISSCameraPanel from './components/ISSCameraStream';
import ForecastingSlicerPanel from './components/ForecastingSlicerPanel';
import LocalInterstellarCloud from './components/LocalInterstellarCloud';
import AuroraOvationHUD from './components/AuroraOvationHUD';
import HeliopauseShell from './components/HeliopauseShell';
import PlanetCore from './components/PlanetCore';
import GOESFluxChart from './components/GOESFluxChart';
import GridFailureSim from './components/GridFailureSim';
import RadioBlackoutHeatmap from './components/RadioBlackoutHeatmap';
import { useLSTMWorker } from './hooks/useLSTMWorker';
import { useGOESFlux } from './hooks/useGOESFlux';
import { useNOAADONKI } from './hooks/useNOAADONKI';
import eventsData from './ml/space_weather_events.json';

type ViewMode = 'HELIOCENTRIC' | 'SURFACE';
type TimeMode = Date | 'LIVE';
type BodyName = keyof typeof SYSTEM_CONSTANTS;
type FXQuality = 'LOW' | 'HIGH';
const DEBUG_LOGS = import.meta.env.VITE_DEBUG_LOGS === 'true';

const LazyPlanetRenderer = lazy(() => import('./components/PlanetRenderer').then((module) => ({ default: module.PlanetRenderer })));
const LazyCMEPropagationVisualizer = lazy(() =>
  import('./components/CMEPropagationVisualizer').then((module) => ({ default: module.CMEPropagationVisualizer })),
);
const LazySatelliteThreatSlate = lazy(() =>
  import('./components/SatelliteThreatSlate').then((module) => ({ default: module.SatelliteThreatSlate })),
);
const LazyHumanImpactSlate = lazy(() =>
  import('./components/HumanImpactSlate').then((module) => ({ default: module.HumanImpactSlate })),
);
const LazyHangarModule = lazy(() => import('./components/HangarModule').then((module) => ({ default: module.HangarModule })));
const LazyOracleModule = lazy(() => import('./components/OracleModule').then((module) => ({ default: module.OracleModule })));
const LazyHealthDashboard = lazy(() =>
  import('./components/HealthDashboard').then((module) => ({ default: module.HealthDashboard })),
);
const LazyCinematicPostFX = lazy(() =>
  import('./components/CinematicPostFX').then((module) => ({ default: module.CinematicPostFX })),
);

const ACTIVE_OBJECTS: ActiveObject[] = [
  { id: 'iss', name: 'ISS', operator: 'NASA / Roscosmos', altitudeKm: 420, inclinationDeg: 51.6, orbitalNode: new THREE.Vector3(4, 2, 2), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 2.2 },
  { id: 'jwst', name: 'James Webb', operator: 'NASA / ESA / CSA', altitudeKm: 1_500_000, inclinationDeg: 0.3, orbitalNode: new THREE.Vector3(12, 5, -6), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 3.0 },
  { id: 'starlink-v2', name: 'Starlink v2', operator: 'SpaceX', altitudeKm: 530, inclinationDeg: 53.2, orbitalNode: new THREE.Vector3(6, 3, -1), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 2.5 },
  { id: 'voyager1', name: 'Voyager 1', operator: 'NASA JPL', altitudeKm: 24_000_000_000, inclinationDeg: 35.0, orbitalNode: new THREE.Vector3(30, 8, 4), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 6.0 },
  { id: 'voyager2', name: 'Voyager 2', operator: 'NASA JPL', altitudeKm: 20_000_000_000, inclinationDeg: 48.0, orbitalNode: new THREE.Vector3(-28, 6, 7), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 5.8 },
  { id: 'hubble', name: 'Hubble', operator: 'NASA / ESA', altitudeKm: 540, inclinationDeg: 28.5, orbitalNode: new THREE.Vector3(5, 1.5, 3), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 2.3 },
  { id: 'sentinel6', name: 'Sentinel-6', operator: 'ESA / EUMETSAT', altitudeKm: 1336, inclinationDeg: 66.0, orbitalNode: new THREE.Vector3(7, 2, -4), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 2.8 },
  { id: 'landsat9', name: 'Landsat 9', operator: 'USGS / NASA', altitudeKm: 705, inclinationDeg: 98.2, orbitalNode: new THREE.Vector3(8, 2.2, 0), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 2.6 },
  { id: 'gaia', name: 'Gaia', operator: 'ESA', altitudeKm: 1_500_000, inclinationDeg: 0.0, orbitalNode: new THREE.Vector3(11, 3, 5), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 3.2 },
  { id: 'dragon-crew', name: 'Crew Dragon', operator: 'SpaceX / NASA', altitudeKm: 410, inclinationDeg: 51.6, orbitalNode: new THREE.Vector3(4.8, 2.1, -2.4), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 2.15 },
  { id: 'tiangong', name: 'Tiangong', operator: 'CNSA', altitudeKm: 390, inclinationDeg: 41.5, orbitalNode: new THREE.Vector3(3.5, 1.2, 1.8), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 2.1 },
  { id: 'oneweb', name: 'OneWeb LEO', operator: 'OneWeb', altitudeKm: 1200, inclinationDeg: 87.9, orbitalNode: new THREE.Vector3(9.2, 2.7, -3.1), hostPosition: new THREE.Vector3(0, 0, 0), hostRadius: 2.9 },
];

const SatelliteCameraFocus = ({
  target,
  trigger,
  onComplete,
}: {
  target: THREE.Vector3 | null;
  trigger: number;
  onComplete: () => void;
}) => {
  const { focusOnPlanet } = useCameraFocus();

  useEffect(() => {
    if (!target) {
      return;
    }

    focusOnPlanet(target, 0.9, onComplete);
  }, [focusOnPlanet, onComplete, target, trigger]);

  return null;
};

const SurfaceGroundPlane = ({ planetName }: { planetName: BodyName | null }) => {
  const textureTarget = planetName ? planetName.toLowerCase() : 'earth';
  // Texture mapping for surface mode
  const textureMap: Record<string, string> = {
    mercury: '/textures/2k_mercury.jpg',
    venus: '/textures/2k_venus_surface.jpg',
    earth: '/textures/8k_earth_daymap.jpg',
    mars: '/textures/2k_mars.jpg',
    jupiter: '/textures/2k_jupiter.jpg',
    saturn: '/textures/2k_saturn.jpg',
    uranus: '/textures/2k_uranus.jpg',
    neptune: '/textures/2k_neptune.jpg',
    pluto: '/textures/2k_mercury.jpg',
  };
  const texturePath = textureMap[textureTarget] || '/textures/8k_earth_daymap.jpg';
  const texture = useLoader(THREE.TextureLoader, texturePath);

  return (
    <mesh position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[420, 420, 256, 256]} />
      <meshStandardMaterial map={texture} roughness={0.95} metalness={0.05} />
    </mesh>
  );
};

const CMECameraShakeBurst = ({ active }: { active: boolean }) => {
  const { camera } = useThree();
  const lastOffsetRef = useRef(new THREE.Vector3());

  useFrame(() => {
    camera.position.sub(lastOffsetRef.current);

    if (!active) {
      lastOffsetRef.current.set(0, 0, 0);
      return;
    }

    const amplitude = 0.12;
    lastOffsetRef.current.set(
      (Math.random() - 0.5) * amplitude,
      (Math.random() - 0.5) * amplitude * 0.8,
      (Math.random() - 0.5) * amplitude,
    );

    camera.position.add(lastOffsetRef.current);
  });

  useEffect(() => {
    return () => {
      camera.position.sub(lastOffsetRef.current);
    };
  }, [camera]);

  return null;
};

const CinematicFXToggle = ({ quality, onChange }: { quality: FXQuality; onChange: (quality: FXQuality) => void }) => {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-[9px] text-cyan-400/80 uppercase tracking-[0.2em]">Cinematic FX</span>
      <button
        type="button"
        onClick={() => onChange('LOW')}
        className={`h-6 px-2 text-[8px] uppercase tracking-[0.2em] border ${
          quality === 'LOW' ? 'border-cyan-300 text-cyan-100' : 'border-cyan-700/50 text-cyan-500/70'
        }`}
      >
        Low
      </button>
      <button
        type="button"
        onClick={() => onChange('HIGH')}
        className={`h-6 px-2 text-[8px] uppercase tracking-[0.2em] border ${
          quality === 'HIGH' ? 'border-cyan-300 text-cyan-100' : 'border-cyan-700/50 text-cyan-500/70'
        }`}
      >
        High
      </button>
    </div>
  );
};

export default function App() {
  const [booted, setBooted] = useState(false);
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('HELIOCENTRIC');
  const [currentPlanet, setCurrentPlanet] = useState<BodyName | null>(null);
  const [currentDate, setCurrentDate] = useState<TimeMode>('LIVE');
  const [tacticalAlerts, setTacticalAlerts] = useState<string[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [satelliteFocusTarget, setSatelliteFocusTarget] = useState<THREE.Vector3 | null>(null);
  const [satelliteFocusTrigger, setSatelliteFocusTrigger] = useState(0);
  const [trackedObject, setTrackedObject] = useState<ActiveObject | null>(null);
  const [cmeActive, setCmeActive] = useState(false);
  const [cmeImpactActive, setCmeImpactActive] = useState(false);
  const [fxQuality, setFxQuality] = useState<FXQuality>('HIGH');
  const [impactBurstActive, setImpactBurstActive] = useState(false);
  const [maximizedTileId] = useState<string | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string>('mission-core');
  const [hiddenTileIds, setHiddenTileIds] = useState<string[]>([]);
  const [selectedEpochYear, setSelectedEpochYear] = useState<number>(2026);
  const [showISS, setShowISS] = useState(false);
  const [syntheticCME, setSyntheticCME] = useState<SyntheticCME | null>(null);
  const [chicxulubActive, setChicxulubActive] = useState(false);
  const [carringtonActive, setCarringtonActive] = useState(false);
  const [apophisVisible, setApophisVisible] = useState(false);
  const [carringtonSimTime, setCarringtonSimTime] = useState(0);
  const carringtonClockRef = useRef(0);
  const [heliopauseVisible, setHeliopauseVisible] = useState(false);
  const [blackoutVisible, setBlackoutVisible] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationPreset>({ name: 'Cambridge, UK', lat: 52.2, lon: 0.12 });
  const [activeSubTileId, setActiveSubTileId] = useState<string>('mission-core');
  const [hudMinimized] = useState(true);
  const [flickerSuppressed, setFlickerSuppressed] = useState(false);
  const [trackedPlanetName, setTrackedPlanetName] = useState<string | null>(null);
  const [planetRefs, setPlanetRefs] = useState<Map<string, THREE.Group>>(new Map());
  const burstTimeoutRef = useRef<number | null>(null);
  const flickerSuppressionTimeoutRef = useRef<number | null>(null);

  /** Master Reset — clears every active simulation in one click. */
  const handleMasterReset = useCallback(() => {
    setCmeActive(false);
    setCmeImpactActive(false);
    setSyntheticCME(null);
    setCarringtonActive(false);
    setCarringtonSimTime(0);
    carringtonClockRef.current = 0;
    setChicxulubActive(false);
    setApophisVisible(false);
    setImpactBurstActive(false);
    setSelectedEpochYear(new Date().getFullYear());
  }, []);
  const telemetry = useGlobalTelemetry();
  const flickerClass = useCMEImpactFlicker(telemetry.standoffDistance, telemetry.kpIndex ?? 0, flickerSuppressed);
  const isReversal = selectedEpochYear <= -66_000_000;

  // ─── Solar Flare spatial audio engine ──────────────────────────────────────
  const { enabled: flareAudioEnabled, toggle: toggleFlareAudio } = useSolarFlareAudio({
    intensity:      telemetry.currentIntensity ?? 1,
    flareActive:    (telemetry.currentIntensity ?? 1) > 1.5 || (telemetry.windSpeed ?? 450) > 800,
    solarWindSpeed: telemetry.windSpeed ?? 450,
  });

  // Debug logging
  useEffect(() => {
    if (!DEBUG_LOGS) {
      return;
    }
    console.log('[App] Boot state:', {
      booted,
      texturesLoaded,
      telemetryKp: telemetry.kp,
      telemetryReady: telemetry.kp !== undefined,
      gateCondition: texturesLoaded && telemetry.kp !== undefined,
    });
  }, [booted, texturesLoaded, telemetry.kp]);

  // FAILSAFE: Force boot after 3 seconds if something is stuck
  useEffect(() => {
    if (!booted) {
      const failsafeTimer = setTimeout(() => {
        console.warn('[App] ⚠️ FAILSAFE BOOT TRIGGER — forcing completion after 3s timeout');
        setBooted(true);
        setViewMode('HELIOCENTRIC');
      }, 3000);
      return () => clearTimeout(failsafeTimer);
    }
  }, [booted]);

  const tileCatalog = useMemo(
    () => [
      { id: 'telemetry', label: 'Telemetry Ribbon' },
      { id: 'mission-core', label: 'Mission Core' },
      { id: 'sat-threat', label: 'Orbital Threat' },
      { id: 'human-impact', label: 'Human Impact' },
      { id: 'hangar', label: 'Hangar Uplink' },
      { id: 'oracle', label: 'Oracle Archive' },
      { id: 'diagnostics', label: 'Planet Diagnostics' },
      { id: 'health', label: 'Neural Health' },
      { id: 'forecast-radar', label: 'Forecast Radar' },
      { id: 'fireball', label: 'Fireball Tracker' },
      { id: 'noaa-feed', label: 'NOAA Live Feed' },
      { id: 'lstm-forecast', label: 'LSTM Forecast' },
      { id: 'magnetic-grid', label: 'Magnetic Grid' },
      { id: 'dsn-live', label: 'DSN Live Link' },
      { id: 'data-alchemist', label: 'Data Alchemist' },
      { id: 'kessler-net', label: 'Kessler Net' },
      { id: 'supermag', label: 'SuperMAG Network' },
      { id: 'progression', label: 'Dev Progression' },
      { id: 'threat-simulator', label: 'CME Simulator' },
      { id: 'deep-time', label: 'Deep-Time Slicer' },
      { id: 'iss-track', label: 'ISS Live Track' },
      { id: 'carrington-sim', label: 'Carrington 1859' },
      { id: 'apophis-tracker', label: 'Apophis 2029' },
      { id: 'terminal-log',    label: 'ML Server Log' },
      { id: 'earth-dynamo',    label: 'Earth Core Dynamo' },
      { id: 'iss-stream',      label: 'ISS Camera Stream' },
      { id: 'forecast-slicer',   label: 'Forecast Slicer' },
      { id: 'aurora-ovation',    label: 'Aurora OVATION' },
      { id: 'goes-flux',         label: 'GOES X-Ray Flux' },
      { id: 'planet-core',       label: 'Planet Core' },
      { id: 'heliopause',        label: 'Heliopause Shell' },
      { id: 'grid-failure',      label: 'Grid Failure Sim' },
      { id: 'radio-blackout',    label: 'D-RAP Blackout' },
    ],
    [],
  );

  const isTileHidden = (tileId: string) => hiddenTileIds.includes(tileId);
  const selectedTileLabel = tileCatalog.find((tile) => tile.id === selectedTileId)?.label ?? 'Mission Core';

  const quickActions = useMemo(
    () => [
      { id: 'live-telemetry', label: 'Live Telemetry', icon: Radio },
      { id: 'ml-forecasts',   label: 'ML Forecasts',   icon: BarChart2 },
      { id: 'simulations',    label: 'Simulations',    icon: Zap },
    ],
    [],
  );

  const menuGroups = useMemo<Record<string, string[]>>(
    () => ({
      'live-telemetry': [
        'telemetry', 'noaa-feed', 'supermag', 'dsn-live', 'iss-track',
        'magnetic-grid', 'mission-core', 'iss-stream', 'terminal-log',
        'aurora-ovation', 'goes-flux',
      ],
      'ml-forecasts': [
        'lstm-forecast', 'forecast-radar', 'data-alchemist', 'kessler-net',
        'progression', 'diagnostics', 'health', 'forecast-slicer',
      ],
      'simulations': [
        'threat-simulator', 'deep-time', 'carrington-sim', 'apophis-tracker',
        'sat-threat', 'human-impact', 'hangar', 'oracle', 'fireball', 'earth-dynamo',
        'planet-core', 'heliopause', 'grid-failure', 'radio-blackout',
      ],
    }),
    [],
  );

  const renderSubmenuContent = (tileId: string) => {
    switch (tileId) {
      case 'telemetry':
        return (
          <TelemetryRibbon
            data={telemetry}
            mode="panel"
            currentPlanet={currentPlanet}
            trackedObject={trackedObject
              ? { name: trackedObject.name, altitudeKm: trackedObject.altitudeKm, inclinationDeg: trackedObject.inclinationDeg }
              : null}
            location={location}
            bundle={noaaDonki.bundle
              ? { kpIndex: noaaDonki.bundle.latestKp, solarWindSpeed: noaaDonki.bundle.speed, bz: noaaDonki.bundle.bzGsm }
              : null}
          />
        );
      case 'mission-core':
        return (
          <div className="text-[10px] uppercase tracking-[0.12em] space-y-1.5">
            <p>Sector: <span className="text-cyan-100">{viewMode}</span></p>
            <p>Date Rail: <span className="text-cyan-100">{currentDate === 'LIVE' ? 'LIVE' : effectiveDate.getFullYear()}</span></p>
            <p>Tactical Alerts: <span className="text-cyan-100">{tacticalAlerts.length}</span></p>
            <CinematicFXToggle quality={fxQuality} onChange={setFxQuality} />
          </div>
        );
      case 'sat-threat':
        return (
          <Suspense fallback={null}>
            <LazySatelliteThreatSlate kpIndex={telemetry.kpIndex} />
          </Suspense>
        );
      case 'human-impact':
        return (
          <Suspense fallback={null}>
            <LazyHumanImpactSlate
              kpIndex={telemetry.kpIndex}
              expansionLatitude={telemetry.expansionLatitude}
              standoffDistance={telemetry.standoffDistance}
              cmeImpactActive={cmeImpactActive}
            />
          </Suspense>
        );
      case 'hangar':
        return (
          <Suspense fallback={null}>
            <LazyHangarModule objects={ACTIVE_OBJECTS} onSelectObject={handleSatelliteSelect} />
          </Suspense>
        );
      case 'oracle':
        return (
          <Suspense fallback={null}>
            <LazyOracleModule />
          </Suspense>
        );
      case 'diagnostics':
        return (
          <PlanetDiagnosticsSlate
            planetName={currentPlanet ?? ''}
            isVisible={showDiagnostics && !!currentPlanet}
            exoTelemetry={selectedExoTelemetry}
          />
        );
      case 'health':
        return (
          <Suspense fallback={null}>
            <LazyHealthDashboard />
          </Suspense>
        );
      case 'noaa-feed':
        return (
          <NOAAFeedHUD
            fallbackKp={telemetry.kpIndex}
            fallbackSpeed={telemetry.windSpeed}
            fallbackBt={6}
          />
        );
      case 'forecast-radar':
        return (
          <ForecastRadarSlate
            kpIndex={telemetry.kpIndex}
            windSpeed={telemetry.windSpeed}
            standoffDistance={telemetry.standoffDistance}
            currentIntensity={telemetry.currentIntensity}
            cmeImpactActive={cmeImpactActive}
            planetName={currentPlanet ?? undefined}
          />
        );
      case 'fireball':
        return (
          <FireballTrackerSlate
            fireballCount={telemetry.fireballCount}
            kpIndex={telemetry.kpIndex}
          />
        );
      case 'lstm-forecast':
        return (
          <LSTMPredictiveGraph
            forecast={lstmWorker.forecast}
            kpCurve24h={lstmWorker.kpCurve24h}
            donkiCMEs={noaaDonki.bundle?.cmeEvents ?? []}
            bundle={noaaDonki.bundle}
            loading={noaaDonki.loading}
            lastFetch={noaaDonki.lastFetch}
            modelStatus={lstmWorker.modelStatus}
            modelUsed={lstmWorker.modelUsed}
          />
        );
      case 'magnetic-grid':
        return (
          <GlobalMagneticGrid
            kpIndex={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 2.5}
            bzGsm={noaaDonki.bundle?.bzGsm ?? -2}
            speed={noaaDonki.bundle?.speed ?? telemetry.windSpeed ?? 450}
            density={noaaDonki.bundle?.density ?? 5}
          />
        );
      case 'dsn-live':
        return <DSNLiveLink />;
      case 'kessler-net':
        return (
          <KesslerNetStats
            kpIndex={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 0}
            cmeActive={cmeActive}
          />
        );
      case 'data-alchemist':
        return (
          <DataAlchemistDashboard
            forecast={lstmWorker.forecast}
            kpCurve24h={lstmWorker.kpCurve24h}
            bundle={noaaDonki.bundle}
            loading={noaaDonki.loading}
            modelStatus={lstmWorker.modelStatus}
            modelUsed={lstmWorker.modelUsed}
          />
        );
      case 'supermag':
        return (
          <SuperMAGPanel
            kpIndex={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 2.5}
            bzGsm={noaaDonki.bundle?.bzGsm ?? -2}
            solarWindSpeed={noaaDonki.bundle?.speed ?? telemetry.windSpeed ?? 450}
            density={noaaDonki.bundle?.density ?? 5}
          />
        );
      case 'progression':
        return <ProgressionGraph kpIndex={telemetry.kpIndex} />;
      case 'threat-simulator':
        return (
          <SolarThreatSimulator
            onLaunchCME={handleSimulatorLaunch}
            isActive={cmeActive}
          />
        );
      case 'deep-time':
        return (
          <DeepTimeSlicer
            currentYearCE={selectedEpochYear}
            onEpochSelect={handleDeepTimeEpochSelect}
          />
        );
      case 'iss-track':
        return (
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#a0d4ff' }}>
            <div style={{ marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '9px', opacity: 0.6 }}>ISS Live Track</div>
            <button
              onClick={() => setShowISS((v) => !v)}
              style={{
                background: showISS ? 'rgba(0,200,100,0.15)' : 'rgba(80,160,255,0.1)',
                border: `1px solid ${showISS ? 'rgba(0,200,100,0.5)' : 'rgba(80,160,255,0.3)'}`,
                borderRadius: '6px',
                padding: '6px 14px',
                color: showISS ? '#88ffcc' : '#a0d4ff',
                cursor: 'pointer',
                fontSize: '10px',
                fontFamily: 'monospace',
              }}
            >
              {showISS ? '● ISS TRACKING ACTIVE' : '○ Enable ISS Tracking'}
            </button>
            {showISS && (
              <div style={{ marginTop: '8px', fontSize: '9px', opacity: 0.65 }}>
                Polling wheretheiss.at every 3 s · Trail: 180 pts
              </div>
            )}
          </div>
        );
      case 'carrington-sim':
        return (
          <div style={{ fontFamily: 'monospace', fontSize: '10px' }}>
            <div style={{ marginBottom: '8px' }}>
              <button
                onClick={() => {
                  setCarringtonActive((v) => !v);
                  setCarringtonSimTime(0);
                  carringtonClockRef.current = 0;
                  if (!carringtonActive) {
                    setCmeActive(true);
                    setTacticalAlerts((p) => [...p, 'CARRINGTON EVENT REPLAY']);
                  }
                }}
                style={{
                  background: carringtonActive ? 'rgba(255,50,0,0.15)' : 'rgba(80,160,255,0.1)',
                  border: `1px solid ${carringtonActive ? '#ff3300' : 'rgba(80,160,255,0.3)'}`,
                  borderRadius: '6px',
                  padding: '6px 14px',
                  color: carringtonActive ? '#ff8866' : '#a0d4ff',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  marginBottom: '8px',
                }}
              >
                {carringtonActive ? '⬛ Stop Simulation' : '▶ Start Carrington Replay'}
              </button>
            </div>
            <CarringtonPanel simulationTimeS={carringtonSimTime} />
          </div>
        );
      case 'apophis-tracker':
        return (
          <div style={{ fontFamily: 'monospace', fontSize: '10px' }}>
            <div style={{ marginBottom: '8px' }}>
              <button
                onClick={() => setApophisVisible((v) => !v)}
                style={{
                  background: apophisVisible ? 'rgba(0,150,255,0.15)' : 'rgba(80,160,255,0.1)',
                  border: `1px solid ${apophisVisible ? 'rgba(80,200,255,0.6)' : 'rgba(80,160,255,0.3)'}`,
                  borderRadius: '6px',
                  padding: '6px 14px',
                  color: apophisVisible ? '#88ccff' : '#a0d4ff',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  marginBottom: '8px',
                }}
              >
                {apophisVisible ? '⬛ Hide Apophis Orbit' : '▶ Show Apophis 2029 Flyby'}
              </button>
            </div>
            <ApophisPanel />
          </div>
        );
      case 'terminal-log':
        return (
          <TerminalLogHUD visible wsUrl="ws://localhost:8080" />
        );
      case 'earth-dynamo':
        return (
          <EarthDynamoPanel
            kpIndex={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 2}
            visible
          />
        );
      case 'iss-stream':
        return (
          <ISSCameraPanel visible />
        );
      case 'forecast-slicer':
        return (
          <ForecastingSlicerPanel
            kpIndex={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 2}
            forecast={lstmWorker.kpCurve24h ?? undefined}
          />
        );
      case 'aurora-ovation':
        return (
          <AuroraOvationHUD
            fallbackKp={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 2}
          />
        );
      case 'goes-flux':
        return <GOESFluxChart />;
      case 'planet-core':
        return <PlanetCore planetName={currentPlanet} />;
      case 'heliopause':
        return (
          <div style={{ fontFamily: 'monospace', fontSize: '10px' }}>
            <div style={{ marginBottom: '8px', fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Heliopause Boundary Shader</div>
            <button
              onClick={() => setHeliopauseVisible((v) => !v)}
              style={{
                background: heliopauseVisible ? 'rgba(80,80,255,0.15)' : 'rgba(80,160,255,0.08)',
                border: `1px solid ${heliopauseVisible ? 'rgba(120,80,255,0.6)' : 'rgba(80,160,255,0.3)'}`,
                borderRadius: '6px', padding: '6px 14px',
                color: heliopauseVisible ? '#bb99ff' : '#a0d4ff',
                cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace',
              }}
            >
              {heliopauseVisible ? '⬛ Hide Heliopause' : '▶ Show Heliopause Shell'}
            </button>
            {heliopauseVisible && (
              <div style={{ marginTop: '6px', fontSize: '8px', opacity: 0.5 }}>
                Termination shock: ~1 600 units · Heliopause: ~2 400 units
              </div>
            )}
          </div>
        );
      case 'grid-failure':
        return (
          <GridFailureSim
            goesFluxWm2={goesFlux.fluxWm2}
          />
        );
      case 'radio-blackout':
        return (
          <div style={{ fontFamily: 'monospace', fontSize: '10px' }}>
            <div style={{ marginBottom: '8px', fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>D-RAP Ionospheric Absorption</div>
            <button
              onClick={() => setBlackoutVisible((v) => !v)}
              style={{
                background: blackoutVisible ? 'rgba(255,80,40,0.15)' : 'rgba(255,140,66,0.08)',
                border: `1px solid ${blackoutVisible ? 'rgba(255,80,40,0.6)' : 'rgba(255,140,66,0.3)'}`,
                borderRadius: '6px', padding: '6px 14px',
                color: blackoutVisible ? '#ff8c42' : '#ffb070',
                cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace',
              }}
            >
              {blackoutVisible ? '⬛ Hide Blackout Layer' : '▶ Show D-RAP Heatmap'}
            </button>
            {blackoutVisible && (
              <div style={{ marginTop: '8px', fontSize: '8px', opacity: 0.5, lineHeight: 1.6 }}>
                <div>Class: <span style={{ color: '#ff8c42' }}>{goesFlux.flareClass}</span></div>
                <div>Flux: {goesFlux.fluxWm2.toExponential(2)} W/m²</div>
                <div style={{ marginTop: 4, opacity: 0.6 }}>Orange overlay = HF radio blackout zone (sunlit hemisphere). Equatorial paths most affected.</div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const handleEpochDialChange = (year: number) => {
    setSelectedEpochYear(year);
    const newDate = new Date(effectiveDate);
    newDate.setFullYear(year);
    setCurrentDate(newDate);
    if (year === 1859) {
      setCmeActive(true);
      setCmeImpactActive(false);
    }
  };

  const handleSimulatorLaunch = (cme: SyntheticCME) => {
    setSyntheticCME(cme);
    setCmeActive(true);
    setCmeImpactActive(false);
  };

  const handleDeepTimeEpochSelect = (yearCE: number, epoch: DeepTimeEpoch) => {
    setSelectedEpochYear(yearCE);
    // Chicxulub K-Pg impact trigger
    if (epoch.eventType === 'impact' && yearCE <= -66_000_000) {
      setChicxulubActive(true);
      setCmeActive(true);
      setTacticalAlerts((prev) => [...prev, `CHICXULUB IMPACT // K-Pg Boundary // −66 Ma`]);
    }
  };

  const handleChicxulubComplete = () => {
    setChicxulubActive(false);
  };

  const focusOnPlanet = (planetName: string) => {
    setShowDiagnostics(false);
    setCurrentPlanet(planetName as BodyName);
    setTrackedPlanetName(planetName);
    if (planetName === 'Earth') {
      setCmeActive(false);
      setCmeImpactActive(false);
      setImpactBurstActive(false);
    }
  };

  // ─── Web Speech API voice command handler ──────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSpeechAction = (action: SpeechAction) => {
    switch (action.type) {
      case 'SET_LIVE':
        setCurrentDate('LIVE');
        setSelectedEpochYear(2026);
        break;
      case 'SET_HISTORICAL':
        if (currentDate === 'LIVE') setCurrentDate(new Date());
        break;
      case 'SET_VIEW':
        setViewMode(action.view);
        break;
      case 'ZOOM_TO':
        focusOnPlanet(action.planet);
        break;
      case 'OPEN_TILE':
        setSelectedTileId(action.tileId);
        setOpenMenuId('mission-core');
        setActiveSubTileId(action.tileId);
        break;
      case 'SET_LOCATION': {
        const preset = LOCATION_PRESETS.find((p) =>
          p.name.toLowerCase().includes(action.locationName.toLowerCase()),
        );
        if (preset) setLocation(preset);
        break;
      }
    }
  };
  const { supported: speechSupported, listening: speechListening, lastCommand: speechLastCmd, toggle: toggleSpeech } =
    useSpeechCommands({ onAction: handleSpeechAction });

  // ─── NOAA / DONKI live data (web worker) ────────────────────────────────────
  const noaaDonki = useNOAADONKI();

  // ─── LSTM off-thread inference (web worker) ─────────────────────────────────
  const lstmWorker = useLSTMWorker();
  const goesFlux = useGOESFlux();

  // Build FeatureVector for LSTM from live NOAA bundle + telemetry fallback
  useEffect(() => {
    const kpSeries  = noaaDonki.bundle?.kpSeries ?? [];
    const observed  = kpSeries.filter((p) => p.source === 'observed').slice(-24);
    const kpArr: number[]     = observed.length >= 4
      ? observed.map((p) => p.kp)
      : Array.from({ length: 24 }, () => telemetry.kpIndex ?? 2.5);
    const speed = noaaDonki.bundle?.speed   ?? telemetry.windSpeed ?? 450;
    const bz    = noaaDonki.bundle?.bzGsm   ?? -2;
    const bt    = noaaDonki.bundle?.bt      ?? 6;
    const den   = noaaDonki.bundle?.density ?? 5;
    const pad   = <T,>(arr: T[], fill: T): T[] => [
      ...Array.from({ length: Math.max(0, 24 - arr.length) }, () => fill),
      ...arr.slice(-24),
    ];
    lstmWorker.infer({
      solarWindSpeed:     pad(Array.from({ length: 24 }, () => speed), speed),
      solarWindDensity:   pad(Array.from({ length: 24 }, () => den),   den),
      magneticFieldBt:    pad(Array.from({ length: 24 }, () => bt),    bt),
      magneticFieldBz:    pad(Array.from({ length: 24 }, () => bz),    bz),
      kpIndex:            pad(kpArr, kpArr[kpArr.length - 1] ?? 2.5),
      newellCouplingHistory: Array.from({ length: 24 }, () => Math.max(0, -bz) * speed * den * 0.001),
    } as Parameters<typeof lstmWorker.infer>[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noaaDonki.bundle, telemetry.kpIndex, telemetry.windSpeed]);

  const handleFocusAnimationComplete = () => {
    setShowDiagnostics(true);
  };

  const handleSatelliteSelect = (object: ActiveObject) => {
    setTrackedObject(object);
    setViewMode('HELIOCENTRIC');
    setShowDiagnostics(false);
    setSatelliteFocusTarget(object.orbitalNode.clone());
    setSatelliteFocusTrigger((prev) => prev + 1);
  };

  const effectiveDate = currentDate === 'LIVE' ? new Date() : currentDate;

  // Check if current date matches a historical event
  const currentHistoricalEvent = useMemo(() => {
    if (currentDate === 'LIVE') return null;
    
    const events = eventsData.events;
    return events.find(event => {
      const eventStart = new Date(event.observationStart);
      const eventImpact = new Date(event.impactDate);
      return effectiveDate >= eventStart && effectiveDate <= eventImpact;
    }) || null;
  }, [currentDate, effectiveDate]);

  const handleCmeImpact = (planetName: string) => {
    if (planetName === 'Earth') {
      setCmeImpactActive(true);
      setImpactBurstActive(true);
      if (burstTimeoutRef.current) {
        window.clearTimeout(burstTimeoutRef.current);
      }
      burstTimeoutRef.current = window.setTimeout(() => {
        setImpactBurstActive(false);
      }, 900);
      setTacticalAlerts((prev) => {
        const alert = `CME IMPACT // ${new Date().toLocaleTimeString()}`;
        return prev.includes(alert) ? prev : [...prev, alert];
      });
    }
  };

  useEffect(() => {
    return () => {
      if (burstTimeoutRef.current) {
        window.clearTimeout(burstTimeoutRef.current);
      }
      if (flickerSuppressionTimeoutRef.current) {
        window.clearTimeout(flickerSuppressionTimeoutRef.current);
      }
    };
  }, []);

  const selectedExoTelemetry = useMemo(() => {
    if (!currentPlanet || telemetry.kp === undefined) {
      return undefined;
    }

    if (currentPlanet === 'Pluto' || currentPlanet === 'Moon' || currentPlanet === 'Io' || currentPlanet === 'Europa' || currentPlanet === 'Titan') {
      return calculateExoTelemetry(
        currentPlanet,
        7,
        telemetry.windSpeed,
        6,
        telemetry.kp,
        effectiveDate,
      );
    }

    return undefined;
  }, [currentPlanet, effectiveDate, telemetry.kp, telemetry.windSpeed]);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }
    const groupIds = menuGroups[openMenuId] ?? [];
    if (groupIds.length > 0 && !groupIds.includes(activeSubTileId)) {
      setActiveSubTileId(groupIds[0]);
    }
  }, [activeSubTileId, menuGroups, openMenuId]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewMode('HELIOCENTRIC');
        setCurrentPlanet(null);
        setShowDiagnostics(false);
        setOpenMenuId(null);
      }

      if (event.key.toLowerCase() === 'r') {
        setCurrentDate('LIVE');
        setTacticalAlerts([]);
        setSelectedEpochYear(2026);
        setCmeImpactActive(false);
        setImpactBurstActive(false);
        setFlickerSuppressed(true);
        if (flickerSuppressionTimeoutRef.current) {
          window.clearTimeout(flickerSuppressionTimeoutRef.current);
        }
        flickerSuppressionTimeoutRef.current = window.setTimeout(() => {
          setFlickerSuppressed(false);
          flickerSuppressionTimeoutRef.current = null;
        }, 30_000);
      }

      if (event.key === 'Escape' && trackedPlanetName) {
        setTrackedPlanetName(null);
      }
    };

    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [openMenuId, trackedPlanetName]);

  // Carrington sim clock — update panel stats in real-time
  useEffect(() => {
    if (!carringtonActive) {
      carringtonClockRef.current = 0;
      setCarringtonSimTime(0);
      return;
    }
    const startMs = Date.now() - carringtonClockRef.current * 1000;
    const id = setInterval(() => {
      const elapsed = (Date.now() - startMs) / 1000;
      carringtonClockRef.current = elapsed;
      setCarringtonSimTime(elapsed);
    }, 500);
    return () => clearInterval(id);
  }, [carringtonActive]);

  useEffect(() => {
    if ((telemetry.kpIndex ?? 0) >= 7) {
      setTacticalAlerts((prev) => {
        const marker = `KP-${telemetry.kpIndex.toFixed(1)}-${telemetry.source}`;
        if (prev.includes(marker)) {
          return prev;
        }
        return [...prev, marker];
      });
    }
  }, [telemetry.kpIndex, telemetry.source]);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-mono text-cyan-400">
      <div className="fixed inset-0 z-0 pointer-events-auto">
        <SlateErrorBoundary moduleName="Observa-Scene" fallback={<div className="absolute inset-0 bg-black/40" />}>
          <Canvas
            shadows
            gl={{ antialias: true, alpha: true, logarithmicDepthBuffer: true }}
            onCreated={({ gl }) => {
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFShadowMap;
              setTexturesLoaded(true);
            }}
            style={{ position: 'absolute', insetBlockStart: 0, insetInlineStart: 0, zIndex: 0 }}
          >
            <PerspectiveCamera makeDefault position={[0, 150, 300]} fov={65} />
            <EnhancedStarfield />
            {/* Local Interstellar Cloud — warm LIC shell enveloping the scene */}
            <LocalInterstellarCloud />
            {/* Heliopause — outer heliosphere boundary (user-toggled) */}
            <HeliopauseShell visible={heliopauseVisible} />
            <ambientLight intensity={0.15} />
            <pointLight position={[0, 0, 0]} intensity={5} color="#fffae5" decay={2} distance={2000} castShadow />

            {/* THE SUN: RENDERED IN HELIOCENTRIC MODE */}
            {viewMode === 'HELIOCENTRIC' && (
              <>
                <DynamicSun
                  intensity={telemetry.currentIntensity}
                  solarWindSpeed={currentHistoricalEvent?.solarWindSpeed || telemetry.windSpeed}
                  isHistoricalEvent={!!currentHistoricalEvent}
                />
                {/* Sagittarius A* — supermassive black hole at galactic centre */}
                <SagittariusA />
                {/* Kuiper Belt — visible in heliocentric view */}
                <KuiperBelt visible={viewMode === 'HELIOCENTRIC'} />
                {/* Oort Cloud — log-depth GLSL shell at artistic 4–7k units */}
                <OortCloud visible={viewMode === 'HELIOCENTRIC'} />
              </>
            )}

            <Suspense fallback={null}>
              {viewMode === 'SURFACE' ? (
                <>
                  {/* Distant Sun as point light source in sky */}
                  <mesh position={[500, 300, -800]} scale={20}>
                    <sphereGeometry args={[1, 16, 16]} />
                    <meshBasicMaterial 
                      color="#ffee99" 
                      toneMapped={false}
                    />
                  </mesh>
                  <SurfaceAtmosphere color="#00f3ff" type="CO2" density={Math.max(0.9, telemetry.currentIntensity * 2)} />
                  <SurfaceGroundPlane planetName={currentPlanet} />
                </>
              ) : (
                <Suspense fallback={null}>
                  <LazyPlanetRenderer
                    onPlanetSelect={focusOnPlanet}
                    onFocusAnimationComplete={handleFocusAnimationComplete}
                    currentIntensity={telemetry.currentIntensity}
                    currentDate={effectiveDate}
                    cmeOverdrive={cmeImpactActive}
                    standoffDistance={telemetry.standoffDistance}
                    onPlanetRefsReady={setPlanetRefs}
                    epochYear={selectedEpochYear}
                  />
                  {/* Apophis 2029 flyby orbit */}
                  <ApophisTracker visible={apophisVisible} epochYear={selectedEpochYear} />
                  <CameraTracker
                    targetName={trackedPlanetName}
                    planetRefs={planetRefs}
                    isEnabled={!!trackedPlanetName}
                  />
                  <LazyCMEPropagationVisualizer
                    isActive={cmeActive}
                    speed={telemetry.windSpeed || 450}
                    onImpact={handleCmeImpact}
                  />
                  {trackedObject && (
                    <SatelliteOrbitalTracker
                      planetPosition={trackedObject.hostPosition}
                      planetRadius={trackedObject.hostRadius}
                      standoffDistance={telemetry.standoffDistance}
                    />
                  )}
                  <SatelliteCameraFocus
                    target={satelliteFocusTarget}
                    trigger={satelliteFocusTrigger}
                    onComplete={handleFocusAnimationComplete}
                  />
                  <CMECameraShakeBurst active={impactBurstActive} />
                  {/* Earth Bow-Shock / Magnetopause — Chapman-Ferraro density binding */}
                  {currentPlanet === 'Earth' && (() => {
                    const earthRef = planetRefs?.get('Earth');
                    const pos = earthRef ? new THREE.Vector3().setFromMatrixPosition(earthRef.matrixWorld) : new THREE.Vector3(60, 0, 0);
                    const posArr: [number, number, number] = [pos.x, pos.y, pos.z];
                    return (
                      <>
                        <EarthBowShock
                          earthPos={pos}
                          cmeActive={cmeActive || cmeImpactActive}
                          kpIndex={telemetry.kpIndex ?? 0}
                          sunDirection={new THREE.Vector3(1, 0, 0)}
                          solarWindDensity={syntheticCME?.density ?? noaaDonki.bundle?.density ?? 5}
                          solarWindSpeed={syntheticCME?.speed ?? noaaDonki.bundle?.speed ?? 450}
                        />
                        {/* Live cloud layer on Earth */}
                        <EarthCloudLayer earthPos={pos} visible />
                        {/* Real-time ISS orbital trail */}
                        {showISS && <LiveISS earthPos={pos} visible={showISS} />}
                        {/* Chicxulub K-Pg impact sequence */}
                        <ChicxulubEvent
                          earthPos={posArr}
                          active={chicxulubActive}
                          onComplete={handleChicxulubComplete}
                        />
                        {/* Carrington 1859 magnetic storm */}
                        <CarringtonSim earthPos={posArr} active={carringtonActive} />
                        {/* Earth Core Dynamo — inner / outer core + dipole field lines */}
                        <EarthCoreDynamo
                          earthPos={posArr}
                          visible={currentPlanet === 'Earth'}
                          kpIndex={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 2}
                        />
                        {/* D-RAP Radio Blackout Heatmap — driven by live GOES X-ray flux */}
                        <RadioBlackoutHeatmap
                          earthPos={posArr}
                          fluxWm2={goesFlux.fluxWm2}
                          visible={blackoutVisible}
                        />
                      </>
                    );
                  })()}
                </Suspense>
              )}
            </Suspense>

            <OrbitControls enablePan enableZoom makeDefault minDistance={20} maxDistance={4000} />
            (
              <Suspense fallback={null}>
                <LazyCinematicPostFX
                  quality={fxQuality}
                  boost={cmeImpactActive ? 1 : telemetry.currentIntensity}
                  burstActive={impactBurstActive}
                />
              </Suspense>
            )
          </Canvas>
        </SlateErrorBoundary>
      </div>

      <div className="fixed inset-0 z-50 pointer-events-none select-none">
        {booted && (
          <>
            {/* ═══ UNIFIED COMMAND DECK (Side-by-Side) ═══ [cite: 2025-12-11] */}
            {!hudMinimized && (
              /* ═══ COMMAND DECK: Bottom-anchored, left/right columns ═══ */
              <div className="absolute inset-0 flex flex-col justify-end pb-28 pointer-events-none">
                <div className="flex flex-row items-end justify-between w-full px-4 pointer-events-auto">
                  
                  {/* LEFT SECTOR: Mission & Threats */}
                  <div className="flex flex-col gap-4 w-[340px] max-h-[60vh] overflow-y-auto wolf-scroll shrink-0">
                    <div className={flickerClass}>
                      {!isTileHidden('telemetry') && (
                        <SlateTile tileId="telemetry" title="Telemetry Ribbon" accent="cyan" isSelected={selectedTileId === 'telemetry'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <TelemetryRibbon
                            data={telemetry}
                            currentPlanet={currentPlanet}
                            trackedObject={trackedObject
                              ? { name: trackedObject.name, altitudeKm: trackedObject.altitudeKm, inclinationDeg: trackedObject.inclinationDeg }
                              : null}
                            location={location}
                            bundle={noaaDonki.bundle
                              ? { kpIndex: noaaDonki.bundle.latestKp, solarWindSpeed: noaaDonki.bundle.speed, bz: noaaDonki.bundle.bzGsm }
                              : null}
                          />
                        </SlateTile>
                      )}

                      {!isTileHidden('mission-core') && (
                        <SlateTile tileId="mission-core" title="Mission Core" accent="cyan" isSelected={selectedTileId === 'mission-core'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <h2 className="text-xs tracking-tighter uppercase mb-2">Sector: {viewMode}</h2>
                          <p className="text-[10px] text-slate-500 italic">Neural Link: Nominal</p>
                          <p className="text-[9px] text-cyan-500/70 mt-1">Date Rail: {currentDate === 'LIVE' ? 'LIVE' : effectiveDate.getFullYear()}</p>
                          <p className="text-[9px] text-amber-300/80 mt-1">Tactical Alerts: {tacticalAlerts.length}</p>
                          <CinematicFXToggle quality={fxQuality} onChange={setFxQuality} />
                        </SlateTile>
                      )}

                      {!isTileHidden('sat-threat') && (
                        <SlateTile tileId="sat-threat" title="Orbital Threat" accent="red" isSelected={selectedTileId === 'sat-threat'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <Suspense fallback={null}><LazySatelliteThreatSlate kpIndex={telemetry.kpIndex} /></Suspense>
                        </SlateTile>
                      )}

                      {!isTileHidden('human-impact') && (
                        <SlateTile tileId="human-impact" title="Human Impact" accent="amber" isSelected={selectedTileId === 'human-impact'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <Suspense fallback={null}>
                            <LazyHumanImpactSlate kpIndex={telemetry.kpIndex} expansionLatitude={telemetry.expansionLatitude} standoffDistance={telemetry.standoffDistance} cmeImpactActive={cmeImpactActive} />
                          </Suspense>
                        </SlateTile>
                      )}

                      {!isTileHidden('hangar') && (
                        <SlateTile tileId="hangar" title="Hangar Uplink" accent="cyan" isSelected={selectedTileId === 'hangar'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <Suspense fallback={null}><LazyHangarModule objects={ACTIVE_OBJECTS} onSelectObject={handleSatelliteSelect} /></Suspense>
                        </SlateTile>
                      )}

                      {!isTileHidden('oracle') && (
                        <SlateTile tileId="oracle" title="Oracle Archive" accent="violet" isSelected={selectedTileId === 'oracle'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <Suspense fallback={null}><LazyOracleModule /></Suspense>
                        </SlateTile>
                      )}

                      {!isTileHidden('fireball') && (
                        <SlateTile tileId="fireball" title="Fireball Tracker" accent="amber" isSelected={selectedTileId === 'fireball'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <FireballTrackerSlate fireballCount={telemetry.fireballCount} kpIndex={telemetry.kpIndex} />
                        </SlateTile>
                      )}
                    </div>
                  </div>

                  {/* RIGHT SECTOR: Diagnostics & Health */}
                  <div className="flex flex-col gap-4 w-[280px] max-h-[60vh] overflow-y-auto wolf-scroll shrink-0">
                    <div className={flickerClass}>
                      {!isTileHidden('forecast-radar') && (
                        <SlateTile tileId="forecast-radar" title="Forecast Radar" accent="cyan" isSelected={selectedTileId === 'forecast-radar'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <ForecastRadarSlate
                            kpIndex={telemetry.kpIndex}
                            windSpeed={telemetry.windSpeed}
                            standoffDistance={telemetry.standoffDistance}
                            currentIntensity={telemetry.currentIntensity}
                            cmeImpactActive={cmeImpactActive}
                            planetName={currentPlanet ?? undefined}
                          />
                        </SlateTile>
                      )}

                      {!isTileHidden('diagnostics') && (
                        <SlateTile tileId="diagnostics" title="Planet Diagnostics" accent="violet" isSelected={selectedTileId === 'diagnostics'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <PlanetDiagnosticsSlate planetName={currentPlanet ?? ''} isVisible={showDiagnostics && !!currentPlanet} exoTelemetry={selectedExoTelemetry} />
                        </SlateTile>
                      )}

                      {!isTileHidden('health') && (
                        <SlateTile tileId="health" title="Neural Health" accent="cyan" isSelected={selectedTileId === 'health'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <Suspense fallback={null}><LazyHealthDashboard /></Suspense>
                        </SlateTile>
                      )}

                      {!isTileHidden('noaa-feed') && (
                        <SlateTile tileId="noaa-feed" title="NOAA Live Feed" accent="cyan" isSelected={selectedTileId === 'noaa-feed'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <NOAAFeedHUD
                            fallbackKp={telemetry.kpIndex}
                            fallbackSpeed={telemetry.windSpeed}
                            fallbackBt={6}
                          />
                        </SlateTile>
                      )}

                      {!isTileHidden('lstm-forecast') && (
                        <SlateTile tileId="lstm-forecast" title="LSTM Forecast" accent="cyan" isSelected={selectedTileId === 'lstm-forecast'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <LSTMPredictiveGraph
                            forecast={lstmWorker.forecast}
                            kpCurve24h={lstmWorker.kpCurve24h}
                            donkiCMEs={noaaDonki.bundle?.cmeEvents ?? []}
                            bundle={noaaDonki.bundle}
                            loading={noaaDonki.loading}
                            lastFetch={noaaDonki.lastFetch}
                            modelStatus={lstmWorker.modelStatus}
                            modelUsed={lstmWorker.modelUsed}
                          />
                        </SlateTile>
                      )}

                      {!isTileHidden('magnetic-grid') && (
                        <SlateTile tileId="magnetic-grid" title="Magnetic Grid" accent="cyan" isSelected={selectedTileId === 'magnetic-grid'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <GlobalMagneticGrid
                            kpIndex={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 2.5}
                            bzGsm={noaaDonki.bundle?.bzGsm ?? -2}
                            speed={noaaDonki.bundle?.speed ?? telemetry.windSpeed ?? 450}
                            density={noaaDonki.bundle?.density ?? 5}
                          />
                        </SlateTile>
                      )}

                      {!isTileHidden('dsn-live') && (
                        <SlateTile tileId="dsn-live" title="DSN Live Link" accent="cyan" isSelected={selectedTileId === 'dsn-live'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <DSNLiveLink />
                        </SlateTile>
                      )}

                      {!isTileHidden('kessler-net') && (
                        <SlateTile tileId="kessler-net" title="Kessler Net" accent="cyan" isSelected={selectedTileId === 'kessler-net'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <KesslerNetStats
                            kpIndex={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 0}
                            cmeActive={cmeActive}
                          />
                        </SlateTile>
                      )}

                      {!isTileHidden('data-alchemist') && (
                        <SlateTile tileId="data-alchemist" title="Data Alchemist" accent="cyan" isSelected={selectedTileId === 'data-alchemist'} onSelect={setSelectedTileId} maximizedTileId={maximizedTileId}>
                          <DataAlchemistDashboard
                            forecast={lstmWorker.forecast}
                            kpCurve24h={lstmWorker.kpCurve24h}
                            bundle={noaaDonki.bundle}
                            loading={noaaDonki.loading}
                            modelStatus={lstmWorker.modelStatus}
                            modelUsed={lstmWorker.modelUsed}
                          />
                        </SlateTile>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Live ISS HUD overlay */}
            {showISS && <LiveISSHUD data={null} visible={showISS} />}
            <LandingSlate planetName={viewMode === 'HELIOCENTRIC' ? currentPlanet : null} onInitiateLanding={() => setViewMode('SURFACE')} />
            <MagneticReversalAlert active={selectedEpochYear <= -66000000} />

            {viewMode === 'SURFACE' && (
              <button type="button" onClick={() => setViewMode('HELIOCENTRIC')} className="absolute right-6 top-12 pointer-events-auto h-7 px-3 text-[9px] uppercase tracking-[0.2em] border border-cyan-400/40 bg-black/60 backdrop-blur-md text-cyan-100">Exit Landing</button>
            )}

            <div className={[
              'absolute left-1/2 -translate-x-1/2 bottom-3 z-[98] w-[min(98vw,1100px)] pointer-events-auto border bg-black/75 backdrop-blur-lg px-2.5 sm:px-3 py-2 rounded-xl',
              flickerClass,
              isReversal ? 'skoll-reversal-banner border-red-500/50' : 'border-cyan-500/30',
            ].join(' ')}>
              <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_auto] items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg border border-cyan-400/45 flex items-center justify-center text-cyan-200 bg-cyan-500/5">
                    <Orbit size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[7px] sm:text-[8px] uppercase tracking-[0.18em] text-cyan-500/70">Control</div>
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.1em] text-cyan-100 font-semibold truncate">{selectedTileLabel}</div>
                    <div className="text-[7px] sm:text-[8px] uppercase tracking-[0.08em] text-cyan-400/70 truncate">{trackedPlanetName ? `Tracking ${trackedPlanetName}` : 'Mission Core'}</div>
                  </div>
                </div>

                <div className="min-w-0 flex items-center gap-1.5 sm:gap-2">
                  <label htmlFor="epoch-dial" className="text-[7px] sm:text-[8px] uppercase tracking-[0.18em] text-cyan-500/70 shrink-0">Epoch</label>
                  <input
                    id="epoch-dial"
                    type="range"
                    min={1859}
                    max={2100}
                    value={selectedEpochYear}
                    onChange={(event) => handleEpochDialChange(Number(event.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="text-[9px] sm:text-[10px] font-semibold tabular-nums text-cyan-100 w-11 sm:w-12 text-right">{selectedEpochYear}</div>
                  {/* Temporal Reset — snaps epoch back to current calendar year */}
                  <button
                    type="button"
                    title="Reset to current year (Date.now)"
                    onClick={() => setSelectedEpochYear(new Date().getFullYear())}
                    className="shrink-0 h-6 px-1.5 rounded border border-cyan-500/40 hover:border-cyan-300 hover:bg-cyan-500/10 text-cyan-400 hover:text-cyan-200 transition-colors flex items-center gap-0.5"
                    style={{ fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
                  >
                    ↺ Now
                  </button>
                  {/* Master Reset — clears all active simulations */}
                  <button
                    type="button"
                    title="Master Reset — clear all active simulations"
                    onClick={handleMasterReset}
                    className="shrink-0 h-6 px-1.5 rounded border border-red-500/40 hover:border-red-300 hover:bg-red-500/10 text-red-400 hover:text-red-200 transition-colors flex items-center gap-0.5"
                    style={{ fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
                  >
                    ⊘ Reset
                  </button>
                </div>

                {/* Location switcher */}
                <div className="flex items-center">
                  <LocationSwitcher value={location} onChange={setLocation} />
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 justify-start lg:justify-end flex-wrap">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        setSelectedTileId(action.id);
                        setHiddenTileIds((prev) => prev.filter((id) => id !== action.id));
                        setOpenMenuId((prev) => (prev === action.id ? null : action.id));
                        const groupIds = menuGroups[action.id] ?? [];
                        if (groupIds.length > 0) {
                          setActiveSubTileId(groupIds[0]);
                        }
                      }}
                      className={`h-7 sm:h-8 w-9 sm:w-10 rounded-md border text-cyan-100 flex items-center justify-center transition-colors ${openMenuId === action.id ? 'border-cyan-300 bg-cyan-500/15' : 'border-cyan-500/40 hover:bg-cyan-500/10'}`}
                      title={action.label}
                    >
                      <action.icon size={13} />
                    </button>
                  ))}
                  {trackedPlanetName && (
                    <button type="button" onClick={() => setTrackedPlanetName(null)} className="h-7 sm:h-8 px-2 rounded-md border border-amber-400/40 text-[8px] uppercase tracking-[0.14em] text-amber-100 hover:bg-amber-500/10">Stop</button>
                  )}
                  {/* Voice command toggle */}
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleSpeech}
                      title={speechListening ? 'Stop voice commands' : 'Enable voice commands'}
                      className={`h-7 sm:h-8 w-9 sm:w-10 rounded-md border flex items-center justify-center transition-colors ${
                        speechListening
                          ? 'border-red-400/60 bg-red-500/15 text-red-300 animate-pulse'
                          : 'border-cyan-500/40 text-cyan-500/60 hover:bg-cyan-500/10'
                      }`}
                    >
                      {speechListening ? <MicOff size={13} /> : <Mic size={13} />}
                    </button>
                  )}
                  {/* Solar flare audio toggle */}
                  <button
                    type="button"
                    onClick={toggleFlareAudio}
                    title={flareAudioEnabled ? 'Mute solar audio' : 'Enable solar audio'}
                    className={`h-7 sm:h-8 px-2 rounded-md border text-[8px] uppercase tracking-[0.12em] transition-colors ${
                      flareAudioEnabled
                        ? 'border-amber-400/60 bg-amber-500/10 text-amber-300'
                        : 'border-cyan-500/40 text-cyan-500/60 hover:bg-cyan-500/10'
                    }`}
                  >
                    {flareAudioEnabled ? '🔊' : '🔇'}
                  </button>
                  {/* Speech command HUD */}
                  {speechLastCmd && (
                    <div className="h-7 sm:h-8 px-2 rounded-md border border-green-400/40 bg-green-500/10 flex items-center text-[8px] uppercase tracking-[0.14em] text-green-300 font-mono">
                      ✓ {speechLastCmd}
                    </div>
                  )}
                  {/* ISO 8601 live sync badge */}
                  <LiveSyncBadge
                    lastFetch={noaaDonki.lastFetch}
                    source="NOAA SWPC"
                    isLiveMode={currentDate === 'LIVE'}
                    epochYear={currentDate !== 'LIVE' ? selectedEpochYear : undefined}
                  />
                </div>
              </div>

              <AnimatePresence initial={false}>
                {openMenuId && (
                  <motion.div
                    key={openMenuId}
                    initial={{ opacity: 0, y: 8, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.995 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="mt-2 border border-cyan-500/20 rounded-md bg-black/40 p-2"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex-1 overflow-x-auto wolf-scroll">
                        <div className="flex items-center gap-1.5 min-w-max pr-1">
                          {(menuGroups[openMenuId] ?? []).map((tileId) => (
                            <button
                              key={tileId}
                              type="button"
                              onClick={() => {
                                setSelectedTileId(tileId);
                                setActiveSubTileId(tileId);
                              }}
                              className={`h-6 px-2 rounded border text-[8px] uppercase tracking-[0.14em] whitespace-nowrap ${activeSubTileId === tileId ? 'border-cyan-300 text-cyan-100 bg-cyan-500/10' : 'border-cyan-500/30 text-cyan-300/90 hover:bg-cyan-500/10'}`}
                            >
                              {tileCatalog.find((tile) => tile.id === tileId)?.label ?? tileId}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(null)}
                        className="h-6 px-2 rounded border border-cyan-500/30 text-[8px] uppercase tracking-[0.14em] text-cyan-200 hover:bg-cyan-500/10 shrink-0"
                      >
                        Close
                      </button>
                    </div>
                    <div className="max-h-[34vh] overflow-y-auto wolf-scroll pr-1">
                      {renderSubmenuContent(activeSubTileId)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>


            </div>
          </>
        )}
      </div>

      {!booted && (
        <div className="fixed inset-0 z-[110] pointer-events-auto">
          <NeuralBoot
            isLoaded={texturesLoaded && telemetry.kp !== undefined}
            onComplete={() => {
              setBooted(true);
              setViewMode('HELIOCENTRIC');
            }}
          />
        </div>
      )}
    </div>
  );
}