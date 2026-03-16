# Sköll Track — Leading Tool Execution Plan (2026)

This plan converts strategic goals into phased, implementation-ready work for experts, students, and enthusiasts.

## Phase 1 — NASA-Ready Completion ✅ Complete

### 1) API Hardening ✅

- Standardised resilient fetch policy implemented (`src/workers/fetchPolicy.ts`).
- Adopted in `noaaWorker.ts` and all DONKI/GOES hooks.
- Schema validation guards in `noaaSchemas.ts`.
- Endpoint outage degrades to fallback state (cached bundle + STALE badge) without UI crash.

### 2) Performance Budget Pass ✅

- Adaptive DPR system (0.9–1.5 cap, throttled 800ms, jitter 0.012 threshold).
- `PCFSoftShadowMap` with `autoUpdate = false`; recomputed on-demand.
- Star/nebula `useFrame` throttle (every 3 frames for shader animation).
- `matrixAutoUpdate = false` on static scene shells.
- Distance-LOD fade on all transparent Earth overlays.
- Exponential temporal interpolation on all planetary/moon orbital positions.
- `powerPreference: 'high-performance'` + `stencil: false` WebGL context hints.

### 3) Test Harness Expansion 🔶 Partial

- `forecastMath.test.ts`: Kp forecast math covered.
- `noaaSchemas.test.ts`: NOAA payload schema guards tested.
- `spaceWeatherAdapters.test.ts`: OVATION/WSA-Enlil adapter health logic tested.
- Remaining gaps: CME arrival estimation, Kessler cascade probability, Oracle contract regression.

---

## Phase 2 — Neural Oracle Foundation Model Upgrades 🔶 In Progress

### Oracle NLP Pipeline ✅

- Three-lane Oracle pipeline operational: local heuristics → Transformers.js → HuggingFace cloud proxy.
- Unified `HazardTelemetryModel` contract insulates HUD from provider changes.
- `nlpOracleWorker.ts` handles NLP parse; `oracleWorker.ts` handles fast local path.

### Surya Flare-Precursor Integration 🔲 Backlog

- Adapter implementing `NeuralOracleProvider` contract not yet written.
- Normalised flare-risk feature not yet exposed in Oracle prompt context.

### JW-Flare Integration 🔲 Backlog

- Multimodal inference adapter not yet written.
- Confidence harmoniser not yet integrated.

---

## Phase 3 — Comprehensive Space Weather Model Integration 🔶 Stub Phase

### WSA-Enlil ✅ Stub Live

- Strategic forecast stub functional in `spaceWeatherAdapters.ts`.
- Provider health badge visible in command bar.
- Full payload integration (actual solar-wind arrival ETA) is Phase 3 work.

### OVATION Prime ✅ Stub Live

- Tactical nowcast stub functional with L1-first, Kp fallback.
- HUD shows `L1 LIVE` vs `KP FALLBACK` driver mode.
- Full auroral footprint boundary polygon integration is Phase 3 work.

### MAGE — JHU/APL Geospace Response 🔲 Backlog

- Contract stub in `telemetryProviderContracts.ts`.
- No adapter or overlay mesh yet.

### AurorEye Citizen Science ✅

- `aurorEyeSync.ts` + `useAurorEyeTimelineSync.ts` operational.
- Normalised AurorEye frames aligned to telemetry timeline.

---

## Phase 4 — Education and Public Engagement 🔲 Planned

### Educational Overlays 🔲

- Tiered explanations (Beginner/Student/Forecaster) not yet built.
- `GlossaryPanel.tsx` exists as a foundation.

### Citizen Science Data 🔲

- AurorEye adapter live (see Phase 3).
- AuroraSaurus adapter not started.

### Asteroid/Kuiper Extensions 🔶 Partial

- `AsteroidBelt.tsx` and `KuiperBelt.tsx` rendered as particle systems. ✅
- `ApophisTracker.tsx` with 2029 orbital close-approach. ✅
- Individual asteroid hover/click and NEO alert rail: backlog.

---

## Phase 5 — UX Maturity 🔶 In Progress (March 2026)

### Camera Control System ✅

- Click planet → smooth GSAP camera focus.
- Manual OrbitControls interaction → free-cam override.
- `F` key → re-lock; `U` key → unlock.
- Track/Free Cam status badge in command bar.

### Keyboard Shortcut System ✅ Partial

- `1–6` / `Shift+1–6` / `Esc` / `F` / `U` operational.
- Number-key planet jump (1–9) → planned.
- Shortcut help overlay (`?` key) → planned.

### Snapshot Share ✅

- URL-encoded snapshot state (`snapshotService.ts`).
- Canvas screenshot capture.

### Social Relay ✅

- Alert broadcast to Make.com / n8n webhook.
- Direct X.com relay endpoint (`/api/alerts/x-relay`).
- Backend headless auto-relay mode.

### Audio Sonification ✅

- `useSolarSonification.ts`: full Web Audio API signal chain.
- `audioAtmosphere.ts`: ambient drone layer connected to audio toggle.

---

## Upcoming Priorities (March 2026 → Q2 2026)

1. **Number-key planet jump** — bind 1–9 to focus Solar System bodies.
2. **Keyboard shortcut help overlay** — `?` key shows all bindings.
3. **Auto-unlock at extreme zoom** — free-cam when orbit distance > 3 M units.
4. **Auto-toast on mode flip** — notify user when tracking state changes.
5. **TAA post-process** — eliminate residual sub-pixel shimmer.
6. **Instanced asteroid mesh** — enable hover/click on individual belt objects.
7. **Surya / JW-Flare Oracle adapters** — Phase 2 model upgrades.
8. **MAGE geospace-response overlay** — Phase 3 magnetosphere data integration.
9. **Tiered educational overlays** — Beginner/Student/Forecaster context cards.
10. **Test harness expansion** — CI gate on physics/telemetry math regressions.

---

## Suggested Near-Term Sprint Breakdown (3 Sprints)

Sprint A (hardening + tests)
- Complete fetch hardening adoption across all telemetry callers.
- Add deterministic unit tests for transform/math-critical modules.

Sprint B (oracle adapters)
- Implement provider registry and first external-model adapter stubs.
- Add confidence/provenance display in Oracle panel.

Sprint C (model + public overlays)
- Land OVATION-first model adapter and educational explanation layer.
- Add citizen-observation ingestion proof-of-concept.

---

## Engineering Rule for Future Work

All new providers (AI or telemetry) must integrate through typed provider contracts and feed normalized models before touching React UI components.
