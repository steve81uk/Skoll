interface EarthStoryTimelinePanelProps {
  visible?: boolean;
  lodStage: string;
  windSpeed: number;
  kpIndex: number;
  cmeActive: boolean;
  cmeImpactActive: boolean;
  blackoutVisible: boolean;
  dateLabel: string;
}

export default function EarthStoryTimelinePanel({
  visible = true,
  lodStage,
  windSpeed,
  kpIndex,
  cmeActive,
  cmeImpactActive,
  blackoutVisible,
  dateLabel,
}: EarthStoryTimelinePanelProps) {
  if (!visible) return null;

  const steps = [
    {
      id: 'solar',
      label: 'Heliophysics Trigger',
      status: cmeActive || windSpeed > 520 ? 'active' : 'monitoring',
      detail: `Solar wind ${Math.round(windSpeed)} km/s`,
    },
    {
      id: 'magnetosphere',
      label: 'Magnetosphere Compression',
      status: kpIndex >= 5 ? 'active' : 'monitoring',
      detail: `Kp ${kpIndex.toFixed(1)} indicates geomagnetic loading`,
    },
    {
      id: 'ionosphere',
      label: 'Atmospheric / Ionospheric Response',
      status: kpIndex >= 6 || blackoutVisible ? 'active' : 'monitoring',
      detail: blackoutVisible ? 'D-RAP blackout layer visible' : 'Awaiting elevated ionospheric absorption',
    },
    {
      id: 'surface',
      label: 'Surface-Level Impact',
      status: cmeImpactActive ? 'active' : 'pending',
      detail: cmeImpactActive ? 'Impact chain is active in Earth systems' : 'Grid/GNSS impact window not yet triggered',
    },
  ];

  const statusColor = (status: string) => {
    if (status === 'active') return 'text-amber-200 border-amber-400/35 bg-amber-500/10';
    if (status === 'pending') return 'text-cyan-200/70 border-cyan-500/25 bg-cyan-500/5';
    return 'text-cyan-100 border-cyan-500/30 bg-black/25';
  };

  return (
    <div className="pointer-events-none absolute bottom-24 left-[290px] z-[75] w-[min(440px,42vw)] rounded border border-cyan-500/30 bg-black/65 px-3 py-2 text-cyan-100 backdrop-blur-sm">
      <div className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/80">Earth Story Timeline</div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.1em] text-cyan-200/90">{dateLabel} • LOD {lodStage}</div>
      <div className="mt-2 grid gap-1.5">
        {steps.map((step, index) => (
          <div key={step.id} className={`rounded border px-2 py-1 ${statusColor(step.status)}`}>
            <div className="text-[9px] uppercase tracking-[0.1em]">{index + 1}. {step.label}</div>
            <div className="text-[8px] uppercase tracking-[0.07em] opacity-85">{step.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
