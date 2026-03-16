/**
 * CosmicTooltip.tsx — Family-friendly hover data wrapper
 *
 * Usage (DOM):
 *   <CosmicTooltip content={PLANET_TOOLTIPS.Earth}>
 *     <button>Earth</button>
 *   </CosmicTooltip>
 *
 * Usage (R3F 3D mesh — import directly):
 *   Use the `usePlanetTooltip(name)` hook inside PlanetBody and attach
 *   the returned handlers to the mesh:
 *     <mesh {...tooltipHandlers} />
 *
 * Planet data, space-weather metric data, and sensor tooltips are all
 * pre-defined at the bottom of this file so every part of the app pulls
 * from a single source of truth.
 */

import { type ReactNode } from 'react';
import { useCosmicTooltip, type TooltipContent } from '../context/TooltipContext';

// Minimal duck-typed pointer event — works for both React DOM and R3F ThreeEvent
interface PointerLike {
  stopPropagation: () => void;
  clientX: number;
  clientY: number;
}

// ─── DOM wrapper component ────────────────────────────────────────────────────

interface CosmicTooltipProps {
  content: TooltipContent;
  children: ReactNode;
}

/**
 * Wrap any DOM element with this component to get a CosmicTooltip on hover.
 * For R3F mesh elements use `usePlanetTooltip` hook instead.
 */
export function CosmicTooltip({ content, children }: CosmicTooltipProps) {
  const { showTooltip, hideTooltip, updatePosition } = useCosmicTooltip();

  return (
    <span
      style={{ display: 'contents' }}
      onMouseEnter={(e) => showTooltip(content, e.clientX, e.clientY)}
      onMouseMove={(e) => updatePosition(e.clientX, e.clientY)}
      onMouseLeave={hideTooltip}
    >
      {children}
    </span>
  );
}

// ─── R3F hook (3D meshes) ─────────────────────────────────────────────────────

/**
 * Returns onPointerOver + onPointerOut + onPointerMove handlers
 * that drive the global CosmicTooltip from inside any R3F component.
 */
const NOOP_HANDLERS = {
  onPointerOver: (_e: PointerLike) => {},
  onPointerMove: (_e: PointerLike) => {},
  onPointerOut: () => {},
} as const;

/**
 * Returns pointer-event handlers that drive the global CosmicTooltip.
 * Pass `suppress = true` when the planet is already focused in the camera
 * to avoid a redundant tooltip floating over the selected body.
 */
export function usePlanetTooltip(name: string, suppress = false) {
  const { showTooltip, hideTooltip, updatePosition } = useCosmicTooltip();
  const content = PLANET_TOOLTIPS[name] ?? GENERIC_BODY_TOOLTIP(name);

  if (suppress) return NOOP_HANDLERS;

  return {
    onPointerOver: (e: PointerLike) => {
      e.stopPropagation();
      showTooltip(content, e.clientX, e.clientY);
    },
    onPointerMove: (e: PointerLike) => {
      updatePosition(e.clientX, e.clientY);
    },
    onPointerOut: () => hideTooltip(),
  } as const;
}

// ─── Space-weather metric tooltip helper ─────────────────────────────────────

/** Wrap a metric label in a DOM CosmicTooltip */
export function MetricTooltip({ metricKey, children }: { metricKey: keyof typeof METRIC_TOOLTIPS; children: ReactNode }) {
  return <CosmicTooltip content={METRIC_TOOLTIPS[metricKey]}>{children}</CosmicTooltip>;
}

// ─── Planet data library ──────────────────────────────────────────────────────

export const PLANET_TOOLTIPS: Record<string, TooltipContent> = {
  Mercury: {
    title: 'Mercury',
    emoji: '⚫',
    tagline: 'The Speedy Messenger',
    accentColor: '#b5a49a',
    description:
      'Mercury is the smallest planet and the fastest — it whips around the Sun in just 88 Earth days! ' +
      'It has no atmosphere to trap heat, so temperatures swing from −180 °C at night to +430 °C in ' +
      'the day. The surface is covered in craters, like our Moon.',
    funFact:
      'Despite being closest to the Sun, Mercury is not the hottest planet — that title belongs to Venus because of its thick greenhouse atmosphere!',
    metrics: [
      { label: 'Orbital period',  value: '88',      unit: 'Earth days',  description: 'One year on Mercury' },
      { label: 'Surface temp',    value: '−180→430', unit: '°C',          description: 'No atmosphere = wild swings' },
      { label: 'Distance to Sun', value: '0.39',     unit: 'AU',          description: '1 AU ≈ 150 million km' },
      { label: 'Moons',           value: '0',        unit: '',            description: 'None at all' },
    ],
  },

  Venus: {
    title: 'Venus',
    emoji: '🌕',
    tagline: 'Earth\'s Evil Twin',
    accentColor: '#e8c97a',
    description:
      'Venus is almost the same size as Earth but completely different inside. ' +
      'Its thick clouds of sulphuric acid trap heat so well that the surface reaches 465 °C — ' +
      'hot enough to melt lead! A day on Venus (243 Earth days) is actually longer than its whole year (225 days).',
    funFact:
      'Venus spins backwards compared to most planets, so the Sun would rise in the west and set in the east if you could stand on the surface!',
    metrics: [
      { label: 'Surface temp',    value: '465',  unit: '°C',         description: 'Hottest planet' },
      { label: 'Orbital period',  value: '225',  unit: 'Earth days' },
      { label: 'Day length',      value: '243',  unit: 'Earth days', description: 'Longer than its year!' },
      { label: 'Atmosphere',      value: '96%',  unit: 'CO₂',        description: 'Extreme greenhouse' },
    ],
  },

  Earth: {
    title: 'Earth',
    emoji: '🌍',
    tagline: 'Our Home — 4.5 Billion Years Old',
    accentColor: '#4a9fd5',
    description:
      'Earth is the only known planet with liquid water on its surface and confirmed life. ' +
      '71% of the surface is ocean. Our magnetic field acts like a protective bubble, ' +
      'deflecting harmful solar wind particles — the very storms this app tracks!',
    funFact:
      'The Earth\'s magnetic north pole is not fixed — it wanders tens of kilometres every year, and completely flips direction roughly every 200,000–300,000 years (it\'s overdue for one now)!',
    metrics: [
      { label: 'Orbital period',  value: '365.25', unit: 'days' },
      { label: 'Surface temp',    value: '−88→58',  unit: '°C',   description: 'Habitable range' },
      { label: 'Moons',           value: '1',       unit: '',     description: 'The Moon' },
      { label: 'Magnetic field',  value: '25–65',   unit: 'µT',   description: 'Shields life from solar wind' },
    ],
  },

  Mars: {
    title: 'Mars',
    emoji: '🔴',
    tagline: 'The Red Planet',
    accentColor: '#d05030',
    description:
      'Mars gets its red colour from iron oxide (rust) dust that covers its surface. ' +
      'Home to Olympus Mons — the largest volcano in the solar system, three times the height of Everest. ' +
      'Mars has a day almost identical to Earth\'s (24 h 37 min) and seasons too.',
    funFact:
      'Mars has the biggest dust storms in the solar system — they can cover the entire planet for months and block out the Sun!',
    metrics: [
      { label: 'Orbital period',  value: '687',  unit: 'Earth days', description: 'One Mars year' },
      { label: 'Day length',      value: '24h 37m', unit: '' },
      { label: 'Surface temp',    value: '−140→20', unit: '°C' },
      { label: 'Gravity',         value: '38',   unit: '% of Earth\'s' },
    ],
  },

  Jupiter: {
    title: 'Jupiter',
    emoji: '🪐',
    tagline: 'The King of the Planets',
    accentColor: '#c8a870',
    description:
      'Jupiter is the largest planet — so big that 1,300 Earths could fit inside! ' +
      'Its famous Great Red Spot is a storm that has been raging for over 350 years. ' +
      'Jupiter\'s powerful magnetic field is the strongest of any planet, creating spectacular auroras.',
    funFact:
      'Jupiter acts like a giant vacuum cleaner for the solar system, using its huge gravity to capture comets and asteroids before they can reach the inner planets. It may have saved Earth many times over!',
    metrics: [
      { label: 'Diameter',        value: '142,984', unit: 'km',           description: '11× Earth' },
      { label: 'Orbital period',  value: '11.9',    unit: 'Earth years' },
      { label: 'Moons',           value: '95',       unit: 'confirmed' },
      { label: 'Magnetic field',  value: '428',      unit: 'µT',           description: '14× Earth\'s' },
    ],
  },

  Saturn: {
    title: 'Saturn',
    emoji: '🪐',
    tagline: 'The Ringed Wonder',
    accentColor: '#e0c88a',
    description:
      'Saturn\'s beautiful rings are made of billions of chunks of ice and rock, ' +
      'ranging from tiny grains to pieces the size of houses. Saturn is so light ' +
      'for its size that it would actually float in water! It has 146 known moons.',
    funFact:
      'Saturn\'s rings are enormous — about 282,000 km wide — but only about 10–100 metres thick, like a sheet of paper scaled up!',
    metrics: [
      { label: 'Ring width',      value: '282,000', unit: 'km',         description: 'Wider than 22 Earths' },
      { label: 'Ring thickness',  value: '10–100',  unit: 'm',          description: 'Incredibly thin' },
      { label: 'Orbital period',  value: '29.5',    unit: 'Earth years' },
      { label: 'Moons',           value: '146',      unit: 'known' },
    ],
  },

  Uranus: {
    title: 'Uranus',
    emoji: '🔵',
    tagline: 'The Tilted Ice Giant',
    accentColor: '#7fd8e0',
    description:
      'Uranus spins almost completely on its side — tilted at 98° — so each pole ' +
      'experiences 42 years of continuous sunlight then 42 years of darkness. ' +
      'It is an "ice giant" made mostly of water, methane, and ammonia ices.',
    funFact:
      'Uranus\'s moons are named after characters in Shakespeare plays and Alexander Pope\'s poetry — including Puck, Oberon, Miranda, and Titania!',
    metrics: [
      { label: 'Axial tilt',      value: '97.8', unit: '°',            description: 'Spins on its side!' },
      { label: 'Orbital period',  value: '84',   unit: 'Earth years' },
      { label: 'Wind speed',      value: '900',  unit: 'km/h' },
      { label: 'Moons',           value: '28',   unit: 'known' },
    ],
  },

  Neptune: {
    title: 'Neptune',
    emoji: '🔷',
    tagline: 'The Windy Outermost Giant',
    accentColor: '#3a6fdd',
    description:
      'Neptune is the farthest planet from the Sun and one of the windiest — gusts can reach ' +
      '2,100 km/h, faster than the speed of sound on Earth! One Neptune year lasts 165 Earth years. ' +
      'It was the first planet predicted by mathematics before it was ever seen through a telescope.',
    funFact:
      'Neptune radiates more heat into space than it receives from the Sun — there is still a mysterious internal heat source that scientists haven\'t fully explained!',
    metrics: [
      { label: 'Orbital period',  value: '165',      unit: 'Earth years' },
      { label: 'Wind speed',      value: '2,100',    unit: 'km/h',        description: 'Fastest in the solar system' },
      { label: 'Distance to Sun', value: '30.07',    unit: 'AU' },
      { label: 'Moons',           value: '16',        unit: 'known' },
    ],
  },

  Pluto: {
    title: 'Pluto',
    emoji: '⚪',
    tagline: 'The Beloved Dwarf Planet',
    accentColor: '#c8b0a0',
    description:
      'Pluto was reclassified as a "dwarf planet" in 2006. New Horizons flew past it in 2015 ' +
      'and sent back stunning images including a huge heart-shaped nitrogen ice plain now called ' +
      'Tombaugh Regio. Despite its tiny size, Pluto has five moons.',
    funFact:
      'Pluto and its largest moon Charon are so similar in size that astronomers sometimes call them a "double dwarf planet" — they orbit each other around a point in space between them!',
    metrics: [
      { label: 'Orbital period',  value: '248',  unit: 'Earth years' },
      { label: 'Diameter',        value: '2,377', unit: 'km',        description: 'Smaller than our Moon' },
      { label: 'Surface temp',    value: '−233', unit: '°C' },
      { label: 'Moons',           value: '5',    unit: '' },
    ],
  },

  Moon: {
    title: 'The Moon',
    emoji: '🌙',
    tagline: 'Earth\'s Loyal Companion',
    accentColor: '#c8c0b0',
    description:
      'The Moon formed about 4.5 billion years ago when a Mars-sized body collided with the ' +
      'young Earth. It is slowly drifting away — by about 3.8 cm per year. The Moon\'s gravity ' +
      'creates our ocean tides and stabilises Earth\'s axial tilt, making our climate more stable.',
    funFact:
      'The Moon is 400 times smaller than the Sun, but also 400 times closer to Earth — which is why they look the same size in our sky, making perfect solar eclipses possible!',
    metrics: [
      { label: 'Distance',       value: '384,400', unit: 'km from Earth' },
      { label: 'Orbital period', value: '27.3',    unit: 'Earth days' },
      { label: 'Drift rate',     value: '3.8',     unit: 'cm/year',     description: 'Slowly moving away' },
    ],
  },

  Io: {
    title: 'Io',
    emoji: '🟡',
    tagline: 'Jupiter\'s Volcanic Moon',
    accentColor: '#e8c830',
    description:
      'Io is the most volcanically active body in the solar system — its surface is constantly ' +
      'being reshaped by hundreds of active volcanoes. The gravitational tug-of-war between ' +
      'Jupiter and the other Galilean moons generates enough friction to melt its interior.',
    funFact:
      'Some of Io\'s volcanoes shoot plumes of sulphur dioxide up to 500 km into space!',
    metrics: [
      { label: 'Active volcanoes', value: '400+', unit: '' },
      { label: 'Orbital period',  value: '1.77',  unit: 'Earth days' },
    ],
  },

  Europa: {
    title: 'Europa',
    emoji: '🔵',
    tagline: 'The Icy Ocean World',
    accentColor: '#88c8f8',
    description:
      'Europa is covered in smooth ice, but beneath its frozen surface lies a vast ' +
      'saltwater ocean containing twice as much water as all of Earth\'s oceans. ' +
      'This makes it one of the top candidates in the search for life beyond Earth.',
    funFact:
      'Europa\'s icy surface is so smooth it has almost no mountains or craters — the entire moon looks like a cracked billiard ball!',
    metrics: [
      { label: 'Ocean depth', value: '100+',  unit: 'km',         description: '2× all Earth oceans' },
      { label: 'Ice shell',   value: '10–30', unit: 'km thick' },
      { label: 'Period',      value: '3.55',  unit: 'Earth days' },
    ],
  },

  Titan: {
    title: 'Titan',
    emoji: '🟠',
    tagline: 'Saturn\'s Smoggy Moon',
    accentColor: '#e8a040',
    description:
      'Titan is Saturn\'s largest moon and the only moon in the solar system with a thick ' +
      'atmosphere. It has lakes, rivers, and rain — but made of liquid methane and ethane ' +
      'instead of water. Surface temperature is −179 °C.',
    funFact:
      'NASA\'s Dragonfly mission will send a rotorcraft to fly on Titan in 2037 — the first time we\'ll fly an aircraft on another world\'s surface!',
    metrics: [
      { label: 'Atmosphere',  value: '95%',  unit: 'nitrogen',   description: 'Like early Earth' },
      { label: 'Surface temp', value: '−179', unit: '°C' },
      { label: 'Period',      value: '15.9', unit: 'Earth days' },
    ],
  },
};

function GENERIC_BODY_TOOLTIP(name: string): TooltipContent {
  return {
    title: name,
    emoji: '✨',
    accentColor: '#38bdf8',
    description: `${name} is a fascinating celestial body in our solar system. Hover over a labelled body for detailed family-friendly facts.`,
  };
}

// ─── Space-weather metric tooltips ───────────────────────────────────────────

export const METRIC_TOOLTIPS = {
  kp: {
    title: 'Kp Index',
    emoji: '🧲',
    tagline: 'Global Magnetic Activity',
    accentColor: '#38bdf8',
    description:
      'The Kp index (0–9) measures how disturbed Earth\'s magnetic field is right now. ' +
      '0 = completely calm. 5+ = a geomagnetic storm — auroras might be visible! ' +
      '9 = extreme storm like the famous 1859 Carrington Event.',
    funFact: 'During a Kp 9 storm, auroras have been seen as far south as the Caribbean!',
  },
  dst: {
    title: 'Dst Index',
    emoji: '📉',
    tagline: 'Storm Intensity Measure',
    accentColor: '#f87171',
    description:
      'Dst (Disturbance Storm Time) measures how much extra electric current flows around ' +
      'Earth\'s equator during a magnetic storm. More negative = stronger storm. ' +
      'A Dst of −50 nT is a moderate storm; −200 nT is severe; the 1859 record was −1760 nT.',
    funFact: 'The Dst index is measured in nanoTesla (nT) — a unit so tiny it takes 1,000,000,000 of them to make one Tesla!',
  },
  bz: {
    title: 'Bz Component',
    emoji: '↕️',
    tagline: 'Solar Wind\'s Magnetic Hook',
    accentColor: '#a78bfa',
    description:
      'Bz is the north-south component of the solar wind\'s magnetic field. When Bz is ' +
      'strongly negative (pointing south), it connects with Earth\'s field like opposite ' +
      'magnets snapping together — punching a hole in our protective shield and letting energy in.',
    funFact: 'Most geomagnetic storms only become dangerous when Bz turns strongly negative. A positive Bz even at high solar wind speeds is largely harmless!',
  },
  solarWind: {
    title: 'Solar Wind Speed',
    emoji: '💨',
    tagline: 'The Sun\'s Breath',
    accentColor: '#fbbf24',
    description:
      'The Sun constantly blows a stream of charged particles into space — the solar wind. ' +
      'Normal speed is ~400 km/s. During a Coronal Mass Ejection (CME), it can spike to ' +
      '>2,000 km/s. At those speeds the particles travel from Sun to Earth in under 2 days.',
    funFact: 'The solar wind is what makes comet tails always point away from the Sun — they\'re literally being blown by the Sun\'s wind!',
  },
  kessler: {
    title: 'Kessler Syndrome Risk',
    emoji: '🛰️',
    tagline: 'Orbit Debris Chain Reaction',
    accentColor: '#ef4444',
    description:
      'Kessler Syndrome describes a runaway chain reaction where satellite collisions create debris ' +
      'that destroys more satellites, creating more debris. High space weather can push satellites out ' +
      'of safe orbits, raising collision risk. Once started, it could make certain orbits unusable for centuries.',
    funFact: 'There are over 27,000 tracked debris objects in orbit larger than 10 cm — and millions of smaller untracked fragments!',
  },
  wolfFormula: {
    title: 'Wolf Formula (Ψ)',
    emoji: '⚡',
    tagline: 'Infrastructure Fatigue Index',
    accentColor: '#fb923c',
    description:
      'The Wolf Formula (Ψ) combines multiple space weather metrics into a single "infrastructure damage" ' +
      'score. It estimates how likely a current storm is to damage power grids, pipelines, and ' +
      'satellites. The higher the score, the more our technology is under attack from space weather.',
    funFact: 'Power grid engineers use space weather forecasts to pre-position repair crews during storms — similar to how weather forecasters warn of hurricanes!',
  },
} satisfies Record<string, TooltipContent>;
