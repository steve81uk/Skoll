import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface TimeNavigatorProps {
  onTimeChange: (date: Date) => void;
  currentDate: Date;
  onEpochSelect?: (year: number) => void;
}

export const GeologicalTimeNavigator: React.FC<TimeNavigatorProps> = ({ onTimeChange, currentDate, onEpochSelect }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Tactical Epochs [cite: 2025-12-11]
  const epochs = [
    { label: 'CRETACEOUS', year: -66000000, desc: 'Young Sun // Pre-Satellite' },
    { label: 'CARRINGTON', year: 1859, desc: 'Great Storm // Telegraph Era' },
    { label: 'PRESENT', year: 2026, desc: 'Neural Sync // Active HUD' },
    { label: 'FUTURE', year: 2100, desc: 'Post-Sync // Deep Space Colonization' }
  ];

  const handleEpochJump = (year: number) => {
    onEpochSelect?.(year);
    const newDate = new Date();
    if (year < 0) {
      // Handle ancient dates (simplification for simulation) [cite: 2025-12-11]
      newDate.setFullYear(2026); // Anchor for physics, but label as ancient
    } else {
      newDate.setFullYear(year);
    }
    onTimeChange(newDate);
  };

  return (
    <motion.div 
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[420px] h-8 bg-black/50 backdrop-blur-lg border border-cyan-500/20 rounded-full flex items-center px-4 gap-3 pointer-events-auto z-[100]"
    >
      <div className="text-[7px] text-cyan-500/70 font-bold tracking-[0.2em] uppercase shrink-0">Epoch</div>
      
      <div className="flex-1 flex justify-between relative px-1.5">
        {/* Progress Bar [cite: 2025-12-11] */}
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-cyan-900/40 -translate-y-1/2" />
        
        {epochs.map((epoch) => (
          <button
            key={epoch.label}
            onClick={() => handleEpochJump(epoch.year)}
            className="group relative flex flex-col items-center"
          >
            <div className={`w-1.5 h-1.5 rounded-full border transition-all ${
              currentDate.getFullYear() === epoch.year ? 'bg-cyan-400 border-white scale-125' : 'bg-black border-cyan-800/60'
            }`} />
            
            {isHovered && (
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -top-10 whitespace-nowrap bg-black/70 border border-cyan-500/15 px-2 py-1 rounded text-center"
              >
                <div className="text-[8px] font-bold text-white">{epoch.label}</div>
                <div className="text-[6px] text-slate-500">{epoch.desc}</div>
              </motion.div>
            )}
          </button>
        ))}
      </div>

      <div className="text-[8px] font-mono text-cyan-200 min-w-[48px] text-right">
        {currentDate.getFullYear() > 2026 ? `+${currentDate.getFullYear() - 2026}Y` : currentDate.getFullYear()}
      </div>
    </motion.div>
  );
}; 