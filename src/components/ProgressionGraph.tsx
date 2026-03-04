import { useMemo } from 'react';
import { CosmicTooltip } from './CosmicTooltip';

/**
 * ProgressionGraph.tsx — SKÖLL-TRACK Dev Level & Feature Progression
 *
 * Gamified developer dashboard showing build milestones, XP, level,
 * component count, and a skill-tree of unlocked features.
 */

interface Feature {
  id: string;
  name: string;
  category: 'orbital' | 'space-weather' | 'neural' | 'ui' | 'render' | 'data';
  unlocked: boolean;
  xp: number;
  tier: 1 | 2 | 3 | 4 | 5;
}

const FEATURES: Feature[] = [
  // Tier 1 — Foundation
  { id: 'canvas',       name: 'R3F Canvas',          category: 'render',        unlocked: true,  xp:  50, tier: 1 },
  { id: 'planets',      name: 'Planet Renderer',     category: 'orbital',       unlocked: true,  xp:  80, tier: 1 },
  { id: 'starfield',    name: 'Enhanced Starfield',  category: 'render',        unlocked: true,  xp:  40, tier: 1 },
  { id: 'telemetry',    name: 'Telemetry Ribbon',    category: 'ui',            unlocked: true,  xp:  60, tier: 1 },
  { id: 'timeline',     name: 'Timeline Control',    category: 'ui',            unlocked: true,  xp:  70, tier: 1 },
  // Tier 2 — Space Weather
  { id: 'noaa',         name: 'NOAA/DONKI Feed',     category: 'space-weather', unlocked: true,  xp: 120, tier: 2 },
  { id: 'kp',           name: 'KP Index Live',       category: 'space-weather', unlocked: true,  xp:  90, tier: 2 },
  { id: 'cme',          name: 'CME Propagation',     category: 'space-weather', unlocked: true,  xp: 130, tier: 2 },
  { id: 'fireball',     name: 'Fireball Tracker',    category: 'space-weather', unlocked: true,  xp:  80, tier: 2 },
  { id: 'forecast',     name: 'Forecast Radar',      category: 'space-weather', unlocked: true,  xp: 100, tier: 2 },
  // Tier 3 — Neural / ML
  { id: 'lstm',         name: 'LSTM Forecaster',     category: 'neural',        unlocked: true,  xp: 200, tier: 3 },
  { id: 'lstm-worker',  name: 'LSTM Web Worker',     category: 'neural',        unlocked: true,  xp: 160, tier: 3 },
  { id: '14d',          name: '14d Carrington Model',category: 'neural',        unlocked: true,  xp: 180, tier: 3 },
  { id: '60d',          name: '60d Solar Cycle',     category: 'neural',        unlocked: true,  xp: 170, tier: 3 },
  { id: '365d',         name: '1yr Climatology',     category: 'neural',        unlocked: true,  xp: 190, tier: 3 },
  // Tier 4 — Advanced Render
  { id: 'bowshock',     name: 'Earth Bow-Shock',     category: 'render',        unlocked: true,  xp: 220, tier: 4 },
  { id: 'kuiper',       name: 'Kuiper Belt',         category: 'orbital',       unlocked: true,  xp: 180, tier: 4 },
  { id: 'magnetic',     name: 'Magnetic Grid',       category: 'space-weather', unlocked: true,  xp: 200, tier: 4 },
  { id: 'oort',         name: 'Oort Cloud',          category: 'orbital',       unlocked: true,  xp: 240, tier: 4 },
  { id: 'iss',          name: 'Live ISS Track',      category: 'data',          unlocked: true,  xp: 210, tier: 4 },
  // Tier 5 — God-Weave
  { id: 'supermag',     name: 'SuperMAG Network',    category: 'data',          unlocked: true,  xp: 280, tier: 5 },
  { id: 'density-bow',  name: 'Dynamic Bow-Shock',   category: 'render',        unlocked: true,  xp: 260, tier: 5 },
  { id: 'cloudmap',     name: 'Live Cloud Maps',     category: 'render',        unlocked: true,  xp: 290, tier: 5 },
  { id: 'simulator',    name: 'Threat Simulator',    category: 'space-weather', unlocked: true,  xp: 300, tier: 5 },
  { id: 'deep-time',    name: 'Deep-Time Slicer',    category: 'ui',            unlocked: true,  xp: 350, tier: 5 },
  { id: 'chicxulub',    name: 'Chicxulub Asteroid',  category: 'orbital',       unlocked: true,  xp: 400, tier: 5 },
  { id: 'speech',       name: 'Voice Commands',      category: 'ui',            unlocked: true,  xp: 200, tier: 4 },
  { id: 'dsn',          name: 'DSN Live Link',       category: 'data',          unlocked: true,  xp: 170, tier: 3 },
];

const CATEGORY_COLORS: Record<string, string> = {
  orbital:       '#4488ff',
  'space-weather': '#ff8844',
  neural:        '#cc44ff',
  ui:            '#44ddff',
  render:        '#44ff99',
  data:          '#ffdd44',
};

const TIER_LABELS = ['', 'Foundation', 'Space Weather', 'Neural/ML', 'Advanced', 'God-Weave'];

function levelFromXP(totalXP: number): { level: number; xpInLevel: number; xpForNext: number } {
  let level = 1;
  let remaining = totalXP;
  while (remaining >= level * 500) {
    remaining -= level * 500;
    level++;
  }
  return { level, xpInLevel: remaining, xpForNext: level * 500 };
}

interface ProgressionGraphProps {
  kpIndex?: number;
}

export default function ProgressionGraph({ kpIndex = 0 }: ProgressionGraphProps) {
  const totalXP = useMemo(() => FEATURES.filter((f) => f.unlocked).reduce((s, f) => s + f.xp, 0), []);
  const { level, xpInLevel, xpForNext } = levelFromXP(totalXP);
  const unlocked = FEATURES.filter((f) => f.unlocked).length;
  const total    = FEATURES.length;

  const tierGroups = useMemo(() => {
    const map: Record<number, Feature[]> = {};
    for (const f of FEATURES) {
      map[f.tier] = map[f.tier] ?? [];
      map[f.tier].push(f);
    }
    return map;
  }, []);

  const categoryStats = useMemo(() => {
    const map: Record<string, { count: number; xp: number }> = {};
    for (const f of FEATURES.filter((f) => f.unlocked)) {
      map[f.category] = map[f.category] ?? { count: 0, xp: 0 };
      map[f.category].count++;
      map[f.category].xp += f.xp;
    }
    return Object.entries(map);
  }, []);

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#a0d8ff', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(6,10,22,0.75)', backdropFilter: 'blur(22px) saturate(1.6)', WebkitBackdropFilter: 'blur(22px) saturate(1.6)', border: '1px solid rgba(100,160,255,0.14)', borderRadius: '10px', padding: '10px', boxShadow: '0 0 28px rgba(68,136,255,0.06),0 4px 20px rgba(0,0,0,0.55)' }}>

      {/* XP / Level header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(100,180,255,0.18)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffdd44', lineHeight: 1 }}>LV</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffcc00', lineHeight: 1 }}>{level}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockEnd: '3px' }}>
            <span style={{ color: '#ffdd44', fontSize: '11px', letterSpacing: '0.12em' }}>SKÖLL ARCHITECT</span>
            <span style={{ opacity: 0.6 }}>{totalXP.toLocaleString()} XP</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              width: `${(xpInLevel / xpForNext) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #ffcc00, #ff8844)',
              borderRadius: '4px',
              transition: 'width 1s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockStart: '2px', fontSize: '8px', opacity: 0.55 }}>
            <span>{xpInLevel} / {xpForNext} XP to LV{level + 1}</span>
            <span>{unlocked}/{total} features unlocked</span>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <div style={{ fontSize: '8px', letterSpacing: '0.12em', opacity: 0.55, textTransform: 'uppercase', marginBlockEnd: '5px' }}>Skill Categories</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
          {categoryStats.sort((a, b) => b[1].xp - a[1].xp).map(([cat, stat]) => (
            <div key={cat} style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${CATEGORY_COLORS[cat] ?? '#445566'}44`,
              borderRadius: '5px',
              padding: '4px 6px',
            }}>
              <div style={{ fontSize: '8px', color: CATEGORY_COLORS[cat] ?? '#a0d8ff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat}</div>
              <div style={{ color: CATEGORY_COLORS[cat] ?? '#a0d8ff', fontWeight: 'bold' }}>{stat.count} feat</div>
              <div style={{ fontSize: '8px', opacity: 0.55 }}>{stat.xp} XP</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier skill tree */}
      <div>
        <div style={{ fontSize: '8px', letterSpacing: '0.12em', opacity: 0.55, textTransform: 'uppercase', marginBlockEnd: '5px' }}>Skill Tree</div>
        {([1, 2, 3, 4, 5] as const).map((tier) => (
          <div key={tier} style={{ marginBlockEnd: '6px' }}>
            <div style={{ fontSize: '8px', color: '#8899aa', marginBlockEnd: '3px', letterSpacing: '0.1em' }}>
              ── TIER {tier}: {TIER_LABELS[tier]}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
              {(tierGroups[tier] ?? []).map((f) => (
                <CosmicTooltip
                  key={f.id}
                  content={{
                    title: f.name,
                    description: `${f.xp} XP · Tier ${f.tier}: ${TIER_LABELS[f.tier]} · Category: ${f.category}`,
                    accentColor: CATEGORY_COLORS[f.category] ?? '#4488ff',
                  }}
                >
                  <div
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      background: f.unlocked
                        ? `${CATEGORY_COLORS[f.category] ?? '#445566'}22`
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${f.unlocked ? CATEGORY_COLORS[f.category] ?? '#445566' : '#334455'}`,
                      color: f.unlocked ? (CATEGORY_COLORS[f.category] ?? '#a0d8ff') : '#334455',
                      whiteSpace: 'nowrap',
                      cursor: 'default',
                    }}
                  >
                    {f.unlocked ? '✦ ' : '○ '}{f.name}
                  </div>
                </CosmicTooltip>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* KP-gated prestige note */}
      {kpIndex >= 7 && (
        <div style={{ padding: '6px 10px', background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.35)', borderRadius: '6px', fontSize: '9px', color: '#ffaaaa', letterSpacing: '0.1em' }}>
          ⚡ STORM EVENT DETECTED — +50% XP multiplier active
        </div>
      )}
    </div>
  );
}
