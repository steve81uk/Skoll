import { useEffect, useMemo, useState } from 'react';
import MethodologyPopover from './MethodologyPopover';
import SourceBadge from './SourceBadge';

function parseCo2Csv(text: string): Array<{ date: string; ppm: number }> {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && /\d/.test(l))
    .map((l) => l.split(','))
    .filter((parts) => parts.length > 3)
    .map((parts) => ({ date: `${parts[0]}-${parts[1]}-${parts[2]}`, ppm: Number(parts[3]) }))
    .filter((d) => Number.isFinite(d.ppm));
}

export default function CarbonClimateLink() {
  const [co2, setCo2] = useState<number | null>(null);
  const [sunspots, setSunspots] = useState<number | null>(null);
  const [tsi, setTsi] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const co2Url = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv');
        const co2Text = await (await fetch(co2Url)).text();
        const rows = parseCo2Csv(co2Text);
        setCo2(rows.at(-1)?.ppm ?? null);
      } catch {
        setCo2(null);
      }

      try {
        const sunUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.sidc.be/SILSO/INFO/snmtotcsv.php');
        const txt = await (await fetch(sunUrl)).text();
        const row = txt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).at(-1) ?? '';
        const parts = row.split(';').map((p) => p.trim());
        setSunspots(Number(parts[3] ?? NaN));
      } catch {
        setSunspots(null);
      }

      try {
        const tsiUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://lasp.colorado.edu/data/tsis/tsi-4.0_daily_data.txt');
        const txt = await (await fetch(tsiUrl)).text();
        const vals = txt
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith(';'))
          .map((l) => l.split(/\s+/))
          .filter((p) => p.length >= 2)
          .map((p) => Number(p[1]))
          .filter((v) => Number.isFinite(v));
        setTsi(vals.at(-1) ?? null);
      } catch {
        setTsi(null);
      }
    };
    load();
  }, []);

  const pathways = useMemo(
    () => [
      'Solar UV variability -> stratospheric ozone production -> circulation changes -> CO2 mixing patterns',
      '11-year solar cycle -> TSI variation (~0.1%) -> small direct radiative forcing',
      'GCR modulation -> cloud nucleation -> albedo changes (EXPERIMENTAL)',
      'Geomagnetic storms -> thermospheric NOx -> descending NOx -> catalytic ozone destruction (Randall et al. 2007)',
    ],
    [],
  );

  return (
    <div className="space-y-2 text-cyan-100">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em]">Carbon Cycle Connection</div>
        <MethodologyPopover
          title="Solar-Atmosphere-Climate Link"
          methodology="Panel mixes observational feeds (CO2, sunspots, TSI) with mechanism-based pathways. Correlation views are descriptive, not causal proofs. Experimental pathways are explicitly flagged."
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-[9px] uppercase tracking-[0.08em]">
        <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">CO2 {co2?.toFixed(2) ?? '--'} ppm<br/><SourceBadge label="NOAA GML" url="https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv" /></div>
        <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">Sunspots {sunspots?.toFixed(0) ?? '--'}<br/><SourceBadge label="SIDC SILSO" url="https://www.sidc.be/SILSO/" /></div>
        <div className="rounded border border-cyan-500/30 bg-black/30 px-2 py-1">TSI {tsi?.toFixed(2) ?? '--'} W/m2<br/><SourceBadge label="LASP TSIS" url="https://lasp.colorado.edu/data/tsis/" /></div>
      </div>

      <div className="space-y-1">
        {pathways.map((p) => (
          <div key={p} className="rounded border border-cyan-500/20 bg-black/25 px-2 py-1 text-[9px] uppercase tracking-[0.08em]">{p}</div>
        ))}
      </div>
    </div>
  );
}
