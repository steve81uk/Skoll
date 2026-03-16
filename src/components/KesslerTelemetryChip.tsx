import { motion, useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion';
import { useEffect, useState } from 'react';

interface KesslerTelemetryChipProps {
  next24hProbability: number | null;
  angularScale: number;
}

export default function KesslerTelemetryChip({ next24hProbability, angularScale }: KesslerTelemetryChipProps) {
  const probTarget = useMotionValue(next24hProbability ?? 0);
  const scaleTarget = useMotionValue(angularScale);

  const probSpring = useSpring(probTarget, { stiffness: 110, damping: 28, mass: 0.8 });
  const scaleSpring = useSpring(scaleTarget, { stiffness: 90, damping: 26, mass: 0.9 });

  const [probDisplay, setProbDisplay] = useState(next24hProbability ?? 0);
  const [scaleDisplay, setScaleDisplay] = useState(angularScale);

  useEffect(() => {
    probTarget.set(next24hProbability ?? 0);
  }, [next24hProbability, probTarget]);

  useEffect(() => {
    scaleTarget.set(angularScale);
  }, [angularScale, scaleTarget]);

  useMotionValueEvent(probSpring, 'change', (latest) => {
    setProbDisplay(latest);
  });

  useMotionValueEvent(scaleSpring, 'change', (latest) => {
    setScaleDisplay(latest);
  });

  const probPct = Math.max(0, Math.min(100, probDisplay * 100));
  const threatTone = probPct >= 60 ? 'text-red-300 border-red-400/45 bg-red-500/10' : probPct >= 30 ? 'text-amber-200 border-amber-400/40 bg-amber-500/8' : 'text-cyan-100 border-cyan-400/35 bg-black/50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`pointer-events-auto rounded-md border px-2.5 py-1.5 backdrop-blur-md shadow-[0_0_22px_rgba(8,145,178,0.18)] ${threatTone}`}
    >
      <div className="text-[7px] uppercase tracking-[0.16em] text-cyan-400/80">Kessler Threat Net</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-[9px] uppercase tracking-[0.1em] text-cyan-300/85">24h</span>
        <span className="text-[11px] font-semibold tabular-nums">{probPct.toFixed(1)}%</span>
        <span className="text-cyan-500/40">|</span>
        <span className="text-[9px] uppercase tracking-[0.1em] text-cyan-300/85">ω</span>
        <span className="text-[11px] font-semibold tabular-nums">x{scaleDisplay.toFixed(2)}</span>
      </div>
    </motion.div>
  );
}
