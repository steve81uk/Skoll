/**
 * SKÖLL-TRACK GEN-2 — GLOBAL TELEMETRY HOOK
 * Single entry gate for all live space-weather data.
 * Falls back to LSTM-simulated forecast state when live APIs are unreachable.
 *
 * Data sources:
 *   NOAA – Planetary K-Index (1-min)       → services.swpc.noaa.gov
 *   NOAA – Real-Time Solar Wind (plasma)   → services.swpc.noaa.gov
 *   NASA – CNEOS Fireball counts           → ssd-api.jpl.nasa.gov
 *
 * Env vars (Vite):
 *   VITE_NASA_API_KEY   – NASA api.nasa.gov key (optional; passed to fireball endpoint)
 *   VITE_NOAA_API_KEY   – NOAA key for future authenticated endpoints
 *
 * @author steve81uk (Systems Architect)
 * @cite 2025-12-11, 2026-02-24
 */

import { useState, useEffect, useRef } from 'react';
import { calculateExoTelemetry } from '../ml/ExoPhysics';

// ─── Env ──────────────────────────────────────────────────────────────────────
const NASA_KEY: string | undefined = import.meta.env.VITE_NASA_API_KEY;
const NASA_FIREBALL_PROXY_URL: string | undefined = import.meta.env.VITE_NASA_FIREBALL_PROXY_URL;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NOAA_KEY: string | undefined = import.meta.env.VITE_NOAA_API_KEY; // reserved for authenticated NOAA endpoints
void NOAA_KEY;

// ─── API Endpoints ────────────────────────────────────────────────────────────
const NOAA_KP_URL =
  'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';

const NOAA_WIND_URL =
  'https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json';

// CNEOS fireball API accepts an optional api_key param when routed via the NASA gateway
const NASA_FIREBALL_URL = NASA_FIREBALL_PROXY_URL
  ? NASA_FIREBALL_PROXY_URL
  : NASA_KEY
    ? `https://ssd-api.jpl.nasa.gov/fireball.api?api_key=${NASA_KEY}`
    : 'https://ssd-api.jpl.nasa.gov/fireball.api';

let fireballFetchDisabled = false;
let fireballWarned = false;

// ─── LSTM Fallback Forecast State ─────────────────────────────────────────────
// Pre-computed simulated snapshots [kp, windSpeed (km/s), fireballCount].
// Cycles deterministically so the UI always has plausible values when offline.
const LSTM_FALLBACK: ReadonlyArray<[number, number, number]> = [
  [2.3, 412, 4],
  [2.7, 435, 3],
  [3.1, 467, 6],
  [2.5, 421, 5],
  [4.2, 510, 7],
  [3.8, 488, 5],
  [5.0, 556, 9],
  [3.3, 444, 4],
  [2.1, 398, 3],
  [1.7, 380, 2],
];

// ─── Types ────────────────────────────────────────────────────────────────────
export type ThreatLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface GlobalTelemetry {
  /** Planetary K-Index (0–9); undefined until the first fetch resolves — gates NeuralBoot */
  kp: number | undefined;
  /** Non-optional alias for slate components that require a numeric Kp */
  kpIndex: number;
  /** Normalized aurora energy scalar used by shaders (0.15–1.0) */
  currentIntensity: number;
  /** Solar wind bulk speed in km/s */
  windSpeed: number;
  /** Running total fireballs logged by CNEOS */
  fireballCount: number;
  /** Earth-local auroral expansion latitude in degrees */
  expansionLatitude: number;
  /** Earth-local magnetopause standoff distance in Re */
  standoffDistance: number;
  /** Derived threat classification from KP */
  threatLevel: ThreatLevel;
  /** Whether values are from live APIs or the LSTM fallback */
  source: 'live' | 'lstm-fallback';
  /** Timestamp of the last successful update */
  lastUpdated: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function kpToThreat(kp: number): ThreatLevel {
  if (kp >= 8) return 'CRITICAL';
  if (kp >= 6) return 'HIGH';
  if (kp >= 4) return 'MODERATE';
  return 'LOW';
}

function kpToIntensity(kp: number): number {
  const normalized = Math.max(0, Math.min(1, kp / 9));
  return Number((0.15 + normalized * 0.85).toFixed(3));
}

interface KpRecord {
  time_tag?: string;
  kp_index?: string | number;
  [key: string]: unknown;
}

async function fetchKp(): Promise<number> {
  const res = await fetch(NOAA_KP_URL);
  if (!res.ok) throw new Error(`KP fetch failed: ${res.status}`);
  const data: KpRecord[] | Array<unknown[]> = await res.json();

  // NOAA returns either an array of objects or an array of arrays (legacy format)
  const last = data[data.length - 1];
  if (Array.isArray(last)) {
    return parseFloat(String(last[1] ?? '0'));
  }
  const rec = last as KpRecord;
  return parseFloat(String(rec.kp_index ?? '0'));
}

async function fetchWindSpeed(): Promise<number> {
  const res = await fetch(NOAA_WIND_URL);
  if (!res.ok) throw new Error(`Wind fetch failed: ${res.status}`);
  // Response: [header_row, ...data_rows]; each data row = [time_tag, density, speed, temperature]
  const rows: Array<string[]> = await res.json();
  const data = rows.slice(1); // strip header row
  const last = data[data.length - 1];
  return parseFloat(last?.[2] ?? '450');
}

async function fetchFireballCount(): Promise<number> {
  if (fireballFetchDisabled) {
    return 0;
  }

  // NASA CNEOS endpoint is commonly blocked by browser CORS in local dev unless proxied.
  const usingDirectNasaEndpoint = !NASA_FIREBALL_PROXY_URL;
  if (usingDirectNasaEndpoint) {
    fireballFetchDisabled = true;
    if (!fireballWarned) {
      fireballWarned = true;
      console.warn('[Sköll] NASA fireball endpoint disabled in browser (CORS). Set VITE_NASA_FIREBALL_PROXY_URL to enable live counts.');
    }
    return 0;
  }

  const res = await fetch(NASA_FIREBALL_URL);
  if (!res.ok) throw new Error(`Fireball fetch failed: ${res.status}`);
  const json: { count?: string | number } = await res.json();
  return parseInt(String(json.count ?? '0'), 10);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
/** Poll every 5 minutes — NOAA updates 1-min data but sub-5-min HUD refresh is unnecessary */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * useGlobalTelemetry — the sole entry gate for space-weather data in Sköll.
 *
 * Returns a `GlobalTelemetry` object. `kp` starts as `undefined`, which keeps
 * NeuralBoot visible until the first fetch (live or fallback) completes.
 */
export function useGlobalTelemetry(): GlobalTelemetry {
  const [telemetry, setTelemetry] = useState<GlobalTelemetry>(() => {
    // CRITICAL: Initialize with valid fallback data immediately to unblock NeuralBoot
    const [kp, windSpeed, fireballCount] = LSTM_FALLBACK[0];
    const exo = calculateExoTelemetry('Earth', 7, windSpeed, 6, kp);
    
    console.log('[Sköll] ⚡ Telemetry initialized with LSTM seed:', { kp, windSpeed });
    
    return {
      kp, // NOT undefined — this unblocks the gate immediately
      kpIndex: kp,
      currentIntensity: kpToIntensity(kp),
      windSpeed,
      fireballCount,
      expansionLatitude: exo.expansionLatitude,
      standoffDistance: exo.standoffDistance,
      threatLevel: kpToThreat(kp),
      source: 'lstm-fallback',
      lastUpdated: new Date(),
    };
  });

  // Pointer into the LSTM fallback sequence — advances on each fallback invocation
  const fallbackIdx = useRef(0);

  const fetchLive = async () => {
    try {
      console.log('[Sköll] Fetching live telemetry...');
      const [kp, windSpeed, fireballCount] = await Promise.all([
        fetchKp(),
        fetchWindSpeed(),
        fetchFireballCount(),
      ]);
      const exo = calculateExoTelemetry('Earth', 7, windSpeed, 6, kp);

      console.log('[Sköll] ✅ Live telemetry resolved:', { kp, windSpeed, fireballCount });
      setTelemetry({
        kp,
        kpIndex: kp,
        currentIntensity: kpToIntensity(kp),
        windSpeed,
        fireballCount,
        expansionLatitude: exo.expansionLatitude,
        standoffDistance: exo.standoffDistance,
        threatLevel: kpToThreat(kp),
        source: 'live',
        lastUpdated: new Date(),
      });
    } catch (err) {
      console.warn('[Sköll] Live telemetry unreachable — LSTM fallback active', err);

      // Advance through the simulated forecast state cyclically
      const idx = fallbackIdx.current % LSTM_FALLBACK.length;
      fallbackIdx.current += 1;

      const [kp, windSpeed, fireballCount] = LSTM_FALLBACK[idx];
      const exo = calculateExoTelemetry('Earth', 7, windSpeed, 6, kp);

      console.log('[Sköll] 🔄 LSTM fallback engaged:', { kp, windSpeed, fireballCount });
      setTelemetry((prev) => ({
        ...prev,
        kp,
        kpIndex: kp,
        currentIntensity: kpToIntensity(kp),
        windSpeed,
        fireballCount,
        expansionLatitude: exo.expansionLatitude,
        standoffDistance: exo.standoffDistance,
        threatLevel: kpToThreat(kp),
        source: 'lstm-fallback',
        lastUpdated: new Date(),
      }));
    }
  };

  useEffect(() => {
    fetchLive();
    const timer = setInterval(fetchLive, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return telemetry;
}
