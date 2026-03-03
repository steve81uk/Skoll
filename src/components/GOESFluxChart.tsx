import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * GOESFluxChart.tsx
 *
 * Real-time GOES-16/18 primary satellite X-ray flux chart for
 * solar flare classification and radio blackout prediction.
 *
 * NOAA API endpoint:
 *   https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json
 *
 * X-ray channels:
 *   Short (0.5–4 Å)  — "xrsa"  — sensitive to hard X-ray bursts
 *   Long  (1–8 Å)    — "xrsb"  — standard GOES flare classification
 *
 * Flare classification (1–8 Å peak flux W/m²):
 *   A  < 10⁻⁷        B  10⁻⁷ – 10⁻⁶
 *   C  10⁻⁶ – 10⁻⁵  M  10⁻⁵ – 10⁻⁴
 *   X  > 10⁻⁴
 *
 * Radio blackout probability is derived from flare class:
 *   ≥ C1  → possible R1 (minor HF degradation)
 *   ≥ M1  → probable R2 (HF blackout on sunlit hemisphere)
 *   ≥ X1  → severe R3+ (wide-area HF blackout)
 */

interface GOESPoint {
  time_tag: string;
  satellite: number;
  flux: number;
  energy: string;   // "0.05-0.4nm" (short) or "0.1-0.8nm" (long)
  observed_flux: number;
  is_flare: number;
}

// Flare classification thresholds (1–8 Å channel, W/m²)
const FLARE_THRESHOLDS: Array<{ label: string; threshold: number; color: string; blackout: string }> = [
  { label: 'A',  threshold: 0,      color: '#44aaff', blackout: 'None' },
  { label: 'B',  threshold: 1e-7,   color: '#88ffcc', blackout: 'None' },
  { label: 'C',  threshold: 1e-6,   color: '#ffdd44', blackout: 'R0–R1 (minor)' },
  { label: 'M',  threshold: 1e-5,   color: '#ff8c42', blackout: 'R2 (HF degraded)' },
  { label: 'X',  threshold: 1e-4,   color: '#ff4f52', blackout: 'R3–R5 (severe)' },
];

function classifyFlare(flux: number): typeof FLARE_THRESHOLDS[0] {
  for (let i = FLARE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (flux >= FLARE_THRESHOLDS[i].threshold) return FLARE_THRESHOLDS[i];
  }
  return FLARE_THRESHOLDS[0];
}

function formatFlux(flux: number): string {
  if (flux <= 0) return 'N/A';
  const exp = Math.floor(Math.log10(flux));
  const mantissa = flux / Math.pow(10, exp);
  return `${mantissa.toFixed(1)}×10⁻${Math.abs(exp)}`;
}

const ACCENT  = '#ff8c42';
const REFRESH = 60_000;
const MAX_PTS = 240;  // ~4 hours at 1-min resolution

export interface GOESFluxChartProps {
  /** Show the second GOES channel (0.5–4 Å short). Default true. */
  showShortChannel?: boolean;
}

export default function GOESFluxChart({ showShortChannel = true }: GOESFluxChartProps) {
  const [longCh,  setLongCh]  = useState<number[]>([]);  // 1–8 Å
  const [shortCh, setShortCh] = useState<number[]>([]);  // 0.5–4 Å
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json',
        { signal: abortRef.current.signal },
      );
      if (!res.ok) throw new Error('NOAA GOES API error');
      const data: GOESPoint[] = await res.json();

      const long  = data.filter((d) => d.energy === '0.1-0.8nm').map((d) => d.flux).filter(isFinite).slice(-MAX_PTS);
      const short = data.filter((d) => d.energy === '0.05-0.4nm').map((d) => d.flux).filter(isFinite).slice(-MAX_PTS);
      setLongCh(long);
      setShortCh(short);
      setLastFetch(new Date());
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('GOES data unavailable');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const id = setInterval(() => void fetchData(), REFRESH);
    return () => { clearInterval(id); abortRef.current?.abort(); };
  }, [fetchData]);

  // Draw chart on canvas when data changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || longCh.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(4,8,18,0.7)';
    ctx.fillRect(0, 0, W, H);

    // Log scale: range 10⁻⁹ → 10⁻³ → pixels
    const LOG_MIN = -9;
    const LOG_MAX = -3;
    const logRange = LOG_MAX - LOG_MIN;

    function fluxToY(flux: number): number {
      if (flux <= 0) return H;
      const l = Math.log10(flux);
      const clamped = Math.max(LOG_MIN, Math.min(LOG_MAX, l));
      return H - ((clamped - LOG_MIN) / logRange) * H;
    }

    // Flare classification band lines
    for (const band of FLARE_THRESHOLDS.slice(2)) {  // C, M, X
      const y = fluxToY(band.threshold);
      ctx.strokeStyle = band.color + '40';
      ctx.lineWidth = 0.7;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillStyle = band.color + '70';
      ctx.font = '7px monospace';
      ctx.fillText(band.label, 3, y - 2);
    }
    ctx.setLineDash([]);

    // Draw long-channel (1–8 Å) line — orange
    if (longCh.length > 1) {
      ctx.beginPath();
      const dx = W / (longCh.length - 1);
      longCh.forEach((v, i) => {
        const x = i * dx;
        const y = fluxToY(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#ff8c42';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // Draw short-channel (0.5–4 Å) line — cyan
    if (showShortChannel && shortCh.length > 1) {
      ctx.beginPath();
      const dx = W / (shortCh.length - 1);
      shortCh.forEach((v, i) => {
        const x = i * dx;
        const y = fluxToY(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [longCh, shortCh, showShortChannel]);

  const latestFlux  = longCh.at(-1) ?? 0;
  const flareClass  = classifyFlare(latestFlux);
  const peakFlux    = Math.max(...longCh.filter((v) => v > 0), 0);
  const peakClass   = classifyFlare(peakFlux);

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px 6px', background: `linear-gradient(90deg,${ACCENT}10 0%,transparent 100%)`, borderBottom: `1px solid ${ACCENT}22` }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: flareClass.color, display: 'inline-block', boxShadow: `0 0 6px ${flareClass.color}` }} />
        <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, opacity: 0.85 }}>GOES X-Ray Flux</span>
        <span style={{ fontSize: '7px', opacity: 0.35, marginLeft: 'auto' }}>
          {loading ? 'Syncing…' : lastFetch ? `${lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Pending'}
        </span>
      </div>

      {/* Canvas chart */}
      <div style={{ padding: '6px 10px 0' }}>
        <canvas
          ref={canvasRef}
          width={320}
          height={80}
          style={{ width: '100%', height: '80px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)', display: 'block' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', opacity: 0.3, marginTop: '2px' }}>
          <span>−4 h</span><span style={{ letterSpacing: '0.08em' }}>log flux (W/m²)</span><span>Now</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', padding: '8px 10px 10px' }}>
        <div>
          <div style={{ fontSize: '7px', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Current flux</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: flareClass.color }}>{flareClass.label}-class</div>
          <div style={{ fontSize: '7px', opacity: 0.55 }}>{formatFlux(latestFlux)} W/m²</div>
        </div>
        <div>
          <div style={{ fontSize: '7px', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Peak (4 h)</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: peakClass.color }}>{peakClass.label}-class</div>
          <div style={{ fontSize: '7px', opacity: 0.55 }}>{formatFlux(peakFlux)} W/m²</div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: '7px', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Radio blackout risk</div>
          <div style={{ fontSize: '9px', color: flareClass.color }}>{flareClass.blackout}</div>
        </div>
      </div>

      {/* Channel legend */}
      <div style={{ display: 'flex', gap: '10px', padding: '5px 10px 7px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '7px', opacity: 0.45 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 12, height: 2, background: '#ff8c42', display: 'inline-block', borderRadius: 1 }} />
          1–8 Å (XRSB)
        </span>
        {showShortChannel && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 12, height: 2, background: '#4fc3f7', display: 'inline-block', borderRadius: 1, opacity: 0.7 }} />
            0.5–4 Å (XRSA)
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding: '3px 10px 6px', fontSize: '7px', color: '#ff8c42', opacity: 0.5, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
