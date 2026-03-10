import { useEffect, useMemo, useState } from 'react';
import {
  calculateBodyPosition,
  type EphemerisVectorAU,
  MOON_BODIES,
  PLANET_BODIES,
  estimateSunEvolution,
  estimateTrajectoryConfidence,
  predictBodyTrajectory,
  type ForecastBodyName,
  type PlanetTrajectoryPoint,
} from '../ml/OrbitalMechanics';

interface TrajectoryForecastPanelProps {
  currentDate: Date;
  onHighPrecisionModeChange?: (enabled: boolean) => void;
  onVectorsResolved?: (vectors: EphemerisVectorAU[]) => void;
}

interface ForecastRow {
  body: ForecastBodyName;
  points: PlanetTrajectoryPoint[];
}

type HorizonsVector = EphemerisVectorAU;

interface ResidualRow {
  body: ForecastBodyName;
  errorAu: number;
  accuracyPct: number;
}

function toCsv(rows: ForecastRow[], orbitalConfidencePct: number, solarStage: string, solarConfidencePct: number): string {
  const header = [
    'date_utc',
    'body',
    'x_au',
    'y_au',
    'z_au',
    'r_au',
    'orbital_confidence_pct',
    'solar_stage',
    'solar_model_confidence_pct',
  ].join(',');

  const lines: string[] = [header];
  for (const row of rows) {
    for (const p of row.points) {
      lines.push([
        p.date.toISOString(),
        row.body,
        p.x.toFixed(9),
        p.y.toFixed(9),
        p.z.toFixed(9),
        p.rAU.toFixed(9),
        orbitalConfidencePct.toString(),
        `"${solarStage.replace(/"/g, '""')}"`,
        solarConfidencePct.toString(),
      ].join(','));
    }
  }

  return lines.join('\n');
}

function toJsonl(payload: unknown): string {
  return `${JSON.stringify(payload)}\n`;
}

function fetchBaseUrl() {
  const backendBase = import.meta.env.VITE_BACKEND_HTTP_BASE?.trim();
  if (backendBase) return backendBase.replace(/\/$/, '');
  const apiBase = import.meta.env.VITE_EPHEMERIS_API_BASE?.trim();
  if (apiBase) return apiBase.replace(/\/$/, '');
  return 'http://localhost:8080';
}

async function fetchHorizonsVector(body: ForecastBodyName, date: Date): Promise<HorizonsVector> {
  const base = fetchBaseUrl();
  const params = new URLSearchParams({
    body,
    date: date.toISOString(),
  });
  const response = await fetch(`${base}/api/ephemeris/horizons?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Horizons proxy HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.ok || !payload?.vector) {
    throw new Error(payload?.error ?? 'Horizons proxy returned no vector');
  }
  return payload.vector as HorizonsVector;
}

function computeResiduals(vectors: HorizonsVector[], date: Date): ResidualRow[] {
  return vectors.map((vector) => {
    const internal = calculateBodyPosition(vector.body, date);
    const dx = internal.x - vector.x;
    const dy = internal.y - vector.y;
    const dz = internal.z - vector.z;
    const errorAu = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const baseline = Math.max(1e-8, Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z));
    const relative = errorAu / baseline;
    const accuracyPct = Math.max(0, Math.min(100, 100 - relative * 100));

    return {
      body: vector.body,
      errorAu,
      accuracyPct,
    };
  });
}

export default function TrajectoryForecastPanel({
  currentDate,
  onHighPrecisionModeChange,
  onVectorsResolved,
}: TrajectoryForecastPanelProps) {
  const [daysAhead, setDaysAhead] = useState(365);
  const [stepDays, setStepDays] = useState(1);
  const [includeMoons, setIncludeMoons] = useState(true);
  const [highPrecisionMode, setHighPrecisionMode] = useState(true);
  const [horizonsLoading, setHorizonsLoading] = useState(false);
  const [horizonsError, setHorizonsError] = useState<string | null>(null);
  const [horizonsVectors, setHorizonsVectors] = useState<HorizonsVector[]>([]);
  const [residualRows, setResidualRows] = useState<ResidualRow[]>([]);
  const [archiveStatus, setArchiveStatus] = useState<string | null>(null);

  useEffect(() => {
    onHighPrecisionModeChange?.(highPrecisionMode);
  }, [highPrecisionMode, onHighPrecisionModeChange]);

  const selectedBodies = useMemo<ForecastBodyName[]>(() => {
    return includeMoons
      ? ([...PLANET_BODIES, ...MOON_BODIES] as ForecastBodyName[])
      : ([...PLANET_BODIES] as ForecastBodyName[]);
  }, [includeMoons]);

  const estimatedRows = useMemo(() => {
    const pointCount = Math.floor(Math.max(0, daysAhead) / Math.max(1, stepDays)) + 1;
    return pointCount * selectedBodies.length;
  }, [daysAhead, selectedBodies.length, stepDays]);

  const confidence = useMemo(() => estimateTrajectoryConfidence(daysAhead), [daysAhead]);
  const sunEstimate = useMemo(() => estimateSunEvolution(daysAhead), [daysAhead]);

  const forecastRows = useMemo<ForecastRow[]>(() => {
    if (estimatedRows > 150_000) {
      return [];
    }

    return selectedBodies.map((body) => ({
      body,
      points: predictBodyTrajectory(body, currentDate, daysAhead, stepDays),
    }));
  }, [currentDate, daysAhead, estimatedRows, selectedBodies, stepDays]);

  const horizonSnapshot = useMemo(() => {
    return forecastRows
      .map((row) => {
        const last = row.points[row.points.length - 1];
        if (!last) return null;
        return { body: row.body, point: last };
      })
      .filter((entry): entry is { body: ForecastBodyName; point: PlanetTrajectoryPoint } => entry != null);
  }, [forecastRows]);

  const exportCsv = () => {
    if (forecastRows.length === 0) return;

    const csv = toCsv(
      forecastRows,
      confidence.orbitalConfidencePct,
      sunEstimate.stage,
      sunEstimate.modelConfidencePct,
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = currentDate.toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `trajectory_forecast_${stamp}_${daysAhead}d_step${stepDays}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const exportJsonl = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      modelDate: currentDate.toISOString(),
      daysAhead,
      stepDays,
      includeMoons,
      highPrecisionMode,
      confidence,
      sunEstimate,
      horizonsVectors,
      residualRows,
      forecastRows: forecastRows.map((row) => ({
        body: row.body,
        points: row.points.map((p) => ({
          date: p.date.toISOString(),
          x: p.x,
          y: p.y,
          z: p.z,
          rAU: p.rAU,
        })),
      })),
    };
    const blob = new Blob([toJsonl(payload)], { type: 'application/x-ndjson;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = currentDate.toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `trajectory_forecast_${stamp}_${daysAhead}d.ndjson`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const fetchHorizonsBaseline = async () => {
    setHorizonsLoading(true);
    setHorizonsError(null);
    try {
      const vectors = await Promise.all(selectedBodies.map((body) => fetchHorizonsVector(body, currentDate)));
      const typedVectors = vectors as HorizonsVector[];
      setHorizonsVectors(typedVectors);
      setResidualRows(computeResiduals(typedVectors, currentDate));
      onVectorsResolved?.(typedVectors);
    } catch (err) {
      setHorizonsError(String(err));
      setHorizonsVectors([]);
      setResidualRows([]);
      onVectorsResolved?.([]);
    } finally {
      setHorizonsLoading(false);
    }
  };

  const archiveSnapshot = async () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      modelDate: currentDate.toISOString(),
      daysAhead,
      stepDays,
      includeMoons,
      selectedBodies,
      confidence,
      sunEstimate,
      horizonsVectors,
      residualRows,
      horizonSnapshot: horizonSnapshot.map((entry) => ({
        body: entry.body,
        date: entry.point.date.toISOString(),
        x: entry.point.x,
        y: entry.point.y,
        z: entry.point.z,
        rAU: entry.point.rAU,
      })),
    };

    try {
      const base = fetchBaseUrl();
      const response = await fetch(`${base}/api/ephemeris/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Archive API HTTP ${response.status}`);
      }
      const result = await response.json();
      if (!result?.ok) {
        throw new Error(result?.error ?? 'Archive write failed');
      }
      setArchiveStatus(`Archived to ${result.file}`);
    } catch (err) {
      setArchiveStatus(`Archive API unavailable (${String(err)}). Use Export JSONL.`);
    }
  };

  const averageResidual = useMemo(() => {
    if (residualRows.length === 0) return null;
    const sumErr = residualRows.reduce((acc, row) => acc + row.errorAu, 0);
    const sumAcc = residualRows.reduce((acc, row) => acc + row.accuracyPct, 0);
    return {
      meanErrorAu: sumErr / residualRows.length,
      meanAccuracyPct: sumAcc / residualRows.length,
    };
  }, [residualRows]);

  const sourceLinks = [
    { label: 'NASA/JPL Horizons API', href: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html' },
    { label: 'JPL SPK/DE ephemerides', href: 'https://ssd.jpl.nasa.gov/ephem.html' },
    { label: 'IMCCE INPOP ephemerides', href: 'https://www.imcce.fr/inpop/' },
    { label: 'IAU MPC/Small-body orbit catalog', href: 'https://minorplanetcenter.net/' },
  ];

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#b8e6ff' }}>
      <div style={{ marginBlockEnd: '8px', fontSize: '9px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        Trajectory Forecast (Planets + Moons)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBlockEnd: '8px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span>Days Ahead</span>
          <input
            type="number"
            min={1}
            max={36525 * 50}
            value={daysAhead}
            onChange={(event) => setDaysAhead(Math.max(1, Number(event.currentTarget.value) || 1))}
            className="glass-input"
            style={{ padding: '4px 6px', fontSize: '10px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span>Step (days)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={stepDays}
            onChange={(event) => setStepDays(Math.max(1, Number(event.currentTarget.value) || 1))}
            className="glass-input"
            style={{ padding: '4px 6px', fontSize: '10px' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBlockStart: '18px' }}>
          <input
            type="checkbox"
            checked={includeMoons}
            onChange={(event) => setIncludeMoons(event.currentTarget.checked)}
          />
          Include Moons
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBlockEnd: '8px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox"
            checked={highPrecisionMode}
            onChange={(event) => {
              const enabled = event.currentTarget.checked;
              setHighPrecisionMode(enabled);
              onHighPrecisionModeChange?.(enabled);
            }}
          />
          High-Precision Mode (JPL Horizons compare)
        </label>
        {highPrecisionMode && (
          <button
            type="button"
            onClick={fetchHorizonsBaseline}
            disabled={horizonsLoading}
            className="time-jump-btn"
          >
            {horizonsLoading ? 'Fetching...' : 'Fetch Horizons Baseline'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBlockEnd: '8px' }}>
        <div style={{ opacity: 0.8 }}>
          Rows: {estimatedRows.toLocaleString()} | Bodies: {selectedBodies.length}
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={forecastRows.length === 0}
          style={{
            background: forecastRows.length > 0 ? 'rgba(0, 220, 150, 0.15)' : 'rgba(120, 120, 120, 0.12)',
            border: `1px solid ${forecastRows.length > 0 ? 'rgba(0, 220, 150, 0.45)' : 'rgba(120, 120, 120, 0.3)'}`,
            borderRadius: '6px',
            padding: '6px 12px',
            color: forecastRows.length > 0 ? '#9fffe0' : '#8ca0ad',
            cursor: forecastRows.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: '10px',
            fontFamily: 'monospace',
          }}
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={exportJsonl}
          disabled={forecastRows.length === 0}
          className="time-jump-btn"
        >
          Export JSONL
        </button>
        <button
          type="button"
          onClick={archiveSnapshot}
          className="time-jump-btn"
        >
          Archive Snapshot
        </button>
      </div>

      {archiveStatus && (
        <div style={{ marginBlockEnd: '8px', opacity: 0.85 }}>{archiveStatus}</div>
      )}

      {estimatedRows > 150_000 && (
        <div style={{ marginBlockEnd: '8px', color: '#ffb07a', opacity: 0.9 }}>
          Forecast too large for interactive generation. Increase step size or reduce horizon.
        </div>
      )}

      <div style={{ marginBlockEnd: '8px', padding: '6px 8px', border: '1px solid rgba(80, 180, 255, 0.25)', borderRadius: '6px', background: 'rgba(20, 30, 40, 0.45)' }}>
        <div>Orbital Confidence: <span style={{ color: '#8fe6ff' }}>{confidence.orbitalConfidencePct}%</span> ({confidence.horizonClass})</div>
        <div style={{ opacity: 0.8 }}>{confidence.notes}</div>
        <div style={{ marginBlockStart: '4px' }}>Sun Stage: <span style={{ color: '#ffd27a' }}>{sunEstimate.stage}</span></div>
        <div>Solar Model Confidence: <span style={{ color: '#ffd27a' }}>{sunEstimate.modelConfidencePct}%</span></div>
        <div style={{ opacity: 0.8 }}>{sunEstimate.notes}</div>
        {averageResidual && (
          <>
            <div style={{ marginBlockStart: '4px' }}>
              Horizons Residual Mean Error: <span style={{ color: '#7fffd4' }}>{averageResidual.meanErrorAu.toExponential(3)} AU</span>
            </div>
            <div>
              Empirical Position Match: <span style={{ color: '#7fffd4' }}>{averageResidual.meanAccuracyPct.toFixed(3)}%</span>
            </div>
          </>
        )}
        {horizonsError && <div style={{ color: '#ffb07a' }}>Horizons compare failed: {horizonsError}</div>}
      </div>

      {residualRows.length > 0 && (
        <div style={{ marginBlockEnd: '8px' }}>
          <div style={{ fontSize: '9px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', marginBlockEnd: '4px' }}>
            Internal vs Horizons Residuals
          </div>
          <div style={{ maxBlockSize: '120px', overflowY: 'auto', border: '1px solid rgba(90, 150, 210, 0.24)', borderRadius: '6px', padding: '6px' }} className="wolf-scroll">
            {residualRows.map((row) => (
              <div key={row.body} style={{ display: 'grid', gridTemplateColumns: '88px 1fr 1fr', gap: '6px', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#9fe8ff' }}>{row.body}</span>
                <span>Error {row.errorAu.toExponential(3)} AU</span>
                <span>Match {row.accuracyPct.toFixed(4)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBlockEnd: '8px' }}>
        <div style={{ fontSize: '9px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', marginBlockEnd: '4px' }}>
          Horizon Snapshot (AU)
        </div>
        <div style={{ maxBlockSize: '180px', overflowY: 'auto', border: '1px solid rgba(90, 150, 210, 0.24)', borderRadius: '6px', padding: '6px' }} className="wolf-scroll">
          {horizonSnapshot.map((entry) => (
            <div key={entry.body} style={{ display: 'grid', gridTemplateColumns: '88px 1fr 1fr 1fr', gap: '6px', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#9fe8ff' }}>{entry.body}</span>
              <span>X {entry.point.x.toFixed(5)}</span>
              <span>Y {entry.point.y.toFixed(5)}</span>
              <span>Z {entry.point.z.toFixed(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '9px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', marginBlockEnd: '4px' }}>
          Free High-Accuracy Sources (Fusion Inputs)
        </div>
        <div style={{ display: 'grid', gap: '4px' }}>
          {sourceLinks.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer" style={{ color: '#84d7ff', textDecoration: 'underline' }}>
              {link.label}
            </a>
          ))}
        </div>
        <div style={{ marginBlockStart: '6px', opacity: 0.75 }}>
          Recommended fusion strategy: JPL Horizons for baseline vectors, DE/SPK via SPICE for offline high-precision runs,
          INPOP as independent validation, MPC for small-body updates.
        </div>
      </div>
    </div>
  );
}
