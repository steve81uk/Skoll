# Sköll Track

Sköll Track is a React + TypeScript + Three.js mission-control style space weather and orbital simulation platform.

It combines:

- Real-time and simulated heliophysics telemetry (NOAA / DONKI patterns)
- Physically-inspired orbital rendering and historical timeline navigation
- Interactive 3D scene layers (planetary systems, magnetosphere, CME effects)
- Analytical dashboards and forecasting panels for space weather risk interpretation

## Mission Scope

The platform targets a high-fidelity "operations room" experience that is both scientifically grounded and visually cinematic.

Core pillars:

- Orbital and timeline accuracy
- Space weather impact modelling
- Modular HUD and slate architecture
- Production-grade performance for modern browsers

Reference project notes:

- [ORBITAL_ACCURACY.md](ORBITAL_ACCURACY.md)
- [VISUAL_ENHANCEMENTS.md](VISUAL_ENHANCEMENTS.md)

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Three.js + @react-three/fiber + @react-three/drei
- Recharts for telemetry and forecast visualisation
- xterm.js for runtime log HUD

## Run Locally

```bash
npm install
npm run dev
```

## Quality Gates

```bash
npm run lint
npm run build
```

## Current Status (March 2026)

### New Cockpit Controls (March 2026 update)

- `1`–`6`: Toggle left dock modals
- `Shift + 1`–`Shift + 6`: Toggle right dock modals
- `Esc`: Close active HUD modals and command overlays
- Dock icons include live status dots (`green` / `amber` / `red`)
- Performance chip (FPS/LSTM latency/NOAA age) is draggable and persists position

### Neural Oracle + Data Abstraction

- Added `Neural Oracle` chat panel in the HUD (`Oracle` dock tile)
- Oracle runs in `src/workers/oracleWorker.ts`
	- Tries Transformers.js (`@xenova/transformers`) with WebGPU
	- Falls back to deterministic rule-based hazard narration if model/backend unavailable
- Added swappable telemetry contract in `src/services/hazardModel.ts`
	- React UI consumes unified `HazardTelemetryModel`
	- Makes it safe to swap NOAA JSON feeds with local inference engines without rewriting HUD components
- LSTM worker now emits optional `kesslerCascade` probabilities used by Oracle and Kessler HUD

## Neural Oracle Usage

1. Open `Oracle` from the left dock.
2. Ask plain-English questions (e.g., "What is 24h hazard risk?").
3. The panel responds using live KP/Bz/wind/flare + Kessler cascade context.

If WebGPU model init is unavailable on the client, Oracle continues with fallback logic.

## Extending with Local WebGPU LLM

1. Keep UI bound to `HazardTelemetryModel` only.
2. Replace worker prompt/model logic in `src/workers/oracleWorker.ts`.
3. Preserve message contract (`INIT`, `ASK` → `READY`, `REPLY`, `ERROR`).
4. Add model/provider metadata to HUD if needed; no UI rewrite required.

## Professional Delivery Checklist

- Keep each feature in its own commit (controls, data contracts, Oracle, docs)
- Include a short changelog entry and migration notes for model/provider changes
- Run `npm run lint` and `npm run build` before every push
- Update README + domain docs whenever worker contracts or HUD controls change

### On Track

- Production build is successful (`tsc -b && vite build`)
- Orbital scaling and historical timeline mechanics are implemented
- Visual upgrade systems are integrated (enhanced starfield, atmospheric glow, dynamic sun, plasma effects)
- Dashboard architecture is modular and extensible

### Risks / Cleanup Priorities

- Lint rule profile needed alignment with R3F-heavy rendering patterns (configured in `eslint.config.js`)
- Project README was previously template placeholder and is now corrected
- Some documented future enhancements remain backlog items by design (asteroid/kuiper extensions, additional educational overlays)

## NASA-Ready Checklist (Project Standard)

- [x] Build reproducibility
- [x] Source docs aligned with implemented scope
- [x] Major visual systems documented
- [x] Orbital scaling and event timeline intent documented
- [ ] Final API hardening pass for all external feeds
- [ ] Performance budget pass on chunk sizes/code splitting
- [ ] Test harness expansion for critical physics and telemetry transforms

## License / Use

Internal/project-specific use unless otherwise specified.
