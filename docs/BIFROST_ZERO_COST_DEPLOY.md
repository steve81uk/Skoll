# Bifrost Zero-Cost Architecture

This project is split for zero-cost hosting:

- Frontend: Vercel (static Vite build)
- Backend: Render Web Service (`server.js`)
- Relay fanout: Make/n8n webhook and optional direct X relay endpoint

## 1. Topology

- Browser -> Vercel static app
- Vercel -> Render for `/api/*` and `/health` (rewrite)
- Render -> external data feeds (NOAA, Open-Meteo, SIDC, LASP)
- Render -> outbound webhook (`SOCIAL_RELAY_WEBHOOK`) and optional X API (`/api/alerts/x-relay`)

## 2. Environment Variable Matrix

### Vercel (Frontend)

Required:

- `VITE_BACKEND_HTTP_BASE=https://<your-render-service>.onrender.com`
- `VITE_BACKEND_WS_URL=wss://<your-render-service>.onrender.com`
- `VITE_NASA_API_KEY=...`
- `VITE_NASA_DONKI_API_KEY=...`

Optional:

- `VITE_OPENWEATHER_API_KEY=...`
- `VITE_MAPBOX_TOKEN=...`
- `VITE_NASA_FIREBALL_PROXY_URL=...`
- `VITE_ENABLE_REMOTE_WMM=false`
- `VITE_ALERT_RELAY_URL=https://<your-render-service>.onrender.com/api/alerts/social-relay`
- `VITE_EPHEMERIS_API_BASE=https://<your-render-service>.onrender.com`
- `VITE_DEBUG_LOGS=false`

### Render (Backend)

Required:

- `PORT=8080`
- `MODEL_PATH=./public/models/skoll-lstm-v1/model.json`

Recommended:

- `FETCH_INTERVAL_MS=60000`
- `LOG_LEVEL=info`
- `NOAA_API=https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json`

Relay and automation:

- `SOCIAL_RELAY_WEBHOOK=https://<make-or-n8n-webhook>`
- `AUTO_RELAY_ENABLED=true|false`

Direct X relay:

- `X_RELAY_ENABLED=true|false`
- `X_BEARER_TOKEN=<x-api-bearer-token>`
- `X_RELAY_DEFAULT_TAGS=#SpaceWeather #SkollTrack`

## 3. X Relay Endpoints (Backend)

- `POST /api/alerts/x-relay`
  - Accepts standard relay payload or `{ "text": "..." }`
  - Publishes to X via `POST https://api.x.com/2/tweets`

- `POST /api/alerts/x-relay/test`
  - Generates a synthetic telemetry packet from latest backend reading
  - Useful for post-deploy smoke test

## 4. Edge Binding Checklist

1. Deploy Render using `render.yaml`.
2. Deploy Vercel using `vercel.json`.
3. Replace `https://your-render-backend.onrender.com` in `vercel.json`.
4. Set Vercel env vars (`VITE_BACKEND_HTTP_BASE`, `VITE_BACKEND_WS_URL`, keys).
5. Set Render env vars (`MODEL_PATH`, relay/X settings).
6. Validate health:
   - `GET https://<render>/health`
   - `GET https://<vercel>/health` (rewrite pass-through)

## 5. Live Webhook Transmission Test

Relay webhook test:

```bash
curl -X POST "https://<render>/api/alerts/social-relay" \
  -H "Content-Type: application/json" \
  -d '{"source":"skoll-track","timestamp":"2026-03-10T00:00:00.000Z","alerts":[{"id":"test","severity":"warning","message":"Relay smoke test","ts":1760000000000,"value":6.2}]}'
```

Direct X relay test:

```bash
curl -X POST "https://<render>/api/alerts/x-relay/test" \
  -H "Content-Type: application/json" \
  -d '{"message":"Bifrost edge webhook transmission test"}'
```

Expected response shape:

- `{ "ok": true, "posted": true, ... }`

## 6. Cost Notes

- Vercel Hobby + Render free web service is zero-cost baseline.
- Render free tier can cold-start; expect first-request latency after idle.
- Keep polling intervals moderate (`FETCH_INTERVAL_MS`) to stay within free quotas.
