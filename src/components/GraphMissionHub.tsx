import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { KPPoint } from '../hooks/useNOAADONKI';
import MethodologyPopover from './MethodologyPopover';
import SourceBadge from './SourceBadge';

type Props = {
  kpSeries: KPPoint[];
  kpForecast24h: number[];
  co2Ppm: number | null;
  goesFluxWm2: number;
};

type Mode = 'past' | 'present' | 'future' | 'prediction';
type Range = '6h' | '24h' | '72h';

const AXIS = { fontSize: 10, fill: '#8cc8ea' };

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export default function GraphMissionHub({ kpSeries, kpForecast24h, co2Ppm, goesFluxWm2 }: Props) {
  const [mode, setMode] = useState<Mode>('past');
  const [range, setRange] = useState<Range>('24h');

  const observed = useMemo(() => {
    const windowHours = range === '6h' ? 6 : range === '24h' ? 24 : 72;
    const points = kpSeries.filter((p) => p.source === 'observed').slice(-windowHours * 2);
    return points.map((p) => ({ t: fmtTime(p.time), kp: Number(p.kp.toFixed(2)) }));
  }, [kpSeries, range]);

  const future = useMemo(() => {
    const now = Date.now();
    return kpForecast24h.slice(0, 24).map((kp, idx) => {
      const ts = new Date(now + (idx + 1) * 3600_000);
      return { t: `${String(ts.getUTCHours()).padStart(2, '0')}:00`, kp: Number(kp.toFixed(2)) };
    });
  }, [kpForecast24h]);

  const merged = useMemo(() => {
    return [
      ...observed.map((row) => ({ ...row, kind: 'Observed', flux: null as number | null, co2: co2Ppm })),
      ...future.map((row, idx) => ({
        ...row,
        kind: 'Forecast',
        flux: Number((goesFluxWm2 * (1 + idx * 0.02)).toExponential(2)),
        co2: co2Ppm,
      })),
    ];
  }, [co2Ppm, future, goesFluxWm2, observed]);

  const modeButtons: Array<{ key: Mode; label: string }> = [
    { key: 'past', label: 'Past' },
    { key: 'present', label: 'Now' },
    { key: 'future', label: 'Future' },
    { key: 'prediction', label: 'Pred' },
  ];

  return (
    <div className="space-y-2 text-cyan-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em]">Graph Mission Hub</div>
        <MethodologyPopover
          title="Graph Hub"
          methodology="Observed Kp comes from NOAA SWPC feeds and forecast Kp from internal LSTM output windows. Future flux curve is a conservative scenario projection for visual planning, not a deterministic forecast."
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.08em]">
        <SourceBadge label="NOAA SWPC Kp" url="https://www.swpc.noaa.gov/" />
        <SourceBadge label="Internal LSTM Forecast" />
        <SourceBadge label="NOAA GML CO2" url="https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv" />
        <select
          value={range}
          onChange={(event) => setRange(event.currentTarget.value as Range)}
          className="glass-input px-2 py-1 text-[9px] uppercase"
          title="Graph history range"
        >
          <option value="6h">6h</option>
          <option value="24h">24h</option>
          <option value="72h">72h</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {modeButtons.map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => setMode(btn.key)}
            className={`rounded border px-2 py-1 text-[9px] uppercase tracking-[0.08em] ${mode === btn.key ? 'border-cyan-300 bg-cyan-500/15 text-cyan-50' : 'border-cyan-500/30 bg-black/20 text-cyan-200/90'}`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="h-[230px] rounded border border-cyan-500/25 bg-black/25 p-2">
        {mode === 'past' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={observed} margin={{ top: 8, right: 6, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,180,220,0.14)" />
              <XAxis dataKey="t" tick={AXIS} />
              <YAxis domain={[0, 9]} tick={AXIS} />
              <Tooltip />
              <Line dataKey="kp" type="monotone" stroke="#5ad1ff" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {mode === 'present' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={merged.slice(Math.max(0, merged.length - 16))} margin={{ top: 8, right: 6, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,180,220,0.14)" />
              <XAxis dataKey="t" tick={AXIS} />
              <YAxis domain={[0, 9]} tick={AXIS} />
              <Tooltip />
              <Area dataKey="kp" type="monotone" stroke="#22d3ee" fill="rgba(34,211,238,0.24)" />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {mode === 'future' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={future} margin={{ top: 8, right: 6, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,180,220,0.14)" />
              <XAxis dataKey="t" tick={AXIS} />
              <YAxis domain={[0, 9]} tick={AXIS} />
              <Tooltip />
              <Line dataKey="kp" type="monotone" stroke="#f59e0b" dot={false} strokeWidth={2} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        )}

        {mode === 'prediction' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={merged} margin={{ top: 8, right: 6, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,180,220,0.14)" />
              <XAxis dataKey="t" tick={AXIS} />
              <YAxis yAxisId="left" domain={[0, 9]} tick={AXIS} />
              <YAxis yAxisId="right" orientation="right" tick={AXIS} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" dataKey="kp" name="Kp" type="monotone" stroke="#60c8ff" dot={false} strokeWidth={2} />
              <Line yAxisId="right" dataKey="flux" name="GOES Flux" type="monotone" stroke="#f97316" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
