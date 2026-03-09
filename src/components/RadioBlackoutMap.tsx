import MethodologyPopover from './MethodologyPopover';
import SourceBadge from './SourceBadge';

interface Props {
  flareClass: string;
  fluxWm2: number;
}

function estimateRecoveryMinutes(flux: number) {
  if (flux > 1e-3) return 180;
  if (flux > 1e-4) return 120;
  if (flux > 1e-5) return 75;
  return 30;
}

export default function RadioBlackoutMap({ flareClass, fluxWm2 }: Props) {
  const duration = estimateRecoveryMinutes(fluxWm2);
  const severity = fluxWm2 > 1e-4 ? 'Severe' : fluxWm2 > 1e-5 ? 'Moderate' : 'Low';

  return (
    <div className="space-y-2 text-cyan-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em]">HF Radio Blackout Map</div>
        <MethodologyPopover title="HF Absorption" methodology="Severity and recovery are estimated from GOES X-ray flux class aligned with NOAA D-RAP operational categories for daylit hemisphere HF absorption." />
      </div>
      <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1 text-[9px] uppercase tracking-[0.08em]">
        Class {flareClass} • Flux {fluxWm2.toExponential(2)} W/m2 • {severity} • Recovery ~{duration} min
      </div>
      <div className="text-[9px] uppercase tracking-[0.08em] text-cyan-200/90">Affected first: polar HF routes, oceanic aviation, maritime long-range HF links.</div>
      <SourceBadge label="NOAA D-RAP / GOES" url="https://www.swpc.noaa.gov/" />
    </div>
  );
}
