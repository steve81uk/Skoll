/**
 * SceneLegend.tsx — SKÖLL-TRACK Scene Discovery Guide
 *
 * A floating "What am I looking at?" reference panel that explains every
 * visual element in the 3D canvas in plain English. Designed to be usable
 * by anyone — from space-weather engineers to first-time visitors.
 *
 * Props:
 *   kpIndex        — current geomagnetic Kp (drives aurora live context)
 *   solarWindSpeed — km/s (drives corona/wind live context)
 *   flareClass     — e.g. "X1.2" (drives flare live context)
 */

import { useState, useCallback } from 'react';

interface SceneLegendProps {
  kpIndex?: number;
  solarWindSpeed?: number;
  flareClass?: string;
}

interface LegendItem {
  color: string;
  name: string;
  plain: string;
  science: string;
  live?: (props: SceneLegendProps) => string | null;
}

interface LegendSection {
  label: string;
  emoji: string;
  accent: string;
  items: LegendItem[];
}

const SECTIONS: LegendSection[] = [
  {
    label: 'The Sun',
    emoji: '☀️',
    accent: '#f59e0b',
    items: [
      {
        color: '#ffcc00',
        name: 'Solar Photosphere',
        plain: 'The glowing yellow-orange ball at the centre.',
        science: 'The visible surface of the Sun — a churning 5,500 °C plasma that emits the light powering our solar system.',
        live: ({ solarWindSpeed }) =>
          solarWindSpeed
            ? `Solar wind: ${Math.round(solarWindSpeed)} km/s — ${solarWindSpeed >= 800 ? '⚠ fast-wind event' : solarWindSpeed >= 600 ? 'elevated' : 'nominal'}`
            : null,
      },
      {
        color: '#ffe566',
        name: 'Inner Corona Halo',
        plain: 'The faint glow immediately surrounding the Sun.',
        science: 'The inner solar corona — trapped magnetic plasma millions of degrees hotter than the surface. Visible from Earth only during total solar eclipses.',
      },
      {
        color: '#ff9500',
        name: 'Coronal Streamers',
        plain: 'Animated tendrils radiating outward from the Sun.',
        science: 'Magnetised plasma loops extending millions of kilometres into the corona. Their structure changes with the 11-year sunspot cycle. CMEs (coronal mass ejections) erupt from these regions.',
      },
      {
        color: '#ff5500',
        name: 'Solar Flare Particles',
        plain: 'Sparkling eruptions shooting off the Sun\'s surface.',
        science: 'Electromagnetic bursts from regions of intense magnetic stress. X-class flares are the most powerful and can trigger global radio blackouts within ~8 minutes.',
        live: ({ flareClass }) =>
          flareClass
            ? `Latest flare: ${flareClass} — ${flareClass.startsWith('X') ? '🔴 powerful — potential blackout risk' : flareClass.startsWith('M') ? '🟡 moderate' : '🟢 minor'}`
            : null,
      },
    ],
  },
  {
    label: 'Planets & Moons',
    emoji: '🪐',
    accent: '#06b6d4',
    items: [
      {
        color: '#4aabf7',
        name: 'Planet Surfaces',
        plain: 'The textured spheres representing each planet.',
        science: 'Each planet\'s actual texture (2k/8k satellite images). Earth uses a live day/night shader — rotation takes the surface from sunlit continents into city-light darkness across a smooth terminator line.',
      },
      {
        color: '#5bc8ff',
        name: 'Earth\'s Atmospheric Halo',
        plain: 'The thin blue-white rim glowing around Earth.',
        science: 'Earth\'s atmospheric limb as seen from orbit. The blue comes from Rayleigh scattering — the same physics that makes the sky blue. It\'s only ~100 km thick against an 12,700 km diameter planet.',
      },
      {
        color: '#58efb4',
        name: 'Aurora Ovals',
        plain: 'Glowing rings around a planet\'s poles (Earth, Jupiter, Saturn).',
        science: 'Auroras form where charged solar-wind particles follow magnetic field lines into the atmosphere. During geomagnetic storms the oval expands toward the equator — mid-latitude aurora becomes visible.',
        live: ({ kpIndex }) => {
          if (kpIndex === undefined) return null;
          const lat = Math.round(90 - (20 + kpIndex * 2));
          return `Kp ${kpIndex.toFixed(1)} → aurora visible down to ~${lat}° latitude${kpIndex >= 5 ? ' ⚠ storm-level' : ''}`;
        },
      },
      {
        color: '#e0c88a',
        name: 'Saturn\'s Rings',
        plain: 'The iconic flat disc circling Saturn.',
        science: 'Billions of ice and rock particles ranging from sand-grain to house-sized, orbiting Saturn\'s equator. The rings are only ~10–100 m thick despite spanning 282,000 km across.',
      },
      {
        color: '#c0c0c0',
        name: 'Moons',
        plain: 'Smaller spheres orbiting the planets.',
        science: 'Earth\'s Moon, Jupiter\'s Io and Europa, and Saturn\'s Titan — each rendered with real textures and correct orbital periods. Click any moon to focus the camera on it.',
      },
    ],
  },
  {
    label: 'Planetary Magnetism',
    emoji: '🧲',
    accent: '#8b5cf6',
    items: [
      {
        color: '#a78bfa',
        name: 'Magnetic Dipole Axis',
        plain: 'A glowing line through a planet, tilted slightly off-vertical.',
        science: 'Earth\'s magnetic north pole is currently ~11° offset from its rotational pole — and the offset drifts over decades. Uranus\'s magnetic axis is tilted 59°; Neptune\'s a remarkable 47°.',
      },
      {
        color: '#7c3aed',
        name: 'Magnetotail',
        plain: 'A trailing structure extending away from the Sun behind each planet.',
        science: 'Solar wind pushes a planet\'s magnetic field into an elongated teardrop shape. Earth\'s magnetotail can stretch 1,000+ Earth radii away from the Sun. It\'s where magnetic reconnection events occur, loading energy that later powers substorms.',
      },
      {
        color: '#60a5fa',
        name: 'Atmospheric Glow',
        plain: 'A soft translucent halo around planets with atmospheres.',
        science: 'A Fresnel-shading approximation of an atmosphere\'s optical depth as seen from outside. Rendered only for Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune — the bodies with significant gas envelopes.',
      },
    ],
  },
  {
    label: 'Orbits & Debris',
    emoji: '🛸',
    accent: '#06b6d4',
    items: [
      {
        color: '#00ccff',
        name: 'Orbital Trails',
        plain: 'Faint coloured lines tracing each planet\'s path around the Sun.',
        science: 'Accurate Keplerian ellipses calculated from real orbital elements. Inner planets (Mercury–Mars) are shown in cyan; outer planets in violet. The Sun sits at one focus of each ellipse — not the centre.',
      },
      {
        color: '#a0856e',
        name: 'Asteroid Belt',
        plain: 'A ring of tiny rocky objects between Mars and Jupiter.',
        science: '2,200 representative bodies from the real Main Asteroid Belt (2.2–3.3 AU). The empty bands are Kirkwood Gaps — zones swept clear by Jupiter\'s gravitational resonances (e.g. 3:1, 5:2 ratio). Objects orbit with correct Keplerian differential speed.',
      },
      {
        color: '#8ab4d4',
        name: 'Kuiper Belt',
        plain: 'A denser ring of icy objects far beyond Neptune.',
        science: 'The Kuiper Belt (30–50 AU) is the source of short-period comets. Pluto, Eris, and Makemake all live here. Represented by 900 icy bodies with correct Keplerian drift speeds.',
      },
      {
        color: '#ff4444',
        name: 'Kessler Threat Net',
        plain: 'A reddish debris-path overlay around Earth (visible in close view).',
        science: 'Visualises the risk of a Kessler cascade — a self-sustaining chain reaction of satellite collisions in Low Earth Orbit that could render orbital altitudes unusable for generations. Updated from live space-weather and debris models.',
      },
    ],
  },
  {
    label: 'Solar System Edges',
    emoji: '🌌',
    accent: '#818cf8',
    items: [
      {
        color: '#60a5fa',
        name: 'Termination Shock',
        plain: 'A glowing electric-blue turbulent shell at the very edge of the scene.',
        science: 'At ~90 AU from the Sun, the supersonic solar wind abruptly slows to subsonic as it meets the interstellar medium. Voyager 1 crossed this in 2004. Rendered as fractured, filamentary electric-blue.',
      },
      {
        color: '#6d28d9',
        name: 'Heliopause',
        plain: 'A larger, deeper violet shell beyond the termination shock.',
        science: 'The true boundary of the heliosphere at ~120 AU — where the Sun\'s solar wind pressure exactly balances the interstellar medium. Voyager 1 crossed it in 2012. Beyond this is interstellar space.',
      },
      {
        color: '#93c5fd',
        name: 'Oort Cloud',
        plain: 'A faint spherical haze of glowing particles at the outermost edge.',
        science: 'A vast, roughly spherical shell of icy bodies extending from ~2,000 to ~100,000 AU. This is where long-period comets (like Hale-Bopp) originate. No spacecraft has ever reached it.',
      },
    ],
  },
  {
    label: 'Background',
    emoji: '✨',
    accent: '#94a3b8',
    items: [
      {
        color: '#ffffff',
        name: 'Star Field',
        plain: '15,000 individual stars in the background that slowly rotate.',
        science: 'Rendered in three spectral classes: blue-white (hot O/B stars), white-yellow (sun-like G stars), and orange-red (cool K/M dwarfs). Each star twinkles via a randomised size oscillation in the vertex shader.',
      },
      {
        color: '#c084fc',
        name: 'Nebulae',
        plain: 'Faint, colourful clouds of purple, cyan, and pink glowing in the background.',
        science: 'Distant emission nebulae — clouds of ionised gas lit by young, hot stars. The colours are characteristic: purple/pink = ionised hydrogen (H-alpha), cyan = doubly-ionised oxygen (OIII). The Solar System formed from a nebula like these ~4.6 billion years ago.',
      },
    ],
  },
];

// ─── Live badge ────────────────────────────────────────────────────────────
function LiveBadge({ text }: { text: string }) {
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-mono tracking-wide text-cyan-300">
      <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-400" />
      {text}
    </span>
  );
}

// ─── Single item row ────────────────────────────────────────────────────────
function LegendRow({ item, liveProps }: { item: LegendItem; liveProps: SceneLegendProps }) {
  const [expanded, setExpanded] = useState(false);
  const liveText = item.live?.(liveProps) ?? null;

  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
      onClick={() => setExpanded((p) => !p)}
    >
      <span
        className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: item.color, boxShadow: `0 0 5px ${item.color}66` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-100">{item.name}</span>
          <span className="text-[9px] text-slate-500">{expanded ? '▲' : '▼'}</span>
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-300">{item.plain}</p>
        {expanded && (
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{item.science}</p>
        )}
        {liveText && <LiveBadge text={liveText} />}
      </div>
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export function SceneLegend({ kpIndex, solarWindSpeed, flareClass }: SceneLegendProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((p) => !p), []);

  const liveProps: SceneLegendProps = { kpIndex, solarWindSpeed, flareClass };

  return (
    <>
      {/* Trigger button — always visible, bottom-centre */}
      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-[calc(var(--time-explorer-height,3.5rem)+0.75rem)] left-1/2 z-[90] -translate-x-1/2 rounded-full border border-cyan-500/40 bg-black/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-cyan-300 shadow-lg backdrop-blur-sm transition-colors hover:border-cyan-400/70 hover:bg-black/90 pointer-events-auto"
        title="Explain what the 3D view shows"
        aria-label="Scene legend — what am I looking at?"
      >
        {open ? '✕ Close Guide' : '? What am I looking at?'}
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[88] pointer-events-auto"
            onClick={close}
          />

          <div className="fixed z-[89] pointer-events-auto" style={{ insetBlockEnd: 'calc(var(--time-explorer-height, 3.5rem) + 4rem)', insetInlineStart: '50%', transform: 'translateX(-50%)', inlineSize: 'min(480px, 94vw)' }}>
            <div className="nasa-slate rounded-xl border border-cyan-500/25 bg-black/85 shadow-2xl backdrop-blur-md">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-cyan-500/20 px-4 py-3">
                <div>
                  <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-cyan-200">Scene Discovery Guide</h2>
                  <p className="mt-0.5 text-[9px] text-slate-500">Click any item to expand its science explanation</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="skoll-circle-action skoll-circle-action-danger ml-3 flex-shrink-0"
                  aria-label="Close guide"
                >
                  ✕
                </button>
              </div>

              {/* Sections */}
              <div className="max-h-[65vh] overflow-y-auto wolf-scroll px-2 py-2">
                {SECTIONS.map((section) => (
                  <div key={section.label} className="mb-3">
                    {/* Section header */}
                    <div
                      className="mb-1 flex items-center gap-1.5 px-2 py-1"
                      style={{ borderInlineStart: `2px solid ${section.accent}` }}
                    >
                      <span className="text-[14px]" aria-hidden>{section.emoji}</span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.16em]"
                        style={{ color: section.accent }}
                      >
                        {section.label}
                      </span>
                    </div>

                    {/* Items */}
                    {section.items.map((item) => (
                      <LegendRow key={item.name} item={item} liveProps={liveProps} />
                    ))}
                  </div>
                ))}

                {/* Footer note */}
                <div className="mx-2 mt-3 rounded-md border border-slate-700/50 bg-white/3 p-2.5 text-[9px] leading-relaxed text-slate-500">
                  <strong className="text-slate-400">Scale note:</strong> Planetary sizes and inter-planet distances are not to scale.
                  If drawn accurately at 1 AU = 1 mm, the Sun would be the size of a grapefruit in London and Jupiter
                  would be a marble in Edinburgh. A true-scale solar system would be too large to navigate on screen.
                  <br /><br />
                  <strong className="text-slate-400">Live data:</strong> Aurora, cloud cover, solar wind, and debris risk
                  update from real NASA / NOAA feeds. Orbital positions are computed from Keplerian elements for the current date.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
