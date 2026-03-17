# Sköll Track

Sköll Track is a React + TypeScript + Three.js mission-control space weather and orbital simulation platform. It combines real-time heliophysics telemetry, physically-inspired 3D orbital rendering, deep-time geological navigation, and an AI neural oracle into a cinematic operations-room experience.

## Mission Scope

Core pillars:

- Keplerian orbital mechanics with JPL Horizons high-precision fallback
- Real-time NOAA/DONKI/GOES space weather telemetry with multi-model forecasting
- Full solar system 3D scene with surface zoom, magnetosphere, CME propagation
- Neural Oracle AI hazard interpretation (WebGPU → CPU → HuggingFace cloud)
- Deep geological/historical time navigation (4.6 Ga → present)
- Social relay + snapshot sharing for alert broadcast

Reference project notes:

- [ORBITAL_ACCURACY.md](ORBITAL_ACCURACY.md)
- [VISUAL_ENHANCEMENTS.md](VISUAL_ENHANCEMENTS.md)
- [LEADING_TOOL_EXECUTION_PLAN_2026.md](LEADING_TOOL_EXECUTION_PLAN_2026.md)
- [EPHEMERIS_FUSION_GUIDE.md](EPHEMERIS_FUSION_GUIDE.md)
- [docs/BIFROST_ZERO_COST_DEPLOY.md](docs/BIFROST_ZERO_COST_DEPLOY.md)
- [docs/SOCIAL_AUTOMATION.md](docs/SOCIAL_AUTOMATION.md)

## Tech Stack

- React 19 + TypeScript 5
- Vite 8 (build) + Vitest (unit tests)
- Three.js r183 + @react-three/fiber v9 + @react-three/drei + @react-three/postprocessing
- Recharts for telemetry and forecast charts
- xterm.js for runtime terminal log HUD
- TensorFlow.js off-thread LSTM (web worker)
- @xenova/transformers for Oracle NLP (WebGPU → CPU fallback)
- framer-motion for UI animation
- GSAP for camera tweens
- Hugging Face Inference API cloud lane (via backend proxy)

## Run Locally

```bash
npm install
npm run dev
```

Backend proxy (for HuggingFace Oracle lane + social relay):

```bash
node server.js
```

## Environment Setup

```dotenv
# .env (Vite frontend)
VITE_NASA_API_KEY=your_nasa_api_key
VITE_NASA_DONKI_API_KEY=your_nasa_api_key_or_dedicated_donki_key
VITE_OPENWEATHER_API_KEY=your_openweather_key
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_BACKEND_HTTP_BASE=http://localhost:8080
VITE_BACKEND_WS_URL=ws://localhost:8080
VITE_EPHEMERIS_API_BASE=http://localhost:8080
VITE_DEBUG_LOGS=false
```

```dotenv
# .env.backend
HF_API_TOKEN=your_hugging_face_api_token
HF_INFERENCE_MODEL=HuggingFaceH4/zephyr-7b-beta
HF_PROXY_PORT=3000
HF_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
```

Notes:
- NOAA SWPC endpoints are public and do not require API keys.
- DONKI uses `VITE_NASA_DONKI_API_KEY`; fallback is `DEMO_KEY`.
- Keep `.env` private; commit only `.env.example` and `.env.backend.example`.

## Quality Gates

```bash
npm run lint
npm run build
npm run test:run
```

---

## Implemented Features (March 2026)

Testing & Architecture
Test suite (npm run test:run) covers the three most critical logic paths:

Alert engine — storm severity tiers (G1 warning, G3+ critical) and cooldown deduplication (src/services/alertEngine.test.ts)
Space weather schemas — NOAA payload drift guards (src/workers/noaaSchemas.test.ts)
Forecast math — Kessler cascade risk model and CME arrival physics (src/ml/forecastMath.test.ts)
Dock architecture — all panel open/close state, keyboard shortcuts (keys 1–6), and command palette logic live in src/hooks/useDockSystem.ts. App.tsx calls const dock = useDockSystem(...) and reads via dock. namespace.

### 3D Scene Layer Stack

| Layer | Component | Notes |
|---|---|---|
| 15 000-star field + 3 000 nebula particles | `EnhancedStarfield` | Shader-based temperature color, twinkling |
| Local Interstellar Cloud warm shell | `LocalInterstellarCloud` | Envelopes the heliosphere |
| Heliosphere boundary (user-toggled) | `HeliopauseShell` | Log-depth GLSL shell |
| Oort Cloud | `OortCloud` | Procedural halo at artistic 4–7k units |
| Kuiper Belt | `KuiperBelt` | Particle ring beyond Neptune |
| Asteroid Belt | `AsteroidBelt` | Mars–Jupiter gap with Kirkwood distribution |
| Sagittarius A\* (galactic core) | `SagittariusA` | Deep-sky directional light + accretion disc |
| 8 planets + moons, trails, auroras | `PlanetRenderer` | Full Keplerian positions, temporal smoothing |
| Dynamic Sun with corona + flare particles | `DynamicSun` + `SolarFlareParticles` | Activity-driven morphology |
| Earth day/night shader | `EarthMaterial` (inline GLSL) | Sun-direction terminator blend |
| Earth cloud shell | `EarthCloudLayer` | Distance-LOD fade, polygonOffset |
| Earth live weather overlays | `EarthWeatherLayers` + `EarthWindStreamlines` | OWM precipitation/snow/wind/streamlines |
| Earth bow shock | `EarthBowShock` | Dynamic standoff radius |
| Earth magnetosphere + tail | `MagneticTailVisualizer` | 12-stream plasma particles |
| Magnetic axis visualizer | `MagneticAxisVisualizer` | WMM-derived pole position |
| CME propagation | `CMEPropagationVisualizer` | Lazy-loaded shock-wave particle burst |
| ISS live 3D position | `LiveISS` | TLE orbit integration |
| Atmospheric glow halos | `AtmosphericGlow` | Fresnel-based, planet atmosphere types |
| Orbital trails | `OrbitalTrail` | Dashed paths, inner cyan / outer purple |
| Kessler threat field | `KesslerThreatNet` | Probabilistic debris shell |
| Surface DEM terrain | `SurfaceDEMTerrain` | Camera floor-collision |
| Earth cutaway explorer | `EarthCutawayExplorer` | Crust/mantle/outer/inner core slices |
| Earth core dynamo | `EarthCoreDynamo` | Field reversal animation |
| Cinematic post-processing | `CinematicPostFX` | Bloom, vignette, chromatic aberration |

### Historical & Geological Events

| Feature | Component |
|---|---|
| Carrington 1859 CME simulation | `CarringtonSim` |
| Chicxulub impact event | `ChicxulubEvent` |
| Apophis 2029 close-approach tracker | `ApophisTracker` |
| Deep time slicer (4.6 Ga → present) | `DeepTimeSlicer` |
| Earth geological story timeline | `EarthStoryTimelinePanel` |
| Global geological time navigator | `GeologicalTimeNavigator` |

### Space Weather Telemetry & Analytics

| Feature | Component / Service |
|---|---|
| NOAA SWPC live feed (worker) | `noaaWorker.ts` + schema validation |
| DONKI CME/flare event feed | `useNOAADONKI` |
| GOES X-ray flux | `useGOESFlux` + `GOESFluxChart` |
| LSTM Kp 24h neural prediction (worker) | `lstmWorker.ts` + `useLSTMWorker` + `LSTMPredictiveGraph` |
| Kessler cascade probability (worker) | `kesslerWorker.ts` + `useKesslerWorker` |
| Multi-hazard alert engine | `alertEngine.ts` |
| Unified hazard telemetry model | `hazardModel.ts` |
| OVATION Prime aurora nowcast stub | `spaceWeatherAdapters.ts` |
| WSA-Enlil CME arrival forecast stub | `spaceWeatherAdapters.ts` |
| Provider health badges (L1 LIVE / KP FALLBACK / OFFLINE) | `useSpaceWeatherProviders` |
| AurorEye citizen science timeline sync | `aurorEyeSync.ts` + `useAurorEyeTimelineSync` |
| SuperMAG magnetometer network panel | `SuperMAGPanel` |
| Aurora OVATION HUD | `AuroraOvationHUD` |
| Aurora atmosphere column | `AtmosphereColumnPanel` |
| D-RAP radio absorption graph | `DRAPAbsorptionGraph` |
| GOES flux chart | `GOESFluxChart` |
| GIC risk map | `GICRiskMap` |
| GPS accuracy degradation map | `GPSAccuracyMap` |
| HF radio blackout heatmap + map | `RadioBlackoutHeatmap` + `RadioBlackoutMap` |
| Forecast radar slate (WSA-Enlil) | `ForecastRadarSlate` |
| Forecasting slicer panel | `ForecastingSlicerPanel` |
| KP forecast matrix (27-day) | `KpForecastMatrix` |
| NOAA feed HUD | `NOAAFeedHUD` |
| Kessler telemetry chip | `KesslerTelemetryChip` |
| Kessler net stats overlay | `KesslerNet` |
| Grid failure cascade simulator | `GridFailureSim` |
| Solar threat simulator | `SolarThreatSimulator` |
| Solar wind scatter chart | `SolarWindScatter` |
| Progression timeline graph | `ProgressionGraph` |
| Data Alchemist fusion dashboard | `DataAlchemistDashboard` |
| Graph mission hub (all charts) | `GraphMissionHub` |
| Fireball / bolide tracker (NASA CNEOS) | `FireballTrackerSlate` |
| Deep Space Network live link | `DSNLiveLink` |
| ISS camera stream embed | `ISSCameraStream` |

### AI & Neural Layer

| Feature | File |
|---|---|
| Neural Oracle chat (WebGPU/CPU/cloud) | `OracleModule.tsx` + `oracleWorker.ts` |
| NLP Oracle hook | `useNeuralOracle.ts` + `useNLPOracle.ts` |
| LSTM Kp predictor | `lstmWorker.ts` |
| Anomaly detection hook | `useAnomalyDetection.ts` |
| Predictive engine (threat scoring) | `ml/PredictiveEngine.ts` |
| ExoPhysics (system constants + exo-telemetry) | `ml/ExoPhysics.ts` |
| Magnetic field overdrive (orbital distortion) | `ml/MagneticFieldOverdrive.ts` |
| LSTM training script (Python) | `ml/train_skoll_v1.py` |

### Earth Surface Mode

| Feature | Component |
|---|---|
| Surface DEM terrain with camera floor | `SurfaceDEMTerrain` |
| Live weather now panel | `EarthWeatherNow` |
| Weather layer controls | `WeatherLayerControls` |
| Magnetic global grid (WMM-2025) | `GlobalMagneticGrid` |
| Location switcher preset | `LocationSwitcher` |
| Surface atmosphere shader | `SurfaceAtmosphereShader` |
| Altitude display | Connected to `SurfaceCameraController` |

### Human Impact & Climate

| Feature | Component |
|---|---|
| Human impact slate (civilisation risk) | `HumanImpactSlate` |
| Carbon / climate link panel | `CarbonClimateLink` |
| Emissions impact chart | `EmissionsImpact` |
| Ocean climate panel | `OceanClimatePanel` |
| Planet diagnostics slate | `PlanetDiagnosticsSlate` |

### Orbital Mechanics & Ephemeris

| Feature | File |
|---|---|
| Full Keplerian solver (J2000 elements) | `ml/OrbitalMechanics.ts` |
| Satellite orbital tracker | `SatelliteOrbitalTracker.tsx` |
| Satellite threat slate | `SatelliteThreatSlate.tsx` |
| Satellite hangar | `HangarModule.tsx` |
| Trajectory forecast panel (CSV/NDJSON export) | `TrajectoryForecastPanel.tsx` |
| JPL Horizons proxy endpoint | `server.js /api/ephemeris/horizons` |
| Ephemeris JSONL archive | `server.js /api/ephemeris/archive` |
| Magnetic drift hook (WMM + GUFM1 + PALEOMAG) | `useMagneticDrift.ts` |
| Orbital drift hook | `useOrbitalDrift.ts` |
| WMM-2025 magnetic declination service | `WMMService.ts` |

### UX & HUD Systems

| Feature | Notes |
|---|---|
| Keyboard shortcuts: `1–6` / `Shift+1–6` / `Esc` / `F` / `U` / `?` / `1–9` planet jump | `App.tsx` keydown handler |
| Camera tracking mode: lock/free/re-lock | `CameraTracker.tsx` + manual override detection |
| Track / Free Cam status badge in command bar | Emerald vs cyan styling |
| Dock panel system (left + right rail, pin mode) | `App.tsx` dock state |
| Adaptive DPR with throttle + jitter filtering | `nudgeAdaptiveDpr` callback |
| Lite / Eco / Retro render modes | `liteMode` / `ecoMode` / `retroMode` state |
| NeuralBoot loading screen | `NeuralBoot.tsx` |
| RetroBoot loading screen (retro mode) | `RetroBoot.tsx` |
| Snapshot URL share + canvas screenshot | `snapshotService.ts` |
| Alert toast stack | `alertEngine.ts` + `toasts` state |
| Alert log panel | `AlertLogPanel.tsx` |
| Social relay (alert broadcast to webhook / X) | `socialRelay.ts` + `server.js` |
| Solar audio sonification (Web Audio API) | `useSolarSonification.ts` |
| Ambient audio atmosphere drone | `audioAtmosphere.ts` |
| Terminal log HUD (xterm.js) | `TerminalLogHUD.tsx` |
| Live sync badge | `LiveSyncBadge.tsx` |
| NLP Oracle tooltip context | `CosmicTooltip.tsx` + `TooltipContext.tsx` |
| Glossary panel | `GlossaryPanel.tsx` |
| Methodology popover | `MethodologyPopover.tsx` |
| Source badge | `SourceBadge.tsx` |
| Health / performance dashboard | `HealthDashboard.tsx` |
| Telemetry ribbon (top HUD) | `TelemetryRibbon.tsx` |
| Landing slate | `LandingSlate.tsx` |
| Magnetic reversal alert | `MagneticReversalAlert.tsx` |
| NOAA provider feed indicators | `NOAAFeedHUD.tsx` |

---

## Neural Oracle Usage

1. Open `Oracle` from the left dock.
2. Ask plain-English questions such as `"What is the 24h hazard risk?"`.
3. The panel returns an instant local alert first, then appends the cloud anomaly analysis.

If WebGPU is unavailable, Oracle uses CPU heuristics and keeps the HuggingFace cloud lane live.

## Extending the Oracle with a Local LLM

1. Keep UI bound to `HazardTelemetryModel` only (`src/services/hazardModel.ts`).
2. Replace worker prompt/model logic in `src/workers/oracleWorker.ts`.
3. Preserve message contract (`INIT`, `ASK` → `READY`, `REPLY`, `ERROR`).
4. No UI rewrite required.

---

## Renderer Architecture and Performance Notes

### Why Three.js / R3F (not Babylon.js or PlayCanvas)

Sköll Track uses Three.js r183 via React-Three-Fiber. A codebase migration to Babylon.js or PlayCanvas is not warranted — it would require a full rewrite of 80+ components. Three.js is fully capable of smooth 60 fps at this scene complexity. The correct approach is disciplined use of Three.js performance primitives:

| Technique | Where applied |
|---|---|
| GPU `powerPreference: 'high-performance'` | Canvas `gl` props |
| `stencil: false` | Canvas `gl` props (saves memory bandwidth) |
| Adaptive DPR (0.9–1.5, throttled 800ms) | `PerformanceMonitor` + `nudgeAdaptiveDpr` |
| `PCFSoftShadowMap` (softer, fewer artifacts) | `gl.shadowMap.type` |
| Shadow map on-demand (`autoUpdate=false`) | `onCreated` callback |
| `antialiasing` on in all non-eco modes | Canvas `gl` props |
| `logarithmicDepthBuffer` for depth precision | Canvas `gl` props |
| Star/nebula frame throttle (every 3 frames) | `EnhancedStarfield.tsx` |
| Transparent layer depth discipline | `alphaTest`, `polygonOffset`, `renderOrder` |
| Distance-LOD fade on clouds, weather, aurora | `THREE.MathUtils.smoothstep` |
| Exponential position interpolation on orbits | `PlanetRenderer.tsx` per-frame lerp |
| `matrixAutoUpdate = false` on static shells | `HeliopauseShell`, `OortCloud`, `KuiperBelt` |
| Camera clip plane adapts to Earth zoom | `EarthZoomLadderController` |

### Deck.gl

Not suitable. Deck.gl is optimised for geospatial 2D/3D layer rendering over map projections, not heliocentric space simulation.

### Future Render Upgrades

- **Instanced mesh** for individual asteroidal/cometary objects (draw call reduction).
- **OffscreenCanvas + worker** for static background render (starfield, OortCloud).
- **WebGPU backend** (`THREE.WebGPURenderer`) once Three.js WebGPU lands stable.
- **Temporal anti-aliasing** (TAA) via postprocessing for jitter-free high detail.
- **WASM physics** for high-frequency orbital integration (replacing JS Kepler solver).

---

## Self-Healing and Operational Resilience

### Automatic Fallback Chain

| Condition | Behaviour |
|---|---|
| NOAA endpoint down | `fetchPolicy.ts` retries (3×, exponential back-off), then serves last cached bundle |
| HuggingFace API fails | Oracle cloud lane errors gracefully; local heuristics answer immediately |
| WebGPU not available | Transformers.js falls back to CPU WASM runtime |
| LSTM worker crash | `useKesslerWorker` returns last good forecast; UI shows STALE badge |
| NASA API key missing | `PredictiveEngine.validateTelemetryMode()` returns `'simulated'`; banner shown |
| Texture load failure | `SlateErrorBoundary` catches per-component and renders fallback |
| Canvas / WebGL context lost | `ErrorBoundary` at scene root shows black fill rather than blank crash |

### Manual Recovery

- **Master Reset** button in command bar: clears all active simulations.
- **Re-lock Camera** (F key): restores planet tracking if free-cam is disorienting.
- **Lite Mode** (command bar): reduces DPR, disables shadows and heavy particles.
- **Eco Mode**: further reduces rendering to 0.6–1.0 DPR, disables sound.
- **Retro Mode**: pixel-art shader, 0.125 DPR, dramatically reduces GPU load.
- If the build fails: run `npm run lint` first; TypeScript type errors appear before Vite errors.

### Adding New Telemetry Sources

1. Implement `SpaceWeatherModelProvider` contract in `src/services/telemetryProviderContracts.ts`.
2. Write adapter in `src/services/spaceWeatherAdapters.ts`.
3. Register in `useSpaceWeatherProviders.ts`.
4. Bind to `HazardTelemetryModel` — no HUD rewrites needed.

---

## Cockpit Keyboard Reference

| Key | Action |
|---|---|
| `1–6` | Toggle left dock panel |
| `Shift+1–6` | Toggle right dock panel |
| `Esc` | Close active modals/overlays |
| `F` | Re-lock camera to tracked planet |
| `U` | Unlock to free-cam |
| `?` | Open keyboard shortcut help overlay |
| `1–9` (numpad) | Jump to Solar System body (1=Mercury … 8=Neptune, 9=ISS) |
| `Home` | Return to overview from anywhere |
| `R` (held) | Reset camera to heliocentric default |

---

## Ideas for Next Phase

- **Number-key planet navigation** — jump directly to body; already keyboard-bound, needs focus animation.
- **Auto-free-cam at extreme zoom** — if orbit distance > 3M units while tracking, auto-unlock.
- **Highlight tracked body** — emissive boost / outline pass on selected planet.
- **Double-click = auto-recenter** — smooth recentering without changing track state.
- **Auto-toast on mode flip** — brief notification when camera mode changes.
- **localStorage camera mode persistence** — restore free/track state on refresh.
- **Surya flare-precursor signal** — Phase 2 Oracle model upgrade.
- **MAGE geospace-response overlay** — Phase 3 magnetosphere mesh from JHU/APL data.
- **Tiered educational overlays** — Beginner/Student/Forecaster context cards.
- **GNSS TEC ionosonde adapter** — quantify regional comms degradation probability.
- **Nightly Horizons batch harvest** — append JSONL archive automatically.
- **TAA post-processing** — eliminate sub-pixel shimmer completely.

---

## Deployment

See [docs/BIFROST_ZERO_COST_DEPLOY.md](docs/BIFROST_ZERO_COST_DEPLOY.md) for zero-cost Vercel + Render split-host deployment.

See [docs/SOCIAL_AUTOMATION.md](docs/SOCIAL_AUTOMATION.md) for X.com / webhook social relay setup.

---

## NASA-Ready Checklist

- [x] Build reproducibility (`tsc -b && vite build` → EXIT 0)
- [x] Source docs aligned with full implemented scope
- [x] All major visual systems documented
- [x] Orbital mechanics accuracy documented
- [x] API hardening pass (`fetchPolicy.ts` in all workers)
- [x] Adaptive performance system (DPR, Lite, Eco, Retro modes)
- [x] Shadow + depth precision tuning
- [ ] Test harness expansion (unit coverage for physics transforms)
- [ ] Performance budget CI gate (chunk size / LCP)
- [ ] WebGPU renderer migration path validated

## License / Use

Internal/project-specific use unless otherwise specified.
