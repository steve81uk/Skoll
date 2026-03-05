# Sköll Track — Leading Tool Execution Plan (2026)

This plan converts strategic goals into phased, implementation-ready work for experts, students, and enthusiasts.

## Phase 1 — NASA-Ready Completion (Immediate)

### 1) API Hardening

Scope:
- All external NOAA/DONKI/GOES endpoints in workers and hooks.

Actions:
- Standardize resilient fetch policy (timeout + retry + schema guard + backoff).
- Add endpoint capability flags and graceful degradation banners in HUD.
- Add contract tests for telemetry decoding and fallback behavior.

Acceptance:
- No unhandled promise rejection from any telemetry endpoint.
- Endpoint outage degrades to fallback state without UI crash.
- Typed payload checks prevent malformed data from propagating to UI.

Status:
- ✅ Initial worker hardening utility added (`src/workers/fetchPolicy.ts`) and adopted in `src/workers/noaaWorker.ts`.

### 2) Performance Budget Pass

Scope:
- Vite chunks, worker payload size, frame stability under load.

Actions:
- Define budget: first-load JS <= 650KB gzip for core shell, initial render <= 2.5s on mid-tier hardware.
- Move heavier model paths behind explicit user intent.
- Add frame-time instrumentation around expensive charts and scene effects.

Acceptance:
- Stable 60 FPS target in nominal heliocentric mode.
- No long tasks > 100ms during standard HUD interactions.

### 3) Test Harness Expansion

Scope:
- Physics transforms, telemetry transforms, hazard scoring logic.

Actions:
- Add unit tests for CME arrival estimation, Kessler cascade probability, and index normalization.
- Add fixture-driven tests for NOAA payload compatibility drift.
- Add regression snapshots for Oracle hazard summary contract output.

Acceptance:
- Critical transform modules covered with deterministic tests.
- CI gate blocks regressions in physics/telemetry math.

---

## Phase 2 — Neural Oracle Foundation Model Upgrades

### Surya Integration

Goal:
- Add visual flare precursor signal (0-2h horizon) into hazard summary features.

Implementation:
- Introduce adapter implementing `NeuralOracleProvider` contract.
- Derive normalized flare-risk feature for Oracle prompt context.
- Expose model source + confidence in Oracle metadata.

### JW-Flare Integration

Goal:
- Improve high-magnitude flare event prediction quality and explainability.

Implementation:
- Add multimodal inference adapter and confidence harmonizer.
- Blend with existing local model and rules fallback via weighted ensemble.

Acceptance:
- Oracle responses include model provenance and confidence intervals.
- Fallback chain remains operational when advanced models unavailable.

---

## Phase 3 — Comprehensive Space Weather Model Integration

### MAGE (JHU/APL)
- Use as geospace-response layer for magnetosphere and ionosphere overlays.

### WSA-Enlil
- Use for 1-4 day CME and solar-wind arrival forecast rails.

### OVATION Prime
- Use for short-horizon auroral intensity/footprint forecasting in both expert and public views.

Implementation Pattern:
- Integrate through `SpaceWeatherModelProvider` contracts in `src/services/telemetryProviderContracts.ts`.
- Keep UI bound to `HazardTelemetryModel` and model output adapters, not raw payloads.

Acceptance:
- Model outputs can be enabled/disabled without UI rewrites.
- Provider health and data freshness visible in HUD.

---

## Phase 4 — Education and Public Engagement

### Educational Overlays
- Tiered explanations: Beginner, Student, Forecaster.
- Context cards: "Why this matters" for KP, Bz, CME arrival, aurora footprint.

### Citizen Science Data
- Add Aurorasaurus/AurorEye adapters and confidence blending.
- Show community observations as corroboration layer (with quality scoring).

### Asteroid/Kuiper Extensions
- Expand NEO-focused overlays and alert rails.
- Add timeline stories linking orbital mechanics to public safety relevance.

Acceptance:
- Non-expert users can answer "what does this mean for me?" from UI alone.
- Enthusiasts get location-aware aurora and NEO insight without losing scientific fidelity.

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
