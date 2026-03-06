import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * AuroraOvationHUD.tsx
 *
 * Real-time aurora visibility panel powered by NOAA OVATION Prime data.
 *
 * Endpoints used:
 *   • Hemispheric power index (HPI) — aurora particle flux in gigawatts
 *     https://services.swpc.noaa.gov/json/aurora_hemispheric_power.json
 *   • 1-minute planetary K-index
 *     https://services.swpc.noaa.gov/json/planetary_k_index_1m.json
 *
 * The aurora visibility latitude is derived from the OVATION-Prime
 * colatitude model:  colatitude = 20° + Kp × 2°
 * → southernmost visible latitude (northern hemisphere) = 90° − colatitude
 *   For Kp 5: 90 − 30 = 60°N (visible from Scandinavia, Canada)
 *   For Kp 8: 90 − 36 = 54°N (visible from the UK, central Europe)
 */

interface HPIPoint {
  time_tag: string;
  hemisphere: string;
  power: number;
  aurora_activity: string;
}

interface KpPoint {
  time_tag: string;
  kp: number | string;
  source: string;
}

export interface AuroraOvationProps {
  /** Fallback Kp (0–9) when live fetch unavailable */
  fallbackKp?: number;
  providerMode?: 'l1-live' | 'kp-fallback' | 'degraded' | 'offline';
  providerHealth?: 'green' | 'amber' | 'red';
  providerDetails?: string;
}

const ACCENT   = '#22ff88';
const REFRESH  = 60_000; // ms

// Kp → colatitude (°) → southernmost visible lat (°N)
function kpToVisibleLat(kp: number): number {
  const colatDeg = Math.min(38, 20 + kp * 2);
  return 90 - colatDeg;
}

// HPI → textual activity level
function activityLabel(hpiGW?: number): string {
  if (hpiGW === undefined) return 'unknown';
  if (hpiGW < 10)  return 'Quiet';
  if (hpiGW < 30)  return 'Low';
  if (hpiGW < 60)  return 'Moderate';
  if (hpiGW < 100) return 'Elevated';
  if (hpiGW < 200) return 'High';
  return 'Extreme';
}

// Kp → aurora colour
function kpToColor(kp: number): string {
  if (kp < 3)  return '#22ff88';   // green — quiet
  if (kp < 5)  return '#88ffcc';   // teal — minor
  if (kp < 6)  return '#ffdd44';   // yellow — G1
  if (kp < 7)  return '#ff8c42';   // orange — G2
  if (kp < 8)  return '#ff4f52';   // red — G3
  return '#e040fb';                  // pink/purple — G4+
}

export default function AuroraOvationHUD({
  fallbackKp = 2,
  providerMode = 'degraded',
  providerHealth = 'amber',
  providerDetails,
}: AuroraOvationProps) {
  const [kp, setKp]               = useState<number>(fallbackKp);
  const [hpiNorth, setHpiNorth]   = useState<number | undefined>(undefined);
  const [hpiSouth, setHpiSouth]   = useState<number | undefined>(undefined);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);
    setError(null);
    try {
      const [hpiRes, kpRes] = await Promise.all([
        fetch('https://services.swpc.noaa.gov/json/aurora_hemispheric_power.json', { signal }),
        fetch('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',     { signal }),
      ]);
      if (!hpiRes.ok || !kpRes.ok) throw new Error('NOAA API error');

      const hpiData: HPIPoint[] = await hpiRes.json();
      const kpData:  KpPoint[]  = await kpRes.json();

      // Most-recent HPI values per hemisphere
      const north = hpiData.filter((d) => d.hemisphere === 'north' && typeof d.power === 'number').at(-1);
      const south = hpiData.filter((d) => d.hemisphere === 'south' && typeof d.power === 'number').at(-1);
      if (north) setHpiNorth(north.power);
      if (south) setHpiSouth(south.power);

      // Most-recent observed Kp
      const latestKp = kpData
        .filter((d) => d.source === 'estimated' || d.source === 'observed')
        .at(-1);
      if (latestKp) {
        const v = typeof latestKp.kp === 'string' ? parseFloat(latestKp.kp) : latestKp.kp;
        if (isFinite(v)) setKp(v);
      }
      setLastFetch(new Date());
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Live data unavailable — showing fallback');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const id = setInterval(() => void fetchData(), REFRESH);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchData]);

  const visLat    = kpToVisibleLat(kp);
  const stormCol  = kpToColor(kp);
  const activity  = activityLabel((hpiNorth ?? 0) + (hpiSouth ?? 0));
  const providerColor = providerHealth === 'green' ? '#22ff88' : providerHealth === 'amber' ? '#ffdd44' : '#ff4f52';
  const providerModeLabel = providerMode === 'l1-live'
    ? 'L1 LIVE'
    : providerMode === 'kp-fallback'
      ? 'KP FALLBACK'
      : providerMode === 'offline'
        ? 'OFFLINE'
        : 'DEGRADED';

  // Polar oval visualisation — a simple SVG hemisphere diagram
  // The auroral oval is drawn as an ellipse at the polar latitude.
  const svgSize   = 110;
  const cx        = svgSize / 2;
  const cy        = svgSize / 2;
  const earthR    = 36;
  // Colatitude radius on the diagram
  const colatR    = earthR + (90 - visLat) / 90 * 18;  // expands outward
  const ovalRx    = colatR * 1.0;
  const ovalRy    = colatR * 0.35;  // flatten to ellipse (perspective)

  return (
    <div
      style={{
        background:           'rgba(6,10,22,0.76)',
        backdropFilter:       'blur(22px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
        border:               `1px solid ${ACCENT}28`,
        borderRadius:         '10px',
        overflow:             'hidden',
        width:                '100%',
        fontFamily:           'monospace',
        color:                '#c0d8f0',
        boxShadow:            `0 0 32px ${ACCENT}14, 0 4px 24px rgba(0,0,0,0.68)`,
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px 6px', background: `linear-gradient(90deg,${ACCENT}10 0%,transparent 100%)`, borderBlockEnd: `1px solid ${ACCENT}22` }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: stormCol, display: 'inline-block', boxShadow: `0 0 6px ${stormCol}` }} />
        <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, opacity: 0.85 }}>OVATION Prime</span>
        <span style={{ fontSize: '7px', letterSpacing: '0.12em', textTransform: 'uppercase', color: providerColor, border: `1px solid ${providerColor}66`, borderRadius: '4px', padding: '1px 4px' }}>
          {providerModeLabel}
        </span>
        <span className="live-clock" style={{ fontSize: '7px', opacity: 0.35, marginInlineStart: 'auto', letterSpacing: '0.1em', minInlineSize: '12ch' }}>
          {loading ? 'Syncing…' : lastFetch ? `${lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC` : 'Pending'}
        </span>
      </div>

      <div style={{ padding: '8px 10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        {/* Polar oval diagram */}
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} style={{ flexShrink: 0 }}>
          {/* Space background */}
          <circle cx={cx} cy={cy} r={svgSize / 2 - 2} fill="rgba(4,8,18,0.7)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          {/* Earth circle */}
          <circle cx={cx} cy={cy} r={earthR} fill="#1e3a5f" opacity="0.85" />
          {/* Continent silhouette hint */}
          <circle cx={cx} cy={cy} r={earthR} fill="none" stroke="#4fc3f7" strokeWidth="0.5" opacity="0.3" />
          {/* Auroral oval — top (north polar view) */}
          <ellipse cx={cx} cy={cy - earthR + ovalRy * 0.6} rx={ovalRx} ry={ovalRy}
            fill="none" stroke={stormCol} strokeWidth="2.4" opacity="0.82"
            style={{ filter: `drop-shadow(0 0 4px ${stormCol})` }}
          />
          {/* Label */}
          <text x={cx} y={svgSize - 4} textAnchor="middle" fontSize="6" fill={ACCENT} opacity="0.45" letterSpacing="0.05em">N POLE VIEW</text>
        </svg>

        {/* Stats */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Kp bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockEnd: '2px' }}>
              <span style={{ fontSize: '8px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Kp Index</span>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: stormCol }}>{kp.toFixed(1)}</span>
            </div>
            <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(kp / 9) * 100}%`, background: `linear-gradient(90deg,${stormCol}cc,${stormCol}66)`, borderRadius: '3px', boxShadow: `0 0 6px ${stormCol}66`, transition: 'width 0.5s ease' }} />
            </div>
          </div>

          {/* Activity */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
            <span style={{ opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Activity</span>
            <span style={{ color: stormCol, fontWeight: 'bold' }}>{activity}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
            <span style={{ opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Driver</span>
            <span style={{ color: providerColor, fontWeight: 'bold' }}>{providerModeLabel}</span>
          </div>

          {/* Visibility */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
            <span style={{ opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Visible south of</span>
            <span style={{ color: '#c0d8f0' }}>{visLat.toFixed(0)}° N</span>
          </div>

          {/* HPI */}
          <div style={{ fontSize: '8px', display: 'flex', gap: '6px', marginBlockStart: '2px' }}>
            <span style={{ opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.07em' }}>HPI:</span>
            <span>N {hpiNorth !== undefined ? `${Math.round(hpiNorth)} GW` : '—'}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>S {hpiSouth !== undefined ? `${Math.round(hpiSouth)} GW` : '—'}</span>
          </div>

          {/* Storm scale */}
          <div style={{ display: 'flex', gap: '3px', marginBlockStart: '2px' }}>
            {['G1','G2','G3','G4','G5'].map((g, i) => {
              const threshold = [5, 6, 7, 8, 9][i];
              const active    = kp >= threshold;
              return (
                <span key={g} style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '3px',
                  background: active ? `${stormCol}30` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? stormCol + '80' : 'rgba(255,255,255,0.08)'}`,
                  color: active ? stormCol : '#607080',
                  letterSpacing: '0.05em',
                  fontWeight: active ? 'bold' : 'normal',
                }}>
                  {g}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '4px 10px 6px', fontSize: '7px', opacity: 0.4, borderBlockStart: '1px solid rgba(255,255,255,0.05)', color: '#ff8c42' }}>
          ⚠ {error}
        </div>
      )}
      {!error && providerDetails && (
        <div style={{ padding: '4px 10px 6px', fontSize: '7px', opacity: 0.45, borderBlockStart: '1px solid rgba(255,255,255,0.05)', color: providerColor }}>
          {providerDetails}
        </div>
      )}
    </div>
  );
}
