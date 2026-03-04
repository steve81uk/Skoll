/**
 * ISSCameraStream — ISS HD Earth Viewing live embed + DOM panel
 *
 * Exports:
 *   ISSCameraPanel  – DOM iframe component (YouTube HD Earth Viewing feed)
 *   default         – alias of ISSCameraPanel for simplicity
 *
 * The stream is the NASA ISS HD Earth Viewing Experiment
 * (https://www.youtube.com/watch?v=xAieE-QtOeM)
 * When the live feed is down NASA replaces it with a recorded replay
 * so the embed is always valid.
 */
import { useState } from 'react';

interface ISSCameraPanelProps {
  visible?: boolean;
}

const STREAM_URL = 'https://www.youtube.com/embed/xAieE-QtOeM?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0';

function SignalIndicator({ live }: { live: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          display:       'inline-block',
          width:         7,
          height:        7,
          borderRadius:  '50%',
          background:    live ? '#00e87a' : '#ffd166',
          boxShadow:     live ? '0 0 6px #00e87a88' : '0 0 6px #ffd16688',
          animation:     live ? 'issPulse 1.8s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ fontSize: '9px', color: live ? '#00e87a' : '#ffd166', letterSpacing: '0.12em' }}>
        {live ? 'LIVE' : 'REPLAY'}
      </span>
    </span>
  );
}

export function ISSCameraPanel({ visible = true }: ISSCameraPanelProps) {
  const [loaded,  setLoaded]  = useState(false);
  const [isLive,  setIsLive]  = useState(true);

  if (!visible) return null;

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        width:         '100%',
        height:        '100%',
        minHeight:     '240px',
        background:    '#08090f',
        borderRadius:  '8px',
        border:        '1px solid rgba(56,189,248,0.18)',
        overflow:      'hidden',
        boxSizing:     'border-box',
      }}
    >
      {/* ── Header bar ── */}
      <div
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           '8px',
          padding:       '5px 10px',
          background:    'rgba(56,189,248,0.05)',
          borderBlockEnd:  '1px solid rgba(56,189,248,0.12)',
          flexShrink:    0,
        }}
      >
        <SignalIndicator live={isLive} />
        <span
          style={{
            fontFamily:    'monospace',
            fontSize:      '10px',
            color:         '#38bdf8',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          ISS · HD Earth Viewing Experiment
        </span>

        {/* Live / Replay toggle label (no real-time detection — just UX) */}
        <button
          onClick={() => setIsLive((v) => !v)}
          style={{
            marginInlineStart:    'auto',
            background:    'transparent',
            border:        '1px solid rgba(56,189,248,0.2)',
            borderRadius:  '4px',
            padding:       '2px 7px',
            color:         'rgba(176,200,212,0.55)',
            cursor:        'pointer',
            fontSize:      '8px',
            fontFamily:    'monospace',
            letterSpacing: '0.1em',
          }}
        >
          {isLive ? 'Mark Replay' : 'Mark Live'}
        </button>
      </div>

      {/* ── iframe stream ── */}
      <div style={{ flex: '1 1 auto', position: 'relative', overflow: 'hidden' }}>
        {/* Loading shimmer */}
        {!loaded && (
          <div
            style={{
              position:   'absolute',
              inset:      0,
              display:    'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#08090f',
              color:      '#38bdf8',
              fontFamily: 'monospace',
              fontSize:   '11px',
              gap:        '10px',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="11" stroke="#38bdf8" strokeWidth="2" strokeDasharray="16 52" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 14 14" to="360 14 14" dur="1s" repeatCount="indefinite" />
              </circle>
            </svg>
            Loading ISS stream…
          </div>
        )}

        <iframe
          src={STREAM_URL}
          title="ISS HD Earth Viewing"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          style={{
            width:       '100%',
            height:      '100%',
            border:      'none',
            display:     loaded ? 'block' : 'none',
            minHeight:   '180px',
          }}
        />
      </div>

      {/* ── Footer meta ── */}
      <div
        style={{
          padding:       '4px 10px',
          background:    'rgba(56,189,248,0.03)',
          borderBlockStart:     '1px solid rgba(56,189,248,0.08)',
          fontSize:      '8px',
          color:         'rgba(176,200,212,0.4)',
          fontFamily:    'monospace',
          letterSpacing: '0.08em',
        }}
      >
        NASA ISS HD Earth Viewing Experiment · Altitude ~408 km · 92-min orbit
      </div>

      {/* ── Keyframe injection ── */}
      <style>{`
        @keyframes issPulse {
          0%, 100% { opacity: 1; transform: scale(1);   }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

export default ISSCameraPanel;
