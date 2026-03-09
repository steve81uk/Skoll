import { useEffect, useMemo, useState } from 'react';
import MethodologyPopover from './MethodologyPopover';
import SourceBadge from './SourceBadge';
import iceCoreCsv from '../data/ice_core_co2.csv?raw';

function parseCo2Csv(text: string): Array<{ year: number; ppm: number }> {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && /\d/.test(l))
    .map((l) => l.split(','))
    .filter((parts) => parts.length > 3)
    .map((parts) => ({ year: Number(parts[0]), ppm: Number(parts[3]) }))
    .filter((d) => Number.isFinite(d.year) && Number.isFinite(d.ppm));
}

function parseIceCore(text: string): Array<{ yearBp: number; ppm: number }> {
  return text
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(','))
    .map((p) => ({ yearBp: Number(p[0]), ppm: Number(p[1]) }))
    .filter((d) => Number.isFinite(d.yearBp) && Number.isFinite(d.ppm));
}

export default function EmissionsImpact() {
  const [series, setSeries] = useState<Array<{ year: number; ppm: number }>>([]);
  const iceCore = useMemo(() => parseIceCore(iceCoreCsv), []);

  useEffect(() => {
    const load = async () => {
      try {
        const url = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv');
        const text = await (await fetch(url)).text();
        setSeries(parseCo2Csv(text));
      } catch {
        setSeries([]);
      }
    };
    load();
  }, []);

  const latest = series.at(-1)?.ppm ?? null;
  const oneYearAgo = series.length > 365 ? series.at(-366)?.ppm ?? null : null;
  const tenYearAgo = series.length > 3650 ? series.at(-3651)?.ppm ?? null : null;

  const rateYear = latest != null && oneYearAgo != null ? latest - oneYearAgo : null;
  const rateDecade = latest != null && tenYearAgo != null ? (latest - tenYearAgo) / 10 : null;
  const rf = latest != null ? 5.35 * Math.log(latest / 278) : null;

  return (
    <div className="space-y-2 text-cyan-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em]">Emissions Impact Estimator</div>
        <MethodologyPopover title="Emissions Impact" methodology="Radiative forcing uses IPCC-style logarithmic relation RF = 5.35 * ln(C/C0), C0=278 ppm. Solar forcing comparison shown for scale context." />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[9px] uppercase tracking-[0.08em]">
        <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">Current CO2 {latest?.toFixed(2) ?? '--'} ppm<br/><SourceBadge label="NOAA GML" url="https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv" /></div>
        <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">RF {rf?.toFixed(3) ?? '--'} W/m2<br/><SourceBadge label="IPCC AR6 formula" /></div>
        <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">Rate {rateYear?.toFixed(2) ?? '--'} ppm/yr<br/><SourceBadge label="NOAA daily derived" /></div>
        <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">Rate {rateDecade?.toFixed(2) ?? '--'} ppm/yr (decade)<br/><SourceBadge label="NOAA trend derived" /></div>
      </div>

      <div className="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[9px] uppercase tracking-[0.08em]">
        Solar cycle forcing reference ~0.1 W/m2 vs anthropogenic CO2 forcing shown above.
      </div>

      <div className="rounded border border-cyan-500/20 bg-black/25 px-2 py-1 text-[9px] uppercase tracking-[0.08em]">
        Ice-core baseline samples loaded: {iceCore.length} points over 800,000 years.
        <div className="mt-1"><SourceBadge label="Bundled ice-core sample" /></div>
      </div>
    </div>
  );
}
