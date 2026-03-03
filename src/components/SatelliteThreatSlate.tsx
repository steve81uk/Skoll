import { motion } from 'framer-motion';
import { predictSolarImpact } from '../ml/PredictiveEngine';

export const SatelliteThreatSlate = ({ kpIndex }: { kpIndex: number }) => {
  const score = predictSolarImpact(kpIndex);
  const isCritical = score > 75;
  const dragIncrease = (score / 12).toFixed(2);
  const radiationMsv = (score / 18).toFixed(2);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/60 backdrop-blur-xl border p-4 rounded-lg font-mono transition-colors duration-500 ${
        isCritical ? 'border-red-500 animate-alert-pulse' : 'border-cyan-500/30'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-[8px] text-slate-500 uppercase tracking-widest">Orbital Safety Index</div>
          <h2 className={`text-lg font-bold uppercase ${isCritical ? 'text-red-400' : 'text-white'}`}>
            {isCritical ? 'High Risk' : 'Nominal'}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-bold text-cyan-400">{score}%</div>
          <div className="text-[7px] text-cyan-700 uppercase">Impact Prob.</div>
        </div>
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <div className="flex justify-between text-[9px]">
          <span className="text-slate-400 italic underline">Predicted Satellite Drag:</span>
          <span className="text-white font-bold">+{dragIncrease} m/s²</span>
        </div>
        <div className="flex justify-between text-[9px]">
          <span className="text-slate-400 italic underline">Crew Radiation Exposure:</span>
          <span className={isCritical ? 'text-red-400' : 'text-cyan-200'}>{radiationMsv} mSv/h</span>
        </div>
        <div className="flex justify-between text-[9px]">
          <span className="text-slate-400 italic underline">Starlink Stability:</span>
          <span className="text-white">{isCritical ? 'Degraded' : 'Stable'}</span>
        </div>
      </div>
    </motion.div>
  );
};