import type { FC } from 'react';

/* ── Types ─────────────────────────────────────────────── */
interface TelemetryData {
  metSeconds?: number;
  kp?: number;
  fireballFlux?: number;
  fireballCount?: number;
}

interface NOAABundle {
  kpIndex?: number;
  solarWindSpeed?: number;
  bz?: number;
}

interface TrackedObject {
  name: string;
  altitudeKm: number;
  inclinationDeg: number;
}

interface LocationInfo {
  name: string;
  lat: number;
  lon: number;
}

export interface TelemetryRibbonProps {
  data: TelemetryData;
  mode?: 'fixed' | 'panel';
  currentPlanet?: string | null;
  trackedObject?: TrackedObject | null;
  location?: LocationInfo;
  bundle?: NOAABundle | null;
}

/* ── Constants ──────────────────────────────────────────── */
const PLANET_RADIATION: Record<string, { msvPerDay: number; label: string }> = {
  Mercury: { msvPerDay: 2000,      label: '2000 mSv/d'   },
  Venus:   { msvPerDay: 10,        label: '10 mSv/d'     },
  Earth:   { msvPerDay: 0.008,     label: '0.008 mSv/d'  },
  Mars:    { msvPerDay: 0.67,      label: '0.67 mSv/d'   },
  Jupiter: { msvPerDay: 3_600_000, label: '3.6M mSv/d'   },
  Saturn:  { msvPerDay: 3,         label: '3 mSv/d'      },
  Uranus:  { msvPerDay: 1.5,       label: '1.5 mSv/d'    },
  Neptune: { msvPerDay: 1.5,       label: '1.5 mSv/d'    },
};

const PLANET_DIST_AU: Record<string, number> = {
  Mercury: 0.39, Venus: 0.72, Earth: 1.00, Mars: 1.52,
  Jupiter: 5.20, Saturn: 9.54, Uranus: 19.2, Neptune: 30.1,
};

/* ── Helpers ────────────────────────────────────────────── */
function formatMET(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600).toString().padStart(2, '0');
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function auroraKpThreshold(lat: number): number {
  const a = Math.abs(lat);
  if (a >= 65) return 2;
  if (a >= 55) return 4;
  if (a >= 50) return 5;
  if (a >= 45) return 6;
  return 8;
}

function kpColor(kp: number) {
  if (kp >= 8) return '#ff3333';
  if (kp >= 6) return '#ff7700';
  if (kp >= 4) return '#ffcc00';
  return '#22ddff';
}

function radColor(msvPerDay: number) {
  if (msvPerDay > 10000) return '#ff3333';
  if (msvPerDay > 100)   return '#ff7700';
  if (msvPerDay > 1)     return '#ffcc44';
  return '#66ee99';
}

/* ── Pill sub-component ─────────────────────────────────── */
const Pill: FC<{ label: string; value: string; color?: string; pulse?: boolean }> = ({
  label, value, color = '#e0f0ff', pulse = false,
}) => (
  <div className="border border-cyan-500/20 rounded px-2 py-1.5">
    <div className="text-cyan-500/80">{label}</div>
    <div
      className={`font-semibold tabular-nums telemetry-value${pulse ? ' animate-pulse' : ''}`}
      style={{ color }}
    >
      {value}
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════
   PANEL MODE
   ══════════════════════════════════════════════════════════ */
const PanelMode: FC<Omit<TelemetryRibbonProps, 'mode'>> = ({
  data, currentPlanet, trackedObject, location, bundle,
}) => {
  const kp = bundle?.kpIndex ?? data.kp ?? 0;
  const isKpAlert = kp > 6;
  const loc = location ?? { name: 'Cambridge, UK', lat: 52.2, lon: 0.12 };
  const kpThreshold = auroraKpThreshold(loc.lat);
  const auroraVisible = kp >= kpThreshold;
  const planetRad = currentPlanet ? PLANET_RADIATION[currentPlanet] : null;
  const planetDist = currentPlanet ? PLANET_DIST_AU[currentPlanet] : null;

  return (
    <div className="rounded-md border border-cyan-500/20 bg-black/40 p-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px] uppercase tracking-[0.12em] font-mono">
        <Pill label="MET" value={formatMET(data.metSeconds ?? 0)} />
        <Pill label="KP IDX" value={kp.toFixed(1)} color={kpColor(kp)} pulse={isKpAlert} />

        {currentPlanet && planetRad ? (
          <>
            <Pill label="BODY" value={currentPlanet} color="#a0d4ff" />
            <Pill label="DIST FROM SUN" value={`${planetDist ?? '?'} AU`} color="#88bbff" />
            <Pill label="RADIATION DOSE" value={planetRad.label} color={radColor(planetRad.msvPerDay)} />
          </>
        ) : trackedObject ? (
          <>
            <Pill label="SATELLITE" value={trackedObject.name} color="#a0ffd4" />
            <Pill label="ALTITUDE" value={`${trackedObject.altitudeKm.toFixed(0)} km`} color="#88ffcc" />
            <Pill label="INCLINATION" value={`${trackedObject.inclinationDeg.toFixed(1)}°`} color="#88ffcc" />
          </>
        ) : (
          <Pill label="FIREBALL FLUX" value={String(data.fireballFlux ?? data.fireballCount ?? 0)} color="#ffcc44" />
        )}

        {/* Location card */}
        <div className="col-span-full border border-cyan-500/20 rounded px-2 py-1.5">
          <div className="text-cyan-500/80 mb-0.5">OBSERVER LOCATION</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-cyan-100 truncate">{loc.name}</span>
            <span
              className="shrink-0 rounded px-1 py-0.5 text-[8px]"
              style={{
                background: auroraVisible ? 'rgba(80,255,160,0.15)' : 'rgba(100,130,200,0.12)',
                border: `1px solid ${auroraVisible ? 'rgba(80,255,160,0.4)' : 'rgba(100,130,200,0.3)'}`,
                color: auroraVisible ? '#50ffa0' : '#7090d0',
              }}
            >
              AURORA {auroraVisible ? '✦ VISIBLE' : `KP≥${kpThreshold}`}
            </span>
          </div>
          <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (kp / kpThreshold) * 100)}%`,
                background: auroraVisible
                  ? 'linear-gradient(90deg,#22ffaa,#00ddff)'
                  : 'linear-gradient(90deg,#4466aa,#2255cc)',
              }}
            />
          </div>
          <div className="mt-0.5 text-[8px] text-cyan-500/60">
            {Math.round(Math.min(100, (kp / kpThreshold) * 100))}% toward visibility threshold
          </div>
        </div>

        {bundle?.solarWindSpeed != null && (
          <Pill label="SOLAR WIND" value={`${bundle.solarWindSpeed.toFixed(0)} km/s`} color="#ffaa44" />
        )}
        {bundle?.bz != null && (
          <Pill
            label="IMF Bz"
            value={`${bundle.bz > 0 ? '+' : ''}${bundle.bz.toFixed(1)} nT`}
            color={bundle.bz < -5 ? '#ff4444' : '#a0d4ff'}
          />
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   FIXED BAR MODE
   ══════════════════════════════════════════════════════════ */
const FixedBar: FC<Omit<TelemetryRibbonProps, 'mode'>> = ({
  data, currentPlanet, trackedObject, location, bundle,
}) => {
  const kp = bundle?.kpIndex ?? data.kp ?? 0;
  const isKpAlert = kp > 6;
  const loc = location ?? { name: 'Cambridge, UK', lat: 52.2, lon: 0.12 };
  const kpThreshold = auroraKpThreshold(loc.lat);
  const auroraVisible = kp >= kpThreshold;
  const planetRad = currentPlanet ? PLANET_RADIATION[currentPlanet] : null;

  let centreLabel: string;
  let centreValue: string;
  let centreColor: string;

  if (currentPlanet && planetRad) {
    centreLabel = `${currentPlanet.toUpperCase()} RAD`;
    centreValue = planetRad.label;
    centreColor = radColor(planetRad.msvPerDay);
  } else if (trackedObject) {
    centreLabel = trackedObject.name.toUpperCase();
    centreValue = `${trackedObject.altitudeKm.toFixed(0)} km  ${trackedObject.inclinationDeg.toFixed(1)}°`;
    centreColor = '#a0ffd4';
  } else {
    centreLabel = 'FIREBALL FLUX';
    centreValue = String(data.fireballFlux ?? data.fireballCount ?? 0);
    centreColor = '#ffcc44';
  }

  return (
    <div className="fixed top-0 left-0 z-[60] w-full h-7 bg-gradient-to-b from-black/60 via-black/40 to-transparent backdrop-blur-lg backdrop-saturate-150 border-b border-cyan-400/15 px-3 flex items-center justify-between text-[7px] uppercase tracking-[0.2em] font-mono text-cyan-300 shadow-[0_2px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(34,211,238,0.08)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />

      {/* Left: MET + KP */}
      <div className="flex items-center gap-3 tabular-nums whitespace-nowrap relative z-10 w-[34%] min-w-0">
        <span className="text-cyan-500/80">MET</span>
        <span className="text-cyan-100 font-semibold live-clock">{formatMET(data.metSeconds ?? 0)}</span>
        <span className="text-cyan-400/30">│</span>
        <span className="text-cyan-500/80">KP</span>
        <span
          className={`${isKpAlert ? 'font-bold drop-shadow-[0_0_6px_rgba(248,113,113,0.8)]' : 'font-semibold'} telemetry-value`}
          style={{ color: kpColor(kp) }}
        >
          {kp.toFixed(1)}
        </span>
      </div>

      {/* Centre: contextual */}
      <div className="flex items-center justify-center gap-2 tabular-nums whitespace-nowrap relative z-10 w-[32%] min-w-0">
        <span className="text-cyan-500/80">{centreLabel}</span>
        <span className="font-semibold telemetry-value" style={{ color: centreColor }}>{centreValue}</span>
      </div>

      {/* Right: location + aurora + solar wind */}
      <div className="flex items-center justify-end gap-2 whitespace-nowrap relative z-10 w-[34%] min-w-0">
        <span className="text-cyan-500/60">{loc.name.split(',')[0].toUpperCase()}</span>
        <span
          className="rounded px-1 py-px text-[7px]"
          style={{
            background: auroraVisible ? 'rgba(80,255,160,0.15)' : 'rgba(100,130,200,0.10)',
            border: `1px solid ${auroraVisible ? 'rgba(80,255,160,0.35)' : 'rgba(100,130,200,0.25)'}`,
            color: auroraVisible ? '#50ffa0' : '#6080b0',
            letterSpacing: '0.06em',
          }}
        >
          {auroraVisible ? '✦ AURORA' : `KP≥${kpThreshold}`}
        </span>
        {bundle?.solarWindSpeed != null && (
          <>
            <span className="text-cyan-400/30">│</span>
            <span className="text-cyan-500/80">SW</span>
            <span className="text-orange-300 font-semibold telemetry-value">{bundle.solarWindSpeed.toFixed(0)} km/s</span>
          </>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   EXPORT
   ══════════════════════════════════════════════════════════ */
export const TelemetryRibbon: FC<TelemetryRibbonProps> = (props) => {
  if (props.mode === 'panel') return <PanelMode {...props} />;
  return <FixedBar {...props} />;
};
