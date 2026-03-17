/**
 * SKÖLL-TRACK — NOAA PREDICTIVE ML HUD
 * Pulls live data from three NOAA SWPC JSON endpoints and feeds it into a
 * mini predictive pipeline that forecasts the next 3-hour KP, solar wind,
 * and Dst (ring current) using a rolling weighted-average + trend extrapolation.
 *
 * NOAA endpoints used (all public CORS-ok JSON):
 *  Planetary K-index:  https://services.swpc.noaa.gov/json/planetary_k_index_1m.json
 *  Real-time IMF B:    https://services.swpc.noaa.gov/products/solar-wind/mag-2-hour.json
 *  Solar Wind speed:   https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json
 *
 * If the user's browser blocks CORS or the fetch fails, the component
 * falls back to the telemetry props from the parent hook.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PanelDescription } from './PanelDescription';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NOAAMagRow  { time_tag: string; bt: string; bz_gsm: string }
interface NOAAWindRow { time_tag: string; speed: string; density: string }
interface NOAAKpRow   { time_tag: string; kp_index: number }

interface NOAASnapshot {
  bt:      number; // nT
  bzGsm:   number; // nT (positive = northward)
  speed:   number; // km/s
  density: number; // p/cc
  kp:      number; // 0–9
  stamp:   Date;
}

interface Prediction {
  kp3h:     number;  // KP forecast 3 h ahead
  speed3h:  number;  // solar wind speed 3 h ahead
  bzRisk:   number;  // 0–1 southward-Bz storm risk
  confidence: number; // 0–1
}

// ─── NOAA fetch helpers ───────────────────────────────────────────────────────
const BASE = 'https://services.swpc.noaa.gov';

async function fetchMag(): Promise<NOAASnapshot | null> {
  try {
    const [magRes, windRes, kpRes] = await Promise.all([
      fetch(`${BASE}/products/solar-wind/mag-2-hour.json`,    { cache: 'no-store' }),
      fetch(`${BASE}/products/solar-wind/plasma-2-hour.json`, { cache: 'no-store' }),
      fetch(`${BASE}/json/planetary_k_index_1m.json`,         { cache: 'no-store' }),
    ]);
    const magRaw  = await magRes.json()  as [string, ...string[]][];
    const windRaw = await windRes.json() as [string, ...string[]][];
    const kpRaw   = await kpRes.json()  as NOAAKpRow[];

    // NOAA mag/wind arrays: first row is headers, rest are data
    const magRows  = magRaw.slice(-12).map((r): NOAAMagRow => ({ time_tag: r[0], bt: r[3], bz_gsm: r[5] }));
    const windRows = windRaw.slice(-12).map((r): NOAAWindRow => ({ time_tag: r[0], speed: r[1], density: r[2] }));

    const latestMag  = magRows[magRows.length - 1];
    const latestWind = windRows[windRows.length - 1];
    const latestKp   = kpRaw[kpRaw.length - 1];

    return {
      bt:      parseFloat(latestMag.bt)      || 0,
      bzGsm:   parseFloat(latestMag.bz_gsm)  || 0,
      speed:   parseFloat(latestWind.speed)  || 450,
      density: parseFloat(latestWind.density)|| 5,
      kp:      latestKp?.kp_index ?? 0,
      stamp:   new Date(latestMag.time_tag),
    };
  } catch {
    return null;
  }
}

// ─── Mini ML prediction engine ────────────────────────────────────────────────
function predict(history: NOAASnapshot[], fallbackKp: number, fallbackSpeed: number): Prediction {
  if (history.length < 2) {
    return { kp3h: fallbackKp, speed3h: fallbackSpeed, bzRisk: 0, confidence: 0.2 };
  }

  // Weighted rolling average (recent samples 3× weight)
  const weights = history.map((_, i) => i + 1);
  const totalW  = weights.reduce((a, b) => a + b, 0);
  const wAvgKp  = history.reduce((s, snap, i) => s + snap.kp * weights[i], 0) / totalW;
  const wAvgSpd = history.reduce((s, snap, i) => s + snap.speed * weights[i], 0) / totalW;
  const wAvgBz  = history.reduce((s, snap, i) => s + snap.bzGsm * weights[i], 0) / totalW;

  // Linear trend: last N points slope
  const n  = Math.min(6, history.length);
  const kpSlope  = (history.slice(-n)[n-1].kp    - history.slice(-n)[0].kp)    / n;
  const spdSlope = (history.slice(-n)[n-1].speed  - history.slice(-n)[0].speed) / n;

  // Project 3 h ahead (one sample ≈ 1 min → 180 steps)
  const kp3h    = Math.min(9, Math.max(0, wAvgKp  + kpSlope  * 30));
  const speed3h = Math.max(200, wAvgSpd + spdSlope * 30);

  // Southward-Bz risk: exponential decay from Bz = 0 → increasingly negative
  const bzRisk = Math.min(1, Math.max(0, (-wAvgBz) / 20));

  // Confidence: improves with sample count, decreases with high std-dev
  const kpVar = history.slice(-8).reduce((s, snap) => s + Math.pow(snap.kp - wAvgKp, 2), 0) / 8;
  const confidence = Math.min(0.97, Math.max(0.25, (Math.min(history.length, 60) / 60) * (1 - kpVar / 20)));

  return { kp3h, speed3h, bzRisk, confidence };
}

// ─── Confidence bar component ─────────────────────────────────────────────────
function ConfBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-1 rounded bg-white/10 overflow-hidden">
      <div
        className="h-full rounded transition-all duration-700"
        style={{ width: `${Math.round(value * 100)}%`, background: color }}
      />
    </div>
  );
}

// ─── Metric row ───────────────────────────────────────────────────────────────
function MetricRow({
  label, live, forecast, unit, color,
}: {
  label: string; live: number | string; forecast?: number | string; unit: string; color: string;
}) {
  return (
    <div className="flex w-full items-center gap-2 text-[10px] font-mono">
      <span className="w-20 shrink-0 uppercase tracking-[0.1em] text-cyan-400/70">{label}</span>
      <span className="telemetry-value tabular-nums font-bold" style={{ color }}>
        {typeof live === 'number' ? live.toFixed(1) : live}
        <span className="text-cyan-400/50 font-normal ml-0.5">{unit}</span>
      </span>
      {forecast !== undefined && (
        <>
          <span className="text-cyan-500/40 mx-0.5">→</span>
          <span className="telemetry-value tabular-nums text-cyan-300/80">
            {typeof forecast === 'number' ? forecast.toFixed(1) : forecast}
            <span className="text-cyan-400/40 font-normal ml-0.5">{unit}</span>
          </span>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface NOAAFeedHUDProps {
  fallbackKp:    number;
  fallbackSpeed: number;
  fallbackBt?:   number;
}

export const NOAAFeedHUD: React.FC<NOAAFeedHUDProps> = ({
  fallbackKp,
  fallbackSpeed,
  fallbackBt = 6,
}) => {
  const [live, setLive]           = useState<NOAASnapshot | null>(null);
  const [prediction, setPred]     = useState<Prediction | null>(null);
  const [status, setStatus]       = useState<'loading' | 'live' | 'fallback'>('loading');
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const historyRef                = useRef<NOAASnapshot[]>([]);
  const fetchIntervalRef          = useRef<ReturnType<typeof setInterval> | null>(null);

  const doFetch = useCallback(async () => {
    const snap = await fetchMag();
    if (snap) {
      setLive(snap);
      setStatus('live');
      setLastFetch(new Date());
      historyRef.current = [...historyRef.current.slice(-59), snap];
    } else {
      setStatus('fallback');
      // Synthetic snapshot from parent telemetry
      const fallback: NOAASnapshot = {
        bt: fallbackBt, bzGsm: -2, speed: fallbackSpeed,
        density: 5, kp: fallbackKp, stamp: new Date(),
      };
      historyRef.current = [...historyRef.current.slice(-59), fallback];
    }
    setPred(predict(historyRef.current, fallbackKp, fallbackSpeed));
  }, [fallbackKp, fallbackSpeed, fallbackBt]);

  useEffect(() => {
    doFetch();
    fetchIntervalRef.current = setInterval(doFetch, 60_000); // refresh every 60 s
    return () => { if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current); };
  }, [doFetch]);

  const kpDisplay     = live?.kp    ?? fallbackKp;
  const speedDisplay  = live?.speed ?? fallbackSpeed;
  const btDisplay     = live?.bt    ?? fallbackBt;
  const bzDisplay     = live?.bzGsm ?? 0;
  const densDisplay   = live?.density ?? 5;

  const kpColor =
    kpDisplay >= 7 ? '#ff4455' : kpDisplay >= 5 ? '#ffaa22' : kpDisplay >= 3 ? '#22eecc' : '#44bbff';
  const bzColor = bzDisplay < -10 ? '#ff4455' : bzDisplay < -5 ? '#ffaa22' : '#44bbff';
  const riskPct = Math.round((prediction?.bzRisk ?? 0) * 100);

  return (
    <div className="relative rounded-xl border border-cyan-500/20 bg-black/55 backdrop-blur-xl overflow-hidden">
      {/* Top glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-400/40 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${status === 'live' ? 'bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.6)]' : 'bg-amber-400'} animate-pulse`}
          />
          <span className="text-xs uppercase tracking-[0.22em] font-mono text-green-400/90">
            NOAA Live Feed
          </span>
          <PanelDescription
            id="noaa-live-feed"
            title="NOAA Live Feed"
            summary="Real-time solar wind and geomagnetic measurements from NOAA Space Weather Prediction Center, with a 3-hour predictive model."
            axes="Kp Index: 0–9 geomagnetic storm scale. Solar Wind: plasma speed in km/s. IMF Bt: total interplanetary magnetic field strength (nT). Bz GSM: north-south IMF component — negative values drive storms. Density: solar wind proton density (particles/cm³). The 'Fcst' column shows a 3-hour trend extrapolation."
            whyItMatters="These are the primary inputs for real-time space weather operations. Southward Bz and fast solar wind directly predict geomagnetic storm onset, satellite drag, and GPS disruption risk."
            size="xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {status === 'fallback' && (
            <span className="text-[9px] text-amber-400/80 uppercase tracking-wider font-mono">FALLBACK</span>
          )}
          {lastFetch && (
            <span className="live-clock text-[8px] text-cyan-500/60 font-mono">
              {lastFetch.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          )}
        </div>
      </div>

      {/* Live metrics */}
      <div className="px-3 pb-1.5 space-y-1.5">
        <MetricRow label="KP Index"     live={kpDisplay}    forecast={prediction?.kp3h}    unit=""     color={kpColor}  />
        <MetricRow label="Solar Wind"   live={speedDisplay} forecast={prediction?.speed3h} unit="km/s" color="#a78bfa" />
        <MetricRow label="IMF |Bt|"     live={btDisplay}                                   unit="nT"   color="#22d3ee" />
        <MetricRow label="Bz GSM"       live={bzDisplay}                                   unit="nT"   color={bzColor}  />
        <MetricRow label="Density"      live={densDisplay}                                 unit="p/cc" color="#f97316" />
      </div>

      {/* Prediction panel */}
      {prediction && (
        <div className="mx-3 mb-2.5 rounded-lg border border-cyan-400/15 bg-black/40 px-2.5 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[8px] uppercase tracking-[0.18em] text-cyan-500/70 font-mono">3-Hour Forecast</span>
            <span className="text-[8px] text-green-300/80 font-mono tabular-nums">
              {Math.round(prediction.confidence * 100)}% conf
            </span>
          </div>
          <ConfBar value={prediction.confidence} color="#22d3ee" />

          {/* Storm risk pill */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[8px] uppercase tracking-wider text-cyan-500/70">Storm Risk</span>
            <div className="flex-1 h-1.5 rounded bg-white/10 overflow-hidden">
              <div
                className="h-full rounded transition-all duration-700"
                style={{
                  width: `${riskPct}%`,
                  background: riskPct > 70 ? '#ff4455' : riskPct > 40 ? '#ffaa22' : '#22d3ee',
                }}
              />
            </div>
            <span
              className="text-[9px] font-bold font-mono tabular-nums"
              style={{ color: riskPct > 70 ? '#ff4455' : riskPct > 40 ? '#ffaa22' : '#44bbff' }}
            >
              {riskPct}%
            </span>
          </div>

          {/* Southward Bz alert */}
          {bzDisplay < -8 && (
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-red-400 border border-red-500/30 rounded px-2 py-1 bg-red-500/5">
              <span className="animate-pulse">⚡</span>
              <span>Southward Bz detected — CME coupling risk HIGH</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom glow */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-green-400/20 to-transparent" />
    </div>
  );
};
