import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor, PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { Orbit, Volume2, VolumeX, Bell, Share2, Zap, Gamepad2, Radio, Leaf, Lock, Unlock, Activity, Shield, Rocket, Flame, Satellite, Rss, TrendingUp, FlaskConical, BarChart2, Globe, Layers } from 'lucide-react';
import * as THREE from 'three';
import { useCameraFocus } from './hooks/useCameraFocus';
import { CosmicTooltip } from './components/CosmicTooltip';
import type { TooltipContent } from './context/TooltipContext';
import { RetroBoot } from './components/RetroBoot';
import { NeuralBoot } from './components/NeuralBoot';
import { AudioAtmosphere } from './services/audioAtmosphere';
import { TelemetryRibbon } from './components/TelemetryRibbon';
import { MagneticReversalAlert } from './components/MagneticReversalAlert';
import { SlateErrorBoundary } from './components/SlateErrorBoundary';
import type { ActiveObject } from './components/HangarModule';
import { SatelliteOrbitalTracker } from './components/SatelliteOrbitalTracker';
import { useGlobalTelemetry } from './hooks/useGlobalTelemetry';
import { SYSTEM_CONSTANTS } from './ml/ExoPhysics';
import { MOON_BODIES, PLANET_BODIES, type EphemerisVectorAU, type ForecastBodyName } from './ml/OrbitalMechanics';
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
import LocationSwitcher, { type LocationPreset } from './components/LocationSwitcher';
import EarthBowShock from './components/EarthBowShock';
import LiveISS, { LiveISSHUD } from './components/LiveISS';
import SuperMAGPanel from './components/SuperMAGPanel';
import ProgressionGraph from './components/ProgressionGraph';
import SolarThreatSimulator from './components/SolarThreatSimulator';
import type { SyntheticCME } from './components/SolarThreatSimulator';
import EarthCloudLayer from './components/EarthCloudLayer';
import EarthWeatherNow, { type EarthWeatherCurrent } from './components/EarthWeatherNow';
import EarthWeatherLayers from './components/EarthWeatherLayers';
import EarthWindStreamlines from './components/EarthWindStreamlines';
import WeatherLayerControls from './components/WeatherLayerControls';
import EarthCutawayExplorer from './components/EarthCutawayExplorer';
import EarthStoryTimelinePanel from './components/EarthStoryTimelinePanel';
import AtmosphereColumnPanel from './components/AtmosphereColumnPanel';
import CarbonClimateLink from './components/CarbonClimateLink';
import EmissionsImpact from './components/EmissionsImpact';
import GICRiskMap from './components/GICRiskMap';
import GPSAccuracyMap from './components/GPSAccuracyMap';
import RadioBlackoutMap from './components/RadioBlackoutMap';
import OceanClimatePanel from './components/OceanClimatePanel';
import AlertLogPanel from './components/AlertLogPanel';
import GlossaryPanel from './components/GlossaryPanel';
import { SceneLegend } from './components/SceneLegend';
import GraphMissionHub from './components/GraphMissionHub';
import type { DeepTimeEpoch } from './components/DeepTimeSlicer';
import TerminalLogHUD from './components/TerminalLogHUD';
import EarthCoreDynamo, { EarthDynamoPanel } from './components/EarthCoreDynamo';
import ISSCameraPanel from './components/ISSCameraStream';
import ForecastingSlicerPanel from './components/ForecastingSlicerPanel';
import KesslerTelemetryChip from './components/KesslerTelemetryChip';
import LocalInterstellarCloud from './components/LocalInterstellarCloud';
import AuroraOvationHUD from './components/AuroraOvationHUD';
import HeliopauseShell from './components/HeliopauseShell';
import PlanetCore from './components/PlanetCore';
import GOESFluxChart from './components/GOESFluxChart';
import GridFailureSim from './components/GridFailureSim';
import RadioBlackoutHeatmap from './components/RadioBlackoutHeatmap';
import TrajectoryForecastPanel from './components/TrajectoryForecastPanel';
import { useLSTMWorker } from './hooks/useLSTMWorker';
import { useGOESFlux } from './hooks/useGOESFlux';
import { useNOAADONKI } from './hooks/useNOAADONKI';
import { useSpaceWeatherProviders } from './hooks/useSpaceWeatherProviders';
import { createHazardTelemetryModel } from './services/hazardModel';
import { useSolarSonification } from './hooks/useSolarSonification';
import { useKesslerWorker } from './hooks/useKesslerWorker';
import { DEFAULT_RULES, evaluateAlerts, type TriggeredAlert } from './services/alertEngine';
import { buildSnapshotUrl, captureCanvasScreenshot, decodeSnapshot, type SnapshotState } from './services/snapshotService';
import { useDockSystem } from './hooks/useDockSystem';
import { postAlertsToRelay } from './services/socialRelay';
import eventsData from './ml/space_weather_events.json';

type ViewMode = 'HELIOCENTRIC';
type TimeMode = Date | 'LIVE';
type BodyName = keyof typeof SYSTEM_CONSTANTS;
type FXQuality = 'LOW' | 'HIGH';
type DockTone = 'telemetry' | 'forecast' | 'sim';
type DockStatus = 'green' | 'amber' | 'red';
type TimelineContextMenu = { x: number; y: number } | null;
type EarthLodStage = 'SPACE' | 'ORBIT' | 'REGIONAL' | 'LOCAL';
const DEBUG_LOGS = import.meta.env.VITE_DEBUG_LOGS === 'true';

// ─── Dock tile CosmicTooltip content ─────────────────────────────────────────
const DOCK_TILE_TOOLTIPS: Record<string, TooltipContent> = {
  'telemetry':       { title: 'Telemetry Ribbon',    emoji: '◉', accentColor: '#06b6d4', tagline: 'Live Data Stream',       description: 'Real-time NOAA/DONKI geomagnetic indices, solar wind, and Kp index.' },
  'mission-core':    { title: 'Mission Core',         emoji: '⌁', accentColor: '#06b6d4', tagline: 'Operations Centre',      description: 'Central ops overview: threat level, KPIs, and active alert stack.' },
  'sat-threat':      { title: 'Orbital Threat',       emoji: '⚠', accentColor: '#f59e0b', tagline: 'Satellite Risk',         description: 'Satellite collision and atmospheric drag risk driven by live space weather.' },
  'hangar':          { title: 'Satellite Hangar',     emoji: '⬢', accentColor: '#f59e0b', tagline: 'Active Fleet',           description: 'Active satellite roster with orbital mechanics and debris proximity.' },
  'fireball':        { title: 'Fireball Tracker',     emoji: '☄', accentColor: '#f59e0b', tagline: 'Near-Earth Events',      description: 'NASA CNEOS fireball, bolide, and near-Earth object impact log.' },
  'forecast-radar':  { title: 'Forecast Radar',       emoji: '◎', accentColor: '#8b5cf6', tagline: 'WSA-Enlil Propagation', description: 'Solar wind and CME propagation forecast from WSA-Enlil model.' },
  'diagnostics':     { title: 'Planet Diagnostics',   emoji: '⟡', accentColor: '#8b5cf6', tagline: 'Deep Science Stats',    description: 'Planetary science: magnetosphere, atmosphere, and core dynamics.' },
  'noaa-feed':       { title: 'NOAA Feed',            emoji: '⌬', accentColor: '#06b6d4', tagline: 'Raw Event Stream',      description: 'Raw NOAA DONKI feed: CMEs, solar flares, and radiation belt events.' },
  'lstm-forecast':   { title: 'LSTM Forecast',        emoji: '∿', accentColor: '#8b5cf6', tagline: 'Neural Kp Prediction',  description: 'Off-thread TensorFlow.js LSTM model predicting geomagnetic Kp index.' },
  'magnetic-grid':   { title: 'Magnetic Grid',        emoji: '⋈', accentColor: '#06b6d4', tagline: 'WMM-2025 Field Lines',  description: 'Global magnetic field line visualisation from World Magnetic Model 2025.' },
  'data-alchemist':  { title: 'Data Alchemist',       emoji: '⚗', accentColor: '#8b5cf6', tagline: 'Fusion Dashboard',      description: 'Multi-source data fusion with derived Wolf Formula hazard metrics.' },
  'graph-hub':       { title: 'Graph Mission Hub',    emoji: '▦', accentColor: '#8b5cf6', tagline: 'All Charts',            description: 'All real-time data charts scrollable in a single command view.' },
  'dsn-live':        { title: 'DSN Live',             emoji: '📡', accentColor: '#06b6d4', tagline: 'Deep Space Network',     description: 'NASA Deep Space Network live dish activity, current uplinks and downlinks.' },
};
const TIME_EXPLORER_BASE_HEIGHT = 16;
const BACKEND_HTTP_BASE = (import.meta.env.VITE_BACKEND_HTTP_BASE ?? import.meta.env.VITE_EPHEMERIS_API_BASE ?? 'http://localhost:8080').replace(/\/$/, '');
const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL ?? BACKEND_HTTP_BASE.replace(/^http/i, 'ws');

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

const formatTimelineDate = (value: Date) => value.toLocaleDateString('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
}).toUpperCase();

const formatTimelineTime = (value: Date) => value.toISOString().slice(11, 19);

const EarthZoomLadderController = ({
  active,
  planetRefs,
  onLodChange,
}: {
  active: boolean;
  planetRefs: Map<string, THREE.Group>;
  onLodChange: (lod: EarthLodStage, distance: number) => void;
}) => {
  const { camera } = useThree();
  const lastLodRef = useRef<EarthLodStage>('SPACE');
  const smoothedDistanceRef = useRef(150);
  const nearRef = useRef(camera.near);
  const farRef = useRef(camera.far);
  const clipTickRef = useRef(0);

  const pickLod = (distance: number, current: EarthLodStage): EarthLodStage => {
    // Hysteresis windows prevent rapid boundary flapping at Earth zoom thresholds.
    if (current === 'SPACE') {
      if (distance < 120) return 'ORBIT';
      return 'SPACE';
    }
    if (current === 'ORBIT') {
      if (distance > 136) return 'SPACE';
      if (distance < 35) return 'REGIONAL';
      return 'ORBIT';
    }
    if (current === 'REGIONAL') {
      if (distance > 47) return 'ORBIT';
      if (distance < 7.5) return 'LOCAL';
      return 'REGIONAL';
    }
    // LOCAL
    if (distance > 10.5) return 'REGIONAL';
    return 'LOCAL';
  };

  useFrame((_, delta) => {
    if (!active) return;
    const earthRef = planetRefs.get('Earth');
    if (!earthRef) return;

    const earthPos = new THREE.Vector3().setFromMatrixPosition(earthRef.matrixWorld);
    const rawDistance = camera.position.distanceTo(earthPos);

    const easing = Math.min(1, Math.max(0.05, delta * 8));
    smoothedDistanceRef.current = THREE.MathUtils.lerp(smoothedDistanceRef.current, rawDistance, easing);
    const distance = smoothedDistanceRef.current;

    const lod = pickLod(distance, lastLodRef.current);

    if (lod !== lastLodRef.current) {
      lastLodRef.current = lod;
      onLodChange(lod, distance);
    } else {
      onLodChange(lod, distance);
    }

    // Dynamic near/far clip planes to reduce precision flicker when zooming Earth.
    // Use a safer near-plane floor and throttle projection updates to avoid micro-jitter.
    const targetNear = THREE.MathUtils.clamp(distance * 0.0032, 0.01, 1.2);
    const targetFar = THREE.MathUtils.clamp(distance * 64, 900, 1_400_000);
    nearRef.current = THREE.MathUtils.lerp(nearRef.current, targetNear, Math.min(1, delta * 4));
    farRef.current = THREE.MathUtils.lerp(farRef.current, targetFar, Math.min(1, delta * 4));

    clipTickRef.current += 1;
    if (clipTickRef.current % 3 === 0 && (Math.abs(camera.near - nearRef.current) > 0.003 || Math.abs(camera.far - farRef.current) > 300)) {
      camera.near = nearRef.current;
      camera.far = farRef.current;
      camera.updateProjectionMatrix();
    }
  });

  return null;
};

const SurfaceCameraController = ({
  enabled,
  onAltitudeChange,
  sampleTerrainHeight,
}: {
  enabled: boolean;
  onAltitudeChange: (altitudeKm: number) => void;
  sampleTerrainHeight: (x: number, z: number) => number;
}) => {
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!enabled) return;

    const terrainBaseY = sampleTerrainHeight(camera.position.x, camera.position.z);
    const floorY = terrainBaseY + 1.7;
    if (camera.position.y < floorY) {
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, floorY, Math.min(1, delta * 10));
    }

    const meters = Math.max(0, (camera.position.y - terrainBaseY) * 900);
    onAltitudeChange(meters / 1000);
  }, -1);

  return null;
};

export default function App() {
  const [booted, setBooted] = useState(false);
  const [fxReady, setFxReady] = useState(false);
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('HELIOCENTRIC');
  const [currentPlanet, setCurrentPlanet] = useState<BodyName | null>(null);
  const [currentDate, setCurrentDate] = useState<TimeMode>('LIVE');
  const [tacticalAlerts, setTacticalAlerts] = useState<string[]>([]);
  const [, setShowDiagnostics] = useState(false);
  const [satelliteFocusTarget, setSatelliteFocusTarget] = useState<THREE.Vector3 | null>(null);
  const [satelliteFocusTrigger, setSatelliteFocusTrigger] = useState(0);
  const [trackedObject, setTrackedObject] = useState<ActiveObject | null>(null);
  const [cmeActive, setCmeActive] = useState(false);
  const [cmeImpactActive, setCmeImpactActive] = useState(false);
  const [fxQuality, setFxQuality] = useState<FXQuality>('HIGH');
  const [impactBurstActive, setImpactBurstActive] = useState(false);
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
  const [nowUtc, setNowUtc] = useState(() => new Date());
  const [controlBarHeight, setControlBarHeight] = useState(92);
  const [timeExplorerHeight, setTimeExplorerHeight] = useState(TIME_EXPLORER_BASE_HEIGHT);
  const [isTimePlaying, setIsTimePlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [useDeepTimeEpoch, setUseDeepTimeEpoch] = useState(false);
  const [timelineContextMenu, setTimelineContextMenu] = useState<TimelineContextMenu>(null);
  const [highPrecisionModeEnabled, setHighPrecisionModeEnabled] = useState(true);
  const [highPrecisionVectors, setHighPrecisionVectors] = useState<Record<string, EphemerisVectorAU>>({});
  const [fps, setFps] = useState(60);
  const [lstmLatencyMs, setLstmLatencyMs] = useState<number | null>(null);
  const inferDispatchRef = useRef<number | null>(null);
  const [location, setLocation] = useState<LocationPreset>({ name: 'Cambridge, UK', lat: 52.2, lon: 0.12 });
  const [, setSurfaceAltitudeKm] = useState(0);
  const [surfaceWindKmh, setSurfaceWindKmh] = useState(20);
  const [weatherOpacity, setWeatherOpacity] = useState({ cloud: 0.55, precip: 0.45, snow: 0.55, wind: 0.36, stream: 0.52 });
  const [weatherVisibility, setWeatherVisibility] = useState({ cloud: true, precip: true, snow: true, wind: true, stream: true });
  const terrainSamplerRef = useRef<(x: number, z: number) => number>(() => -5);
  const [earthLodStage, setEarthLodStage] = useState<EarthLodStage>('SPACE');
  const [earthZoomDistance, setEarthZoomDistance] = useState(999);
  const [cutawayEnabled, setCutawayEnabled] = useState(false);
  const [cutawaySliceEnabled, setCutawaySliceEnabled] = useState(true);
  const [cutawaySliceDepth, setCutawaySliceDepth] = useState(0);
  const [cutawayShells, setCutawayShells] = useState({ crust: true, mantle: true, outerCore: true, innerCore: true });
  const [co2Ppm, setCo2Ppm] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<TriggeredAlert[]>([]);
  const [, setToasts] = useState<TriggeredAlert[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [liteMode, setLiteMode] = useState(false);
  const [ecoMode, setEcoMode] = useState(false);
  const [adaptiveDpr, setAdaptiveDpr] = useState(1.2);
  const [retroMode, setRetroMode] = useState(false);
  const [relayEnabled, setRelayEnabled] = useState(false);
  const [hudMinimized] = useState(false);
  const [trackedPlanetName, setTrackedPlanetName] = useState<string | null>(null);
  const [planetRefs, setPlanetRefs] = useState<Map<string, THREE.Group>>(new Map());
  const burstTimeoutRef = useRef<number | null>(null);
  const adaptiveDprLastAdjustAtRef = useRef(0);
  const envWarnedRef = useRef(false);
  const audioAtmosphereRef = useRef<AudioAtmosphere>(new AudioAtmosphere());
  const controlBarRef = useRef<HTMLDivElement | null>(null);
  const timeExplorerRef = useRef<HTMLDivElement | null>(null);
  const holdScrubRef = useRef<number | null>(null);
  const precisionFetchTicketRef = useRef(0);


  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      return;
    }
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    try {
      const lite = localStorage.getItem('skoll-lite-mode');
      const eco = localStorage.getItem('skoll-eco-mode');
      const relay = localStorage.getItem('skoll-relay-enabled');
      if (lite === '1') {
        setLiteMode(true);
        setFxQuality('LOW');
      }
      if (eco === '1') {
        setEcoMode(true);
        setFxQuality('LOW');
      }
      if (relay === '1') {
        setRelayEnabled(true);
      }
    } catch {
      // ignore persistence errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('skoll-lite-mode', liteMode ? '1' : '0');
    } catch {
      // ignore persistence errors
    }
  }, [liteMode]);

  useEffect(() => {
    try {
      localStorage.setItem('skoll-eco-mode', ecoMode ? '1' : '0');
    } catch {
      // ignore persistence errors
    }
  }, [ecoMode]);

  useEffect(() => {
    try {
      localStorage.setItem('skoll-relay-enabled', relayEnabled ? '1' : '0');
    } catch {
      // ignore persistence errors
    }
  }, [relayEnabled]);

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
    setUseDeepTimeEpoch(false);
    setPlaybackRate(1);
  }, []);
  const telemetry = useGlobalTelemetry();
  const isReversal = selectedEpochYear <= -66_000_000;

  // ─── NOAA / DONKI live data (web worker) ────────────────────────────────────
  const noaaDonki = useNOAADONKI();

  // ─── LSTM off-thread inference (web worker) ─────────────────────────────────
  const lstmWorker = useLSTMWorker();
  const goesFlux = useGOESFlux();
  const kesslerWorker = useKesslerWorker({
    bundle: noaaDonki.bundle ?? null,
    atmosphericDragIndex: Math.max(0, Math.min(1, (telemetry.windSpeed ?? 450) / 1000)),
  });
  const solarSonification = useSolarSonification({
    kpIndex: telemetry.kpIndex ?? 0,
    solarWindSpeed: telemetry.windSpeed ?? 400,
    bzGsm: noaaDonki.bundle?.bzGsm ?? 0,
    flareClass: goesFlux.flareClass,
    kesslerRisk: kesslerWorker.forecast?.next24hProbability ?? lstmWorker.forecast?.kesslerCascade?.next24hProbability ?? 0,
  });
  const spaceWeatherProviders = useSpaceWeatherProviders(noaaDonki);

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

  // Defer PostFX mount until after the renderer has had a few frames to settle.
  // Without this, LazyCinematicPostFX attaches before the GL pipeline is ready,
  // causing a flicker that toggling lite-mode temporarily resolves.
  useEffect(() => {
    if (!booted) return;
    const t = setTimeout(() => setFxReady(true), 600);
    return () => clearTimeout(t);
  }, [booted]);

  const tileCatalog = useMemo(
    () => [
      { id: 'telemetry', label: 'Telemetry Ribbon' },
      { id: 'mission-core', label: 'Mission Core' },
      { id: 'sat-threat', label: 'Orbital Threat' },
      { id: 'human-impact', label: 'Human Impact' },
      { id: 'hangar', label: 'Hangar Uplink' },
      { id: 'fireball', label: 'Fireball Tracker' },
      { id: 'forecast-radar', label: 'Forecast Radar' },
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
      { id: 'trajectory-forecast', label: 'Trajectory Forecast' },
      { id: 'atmos-column', label: 'Atmospheric Column' },
      { id: 'carbon-link', label: 'Carbon Climate Link' },
      { id: 'emissions-impact', label: 'Emissions Impact' },
      { id: 'gic-risk', label: 'GIC Risk Map' },
      { id: 'gps-accuracy', label: 'GPS Accuracy Map' },
      { id: 'radio-blackout-map', label: 'HF Blackout Map' },
      { id: 'ocean-climate', label: 'Ocean Climate' },
      { id: 'alert-log', label: 'Alert Log' },
      { id: 'glossary', label: 'Glossary' },
      { id: 'graph-hub', label: 'Graph Mission Hub' },
    ],
    [],
  );

  const allToolIds = useMemo(() => tileCatalog.map((tile) => tile.id), [tileCatalog]);

  const menuGroups = useMemo<Record<string, string[]>>(
    () => ({
      'live-telemetry': [
        'telemetry', 'noaa-feed', 'supermag', 'dsn-live', 'iss-track',
        'magnetic-grid', 'mission-core', 'iss-stream', 'terminal-log',
        'aurora-ovation', 'goes-flux', 'atmos-column', 'alert-log', 'glossary',
      ],
      'ml-forecasts': [
        'lstm-forecast', 'forecast-radar', 'data-alchemist', 'kessler-net',
        'progression', 'forecast-slicer', 'trajectory-forecast', 'carbon-link', 'emissions-impact', 'ocean-climate', 'graph-hub',
      ],
      'simulations': [
        'threat-simulator', 'deep-time', 'carrington-sim', 'apophis-tracker',
        'sat-threat', 'human-impact', 'hangar', 'fireball', 'earth-dynamo',
        'planet-core', 'heliopause', 'grid-failure', 'radio-blackout', 'gic-risk', 'gps-accuracy', 'radio-blackout-map',
      ],
      'all-tools': allToolIds,
    }),
    [allToolIds],
  );

  const leftDockTiles = useMemo<Array<{ id: string; label: string; icon: ReactNode; tone: DockTone }>>(
    () => [
      { id: 'telemetry', label: 'Telemetry', icon: <Activity size={14} />, tone: 'telemetry' },
      { id: 'mission-core', label: 'Mission', icon: <Layers size={14} />, tone: 'telemetry' },
      { id: 'sat-threat', label: 'Threat', icon: <Shield size={14} />, tone: 'sim' },
      { id: 'hangar', label: 'Hangar', icon: <Rocket size={14} />, tone: 'sim' },
      { id: 'fireball', label: 'Fireball', icon: <Flame size={14} />, tone: 'sim' },
    ],
    [],
  );

  const rightDockTiles = useMemo<Array<{ id: string; label: string; icon: ReactNode; tone: DockTone }>>(
    () => [
      { id: 'forecast-radar', label: 'Radar', icon: <Globe size={14} />, tone: 'forecast' },
      { id: 'dsn-live', label: 'DSN', icon: <Satellite size={14} />, tone: 'telemetry' },
      { id: 'noaa-feed', label: 'NOAA', icon: <Rss size={14} />, tone: 'telemetry' },
      { id: 'lstm-forecast', label: 'LSTM', icon: <TrendingUp size={14} />, tone: 'forecast' },
      { id: 'magnetic-grid', label: 'Mag Grid', icon: <Radio size={14} />, tone: 'telemetry' },
      { id: 'data-alchemist', label: 'Alchemy', icon: <FlaskConical size={14} />, tone: 'forecast' },
      { id: 'graph-hub', label: 'Graphs', icon: <BarChart2 size={14} />, tone: 'forecast' },
    ],
    [],
  );

  const dock = useDockSystem({ controlBarHeight, leftDockTiles, rightDockTiles, menuGroups, allToolIds });
  const selectedTileLabel = tileCatalog.find((tile) => tile.id === dock.selectedTileId)?.label ?? 'Mission Core';

  const handleShareSnapshot = useCallback(async () => {
    const snapshotEpoch = currentDate === 'LIVE' ? Date.now() : currentDate.getTime();
    const snapshot: SnapshotState = {
      epoch: snapshotEpoch,
      cameraPosition: [0, 0, 0],
      cameraTarget: [0, 0, 0],
      openPanels: [dock.activeSubTileId],
      activeSimulation: cmeActive ? 'cme' : undefined,
      zoomStage: earthLodStage,
    };

    const shareUrl = buildSnapshotUrl(snapshot);
    try {
      await navigator.clipboard.writeText(shareUrl);
      const screenshot = await captureCanvasScreenshot();
      setToasts((prev) => [
        {
          id: `snapshot-${Date.now()}`,
          severity: 'info' as const,
          message: screenshot ? 'Snapshot URL copied (+ screenshot captured locally)' : 'Snapshot URL copied to clipboard',
          ts: Date.now(),
          value: 1,
        },
        ...prev,
      ].slice(0, 12));
    } catch {
      setToasts((prev) => [
        {
          id: `snapshot-fail-${Date.now()}`,
          severity: 'warning' as const,
          message: 'Snapshot copy failed. Clipboard permission required.',
          ts: Date.now(),
          value: 0,
        },
        ...prev,
      ].slice(0, 12));
    }
  }, [dock.activeSubTileId, cmeActive, currentDate, earthLodStage]);

  const toDockStatus = useCallback((level?: 'green' | 'amber' | 'red'): DockStatus => {
    if (level === 'red') return 'red';
    if (level === 'amber') return 'amber';
    return 'green';
  }, []);

  const ovationProvider = spaceWeatherProviders.byId['ovation-prime'];
  const wsaEnlilProvider = spaceWeatherProviders.byId['wsa-enlil'];

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
    if (tileId === 'aurora-ovation') {
      return toDockStatus(ovationProvider.health.level);
    }
    if (tileId === 'forecast-radar') {
      return toDockStatus(wsaEnlilProvider.health.level);
    }
    if (tileId === 'iss-track' || tileId === 'iss-stream') {
      return showISS ? 'green' : 'amber';
    }
    if (tileId === 'sat-threat' || tileId === 'threat-simulator' || tileId === 'carrington-sim') {
      return cmeActive || cmeImpactActive ? 'amber' : 'green';
    }
    return 'green';
  }, [cmeActive, cmeImpactActive, lstmWorker.error, lstmWorker.inferring, lstmWorker.modelStatus, noaaDonki.error, noaaDonki.lastFetch, ovationProvider.health.level, showISS, toDockStatus, wsaEnlilProvider.health.level]);

  const dockStatusClass: Record<DockStatus, string> = {
    green: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
  };

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
    const id = window.setInterval(() => setNowUtc(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const node = controlBarRef.current;
    if (!node) {
      return;
    }

    const update = () => {
      const next = Math.max(92, Math.ceil(node.getBoundingClientRect().height));
      setControlBarHeight((prev) => (prev !== next ? next : prev));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [booted]);

  useEffect(() => {
    const node = timeExplorerRef.current;
    if (!node) {
      setTimeExplorerHeight(TIME_EXPLORER_BASE_HEIGHT);
      return;
    }
    const update = () => {
      const next = Math.max(TIME_EXPLORER_BASE_HEIGHT, Math.ceil(node.getBoundingClientRect().height));
      setTimeExplorerHeight((prev) => (prev !== next ? next : prev));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [booted]);

  useEffect(() => {
    document.documentElement.style.setProperty('--time-explorer-height', `${timeExplorerHeight}px`);
  }, [timeExplorerHeight]);

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

  useEffect(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('snapshot');
      if (!param) return;
      const snap = decodeSnapshot(param);
      if (snap.epoch && Number.isFinite(snap.epoch)) {
        setCurrentDate(new Date(snap.epoch));
      }
      if (Array.isArray(snap.openPanels) && snap.openPanels.length > 0) {
        dock.setActiveSubTileId(snap.openPanels[0]);
        dock.setSelectedTileId(snap.openPanels[0]);
      }
    } catch {
      // Ignore invalid snapshot payloads.
    }
  // dock.set* are stable useState dispatchers; this effect is intentionally mount-only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadCo2 = async () => {
      try {
        const url = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv');
        const text = await (await fetch(url)).text();
        const row = text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('#') && /\d/.test(line))
          .map((line) => line.split(','))
          .filter((parts) => parts.length > 3)
          .at(-1);
        const ppm = row ? Number(row[3]) : NaN;
        if (Number.isFinite(ppm)) {
          setCo2Ppm(ppm);
        }
      } catch {
        // leave null
      }
    };

    void loadCo2();
    const id = window.setInterval(() => {
      void loadCo2();
    }, 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const bzNow = noaaDonki.bundle?.bzGsm ?? -2;
    const sample = {
      kp: telemetry.kpIndex ?? 0,
      bz: bzNow,
      solarWind: telemetry.windSpeed ?? 400,
      xrayFlux: goesFlux.fluxWm2,
      co2: co2Ppm ?? 0,
      cmeCount: cmeActive ? 1 : 0,
    };
    const newAlerts = evaluateAlerts(sample, DEFAULT_RULES);
    if (newAlerts.length === 0) return;

    setAlerts((prev) => [...newAlerts, ...prev].slice(0, 200));
    setToasts((prev) => [...prev, ...newAlerts]);

    if ('Notification' in window && Notification.permission === 'granted') {
      newAlerts.forEach((alert) => {
        new Notification(alert.message, { body: `Severity: ${alert.severity.toUpperCase()}` });
      });
    }
    if (relayEnabled) {
      const outbound = newAlerts.filter((alert) => alert.severity !== 'info');
      if (outbound.length > 0) {
        void postAlertsToRelay(outbound);
      }
    }
  }, [cmeActive, co2Ppm, goesFlux.fluxWm2, noaaDonki.bundle?.bzGsm, relayEnabled, telemetry.kpIndex, telemetry.windSpeed]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setToasts((prev) => prev.filter((toast) => Date.now() - toast.ts < 10_000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const atmosphere = audioAtmosphereRef.current;
    if (audioEnabled) {
      solarSonification.start();
      atmosphere.enable();
    } else {
      solarSonification.stop();
      atmosphere.disable();
    }
  }, [audioEnabled, solarSonification]);

  // Keep ambient atmosphere in sync with live telemetry
  useEffect(() => {
    if (!audioEnabled) return;
    audioAtmosphereRef.current.updateFromTelemetry(
      telemetry.kpIndex ?? 0,
      noaaDonki.bundle?.bzGsm ?? 0,
      telemetry.windSpeed ?? 400,
    );
  }, [audioEnabled, telemetry.kpIndex, telemetry.windSpeed, noaaDonki.bundle?.bzGsm]);

  useEffect(() => {
    if (audioEnabled && cmeImpactActive) {
      solarSonification.triggerCME();
      audioAtmosphereRef.current.triggerCMEArrival();
    }
  }, [audioEnabled, cmeImpactActive, solarSonification]);


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
      case 'fireball':
        return (
          <FireballTrackerSlate
            fireballCount={telemetry.fireballCount}
            kpIndex={telemetry.kpIndex}
          />
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
                cascade={kesslerWorker.forecast ?? lstmWorker.forecast?.kesslerCascade ?? null}
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
          <TerminalLogHUD visible wsUrl={BACKEND_WS_URL} />
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
            providerMode={ovationProvider.health.sourceMode}
            providerHealth={ovationProvider.health.level}
            providerDetails={ovationProvider.health.details}
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
      case 'trajectory-forecast':
        return (
          <TrajectoryForecastPanel
            currentDate={effectiveDate}
            onHighPrecisionModeChange={setHighPrecisionModeEnabled}
            onVectorsResolved={applyResolvedVectors}
          />
        );
      case 'atmos-column':
        return <AtmosphereColumnPanel kp={telemetry.kpIndex ?? 0} solarCyclePhase={0.58} />;
      case 'carbon-link':
        return <CarbonClimateLink />;
      case 'emissions-impact':
        return <EmissionsImpact />;
      case 'gic-risk':
        return <GICRiskMap kpIndex={telemetry.kpIndex ?? 0} />;
      case 'gps-accuracy':
        return <GPSAccuracyMap kpIndex={telemetry.kpIndex ?? 0} dRapVisible={blackoutVisible} />;
      case 'radio-blackout-map':
        return <RadioBlackoutMap flareClass={goesFlux.flareClass} fluxWm2={goesFlux.fluxWm2} />;
      case 'ocean-climate':
        return <OceanClimatePanel co2Ppm={co2Ppm} />;
      case 'alert-log':
        return <AlertLogPanel alerts={alerts} />;
      case 'glossary':
        return <GlossaryPanel />;
      case 'graph-hub':
        return (
          <GraphMissionHub
            kpSeries={noaaDonki.bundle?.kpSeries ?? []}
            kpForecast24h={lstmWorker.kpCurve24h ?? []}
            co2Ppm={co2Ppm}
            goesFluxWm2={goesFlux.fluxWm2}
          />
        );
      default:
        return null;
    }
  };

  const handleSimulatorLaunch = (cme: SyntheticCME) => {
    setSyntheticCME(cme);
    setCmeActive(true);
    setCmeImpactActive(false);
  };

  const handleDeepTimeEpochSelect = (yearCE: number, epoch: DeepTimeEpoch) => {
    setSelectedEpochYear(yearCE);
    setUseDeepTimeEpoch(true);
    setIsTimePlaying(false);
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

  const handleRelockCamera = useCallback(() => {
    const target = currentPlanet ?? 'Earth';
    setTrackedPlanetName(target);
  }, [currentPlanet]);

  const handleUnlockCamera = useCallback(() => {
    setTrackedPlanetName(null);
  }, []);

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
    const totpot = noaaDonki.bundle?.totpot ?? Math.max(0, bt * bt * Math.max(0, -bz) * speed * 0.002);
    const savncpp = noaaDonki.bundle?.savncpp ?? Math.max(0, 0.42 * Math.max(0, -bz) * den + 0.58 * (noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 2.5));
    const totusjz = noaaDonki.bundle?.totusjz ?? Math.max(0, bt * Math.max(0, -bz) * 0.7 + den * 0.9);
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
      alfvenVelocityHistory: Array.from({ length: 24 }, () => speed / Math.sqrt(Math.max(den, 0.25))),
      totpotHistory: Array.from({ length: 24 }, () => totpot),
      savncppHistory: Array.from({ length: 24 }, () => savncpp),
      totusjzHistory: Array.from({ length: 24 }, () => totusjz),
      syzygyIndex: 0.5,
      jupiterSaturnAngle: 0.5,
      solarRotationPhase: ((Date.now() / 86_400_000) % 27.27) / 27.27,
      solarCyclePhase: 0.58,
      timeOfYear: (() => {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
        return Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / (365.25 * 86_400_000)));
      })(),
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
  const sliderWindowMs = 365 * 24 * 60 * 60 * 1000;
  const sliderMinMs = nowUtc.getTime() - sliderWindowMs;
  const sliderMaxMs = nowUtc.getTime() + sliderWindowMs;
  const sliderValueMs = Math.min(sliderMaxMs, Math.max(sliderMinMs, effectiveDate.getTime()));

  const setViewingDate = useCallback((next: Date) => {
    setCurrentDate(next);
    setSelectedEpochYear(next.getUTCFullYear());
    setUseDeepTimeEpoch(false);
  }, []);

  const shiftViewingDate = useCallback((days = 0, months = 0, years = 0) => {
    setCurrentDate((prev) => {
      const base = prev === 'LIVE' ? new Date() : new Date(prev);
      const next = new Date(base);
      if (years !== 0) {
        next.setUTCFullYear(next.getUTCFullYear() + years);
      }
      if (months !== 0) {
        next.setUTCMonth(next.getUTCMonth() + months);
      }
      if (days !== 0) {
        next.setUTCDate(next.getUTCDate() + days);
      }
      setSelectedEpochYear(next.getUTCFullYear());
      setUseDeepTimeEpoch(false);
      return next;
    });
    setIsTimePlaying(false);
  }, []);

  const stopHoldScrub = useCallback(() => {
    if (holdScrubRef.current != null) {
      window.clearInterval(holdScrubRef.current);
      holdScrubRef.current = null;
    }
  }, []);

  const startHoldScrub = useCallback((days = 0, months = 0, years = 0, intervalMs = 130) => {
    stopHoldScrub();
    shiftViewingDate(days, months, years);
    holdScrubRef.current = window.setInterval(() => {
      shiftViewingDate(days, months, years);
    }, intervalMs);
  }, [shiftViewingDate, stopHoldScrub]);

  useEffect(() => {
    if (!isTimePlaying || playbackRate === 0) {
      return;
    }

    const tick = window.setInterval(() => {
      setCurrentDate((prev) => {
        const base = prev === 'LIVE' ? new Date() : new Date(prev);
        const next = new Date(base.getTime() + playbackRate * 45 * 60 * 1000);
        setSelectedEpochYear(next.getUTCFullYear());
        setUseDeepTimeEpoch(false);
        return next;
      });
    }, 250);

    return () => window.clearInterval(tick);
  }, [isTimePlaying, playbackRate]);

  useEffect(() => {
    return () => {
      stopHoldScrub();
    };
  }, [stopHoldScrub]);

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


  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (event.key === 'Escape') {
        setViewMode('HELIOCENTRIC');
        setCurrentPlanet(null);
        setShowDiagnostics(false);
        dock.closeCommandPalette();
        setTimelineContextMenu(null);
      }

      if (event.key.toLowerCase() === 'r') {
        setCurrentDate('LIVE');
        setTacticalAlerts([]);
        setSelectedEpochYear(2026);
        setUseDeepTimeEpoch(false);
        setCmeImpactActive(false);
        setImpactBurstActive(false);
      }

      if (event.key.toLowerCase() === 'f') {
        const relockTarget = currentPlanet ?? 'Earth';
        setTrackedPlanetName(relockTarget);
      }

      if (event.key.toLowerCase() === 'u' && trackedPlanetName) {
        setTrackedPlanetName(null);
      }

      if (event.key === 'Escape' && trackedPlanetName) {
        setTrackedPlanetName(null);
      }
    };

    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  // dock.closeCommandPalette is a stable useCallback; no need to list dock itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlanet, trackedPlanetName]);

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
  const liveKesslerCascade = kesslerWorker.forecast ?? lstmWorker.forecast?.kesslerCascade ?? null;
  const kesslerAngularScale = 0.65 + (liveKesslerCascade?.next7dProbability ?? 0) * 3.25;
  const isEarthOrbitalView = currentPlanet === 'Earth';

  const shouldRenderEarthBowShock = useMemo(() => {
    if (!isEarthOrbitalView || liteMode) {
      return false;
    }

    // Best signal when Earth is still mostly in-frame; fades out for extreme close-ups.
    return earthLodStage === 'SPACE' || earthZoomDistance >= 1.1;
  }, [isEarthOrbitalView, liteMode, earthLodStage, earthZoomDistance]);

  const shouldRenderEarthCloudLayer = useMemo(() => {
    if (!isEarthOrbitalView || !weatherVisibility.cloud) {
      return false;
    }

    // Cloud shell is useful from orbital/regional distances, not deep local zoom.
    return earthLodStage !== 'SPACE' && earthZoomDistance <= 7.5;
  }, [isEarthOrbitalView, weatherVisibility.cloud, earthLodStage, earthZoomDistance]);

  const shouldRenderEarthWeatherLayers = useMemo(() => {
    if (!isEarthOrbitalView || liteMode) {
      return false;
    }

    if (!weatherVisibility.precip && !weatherVisibility.snow && !weatherVisibility.wind) {
      return false;
    }

    // OWM overlays are texture-heavy, keep them to meaningful close-orbit inspections.
    return (earthLodStage === 'REGIONAL' || earthLodStage === 'LOCAL') && earthZoomDistance <= 2.8;
  }, [isEarthOrbitalView, liteMode, weatherVisibility.precip, weatherVisibility.snow, weatherVisibility.wind, earthLodStage, earthZoomDistance]);

  const shouldRenderEarthWindStreamlines = useMemo(() => {
    if (!isEarthOrbitalView || liteMode || !weatherVisibility.stream) {
      return false;
    }

    // CPU-updated streamline trails are the heaviest weather overlay; render only at local pass.
    return earthLodStage === 'LOCAL' && earthZoomDistance <= 1.35;
  }, [isEarthOrbitalView, liteMode, weatherVisibility.stream, earthLodStage, earthZoomDistance]);

  const shouldRenderEarthCoreDynamo = useMemo(() => {
    if (currentPlanet !== 'Earth') {
      return false;
    }

    // Interior assets stay unmounted until inspection zoom to avoid hidden overdraw/flicker.
    if (cutawayEnabled) {
      return earthLodStage === 'REGIONAL' || earthLodStage === 'LOCAL';
    }

    if (liteMode) {
      return false;
    }

    return earthLodStage === 'LOCAL' && earthZoomDistance <= 0.42;
  }, [currentPlanet, cutawayEnabled, earthLodStage, earthZoomDistance, liteMode]);

  const applyResolvedVectors = useCallback((vectors: EphemerisVectorAU[]) => {
    const next: Record<string, EphemerisVectorAU> = {};
    for (const vector of vectors) {
      next[vector.body] = vector;
    }
    setHighPrecisionVectors(next);
  }, []);

  useEffect(() => {
    if (!highPrecisionModeEnabled || useDeepTimeEpoch) {
      return;
    }

    const ticket = ++precisionFetchTicketRef.current;
    const delayMs = isTimePlaying ? 1800 : 250;
    const id = window.setTimeout(async () => {
      try {
        const bodies = [...PLANET_BODIES, ...MOON_BODIES] as ForecastBodyName[];
        const paramsDate = encodeURIComponent(effectiveDate.toISOString());
        const responses = await Promise.all(
          bodies.map(async (body) => {
            const url = `${BACKEND_HTTP_BASE}/api/ephemeris/horizons?body=${encodeURIComponent(body)}&date=${paramsDate}`;
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Horizons API ${response.status} for ${body}`);
            }
            const payload = await response.json();
            return payload?.ok ? (payload.vector as EphemerisVectorAU) : null;
          }),
        );

        if (ticket !== precisionFetchTicketRef.current) {
          return;
        }

        applyResolvedVectors(responses.filter((row): row is EphemerisVectorAU => row != null));
      } catch (err) {
        console.warn('[Skoll] High-precision fetch failed:', err);
      }
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [applyResolvedVectors, effectiveDate, highPrecisionModeEnabled, isTimePlaying, useDeepTimeEpoch]);

  const envDiagnostics = useMemo(() => {
    const checks = {
      nasaApi: Boolean(import.meta.env.VITE_NASA_API_KEY),
      donkiApi: Boolean(import.meta.env.VITE_NASA_DONKI_API_KEY),
      fireballProxy: Boolean(import.meta.env.VITE_NASA_FIREBALL_PROXY_URL),
      openWeather: Boolean(import.meta.env.VITE_OPENWEATHER_API_KEY),
      mapbox: Boolean(import.meta.env.VITE_MAPBOX_TOKEN),
    };

    const missingRequired = [
      !checks.nasaApi ? 'VITE_NASA_API_KEY' : null,
      !checks.donkiApi ? 'VITE_NASA_DONKI_API_KEY' : null,
    ].filter((item): item is string => item != null);

    const missingOptional = [
      !checks.fireballProxy ? 'VITE_NASA_FIREBALL_PROXY_URL' : null,
      !checks.openWeather ? 'VITE_OPENWEATHER_API_KEY' : null,
      !checks.mapbox ? 'VITE_MAPBOX_TOKEN' : null,
    ].filter((item): item is string => item != null);

    const level: 'green' | 'amber' | 'red' = missingRequired.length > 0 ? 'red' : missingOptional.length > 0 ? 'amber' : 'green';
    return { checks, missingRequired, missingOptional, level };
  }, []);

  const canvasDpr = useMemo<[number, number]>(() => {
    if (retroMode) {
      return [0.125, 0.125];
    }

    const cap = liteMode || ecoMode ? 1 : 1.5;
    const floor = ecoMode ? 0.6 : liteMode ? 0.75 : 0.9;
    const clamped = THREE.MathUtils.clamp(adaptiveDpr, floor, cap);
    return [clamped, clamped];
  }, [adaptiveDpr, ecoMode, liteMode, retroMode]);

  const nudgeAdaptiveDpr = useCallback((direction: 'up' | 'down') => {
    const now = performance.now();
    // Prevent rapid up/down oscillation that appears as visual flicker.
    if (now - adaptiveDprLastAdjustAtRef.current < 2400) {
      return;
    }

    adaptiveDprLastAdjustAtRef.current = now;
    const cap = liteMode || ecoMode ? 1 : 1.5;
    const floor = ecoMode ? 0.6 : liteMode ? 0.75 : 0.9;

    setAdaptiveDpr((prev) => {
      const delta = direction === 'down' ? -0.04 : 0.015;
      const next = THREE.MathUtils.clamp(Number((prev + delta).toFixed(3)), floor, cap);
      // Ignore tiny jitter adjustments that are not perceptible.
      return Math.abs(next - prev) < 0.012 ? prev : next;
    });
  }, [ecoMode, liteMode]);

  useEffect(() => {
    if (envWarnedRef.current) {
      return;
    }
    envWarnedRef.current = true;

    if (envDiagnostics.missingRequired.length > 0) {
      console.warn('[Sköll] Missing required env keys:', envDiagnostics.missingRequired.join(', '));
    }
    if (envDiagnostics.missingOptional.length > 0) {
      console.warn('[Sköll] Optional env keys/proxy not set:', envDiagnostics.missingOptional.join(', '));
    }
  }, [envDiagnostics]);


  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-mono text-cyan-400">
      <div
        className="fixed inset-0 z-0 pointer-events-auto"
        style={{
          imageRendering: retroMode ? 'pixelated' : 'auto',
          filter: retroMode ? 'contrast(1.2) saturate(0.6)' : 'none',
        }}
      >
        <SlateErrorBoundary moduleName="Observa-Scene" fallback={<div className="absolute inset-0 bg-black/40" />}>
          <Canvas
            frameloop="always"
            shadows={!liteMode && !ecoMode}
            dpr={canvasDpr}
            gl={{
              antialias: !ecoMode && !retroMode,
              alpha: true,
              logarithmicDepthBuffer: true,
              // Prefer discrete GPU on multi-GPU systems for maximum throughput.
              powerPreference: 'high-performance',
              // Stencil buffer unused; disabling saves memory bandwidth.
              stencil: false,
            }}
            onCreated={({ gl, camera }) => {
              // Ensure camera sees all THREE.Layers (required after any bloom/layer changes)
              camera.layers.enableAll();
              gl.shadowMap.enabled = !liteMode && !ecoMode;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
              // Shadow map on-demand: only recompute when explicitly requested.
              // Components that cast shadows call gl.shadowMap.needsUpdate = true
              // via the scene's pointLight. This prevents per-frame shadow redraws.
              gl.shadowMap.autoUpdate = false;
              gl.shadowMap.needsUpdate = true; // Initial bake
              gl.localClippingEnabled = true;
              setTexturesLoaded(true);
            }}
            style={{ position: 'absolute', insetBlockStart: 0, insetInlineStart: 0, zIndex: 0 }}
          >
            {!retroMode && (
              <PerformanceMonitor
                bounds={() => [54, 60]}
                onDecline={() => {
                  nudgeAdaptiveDpr('down');
                }}
              />
            )}
            <PerspectiveCamera makeDefault position={[0, 150, 300]} fov={65} near={0.01} far={1_500_000} />
            <EarthZoomLadderController
              active={currentPlanet === 'Earth'}
              planetRefs={planetRefs}
              onLodChange={(lod, distance) => {
                setEarthLodStage(lod);
                setEarthZoomDistance(distance);
              }}
            />
            {!liteMode && <EnhancedStarfield />}
            {/* Local Interstellar Cloud — warm LIC shell enveloping the scene */}
            {!liteMode && <LocalInterstellarCloud />}
            {/* Heliopause — outer heliosphere boundary (user-toggled) */}
            <HeliopauseShell visible={heliopauseVisible} />
            <ambientLight intensity={0.15} />
            <pointLight position={[0, 0, 0]} intensity={5} color="#fffae5" decay={2} distance={2000} castShadow={!liteMode} />

            {/* THE SUN: always rendered */}
            <>
              <DynamicSun
                intensity={telemetry.currentIntensity}
                solarWindSpeed={currentHistoricalEvent?.solarWindSpeed || telemetry.windSpeed}
                isHistoricalEvent={!!currentHistoricalEvent}
              />
              <Suspense fallback={null}>
                {!liteMode && <LazySagittariusA />}
                {!liteMode && <LazyKuiperBelt visible={viewMode === 'HELIOCENTRIC'} />}
                {!liteMode && <LazyOortCloud visible={viewMode === 'HELIOCENTRIC'} />}
              </Suspense>
            </>

            <Suspense fallback={null}>
              <LazyPlanetRenderer
                onPlanetSelect={focusOnPlanet}
                onFocusAnimationComplete={handleFocusAnimationComplete}
                currentIntensity={telemetry.currentIntensity}
                currentDate={effectiveDate}
                isLiveMode={currentDate === 'LIVE'}
                cmeOverdrive={cmeImpactActive}
                standoffDistance={telemetry.standoffDistance}
                onPlanetRefsReady={setPlanetRefs}
                epochYear={useDeepTimeEpoch ? selectedEpochYear : undefined}
                positionOverridesAu={highPrecisionModeEnabled ? highPrecisionVectors : undefined}
                focusedPlanetName={currentPlanet}
                kpIndex={noaaDonki.bundle?.latestKp ?? telemetry.kpIndex ?? 0}
                kesslerCascade={liveKesslerCascade}
                auroraEnabled={!ecoMode}
              />
              {/* Apophis 2029 flyby orbit */}
              <LazyApophisTracker visible={apophisVisible} epochYear={selectedEpochYear} />
              <CameraTracker
                targetName={trackedPlanetName}
                planetRefs={planetRefs}
                isEnabled={!!trackedPlanetName}
                onManualOverride={() => {
                  setTrackedPlanetName(null);
                }}
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
                    {shouldRenderEarthBowShock && (
                      <EarthBowShock
                        earthPos={pos}
                        cmeActive={cmeActive || cmeImpactActive}
                        kpIndex={telemetry.kpIndex ?? 0}
                        sunDirection={new THREE.Vector3(1, 0, 0)}
                        solarWindDensity={syntheticCME?.density ?? noaaDonki.bundle?.density ?? 5}
                        solarWindSpeed={syntheticCME?.speed ?? noaaDonki.bundle?.speed ?? 450}
                      />
                    )}
                    {/* Live cloud layer on Earth */}
                    <EarthCloudLayer
                      earthPos={pos}
                      visible={shouldRenderEarthCloudLayer}
                      owmApiKey={import.meta.env.VITE_OPENWEATHER_API_KEY}
                      opacity={weatherOpacity.cloud}
                      currentDate={effectiveDate}
                      isLiveMode={currentDate === 'LIVE'}
                    />
                    <EarthWeatherLayers
                      earthPos={pos}
                      visible={shouldRenderEarthWeatherLayers}
                      owmApiKey={import.meta.env.VITE_OPENWEATHER_API_KEY}
                      opacityPrecip={weatherOpacity.precip}
                      opacitySnow={weatherOpacity.snow}
                      opacityWind={weatherOpacity.wind}
                      showPrecip={weatherVisibility.precip}
                      showSnow={weatherVisibility.snow}
                      showWind={weatherVisibility.wind}
                      currentDate={effectiveDate}
                      isLiveMode={currentDate === 'LIVE'}
                    />
                    <EarthWindStreamlines
                      earthPos={pos}
                      visible={shouldRenderEarthWindStreamlines}
                      opacity={weatherOpacity.stream}
                      streamCount={liteMode ? 60 : earthLodStage === 'LOCAL' ? 280 : earthLodStage === 'REGIONAL' ? 180 : 110}
                      speedScale={Math.max(0.35, surfaceWindKmh / 24)}
                      currentDate={effectiveDate}
                      isLiveMode={currentDate === 'LIVE'}
                    />
                    <EarthCutawayExplorer
                      earthPos={pos}
                      visible={cutawayEnabled && (earthLodStage === 'REGIONAL' || earthLodStage === 'LOCAL')}
                      sliceEnabled={cutawaySliceEnabled}
                      sliceDepth={cutawaySliceDepth}
                      showCrust={cutawayShells.crust}
                      showMantle={cutawayShells.mantle}
                      showOuterCore={cutawayShells.outerCore}
                      showInnerCore={cutawayShells.innerCore}
                    />
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
                      visible={shouldRenderEarthCoreDynamo}
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

            <OrbitControls enablePan enableZoom enableDamping dampingFactor={0.08} makeDefault minDistance={0.001} maxDistance={100000} maxPolarAngle={Math.PI} />
            <SurfaceCameraController
              enabled={false}
              onAltitudeChange={setSurfaceAltitudeKm}
              sampleTerrainHeight={(x, z) => terrainSamplerRef.current(x, z)}
            />
            {fxReady && !liteMode && !ecoMode && (
              <Suspense fallback={null}>
                <LazyCinematicPostFX
                  quality={fxQuality}
                  boost={cmeImpactActive ? 1 : telemetry.currentIntensity}
                  burstActive={impactBurstActive}
                />
              </Suspense>
            )}
          </Canvas>
        </SlateErrorBoundary>
      </div>

      {booted && (
        <div
          ref={controlBarRef}
          className={[
            'app-top-bar nasa-slate skoll-slate-shell skoll-command-bar fixed left-0 top-0 z-[9999] w-full pointer-events-auto px-3 py-2 rounded-none',
            isReversal ? 'skoll-reversal-banner border-red-500/50' : 'border-cyan-500/30',
          ].join(' ')}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
            <div className="aurora-command-pill min-w-0 flex items-center gap-2">
              <span className={`status-dot ${hazardModel.apiHealth}`} aria-hidden="true" />
              <span className="text-[9px] uppercase tracking-[0.16em] text-cyan-100 truncate">
                Hazard Kp {hazardModel.kpIndex.toFixed(1)} · Bz {hazardModel.bzGsm.toFixed(1)} nT · {hazardModel.flareClass}
              </span>
            </div>
            <button
              type="button"
              className="aurora-command-pill aurora-command-action min-w-0 text-left"
              onClick={() => {
                dock.toggleCommandGroup('live-telemetry', { insetBlockStart: controlBarHeight + 8, insetInlineStart: 12 });
              }}
            >
              <span className="leading-tight text-[8px] uppercase tracking-[0.12em] text-cyan-400/90">Mission Control</span>
              <span className="ml-1 leading-tight text-[9px] uppercase tracking-[0.08em] text-cyan-100/95 truncate">/ open live tools</span>
            </button>
            <div className="aurora-command-pill min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.14em] text-cyan-100">
                <MissionUTCTime />
                <LiveSyncBadgeCompact lastFetch={noaaDonki.lastFetch} isLiveMode={currentDate === 'LIVE'} />
              </div>
              <div className="flex items-center gap-2">
                <LocationSwitcher value={location} onChange={setLocation} />
                <span
                  className={`rounded border px-1.5 py-0.5 text-[8px] tracking-[0.14em] shrink-0 ${trackedPlanetName ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-100' : 'border-cyan-500/35 bg-black/25 text-cyan-300/90'}`}
                  title={trackedPlanetName ? 'Camera tracking locked to selected body' : 'Camera is in free-fly mode'}
                >
                  {trackedPlanetName ? `Track ${trackedPlanetName}` : 'Free Cam'}
                </span>
              </div>
            </div>
            <div className="aurora-command-pill min-w-0 flex items-center gap-2 flex-wrap justify-start md:justify-end">
              <CosmicTooltip content={{ title: audioEnabled ? 'Mute Sonification' : 'Enable Sonification', emoji: '🔊', accentColor: '#06b6d4', description: 'Toggle real-time space-weather audio sonification.' }}>
                <button
                  type="button"
                  className={`skoll-dock-button h-7 w-7 rounded border flex items-center justify-center ${audioEnabled ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-cyan-500/35 bg-black/20 text-cyan-300/90'}`}
                  onClick={() => {
                    setAudioEnabled((prev) => {
                      const next = !prev;
                      if (next) {
                        solarSonification.start();
                      } else {
                        solarSonification.stop();
                      }
                      return next;
                    });
                  }}
                  aria-label={audioEnabled ? 'Mute sonification' : 'Enable sonification'}
                >
                  {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>
              </CosmicTooltip>
              <CosmicTooltip content={{ title: 'Browser Alerts', emoji: '🔔', accentColor: '#f59e0b', description: 'Enable native browser notification permission.' }}>
                <button
                  type="button"
                  className="skoll-dock-button h-7 w-7 rounded border border-cyan-500/35 bg-black/20 text-cyan-300/90 flex items-center justify-center"
                  onClick={() => void requestNotificationPermission()}
                  aria-label="Enable browser notifications"
                >
                  <Bell size={13} />
                </button>
              </CosmicTooltip>
              <CosmicTooltip content={{ title: 'Share Snapshot', emoji: '🔗', accentColor: '#8b5cf6', description: 'Copy current mission-state snapshot URL.' }}>
                <button
                  type="button"
                  className="skoll-dock-button h-7 w-7 rounded border border-cyan-500/35 bg-black/20 text-cyan-300/90 flex items-center justify-center"
                  onClick={() => void handleShareSnapshot()}
                  aria-label="Copy shareable snapshot URL"
                >
                  <Share2 size={13} />
                </button>
              </CosmicTooltip>
              <CosmicTooltip content={{ title: liteMode ? 'Lite Mode On' : 'Lite Mode Off', emoji: '⚡', accentColor: '#06b6d4', description: 'Reduce expensive visual effects to improve FPS.' }}>
                <button
                  type="button"
                  className={`skoll-dock-button h-7 w-7 rounded border flex items-center justify-center ${liteMode ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-cyan-500/35 bg-black/20 text-cyan-300/90'}`}
                  onClick={() => {
                    setLiteMode((prev) => {
                      const next = !prev;
                      if (next) { setFxQuality('LOW'); }
                      return next;
                    });
                  }}
                  aria-label="Toggle lite mode"
                >
                  <Zap size={13} />
                </button>
              </CosmicTooltip>
              <CosmicTooltip content={{ title: ecoMode ? 'Eco Mode On' : 'Eco Mode Off', emoji: '🌿', accentColor: '#22c55e', description: 'Disables aurora shader and bloom/post FX for power-safe rendering.' }}>
                <button
                  type="button"
                  className={`skoll-dock-button h-7 w-7 rounded border flex items-center justify-center ${ecoMode ? 'border-emerald-300 bg-emerald-500/20 text-emerald-100' : 'border-cyan-500/35 bg-black/20 text-cyan-300/90'}`}
                  onClick={() => {
                    setEcoMode((prev) => {
                      const next = !prev;
                      if (next) {
                        setFxQuality('LOW');
                      }
                      return next;
                    });
                  }}
                  aria-label="Toggle eco mode"
                >
                  <Leaf size={13} />
                </button>
              </CosmicTooltip>
              <CosmicTooltip content={{ title: retroMode ? 'Retro Mode On' : 'Retro Mode Off', emoji: '👾', accentColor: '#9bbc0f', description: 'Apply pixel-art visual filter for retro styling.' }}>
                <button
                  type="button"
                  className={`skoll-dock-button h-7 w-7 rounded border flex items-center justify-center ${retroMode ? 'border-[#9bbc0f] bg-[#0f380f]/60 text-[#9bbc0f]' : 'border-cyan-500/35 bg-black/20 text-cyan-300/90'}`}
                  onClick={() => setRetroMode((prev) => !prev)}
                  aria-label="Toggle retro pixel mode"
                >
                  <Gamepad2 size={13} />
                </button>
              </CosmicTooltip>
              <CosmicTooltip content={{ title: relayEnabled ? 'Relay On' : 'Relay Off', emoji: '📡', accentColor: '#06b6d4', description: 'Forward warning and critical alerts to the configured relay.' }}>
                <button
                  type="button"
                  className={`skoll-dock-button h-7 w-7 rounded border flex items-center justify-center ${relayEnabled ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-cyan-500/35 bg-black/20 text-cyan-300/90'}`}
                  onClick={() => setRelayEnabled((prev) => !prev)}
                  aria-label="Toggle alert relay"
                >
                  <Radio size={13} />
                </button>
              </CosmicTooltip>
              <CosmicTooltip content={{ title: trackedPlanetName ? 'Unlock Camera Follow' : 'Re-lock Camera Follow', emoji: '🎯', accentColor: trackedPlanetName ? '#f59e0b' : '#06b6d4', description: trackedPlanetName ? 'Return to free-fly mode (U)' : `Re-lock camera to ${currentPlanet ?? 'Earth'} (F)` }}>
                <button
                  type="button"
                  className={`skoll-dock-button h-7 w-7 rounded border flex items-center justify-center ${trackedPlanetName ? 'border-amber-400/45 bg-amber-500/15 text-amber-100' : 'border-cyan-500/35 bg-black/20 text-cyan-300/90'}`}
                  onClick={trackedPlanetName ? handleUnlockCamera : handleRelockCamera}
                  aria-label={trackedPlanetName ? 'Unlock camera follow' : 'Re-lock camera follow'}
                >
                  {trackedPlanetName ? <Unlock size={13} /> : <Lock size={13} />}
                </button>
              </CosmicTooltip>
              <div className="h-6 w-6 rounded-md border border-cyan-400/45 flex items-center justify-center text-cyan-200 bg-cyan-500/5">
                <Orbit size={13} />
              </div>
              <div className="text-right min-w-0">
                <div className="text-[8px] uppercase tracking-[0.18em] text-cyan-500/70">Mission</div>
                <div className="text-[9px] uppercase tracking-[0.1em] text-cyan-100 font-semibold truncate">{selectedTileLabel}</div>
              </div>
              <button
                type="button"
                title="Reset Sköll — reload all data and restore defaults"
                onClick={() => window.location.reload()}
                className="skoll-circle-action ml-1"
                aria-label="Reset Sköll"
              >
                ↻
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="app-interaction-layer fixed inset-x-0 z-50 pointer-events-none select-none overflow-hidden"
        style={{
          insetBlockStart: controlBarHeight,
          insetBlockEnd: timeExplorerHeight,
        }}
      >
        {booted && (
          <>
            {/* ═══ Side Rails + Overlay Slates ═══ */}
            {!hudMinimized && (
              <>
                {/* Backdrop — closes modal when clicking outside */}
                {dock.dockModalTileId && (
                  <div
                    className="fixed inset-0 z-[49] bg-black/10 pointer-events-auto"
                    onClick={() => dock.closeDockPanel()}
                  />
                )}

                <div className="absolute left-4 z-50 flex flex-col gap-2 pointer-events-auto overflow-visible" style={{ insetBlockStart: 12, insetBlockEnd: 16 }}>
                  {leftDockTiles.map((item) => (
                    <CosmicTooltip
                      key={item.id}
                      content={DOCK_TILE_TOOLTIPS[item.id] ?? { title: item.label, emoji: '•', accentColor: '#06b6d4' }}
                    >
                      <button
                        type="button"
                        onClick={() => dock.openDockPanel(item.id, 'left')}
                        className={`skoll-dock-button relative h-9 w-9 rounded-lg border text-[12px] font-bold transition-colors ${dock.dockModalTileId === item.id ? `${dockToneClasses[item.tone].active} shadow-[0_0_10px_rgba(34,211,238,0.35)]` : dockToneClasses[item.tone].idle}`}
                      >
                        <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${dockStatusClass[getDockStatus(item.id)]}`} />
                        {item.icon}
                      </button>
                    </CosmicTooltip>
                  ))}
                  <button
                    type="button"
                    onClick={(event) => {
                      const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      dock.openCommandPalette({ insetBlockStart: rect.top - 12, insetInlineStart: rect.right + 12 });
                    }}
                    className="skoll-dock-button mt-auto relative h-9 w-9 rounded-lg border border-cyan-500/35 bg-black/55 text-[12px] font-bold text-cyan-300 transition-colors hover:bg-cyan-500/12"
                    title="More tools"
                    aria-label="More tools"
                  >
                    <Activity size={14} />
                  </button>

                  {/* Left dock modal — opens to the right of the icon column */}
                  {dock.dockModalSide === 'left' && dock.dockModalTileId && (
                    <motion.div
                      ref={dock.dockPanelRef}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="nasa-slate skoll-slate-shell skoll-dock-popover absolute left-full ml-2 top-0 z-50 w-[min(94vw,30rem)] max-w-[30rem] p-3.5 pointer-events-auto"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 border-b border-cyan-500/20 pb-2">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-200">
                          {tileCatalog.find((tile) => tile.id === dock.dockModalTileId)?.label ?? dock.dockModalTileId}
                        </div>
                        <button type="button" onClick={() => dock.closeDockPanel()} className="skoll-circle-action skoll-circle-action-danger" aria-label="Close panel" title="Close">✕</button>
                      </div>
                      <div className="max-h-[76vh] overflow-y-auto overflow-x-hidden wolf-scroll pr-1.5 text-[11px]">
                        {renderSubmenuContent(dock.dockModalTileId)}
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 pointer-events-auto overflow-visible">
                  {rightDockTiles.map((item) => (
                    <CosmicTooltip
                      key={item.id}
                      content={DOCK_TILE_TOOLTIPS[item.id] ?? { title: item.label, emoji: '•', accentColor: '#8b5cf6' }}
                    >
                      <button
                        type="button"
                        onClick={() => dock.openDockPanel(item.id, 'right')}
                        className={`skoll-dock-button relative h-9 w-9 rounded-lg border text-[12px] font-bold transition-colors ${dock.dockModalTileId === item.id ? `${dockToneClasses[item.tone].active} shadow-[0_0_10px_rgba(34,211,238,0.35)]` : dockToneClasses[item.tone].idle}`}
                      >
                        <span className={`absolute left-1 top-1 h-1.5 w-1.5 rounded-full ${dockStatusClass[getDockStatus(item.id)]}`} />
                        {item.icon}
                      </button>
                    </CosmicTooltip>
                  ))}
                  <button
                    type="button"
                    onClick={(event) => {
                      const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      dock.openCommandPalette({ insetBlockStart: rect.top - 12, insetInlineStart: rect.left - 360 });
                    }}
                    className="skoll-dock-button mt-auto relative h-9 w-9 rounded-lg border border-cyan-500/35 bg-black/55 text-[12px] font-bold text-cyan-300 transition-colors hover:bg-cyan-500/12"
                    title="More tools"
                    aria-label="More tools"
                  >
                    <Activity size={14} />
                  </button>

                  {/* Right dock modal — absolute, opens to the left of the icon column */}
                  {dock.dockModalSide === 'right' && dock.dockModalTileId && (
                    <motion.div
                      ref={dock.dockPanelRef}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="nasa-slate skoll-slate-shell skoll-dock-popover absolute right-full mr-2 top-0 z-50 w-[min(94vw,30rem)] max-w-[30rem] p-3.5 pointer-events-auto"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 border-b border-cyan-500/20 pb-2">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-200">
                          {tileCatalog.find((tile) => tile.id === dock.dockModalTileId)?.label ?? dock.dockModalTileId}
                        </div>
                        <button type="button" onClick={() => dock.closeDockPanel()} className="skoll-circle-action skoll-circle-action-danger" aria-label="Close panel" title="Close">✕</button>
                      </div>
                      <div className="max-h-[76vh] overflow-y-auto overflow-x-hidden wolf-scroll pr-1.5 text-[11px]">
                        {renderSubmenuContent(dock.dockModalTileId)}
                      </div>
                    </motion.div>
                  )}
                </div>

              {/* Floating command palette — "Open Live Tools" / "More tools" / keyboard shortcuts */}
              {dock.openMenuId && dock.commandMenuAnchor && (
                <>
                  {/* Backdrop — click outside closes the palette */}
                  <div
                    className="fixed inset-0 z-[9997] pointer-events-auto"
                    onClick={() => dock.closeCommandPalette()}
                  />
                  <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="nasa-slate skoll-slate-shell skoll-floating-popover fixed z-[9998] pointer-events-auto flex shadow-2xl"
                  style={{
                    insetBlockStart: dock.commandMenuAnchor.insetBlockStart,
                    insetInlineStart: dock.commandMenuAnchor.insetInlineStart,
                    width: 'min(96vw, 60rem)',
                    maxHeight: '78vh',
                  }}
                >
                  {/* Left: tool list */}
                  <div className="w-40 shrink-0 border-r border-cyan-500/20 flex flex-col overflow-y-auto wolf-scroll">
                    <div className="flex items-center justify-between px-2.5 py-2 border-b border-cyan-500/20">
                      <span className="text-[8px] uppercase tracking-[0.2em] text-cyan-400/70">Tools</span>
                      <button
                        type="button"
                        onClick={() => dock.closeCommandPalette()}
                        className="skoll-circle-action skoll-circle-action-danger text-[10px]"
                        aria-label="Close tool palette"
                      >
                        ✕
                      </button>
                    </div>
                    {(menuGroups[dock.openMenuId] ?? []).map((tileId) => {
                      const tile = tileCatalog.find((t) => t.id === tileId);
                      if (!tile) return null;
                      return (
                        <button
                          key={tileId}
                          type="button"
                          onClick={() => dock.setActiveSubTileId(tileId)}
                          className={`text-left px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.08em] transition-colors ${dock.activeSubTileId === tileId ? 'bg-cyan-500/20 text-cyan-100 border-l-2 border-cyan-400' : 'text-cyan-400/70 hover:bg-cyan-500/10 hover:text-cyan-200 border-l-2 border-transparent'}`}
                        >
                          {tile.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Right: active tool content */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="px-3 py-2 border-b border-cyan-500/20 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-cyan-200">
                        {tileCatalog.find((t) => t.id === dock.activeSubTileId)?.label ?? dock.activeSubTileId}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden wolf-scroll p-3 text-[11px]">
                      {renderSubmenuContent(dock.activeSubTileId)}
                    </div>
                  </div>
                </motion.div>
                </>
              )}
              </>
            )}

            {/* Live ISS HUD overlay */}
            {showISS && <LiveISSHUD data={null} visible={showISS} />}
            <EarthWeatherNow
              visible={currentPlanet === 'Earth' && viewMode === 'HELIOCENTRIC'}
              latitude={location.lat}
              longitude={location.lon}
              locationName={location.name}
              onCurrentChange={(current: EarthWeatherCurrent | null) => {
                if (current?.wind_speed_10m != null) {
                  setSurfaceWindKmh(current.wind_speed_10m);
                }
              }}
            />
            <WeatherLayerControls
              visible={currentPlanet === 'Earth' && viewMode === 'HELIOCENTRIC'}
              opacity={weatherOpacity}
              visibility={weatherVisibility}
              onOpacityChange={setWeatherOpacity}
              onVisibilityChange={setWeatherVisibility}
            />
            <EarthStoryTimelinePanel
              visible={currentPlanet === 'Earth'}
              lodStage={earthLodStage}
              windSpeed={surfaceWindKmh}
              kpIndex={telemetry.kpIndex ?? 0}
              cmeActive={cmeActive}
              cmeImpactActive={cmeImpactActive}
              blackoutVisible={blackoutVisible}
              dateLabel={formatTimelineDate(effectiveDate)}
            />
            {currentPlanet === 'Earth' && (earthLodStage === 'REGIONAL' || earthLodStage === 'LOCAL') && (
              <div className="pointer-events-auto absolute right-[252px] z-[75] min-w-[240px] rounded border border-cyan-500/30 bg-black/65 px-3 py-2 text-cyan-100 backdrop-blur-sm" style={{ insetBlockEnd: 'calc(var(--time-explorer-height, 3.5rem) + 1rem)' }}>
                <div className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/80">Cutaway Earth</div>
                <label className="mt-1 flex items-center gap-1 text-[9px] uppercase tracking-[0.08em]">
                  <input type="checkbox" checked={cutawayEnabled} onChange={(event) => setCutawayEnabled(event.currentTarget.checked)} />
                  Enable Cutaway
                </label>
                <label className="mt-1 flex items-center gap-1 text-[9px] uppercase tracking-[0.08em]">
                  <input type="checkbox" checked={cutawaySliceEnabled} onChange={(event) => setCutawaySliceEnabled(event.currentTarget.checked)} disabled={!cutawayEnabled} />
                  Slice Plane
                </label>
                <div className="mt-1 text-[8px] uppercase tracking-[0.08em] text-cyan-200/80">Slice Depth</div>
                <input
                  type="range"
                  min={-1.8}
                  max={1.8}
                  step={0.02}
                  value={cutawaySliceDepth}
                  onChange={(event) => setCutawaySliceDepth(Number(event.currentTarget.value))}
                  disabled={!cutawayEnabled}
                />
                <div className="mt-1 grid grid-cols-2 gap-1 text-[8px] uppercase tracking-[0.08em]">
                  <label><input type="checkbox" checked={cutawayShells.crust} onChange={(event) => setCutawayShells((prev) => ({ ...prev, crust: event.currentTarget.checked }))} disabled={!cutawayEnabled} /> Crust</label>
                  <label><input type="checkbox" checked={cutawayShells.mantle} onChange={(event) => setCutawayShells((prev) => ({ ...prev, mantle: event.currentTarget.checked }))} disabled={!cutawayEnabled} /> Mantle</label>
                  <label><input type="checkbox" checked={cutawayShells.outerCore} onChange={(event) => setCutawayShells((prev) => ({ ...prev, outerCore: event.currentTarget.checked }))} disabled={!cutawayEnabled} /> Outer Core</label>
                  <label><input type="checkbox" checked={cutawayShells.innerCore} onChange={(event) => setCutawayShells((prev) => ({ ...prev, innerCore: event.currentTarget.checked }))} disabled={!cutawayEnabled} /> Inner Core</label>
                </div>
                <div className="mt-1 text-[8px] uppercase tracking-[0.08em] text-cyan-300/80">Zoom {earthZoomDistance.toFixed(2)} u • {earthLodStage}</div>
              </div>
            )}
            <MagneticReversalAlert active={selectedEpochYear <= -66000000} />
            <div className="fixed bottom-[calc(var(--time-explorer-height)+0.5rem)] right-3 sm:right-4 z-[99] pointer-events-auto select-none flex flex-col items-end gap-1.5">
              <SlateErrorBoundary moduleName="KesslerTelemetryChip">
                <KesslerTelemetryChip
                  next24hProbability={liveKesslerCascade?.next24hProbability ?? null}
                  angularScale={kesslerAngularScale}
                />
              </SlateErrorBoundary>
              <div className="rounded-md border border-cyan-500/35 bg-black/50 px-2 py-1 backdrop-blur-md text-[8px] uppercase tracking-[0.08em] text-cyan-200 font-mono">
                <span className="telemetry-value">FPS {fps}</span>
                <span className="mx-1 text-cyan-500/40">|</span>
                <span className="telemetry-value">LSTM {lstmLatencyMs != null ? `${lstmLatencyMs}ms` : '—'}</span>
                <span className="mx-1 text-cyan-500/40">|</span>
                <span className="telemetry-value">NOAA {noaaFetchAgeSec != null ? `${noaaFetchAgeSec}s` : '—'}</span>
              </div>
            </div>

            <div
              ref={timeExplorerRef}
              className="time-explorer fixed inset-x-0 bottom-0 z-[9998] pointer-events-auto"
            >
              <div className="mx-auto max-w-[1280px] px-4 py-1.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.12em] text-cyan-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTimePlaying(false);
                      setCurrentDate('LIVE');
                      setSelectedEpochYear(new Date().getUTCFullYear());
                      setUseDeepTimeEpoch(false);
                    }}
                    className={`timeline-status-link inline-flex items-center gap-1.5 ${currentDate === 'LIVE' ? 'is-live' : 'is-historical'}`}
                  >
                    <span className="time-live-dot" />
                    {currentDate === 'LIVE' ? 'LIVE' : `VIEWING ${formatTimelineDate(effectiveDate)}`}
                  </button>
                  <div className="min-w-0 truncate">{formatTimelineDate(effectiveDate)}</div>
                  <div>{playbackRate === 1 ? 'REAL RATE' : `${playbackRate}X`}</div>
                  <div className="shrink-0">{formatTimelineTime(nowUtc)} UTC</div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTimePlaying(false);
                      setCurrentDate('LIVE');
                      setSelectedEpochYear(new Date().getUTCFullYear());
                    }}
                    className="timeline-mini-link"
                  >
                    NOW
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTimePlaying(false);
                      handleMasterReset();
                      setCurrentDate('LIVE');
                      setSelectedEpochYear(new Date().getUTCFullYear());
                      setUseDeepTimeEpoch(false);
                    }}
                    className="timeline-mini-link"
                  >
                    RESET
                  </button>
                </div>

                <div
                  className="time-track px-1"
                  onWheel={(event) => {
                    event.preventDefault();
                    setIsTimePlaying(true);
                    setPlaybackRate((prev) => {
                      const delta = event.deltaY < 0 ? 1 : -1;
                      const next = Math.max(-20, Math.min(20, prev + delta));
                      return next === 0 ? (delta > 0 ? 1 : -1) : next;
                    });
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setTimelineContextMenu({ x: event.clientX, y: event.clientY });
                  }}
                >
                  <input
                    type="range"
                    className="time-explorer-slider"
                    min={sliderMinMs}
                    max={sliderMaxMs}
                    step={60_000}
                    value={sliderValueMs}
                    onChange={(event) => {
                      setIsTimePlaying(false);
                      setViewingDate(new Date(Number(event.currentTarget.value)));
                    }}
                    aria-label="Time explorer slider"
                  />
                </div>

                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    className="transport-btn"
                    onClick={() => shiftViewingDate(0, -1, 0)}
                    onDoubleClick={() => shiftViewingDate(0, 0, -1)}
                    onMouseDown={() => startHoldScrub(-1, 0, 0, 120)}
                    onMouseUp={stopHoldScrub}
                    onMouseLeave={stopHoldScrub}
                  >
                    ◄◄
                  </button>
                  <button
                    type="button"
                    className="transport-btn"
                    onClick={() => shiftViewingDate(-1, 0, 0)}
                    onMouseDown={() => startHoldScrub(-1, 0, 0, 150)}
                    onMouseUp={stopHoldScrub}
                    onMouseLeave={stopHoldScrub}
                  >
                    ◄
                  </button>
                  <button
                    type="button"
                    className="transport-play"
                    onClick={() => {
                      setIsTimePlaying((prev) => !prev);
                      if (currentDate === 'LIVE') {
                        setViewingDate(new Date());
                      }
                    }}
                  >
                    {isTimePlaying ? '❚❚' : '▶'}
                  </button>
                  <button
                    type="button"
                    className="transport-btn"
                    onClick={() => shiftViewingDate(1, 0, 0)}
                    onMouseDown={() => startHoldScrub(1, 0, 0, 150)}
                    onMouseUp={stopHoldScrub}
                    onMouseLeave={stopHoldScrub}
                  >
                    ►
                  </button>
                  <button
                    type="button"
                    className="transport-btn"
                    onClick={() => shiftViewingDate(0, 1, 0)}
                    onDoubleClick={() => shiftViewingDate(0, 0, 1)}
                    onMouseDown={() => startHoldScrub(1, 0, 0, 120)}
                    onMouseUp={stopHoldScrub}
                    onMouseLeave={stopHoldScrub}
                  >
                    ►►
                  </button>
                </div>

                {timelineContextMenu && (
                  <div
                    className="fixed z-[10020] rounded border border-cyan-500/35 bg-black/90 p-1 min-w-[180px]"
                    style={{ insetInlineStart: timelineContextMenu.x, insetBlockStart: timelineContextMenu.y }}
                  >
                    <button
                      type="button"
                      className="timeline-context-item"
                      onClick={() => {
                        const input = window.prompt('Go to date (UTC ISO format):', effectiveDate.toISOString().slice(0, 10));
                        if (input) {
                          const parsed = new Date(`${input}T00:00:00Z`);
                          if (!Number.isNaN(parsed.getTime())) {
                            setViewingDate(parsed);
                          }
                        }
                        setTimelineContextMenu(null);
                      }}
                    >
                      Go to date...
                    </button>
                    <button
                      type="button"
                      className="timeline-context-item"
                      onClick={() => {
                        shiftViewingDate(0, 0, -1);
                        setTimelineContextMenu(null);
                      }}
                    >
                      Jump back 1 year
                    </button>
                    <button
                      type="button"
                      className="timeline-context-item"
                      onClick={() => {
                        shiftViewingDate(0, 0, 1);
                        setTimelineContextMenu(null);
                      }}
                    >
                      Jump forward 1 year
                    </button>
                    <button
                      type="button"
                      className="timeline-context-item"
                      onClick={() => setTimelineContextMenu(null)}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Scene Discovery Guide — explains every 3D element to any user */}
      {booted && (
        <SceneLegend
          kpIndex={telemetry.kpIndex}
          solarWindSpeed={telemetry.windSpeed}
          flareClass={goesFlux.flareClass}
        />
      )}

      {!booted && retroMode && (
        <SlateErrorBoundary
          moduleName="RetroBoot"
          fallback={null}
        >
          <RetroBoot
            onComplete={() => {
              setBooted(true);
              setViewMode('HELIOCENTRIC');
            }}
          />
        </SlateErrorBoundary>
      )}

      {!booted && !retroMode && (
        <SlateErrorBoundary
          moduleName="NeuralBoot"
          fallback={null}
        >
          <NeuralBoot
            isLoaded={texturesLoaded && telemetry.kp !== undefined}
            onComplete={() => {
              setBooted(true);
              setViewMode('HELIOCENTRIC');
            }}
          />
        </SlateErrorBoundary>
      )}
    </div>
  );
}