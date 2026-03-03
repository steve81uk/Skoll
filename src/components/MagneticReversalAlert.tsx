import { motion } from 'framer-motion';

export const MagneticReversalAlert = ({ active }: { active: boolean }) => {
  if (!active) return null;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
    >
      <div className="bg-red-950/40 backdrop-blur-2xl border-2 border-red-500 p-8 text-center rounded-full">
        <h1 className="text-4xl font-black text-red-500 animate-pulse tracking-tighter">POLE REVERSAL DETECTED</h1>
        <p className="text-red-200 text-xs uppercase mt-2">Magnetosphere Collapse Imminent // Cretaceous Mode Active</p>
      </div>
    </motion.div>
  );
};