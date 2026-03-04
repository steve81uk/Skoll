/**
 * SKÖLL-TRACK — LSTM PREDICTIVE GRAPH
 * Recharts visualisation of NOAA/DONKI data + LSTM 24-h KP forecast.
 *
 * Panels:
 *   1. ComposedChart — 24-h KP: area (history) + line (LSTM forecast) + error ribbon
 *   2. BarChart      — CME impact probability by event (arrival time on X-axis)
 *   3. Stats strip   — current Kp, Bt, Bz, storm level badge
 */

import React, { useMemo } from 'react';
import {
  ComposedChart, BarChart, Bar,
  Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts';
import type { NeuralForecast } from '../ml/types';
import type { KPPoint, CMEEvent, NOAABundle } from '../hooks/useNOAADONKI';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STORM_LEVELS = [
  { min: 0, max: 1,  label: 'QUIET',    color: '#22c55e' },
  { min: 1, max: 3,  label: 'UNSETTLED',color: '#84cc16' },
  { min: 3, max: 4,  label: 'MINOR',    color: '#eab308' },
  { min: 4, max: 5,  label: 'MODERATE', color: '#f97316' },
  { min: 5, max: 7,  label: 'STRONG',   color: '#ef4444' },
  { min: 7, max: 9,  label: 'EXTREME',  color: '#a855f7' },
];

function stormLevel(kp: number) {
  return STORM_LEVELS.find((s) => kp >= s.min && kp < s.max) ?? STORM_LEVELS[0];
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
  } catch { return iso?.slice(5, 16) ?? ''; }
}

const PANEL_STYLE: React.CSSProperties = {
  background:   'linear-gradient(135deg, rgba(10,20,40,0.92) 0%, rgba(5,15,30,0.97) 100%)',
  border:       '1px solid rgba(0,200,255,0.18)',
  borderRadius: '10px',
  padding:      '12px',
  backdropFilter:'blur(14px)',
  WebkitBackdropFilter:'blur(14px)',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontFamily: '"Rajdhani", "Share Tech Mono", monospace',
  fill: '#7fa8c8',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KPChartProps {
  kpSeries:   KPPoint[];
  kpCurve24h: number[];
  forecast:   NeuralForecast | null;
}

function KPChart({ kpSeries, kpCurve24h, forecast }: KPChartProps) {
  const data = useMemo(() => {
    const now   = Date.now();
    const obs   = kpSeries
      .filter((p) => p.source === 'observed')
      .slice(-48)                      // last ~8 h at 10-min res
      .map((p) => ({ time: p.time, kp: p.kp, source: 'obs' }));

    const futureBase = obs.length
      ? new Date(obs[obs.length - 1].time).getTime()
      : now;

    const forecast24 = kpCurve24h.map((kp, i) => ({
      time:      new Date(futureBase + (i + 1) * 3600_000).toISOString(),
      predict:   parseFloat(kp.toFixed(2)),
      lower:     parseFloat(Math.max(0, kp - (1 + i * 0.03)).toFixed(2)),
      upper:     parseFloat(Math.min(9, kp + (0.8 + i * 0.04)).toFixed(2)),
      source:    'lstm',
    }));

    return [...obs.map((o) => ({ ...o, predict: undefined, lower: undefined, upper: undefined })),
            ...forecast24.map((f) => ({ ...f, kp: undefined }))];
  }, [kpSeries, kpCurve24h]);

  const pred6h  = forecast?.predictions.sixHour.predictedKp;
  const pred12h = forecast?.predictions.twelveHour.predictedKp;
  const pred24h = forecast?.predictions.twentyFourHour.predictedKp;
  const conf    = forecast?.confidence.overall ?? 0;

  const tickFormatter = (val: string) => fmtTime(val);

  return (
    <div style={PANEL_STYLE}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBlockEnd:'8px' }}>
        <span style={{ fontSize:'13px', fontFamily:'"Rajdhani",monospace', color:'#60c8ff', letterSpacing:'0.08em' }}>
          24-H KP FORECAST /  LSTM
        </span>
        {forecast && (
          <span style={{ fontSize:'11px', color: conf > 0.75 ? '#22c55e' : '#eab308', fontFamily:'monospace' }}>
            CONF {(conf * 100).toFixed(0)}%
          </span>
        )}
      </div>

      <div style={{ borderRadius:'8px', overflow:'hidden',
        background:'rgba(0,8,20,0.55)', border:'1px solid rgba(0,200,255,0.09)',
        boxShadow:'inset 0 1px 0 rgba(0,200,255,0.06)' }}>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={data} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,150,200,0.1)" />
          <XAxis
            dataKey="time"
            tickFormatter={tickFormatter}
            tick={LABEL_STYLE as React.SVGProps<SVGTextElement>}
            interval="preserveStartEnd"
            stroke="#2a4a6a"
          />
          <YAxis
            domain={[0, 9]}
            ticks={[0, 1, 3, 4, 5, 7, 9]}
            tick={LABEL_STYLE as React.SVGProps<SVGTextElement>}
            stroke="#2a4a6a"
          />
          <Tooltip
            contentStyle={{ background:'rgba(5,15,30,0.96)', border:'1px solid #0af', borderRadius:'6px', fontSize:'12px', fontFamily:'monospace', color:'#cce8ff' }}
            labelFormatter={(l) => fmtTime(String(l))}
          />

          {/* Error ribbon */}
          <Area type="monotone" dataKey="upper" stackId="ribbon" stroke="none" fill="rgba(0,180,255,0.08)" />
          <Area type="monotone" dataKey="lower" stackId="ribbon" stroke="none" fill="rgba(5,15,30,0)" />

          {/* KP storm threshold lines */}
          {[3,4,5,7].map((k) => (
            <ReferenceLine key={k} y={k} stroke={stormLevel(k).color} strokeDasharray="4 4" strokeOpacity={0.45} />
          ))}

          {/* Observed KP */}
          <Area
            type="monotone"
            dataKey="kp"
            name="Observed Kp"
            stroke="#38bdf8"
            fill="rgba(56,189,248,0.15)"
            strokeWidth={1.8}
            dot={false}
            connectNulls
          />

          {/* LSTM forecast */}
          <Line
            type="monotone"
            dataKey="predict"
            name="LSTM Forecast"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
          />

          <Legend
            wrapperStyle={{ fontSize:'11px', fontFamily:'monospace', color:'#7fa8c8', paddingTop:'4px' }}
          />
        </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 6 / 12 / 24-h badges */}
      {forecast && (
        <div style={{ display:'flex', gap:'8px', marginBlockStart:'8px', flexWrap:'wrap' }}>
          {[
            { label:'+6h',  kp: pred6h,  conf: forecast.predictions.sixHour.confidenceInterval },
            { label:'+12h', kp: pred12h, conf: forecast.predictions.twelveHour.confidenceInterval },
            { label:'+24h', kp: pred24h, conf: forecast.predictions.twentyFourHour.confidenceInterval },
          ].map(({ label, kp, conf: ci }) => {
            const sl   = stormLevel(kp ?? 0);
            return (
              <div key={label} style={{ flex:1, minInlineSize:'72px', textAlign:'center', background:'rgba(0,20,50,0.6)', borderRadius:'6px', padding:'5px 4px', border:`1px solid ${sl.color}44` }}>
                <div style={{ fontSize:'10px', color:'#7fa8c8', fontFamily:'monospace' }}>{label}</div>
                <div style={{ fontSize:'18px', fontWeight:700, color:sl.color, fontFamily:'"Rajdhani",monospace', lineHeight:1 }}>{(kp ?? 0).toFixed(1)}</div>
                <div style={{ fontSize:'9px', color:sl.color, fontFamily:'monospace', marginBlockStart:'2px' }}>{sl.label}</div>
                {ci && <div style={{ fontSize:'9px', color:'#4a8aaa', fontFamily:'monospace' }}>[{ci.lower.toFixed(1)}–{ci.upper.toFixed(1)}]</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CME Impact Chart ─────────────────────────────────────────────────────────

interface CMEChartProps { cmeEvents: CMEEvent[] }

function CMEImpactChart({ cmeEvents }: CMEChartProps) {
  const data = useMemo(
    () =>
      cmeEvents.slice(0, 10).map((e) => ({
        id:       e.activityID.slice(-8),
        prob:     e.impactProbability,
        speed:    e.speed,
        arrival:  e.arrivalEstimate ? fmtTime(e.arrivalEstimate) : '—',
        type:     e.type,
      })),
    [cmeEvents],
  );

  if (!data.length) {
    return (
      <div style={{ ...PANEL_STYLE, textAlign:'center', color:'#4a7a8a', fontSize:'12px', fontFamily:'monospace', padding:'20px' }}>
        NO CME EVENTS IN LAST 14 DAYS
      </div>
    );
  }

  return (
    <div style={PANEL_STYLE}>
      <div style={{ fontSize:'13px', fontFamily:'"Rajdhani",monospace', color:'#60c8ff', letterSpacing:'0.08em', marginBlockEnd:'8px' }}>
        CME IMPACT PROBABILITY  /  NASA DONKI
      </div>
      <div style={{ borderRadius:'8px', overflow:'hidden',
        background:'rgba(0,8,20,0.55)', border:'1px solid rgba(0,200,255,0.09)',
        boxShadow:'inset 0 1px 0 rgba(0,200,255,0.06)' }}>
        <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top:4, right:10, left:-22, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,150,200,0.1)" />
          <XAxis dataKey="id" tick={LABEL_STYLE as React.SVGProps<SVGTextElement>} stroke="#2a4a6a" />
          <YAxis domain={[0,100]} unit="%" tick={LABEL_STYLE as React.SVGProps<SVGTextElement>} stroke="#2a4a6a" />
          <Tooltip
            contentStyle={{ background:'rgba(5,15,30,0.96)', border:'1px solid #0af', borderRadius:'6px', fontSize:'11px', fontFamily:'monospace', color:'#cce8ff' }}
            formatter={(v, _n, item) => [`${v ?? 0}% [${(item as { payload?: { speed?: number } }).payload?.speed ?? 0} km/s]`, 'Impact Prob']}
            labelFormatter={(l) => `CME: ${l}`}
          />
          <Bar dataKey="prob" name="Impact %" radius={[3,3,0,0]}>
            {data.map((e, i) => (
              <Cell key={i} fill={
                e.prob >= 70 ? '#ef4444' :
                e.prob >= 40 ? '#f97316' :
                e.prob >= 20 ? '#eab308' : '#22c55e'
              } />
            ))}
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display:'flex', gap:'6px', marginBlockStart:'6px', flexWrap:'wrap' }}>
        {data.slice(0, 5).map((e) => (
          <div key={e.id} style={{ fontSize:'10px', fontFamily:'monospace', color:'#60a0b8', background:'rgba(0,20,50,0.7)', borderRadius:'4px', padding:'3px 6px' }}>
            {e.id} → {e.arrival}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status Strip ─────────────────────────────────────────────────────────────

interface StatusStripProps {
  bundle:      NOAABundle | null;
  loading:     boolean;
  lastFetch:   Date | null;
  modelStatus: string;
  modelUsed:   string;
}

function StatusStrip({ bundle, loading, lastFetch, modelStatus, modelUsed }: StatusStripProps) {
  const kp   = bundle?.latestKp ?? 0;
  const sl   = stormLevel(kp);
  const bzGsm= bundle?.bzGsm ?? 0;
  const bt   = bundle?.bt   ?? 0;
  const spd  = bundle?.speed ?? 0;
  const den  = bundle?.density ?? 0;

  return (
    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
      {/* Kp badge */}
      <div style={{ background:`${sl.color}22`, border:`1px solid ${sl.color}66`, borderRadius:'6px', padding:'4px 10px', textAlign:'center' }}>
        <div style={{ fontSize:'9px', color:sl.color, fontFamily:'monospace' }}>Kp NOW</div>
        <div style={{ fontSize:'22px', fontWeight:900, color:sl.color, fontFamily:'"Rajdhani",monospace', lineHeight:1 }}>{kp.toFixed(1)}</div>
        <div style={{ fontSize:'9px', color:sl.color, fontFamily:'monospace' }}>{sl.label}</div>
      </div>

      {/* Params */}
      {[
        { label:'Bz GSM',  value:`${bzGsm.toFixed(1)} nT`, alert: bzGsm < -10 },
        { label:'Bt',      value:`${bt.toFixed(1)} nT`,    alert: bt > 20 },
        { label:'V-WIND',  value:`${spd.toFixed(0)} km/s`, alert: spd > 700 },
        { label:'DENSITY', value:`${den.toFixed(1)} p/cc`,  alert: den > 15 },
      ].map(({ label, value, alert }) => (
        <div key={label} style={{ flex:1, minInlineSize:'72px', background:'rgba(0,20,50,0.5)', border:`1px solid ${alert ? 'rgba(239,68,68,0.4)' : 'rgba(0,200,255,0.12)'}`, borderRadius:'6px', padding:'4px 8px' }}>
          <div style={{ fontSize:'9px', color:alert ? '#fca5a5' : '#7fa8c8', fontFamily:'monospace' }}>{label}</div>
          <div style={{ fontSize:'14px', color:alert ? '#ef4444' : '#cce8ff', fontFamily:'"Rajdhani",monospace', fontWeight:700 }}>{value}</div>
        </div>
      ))}

      {/* Model badge */}
      <div style={{ flex:2, minInlineSize:'120px', background:'rgba(0,20,50,0.5)', border:'1px solid rgba(0,200,255,0.12)', borderRadius:'6px', padding:'4px 8px' }}>
        <div style={{ fontSize:'9px', color:'#7fa8c8', fontFamily:'monospace' }}>INFERENCE ENGINE</div>
        <div style={{ fontSize:'11px', color: modelStatus === 'loaded' ? '#22c55e' : '#eab308', fontFamily:'monospace', lineHeight:1.3 }}>{modelUsed}</div>
        <div style={{ fontSize:'9px', color:'#3a5a7a', fontFamily:'monospace' }}>
          {loading ? 'FETCHING…' : lastFetch ? `UPD ${lastFetch.toUTCString().slice(17,22)} UTC` : '—'}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface LSTMPredictiveGraphProps {
  forecast:    NeuralForecast | null;
  kpCurve24h:  number[];
  donkiCMEs:   CMEEvent[];
  bundle:      NOAABundle | null;
  loading:     boolean;
  lastFetch:   Date | null;
  modelStatus: string;
  modelUsed:   string;
}

export function LSTMPredictiveGraph({
  forecast,
  kpCurve24h,
  donkiCMEs,
  bundle,
  loading,
  lastFetch,
  modelStatus,
  modelUsed,
}: LSTMPredictiveGraphProps) {
  const kpSeries = bundle?.kpSeries ?? [];

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           '10px',
      padding:       '10px',
      fontFamily:    '"Rajdhani", "Share Tech Mono", monospace',
      minInlineSize:      '340px',
      maxInlineSize:      '520px',
    }}>
      <StatusStrip
        bundle={bundle}
        loading={loading}
        lastFetch={lastFetch}
        modelStatus={modelStatus}
        modelUsed={modelUsed}
      />
      <KPChart
        kpSeries={kpSeries}
        kpCurve24h={kpCurve24h}
        forecast={forecast}
      />
      <CMEImpactChart cmeEvents={donkiCMEs} />

      {/* Alerts */}
      {forecast?.alerts && forecast.alerts.length > 0 && (
        <div style={PANEL_STYLE}>
          {forecast.alerts.map((a, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBlockEnd: i < forecast.alerts.length - 1 ? '6px' : 0 }}>
              <div style={{ fontSize:'18px', lineHeight:1, marginBlockStart:'0px' }}>
                {a.severity === 'Critical' ? '🔴' : a.severity === 'Warning' ? '🟠' : '🟡'}
              </div>
              <div>
                <div style={{ fontSize:'11px', color: a.severity === 'Critical' ? '#ef4444' : '#f97316', fontFamily:'monospace', lineHeight:1.2 }}>{a.message}</div>
                <div style={{ fontSize:'10px', color:'#4a7a8a', fontFamily:'monospace' }}>{(a.probability * 100).toFixed(0)}% probability · {a.affectedRegions.filter(Boolean).join(', ')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LSTMPredictiveGraph;
