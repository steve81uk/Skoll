import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * useGOESFlux.ts
 *
 * Lightweight hook that polls the NOAA GOES-16/18 primary 1–8 Å (XRSB)
 * X-ray flux every 60 seconds and returns the latest value in W/m².
 *
 * Shared hook so both GridFailureSim and RadioBlackoutHeatmap (via App.tsx)
 * consume the same live data without duplicate fetches.
 *
 * Flux normalisation for shader/sim use:
 *   fluxNorm = clamp((log₁₀(flux) + 6) / 3, 0, 1)
 *   → 0 at C1 (1×10⁻⁶), 0.33 at M1, 0.67 at X1, 1.0 at X10 / 1×10⁻³
 */

interface GOESPoint {
  time_tag: string;
  satellite: number;
  flux: number;
  energy: string;
  observed_flux: number;
  is_flare: number;
}

const FLARE_THRESHOLDS = [
  { label: 'A', min: 0 },
  { label: 'B', min: 1e-7 },
  { label: 'C', min: 1e-6 },
  { label: 'M', min: 1e-5 },
  { label: 'X', min: 1e-4 },
] as const;

function classifyRaw(flux: number): string {
  for (let i = FLARE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (flux >= FLARE_THRESHOLDS[i].min) {
      const base = FLARE_THRESHOLDS[i];
      const sub  = (flux / base.min).toFixed(1);
      return `${base.label}${sub}`;
    }
  }
  return 'A';
}

/** Normalise raw W/m² to [0,1] for absorption shader. */
export function normaliseFlux(fluxWm2: number): number {
  if (fluxWm2 <= 0) return 0;
  return Math.max(0, Math.min(1, (Math.log10(fluxWm2) + 6) / 3));
}

export interface GOESFluxState {
  /** Latest 1–8 Å flux in W/m². 1×10⁻⁸ baseline when unavailable. */
  fluxWm2:   number;
  /** Log-normalised 0–1 (0 = C1, 1 = X10). */
  fluxNorm:  number;
  /** Human-readable classification e.g. "X2.4" */
  flareClass: string;
  loading:   boolean;
  lastFetch: Date | null;
}

const FALLBACK: GOESFluxState = {
  fluxWm2:   1e-8,
  fluxNorm:  0,
  flareClass: 'A',
  loading:   false,
  lastFetch: null,
};

export function useGOESFlux(refreshMs = 60_000): GOESFluxState {
  const [state, setState] = useState<GOESFluxState>(FALLBACK);
  const abortRef = useRef<AbortController | null>(null);

  const fetch_ = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch(
        'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json',
        { signal: abortRef.current.signal },
      );
      if (!res.ok) throw new Error('GOES API error');
      const data: GOESPoint[] = await res.json();
      const latest = data
        .filter((d) => d.energy === '0.1-0.8nm' && typeof d.flux === 'number')
        .at(-1);
      if (latest) {
        const flux = latest.flux;
        setState({
          fluxWm2:   flux,
          fluxNorm:  normaliseFlux(flux),
          flareClass: classifyRaw(flux),
          loading:   false,
          lastFetch: new Date(),
        });
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setState((s) => ({ ...s, loading: false }));
      }
    }
  }, []);

  useEffect(() => {
    void fetch_();
    const id = setInterval(() => void fetch_(), refreshMs);
    return () => { clearInterval(id); abortRef.current?.abort(); };
  }, [fetch_, refreshMs]);

  return state;
}
