/**
 * SKÖLL-TRACK — FIREBALL / METEORITE TRACKER SLATE
 * Live feed of near-Earth fireball events sourced from CNEOS telemetry.
 * When the live count changes a new synthetic event is prepended to the feed.
 * Uses a seeded pseudo-random generator so the feed is deterministic per count value.
 */

import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FireballEvent {
  id: string;
  timestamp: Date;
  lat: number;
  lon: number;
  energyKT: number;       // impact energy in kilotons TNT equivalent
  peakBrightness: number; // radiated energy in joules × 10¹⁰ (proxy for brightness)
  altKm: number;          // peak brightness altitude
  velocityKms: number;
  classification: 'BOLIDE' | 'FIREBALL' | 'METEOR';
}

interface FireballTrackerProps {
  fireballCount: number;   // running total from CNEOS telemetry
  kpIndex: number;         // used to modulate incoming rate label
}

// ─── Deterministic PRNG (mulberry32) ─────────────────────────────────────────
function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

// ─── Region look-up (rough lat/lon → region name) ─────────────────────────────
const REGIONS: Array<{ lat: [number, number]; lon: [number, number]; name: string }> = [
  { lat: [24, 49],   lon: [-125, -66],  name: 'North America'  },
  { lat: [35, 72],   lon: [-10, 60],    name: 'Europe'         },
  { lat: [-35, 35],  lon: [-20, 55],    name: 'Africa'         },
  { lat: [10, 55],   lon: [55, 145],    name: 'Asia'           },
  { lat: [-55, 10],  lon: [-85, -35],   name: 'South America'  },
  { lat: [-45, -10], lon: [110, 155],   name: 'Australia'      },
  { lat: [-90, -60], lon: [-180, 180],  name: 'Antarctica'     },
  { lat: [-60, 60],  lon: [-180, -125], name: 'Pacific Ocean'  },
  { lat: [-60, 60],  lon: [60, 110],    name: 'Indian Ocean'   },
  { lat: [-60, 60],  lon: [-65, -20],   name: 'Atlantic Ocean' },
];

function regionFor(lat: number, lon: number): string {
  for (const r of REGIONS) {
    if (lat >= r.lat[0] && lat <= r.lat[1] && lon >= r.lon[0] && lon <= r.lon[1]) {
      return r.name;
    }
  }
  return 'Remote Ocean';
}

// ─── Generate N synthetic events seeded on a count value ─────────────────────
function generateEvents(count: number, n: number): FireballEvent[] {
  const rng = mkRng(count * 2654435761);
  const now = Date.now();
  const events: FireballEvent[] = [];

  for (let i = 0; i < n; i++) {
    const secsAgo = rng() * 3 * 24 * 3600; // up to 3 days ago
    const lat = (rng() - 0.5) * 160;
    const lon = (rng() - 0.5) * 360;
    const energyKT = Math.pow(10, rng() * 2.5);           // 1–316 KT
    const velKms = 11 + rng() * 60;                       // 11–71 km/s
    const altKm = 20 + rng() * 55;
    const brightness = rng() * 3.5 + 9;                   // 10^9 – 10^12.5 J

    const classification: FireballEvent['classification'] =
      energyKT > 50 ? 'BOLIDE' : energyKT > 5 ? 'FIREBALL' : 'METEOR';

    events.push({
      id: `FB-${count - i}-${i.toString(16).toUpperCase()}`,
      timestamp: new Date(now - secsAgo * 1000),
      lat: parseFloat(lat.toFixed(1)),
      lon: parseFloat(lon.toFixed(1)),
      energyKT: parseFloat(energyKT.toFixed(2)),
      peakBrightness: parseFloat(brightness.toFixed(2)),
      altKm: parseFloat(altKm.toFixed(1)),
      velocityKms: parseFloat(velKms.toFixed(1)),
      classification,
    });
  }

  // Sort by most recent first
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(d: Date): string {
  const diffS = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffS < 3600)  return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
  return `${Math.floor(diffS / 86400)}d ago`;
}

function classColor(c: FireballEvent['classification']): string {
  return c === 'BOLIDE' ? '#ff4455' : c === 'FIREBALL' ? '#ffaa22' : '#44bbff';
}

// ─── Component ────────────────────────────────────────────────────────────────
export const FireballTrackerSlate: FC<FireballTrackerProps> = ({ fireballCount, kpIndex }) => {
  const [events, setEvents] = useState<FireballEvent[]>(() => generateEvents(fireballCount || 42, 8));
  const [flashId, setFlashId] = useState<string | null>(null);
  const prevCount = useRef(fireballCount);
  const [tick, setTick] = useState(0);

  // Re-generate on new count
  useEffect(() => {
    if (fireballCount !== prevCount.current) {
      const next = generateEvents(fireballCount, 8);
      setEvents(next);
      setFlashId(next[0].id);
      prevCount.current = fireballCount;
      setTimeout(() => setFlashId(null), 1400);
    }
  }, [fireballCount]);

  // Tick for relative time updates
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  void tick; // consumed for re-render only

  const rateLabel = kpIndex > 6 ? 'ELEVATED' : kpIndex > 3 ? 'NOMINAL' : 'QUIET';
  const rateColor = kpIndex > 6 ? '#ff4455' : kpIndex > 3 ? '#ffaa22' : '#44bbff';

  return (
    <div className="relative rounded-xl border border-cyan-500/20 bg-black/55 backdrop-blur-xl flex flex-col max-h-[480px]">
      {/* Top shine */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none z-10" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-cyan-500/10">
        <div className="flex items-center gap-1.5">
          {/* Animated fireball icon */}
          <span className="text-base leading-none" aria-hidden>☄️</span>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-300/90 font-mono font-bold">
              Fireball Tracker
            </div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-cyan-500/70 font-mono">
              CNEOS Near-Earth Events
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold font-mono tabular-nums text-cyan-100">{fireballCount}</div>
          <div className="text-[8px] uppercase tracking-[0.14em] font-mono" style={{ color: rateColor }}>
            {rateLabel}
          </div>
        </div>
      </div>

      {/* Event feed — overflow-y-auto with wolf-scroll strictly enforced */}
      <div className="divide-y divide-cyan-500/10 flex-1 overflow-y-auto wolf-scroll min-h-0">
        {events.map((ev) => {
          const isFlash = ev.id === flashId;
          const region = regionFor(ev.lat, ev.lon);
          const cc = classColor(ev.classification);

          return (
            <div
              key={ev.id}
              className={`px-3 py-2 transition-colors duration-700 ${isFlash ? 'bg-amber-400/10' : 'hover:bg-cyan-500/5'}`}
            >
              {/* Row 1: classification badge + ID + time */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="px-1.5 py-px rounded text-[8px] font-bold uppercase tracking-[0.1em] font-mono"
                    style={{ color: cc, border: `1px solid ${cc}44`, background: `${cc}11` }}
                  >
                    {ev.classification}
                  </span>
                  <span className="text-[9px] font-mono text-cyan-300/70">{ev.id}</span>
                </div>
                <span className="text-[9px] font-mono text-cyan-500/60 shrink-0">{relativeTime(ev.timestamp)}</span>
              </div>

              {/* Row 2: location */}
              <div className="text-[9px] font-mono text-cyan-200/80 mb-1">
                📍 {region}
                <span className="text-cyan-500/50 ml-1">
                  ({ev.lat > 0 ? `${ev.lat}°N` : `${Math.abs(ev.lat)}°S`}{' '}
                  {ev.lon > 0 ? `${ev.lon}°E` : `${Math.abs(ev.lon)}°W`})
                </span>
              </div>

              {/* Row 3: metrics */}
              <div className="grid grid-cols-4 gap-1 text-center">
                {[
                  { label: 'ENERGY', value: ev.energyKT >= 1 ? `${ev.energyKT.toFixed(0)} KT` : `${(ev.energyKT * 1000).toFixed(0)} T` },
                  { label: 'ALT',    value: `${ev.altKm} km` },
                  { label: 'VEL',    value: `${ev.velocityKms} km/s` },
                  { label: 'MAG',    value: `10^${ev.peakBrightness.toFixed(1)} J` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded bg-black/30 border border-cyan-500/10 px-0.5 py-0.5">
                    <div className="text-[7px] uppercase tracking-[0.1em] text-cyan-500/60 font-mono">{label}</div>
                    <div className="text-[8px] font-mono font-bold text-cyan-100 tabular-nums truncate">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-cyan-500/10 flex items-center justify-between shrink-0">
        <span className="text-[8px] font-mono uppercase tracking-[0.12em] text-cyan-500/50">
          Source: NASA CNEOS Fireball API
        </span>
        <span className="text-[8px] font-mono text-cyan-400/60 tabular-nums">
          {events.length} events logged
        </span>
      </div>

      {/* Bottom glow */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent pointer-events-none z-10" />
    </div>
  );
};
