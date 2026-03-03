import type { FC } from 'react';
import { motion } from 'framer-motion';
import { Vector3 } from 'three';

export interface ActiveObject {
  id: string;
  name: string;
  operator: string;
  altitudeKm: number;
  inclinationDeg: number;
  orbitalNode: Vector3;
  hostPosition: Vector3;
  hostRadius: number;
}

interface HangarModuleProps {
  objects: ActiveObject[];
  onSelectObject: (object: ActiveObject) => void;
}

export const HangarModule: FC<HangarModuleProps> = ({ objects, onSelectObject }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-black/40 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-lg font-mono"
    >
      <div className="text-[10px] text-cyan-500 tracking-[0.2em] uppercase mb-1">Hangar Uplink</div>
      <h3 className="text-sm text-white uppercase tracking-wide mb-3">Active Human-Made Objects</h3>

      <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
        {objects.map((object) => (
          <button
            key={object.id}
            type="button"
            onClick={() => onSelectObject(object)}
            className="w-full text-left bg-black/45 border border-cyan-500/20 hover:border-cyan-400/50 rounded p-2 transition-colors"
          >
            <div className="text-[10px] text-cyan-200 uppercase tracking-wide">{object.name}</div>
            <div className="text-[8px] text-slate-400 uppercase tracking-wider">{object.operator}</div>
            <div className="mt-1 text-[8px] text-slate-300">
              ALT {object.altitudeKm.toLocaleString()} km // INC {object.inclinationDeg.toFixed(1)}°
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
};
