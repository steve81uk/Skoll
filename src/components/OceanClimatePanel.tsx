import { useEffect, useMemo, useState } from 'react';
import MethodologyPopover from './MethodologyPopover';
import SourceBadge from './SourceBadge';

interface Props {
  co2Ppm: number | null;
}

export default function OceanClimatePanel({ co2Ppm }: Props) {
  const [sstC, setSstC] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const url = new URL('https://marine-api.open-meteo.com/v1/marine');
        url.searchParams.set('latitude', '0');
        url.searchParams.set('longitude', '-140');
        url.searchParams.set('daily', 'sea_surface_temperature');
        url.searchParams.set('timezone', 'UTC');
        const payload = await (await fetch(url.toString())).json();
        const values: number[] | undefined = payload?.daily?.sea_surface_temperature;
        if (Array.isArray(values) && values.length > 0) {
          setSstC(values.at(-1) ?? null);
        }
      } catch {
        setSstC(null);
      }
    };
    load();
  }, []);

  const pH = useMemo(() => {
    if (co2Ppm == null) return null;
    const delta = co2Ppm - 280;
    return 8.2 - delta * 0.002;
  }, [co2Ppm]);

  return (
    <div className="space-y-2 text-cyan-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em]">Ocean & Marine Connections</div>
        <MethodologyPopover title="Ocean Coupling" methodology="SST indicator uses free marine data endpoint as operational proxy. Acidification indicator uses a simplified CO2-to-pH sensitivity for communication context." />
      </div>
      <div className="grid grid-cols-2 gap-2 text-[9px] uppercase tracking-[0.08em]">
        <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">SST indicator {sstC?.toFixed(2) ?? '--'} C<br/><SourceBadge label="Marine API / NOAA OISST reference" url="https://psl.noaa.gov/data/gridded/data.noaa.oisst.v2.highres.html" /></div>
        <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">Ocean pH proxy {pH?.toFixed(3) ?? '--'}<br/><SourceBadge label="CO2-linked simplified model" /></div>
      </div>
      <div className="text-[9px] uppercase tracking-[0.08em] text-cyan-200/90">El Nino/La Nina pathway represented through SST anomaly context and long-wave forcing coupling.</div>
    </div>
  );
}
