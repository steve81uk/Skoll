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
- [LEADING_TOOL_EXECUTION_PLAN_2026.md](LEADING_TOOL_EXECUTION_PLAN_2026.md)

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

## Environment Setup

Create/update `.env` in the project root:

```dotenv
VITE_NASA_API_KEY=your_nasa_api_key
VITE_NASA_DONKI_API_KEY=your_nasa_api_key_or_dedicated_donki_key
VITE_OPENWEATHER_API_KEY=your_openweather_key
VITE_MAPBOX_TOKEN=your_mapbox_token
```

Create backend env file `.env.backend` from `.env.backend.example`:

```dotenv
HF_API_TOKEN=your_hugging_face_api_token
HF_INFERENCE_MODEL=HuggingFaceH4/zephyr-7b-beta
HF_INFERENCE_API_URL=https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta
HF_PROXY_PORT=3000
HF_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
```

Notes:
- NOAA SWPC endpoints used by the worker are public and do not require API keys.
- DONKI calls now use `VITE_NASA_DONKI_API_KEY` (fallback: `DEMO_KEY`).
- Keep `.env` private and commit only `.env.example`.

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
- Performance chip (FPS/LSTM latency/NOAA age) is fixed at top-right for stable HUD behavior

### Neural Oracle + Data Abstraction

- Added `Neural Oracle` chat panel in the HUD (`Oracle` dock tile)
- Oracle runs in `src/workers/oracleWorker.ts`
	- Dual pipeline:
		- Local lane (WebGPU-capable clients or CPU fallback) returns instant hazard alerts
		- Asynchronous cloud lane calls backend proxy `http://localhost:3000/api/anomaly`
		- Backend proxy forwards to Hugging Face Inference API using backend-only `HF_API_TOKEN`
	- Cloud failures gracefully fall back to local anomaly heuristics
- Added swappable telemetry contract in `src/services/hazardModel.ts`
	- React UI consumes unified `HazardTelemetryModel`
	- Makes it safe to swap NOAA JSON feeds with local inference engines without rewriting HUD components
- LSTM worker now emits optional `kesslerCascade` probabilities used by Oracle and Kessler HUD

### Space Weather Provider Stubs (March 2026 update)

- Added live provider adapters in `src/services/spaceWeatherAdapters.ts`:
	- `OVATION Prime` tactical nowcast stub (L1-first, Kp fallback aware)
	- `WSA-Enlil v3` strategic forecast stub with L1-centric cone-model payload shape
- Added provider polling hook in `src/hooks/useSpaceWeatherProviders.ts`
- HUD now shows live provider health badges in the top command bar:
	- Green: live L1 telemetry drivers
	- Amber: degraded mode (including OVATION Kp fallback, lead time reduced to zero)
	- Red: provider offline / invalid telemetry
- `Aurora OVATION` panel now exposes current driver mode (`L1 LIVE` vs `KP FALLBACK`) and provider detail text

## Neural Oracle Usage

1. Open `Oracle` from the left dock.
2. Ask plain-English questions (e.g., "What is 24h hazard risk?").
3. The panel returns an instant local alert first, then appends cloud anomaly analysis asynchronously.

If WebGPU runtime is unavailable, Oracle uses local CPU heuristics and keeps the cloud anomaly lane.

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
