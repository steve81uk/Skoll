import React from 'react';
import { motion } from 'framer-motion';

interface HumanImpactProps {
  kpIndex: number;
  expansionLatitude: number;
  standoffDistance: number;
  cmeImpactActive?: boolean;
}

export const HumanImpactSlate: React.FC<HumanImpactProps> = ({ 
  kpIndex, 
  expansionLatitude, 
  standoffDistance,
  cmeImpactActive = false,
}) => {
  // Tactical Thresholds [cite: 2025-12-11]
  const isGpsDegraded = cmeImpactActive || kpIndex > 5;
  const isGridAtRisk = cmeImpactActive || kpIndex > 7;
  const isAviationRerouted = cmeImpactActive || expansionLatitude < 55;
  const isMagnetosphereCompressed = cmeImpactActive || standoffDistance < 6.0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`backdrop-blur-xl border p-4 rounded-lg font-mono pointer-events-auto ${
        cmeImpactActive ? 'bg-red-950/35 border-red-500/70' : 'bg-black/40 border-cyan-500/30'
      }`}
    >
      <div className={`text-[10px] tracking-[0.2em] uppercase mb-1 ${cmeImpactActive ? 'text-red-300' : 'text-cyan-500'}`}>
        Human Impact Report
      </div>
      <h2 className="text-sm font-bold text-white tracking-tighter uppercase mb-4 border-b border-white/10 pb-2">
        Infrastructure Status
      </h2>

      <div className="space-y-3">
        {/* GPS & Navigation [cite: 2025-12-11] */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[8px] uppercase tracking-widest text-slate-500">
            <span>GPS / GNSS Integrity</span>
            <span className={isGpsDegraded ? "text-amber-500" : "text-cyan-500"}>
              {isGpsDegraded ? "DEGRADED" : "NOMINAL"}
            </span>
          </div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className={cmeImpactActive ? 'h-full bg-red-500' : 'h-full bg-cyan-400'}
              animate={{ width: `${Math.max(10, 100 - kpIndex * 10)}%` }} 
            />
          </div>
          {isGpsDegraded && (
            <div className="text-[7px] text-amber-200 italic">⚠️ Signal scintillation detected in ionosphere.</div>
          )}
        </div>

        {/* Aviation & Flight Paths [cite: 2025-12-11] */}
        <div className="p-2 bg-white/5 rounded border border-white/10">
          <div className="text-[8px] text-slate-400 uppercase mb-1">Polar Aviation Status</div>
          <div className="text-[10px] font-bold">
            {isAviationRerouted ? (
              <span className="text-red-400 animate-pulse">🔴 REROUTING: High-latitude flights diverted.</span>
            ) : (
              <span className="text-green-400">🟢 CLEAR: Standard polar routes active.</span>
            )}
          </div>
        </div>

        {/* Power Grid Stability [cite: 2025-12-11] */}
        <div className="flex justify-between items-center p-2 border border-cyan-500/20 rounded">
          <div className="text-[8px] text-slate-400 uppercase">Grid GIC Risk</div>
          <div className={`text-[10px] font-bold ${isGridAtRisk ? 'text-red-500 underline' : 'text-white'}`}>
            {isGridAtRisk ? 'CRITICAL BREACH' : 'STABLE'}
          </div>
        </div>

        {/* Magnetosphere Compression [cite: 2025-12-11] */}
        <div className="mt-2 p-2 bg-cyan-900/20 rounded-md text-center">
          <div className="text-[7px] text-cyan-600 uppercase">Magnetopause Standoff</div>
          <div className="text-xs font-bold text-cyan-300">{standoffDistance} Re</div>
          {isMagnetosphereCompressed && (
            <div className="text-[6px] text-cyan-500 uppercase mt-1 animate-pulse">Satellite Exposure Imminent</div>
          )}
        </div>
      </div>
    </motion.div>
  );
};