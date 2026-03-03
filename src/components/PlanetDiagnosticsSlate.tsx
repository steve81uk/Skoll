import React from 'react';
import { motion } from 'framer-motion';
import planetData from '../ml/planet_facts.json';
import type { ExoplanetTelemetry } from '../ml/ExoPhysics';

interface DiagnosticsProps {
  planetName: string;
  isVisible: boolean;
  exoTelemetry?: ExoplanetTelemetry;
}

export const PlanetDiagnosticsSlate: React.FC<DiagnosticsProps> = ({ planetName, isVisible, exoTelemetry }) => {
  const payload = planetData as { planets?: Array<{ name: string; gravity?: number; rotationSpeed?: number; auroraNote?: string }> };
  const data = payload.planets?.find((planet) => planet.name === planetName);

  if (!isVisible || !data) return null;

  return (
    <motion.div
      initial={{ x: -12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-lg font-mono pointer-events-auto shadow-[0_0_20px_rgba(0,243,255,0.1)]"
    >
      <div className="text-[10px] text-cyan-500 tracking-[0.2em] uppercase mb-1">Orbital Diagnostics</div>
      <h2 className="text-xl font-bold text-white tracking-tighter uppercase mb-4 border-b border-white/10 pb-2">
        {planetName}
      </h2>

      <div className="space-y-4">
        {/* Gravity Metric [cite: 2025-12-11] */}
        <div>
          <div className="text-[8px] text-slate-500 uppercase tracking-widest">Surface Gravity</div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg text-cyan-400 font-bold">{data.gravity ?? '—'}</span>
            <span className="text-[8px] text-cyan-700 font-bold">m/s²</span>
          </div>
        </div>

        {/* Rotation Metric [cite: 2025-12-11] */}
        <div>
          <div className="text-[8px] text-slate-500 uppercase tracking-widest">Rotational Velocity</div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg text-cyan-400 font-bold">{data.rotationSpeed ?? '—'}</span>
            <span className="text-[8px] text-cyan-700 font-bold">km/h</span>
          </div>
        </div>

        {/* Atmospheric Composition [cite: 2025-08-12, 2025-12-11] */}
        <div className="p-2 bg-cyan-500/5 rounded border border-cyan-500/10">
          <div className="text-[7px] text-cyan-600 uppercase tracking-tighter mb-1">Atmosphere Type</div>
          <div className="text-[9px] text-cyan-200 font-bold uppercase">{data.auroraNote ? 'Auroral Profile' : 'N/A'}</div>
        </div>

        {exoTelemetry && (
          <div className="p-2 bg-cyan-500/5 rounded border border-cyan-500/10">
            <div className="text-[7px] text-cyan-600 uppercase tracking-tighter mb-1">Local Magnetosphere</div>
            <div className="text-[9px] text-cyan-200 font-bold uppercase">
              {exoTelemetry.standoffDistance} Re // {exoTelemetry.expansionLatitude}°
            </div>
          </div>
        )}
      </div>
      
      {/* Visual scanning pulse [cite: 2025-11-03] */}
      <div className="absolute bottom-2 right-2 w-1 h-1 bg-cyan-500 rounded-full animate-ping" />
    </motion.div>
  );
};