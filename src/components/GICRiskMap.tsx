import MethodologyPopover from './MethodologyPopover';
import SourceBadge from './SourceBadge';

interface Props {
  kpIndex: number;
}

function riskClass(kp: number) {
  if (kp < 4) return 'Green';
  if (kp < 6) return 'Yellow';
  if (kp < 8) return 'Orange';
  return 'Red';
}

export default function GICRiskMap({ kpIndex }: Props) {
  const zone = riskClass(kpIndex);

  return (
    <div className="space-y-2 text-cyan-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em]">GIC Risk Map</div>
        <MethodologyPopover title="GIC Risk" methodology="Risk bins combine Kp index, latitude weighting, and simplified ground resistivity proxy. Intended as operational situational awareness." />
      </div>
      <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1 text-[9px] uppercase tracking-[0.08em]">
        Current Kp {kpIndex.toFixed(1)} to dominant risk zone {zone}
      </div>
      <div className="grid grid-cols-2 gap-1 text-[9px] uppercase tracking-[0.08em]">
        <div className="rounded border border-green-500/35 bg-green-500/10 px-2 py-1">Green: Kp {'<'} 4</div>
        <div className="rounded border border-yellow-500/35 bg-yellow-500/10 px-2 py-1">Yellow: Kp 4-5</div>
        <div className="rounded border border-orange-500/35 bg-orange-500/10 px-2 py-1">Orange: Kp 6-7</div>
        <div className="rounded border border-red-500/35 bg-red-500/10 px-2 py-1">Red: Kp 8-9</div>
      </div>
      <SourceBadge label="NOAA SWPC Kp" url="https://www.swpc.noaa.gov/" />
    </div>
  );
}
