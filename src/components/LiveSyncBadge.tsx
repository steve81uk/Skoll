/**
 * SKÖLL-TRACK — LIVE SYNC BADGE
 * ISO 8601 timestamp indicator showing data freshness.
 *
 * States:
 *   LIVE   (green)   — data updated within last 2 minutes
 *   STALE  (amber)   — 2–5 minutes old
 *   AGED   (red)     — older than 5 minutes
 *   PAUSED (grey)    — historical mode (non-live date)
 *
 * Displays:
 *   • ISO 8601 UTC timestamp
 *   • Data source label
 *   • Animated pulse dot
 *   • Time since last update
 */

import { useEffect, useState } from 'react';

export interface LiveSyncBadgeProps {
  lastFetch:  Date | null;
  source?:    string;
  isLiveMode: boolean;
  epochYear?: number;
}

function getAge(lastFetch: Date | null): number | null {
  if (!lastFetch) return null;
  return (Date.now() - lastFetch.getTime()) / 1000;
}

function fmtAge(seconds: number): string {
  if (seconds < 60)   return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

type SyncState = 'live' | 'stale' | 'aged' | 'paused' | 'init';

const STATE_CONFIG: Record<SyncState, { color: string; label: string; pulse: boolean }> = {
  live:   { color: '#22c55e', label: 'LIVE',   pulse: true  },
  stale:  { color: '#eab308', label: 'STALE',  pulse: true  },
  aged:   { color: '#ef4444', label: 'AGED',   pulse: false },
  paused: { color: '#6b7280', label: 'PAUSED', pulse: false },
  init:   { color: '#60c8ff', label: 'INIT',   pulse: true  },
};

export function LiveSyncBadge({ lastFetch, source = 'NOAA SWPC', isLiveMode, epochYear }: LiveSyncBadgeProps) {
  const [now, setNow] = useState(() => new Date());
  const [tick, setTick] = useState(0);

  // Update every second
  useEffect(() => {
    const id = setInterval(() => { setNow(new Date()); setTick(t => t + 1); }, 1000);
    return () => clearInterval(id);
  }, []);

  const age = getAge(lastFetch);

  const syncState: SyncState = !isLiveMode ? 'paused'
    : !lastFetch          ? 'init'
    : age !== null && age < 120  ? 'live'
    : age !== null && age < 300  ? 'stale'
    : 'aged';

  const cfg = STATE_CONFIG[syncState];

  // Format ISO 8601 timestamp (show model date in historical mode)
  const displayDate = isLiveMode ? now : epochYear ? new Date(epochYear, 0, 1) : now;
  const iso = displayDate.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  // Pulse animation (CSS inline keyframes via state)
  const pulseOpacity = cfg.pulse ? (0.6 + Math.sin(tick * 0.8) * 0.4) : 1;

  return (
    <div
      title={`${source} · Last updated: ${lastFetch ? lastFetch.toISOString() : 'never'}`}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            '7px',
        background:     'rgba(3,10,25,0.88)',
        border:         `1px solid ${cfg.color}44`,
        borderRadius:   '8px',
        padding:        '5px 10px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        userSelect:     'none',
        cursor:         'default',
      }}
    >
      {/* Pulse dot */}
      <div style={{
        width:        '8px',
        height:       '8px',
        borderRadius: '50%',
        background:   cfg.color,
        flexShrink:   0,
        opacity:      pulseOpacity,
        boxShadow:    cfg.pulse ? `0 0 ${6 + pulseOpacity * 4}px ${cfg.color}` : 'none',
        transition:   'opacity 0.1s',
      }} />

      {/* Content */}
      <div style={{ display:'flex', flexDirection:'column', gap:'1px' }}>
        {/* Top row: state + source */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <span style={{
            fontSize:      '10px',
            fontWeight:    700,
            color:         cfg.color,
            fontFamily:    '"Rajdhani","Share Tech Mono",monospace',
            letterSpacing: '0.08em',
          }}>
            {cfg.label}
          </span>
          <span style={{
            fontSize:   '9px',
            color:      'rgba(100,150,200,0.65)',
            fontFamily: 'monospace',
          }}>
            {source}
          </span>
        </div>

        {/* ISO 8601 timestamp */}
        <span style={{
          fontSize:   '11px',
          color:      'rgba(180,220,255,0.9)',
          fontFamily: '"Share Tech Mono",monospace',
          letterSpacing: '0.04em',
          lineHeight: 1.1,
        }}>
          {iso}
        </span>

        {/* Age line */}
        {!isLiveMode && epochYear && (
          <span style={{ fontSize:'9px', color:'rgba(100,150,200,0.55)', fontFamily:'monospace' }}>
            HISTORICAL · EPOCH {epochYear < 0 ? `${Math.abs(epochYear).toLocaleString()} BCE` : epochYear}
          </span>
        )}
        {isLiveMode && (
          <span style={{ fontSize:'9px', color:'rgba(100,150,200,0.55)', fontFamily:'monospace' }}>
            {age !== null ? fmtAge(age) : 'fetching…'}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Compact inline variant (single line) ─────────────────────────────────────
export function LiveSyncBadgeCompact({ lastFetch, isLiveMode }: Pick<LiveSyncBadgeProps, 'lastFetch' | 'isLiveMode'>) {
  const [now, setNow] = useState(() => new Date());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => { setNow(new Date()); setTick(t => t + 1); }, 1000);
    return () => clearInterval(id);
  }, []);

  const age = getAge(lastFetch);
  const syncState: SyncState = !isLiveMode ? 'paused'
    : !lastFetch          ? 'init'
    : age !== null && age < 120 ? 'live'
    : age !== null && age < 300 ? 'stale' : 'aged';

  const cfg = STATE_CONFIG[syncState];
  const iso = now.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  const pulseOpacity = cfg.pulse ? (0.5 + Math.sin(tick * 0.8) * 0.5) : 1;

  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:'5px' }}>
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: cfg.color, opacity: pulseOpacity,
        boxShadow: cfg.pulse ? `0 0 5px ${cfg.color}` : 'none',
      }} />
      <span style={{ fontSize:'9px', color:cfg.color, fontFamily:'monospace', letterSpacing:'0.06em' }}>
        {cfg.label}
      </span>
      <span style={{ fontSize:'9px', color:'rgba(150,200,255,0.65)', fontFamily:'monospace' }}>
        {iso}
      </span>
    </div>
  );
}

export default LiveSyncBadge;
