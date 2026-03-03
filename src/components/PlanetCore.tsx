/**
 * PlanetCore.tsx
 *
 * DOM panel showing a scientific cross-section of a planet's interior,
 * rendered as an SVG concentric-circle diagram.  Layers, radii and
 * temperatures are sourced from peer-reviewed planetary science data.
 *
 * References:
 *   Earth  — PREM model (Dziewonski & Anderson 1981)
 *   Mars   — InSight seismology (Stähler et al. 2021, Science)
 *   Jupiter — Wahl et al. (2017), Kaspi et al. (2018)
 *   Saturn — Mankovich & Fuller (2021)
 *   Others — Seiff et al. (1998), Jacobson et al. (2006), estimates
 */

interface CoreLayer {
  name:        string;
  /** Fraction 0–1 of total radius */
  rFrac:       number;
  color:       string;
  tempK:       string;
  state:       string;
}

interface PlanetCoreData {
  layers: CoreLayer[];
  surfaceColor: string;
  accent:       string;
}

const PLANET_DATA: Record<string, PlanetCoreData> = {
  Earth: {
    accent:       '#4fc3f7',
    surfaceColor: '#1a6ea8',
    layers: [
      { name: 'Inner Core',    rFrac: 0.20, color: '#ffdd44', tempK: '~5 400 K', state: 'Solid Fe-Ni' },
      { name: 'Outer Core',    rFrac: 0.55, color: '#ff8c00', tempK: '4 000–5 000 K', state: 'Liquid Fe-Ni' },
      { name: 'Lower Mantle',  rFrac: 0.80, color: '#c0533a', tempK: '2 000–4 000 K', state: 'Solid silicate' },
      { name: 'Upper Mantle',  rFrac: 0.93, color: '#9b3d22', tempK: '700–2 000 K',   state: 'Viscous silicate' },
      { name: 'Crust',         rFrac: 1.00, color: '#6b8c6a', tempK: '300–700 K',     state: 'Rock / ocean' },
    ],
  },
  Mars: {
    accent:       '#ff6b35',
    surfaceColor: '#8b3a1c',
    layers: [
      { name: 'Inner Core',    rFrac: 0.18, color: '#ffcc44', tempK: '~2 700 K',      state: 'Solid Fe-S (partial)' },
      { name: 'Outer Core',    rFrac: 0.48, color: '#dd6600', tempK: '2 000–2 700 K', state: 'Liquid Fe-S' },
      { name: 'Lower Mantle',  rFrac: 0.78, color: '#b84020', tempK: '1 200–2 000 K', state: 'Perovskite silicate' },
      { name: 'Upper Mantle',  rFrac: 0.95, color: '#8b3520', tempK: '600–1 200 K',   state: 'Olivine / pyroxene' },
      { name: 'Crust',         rFrac: 1.00, color: '#c8614a', tempK: '200–600 K',     state: 'Basalt / regolith' },
    ],
  },
  Venus: {
    accent:       '#ffaa22',
    surfaceColor: '#c47014',
    layers: [
      { name: 'Inner Core',    rFrac: 0.25, color: '#ffee44', tempK: '~5 000 K?',     state: 'Solid Fe-Ni (est.)' },
      { name: 'Outer Core',    rFrac: 0.55, color: '#ff8800', tempK: '4 000–5 000 K', state: 'Liquid Fe-Ni (est.)' },
      { name: 'Mantle',        rFrac: 0.90, color: '#c05a20', tempK: '1 500–4 000 K', state: 'Silicate' },
      { name: 'Crust',         rFrac: 1.00, color: '#a06030', tempK: '735 K surface', state: 'Basalt' },
    ],
  },
  Jupiter: {
    accent:       '#f0a840',
    surfaceColor: '#c07030',
    layers: [
      { name: 'Solid Core',    rFrac: 0.10, color: '#ffe060', tempK: '~36 000 K',     state: 'Rocky / ice (compressed)' },
      { name: 'Metallic H',    rFrac: 0.55, color: '#8888ff', tempK: '10 000–36 000 K', state: 'Metallic hydrogen' },
      { name: 'Liquid H/He',   rFrac: 0.80, color: '#9966cc', tempK: '2 000–10 000 K', state: 'Fluid hydrogen' },
      { name: 'Molecular H',   rFrac: 0.96, color: '#c08060', tempK: '165–2 000 K',    state: 'Gaseous H₂' },
      { name: 'Atmosphere',    rFrac: 1.00, color: '#d09060', tempK: '110–165 K cloud', state: 'NH₃ / H₂O bands' },
    ],
  },
  Saturn: {
    accent:       '#e8c880',
    surfaceColor: '#c8a860',
    layers: [
      { name: 'Rocky Core',    rFrac: 0.15, color: '#ffee88', tempK: '~12 000 K',      state: 'Rock/ice slush' },
      { name: 'Metallic H',    rFrac: 0.45, color: '#8888ee', tempK: '5 000–12 000 K', state: 'Metallic hydrogen' },
      { name: 'Liquid H/He',   rFrac: 0.75, color: '#aa88cc', tempK: '1 000–5 000 K',  state: 'Fluid hydrogen' },
      { name: 'Molecular H',   rFrac: 0.96, color: '#c8a850', tempK: '80–1 000 K',     state: 'H₂ / He' },
      { name: 'Atmosphere',    rFrac: 1.00, color: '#d4b870', tempK: '~95 K cloud',     state: 'NH₃ ice haze' },
    ],
  },
  Uranus: {
    accent:       '#88ddee',
    surfaceColor: '#40b0c0',
    layers: [
      { name: 'Rocky Core',    rFrac: 0.20, color: '#aaaaaa', tempK: '~5 000 K?',      state: 'Rocky silicate' },
      { name: 'Ice Mantle',    rFrac: 0.80, color: '#4488cc', tempK: '2 000–5 000 K',  state: 'H₂O/NH₃/CH₄ "ices"' },
      { name: 'Atmosphere',    rFrac: 1.00, color: '#66ddee', tempK: '~76 K cloud',     state: 'H₂/He/CH₄' },
    ],
  },
  Neptune: {
    accent:       '#4466ff',
    surfaceColor: '#2244aa',
    layers: [
      { name: 'Rocky Core',    rFrac: 0.20, color: '#888888', tempK: '~7 000 K?',      state: 'Silicate' },
      { name: 'Ice Mantle',    rFrac: 0.85, color: '#2266cc', tempK: '2 000–7 000 K',  state: 'Superionic water' },
      { name: 'Atmosphere',    rFrac: 1.00, color: '#4477ee', tempK: '~72 K cloud',     state: 'H₂/He/CH₄' },
    ],
  },
  Mercury: {
    accent:       '#bbbbbb',
    surfaceColor: '#888888',
    layers: [
      { name: 'Inner Core',    rFrac: 0.42, color: '#ffee44', tempK: '~2 000 K',       state: 'Solid Fe-Ni' },
      { name: 'Outer Core',    rFrac: 0.80, color: '#ff8800', tempK: '1 500–2 000 K',  state: 'Liquid Fe-S' },
      { name: 'Mantle',        rFrac: 0.96, color: '#887060', tempK: '700–1 500 K',    state: 'Silicate' },
      { name: 'Crust',         rFrac: 1.00, color: '#aaaaaa', tempK: '100–700 K',      state: 'Regolith' },
    ],
  },
};

const FALLBACK: PlanetCoreData = {
  accent:       '#88aacc',
  surfaceColor: '#446688',
  layers: [
    { name: 'Core',   rFrac: 0.30, color: '#ffdd44', tempK: '—', state: 'Unknown' },
    { name: 'Mantle', rFrac: 0.90, color: '#aa6644', tempK: '—', state: 'Unknown' },
    { name: 'Crust',  rFrac: 1.00, color: '#668844', tempK: '—', state: 'Unknown' },
  ],
};

export interface PlanetCoreProps {
  /** Name of the planet to display.  Falls back to generic view if unknown. */
  planetName?: string | null;
}

export default function PlanetCore({ planetName }: PlanetCoreProps) {
  const data: PlanetCoreData   = (planetName ? PLANET_DATA[planetName] : undefined) ?? FALLBACK;
  const accent = data.accent;

  const SIZE   = 120;   // SVG canvas size
  const CX     = SIZE / 2;
  const CY     = SIZE / 2;
  const MAXR   = SIZE / 2 - 4;

  // Reverse layers so outer is drawn first (painter's algorithm)
  const sorted = [...data.layers].reverse();

  return (
    <div
      style={{
        background:           'rgba(6,10,22,0.76)',
        backdropFilter:       'blur(22px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
        border:               `1px solid ${accent}28`,
        borderRadius:         '10px',
        overflow:             'hidden',
        width:                '100%',
        fontFamily:           'monospace',
        color:                '#c0d8f0',
        boxShadow:            `0 0 32px ${accent}14, 0 4px 24px rgba(0,0,0,0.68)`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px 6px', background: `linear-gradient(90deg,${accent}10 0%,transparent 100%)`, borderBottom: `1px solid ${accent}22` }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent, display: 'inline-block', boxShadow: `0 0 6px ${accent}` }} />
        <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, opacity: 0.85 }}>
          Interior Structure
        </span>
        {planetName && (
          <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: 2 }}>— {planetName}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '8px 10px 10px', alignItems: 'flex-start' }}>
        {/* Cross-section SVG */}
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flexShrink: 0 }}>
          {sorted.map((layer) => (
            <circle
              key={layer.name}
              cx={CX} cy={CY}
              r={layer.rFrac * MAXR}
              fill={layer.color}
              opacity={0.88}
            />
          ))}
          {/* Half-mask to show cross-section cut */}
          <rect x={CX} y={0} width={CX} height={SIZE} fill="rgba(4,8,18,0.82)" />
          {/* Dividing line */}
          <line x1={CX} y1={4} x2={CX} y2={SIZE - 4} stroke={accent} strokeWidth="0.8" opacity="0.4" />
          {/* Tick marks for each layer boundary on the left half */}
          {data.layers.map((layer) => (
            <line key={layer.name + '-tick'}
              x1={CX - layer.rFrac * MAXR} y1={CY}
              x2={CX}                      y2={CY}
              stroke={layer.color} strokeWidth="0.5" opacity="0.35"
            />
          ))}
          {!planetName && (
            <text x={CX} y={CY + 2} textAnchor="middle" fontSize="7" fill={accent} opacity="0.4">
              SELECT PLANET
            </text>
          )}
        </svg>

        {/* Layer table */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {data.layers.map((layer) => (
            <div key={layer.name} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '2px', background: layer.color, flexShrink: 0, marginTop: 1, opacity: 0.9 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#c8dff0', letterSpacing: '0.03em', lineHeight: 1.3 }}>{layer.name}</div>
                <div style={{ fontSize: '7px', opacity: 0.5, lineHeight: 1.3 }}>{layer.tempK}</div>
                <div style={{ fontSize: '7px', opacity: 0.4, lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{layer.state}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
