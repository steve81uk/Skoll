import { useMemo, useState, type FC } from 'react';
import { motion } from 'framer-motion';
import { getRecentMajorSolarEvents } from '../ml/PredictiveEngine';
import { useNeuralOracle } from '../hooks/useNeuralOracle';
import type { HazardTelemetryModel } from '../services/hazardModel';

interface OracleModuleProps {
  snapshot: HazardTelemetryModel;
}

export const OracleModule: FC<OracleModuleProps> = ({ snapshot }) => {
  const events = useMemo(() => getRecentMajorSolarEvents().slice(0, 3), []);
  const [prompt, setPrompt] = useState('');
  const { provider, ready, loading, error, messages, ask } = useNeuralOracle();

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
          {ready ? provider : 'initializing'}
        </div>
      </div>

      <div className="mb-3 rounded border border-cyan-500/20 bg-black/45 p-2 text-[9px] uppercase tracking-[0.08em] text-cyan-200/90">
        Kp {snapshot.kpIndex.toFixed(1)} · Bz {snapshot.bzGsm.toFixed(1)} nT · Wind {Math.round(snapshot.solarWindSpeed)} km/s · {snapshot.flareClass}
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
                  : 'border-amber-500/30 bg-black/55 text-amber-100'
              }`}
            >
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
