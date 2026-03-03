import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NeuralBootProps {
  isLoaded: boolean;
  onComplete: () => void;
}

export const NeuralBoot: React.FC<NeuralBootProps> = ({ isLoaded, onComplete }) => {
  const [status, setStatus] = useState('INITIALISING SYSTEMS...');

  useEffect(() => {
    if (isLoaded) {
      setStatus('NEURAL SYNC COMPLETE');
      const timer = setTimeout(onComplete, 800); // Fast transition [cite: 2025-12-11]
      return () => clearTimeout(timer);
    }
  }, [isLoaded, onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
        transition={{ duration: 1.5, ease: "circOut" }}
        className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center font-mono overflow-hidden"
      >
        {/* The Digital Iris [cite: 2025-12-11] */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-b-2 border-cyan-500/30 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 border-t-2 border-cyan-400 rounded-full shadow-[0_0_30px_rgba(0,243,255,0.4)]"
          />
          <div className="w-2 h-2 bg-cyan-400 rotate-45 animate-pulse shadow-[0_0_15px_#00f3ff]" />
        </div>

        {/* Tactical Status Metadata [cite: 2025-12-11] */}
        <div className="mt-12 text-center">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-cyan-400 text-xs tracking-[0.4em] uppercase mb-2"
          >
            {status}
          </motion.div>
          <div className="text-[8px] text-slate-600 tracking-widest uppercase">
            JPL VECTORS // WMM2025 // OMNI-ENGINE v2.0 [cite: 2025-12-11]
          </div>
        </div>

        {/* Ambient scanning lines [cite: 2025-11-03] */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%]" />
      </motion.div>
    </AnimatePresence>
  );
};