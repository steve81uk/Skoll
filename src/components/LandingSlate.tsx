import type { FC } from 'react';

interface LandingSlateProps {
  planetName: string | null;
  onInitiateLanding: () => void;
}

export const LandingSlate: FC<LandingSlateProps> = ({ planetName, onInitiateLanding }) => {
  if (!planetName) {
    return null;
  }

  return (
    <div className="absolute right-4 top-32 w-52 glass-panel-intense p-2.5 pointer-events-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[7px] uppercase tracking-[0.25em] text-cyan-500/70">Landing Vector</div>
          <h3 className="text-xs uppercase tracking-wider text-cyan-100 font-bold">{planetName}</h3>
        </div>
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
      </div>
      <button
        type="button"
        onClick={onInitiateLanding}
        className="w-full h-7 text-[9px] font-bold uppercase tracking-[0.18em] glass-button hover:scale-[1.02]"
      >
        INITIATE LANDING
      </button>
    </div>
  );
};
