/**
 * SKÖLL-TRACK — FORECAST RADAR SLATE
 * Glassmorphism circular ML threat radar.
 * Renders four axes: KP Threat · Solar Wind · CME Pressure · Aurora Intensity
 * All values are derived live from the GlobalTelemetry hook via props.
 */

import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import { calculateExoTelemetry, SYSTEM_CONSTANTS } from '../ml/ExoPhysics';
import { CosmicTooltip } from './CosmicTooltip';
import type { TooltipContent } from '../context/TooltipContext';
import { PanelDescription } from './PanelDescription';

// ─── CosmicTooltip content for each readout cell ──────────────────────────────
const RADAR_COSMIC: Record<string, TooltipContent> = {
  KP:   { title: 'Magnetic Storm Index',  description: 'The Kp-index (0–9) measures disturbances in Earth\'s magnetic field. Values above 5 indicate storm conditions that can disrupt GPS, satellite links, and power grids.', accentColor: '#22d3ee' },
  WIND: { title: 'Solar Wind Speed',      description: 'How fast charged particles from the Sun are streaming past Earth (km/s). Fast wind compresses our magnetic shield and fuels auroras.',               accentColor: '#44bbff' },
  CME:  { title: 'CME Plasma Pressure',   description: 'A Coronal Mass Ejection is a giant cloud of solar plasma. High pressure squeezes Earth\'s magnetosphere closer to the planet — satellites in danger.',  accentColor: '#ff8844' },
  AUR:  { title: 'Aurora Intensity',      description: 'Energetic particle precipitation driving current auroral displays. At high levels the Northern Lights can be seen as far south as the mid-latitudes.',     accentColor: '#cc44ff' },
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface ForecastRadarProps {
  kpIndex: number;
  windSpeed: number;
  standoffDistance: number;
  currentIntensity: number;
  cmeImpactActive: boolean;
  /** When supplied, radar axes are physics-scaled for that planet's distance from the Sun */
  planetName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CX = 100;
const CY = 100;
const R_MAX = 72; // max radar radius in SVG units

/** Map a 0-1 normalised value to a point on the given axis (0=top, 90=right, ...) */
function polarPoint(angleDeg: number, magnitude: number): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return [
    CX + magnitude * R_MAX * Math.cos(rad),
    CY + magnitude * R_MAX * Math.sin(rad),
  ];
}

/** Build the SVG polygon points string from the four threat values. */
function buildPolygon(kp: number, wind: number, cme: number, aurora: number): string {
  const top = polarPoint(0, kp);       // KP  — North
  const right = polarPoint(90, wind);  // Wind — East
  const bottom = polarPoint(180, cme); // CME  — South
  const left = polarPoint(270, aurora);// Aurora — West
  return [top, right, bottom, left].map(([x, y]) => `${x},${y}`).join(' ');
}

/** Choose glow color based on threat magnitude. */
function threatColor(v: number): string {
  if (v >= 0.8) return '#ff4455';
  if (v >= 0.55) return '#ffaa22';
  if (v >= 0.3) return '#22eecc';
  return '#44bbff';
}

// ─── Sweep canvas effect ──────────────────────────────────────────────────────
const SweepLine: FC<{ color: string }> = ({ color }) => (
  <line
    x1={CX}
    y1={CY}
    x2={CX}
    y2={CY - R_MAX}
    stroke={color}
    strokeWidth="1.2"
    strokeLinecap="round"
    opacity="0.85"
    style={{
      transformOrigin: `${CX}px ${CY}px`,
      animation: 'skoll-radar-sweep 4s linear infinite',
    }}
  />
);

// ─── Individual axis blip ─────────────────────────────────────────────────────
const AxisBlip: FC<{ angleDeg: number; value: number; label: string }> = ({
  angleDeg,
  value,
  label,
}) => {
  const [px, py] = polarPoint(angleDeg, value);
  const [lx, ly] = polarPoint(angleDeg, 1.22);
  const color = threatColor(value);

  return (
    <g>
      {/* Outer ping ring */}
      <circle cx={px} cy={py} r="5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5">
        <animate attributeName="r" values="3;8;3" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
      </circle>
      {/* Core dot */}
      <circle cx={px} cy={py} r="2.8" fill={color} opacity="0.95" />
      {/* Axis label */}
      <text
        x={lx}
        y={ly + 1.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#94d8f8"
        fontSize="6.2"
        fontFamily="'Courier New', monospace"
        letterSpacing="0.06em"
        opacity="0.9"
      >
        {label}
      </text>
    </g>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const ForecastRadarSlate: FC<ForecastRadarProps> = ({
  kpIndex,
  windSpeed,
  standoffDistance,
  currentIntensity,
  cmeImpactActive,
  planetName,
}) => {
  // ── Per-planet physics scaling ──
  const isEarth = !planetName || planetName === 'Earth' || !(planetName in SYSTEM_CONSTANTS);
  const exo = !isEarth
    ? calculateExoTelemetry(
        planetName as keyof typeof SYSTEM_CONSTANTS,
        7,
        windSpeed,
        6,
        kpIndex,
        new Date(),
      )
    : null;

  // Solar wind density relative to Earth baseline (1 AU)
  const densityFactor = exo ? Math.min(3, exo.solarWindDensity / 7) : 1;

  // ── Normalise to 0–1 (planet-aware) ──
  const kpNorm = Math.min(1, (kpIndex / 9) * (isEarth ? 1 : densityFactor));
  const windNorm = exo
    ? Math.min(1, Math.max(0, exo.solarWindSpeed / 700))
    : Math.min(1, Math.max(0, windSpeed / 700));
  const cmePressureBase = exo
    ? Math.min(1, Math.max(0, (8 - exo.standoffDistance) / 6))
    : Math.min(1, Math.max(0, (8 - standoffDistance) / 6));
  // Aurora: log-clamped for gas giants with enormous magnetospheres
  const auroraIntensity = Math.min(
    1,
    Math.max(
      0,
      currentIntensity *
        (isEarth ? 1 : Math.min(2.5, Math.log1p(densityFactor * 2) / Math.log1p(2))),
    ),
  );

  // Boost CME pressure while active
  const cmeDisplay = cmeImpactActive ? Math.min(1, cmePressureBase + 0.35) : cmePressureBase;

  const overallThreat = (kpNorm + windNorm + cmeDisplay + auroraIntensity) / 4;
  const polygonPts = buildPolygon(kpNorm, windNorm, cmeDisplay, auroraIntensity);
  const polyColor = threatColor(overallThreat);

  // Inject keyframe once
  const styleInjected = useRef(false);
  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes skoll-radar-sweep {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Threat label
  const threatLabel =
    overallThreat >= 0.75
      ? 'CRITICAL'
      : overallThreat >= 0.5
        ? 'HIGH'
        : overallThreat >= 0.28
          ? 'MODERATE'
          : 'NOMINAL';

  const threatLabelColor =
    overallThreat >= 0.75
      ? 'text-red-400'
      : overallThreat >= 0.5
        ? 'text-amber-400'
        : overallThreat >= 0.28
          ? 'text-cyan-300'
          : 'text-emerald-400';

  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="relative rounded-xl border border-cyan-500/20 bg-black/55 backdrop-blur-xl overflow-hidden">
      {/* Top-edge glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_2px_rgba(34,211,238,0.6)] animate-pulse" />
          <span className="text-xs uppercase tracking-[0.22em] text-cyan-400/90 font-mono">
            {planetName && !isEarth ? planetName : 'Earth'} — ML Radar
          </span>
          <PanelDescription
            id="forecast-radar"
            title="ML Forecast Radar"
            summary="Multi-factor space weather threat radar combining solar wind, geomagnetic Kp, CME arrival probability, and X-ray flux into a single threat score for the selected planet."
            axes="Radar axes (spokes): each spoke represents a different space-weather parameter. The coloured polygon shows current threat levels — the further from centre, the higher the risk on that axis. Overall threat level is shown top-right."
            whyItMatters="This radar gives a rapid, at-a-glance picture of combined space weather threat. Individual metrics can look benign, but multiple elevated parameters simultaneously dramatically increase risk to satellites, power grids, and communications."
            size="xs"
          />
        </div>
        <span className={`text-xs uppercase tracking-[0.2em] font-mono font-bold ${threatLabelColor}`}>
          {threatLabel}
        </span>
      </div>

      {/* Radar SVG */}
      <div className="flex justify-center px-2 pb-1">
        <svg
          viewBox="0 0 200 200"
          width="200"
          height="200"
          className="overflow-visible"
          aria-label="ML Threat Radar"
        >
          <defs>
            {/* Radial glow gradient for the polygon fill */}
            <radialGradient id="radarPolyGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={polyColor} stopOpacity="0.30" />
              <stop offset="100%" stopColor={polyColor} stopOpacity="0.04" />
            </radialGradient>
            {/* Sweep gradient: bright at line, fade toward centre */}
            <linearGradient id="sweepGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.45" />
            </linearGradient>
            {/* Clip to radar circle */}
            <clipPath id="radarClip">
              <circle cx={CX} cy={CY} r={R_MAX} />
            </clipPath>
          </defs>

          {/* ── Background disc ── */}
          <circle
            cx={CX}
            cy={CY}
            r={R_MAX}
            fill="rgba(0,18,32,0.72)"
            stroke="rgba(34,211,238,0.12)"
            strokeWidth="0.8"
          />

          {/* ── Concentric rings ── */}
          {rings.map((fraction) => (
            <circle
              key={fraction}
              cx={CX}
              cy={CY}
              r={fraction * R_MAX}
              fill="none"
              stroke="rgba(34,211,238,0.13)"
              strokeWidth={fraction === 1.0 ? '0.9' : '0.6'}
              strokeDasharray={fraction < 1.0 ? '2 3' : undefined}
            />
          ))}

          {/* ── Axis lines ── */}
          {[0, 90, 180, 270].map((deg) => {
            const [x2, y2] = polarPoint(deg, 1.0);
            return (
              <line
                key={deg}
                x1={CX}
                y1={CY}
                x2={x2}
                y2={y2}
                stroke="rgba(34,211,238,0.18)"
                strokeWidth="0.7"
                strokeDasharray="2 3"
              />
            );
          })}

          {/* ── Value tick labels on North axis ── */}
          {[0.25, 0.5, 0.75].map((v) => (
            <text
              key={v}
              x={CX + 2}
              y={CY - v * R_MAX}
              fill="rgba(148,216,248,0.45)"
              fontSize="4.5"
              fontFamily="monospace"
            >
              {Math.round(v * 100)}
            </text>
          ))}

          {/* ── Threat polygon ── */}
          <polygon
            points={polygonPts}
            fill="url(#radarPolyGrad)"
            stroke={polyColor}
            strokeWidth="1.2"
            strokeLinejoin="round"
            opacity="0.92"
          />

          {/* ── Rotating sweep sector (clipped) ── */}
          <g clipPath="url(#radarClip)">
            {/* Wide sector fill behind the sweep */}
            <path
              d={`M ${CX} ${CY} L ${CX} ${CY - R_MAX} A ${R_MAX} ${R_MAX} 0 0 1 ${CX + R_MAX * Math.sin((Math.PI / 180) * 60)} ${CY - R_MAX * Math.cos((Math.PI / 180) * 60)} Z`}
              fill="rgba(34,211,238,0.035)"
              style={{
                transformOrigin: `${CX}px ${CY}px`,
                animation: 'skoll-radar-sweep 4s linear infinite',
              }}
            />
            <SweepLine color="#22d3ee" />
          </g>

          {/* ── Blips at each axis value ── */}
          <AxisBlip angleDeg={0}   value={kpNorm}        label="KP" />
          <AxisBlip angleDeg={90}  value={windNorm}       label="WIND" />
          <AxisBlip angleDeg={180} value={cmeDisplay}     label="CME" />
          <AxisBlip angleDeg={270} value={auroraIntensity} label="AURORA" />

          {/* ── Centre crosshair ── */}
          <circle cx={CX} cy={CY} r="2" fill="#22d3ee" opacity="0.7" />
          <circle cx={CX} cy={CY} r="4.5" fill="none" stroke="#22d3ee" strokeWidth="0.6" opacity="0.4" />
        </svg>
      </div>

      {/* ── Numeric readouts (global CosmicTooltip only) ── */}
      <div className="relative px-2 pb-3">
        <div className="grid grid-cols-4 gap-0.5 text-center">
          {[
            { label: 'KP',   raw: kpIndex.toFixed(1),                       norm: kpNorm,         tipKey: 'KP'   },
            { label: 'WIND', raw: `${windSpeed.toFixed(0)}`,                norm: windNorm,        tipKey: 'WIND' },
            { label: 'CME',  raw: `${(cmeDisplay * 100).toFixed(0)}%`,      norm: cmeDisplay,      tipKey: 'CME'  },
            { label: 'AUR',  raw: `${(auroraIntensity * 100).toFixed(0)}%`, norm: auroraIntensity, tipKey: 'AUR'  },
          ].map(({ label, raw, norm, tipKey }) => (
            <CosmicTooltip key={label} content={RADAR_COSMIC[tipKey]}>
              <div
                className="rounded border bg-black/30 px-1 py-1 cursor-default select-none"
                style={{ borderColor: `${threatColor(norm)}44` }}
              >
                <div
                  className="text-xs uppercase tracking-[0.14em] font-mono"
                  style={{ color: 'rgba(148,216,248,0.85)' }}
                >
                  {label}
                </div>
                <div
                  className="text-xs font-bold font-mono tabular-nums mt-0.5"
                  style={{ color: threatColor(norm) }}
                >
                  {raw}
                </div>
              </div>
            </CosmicTooltip>
          ))}
        </div>
      </div>

      {/* CME Impact flash overlay */}
      {cmeImpactActive && (
        <div className="absolute inset-0 rounded-xl pointer-events-none border border-red-500/60 bg-red-500/5 animate-pulse" />
      )}

      {/* Bottom-edge glow line */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
    </div>
  );
};
