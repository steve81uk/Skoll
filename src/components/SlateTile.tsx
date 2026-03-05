import { type FC, type ReactNode, useMemo } from 'react';

interface SlateTileProps {
  tileId: string;
  title: string;
  accent?: 'cyan' | 'amber' | 'violet' | 'red';
  isSelected: boolean;
  onSelect: (tileId: string) => void;
  maximizedTileId: string | null;
  children: ReactNode;
}

const accentClasses: Record<NonNullable<SlateTileProps['accent']>, string> = {
  cyan: 'border-cyan-400/40',
  amber: 'border-amber-400/40',
  violet: 'border-violet-400/40',
  red: 'border-red-400/40',
};

const accentGlowClasses: Record<NonNullable<SlateTileProps['accent']>, string> = {
  cyan: 'shadow-[0_0_30px_rgba(34,211,238,0.15),inset_0_1px_0_rgba(34,211,238,0.1)]',
  amber: 'shadow-[0_0_30px_rgba(251,191,36,0.15),inset_0_1px_0_rgba(251,191,36,0.1)]',
  violet: 'shadow-[0_0_30px_rgba(167,139,250,0.15),inset_0_1px_0_rgba(167,139,250,0.1)]',
  red: 'shadow-[0_0_30px_rgba(248,113,113,0.15),inset_0_1px_0_rgba(248,113,113,0.1)]',
};

export const SlateTile: FC<SlateTileProps> = ({
  tileId,
  title,
  accent = 'cyan',
  isSelected,
  onSelect,
  maximizedTileId,
  children,
}) => {
  const isMaximized = maximizedTileId === tileId;
  const shellClass = useMemo(() => {
    const glowEffect = isSelected ? accentGlowClasses[accent] : '';
    const selectedRing = isSelected 
      ? 'ring-2 ring-cyan-400/50 backdrop-saturate-200' 
      : 'backdrop-saturate-150';
    const base = `nasa-slate skoll-static-slate border ${accentClasses[accent]} font-mono pointer-events-auto w-full h-[268px] min-h-[268px] max-h-[268px] overflow-hidden ${selectedRing} ${glowEffect}`;
    if (isMaximized) {
      // [cite: 2025-12-11] Flex constraint: respect pillar boundaries (340px left + 280px right + 32px margins = 652px total)
      return `${base} fixed inset-x-[360px] inset-y-[72px] z-[120] overflow-auto wolf-scroll`;
    }
    return `${base}`;
  }, [accent, isMaximized, isSelected]);

  return (
    <section className={shellClass} onMouseDown={() => onSelect(tileId)}>
      <header className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-white/10 relative">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/90 font-semibold relative z-10">
          {title}
        </span>
        {isSelected && (
          <span className="text-[8px] uppercase tracking-[0.2em] text-cyan-300/90 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-400/30 relative z-10">
            Selected
          </span>
        )}
      </header>

      <div className={isMaximized ? '' : 'h-[220px] min-h-[220px] max-h-[220px] overflow-y-auto wolf-scroll pr-1'}>{children}</div>
    </section>
  );
};
