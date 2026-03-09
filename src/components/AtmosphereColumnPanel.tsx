import MethodologyPopover from './MethodologyPopover';
import SourceBadge from './SourceBadge';

type Props = {
  kp: number;
  solarCyclePhase: number;
};

const layers = [
  {
    name: 'Thermosphere',
    altitude: '85-600 km',
    tempK: '700-2000 K',
    composition: 'Atomic O / N2, NOx chemistry',
    effect: 'Particle precipitation -> NOx production -> ozone loss',
    confidence: 'Established',
  },
  {
    name: 'Mesosphere',
    altitude: '50-85 km',
    tempK: '180-270 K',
    composition: 'O3 traces, CO2 cooling',
    effect: 'Cosmic ray ionisation enhancement',
    confidence: 'Moderate',
  },
  {
    name: 'Stratosphere',
    altitude: '12-50 km',
    tempK: '220-270 K',
    composition: 'O3 peak, dry air',
    effect: 'UV flux modulation with solar cycle',
    confidence: 'Established',
  },
  {
    name: 'Troposphere',
    altitude: '0-12 km',
    tempK: '220-300 K',
    composition: 'CO2, H2O, aerosols',
    effect: 'GCR-cloud nucleation hypothesis',
    confidence: 'EXPERIMENTAL',
  },
];

export default function AtmosphereColumnPanel({ kp, solarCyclePhase }: Props) {
  return (
    <div className="space-y-2 text-cyan-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em]">Atmospheric Column & Space Weather</div>
        <MethodologyPopover
          title="Atmospheric Column"
          methodology="Temperature profiles use a standard atmosphere baseline with space-weather adjustment overlays. MERRA-2 integration points are prepared for profile replacement when endpoint access is available."
        />
      </div>
      <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.08em]">
        <span>Kp {kp.toFixed(1)}</span>
        <SourceBadge label="NOAA SWPC" url="https://www.swpc.noaa.gov/" />
        <span>Solar cycle phase {solarCyclePhase.toFixed(2)}</span>
        <SourceBadge label="SIDC" url="https://www.sidc.be/SILSO/" />
      </div>
      <div className="grid gap-1.5">
        {layers.map((layer) => (
          <div key={layer.name} className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">
            <div className="text-[9px] uppercase tracking-[0.1em]">{layer.name} ({layer.altitude})</div>
            <div className="text-[8px] uppercase tracking-[0.08em] text-cyan-200/90">Temperature profile: {layer.tempK}</div>
            <div className="text-[8px] uppercase tracking-[0.08em] text-cyan-200/90">Composition: {layer.composition}</div>
            <div className="text-[8px] uppercase tracking-[0.08em] text-cyan-200/90">Space weather effect: {layer.effect}</div>
            <div className="text-[8px] uppercase tracking-[0.08em] text-amber-200/90">Evidence level: {layer.confidence}</div>
            <div className="mt-1 flex gap-1">
              <SourceBadge label="NASA MERRA-2" url="https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/" />
              <SourceBadge label="NOAA GML Ozone" url="https://gml.noaa.gov/ozwv/" />
              <SourceBadge label="NOAA GML CO2" url="https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
