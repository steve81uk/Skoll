import { useMemo, useState, type FC } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ComposedChart, Line, ReferenceLine } from 'recharts';
import { getRecentMajorSolarEvents } from '../ml/PredictiveEngine';
import { useNeuralOracle } from '../hooks/useNeuralOracle';
import type { HazardTelemetryModel } from '../services/hazardModel';
import type { ForecastAlert } from '../ml/types';

interface OracleModuleProps {
  snapshot: HazardTelemetryModel;
  alerts?: ForecastAlert[];
  aurorEyeSync?: {
    total: number;
    alignedCount: number;
    alignmentRatio: number;
    meanSkewMs: number | null;
    maxSkewMs: number;
    ready: boolean;
  };
}

export const OracleModule: FC<OracleModuleProps> = ({ snapshot, alerts = [], aurorEyeSync }) => {
  const events = useMemo(() => getRecentMajorSolarEvents().slice(0, 3), []);
  const [prompt, setPrompt] = useState('');
  const [showExplain, setShowExplain] = useState(false);
  const [explainMode, setExplainMode] = useState<'global' | 'local'>('global');
  const { provider, ready, loading, anomalyLoading, explaining, error, messages, explanation, ask, explain } = useNeuralOracle();

  const chartRows = useMemo(
    () => (explanation?.weights ?? []).map((row) => ({
      feature: row.feature,
      impact: Math.round(row.weight * 100),
      magnitude: Math.round(Math.abs(row.weight) * 100),
      note: row.note,
    })),
    [explanation],
  );

  const waterfallRows = useMemo(() => {
    let cumulative = 0;
    return (explanation?.weights ?? []).map((row) => {
      const delta = Math.round(row.weight * 100);
      const start = cumulative;
      const end = start + delta;
      cumulative = end;
      return {
        feature: row.feature,
        delta,
        start,
        end,
        base: Math.min(start, end),
        magnitude: Math.abs(delta),
        note: row.note,
      };
    });
  }, [explanation]);

  const waterfallDomain = useMemo(() => {
    if (waterfallRows.length === 0) {
      return [-100, 100] as [number, number];
    }

    let min = 0;
    let max = 0;
    waterfallRows.forEach((row) => {
      min = Math.min(min, row.start, row.end);
      max = Math.max(max, row.start, row.end);
    });
    return [Math.floor(min - 10), Math.ceil(max + 10)] as [number, number];
  }, [waterfallRows]);

  const explainSummary = explanation?.summary ?? 'No explanation generated yet. Click Explain to compute model attribution weights.';
  const primaryAlert = alerts[0] ?? null;
  const localLead = explanation?.mode === 'local' ? explanation.weights[0] : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-lg font-mono"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] text-cyan-500 tracking-[0.2em] uppercase">Neural Oracle</div>
          <h3 className="text-sm text-white uppercase tracking-wide">Live Hazard Interpreter</h3>
        </div>
        <div className="text-[8px] uppercase tracking-[0.12em] text-cyan-300/80">
          {ready
            ? provider === 'local-webgpu'
              ? 'Local WebGPU · instant lane'
              : provider === 'local-cpu'
                ? 'Local CPU · instant lane'
                : 'rules engine'
            : 'initializing'}
        </div>
      </div>

      {anomalyLoading && (
        <div className="mb-2 rounded border border-amber-400/30 bg-black/40 px-2 py-1 text-[8px] uppercase tracking-[0.12em] text-amber-200/90">
          Asynchronous cloud anomaly pass in progress...
        </div>
      )}

      <div className="mb-3 rounded border border-cyan-500/20 bg-black/45 p-2 text-[9px] uppercase tracking-[0.08em] text-cyan-200/90">
        Kp {snapshot.kpIndex.toFixed(1)} · Bz {snapshot.bzGsm.toFixed(1)} nT · Wind {Math.round(snapshot.solarWindSpeed)} km/s · {snapshot.flareClass}
        <div className="mt-1 text-[8px] tracking-[0.12em] text-cyan-400/80">
          TOTPOT {snapshot.totpot.toFixed(1)} · SAVNCPP {snapshot.savncpp.toFixed(2)} · TOTUSJZ {snapshot.totusjz.toFixed(1)}
        </div>
        {aurorEyeSync && (
          <div className="mt-1 text-[8px] tracking-[0.12em] text-cyan-400/70">
            Auroreye Sync {aurorEyeSync.ready ? `${aurorEyeSync.alignedCount}/${aurorEyeSync.total} aligned` : 'standby'}
            {aurorEyeSync.meanSkewMs != null ? ` · mean skew ${Math.round(aurorEyeSync.meanSkewMs)}ms` : ''}
          </div>
        )}
      </div>

      <div className="mb-3 rounded border border-cyan-500/25 bg-black/45 p-2 min-w-[21rem]">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[9px] uppercase tracking-[0.14em] text-cyan-300">Explainability</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExplainMode('global')}
              className={`h-6 px-2 rounded border text-[8px] uppercase tracking-[0.12em] ${explainMode === 'global' ? 'border-cyan-300 text-cyan-100' : 'border-cyan-500/30 text-cyan-400/80'}`}
            >
              SHAP Global
            </button>
            <button
              type="button"
              onClick={() => setExplainMode('local')}
              className={`h-6 px-2 rounded border text-[8px] uppercase tracking-[0.12em] ${explainMode === 'local' ? 'border-cyan-300 text-cyan-100' : 'border-cyan-500/30 text-cyan-400/80'}`}
            >
              LIME Local
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !showExplain;
                setShowExplain(next);
                if (next) {
                  explain(explainMode, snapshot, prompt);
                }
              }}
              className="h-6 px-2 rounded border border-cyan-500/35 text-[8px] uppercase tracking-[0.12em] text-cyan-200"
            >
              {explaining ? '…' : showExplain ? 'Hide' : 'Explain'}
            </button>
          </div>
        </div>

        {showExplain && (
          <div className="mt-2 space-y-2">
            <div className="h-36 w-full rounded border border-cyan-500/20 bg-black/30 p-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <XAxis dataKey="feature" tick={{ fill: '#93c5fd', fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-10} textAnchor="end" height={36} />
                  <YAxis tick={{ fill: '#67e8f9', fontSize: 9 }} axisLine={false} tickLine={false} width={28} domain={[0, 100]} />
                  <Tooltip
                    cursor={{ fill: 'rgba(34,211,238,0.08)' }}
                    formatter={(value: number | string | undefined) => {
                      const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                      return [`${Math.round(numeric)}%`, 'Impact'];
                    }}
                    contentStyle={{
                      background: 'rgba(2,6,23,0.95)',
                      border: '1px solid rgba(34,211,238,0.35)',
                      borderRadius: '6px',
                      color: '#cffafe',
                      fontSize: '10px',
                    }}
                    labelStyle={{ color: '#93c5fd' }}
                  />
                  <Bar dataKey="impact" radius={[4, 4, 0, 0]}>
                    {chartRows.map((entry) => (
                      <Cell key={entry.feature} fill={entry.impact >= 0 ? 'rgba(34,211,238,0.82)' : 'rgba(244,114,182,0.85)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {explanation?.mode === 'local' && (
              <div className="h-40 w-full rounded border border-cyan-500/20 bg-black/30 p-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={waterfallRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <XAxis dataKey="feature" tick={{ fill: '#93c5fd', fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-10} textAnchor="end" height={36} />
                    <YAxis tick={{ fill: '#67e8f9', fontSize: 9 }} axisLine={false} tickLine={false} width={28} domain={waterfallDomain} />
                    <ReferenceLine y={0} stroke="rgba(148,163,184,0.45)" strokeDasharray="4 4" />
                    <Tooltip
                      cursor={{ fill: 'rgba(34,211,238,0.08)' }}
                      formatter={(value: number | string | undefined, name: string | undefined, item) => {
                        if (name === 'magnitude') {
                          const delta = Number(item?.payload?.delta ?? 0);
                          return [`${delta >= 0 ? '+' : ''}${delta}%`, 'Signed contribution'];
                        }
                        const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                        return [`${Math.round(numeric)}%`, name];
                      }}
                      contentStyle={{
                        background: 'rgba(2,6,23,0.95)',
                        border: '1px solid rgba(34,211,238,0.35)',
                        borderRadius: '6px',
                        color: '#cffafe',
                        fontSize: '10px',
                      }}
                      labelStyle={{ color: '#93c5fd' }}
                    />
                    <Bar dataKey="base" stackId="waterfall" fill="rgba(0,0,0,0)" isAnimationActive={false} />
                    <Bar dataKey="magnitude" stackId="waterfall" radius={[4, 4, 0, 0]}>
                      {waterfallRows.map((row) => (
                        <Cell key={`${row.feature}-wf`} fill={row.delta >= 0 ? 'rgba(34,211,238,0.82)' : 'rgba(244,114,182,0.88)'} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="end" stroke="rgba(251,191,36,0.9)" strokeWidth={1.5} dot={{ r: 2, fill: 'rgba(251,191,36,0.95)' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="text-[8px] leading-snug text-cyan-300/90">{explainSummary}</div>
            {primaryAlert && (
              <div className="rounded border border-amber-400/25 bg-black/40 p-2">
                <div className="text-[8px] uppercase tracking-[0.13em] text-amber-200/90">Why This Warning?</div>
                <div className="mt-1 text-[9px] text-amber-100/90">{primaryAlert.message}</div>
                <div className="mt-1 text-[8px] text-amber-300/80">
                  Severity {primaryAlert.severity.toUpperCase()} · Probability {Math.round(primaryAlert.probability * 100)}%
                </div>
                <div className="mt-1 text-[8px] text-cyan-300/80">
                  {localLead
                    ? `Top local driver: ${localLead.feature} (${localLead.weight >= 0 ? '+' : ''}${Math.round(localLead.weight * 100)}%)`
                    : 'Run LIME Local to generate instance-specific attribution for this alert.'}
                </div>
              </div>
            )}
            <div className="space-y-1">
              {chartRows.map((row) => (
                <div key={`${row.feature}-note`} className="text-[7px] text-cyan-500/70">
                  {row.feature}: {row.note}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-3 max-h-36 space-y-2 overflow-y-auto wolf-scroll pr-1">
        {messages.length === 0 ? (
          <div className="rounded border border-cyan-500/20 bg-black/45 px-2 py-2 text-[10px] text-cyan-200/70">
            Ask about storm hazard, comms impact, or Kessler cascade risk.
          </div>
        ) : (
          messages.slice(-5).map((message) => (
            <div
              key={message.at}
              className={`rounded border px-2 py-1.5 text-[10px] ${
                message.role === 'user'
                  ? 'border-cyan-500/30 bg-cyan-500/8 text-cyan-100'
                  : message.lane === 'anomaly'
                    ? 'border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-100'
                    : 'border-amber-500/30 bg-black/55 text-amber-100'
              }`}
            >
              {message.role === 'oracle' && message.lane === 'anomaly' && (
                <div className="mb-1 text-[7px] uppercase tracking-[0.14em] text-fuchsia-300/85">HF anomaly analysis</div>
              )}
              {message.text}
            </div>
          ))
        )}
      </div>

      <form
        className="mb-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask(prompt, snapshot);
          setPrompt('');
        }}
      >
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="e.g. What is the next 6h outage risk?"
          className="h-8 flex-1 rounded border border-cyan-500/30 bg-black/55 px-2 text-[10px] text-cyan-100 outline-none focus:border-cyan-300"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="h-8 rounded border border-cyan-500/40 px-2 text-[9px] uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-40"
        >
          {loading ? '...' : 'Ask'}
        </button>
      </form>

      {error && <div className="mb-3 text-[9px] text-red-300">{error}</div>}

      <div className="text-[9px] text-cyan-400/70 uppercase tracking-[0.16em] mb-2">Historical Context</div>

      <div className="space-y-2">
        {events.map((event) => (
          <div key={event.id} className="bg-black/45 border border-cyan-500/20 rounded p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] text-cyan-200 uppercase tracking-wide">{event.eventName}</div>
              <div className="text-[8px] text-amber-300 uppercase">Grid {event.gridImpact}</div>
            </div>
            <div className="text-[8px] text-slate-500 mt-1">Kp {event.kpIndex.toFixed(1)} // Threat {event.satelliteThreatScore}%</div>
            <div className="text-[8px] text-slate-300 mt-1">{event.summary}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
