import type { FC } from 'react';
import { motion } from 'framer-motion';
import { getRecentMajorSolarEvents } from '../ml/PredictiveEngine';

export const OracleModule: FC = () => {
  const events = getRecentMajorSolarEvents().slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-lg font-mono"
    >
      <div className="text-[10px] text-cyan-500 tracking-[0.2em] uppercase mb-1">Oracle Archive</div>
      <h3 className="text-sm text-white uppercase tracking-wide mb-3">Major Solar Events // Last 5</h3>

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
