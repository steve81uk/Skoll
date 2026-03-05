/**
 * SKÖLL-TRACK — DSN LIVE LINK
 * Deep Space Network real-time contact display.
 *
 * Data source: NASA Eyes on the Solar System DSN API
 *   https://eyes.nasa.gov/dsn/data/dsn.xml?r=<unix_ms>
 *
 * Displays Goldstone (DSS), Canberra (HGA), Madrid (MDSCC) complexes,
 * current spacecraft contacts, uplink/downlink rates, and signal metrics.
 * Falls back to a synthetic simulation when the API is unreachable (CORS).
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DSNDish {
  name:       string;
  site:       'Goldstone' | 'Canberra' | 'Madrid';
  azimuthDeg: number;
  elevDeg:    number;
  windSpeed:  number;
  mspa:       boolean; // Multi-spacecraft Per Aperture mode
}

interface DSNContact {
  spacecraft:    string;
  dish:          string;
  site:          'Goldstone' | 'Canberra' | 'Madrid';
  upRateBps:     number;
  downRateBps:   number;
  rtlt:          number; // round-trip light time (seconds)
  frequency:     number; // GHz
  powerDbm:      number;
  startTime:     string;
  endTime:       string;
  active:        boolean;
}

interface DSNState {
  contacts:    DSNContact[];
  dishes:      DSNDish[];
  timestamp:   string;
  source:      'live' | 'simulated';
  loading:     boolean;
  error:       string | null;
}

// ─── Site metadata ────────────────────────────────────────────────────────────
const SITE_COLORS: Record<string, string> = {
  Goldstone: '#22c55e',
  Canberra:  '#60c8ff',
  Madrid:    '#f59e0b',
};

const SITE_LAT_LON = {
  Goldstone: { lat: 35.43, lon: -116.89, flag: '🇺🇸' },
  Canberra:  { lat: -35.40, lon: 148.98,  flag: '🇦🇺' },
  Madrid:    { lat: 40.43,  lon: -4.25,   flag: '🇪🇸' },
};

// ─── Known flagship missions for simulation ───────────────────────────────────
const SIM_SPACECRAFT = [
  { name: 'VOYAGER 1', rtlt: 47034, site: 'Goldstone', down: 160, up: 16,   freq: 8.42,  power: -197.2 },
  { name: 'VOYAGER 2', rtlt: 38210, site: 'Canberra',  down: 160, up: 16,   freq: 8.42,  power: -196.8 },
  { name: 'JWST',      rtlt: 9.9,   site: 'Goldstone', down: 28e6, up: 16e3, freq: 25.9,  power: -147.3 },
  { name: 'NewHorizons', rtlt: 20102, site: 'Madrid',  down: 1000, up: 500,  freq: 8.44,  power: -184.6 },
  { name: 'MRO',       rtlt: 1140,  site: 'Goldstone', down: 6e6,  up: 2e3,  freq: 8.41,  power: -161.2 },
  { name: 'JUNO',      rtlt: 5520,  site: 'Canberra',  down: 18000, up: 500, freq: 8.40,  power: -170.4 },
  { name: 'Perseverance', rtlt: 1140, site: 'Madrid',  down: 2e6,  up: 4000, freq: 8.44,  power: -156.7 },
] as const;

// ─── DSN XML parser (minimal) ─────────────────────────────────────────────────
function parseDSNXml(xml: string): Partial<DSNState> {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xml, 'application/xml');

  const contacts: DSNContact[] = [];
  const dishes: DSNDish[] = [];

  doc.querySelectorAll('station').forEach((station) => {
    const site = (station.getAttribute('friendlyName') ?? '').includes('Goldstone') ? 'Goldstone'
               : (station.getAttribute('friendlyName') ?? '').includes('Canberra') ? 'Canberra' : 'Madrid';
    station.querySelectorAll('dish').forEach((dish) => {
      const dName = dish.getAttribute('name') ?? '';
      dishes.push({
        name: dName, site,
        azimuthDeg: parseFloat(dish.getAttribute('azimuthAngle')  ?? '0'),
        elevDeg:    parseFloat(dish.getAttribute('elevationAngle') ?? '0'),
        windSpeed:  parseFloat(dish.getAttribute('windSpeed')      ?? '0'),
        mspa:       dish.getAttribute('isMSPA') === 'true',
      });
      dish.querySelectorAll('downSignal, upSignal').forEach((sig) => {
        const spacecraft = sig.getAttribute('spacecraft') ?? 'UNKNOWN';
        const existing   = contacts.find(c => c.spacecraft === spacecraft && c.dish === dName);
        const rate = parseFloat(sig.getAttribute('dataRate') ?? '0') * 1000;
        const freq = parseFloat(sig.getAttribute('frequency') ?? '0') / 1e9;
        const pwr  = parseFloat(sig.getAttribute('signalStrength') ?? '0');
        if (!existing) {
          contacts.push({
            spacecraft, dish: dName, site,
            upRateBps:   sig.tagName === 'upSignal'   ? rate : 0,
            downRateBps: sig.tagName === 'downSignal' ? rate : 0,
            rtlt:  parseFloat(sig.getAttribute('lightTime') ?? '0'),
            frequency: freq,
            powerDbm: pwr,
            startTime: sig.getAttribute('startTime') ?? '',
            endTime:   sig.getAttribute('endTime')   ?? '',
            active: true,
          });
        } else {
          if (sig.tagName === 'upSignal')   existing.upRateBps   = rate;
          if (sig.tagName === 'downSignal') existing.downRateBps = rate;
        }
      });
    });
  });

  return { contacts, dishes, source: 'live' };
}

// ─── Simulation fallback ──────────────────────────────────────────────────────
function buildSimulatedState(): Partial<DSNState> {
  const now  = Date.now();
  // Pick 3–4 active contacts based on time slot
  const slot = Math.floor(now / 600_000) % SIM_SPACECRAFT.length;
  const active = [
    SIM_SPACECRAFT[slot % SIM_SPACECRAFT.length],
    SIM_SPACECRAFT[(slot + 2) % SIM_SPACECRAFT.length],
    SIM_SPACECRAFT[(slot + 4) % SIM_SPACECRAFT.length],
  ];

  const contacts: DSNContact[] = active.map((sc) => ({
    spacecraft: sc.name,
    dish:       `DSS-${43 + (SIM_SPACECRAFT.indexOf(sc as typeof SIM_SPACECRAFT[0]) % 4) * 14}`,
    site:       sc.site as DSNContact['site'],
    upRateBps:  sc.up   * (0.9 + Math.random() * 0.2),
    downRateBps:sc.down * (0.85 + Math.random() * 0.3),
    rtlt:       sc.rtlt,
    frequency:  sc.freq,
    powerDbm:   sc.power + (Math.random() - 0.5) * 1.4,
    startTime:  new Date(now - 3600_000).toISOString(),
    endTime:    new Date(now + 3600_000).toISOString(),
    active:     true,
  }));

  const dishes: DSNDish[] = (['Goldstone','Canberra','Madrid'] as const).map((site, si) => ({
    name:      `DSS-${[43,43,63][si]}`,
    site,
    azimuthDeg: (now / 10000 + si * 120) % 360,
    elevDeg:   20 + Math.sin(now / 30000 + si) * 15,
    windSpeed: 3 + Math.random() * 8,
    mspa:      si === 0,
  }));

  return { contacts, dishes, source: 'simulated' };
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtRate(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} kbps`;
  return `${bps.toFixed(0)} bps`;
}

function fmtRTLT(s: number): string {
  if (s > 3600) return `${(s / 3600).toFixed(1)} hr`;
  if (s > 60)   return `${(s / 60).toFixed(1)} min`;
  return `${s.toFixed(1)} s`;
}

function fmtLightDist(rtlt: number): string {
  const oneway = rtlt / 2;
  if (oneway > 86400) return `${(oneway / 86400 * 300000).toFixed(0)} Mkm (${(oneway / 86400).toFixed(1)}d lt)`;
  const au = oneway * 300000 / 149597870.7;
  if (au > 1)  return `${au.toFixed(2)} AU`;
  const mkm = oneway * 300000 / 1e6;
  return `${mkm.toFixed(1)} Mkm`;
}

// ─── Dish Dial SVG ────────────────────────────────────────────────────────────
function DishDial({ dish, color }: { dish: DSNDish; color: string }) {
  const az  = dish.azimuthDeg;
  const el  = dish.elevDeg;
  const r   = 28;
  const cx  = 32, cy = 32;
  const rad = (d: number) => (d * Math.PI) / 180;
  // Azimuth needle
  const nx  = cx + r * Math.sin(rad(az));
  const ny  = cy - r * Math.cos(rad(az));
  // Elevation arc
  const elPct = Math.max(0, Math.min(1, el / 90));

  return (
    <svg width={64} height={64} viewBox="0 0 64 64" style={{ overflow: 'visible' }}>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,200,255,0.15)" strokeWidth={1.5} />
      {/* Cardinal marks */}
      {[0,90,180,270].map((a) => {
        const mx = cx + (r-2)*Math.sin(rad(a)); const my = cy - (r-2)*Math.cos(rad(a));
        return <circle key={a} cx={mx} cy={my} r={1} fill="rgba(0,200,255,0.4)" />;
      })}
      {/* Elevation fill arc */}
      <path
        d={`M ${cx} ${cy} L ${cx} ${cy - r * elPct * 0.7} A ${r * elPct * 0.7} ${r * elPct * 0.7} 0 0 1 ${cx + r * elPct * 0.7 * Math.sin(rad(az * 0.3))} ${cy - r * elPct * 0.7 * Math.cos(rad(az * 0.3))}`}
        fill={`${color}18`} stroke="none"
      />
      {/* Azimuth needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={3} fill={color} fillOpacity={0.9} />
      <circle cx={nx} cy={ny} r={2} fill={color} />
      {/* MSPA badge */}
      {dish.mspa && (
        <rect x={48} y={0} width={16} height={9} rx={2} fill={`${color}33`} stroke={color} strokeWidth={0.5} />
      )}
      {dish.mspa && <text x={56} y={7} fontSize={5} fill={color} textAnchor="middle" fontFamily="monospace">MSPA</text>}
    </svg>
  );
}

// ─── Signal strength bar ──────────────────────────────────────────────────────
function SignalBar({ dbm, color }: { dbm: number; color: string }) {
  // Typical DSN signals: -140 (strong) to -210 (weak)
  const pct = Math.max(0, Math.min(1, (-dbm - 140) / 70));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div style={{ flex: 1, height: '4px', background: 'rgba(0,20,50,0.8)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${(1 - pct) * 100}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(150,200,255,0.7)', minInlineSize: '54px' }}>
        {dbm.toFixed(1)} dBm
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DSNLiveLink() {
  const [state, setState] = useState<DSNState>({
    contacts: [], dishes: [], timestamp: '',
    source: 'simulated', loading: true, error: null,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchDSN = useCallback(async () => {
    try {
      const r      = Date.now();
      const dsnUrl = `https://eyes.nasa.gov/dsn/data/dsn.xml?r=${r}`;
      // allorigins.win strips CORS headers so the browser can fetch the XML
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(dsnUrl)}`;
      const res    = await fetch(proxyUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml    = await res.text();
      const parsed = parseDSNXml(xml);
      setState((prev) => ({
        ...prev, ...parsed, timestamp: new Date().toISOString(), loading: false, error: null,
      }));
    } catch {
      // CORS or network fail → use simulation
      const sim = buildSimulatedState();
      setState((prev) => ({
        ...prev, ...sim, timestamp: new Date().toISOString(), loading: false, error: null,
      }));
    }
  }, []);

  useEffect(() => {
    fetchDSN();
    timerRef.current = setInterval(fetchDSN, 60_000); // 1-min refresh
    return () => clearInterval(timerRef.current);
  }, [fetchDSN]);

  const { contacts, dishes, source, loading, timestamp } = state;

  const cardStyle: React.CSSProperties = {
    background:    'linear-gradient(135deg,rgba(3,12,28,0.96) 0%,rgba(2,8,20,0.98) 100%)',
    border:        '1px solid rgba(0,200,255,0.18)',
    borderRadius:  '10px',
    overflow:      'hidden',
    fontFamily:    '"Rajdhani","Share Tech Mono",monospace',
    minInlineSize:      '320px',
    maxInlineSize:      '520px',
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ padding:'10px 14px', borderBlockEnd:'1px solid rgba(0,200,255,0.12)',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'13px', color:'#60c8ff', letterSpacing:'0.08em' }}>
            DSN LIVE LINK  /  DEEP SPACE NETWORK
          </div>
          <div style={{ fontSize:'10px', color: source === 'live' ? '#22c55e' : '#eab308', fontFamily:'monospace', marginBlockStart:'2px' }}>
            {source === 'live' ? '● LIVE NASA API' : '● SIMULATED'}
            {timestamp && <span className="live-clock" style={{ color:'rgba(100,150,200,0.6)', marginInlineStart:'8px', minInlineSize: '9ch' }}>
              {new Date(timestamp).toISOString().slice(11,19)} UTC
            </span>}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'11px', color:'#7fa8c8', fontFamily:'monospace' }}>CONTACTS</div>
          <div style={{ fontSize:'22px', fontWeight:900, color:'#60c8ff', fontFamily:'"Rajdhani",monospace', lineHeight:1 }}>
            {loading ? '…' : contacts.length}
          </div>
        </div>
      </div>

      {/* Dish array status */}
      <div style={{ padding:'8px 14px', borderBlockEnd:'1px solid rgba(0,200,255,0.08)',
        display:'flex', gap:'10px', overflowX:'auto' }}>
        {(['Goldstone','Canberra','Madrid'] as const).map((site) => {
          const siteDishes = dishes.filter(d => d.site === site);
          const color = SITE_COLORS[site];
          const meta  = SITE_LAT_LON[site];
          return (
            <div key={site} style={{ flex:1, minInlineSize:'90px', textAlign:'center', padding:'6px',
              background:'rgba(0,20,50,0.5)', borderRadius:'8px', border:`1px solid ${color}33` }}>
              <div style={{ fontSize:'10px', color, fontFamily:'monospace', marginBlockEnd:'2px' }}>
                {meta.flag} {site.toUpperCase()}
              </div>
              {siteDishes.length > 0 ? (
                <DishDial dish={siteDishes[0]} color={color} />
              ) : (
                <div style={{ height:'64px', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'9px', color:'rgba(100,150,200,0.4)', fontFamily:'monospace' }}>STANDBY</div>
              )}
              <div style={{ fontSize:'9px', color:'rgba(150,200,255,0.7)', fontFamily:'monospace' }}>
                {siteDishes.map(d => d.name).join(' ')}
              </div>
              {siteDishes[0] && (
                <div style={{ fontSize:'9px', color:'rgba(100,160,220,0.7)', fontFamily:'monospace' }}>
                  AZ {siteDishes[0].azimuthDeg.toFixed(1)}° / EL {siteDishes[0].elevDeg.toFixed(1)}°
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live contacts */}
      <div style={{ maxHeight:'260px', overflowY:'auto' }}>
        {loading && (
          <div style={{ padding:'20px', textAlign:'center', fontSize:'11px', color:'#4a7a9a', fontFamily:'monospace' }}>
            INITIALISING DSN LINK…
          </div>
        )}
        {!loading && contacts.length === 0 && (
          <div style={{ padding:'20px', textAlign:'center', fontSize:'11px', color:'#4a7a9a', fontFamily:'monospace' }}>
            NO ACTIVE CONTACTS
          </div>
        )}
        {contacts.map((c, i) => {
          const color = SITE_COLORS[c.site];
          return (
            <div key={i} style={{ padding:'8px 14px', borderBlockEnd:'1px solid rgba(0,200,255,0.06)',
              display:'flex', flexDirection:'column', gap:'4px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <span style={{ fontSize:'13px', color:'#cce8ff', fontFamily:'"Rajdhani",monospace', fontWeight:700 }}>
                    {c.spacecraft}
                  </span>
                  <span style={{ marginInlineStart:'8px', fontSize:'10px', color,
                    background:`${color}18`, borderRadius:'3px', padding:'1px 5px' }}>
                    {c.dish} / {c.site}
                  </span>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'10px', color:'#7fa8c8', fontFamily:'monospace' }}>
                    RTLT {fmtRTLT(c.rtlt)}
                  </div>
                  <div style={{ fontSize:'9px', color:'rgba(100,150,200,0.6)', fontFamily:'monospace' }}>
                    {fmtLightDist(c.rtlt)}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
                {[
                  { label:'↑ UP',   val: fmtRate(c.upRateBps),  color:'#22c55e' },
                  { label:'↓ DOWN', val: fmtRate(c.downRateBps), color:'#60c8ff' },
                  { label:'FREQ',   val: `${c.frequency.toFixed(3)} GHz`, color:'#f59e0b' },
                ].map(({ label, val, color: vc }) => (
                  <div key={label} style={{ fontSize:'10px', fontFamily:'monospace' }}>
                    <span style={{ color:'rgba(100,150,200,0.6)' }}>{label} </span>
                    <span style={{ color: vc }}>{val}</span>
                  </div>
                ))}
              </div>
              <SignalBar dbm={c.powerDbm} color={color} />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding:'6px 14px', borderBlockStart:'1px solid rgba(0,200,255,0.08)',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'9px', color:'rgba(100,150,200,0.5)', fontFamily:'monospace' }}>
          NASA DEEP SPACE NETWORK  · {dishes.length} DISHES ONLINE
        </span>
        <button
          onClick={fetchDSN}
          style={{ fontSize:'9px', color:'#60c8ff', fontFamily:'monospace', background:'none',
            border:'1px solid rgba(0,200,255,0.3)', borderRadius:'3px', padding:'2px 8px', cursor:'pointer' }}>
          REFRESH
        </button>
      </div>
    </div>
  );
}

export default DSNLiveLink;
