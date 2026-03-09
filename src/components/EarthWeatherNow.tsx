import { useEffect, useState } from 'react';

export type EarthWeatherCurrent = {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  wind_speed_10m: number;
  cloud_cover: number;
  relative_humidity_2m: number;
};

type OpenMeteoResponse = {
  current?: EarthWeatherCurrent;
};

type EarthWeatherNowProps = {
  visible?: boolean;
  latitude: number;
  longitude: number;
  locationName?: string;
  onCurrentChange?: (current: EarthWeatherCurrent | null) => void;
};

export default function EarthWeatherNow({
  visible = true,
  latitude,
  longitude,
  locationName = 'Earth Surface',
  onCurrentChange,
}: EarthWeatherNowProps) {
  const [current, setCurrent] = useState<EarthWeatherCurrent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    let canceled = false;
    const load = async () => {
      try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', String(latitude));
        url.searchParams.set('longitude', String(longitude));
        url.searchParams.set(
          'current',
          'temperature_2m,apparent_temperature,wind_speed_10m,cloud_cover,relative_humidity_2m',
        );
        url.searchParams.set('timezone', 'UTC');

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as OpenMeteoResponse;
        if (!canceled) {
          const next = payload.current ?? null;
          setCurrent(next);
          onCurrentChange?.(next);
          setError(null);
        }
      } catch (err) {
        if (!canceled) {
          setError(String(err));
          onCurrentChange?.(null);
        }
      }
    };

    load();
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      canceled = true;
      window.clearInterval(id);
    };
  }, [latitude, longitude, onCurrentChange, visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute bottom-24 right-4 z-[75] min-w-[220px] rounded border border-cyan-500/30 bg-black/65 px-3 py-2 text-cyan-100 backdrop-blur-sm">
      <div className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/80">Earth Live Weather</div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-cyan-100">{locationName}</div>
      {current ? (
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] uppercase tracking-[0.08em]">
          <span>Temp {current.temperature_2m.toFixed(1)} C</span>
          <span>Feels {current.apparent_temperature.toFixed(1)} C</span>
          <span>Wind {current.wind_speed_10m.toFixed(1)} km/h</span>
          <span>Cloud {Math.round(current.cloud_cover)}%</span>
          <span>Humidity {Math.round(current.relative_humidity_2m)}%</span>
          <span>{current.time.slice(11, 16)} UTC</span>
        </div>
      ) : (
        <div className="mt-1 text-[9px] uppercase tracking-[0.08em] text-cyan-300/80">Loading weather feed...</div>
      )}
      {error && <div className="mt-1 text-[8px] uppercase tracking-[0.08em] text-red-300/85">Feed error: {error}</div>}
    </div>
  );
}
