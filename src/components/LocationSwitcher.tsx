import React from 'react';

export interface LocationPreset {
  name: string;
  lat: number;
  lon: number;
}

export const LOCATION_PRESETS: LocationPreset[] = [
  { name: 'Cambridge, UK',      lat:  52.20, lon:   0.12 },
  { name: 'London, UK',         lat:  51.51, lon:  -0.12 },
  { name: 'Reykjavik, Iceland', lat:  64.13, lon: -21.93 },
  { name: 'Tromsø, Norway',     lat:  69.65, lon:  18.96 },
  { name: 'Anchorage, USA',     lat:  61.22, lon: -149.90 },
  { name: 'New York, USA',      lat:  40.71, lon:  -74.01 },
  { name: 'Chicago, USA',       lat:  41.88, lon:  -87.63 },
  { name: 'Los Angeles, USA',   lat:  34.05, lon: -118.24 },
  { name: 'Toronto, Canada',    lat:  43.65, lon:  -79.38 },
  { name: 'Paris, France',      lat:  48.86, lon:   2.35 },
  { name: 'Berlin, Germany',    lat:  52.52, lon:  13.40 },
  { name: 'Tokyo, Japan',       lat:  35.69, lon: 139.69 },
  { name: 'Hong Kong',          lat:  22.32, lon: 114.17 },
  { name: 'Dubai, UAE',         lat:  25.20, lon:  55.27 },
  { name: 'Sydney, Australia',  lat: -33.87, lon: 151.21 },
];

interface LocationSwitcherProps {
  value: LocationPreset;
  onChange: (loc: LocationPreset) => void;
}

export default function LocationSwitcher({ value, onChange }: LocationSwitcherProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = LOCATION_PRESETS.find((p) => p.name === e.target.value);
    if (preset) onChange(preset);
  };

  const absLat = Math.abs(value.lat);
  const hemi = value.lat >= 0 ? 'N' : 'S';
  const kpNeeded =
    absLat >= 65 ? 2 : absLat >= 55 ? 4 : absLat >= 50 ? 5 : absLat >= 45 ? 6 : 8;

  return (
    <div
      className="location-switcher"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(10,20,40,0.65)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(100,180,255,0.18)',
        borderRadius: '8px',
        padding: '4px 10px',
        fontSize: '11px',
        color: '#a0d4ff',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Globe icon */}
      <span style={{ opacity: 0.7, fontSize: '13px' }}>🌍</span>

      <select
        value={value.name}
        onChange={handleChange}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#a0d4ff',
          fontSize: '11px',
          fontFamily: 'inherit',
          cursor: 'pointer',
          outline: 'none',
          maxWidth: '140px',
        }}
        title="Observer location for aurora & localised forecasts"
      >
        {LOCATION_PRESETS.map((p) => (
          <option
            key={p.name}
            value={p.name}
            style={{ background: '#0a1428', color: '#a0d4ff' }}
          >
            {p.name}
          </option>
        ))}
      </select>

      {/* Lat badge */}
      <span
        style={{
          opacity: 0.55,
          fontSize: '10px',
          letterSpacing: '0.03em',
        }}
      >
        {Math.abs(value.lat).toFixed(1)}°{hemi}
      </span>

      {/* Aurora threshold badge */}
      <span
        title={`Aurora visible here at KP ≥ ${kpNeeded}`}
        style={{
          background: kpNeeded <= 4 ? 'rgba(80,255,160,0.18)' : 'rgba(100,130,200,0.18)',
          border: `1px solid ${kpNeeded <= 4 ? 'rgba(80,255,160,0.4)' : 'rgba(100,130,200,0.3)'}`,
          borderRadius: '4px',
          padding: '1px 5px',
          color: kpNeeded <= 4 ? '#50ffa0' : '#7090d0',
          fontSize: '10px',
          letterSpacing: '0.04em',
          cursor: 'default',
        }}
      >
        KP≥{kpNeeded}
      </span>
    </div>
  );
}
