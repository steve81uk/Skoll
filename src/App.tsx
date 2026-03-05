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
import { MagneticReversalAlert } from './components/MagneticReversalAlert';
import { SlateErrorBoundary } from './components/SlateErrorBoundary';
import type { ActiveObject } from './components/HangarModule';
import { SatelliteOrbitalTracker } from './components/SatelliteOrbitalTracker';
import { useGlobalTelemetry } from './hooks/useGlobalTelemetry';
import { calculateExoTelemetry, SYSTEM_CONSTANTS } from './ml/ExoPhysics';
import { SurfaceAtmosphere } from './shaders/SurfaceAtmosphereShader';
import { CameraTracker } from './components/CameraTracker';
import { DynamicSun } from './components/DynamicSun';
import { EnhancedStarfield } from './components/EnhancedStarfield';
import { ForecastRadarSlate } from './components/ForecastRadarSlate';
import { FireballTrackerSlate } from './components/FireballTrackerSlate';
import { NOAAFeedHUD } from './components/NOAAFeedHUD';
import { LSTMPredictiveGraph } from './components/LSTMPredictiveGraph';
import { GlobalMagneticGrid } from './components/GlobalMagneticGrid';
import { DSNLiveLink } from './components/DSNLiveLink';
import { DataAlchemistDashboard } from './components/DataAlchemistDashboard';
import { LiveSyncBadgeCompact } from './components/LiveSyncBadge';
import LocationSwitcher, { LOCATION_PRESETS } from './components/LocationSwitcher';
import type { LocationPreset } from './components/LocationSwitcher';
import EarthBowShock from './components/EarthBowShock';
import LiveISS, { LiveISSHUD } from './components/LiveISS';
import SuperMAGPanel from './components/SuperMAGPanel';
import ProgressionGraph from './components/ProgressionGraph';
import SolarThreatSimulator from './components/SolarThreatSimulator';
import type { SyntheticCME } from './components/SolarThreatSimulator';
import EarthCloudLayer from './components/EarthCloudLayer';
import type { DeepTimeEpoch } from './components/DeepTimeSlicer';
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
import { createHazardTelemetryModel } from './services/hazardModel';
import eventsData from './ml/space_weather_events.json';

type ViewMode = 'HELIOCENTRIC' | 'SURFACE';
type TimeMode = Date | 'LIVE';
type BodyName = keyof typeof SYSTEM_CONSTANTS;
type FXQuality = 'LOW' | 'HIGH';
type DockTone = 'telemetry' | 'forecast' | 'sim';
type DockStatus = 'green' | 'amber' | 'red';
type DockSide = 'left' | 'right';
type ModalSnap = 'left' | 'center' | 'right';
type PerfChipPosition = { x: number; y: number };
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
const LazySagittariusA = lazy(() => import('./components/SagittariusA').then((module) => ({ default: module.SagittariusA })));
const LazyKuiperBelt = lazy(() => import('./components/KuiperBelt'));
const LazyOortCloud = lazy(() => import('./components/OortCloud'));
const LazyDeepTimeSlicer = lazy(() => import('./components/DeepTimeSlicer'));
const LazyChicxulubEvent = lazy(() => import('./components/ChicxulubEvent'));
const LazyCarringtonSim = lazy(() => import('./components/CarringtonSim'));
const LazyCarringtonPanel = lazy(() => import('./components/CarringtonSim').then((module) => ({ default: module.CarringtonPanel })));
const LazyApophisTracker = lazy(() => import('./components/ApophisTracker'));
const LazyApophisPanel = lazy(() => import('./components/ApophisTracker').then((module) => ({ default: module.ApophisPanel })));
const LazyKesslerNetStats = lazy(() => import('./components/KesslerNet').then((module) => ({ default: module.KesslerNetStats })));

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

const MissionUTCTime = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="live-clock text-[8px] uppercase tracking-[0.08em] text-cyan-400/70">
      {now.toISOString().slice(11, 19)} UTC
    </span>
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
  const [selectedTileId, setSelectedTileId] = useState<string>('mission-core');
  const [, setHiddenTileIds] = useState<string[]>([]);
  const [selectedEpochYear, setSelectedEpochYear] = useState<number>(2026);
  const [showISS, setShowISS] = useState(false);
  const [syntheticCME, setSyntheticCME] = useState<SyntheticCME | null>(null);
  const [chicxulubActive, setChicxulubActive] = useState(false);
  const [carringtonActive, setCarringtonActive] = useState(false);
  const [apophisVisible, setApophisVisible] = useState(false);
  const [carringtonDisplayTime, setCarringtonDisplayTime] = useState(0);
  const carringtonClockRef = useRef(0);
  const carringtonDisplayRef = useRef(0);
  const [heliopauseVisible, setHeliopauseVisible] = useState(false);
  const [blackoutVisible, setBlackoutVisible] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [dockModalTileId, setDockModalTileId] = useState<string | null>(null);
  const [dockModalPinned, setDockModalPinned] = useState(false);
  const [modalSnap, setModalSnap] = useState<ModalSnap>(() => {
    const saved = window.localStorage.getItem('skoll.modalSnap');
    return saved === 'left' || saved === 'center' || saved === 'right' ? saved : 'center';
  });
  const [hoveredDock, setHoveredDock] = useState<{ label: string; status: DockStatus; x: number; y: number; side: DockSide } | null>(null);
  const [fps, setFps] = useState(60);
  const [lstmLatencyMs, setLstmLatencyMs] = useState<number | null>(null);
  const [perfChipPosition, setPerfChipPosition] = useState<PerfChipPosition>(() => {
    const defaultPosition = { x: Math.max(16, window.innerWidth - 250), y: Math.max(16, window.innerHeight - 74) };
    const saved = window.localStorage.getItem('skoll.perfChipPosition');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<PerfChipPosition>;
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return { x: parsed.x, y: parsed.y };
        }
      } catch {
        return defaultPosition;
      }
    }
    return defaultPosition;
  });
  const perfChipDragRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });
  const inferDispatchRef = useRef<number | null>(null);
  const [location, setLocation] = useState<LocationPreset>({ name: 'Cambridge, UK', lat: 52.2, lon: 0.12 });
  const [activeSubTileId, setActiveSubTileId] = useState<string>('mission-core');
  const [hudMinimized] = useState(false);
  const [trackedPlanetName, setTrackedPlanetName] = useState<string | null>(null);
  const [planetRefs, setPlanetRefs] = useState<Map<string, THREE.Group>>(new Map());
  const burstTimeoutRef = useRef<number | null>(null);

  /** Master Reset — clears every active simulation in one click. */
  const handleMasterReset = useCallback(() => {
    setCmeActive(false);
    setCmeImpactActive(false);
    setSyntheticCME(null);
    setCarringtonActive(false);
    setCarringtonDisplayTime(0);
    carringtonClockRef.current = 0;
    carringtonDisplayRef.current = 0;
    setChicxulubActive(false);
    setApophisVisible(false);
    setImpactBurstActive(false);
    setSelectedEpochYear(new Date().getFullYear());
  }, []);
  const telemetry = useGlobalTelemetry();
  const isReversal = selectedEpochYear <= -66_000_000;

  // ─── NOAA / DONKI live data (web worker) ────────────────────────────────────
  const noaaDonki = useNOAADONKI();

  // ─── LSTM off-thread inference (web worker) ─────────────────────────────────
  const lstmWorker = useLSTMWorker();
  const goesFlux = useGOESFlux();

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

  const leftDockTiles = useMemo<Array<{ id: string; label: string; icon: string; tone: DockTone }>>(
    () => [
      { id: 'telemetry', label: 'Telemetry', icon: '◉', tone: 'telemetry' },
      { id: 'mission-core', label: 'Mission', icon: '⌁', tone: 'telemetry' },
      { id: 'sat-threat', label: 'Threat', icon: '⚠', tone: 'sim' },
      { id: 'hangar', label: 'Hangar', icon: '⬢', tone: 'sim' },
      { id: 'oracle', label: 'Oracle', icon: '✦', tone: 'sim' },
      { id: 'fireball', label: 'Fireball', icon: '☄', tone: 'sim' },
    ],
    [],
  );

  const rightDockTiles = useMemo<Array<{ id: string; label: string; icon: string; tone: DockTone }>>(
    () => [
      { id: 'forecast-radar', label: 'Radar', icon: '◎', tone: 'forecast' },
      { id: 'diagnostics', label: 'Diagnostics', icon: '⟡', tone: 'forecast' },
      { id: 'noaa-feed', label: 'NOAA', icon: '⌬', tone: 'telemetry' },
      { id: 'lstm-forecast', label: 'LSTM', icon: '∿', tone: 'forecast' },
      { id: 'magnetic-grid', label: 'Mag Grid', icon: '⋈', tone: 'telemetry' },
      { id: 'data-alchemist', label: 'Alchemy', icon: '⚗', tone: 'forecast' },
    ],
    [],
  );

  const dockToneClasses = useMemo<Record<DockTone, { idle: string; active: string }>>(
    () => ({
      telemetry: {
        idle: 'border-cyan-500/35 bg-black/55 text-cyan-300 hover:bg-cyan-500/12',
        active: 'border-cyan-300 bg-cyan-500/20 text-cyan-100',
      },
      forecast: {
        idle: 'border-violet-500/35 bg-black/55 text-violet-300 hover:bg-violet-500/12',
        active: 'border-violet-300 bg-violet-500/20 text-violet-100',
      },
      sim: {
        idle: 'border-amber-500/35 bg-black/55 text-amber-300 hover:bg-amber-500/12',
        active: 'border-amber-300 bg-amber-500/20 text-amber-100',
      },
    }),
    [],
  );

  const getDockStatus = useCallback((tileId: string): DockStatus => {
    if (tileId === 'noaa-feed' || tileId === 'telemetry' || tileId === 'magnetic-grid') {
      if (noaaDonki.error) return 'red';
      if (!noaaDonki.lastFetch) return 'amber';
      const ageSec = (Date.now() - noaaDonki.lastFetch.getTime()) / 1000;
      return ageSec <= 180 ? 'green' : ageSec <= 600 ? 'amber' : 'red';
    }
    if (tileId === 'lstm-forecast' || tileId === 'data-alchemist') {
      if (lstmWorker.error || lstmWorker.modelStatus === 'error') return 'red';
      if (lstmWorker.inferring || lstmWorker.modelStatus === 'loading') return 'amber';
      return 'green';
    }
    if (tileId === 'iss-track' || tileId === 'iss-stream') {
      return showISS ? 'green' : 'amber';
    }
    if (tileId === 'sat-threat' || tileId === 'threat-simulator' || tileId === 'carrington-sim') {
      return cmeActive || cmeImpactActive ? 'amber' : 'green';
    }
    return 'green';
  }, [cmeActive, cmeImpactActive, lstmWorker.error, lstmWorker.inferring, lstmWorker.modelStatus, noaaDonki.error, noaaDonki.lastFetch, showISS]);

  const dockStatusClass: Record<DockStatus, string> = {
    green: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
  };

  useEffect(() => {
    window.localStorage.setItem('skoll.modalSnap', modalSnap);
  }, [modalSnap]);

  useEffect(() => {
    window.localStorage.setItem('skoll.perfChipPosition', JSON.stringify(perfChipPosition));
  }, [perfChipPosition]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'Escape') {
        setDockModalTileId(null);
        setDockModalPinned(false);
        setOpenMenuId(null);
        setHoveredDock(null);
        return;
      }

      const number = Number(event.key);
      if (Number.isNaN(number) || number < 1 || number > 6) {
        return;
      }

      if (event.shiftKey) {
        const rightTile = rightDockTiles[number - 1];
        if (!rightTile) return;
        setSelectedTileId(rightTile.id);
        setDockModalPinned(false);
        setDockModalTileId((prev) => (prev === rightTile.id ? null : rightTile.id));
        return;
      }

      const leftTile = leftDockTiles[number - 1];
      if (!leftTile) return;
      setSelectedTileId(leftTile.id);
      setDockModalPinned(false);
      setDockModalTileId((prev) => (prev === leftTile.id ? null : leftTile.id));
    };

    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [leftDockTiles, rightDockTiles]);

  useEffect(() => {
    let frameCount = 0;
    let last = performance.now();
    let rafId = 0;
    const tick = () => {
      frameCount += 1;
      const now = performance.now();
      const delta = now - last;
      if (delta >= 1000) {
        setFps(Math.round((frameCount * 1000) / delta));
        frameCount = 0;
        last = now;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (lstmWorker.inferring && inferDispatchRef.current === null) {
      inferDispatchRef.current = performance.now();
    }
    if (!lstmWorker.inferring && lstmWorker.lastUpdated && inferDispatchRef.current !== null) {
      setLstmLatencyMs(Math.max(0, Math.round(performance.now() - inferDispatchRef.current)));
      inferDispatchRef.current = null;
    }
  }, [lstmWorker.inferring, lstmWorker.lastUpdated]);

  const hazardModel = useMemo(
    () => createHazardTelemetryModel(noaaDonki, lstmWorker, goesFlux, lstmLatencyMs),
    [goesFlux, lstmLatencyMs, lstmWorker, noaaDonki],
  );

  const modalSnapClass = useMemo(() => {
    if (modalSnap === 'center') return 'left-1/2 -translate-x-1/2';
    if (modalSnap === 'left') return 'left-[calc(var(--dock-width)+1rem)]';
    return 'right-[calc(var(--dock-width)+1rem)]';
  }, [modalSnap]);

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
            <LazyOracleModule snapshot={hazardModel} />
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
          <div style={{ background:'rgba(6,10,22,0.78)', backdropFilter:'blur(22px) saturate(1.6)', WebkitBackdropFilter:'blur(22px) saturate(1.6)', border:'1px solid rgba(239,68,68,0.18)', borderRadius:'10px', padding:'10px 12px', boxShadow:'0 0 28px rgba(239,68,68,0.05),0 4px 20px rgba(0,0,0,0.55)' }}>
            <Suspense fallback={null}>
              <LazyKesslerNetStats
                kpIndex={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 0}
                cmeActive={cmeActive}
                cascade={lstmWorker.forecast?.kesslerCascade ?? null}
              />
            </Suspense>
          </div>
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
            fluxWm2={goesFlux.fluxWm2}
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
          <Suspense fallback={null}>
            <LazyDeepTimeSlicer
              currentYearCE={selectedEpochYear}
              onEpochSelect={handleDeepTimeEpochSelect}
            />
          </Suspense>
        );
      case 'iss-track':
        return (
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#a0d4ff' }}>
            <div style={{ marginBlockEnd: '8px', textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '9px', opacity: 0.6 }}>ISS Live Track</div>
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
              <div style={{ marginBlockStart: '8px', fontSize: '9px', opacity: 0.65 }}>
                Polling wheretheiss.at every 3 s · Trail: 180 pts
              </div>
            )}
          </div>
        );
      case 'carrington-sim':
        return (
          <div style={{ fontFamily: 'monospace', fontSize: '10px' }}>
            <div style={{ marginBlockEnd: '8px' }}>
              <button
                onClick={() => {
                  setCarringtonActive((v) => !v);
                  setCarringtonDisplayTime(0);
                  carringtonClockRef.current = 0;
                  carringtonDisplayRef.current = 0;
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
                  marginBlockEnd: '8px',
                }}
              >
                {carringtonActive ? '⬛ Stop Simulation' : '▶ Start Carrington Replay'}
              </button>
            </div>
            <Suspense fallback={null}>
              <LazyCarringtonPanel simulationTimeS={carringtonDisplayTime} />
            </Suspense>
          </div>
        );
      case 'apophis-tracker':
        return (
          <div style={{ fontFamily: 'monospace', fontSize: '10px' }}>
            <div style={{ marginBlockEnd: '8px' }}>
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
                  marginBlockEnd: '8px',
                }}
              >
                {apophisVisible ? '⬛ Hide Apophis Orbit' : '▶ Show Apophis 2029 Flyby'}
              </button>
            </div>
            <Suspense fallback={null}>
              <LazyApophisPanel />
            </Suspense>
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
            <div style={{ marginBlockEnd: '8px', fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Heliopause Boundary Shader</div>
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
              <div style={{ marginBlockStart: '6px', fontSize: '8px', opacity: 0.5 }}>
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
            <div style={{ marginBlockEnd: '8px', fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>D-RAP Ionospheric Absorption</div>
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
              <div style={{ marginBlockStart: '8px', fontSize: '8px', opacity: 0.5 }}>
                <div>Class: <span style={{ color: '#ff8c42' }}>{goesFlux.flareClass}</span></div>
                <div>Flux: {goesFlux.fluxWm2.toExponential(2)} W/m²</div>
                <div style={{ marginBlockStart: 4, opacity: 0.6 }}>Orange overlay = HF radio blackout zone (sunlit hemisphere). Equatorial paths most affected.</div>
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
    const anchorDate = currentDate === 'LIVE' ? new Date() : currentDate;
    const newDate = new Date(anchorDate);
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

  const effectiveDate = useMemo(() => (currentDate === 'LIVE' ? new Date() : currentDate), [currentDate]);

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
      carringtonDisplayRef.current = 0;
      setCarringtonDisplayTime(0);
      return;
    }
    const startMs = Date.now() - carringtonClockRef.current * 1000;
    const id = setInterval(() => {
      const elapsed = (Date.now() - startMs) / 1000;
      carringtonClockRef.current = elapsed;
      const nextDisplay = Math.floor(elapsed);
      if (nextDisplay !== carringtonDisplayRef.current) {
        carringtonDisplayRef.current = nextDisplay;
        setCarringtonDisplayTime(nextDisplay);
      }
    }, 250);
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

  const noaaFetchAgeSec = hazardModel.noaaFetchAgeSec;

  const handlePerfChipPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const host = event.currentTarget;
    perfChipDragRef.current.dragging = true;
    perfChipDragRef.current.offsetX = event.clientX - perfChipPosition.x;
    perfChipDragRef.current.offsetY = event.clientY - perfChipPosition.y;
    host.setPointerCapture(event.pointerId);
  };

  const handlePerfChipPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!perfChipDragRef.current.dragging) {
      return;
    }

    const chipWidth = 230;
    const chipHeight = 34;
    const nextX = event.clientX - perfChipDragRef.current.offsetX;
    const nextY = event.clientY - perfChipDragRef.current.offsetY;

    setPerfChipPosition({
      x: Math.max(8, Math.min(window.innerWidth - chipWidth, nextX)),
      y: Math.max(8, Math.min(window.innerHeight - chipHeight, nextY)),
    });
  };

  const handlePerfChipPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const host = event.currentTarget;
    perfChipDragRef.current.dragging = false;
    if (host.hasPointerCapture(event.pointerId)) {
      host.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-mono text-cyan-400">
      <div className="fixed inset-0 z-0 pointer-events-auto">
        <SlateErrorBoundary moduleName="Observa-Scene" fallback={<div className="absolute inset-0 bg-black/40" />}>
          <Canvas
            shadows
            dpr={[1, 1.5]}
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
                <Suspense fallback={null}>
                  {/* Sagittarius A* — supermassive black hole at galactic centre */}
                  <LazySagittariusA />
                  {/* Kuiper Belt — visible in heliocentric view */}
                  <LazyKuiperBelt visible={viewMode === 'HELIOCENTRIC'} />
                  {/* Oort Cloud — log-depth GLSL shell at artistic 4–7k units */}
                  <LazyOortCloud visible={viewMode === 'HELIOCENTRIC'} />
                </Suspense>
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
                  <LazyApophisTracker visible={apophisVisible} epochYear={selectedEpochYear} />
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
                        <LazyChicxulubEvent
                          earthPos={posArr}
                          active={chicxulubActive}
                          onComplete={handleChicxulubComplete}
                        />
                        {/* Carrington 1859 magnetic storm */}
                        <LazyCarringtonSim earthPos={posArr} active={carringtonActive} />
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

            <OrbitControls enablePan enableZoom makeDefault minDistance={0.1} maxDistance={100000} />
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
              <>
                <div className="absolute inset-y-24 left-3 z-40 flex flex-col gap-2 pointer-events-auto">
                  {leftDockTiles.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={(event) => {
                        const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setHoveredDock({
                          label: item.label,
                          status: getDockStatus(item.id),
                          x: rect.right + 10,
                          y: rect.top + rect.height / 2,
                          side: 'left',
                        });
                      }}
                      onMouseLeave={() => setHoveredDock(null)}
                      onClick={() => {
                        setSelectedTileId(item.id);
                        setDockModalPinned(false);
                        setDockModalTileId((prev) => (prev === item.id ? null : item.id));
                      }}
                      className={`skoll-dock-button relative h-9 w-9 rounded-lg border text-[12px] font-bold transition-colors ${dockModalTileId === item.id ? `${dockToneClasses[item.tone].active} shadow-[0_0_10px_rgba(34,211,238,0.35)]` : dockToneClasses[item.tone].idle}`}
                    >
                      <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${dockStatusClass[getDockStatus(item.id)]}`} />
                      {item.icon}
                    </button>
                  ))}
                </div>

                <div className="absolute inset-y-24 right-3 z-40 flex flex-col gap-2 pointer-events-auto">
                  {rightDockTiles.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={(event) => {
                        const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setHoveredDock({
                          label: item.label,
                          status: getDockStatus(item.id),
                          x: rect.left - 10,
                          y: rect.top + rect.height / 2,
                          side: 'right',
                        });
                      }}
                      onMouseLeave={() => setHoveredDock(null)}
                      onClick={() => {
                        setSelectedTileId(item.id);
                        setDockModalPinned(false);
                        setDockModalTileId((prev) => (prev === item.id ? null : item.id));
                      }}
                      className={`skoll-dock-button relative h-9 w-9 rounded-lg border text-[12px] font-bold transition-colors ${dockModalTileId === item.id ? `${dockToneClasses[item.tone].active} shadow-[0_0_10px_rgba(34,211,238,0.35)]` : dockToneClasses[item.tone].idle}`}
                    >
                      <span className={`absolute left-1 top-1 h-1.5 w-1.5 rounded-full ${dockStatusClass[getDockStatus(item.id)]}`} />
                      {item.icon}
                    </button>
                  ))}
                </div>

                {hoveredDock && (
                  <div
                    className="fixed z-50 pointer-events-none rounded border border-cyan-500/30 bg-black/80 px-2 py-1 text-[8px] uppercase tracking-[0.12em] text-cyan-200"
                    style={{
                      left: hoveredDock.side === 'left' ? hoveredDock.x : undefined,
                      right: hoveredDock.side === 'right' ? `calc(100vw - ${hoveredDock.x}px)` : undefined,
                      top: hoveredDock.y,
                      transform: hoveredDock.side === 'left' ? 'translateY(-50%)' : 'translate(-100%, -50%)',
                    }}
                  >
                    <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${dockStatusClass[hoveredDock.status]}`} />
                    {hoveredDock.label}
                  </div>
                )}

                {dockModalTileId && (
                  <div className="fixed inset-0 z-50 pointer-events-auto" onMouseDown={() => {
                    if (!dockModalPinned) {
                      setDockModalTileId(null);
                    }
                  }}>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      onMouseDown={(event) => event.stopPropagation()}
                      className={`nasa-slate fixed top-20 z-50 w-[min(92vw,42rem)] max-w-2xl p-3 ${modalSnapClass}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 border-b border-cyan-500/20 pb-2">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-200">
                          {tileCatalog.find((tile) => tile.id === dockModalTileId)?.label ?? dockModalTileId}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setModalSnap('left')}
                            className={`h-6 px-1.5 rounded border text-[8px] uppercase tracking-[0.14em] ${modalSnap === 'left' ? 'border-cyan-300 text-cyan-100 bg-cyan-500/10' : 'border-cyan-500/30 text-cyan-300'}`}
                          >
                            L
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalSnap('center')}
                            className={`h-6 px-1.5 rounded border text-[8px] uppercase tracking-[0.14em] ${modalSnap === 'center' ? 'border-cyan-300 text-cyan-100 bg-cyan-500/10' : 'border-cyan-500/30 text-cyan-300'}`}
                          >
                            C
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalSnap('right')}
                            className={`h-6 px-1.5 rounded border text-[8px] uppercase tracking-[0.14em] ${modalSnap === 'right' ? 'border-cyan-300 text-cyan-100 bg-cyan-500/10' : 'border-cyan-500/30 text-cyan-300'}`}
                          >
                            R
                          </button>
                          <button
                            type="button"
                            onClick={() => setDockModalPinned((prev) => !prev)}
                            className={`h-6 px-2 rounded border text-[8px] uppercase tracking-[0.14em] ${dockModalPinned ? 'border-amber-300 text-amber-100 bg-amber-500/10' : 'border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10'}`}
                          >
                            {dockModalPinned ? 'Pinned' : 'Pin'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDockModalPinned(false);
                              setDockModalTileId(null);
                            }}
                            className="h-6 px-2 rounded border border-cyan-500/30 text-[8px] uppercase tracking-[0.14em] text-cyan-200 hover:bg-cyan-500/10"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <div className="max-h-[68vh] overflow-y-auto wolf-scroll pr-1">
                        {renderSubmenuContent(dockModalTileId)}
                      </div>
                    </motion.div>
                  </div>
                )}
              </>
            )}

            {/* Live ISS HUD overlay */}
            {showISS && <LiveISSHUD data={null} visible={showISS} />}
            <LandingSlate planetName={viewMode === 'HELIOCENTRIC' ? currentPlanet : null} onInitiateLanding={() => setViewMode('SURFACE')} />
            <MagneticReversalAlert active={selectedEpochYear <= -66000000} />

            {viewMode === 'SURFACE' && (
              <button type="button" onClick={() => setViewMode('HELIOCENTRIC')} className="absolute right-6 top-12 pointer-events-auto h-7 px-3 text-[9px] uppercase tracking-[0.2em] border border-cyan-400/40 bg-black/60 backdrop-blur-md text-cyan-100">Exit Landing</button>
            )}

            <div className={[
              'nasa-slate skoll-command-bar absolute left-1/2 -translate-x-1/2 bottom-3 z-[98] w-[min(98vw,1100px)] pointer-events-auto px-2.5 sm:px-3 py-2 rounded-xl',
              isReversal ? 'skoll-reversal-banner border-red-500/50' : 'border-cyan-500/30',
            ].join(' ')}>
              <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_auto] items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg border border-cyan-400/45 flex items-center justify-center text-cyan-200 bg-cyan-500/5">
                    <Orbit size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[7px] sm:text-[8px] uppercase tracking-[0.18em] text-cyan-500/70">Control</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.1em] text-cyan-100 font-semibold truncate">{selectedTileLabel}</div>
                      <MissionUTCTime />
                    </div>
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

                <div className="flex items-center gap-1.5 sm:gap-2 justify-start lg:justify-end flex-nowrap overflow-x-auto wolf-scroll min-w-0">
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
                  <LiveSyncBadgeCompact lastFetch={noaaDonki.lastFetch} isLiveMode={currentDate === 'LIVE'} />
                </div>
              </div>

              <AnimatePresence initial={false}>
                {openMenuId && (
                  <motion.div
                    key={openMenuId}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="nasa-slate fixed top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-auto w-[min(92vw,720px)] min-w-[320px] sm:min-w-[420px] p-2"
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


              <div
                className="fixed z-[99] pointer-events-auto select-none"
                style={{ transform: `translate(${perfChipPosition.x}px, ${perfChipPosition.y}px)` }}
                onPointerDown={handlePerfChipPointerDown}
                onPointerMove={handlePerfChipPointerMove}
                onPointerUp={handlePerfChipPointerUp}
              >
                <div className="rounded-md border border-cyan-500/35 bg-black/50 px-2 py-1 backdrop-blur-md text-[8px] uppercase tracking-[0.08em] text-cyan-200 font-mono cursor-grab active:cursor-grabbing">
                  <span className="telemetry-value">FPS {fps}</span>
                  <span className="mx-1 text-cyan-500/40">|</span>
                  <span className="telemetry-value">LSTM {lstmLatencyMs != null ? `${lstmLatencyMs}ms` : '—'}</span>
                  <span className="mx-1 text-cyan-500/40">|</span>
                  <span className="telemetry-value">NOAA {noaaFetchAgeSec != null ? `${noaaFetchAgeSec}s` : '—'}</span>
                </div>
              </div>


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