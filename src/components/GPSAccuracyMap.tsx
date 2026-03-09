import MethodologyPopover from './MethodologyPopover';
import SourceBadge from './SourceBadge';

interface Props {
  kpIndex: number;
  dRapVisible: boolean;
}

export default function GPSAccuracyMap({ kpIndex, dRapVisible }: Props) {
  const polarError = Math.max(1, 1 + kpIndex * 1.2 + (dRapVisible ? 3 : 0));
  const midError = Math.max(0.8, 0.8 + kpIndex * 0.6 + (dRapVisible ? 1.5 : 0));
  const equatorialError = Math.max(0.7, 0.7 + kpIndex * 0.45 + (dRapVisible ? 1.2 : 0));

  return (
    <div className="space-y-2 text-cyan-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em]">GPS Accuracy Degradation</div>
        <MethodologyPopover title="GPS Error Model" methodology="Empirical latitude-weighted scintillation proxy from Kp and DRAP state, intended for risk communication rather than certification-grade navigation performance." />
      </div>
      <div className="grid grid-cols-3 gap-1 text-[9px] uppercase tracking-[0.08em]">
        <div className="rounded border border-red-500/35 bg-red-500/10 px-2 py-1">Polar ±{polarError.toFixed(1)} m</div>
        <div className="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1">Mid ±{midError.toFixed(1)} m</div>
        <div className="rounded border border-cyan-500/35 bg-cyan-500/10 px-2 py-1">Eq ±{equatorialError.toFixed(1)} m</div>
      </div>
      <SourceBadge label="NOAA Kp / DRAP" url="https://www.swpc.noaa.gov/" />
    </div>
  );
}
