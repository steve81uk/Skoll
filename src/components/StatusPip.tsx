import { type FC, type PointerEvent, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatusPipProps {
  icon: LucideIcon;
  label: string;
  value: string;
  isActive: boolean;
  onClick: () => void;
  flickerClass?: string;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

export const StatusPip: FC<StatusPipProps> = ({
  icon: Icon,
  label,
  value,
  isActive,
  onClick,
  flickerClass = '',
  onHoverStart,
  onHoverEnd,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handlePointerEnter = () => {
    onHoverStart?.();
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      setShowTooltip(true);
    }, 200);
  };

  const handlePointerLeave = () => {
    onHoverEnd?.();
    clearHoverTimer();
    setShowTooltip(false);
  };

  const handleClick = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClick();
  };

  return (
    <button
      type="button"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      className={`group relative flex items-center justify-center w-7 h-7 rounded border border-cyan-500/25 bg-gradient-to-br from-black/40 to-black/20 backdrop-blur-lg backdrop-saturate-150 transition-all duration-200 hover:border-cyan-400/50 hover:scale-105 hover:shadow-[0_0_12px_rgba(34,211,238,0.15)] ${flickerClass} ${
        isActive ? 'shadow-[0_0_10px_rgba(34,211,238,0.25),inset_0_1px_0_rgba(34,211,238,0.15)]' : ''
      }`}
      aria-label={`${label} status pip`}
    >
      <Icon className={`w-2.5 h-2.5 transition-all ${isActive ? 'text-cyan-400 animate-pulse drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]' : 'text-cyan-700'}`} />

      {showTooltip && (
        <div className="absolute bottom-9 pointer-events-none z-[200]">
          <div className="nasa-slate text-[8px] whitespace-nowrap py-1.5 px-3 shadow-xl">
            {label.toUpperCase()}: <span className="text-white font-bold">{value}</span>
          </div>
        </div>
      )}
    </button>
  );
};
