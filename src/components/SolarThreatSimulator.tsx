import { useState, useCallback } from 'react';

/**
 * SolarThreatSimulator.tsx
 *
 * UI panel for configuring and launching custom synthetic CME events.
 * Parameters follow the NASA/NOAA Space Weather Scale definitions.
 *
 * On "LAUNCH CME", fires the `onLaunchCME` callback that App.tsx wires to
 * the existing CME propagation machinery.
 */

export interface SyntheticCME {
  speed: number;          // km/s  (typical: 200–3 000)
  density: number;        // particles/cm³ (typical: 5–100)
  bzNT: number;           // nT  (positive = northward / favourable; negative = storm)
  halfAngleDeg: number;   // degrees half-width (15=narrow, 90=full-halo)
  classLabel: string;     // X10, X5, M9, etc.
  label: string;          // user-facing event name
}

interface SolarThreatSimulatorProps {
  onLaunchCME: (cme: SyntheticCME) => void;
  isActive?: boolean;
}

// Preset scenarios  
const PRESETS: { name: string; cme: SyntheticCME }[] = [
  {
    name: 'Carrington 1859',
    cme: { speed: 2100, density: 80, bzNT: -120, halfAngleDeg: 75, classLabel: 'X45?', label: 'Carrington Event' },
  },
  {
    name: 'Halloween 2003',
    cme: { speed: 2125, density: 60, bzNT: -35,  halfAngleDeg: 60, classLabel: 'X28',  label: 'Halloween Storm' },
  },
  {
    name: 'March 1989',
    cme: { speed: 1400, density: 40, bzNT: -30,  halfAngleDeg: 50, classLabel: 'X15',  label: 'Hydro-Québec Event' },
  },
  {
    name: 'Moderate G3',
    cme: { speed:  800, density: 18, bzNT: -15,  halfAngleDeg: 35, classLabel: 'M9',   label: 'G3 Moderate Storm' },
  },
  {
    name: 'Quiet Filament',
    cme: { speed:  400, density:  8, bzNT:  -4,  halfAngleDeg: 25, classLabel: 'B5',   label: 'Slow Filament' },
  },
];

function bzToStormClass(bz: number): string {
  if (bz > -5)   return 'G0 — Quiet';
  if (bz > -12)  return 'G1 — Minor';
  if (bz > -22)  return 'G2 — Moderate';
  if (bz > -32)  return 'G3 — Strong';
  if (bz > -55)  return 'G4 — Severe';
  return 'G5 — Extreme';
}

function bzToColor(bz: number): string {
  if (bz > -5)   return '#22ddff';
  if (bz > -12)  return '#88ff44';
  if (bz > -22)  return '#ffdd22';
  if (bz > -32)  return '#ff8822';
  if (bz > -55)  return '#ff4422';
  return '#ff0000';
}

export default function SolarThreatSimulator({ onLaunchCME, isActive = false }: SolarThreatSimulatorProps) {
  const [speed,       setSpeed]       = useState(800);
  const [density,     setDensity]     = useState(20);
  const [bz,          setBz]          = useState(-15);
  const [halfAngle,   setHalfAngle]   = useState(45);
  const [classLabel,  setClassLabel]  = useState('X1');
  const [label,       setLabel]       = useState('Custom CME');
  const [launched,    setLaunched]    = useState(false);

  const launch = useCallback(() => {
    onLaunchCME({ speed, density, bzNT: bz, halfAngleDeg: halfAngle, classLabel, label });
    setLaunched(true);
    setTimeout(() => setLaunched(false), 3000);
  }, [onLaunchCME, speed, density, bz, halfAngle, classLabel, label]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setSpeed(preset.cme.speed);
    setDensity(preset.cme.density);
    setBz(preset.cme.bzNT);
    setHalfAngle(preset.cme.halfAngleDeg);
    setClassLabel(preset.cme.classLabel);
    setLabel(preset.cme.label);
  };

  const kpEstimate = Math.min(9, Math.max(0, (Math.abs(bz) / 12) * 4 + (speed / 500)));
  const stormClass = bzToStormClass(bz);

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#a0d8ff', display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* Active indicator */}
      {isActive && (
        <div style={{ padding: '4px 8px', background: 'rgba(255,80,0,0.18)', border: '1px solid rgba(255,80,0,0.45)', borderRadius: '5px', color: '#ff8844', fontSize: '9px', letterSpacing: '0.12em', textAlign: 'center', animation: 'pulse 1s infinite' }}>
          ⚡ CME IN TRANSIT — Impact T–{Math.floor(Math.random() * 30 + 10)}h
        </div>
      )}

      {/* Presets */}
      <div>
        <div style={{ fontSize: '8px', opacity: 0.55, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Historical Presets</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(100,180,255,0.25)',
                borderRadius: '4px',
                padding: '3px 8px',
                color: '#88ccff',
                fontSize: '9px',
                cursor: 'pointer',
                letterSpacing: '0.06em',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(100,180,255,0.6)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(100,180,255,0.25)')}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 50px', gap: '4px 8px', alignItems: 'center' }}>
        <Label>Speed</Label>
        <input type="range" min={200} max={3000} step={50}  value={speed}     onChange={(e) => setSpeed(+e.target.value)}     style={sliderStyle} />
        <Value color="#ffcc44">{speed} km/s</Value>

        <Label>Density</Label>
        <input type="range" min={2}   max={120} step={1}    value={density}   onChange={(e) => setDensity(+e.target.value)}   style={sliderStyle} />
        <Value color="#88ffcc">{density} /cc</Value>

        <Label>IMF Bz</Label>
        <input type="range" min={-150} max={20} step={1}   value={bz}        onChange={(e) => setBz(+e.target.value)}         style={sliderStyle} />
        <Value color={bzToColor(bz)}>{bz > 0 ? '+' : ''}{bz} nT</Value>

        <Label>Half-angle</Label>
        <input type="range" min={10}  max={90}  step={5}    value={halfAngle} onChange={(e) => setHalfAngle(+e.target.value)} style={sliderStyle} />
        <Value color="#aa88ff">{halfAngle}°</Value>
      </div>

      {/* Class label input */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ opacity: 0.55, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', width: '100px' }}>Flare Class</span>
        <input
          value={classLabel}
          onChange={(e) => setClassLabel(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(100,180,255,0.22)', borderRadius: '4px', color: '#ffcc44', padding: '3px 6px', width: '60px', fontSize: '11px', fontFamily: 'monospace', outline: 'none' }}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(100,180,255,0.22)', borderRadius: '4px', color: '#a0d8ff', padding: '3px 6px', fontSize: '10px', fontFamily: 'monospace', outline: 'none' }}
          placeholder="Event name…"
        />
      </div>

      {/* Estimated impact summary */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '7px 10px', border: `1px solid ${bzToColor(bz)}33` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px', textAlign: 'center' }}>
          <div><div style={{ fontSize: '8px', opacity: 0.55 }}>Transit Time</div><div style={{ color: '#ffcc44' }}>{(150_000_000 / speed / 3600).toFixed(1)}h</div></div>
          <div><div style={{ fontSize: '8px', opacity: 0.55 }}>Est. KP</div><div style={{ color: bzToColor(bz) }}>{kpEstimate.toFixed(1)}</div></div>
          <div><div style={{ fontSize: '8px', opacity: 0.55 }}>Storm Class</div><div style={{ color: bzToColor(bz), fontSize: '8px' }}>{stormClass}</div></div>
          <div><div style={{ fontSize: '8px', opacity: 0.55 }}>Width</div><div style={{ color: '#aa88ff' }}>{halfAngle >= 60 ? 'HALO' : halfAngle >= 45 ? 'WIDE' : 'NARROW'}</div></div>
        </div>
      </div>

      {/* Launch button */}
      <button
        onClick={launch}
        style={{
          background: launched ? 'rgba(80,255,160,0.18)' : 'rgba(255,80,0,0.22)',
          border: `1px solid ${launched ? 'rgba(80,255,160,0.6)' : 'rgba(255,80,0,0.6)'}`,
          borderRadius: '6px',
          padding: '8px',
          color: launched ? '#80ffcc' : '#ffaa44',
          fontSize: '12px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.3s',
        }}
      >
        {launched ? '✦ CME LAUNCHED' : '⚡ FIRE CME'}
      </button>
    </div>
  );
}

const sliderStyle: React.CSSProperties = {
  width: '100%',
  accentColor: '#44aaff',
  cursor: 'pointer',
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{children}</span>
);

const Value = ({ children, color }: { children: React.ReactNode; color?: string }) => (
  <span style={{ fontSize: '10px', fontWeight: 'bold', color: color ?? '#a0d8ff', textAlign: 'right', minWidth: '60px' }}>{children}</span>
);

import React from 'react';
